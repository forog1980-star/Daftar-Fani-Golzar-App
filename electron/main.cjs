'use strict';

const fs = require('fs');
const path = require('path');
const { app, BrowserWindow, dialog, ipcMain, net, protocol, shell } = require('electron');
const {
  DEFAULT_WINDOWS_DATA_ROOT,
  appendLogLine,
  cleanupEphemeralProbeDir,
  createEphemeralProbeDir,
  getDetailedStorageInfo,
  isDriveCPath,
  migrateStorageRootSafe,
  resolveSaveTargetPath,
  resolveStartupStorageRoot,
  verifyStorageRootWritable,
  writeBootstrapConfig,
} = require('./storagePolicy.cjs');

const APP_TITLE = 'دفتر فنی اداره گلزار شهدا';
const CUSTOM_SCHEME = 'daftar-fani';

// Register privileged custom protocol for stable, origin-scoped IndexedDB in D:\Daftar-Fani-Golzar\Database
protocol.registerSchemesAsPrivileged([
  {
    scheme: CUSTOM_SCHEME,
    privileges: {
      standard: true,
      secure: true,
      supportFetchAPI: true,
      corsEnabled: true,
      stream: true,
    },
  },
]);

// Tiny bootstrap config file ONLY used if user explicitly approves a custom path other than D:\Daftar-Fani-Golzar
function getBootstrapConfigPath() {
  const baseDir =
    process.platform === 'win32'
      ? path.join(process.env.LOCALAPPDATA || app.getPath('appData'), 'Daftar-Fani-Golzar-Launcher')
      : path.join(app.getPath('appData'), 'Daftar-Fani-Golzar-Launcher');
  return path.join(baseDir, 'storage-config.json');
}

const BOOTSTRAP_CONFIG_PATH = getBootstrapConfigPath();
let activeDataRoot = DEFAULT_WINDOWS_DATA_ROOT;
let ephemeralProbeDir = null;
let mainWindow = null;

/**
 * Resolves D:\Daftar-Fani-Golzar BEFORE Chromium initializes userData/IndexedDB.
 * If D:\ is unavailable, redirects Chromium's transient userData strictly to an ephemeral
 * temp probe folder (deleted on exit) so %APPDATA% on drive C:\ is NEVER created or polluted.
 */
function ensureStartupStorageBeforeReady() {
  const initial = resolveStartupStorageRoot({
    configPath: BOOTSTRAP_CONFIG_PATH,
    defaultRoot: DEFAULT_WINDOWS_DATA_ROOT,
    checkWindowsDrive: process.platform === 'win32',
  });

  if (initial.ok) {
    activeDataRoot = initial.dataRoot;
    app.setPath('userData', path.join(activeDataRoot, 'Database'));
    app.setPath('logs', path.join(activeDataRoot, 'Logs'));
    appendLogLine(
      activeDataRoot,
      'info',
      `Application starting. Real IndexedDB userData path set to: ${path.join(activeDataRoot, 'Database')}`
    );
    return true;
  }

  // Prevent Chromium from touching %APPDATA% on C:\ while displaying the drive-unavailable dialog
  try {
    ephemeralProbeDir = createEphemeralProbeDir();
    app.setPath('userData', ephemeralProbeDir);
    app.setPath('sessionData', ephemeralProbeDir);
    app.setPath('logs', path.join(ephemeralProbeDir, 'logs'));
  } catch {
    // Non-fatal fallback; dialog still blocks app launch
  }

  return false;
}

const startupReadySynchronously = ensureStartupStorageBeforeReady();

function promptUserWhenDriveUnavailable() {
  while (true) {
    const check = resolveStartupStorageRoot({
      configPath: BOOTSTRAP_CONFIG_PATH,
      defaultRoot: DEFAULT_WINDOWS_DATA_ROOT,
      checkWindowsDrive: process.platform === 'win32',
    });
    if (check.ok) {
      return check.dataRoot;
    }

    const choice = dialog.showMessageBoxSync({
      type: 'warning',
      title: APP_TITLE,
      message: 'مسیر اصلی ذخیره اطلاعات در درایو D در دسترس نیست',
      detail:
        `${check.message}\n\n` +
        `مسیر مورد انتظار: ${check.attemptedPath}\n\n` +
        'برای جلوگیری از ذخیره ناخواسته اطلاعات روی درایو C، نرم‌افزار به‌صورت خودکار مسیر ذخیره را تغییر نمی‌دهد. لطفاً یکی از گزینه‌های زیر را انتخاب کنید:',
      buttons: ['انتخاب مسیر دلخواه با تأیید کاربر', 'بررسی مجدد درایو D', 'خروج از برنامه'],
      defaultId: 1,
      cancelId: 2,
      noLink: true,
    });

    if (choice === 2) {
      return null;
    }

    if (choice === 1) {
      continue;
    }

    if (choice === 0) {
      const selected = dialog.showOpenDialogSync({
        title: 'انتخاب پوشه ذخیره اطلاعات نرم‌افزار دفتر فنی',
        properties: ['openDirectory', 'createDirectory'],
      });
      if (!selected || selected.length === 0) {
        continue;
      }
      const chosenPath = selected[0];
      if (isDriveCPath(chosenPath)) {
        const confirmC = dialog.showMessageBoxSync({
          type: 'question',
          title: 'تأیید انتخاب مسیر روی درایو C',
          message: 'مسیر انتخابی روی درایو C قرار دارد',
          detail:
            `مسیر انتخاب‌شده: ${chosenPath}\n` +
            'آیا مطمئن هستید که می‌خواهید اطلاعات نرم‌افزار در این مسیر روی درایو C ذخیره شوند؟',
          buttons: ['بله، تأیید می‌کنم', 'انصراف و انتخاب مسیر دیگر'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        });
        if (confirmC !== 0) {
          continue;
        }
      }

      const verify = verifyStorageRootWritable(chosenPath, {
        checkWindowsDrive: process.platform === 'win32',
      });
      if (!verify.ok) {
        dialog.showErrorBox('خطا در دسترسی به پوشه', verify.message);
        continue;
      }

      writeBootstrapConfig(BOOTSTRAP_CONFIG_PATH, chosenPath);
      return chosenPath;
    }
  }
}

function getMimeType(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  const map = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.webp': 'image/webp',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2',
    '.ttf': 'font/ttf',
  };
  return map[ext] || 'application/octet-stream';
}

function resolveBundledPath(...segments) {
  const insidePackage = path.join(__dirname, ...segments);
  if (fs.existsSync(insidePackage)) {
    return insidePackage;
  }
  return path.resolve(__dirname, '..', ...segments);
}

function registerStaticDistProtocol() {
  const distDir = resolveBundledPath('dist');

  protocol.handle(CUSTOM_SCHEME, (request) => {
    const reqUrl = new URL(request.url);
    let relPath = decodeURIComponent(reqUrl.pathname || '/');
    if (relPath === '/' || !relPath) {
      relPath = '/index.html';
    }
    const candidate = path.normalize(path.join(distDir, relPath));
    // Prevent directory traversal outside dist/
    const finalPath =
      candidate.startsWith(distDir) && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        ? candidate
        : path.join(distDir, 'index.html');

    const data = fs.readFileSync(finalPath);
    return new Response(data, {
      status: 200,
      headers: {
        'content-type': getMimeType(finalPath),
      },
    });
  });
}

function createMainWindow() {
  const iconPath = resolveBundledPath('build-resources', 'icon.ico');

  mainWindow = new BrowserWindow({
    width: 1360,
    height: 860,
    minWidth: 960,
    minHeight: 640,
    title: APP_TITLE,
    backgroundColor: '#FAF8F3',
    icon: fs.existsSync(iconPath) ? iconPath : undefined,
    autoHideMenuBar: true,
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: false,
      spellcheck: false,
    },
  });

  mainWindow.once('ready-to-show', () => {
    mainWindow?.show();
  });

  // Open external http/https links (such as GitHub Releases) in the user's default OS browser
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//i.test(url)) {
      shell.openExternal(url);
    }
    return { action: 'deny' };
  });

  mainWindow.webContents.on('will-navigate', (event, url) => {
    if (/^https?:\/\//i.test(url)) {
      event.preventDefault();
      shell.openExternal(url);
    }
  });

  mainWindow.loadURL(`${CUSTOM_SCHEME}://app/index.html`);

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

function registerIpcHandlers() {
  ipcMain.handle('desktop:get-storage-info', async () => {
    return getDetailedStorageInfo(activeDataRoot, BOOTSTRAP_CONFIG_PATH);
  });

  ipcMain.handle('desktop:open-folder', async (_event, subfolder) => {
    try {
      const target = subfolder ? path.join(activeDataRoot, String(subfolder)) : activeDataRoot;
      fs.mkdirSync(target, { recursive: true });
      const errMsg = await shell.openPath(target);
      if (errMsg) {
        return { ok: false, error: errMsg };
      }
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:save-file', async (_event, payload) => {
    try {
      const { subName, targetDir, targetPath } = resolveSaveTargetPath(
        activeDataRoot,
        payload?.category,
        payload?.filename,
        payload?.mimeType
      );
      fs.mkdirSync(targetDir, { recursive: true });

      const buffer = Buffer.from(String(payload?.base64Data || ''), 'base64');
      fs.writeFileSync(targetPath, buffer);
      appendLogLine(activeDataRoot, 'info', `Saved ${subName} file: ${targetPath} (${buffer.length} bytes)`);
      return { ok: true, savedPath: targetPath };
    } catch (err) {
      appendLogLine(activeDataRoot, 'error', `Save file failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:relocate-storage', async (_event, payload) => {
    try {
      const picked = await dialog.showOpenDialog(mainWindow, {
        title: 'انتخاب پوشه جایگزین برای نگهداری اطلاعات نرم‌افزار',
        defaultPath: activeDataRoot,
        properties: ['openDirectory', 'createDirectory'],
      });
      if (picked.canceled || !picked.filePaths || picked.filePaths.length === 0) {
        return { ok: false, cancelled: true };
      }
      const targetRoot = picked.filePaths[0];
      if (isDriveCPath(targetRoot)) {
        const confirmC = dialog.showMessageBoxSync(mainWindow, {
          type: 'warning',
          title: 'تأیید انتقال به درایو C',
          message: 'مسیر انتخابی روی درایو C قرار دارد',
          detail:
            `مسیر انتخابی: ${targetRoot}\n` +
            'توصیه می‌شود اطلاعات روی درایو غیرسیستمی (مانند درایو D) نگهداری شوند. آیا انتقال به این مسیر را تأیید می‌کنید؟',
          buttons: ['بله، انتقال انجام شود', 'انصراف'],
          defaultId: 1,
          cancelId: 1,
          noLink: true,
        });
        if (confirmC !== 0) {
          return { ok: false, cancelled: true };
        }
      }

      const result = migrateStorageRootSafe({
        sourceRoot: activeDataRoot,
        targetRoot,
        configPath: BOOTSTRAP_CONFIG_PATH,
        backupBase64: payload?.backupBase64,
        backupFilename: payload?.backupFilename,
        checkWindowsDrive: process.platform === 'win32',
      });
      return result;
    } catch (err) {
      appendLogLine(activeDataRoot, 'error', `Storage relocation failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:relaunch', async () => {
    app.relaunch();
    app.exit(0);
  });

  ipcMain.handle('desktop:log', async (_event, payload) => {
    appendLogLine(activeDataRoot, payload?.level || 'info', String(payload?.message || ''));
  });

  // Native Electron main-process HTTPS JSON fetch (uses Windows proxy/certs & avoids custom-scheme CORS)
  ipcMain.handle('desktop:fetch-json', async (_event, rawUrl) => {
    const urlStr = String(rawUrl || '').trim();
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return { ok: false, status: 0, errorCode: 'INVALID_URL', errorMessage: 'Invalid URL' };
    }
    const isHttps = parsed.protocol === 'https:';
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) {
      return { ok: false, status: 0, errorCode: 'INVALID_PROTOCOL', errorMessage: 'HTTPS required' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 12000);
    try {
      const res = await net.fetch(parsed.toString(), {
        method: 'GET',
        cache: 'no-store',
        headers: {
          Accept: 'application/json, application/vnd.github+json',
          'User-Agent': 'Daftar-Fani-Golzar-Desktop',
        },
        signal: controller.signal,
      });
      const bodyText = await res.text();
      return {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText || '',
        bodyText,
      };
    } catch (err) {
      const isAbort = err && err.name === 'AbortError';
      const errMsg = err && err.message ? String(err.message) : 'Network error';
      appendLogLine(activeDataRoot, 'warn', `desktop:fetch-json failed for ${parsed.origin}${parsed.pathname}: ${errMsg}`);
      return {
        ok: false,
        status: 0,
        errorCode: isAbort ? 'TIMEOUT' : 'NETWORK_ERROR',
        errorMessage: errMsg,
      };
    } finally {
      clearTimeout(timer);
    }
  });

  // One-click verified Windows EXE installer download & launch (strictly limited to official GitHub Release .exe)
  ipcMain.handle('desktop:download-and-run-installer', async (_event, payload) => {
    const rawUrl = String(payload?.downloadUrl || '').trim();
    const fileNameRaw = String(payload?.fileName || 'Daftar-Fani-Golzar-Setup.exe').trim();
    const safeName = fileNameRaw.replace(/[^a-zA-Z0-9._-]/g, '_');
    if (!safeName.toLowerCase().endsWith('.exe')) {
      return { ok: false, error: 'فایل انتخاب‌شده قالب نصاب ویندوز (.exe) ندارد.' };
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return { ok: false, error: 'نشانی فایل نصبی معتبر نیست.' };
    }
    if (
      parsed.protocol !== 'https:' ||
      parsed.hostname !== 'github.com' ||
      !parsed.pathname.toLowerCase().includes('/releases/download/') ||
      !parsed.pathname.toLowerCase().endsWith('.exe')
    ) {
      return { ok: false, error: 'دانلود خودکار صرفاً از نشانی رسمی GitHub Releases مجاز است.' };
    }

    const updatesDir = path.join(activeDataRoot, 'Backups', 'Updates');
    try {
      fs.mkdirSync(updatesDir, { recursive: true });
      const targetPath = path.join(updatesDir, safeName);
      appendLogLine(activeDataRoot, 'info', `Downloading Windows update from ${rawUrl}`);

      const res = await net.fetch(parsed.toString(), {
        method: 'GET',
        redirect: 'follow',
        headers: { 'User-Agent': 'Daftar-Fani-Golzar-Desktop' },
      });
      if (!res.ok) {
        return { ok: false, error: `دانلود نصاب جدید با خطای HTTP ${res.status} متوقف شد.` };
      }
      const arrBuf = await res.arrayBuffer();
      const buffer = Buffer.from(arrBuf);

      // Verify genuine Windows PE executable header ("MZ") and minimum plausible installer size
      if (buffer.length < 1024 * 1024 || buffer[0] !== 0x4d || buffer[1] !== 0x5a) {
        appendLogLine(activeDataRoot, 'error', `Downloaded file failed PE/size validation (${buffer.length} bytes).`);
        return {
          ok: false,
          error: 'فایل دانلودشده یک نصاب معتبر ویندوز (EXE) نبود و اجرا نشد. لطفاً دوباره تلاش کنید.',
        };
      }

      fs.writeFileSync(targetPath, buffer);
      appendLogLine(activeDataRoot, 'info', `Verified update installer saved: ${targetPath} (${buffer.length} bytes)`);

      const openErr = await shell.openPath(targetPath);
      if (openErr) {
        return { ok: false, error: `فایل نصاب ذخیره شد اما اجرای خودکار ناموفق بود: ${openErr}`, savedPath: targetPath };
      }

      setTimeout(() => {
        app.quit();
      }, 700);

      return { ok: true, savedPath: targetPath };
    } catch (err) {
      const errMsg = err && err.message ? String(err.message) : 'خطا در دانلود فایل نصاب';
      appendLogLine(activeDataRoot, 'error', `Windows auto-update download failed: ${errMsg}`);
      return { ok: false, error: `خطا در دریافت فایل نصاب ویندوز: ${errMsg}` };
    }
  });
}

// Single-instance lock so two desktop windows never contend on the same IndexedDB directory
const gotSingleInstanceLock = app.requestSingleInstanceLock();
if (!gotSingleInstanceLock) {
  app.quit();
} else {
  app.on('second-instance', () => {
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on('will-quit', () => {
    cleanupEphemeralProbeDir(ephemeralProbeDir);
    ephemeralProbeDir = null;
  });

  app.whenReady().then(() => {
    if (!startupReadySynchronously) {
      const approvedRoot = promptUserWhenDriveUnavailable();
      cleanupEphemeralProbeDir(ephemeralProbeDir);
      ephemeralProbeDir = null;
      if (!approvedRoot) {
        app.quit();
        return;
      }
      // Relaunch immediately so app.setPath('userData') takes effect cleanly BEFORE Chromium opens IndexedDB
      app.relaunch();
      app.exit(0);
      return;
    }

    registerStaticDistProtocol();
    registerIpcHandlers();
    createMainWindow();
  });

  app.on('window-all-closed', () => {
    app.quit();
  });
}
