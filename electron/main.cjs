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

function compareSemverSimple(a, b) {
  const pa = String(a || '0')
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = String(b || '0')
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length, 3);
  for (let i = 0; i < len; i++) {
    const da = pa[i] ?? 0;
    const db = pb[i] ?? 0;
    if (da > db) return 1;
    if (da < db) return -1;
  }
  return 0;
}

function readVersionJsonFromDir(dirPath) {
  try {
    const versionFile = path.join(dirPath, 'version.json');
    if (!fs.existsSync(versionFile)) return null;
    const parsed = JSON.parse(fs.readFileSync(versionFile, 'utf-8'));
    if (parsed && typeof parsed.version === 'string' && parsed.version.trim()) {
      return {
        version: parsed.version.trim(),
        buildId: typeof parsed.buildId === 'string' ? parsed.buildId.trim() : null,
        builtAt: typeof parsed.builtAt === 'string' ? parsed.builtAt.trim() : null,
      };
    }
  } catch {
    // Ignore malformed version.json
  }
  return null;
}

function getOtaBundleRoot() {
  return path.join(activeDataRoot, 'AppBundle');
}

function resolveActiveDistDir() {
  const bundledDir = resolveBundledPath('dist');
  const otaCurrentDir = path.join(getOtaBundleRoot(), 'current');
  try {
    const otaIndex = path.join(otaCurrentDir, 'index.html');
    if (fs.existsSync(otaIndex)) {
      const otaMeta = readVersionJsonFromDir(otaCurrentDir);
      const bundledMeta = readVersionJsonFromDir(bundledDir);
      if (otaMeta) {
        const cmp = compareSemverSimple(otaMeta.version, bundledMeta?.version || '0.0.0');
        if (cmp >= 0) {
          return {
            dir: otaCurrentDir,
            isOtaBundle: true,
            meta: otaMeta,
            bundledVersion: bundledMeta?.version || null,
          };
        }
      }
    }
  } catch {
    // Fall back safely to bundled dist/
  }
  const bundledMeta = readVersionJsonFromDir(bundledDir);
  return {
    dir: bundledDir,
    isOtaBundle: false,
    meta: bundledMeta,
    bundledVersion: bundledMeta?.version || null,
  };
}

function registerStaticDistProtocol() {
  protocol.handle(CUSTOM_SCHEME, (request) => {
    const active = resolveActiveDistDir();
    const distDir = path.resolve(active.dir);
    const reqUrl = new URL(request.url);
    let relPath = decodeURIComponent(reqUrl.pathname || '/');
    relPath = relPath.replace(/^\/Daftar-Fani-Golzar-App\//i, '/');
    if (relPath === '/' || !relPath) {
      relPath = '/index.html';
    }
    const candidate = path.resolve(path.join(distDir, relPath));
    // Prevent directory traversal outside active distDir
    const isInside =
      candidate === distDir || candidate.startsWith(distDir + path.sep);
    const finalPath =
      isInside && fs.existsSync(candidate) && fs.statSync(candidate).isFile()
        ? candidate
        : path.join(distDir, 'index.html');

    const data = fs.readFileSync(finalPath);
    const lowerName = path.basename(finalPath).toLowerCase();
    const headers = {
      'content-type': getMimeType(finalPath),
    };
    if (lowerName === 'index.html' || lowerName === 'version.json' || lowerName === 'update-manifest.json') {
      headers['cache-control'] = 'no-store';
    }
    return new Response(data, {
      status: 200,
      headers,
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
      const buffer = Buffer.from(String(payload?.base64Data || ''), 'base64');
      if (buffer.length === 0) {
        return { ok: false, error: 'فایل تولیدشده خالی است و قابل ذخیره نیست.' };
      }

      let finalPath = targetPath;
      if (payload?.interactive && mainWindow && !mainWindow.isDestroyed()) {
        fs.mkdirSync(targetDir, { recursive: true });
        const ext = path.extname(targetPath).replace(/^\./, '').toLowerCase();
        const filters = [];
        if (ext === 'docx') filters.push({ name: 'Word Document (*.docx)', extensions: ['docx'] });
        else if (ext === 'xlsx') filters.push({ name: 'Excel Workbook (*.xlsx)', extensions: ['xlsx'] });
        else if (ext === 'json') filters.push({ name: 'JSON Data (*.json)', extensions: ['json'] });
        else if (ext === 'zip') filters.push({ name: 'ZIP Backup (*.zip)', extensions: ['zip'] });
        else if (ext === 'html' || ext === 'htm') filters.push({ name: 'Printable HTML (*.html)', extensions: ['html', 'htm'] });
        else if (ext === 'pdf') filters.push({ name: 'PDF Document (*.pdf)', extensions: ['pdf'] });
        else if (ext) filters.push({ name: `File (*.${ext})`, extensions: [ext] });
        filters.push({ name: 'All Files (*.*)', extensions: ['*'] });

        const picked = await dialog.showSaveDialog(mainWindow, {
          title: 'ذخیره فایل خروجی — دفتر فنی اداره گلزار شهدا',
          defaultPath: targetPath,
          buttonLabel: 'ذخیره فایل',
          filters,
        });

        if (picked.canceled || !picked.filePath) {
          return { ok: false, cancelled: true };
        }
        finalPath = picked.filePath;
        fs.mkdirSync(path.dirname(finalPath), { recursive: true });
        fs.writeFileSync(finalPath, buffer);

        // Also archive a copy in D:\Daftar-Fani-Golzar\Exports or Backups when user chose another folder
        if (
          payload?.category !== 'attachments' &&
          path.resolve(finalPath).toLowerCase() !== path.resolve(targetPath).toLowerCase()
        ) {
          try {
            fs.writeFileSync(targetPath, buffer);
          } catch {
            // Archive copy is best-effort; primary user-chosen file already succeeded
          }
        }

        appendLogLine(activeDataRoot, 'info', `Saved interactive ${subName} file: ${finalPath} (${buffer.length} bytes)`);
        try {
          shell.showItemInFolder(finalPath);
        } catch {
          // Non-fatal
        }
        return { ok: true, savedPath: finalPath };
      }

      fs.mkdirSync(targetDir, { recursive: true });
      fs.writeFileSync(targetPath, buffer);
      appendLogLine(activeDataRoot, 'info', `Saved ${subName} file: ${targetPath} (${buffer.length} bytes)`);
      return { ok: true, savedPath: targetPath };
    } catch (err) {
      appendLogLine(activeDataRoot, 'error', `Save file failed: ${err.message}`);
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:open-file', async (_event, filePath) => {
    try {
      const target = String(filePath || '').trim();
      if (!target || !fs.existsSync(target)) {
        return { ok: false, error: 'فایل موردنظر در مسیر مشخص‌شده یافت نشد.' };
      }
      const errMsg = await shell.openPath(target);
      return errMsg ? { ok: false, error: errMsg } : { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:show-in-folder', async (_event, filePath) => {
    try {
      const target = String(filePath || '').trim();
      if (!target || !fs.existsSync(target)) {
        return { ok: false, error: 'مسیر فایل در سیستم یافت نشد.' };
      }
      shell.showItemInFolder(target);
      return { ok: true };
    } catch (err) {
      return { ok: false, error: err.message };
    }
  });

  ipcMain.handle('desktop:open-external', async (_event, rawUrl) => {
    try {
      const parsed = new URL(String(rawUrl || '').trim());
      if (parsed.protocol !== 'https:') {
        return { ok: false, error: 'فقط نشانی‌های امن HTTPS مجاز به باز شدن هستند.' };
      }
      await shell.openExternal(parsed.toString());
      return { ok: true };
    } catch (err) {
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
      !/\/releases\/(latest\/)?download\//i.test(parsed.pathname) ||
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

  // HEAD probe for installer download URLs via Windows native network stack (no renderer CORS failures)
  ipcMain.handle('desktop:verify-download-url', async (_event, rawUrl) => {
    const urlStr = String(rawUrl || '').trim();
    let parsed;
    try {
      parsed = new URL(urlStr);
    } catch {
      return { ok: false, status: 0, error: 'نشانی دانلود نامعتبر است.' };
    }
    if (parsed.protocol !== 'https:') {
      return { ok: false, status: 0, error: 'نشانی دانلود باید با HTTPS شروع شود.' };
    }

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      const res = await net.fetch(parsed.toString(), {
        method: 'HEAD',
        redirect: 'follow',
        headers: { 'User-Agent': 'Daftar-Fani-Golzar-Desktop' },
        signal: controller.signal,
      });
      const contentType = res.headers.get('content-type') || '';
      const contentLength = Number(res.headers.get('content-length') || 0);
      if (!res.ok) {
        return {
          ok: false,
          status: res.status,
          contentType,
          contentLength,
          error: `لینک فایل نصبی در دسترس نیست (کد وضعیت HTTP ${res.status}).`,
        };
      }
      if (contentType.toLowerCase().includes('text/html')) {
        return {
          ok: false,
          status: res.status,
          contentType,
          contentLength,
          error: 'نشانی دانلود به‌جای فایل نصبی به یک صفحه وب (HTML) اشاره می‌کند.',
        };
      }
      return { ok: true, status: res.status, contentType, contentLength };
    } catch (err) {
      const isAbort = err && err.name === 'AbortError';
      return {
        ok: false,
        status: 0,
        error: isAbort
          ? 'زمان انتظار برای بررسی لینک دانلود به پایان رسید.'
          : 'برقراری ارتباط با سرور دانلود فایل نصبی ناموفق بود.',
      };
    } finally {
      clearTimeout(timer);
    }
  });

  // Read active local app version directly from the app's own directory (OTA AppBundle or bundled dist)
  ipcMain.handle('desktop:get-local-version-info', async () => {
    const active = resolveActiveDistDir();
    return {
      ok: true,
      version: active.meta?.version || null,
      buildId: active.meta?.buildId || null,
      builtAt: active.meta?.builtAt || null,
      activeDistDir: active.dir,
      isOtaBundle: active.isOtaBundle,
      bundledVersion: active.bundledVersion,
    };
  });

  // Atomic OTA bundle update directly from GitHub Pages into D:\Daftar-Fani-Golzar\AppBundle\current
  ipcMain.handle('desktop:apply-bundle-update', async (_event, payload) => {
    const rawBase = String(
      payload?.baseUrl || 'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/'
    ).trim();

    let baseParsed;
    try {
      baseParsed = new URL(rawBase.endsWith('/') ? rawBase : `${rawBase}/`);
    } catch {
      return { ok: false, error: 'نشانی منبع به‌روزرسانی معتبر نیست.' };
    }
    const isHttps = baseParsed.protocol === 'https:';
    const isLocalHttp =
      baseParsed.protocol === 'http:' &&
      (baseParsed.hostname === 'localhost' || baseParsed.hostname === '127.0.0.1');
    if (!isHttps && !isLocalHttp) {
      return { ok: false, error: 'منبع به‌روزرسانی باید با پروتکل امن HTTPS باشد.' };
    }

    const fetchWithRetry = async (targetUrl, asText) => {
      const delays = [500, 1000, 2000];
      let lastErr = 'خطای اتصال به سرور';
      for (let attempt = 0; attempt <= delays.length; attempt++) {
        const controller = new AbortController();
        const timer = setTimeout(() => controller.abort(), 15000);
        try {
          const res = await net.fetch(targetUrl, {
            method: 'GET',
            cache: 'no-store',
            redirect: 'follow',
            headers: { 'User-Agent': 'Daftar-Fani-Golzar-Desktop' },
            signal: controller.signal,
          });
          if (res.ok) {
            return {
              ok: true,
              status: res.status,
              data: asText ? await res.text() : Buffer.from(await res.arrayBuffer()),
            };
          }
          lastErr = `HTTP ${res.status}`;
          if (res.status === 404 || res.status === 403 || res.status === 400) {
            return { ok: false, status: res.status, error: lastErr };
          }
        } catch (err) {
          lastErr = err && err.name === 'AbortError' ? 'TIMEOUT' : err?.message || 'NETWORK_ERROR';
        } finally {
          clearTimeout(timer);
        }
        if (attempt < delays.length) {
          await new Promise((r) => setTimeout(r, delays[attempt]));
        }
      }
      return { ok: false, status: 0, error: lastErr };
    };

    const candidateBases = [
      new URL('native-bundle/', baseParsed).toString(),
      baseParsed.toString(),
    ];

    let manifest = null;
    let activeBundleBase = null;
    let lastManifestErr = '';

    for (const candidateBase of candidateBases) {
      const manifestUrl = `${candidateBase}update-manifest.json?t=${Date.now()}`;
      const mRes = await fetchWithRetry(manifestUrl, true);
      if (mRes.ok) {
        try {
          const parsed = JSON.parse(mRes.data);
          if (parsed && Array.isArray(parsed.files) && parsed.files.length > 0) {
            manifest = parsed;
            activeBundleBase = candidateBase;
            break;
          }
        } catch {
          lastManifestErr = 'قالب فایل update-manifest.json معتبر نبود.';
        }
      } else {
        lastManifestErr = mRes.error || 'خطا در دریافت update-manifest.json';
      }
    }

    if (!manifest || !activeBundleBase) {
      appendLogLine(activeDataRoot, 'warn', `OTA manifest fetch failed: ${lastManifestErr}`);
      return {
        ok: false,
        error: 'Network error: check connection',
        detail: lastManifestErr,
      };
    }

    const files = manifest.files.filter(
      (f) =>
        typeof f === 'string' &&
        f.length > 0 &&
        !f.includes('..') &&
        !f.startsWith('/') &&
        !f.includes('\\') &&
        !/[\x00-\x1f]/.test(f)
    );
    if (!files.includes('index.html') || files.length > 250) {
      return { ok: false, error: 'فهرست فایل‌های بسته به‌روزرسانی ناقص یا نامعتبر است.' };
    }

    const bundleRoot = getOtaBundleRoot();
    const stagingDir = path.join(bundleRoot, 'staging');
    const currentDir = path.join(bundleRoot, 'current');
    const previousDir = path.join(bundleRoot, 'previous');

    try {
      fs.rmSync(stagingDir, { recursive: true, force: true });
      fs.mkdirSync(stagingDir, { recursive: true });

      const resolvedStaging = path.resolve(stagingDir);
      for (const rel of files) {
        const dest = path.resolve(path.join(resolvedStaging, rel));
        if (!dest.startsWith(resolvedStaging + path.sep)) {
          throw new Error(`Invalid bundle path: ${rel}`);
        }
        const fileUrl = `${activeBundleBase}${rel.split('/').map(encodeURIComponent).join('/')}?t=${Date.now()}`;
        const fRes = await fetchWithRetry(fileUrl, false);
        if (!fRes.ok) {
          throw new Error(`Failed downloading ${rel}: ${fRes.error}`);
        }
        let fileBuf = fRes.data;
        if (rel === 'index.html') {
          let htmlText = fileBuf.toString('utf-8');
          if (!/<html/i.test(htmlText) && !/<!doctype/i.test(htmlText)) {
            throw new Error('Downloaded index.html is invalid');
          }
          // Normalize root GitHub Pages paths to relative paths if falling back to root manifest
          htmlText = htmlText.replace(/(["'(])\/Daftar-Fani-Golzar-App\//gi, '$1./');
          fileBuf = Buffer.from(htmlText, 'utf-8');
        }
        fs.mkdirSync(path.dirname(dest), { recursive: true });
        fs.writeFileSync(dest, fileBuf);
      }

      // Ensure version.json exists inside staging
      const stagedVersionPath = path.join(resolvedStaging, 'version.json');
      if (!fs.existsSync(stagedVersionPath)) {
        fs.writeFileSync(
          stagedVersionPath,
          JSON.stringify(
            {
              version: String(manifest.version || '1.4.2'),
              buildId: String(manifest.buildId || ''),
              builtAt: String(manifest.builtAt || new Date().toISOString()),
            },
            null,
            2
          ),
          'utf-8'
        );
      }

      // Atomic swap: current -> previous, staging -> current
      if (fs.existsSync(previousDir)) {
        fs.rmSync(previousDir, { recursive: true, force: true });
      }
      if (fs.existsSync(currentDir)) {
        fs.renameSync(currentDir, previousDir);
      }
      fs.renameSync(stagingDir, currentDir);

      appendLogLine(
        activeDataRoot,
        'info',
        `Applied OTA bundle update v${manifest.version} (${files.length} files) to ${currentDir}`
      );

      if (mainWindow && !mainWindow.isDestroyed()) {
        setTimeout(() => {
          if (mainWindow && !mainWindow.isDestroyed()) {
            mainWindow.webContents.reloadIgnoringCache();
          }
        }, 350);
      }

      return {
        ok: true,
        version: String(manifest.version || ''),
        buildId: String(manifest.buildId || ''),
        filesCount: files.length,
        activeDistDir: currentDir,
      };
    } catch (err) {
      try {
        fs.rmSync(stagingDir, { recursive: true, force: true });
      } catch {
        // Ignore cleanup failure
      }
      const msg = err && err.message ? String(err.message) : 'خطای دریافت فایل‌های به‌روزرسانی';
      appendLogLine(activeDataRoot, 'error', `OTA bundle update failed: ${msg}`);
      return {
        ok: false,
        error: 'Network error: check connection',
        detail: msg,
      };
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
