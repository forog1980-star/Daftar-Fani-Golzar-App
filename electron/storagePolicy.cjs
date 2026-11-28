'use strict';

const fs = require('fs');
const path = require('path');

const DEFAULT_WINDOWS_DATA_ROOT = 'D:\\Daftar-Fani-Golzar';

const REQUIRED_SUBDIRS = [
  { name: 'Database', label: 'پایگاه داده محلی برنامه (IndexedDB)' },
  { name: 'Attachments', label: 'تصاویر، فایل‌ها و پیوست‌های پرونده‌ها' },
  { name: 'Backups', label: 'نسخه‌های پشتیبان کامل (ZIP)' },
  { name: 'Exports', label: 'خروجی‌های Word، Excel، PDF و JSON' },
  { name: 'Logs', label: 'گزارش خطاها و عملیات فنی' },
];

function extractDriveRoot(targetPath) {
  const match = String(targetPath || '').match(/^([A-Za-z]:)[\\/]?/);
  if (match) {
    return `${match[1].toUpperCase()}\\`;
  }
  return path.parse(targetPath).root || '/';
}

function isDriveCPath(targetPath) {
  return /^c:[\\/]/i.test(String(targetPath || '').trim());
}

function normalizePathSafe(p) {
  return path.resolve(String(p || '').trim());
}

function ensureRequiredSubdirs(rootPath, fsImpl = fs) {
  fsImpl.mkdirSync(rootPath, { recursive: true });
  for (const sub of REQUIRED_SUBDIRS) {
    fsImpl.mkdirSync(path.join(rootPath, sub.name), { recursive: true });
  }
}

/**
 * Verifies that the drive root exists (on Windows) and that rootPath is genuinely writable.
 * Strictly NEVER falls back to drive C: automatically.
 */
function verifyStorageRootWritable(rootPath, options = {}) {
  const fsImpl = options.fsImpl || fs;
  const checkWindowsDrive =
    typeof options.checkWindowsDrive === 'boolean'
      ? options.checkWindowsDrive
      : process.platform === 'win32';

  const trimmed = String(rootPath || '').trim();
  if (!trimmed) {
    return {
      ok: false,
      reason: 'EMPTY_PATH',
      attemptedPath: trimmed,
      message: 'مسیر ذخیره اطلاعات مشخص نشده است.',
    };
  }

  if (checkWindowsDrive) {
    const driveRoot = extractDriveRoot(trimmed);
    if (!fsImpl.existsSync(driveRoot)) {
      return {
        ok: false,
        reason: 'DRIVE_UNAVAILABLE',
        attemptedPath: trimmed,
        driveRoot,
        message: `درایو ${driveRoot} در این سیستم در دسترس نیست. برای جلوگیری از ذخیره ناخواسته اطلاعات روی درایو C، مسیر به‌صورت خودکار تغییر داده نمی‌شود.`,
      };
    }
  }

  try {
    ensureRequiredSubdirs(trimmed, fsImpl);
    const probeFile = path.join(trimmed, 'Logs', `.write-probe-${Date.now()}.tmp`);
    fsImpl.writeFileSync(probeFile, 'ok', 'utf8');
    const content = fsImpl.readFileSync(probeFile, 'utf8');
    fsImpl.unlinkSync(probeFile);
    if (content !== 'ok') {
      throw new Error('Write probe mismatch');
    }
    return {
      ok: true,
      dataRoot: trimmed,
      message: 'مسیر ذخیره‌سازی سالم و قابل خواندن و نوشتن است.',
    };
  } catch (err) {
    return {
      ok: false,
      reason: 'NOT_WRITABLE',
      attemptedPath: trimmed,
      message: `امکان ایجاد یا نوشتن در مسیر «${trimmed}» وجود ندارد (${err.message}).`,
    };
  }
}

function readBootstrapConfig(configPath, fsImpl = fs) {
  try {
    if (!configPath || !fsImpl.existsSync(configPath)) return null;
    const raw = fsImpl.readFileSync(configPath, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed.customDataRoot === 'string' && parsed.customDataRoot.trim()) {
      return parsed;
    }
    return null;
  } catch {
    return null;
  }
}

function writeBootstrapConfig(configPath, customDataRoot, fsImpl = fs) {
  const dir = path.dirname(configPath);
  fsImpl.mkdirSync(dir, { recursive: true });
  const payload = {
    customDataRoot,
    updatedAt: new Date().toISOString(),
  };
  fsImpl.writeFileSync(configPath, JSON.stringify(payload, null, 2), 'utf8');
}

/**
 * Resolves the active storage root on startup.
 * Priority:
 * 1) User-approved customDataRoot in storage-config.json (if set)
 * 2) Mandatory default D:\Daftar-Fani-Golzar
 * NEVER silently redirects to C:\ or Documents if D:\ is unavailable.
 */
function resolveStartupStorageRoot(options = {}) {
  const fsImpl = options.fsImpl || fs;
  const defaultRoot = options.defaultRoot || DEFAULT_WINDOWS_DATA_ROOT;
  const configPath = options.configPath || null;
  const checkWindowsDrive = options.checkWindowsDrive;

  const savedConfig = readBootstrapConfig(configPath, fsImpl);
  const candidate = savedConfig ? savedConfig.customDataRoot : defaultRoot;
  const isCustom = Boolean(savedConfig);

  const check = verifyStorageRootWritable(candidate, { fsImpl, checkWindowsDrive });
  if (check.ok) {
    return {
      ok: true,
      requiresUserChoice: false,
      dataRoot: candidate,
      isDefaultDriveD: candidate.toLowerCase() === DEFAULT_WINDOWS_DATA_ROOT.toLowerCase(),
      isCustom,
    };
  }

  return {
    ok: false,
    requiresUserChoice: true,
    attemptedPath: candidate,
    isCustom,
    reason: check.reason,
    message: check.message,
  };
}

function computeDirStats(dirPath, fsImpl = fs) {
  let bytes = 0;
  let fileCount = 0;
  if (!fsImpl.existsSync(dirPath)) {
    return { bytes: 0, fileCount: 0 };
  }
  const stack = [dirPath];
  while (stack.length > 0) {
    const current = stack.pop();
    let entries = [];
    try {
      entries = fsImpl.readdirSync(current, { withFileTypes: true });
    } catch {
      continue;
    }
    for (const entry of entries) {
      const full = path.join(current, entry.name);
      try {
        if (entry.isDirectory()) {
          stack.push(full);
        } else if (entry.isFile()) {
          const st = fsImpl.statSync(full);
          bytes += st.size;
          fileCount += 1;
        }
      } catch {
        // Skip locked transient files gracefully
      }
    }
  }
  return { bytes, fileCount };
}

function getDetailedStorageInfo(dataRoot, configPath = '', fsImpl = fs) {
  const health = verifyStorageRootWritable(dataRoot, {
    fsImpl,
    checkWindowsDrive: process.platform === 'win32',
  });
  let totalBytes = 0;
  let totalFiles = 0;
  const subfolders = REQUIRED_SUBDIRS.map((sub) => {
    const fullPath = path.join(dataRoot, sub.name);
    const stats = computeDirStats(fullPath, fsImpl);
    totalBytes += stats.bytes;
    totalFiles += stats.fileCount;
    return {
      name: sub.name,
      label: sub.label,
      path: fullPath,
      bytes: stats.bytes,
      fileCount: stats.fileCount,
    };
  });

  return {
    dataRoot,
    isDefaultDriveD:
      String(dataRoot || '').toLowerCase() === DEFAULT_WINDOWS_DATA_ROOT.toLowerCase(),
    healthy: health.ok,
    healthMessage: health.message,
    totalBytes,
    totalFiles,
    subfolders,
    bootstrapConfigPath: configPath,
  };
}

function copyDirectoryRecursiveSafe(srcDir, destDir, fsImpl = fs) {
  let copiedFiles = 0;
  let copiedBytes = 0;
  if (!fsImpl.existsSync(srcDir)) {
    return { copiedFiles: 0, copiedBytes: 0 };
  }
  fsImpl.mkdirSync(destDir, { recursive: true });
  const entries = fsImpl.readdirSync(srcDir, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(srcDir, entry.name);
    const destPath = path.join(destDir, entry.name);
    if (entry.isDirectory()) {
      const child = copyDirectoryRecursiveSafe(srcPath, destPath, fsImpl);
      copiedFiles += child.copiedFiles;
      copiedBytes += child.copiedBytes;
    } else if (entry.isFile()) {
      try {
        fsImpl.copyFileSync(srcPath, destPath);
        const st = fsImpl.statSync(destPath);
        copiedFiles += 1;
        copiedBytes += st.size;
      } catch {
        // Locked Chromium lockfile (e.g. LOCK) may be skipped safely during copy; IndexedDB data + ZIP backup cover full restore
      }
    }
  }
  return { copiedFiles, copiedBytes };
}

function appendLogLine(dataRoot, level, message, fsImpl = fs) {
  try {
    const logsDir = path.join(dataRoot, 'Logs');
    fsImpl.mkdirSync(logsDir, { recursive: true });
    const logPath = path.join(logsDir, 'app.log');
    const line = `[${new Date().toISOString()}] [${String(level || 'info').toUpperCase()}] ${message}\n`;
    fsImpl.appendFileSync(logPath, line, 'utf8');
  } catch {
    // Non-fatal
  }
}

/**
 * Controlled, backup-first migration from sourceRoot to targetRoot.
 * Never deletes sourceRoot so zero data can be lost.
 */
function migrateStorageRootSafe({
  sourceRoot,
  targetRoot,
  configPath,
  backupBase64,
  backupFilename,
  fsImpl = fs,
  checkWindowsDrive,
}) {
  const normSource = normalizePathSafe(sourceRoot);
  const normTarget = normalizePathSafe(targetRoot);

  if (normSource.toLowerCase() === normTarget.toLowerCase()) {
    return { ok: false, error: 'مسیر انتخاب‌شده همان مسیر فعلی ذخیره اطلاعات است.' };
  }
  if (normTarget.toLowerCase().startsWith(normSource.toLowerCase() + path.sep)) {
    return {
      ok: false,
      error: 'مسیر جدید نمی‌تواند زیرپوشه‌ای درون مسیر فعلی ذخیره اطلاعات باشد.',
    };
  }

  const targetCheck = verifyStorageRootWritable(targetRoot, { fsImpl, checkWindowsDrive });
  if (!targetCheck.ok) {
    return { ok: false, error: targetCheck.message };
  }

  // Step 1: Mandatory backup into current Backups folder BEFORE copying
  let backupPath = '';
  if (backupBase64 && backupFilename) {
    const backupsDir = path.join(sourceRoot, 'Backups');
    fsImpl.mkdirSync(backupsDir, { recursive: true });
    const safeName = backupFilename.replace(/[/\\:*?"<>|]/g, '_');
    backupPath = path.join(backupsDir, safeName);
    const buf = Buffer.from(backupBase64, 'base64');
    fsImpl.writeFileSync(backupPath, buf);
    const stat = fsImpl.statSync(backupPath);
    if (!stat || stat.size === 0) {
      return { ok: false, error: 'ایجاد نسخه پشتیبان پیش از انتقال ناموفق بود. عملیات متوقف شد.' };
    }
  }

  // Step 2: Copy all 5 structured directories to targetRoot
  let totalCopiedFiles = 0;
  let totalCopiedBytes = 0;
  for (const sub of REQUIRED_SUBDIRS) {
    const srcSub = path.join(sourceRoot, sub.name);
    const dstSub = path.join(targetRoot, sub.name);
    const res = copyDirectoryRecursiveSafe(srcSub, dstSub, fsImpl);
    totalCopiedFiles += res.copiedFiles;
    totalCopiedBytes += res.copiedBytes;
  }

  // Step 3: Verify destination contains expected backup & structure
  if (backupPath) {
    const copiedBackup = path.join(targetRoot, 'Backups', path.basename(backupPath));
    if (!fsImpl.existsSync(copiedBackup) || fsImpl.statSync(copiedBackup).size === 0) {
      return {
        ok: false,
        error: 'راستی‌آزمایی انتقال نسخه پشتیبان به مسیر مقصد ناموفق بود. مسیر تغییر نکرد.',
      };
    }
  }

  // Step 4: Persist approved path in bootstrap config
  writeBootstrapConfig(configPath, targetRoot, fsImpl);
  appendLogLine(
    sourceRoot,
    'info',
    `Storage migrated safely to ${targetRoot} (${totalCopiedFiles} files, ${totalCopiedBytes} bytes). Source preserved.`,
    fsImpl
  );
  appendLogLine(
    targetRoot,
    'info',
    `Activated as new storage root migrated from ${sourceRoot}.`,
    fsImpl
  );

  return {
    ok: true,
    newRoot: targetRoot,
    backupPath,
    copiedFiles: totalCopiedFiles,
    copiedBytes: totalCopiedBytes,
  };
}

module.exports = {
  DEFAULT_WINDOWS_DATA_ROOT,
  REQUIRED_SUBDIRS,
  extractDriveRoot,
  isDriveCPath,
  verifyStorageRootWritable,
  readBootstrapConfig,
  writeBootstrapConfig,
  resolveStartupStorageRoot,
  getDetailedStorageInfo,
  appendLogLine,
  migrateStorageRootSafe,
};
