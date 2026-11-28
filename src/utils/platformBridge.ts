import { getDB } from '../db/database';

export type RuntimePlatform = 'electron' | 'android' | 'web';

export interface DesktopSubfolderUsage {
  name: 'Database' | 'Attachments' | 'Backups' | 'Exports' | 'Logs';
  label: string;
  path: string;
  bytes: number;
  fileCount: number;
}

export interface DesktopStorageInfo {
  dataRoot: string;
  isDefaultDriveD: boolean;
  healthy: boolean;
  healthMessage: string;
  totalBytes: number;
  totalFiles: number;
  subfolders: DesktopSubfolderUsage[];
  bootstrapConfigPath?: string;
}

export interface DesktopSaveFileResult {
  ok: boolean;
  savedPath?: string;
  error?: string;
}

export interface DesktopRelocateResult {
  ok: boolean;
  cancelled?: boolean;
  newRoot?: string;
  backupPath?: string;
  copiedFiles?: number;
  copiedBytes?: number;
  error?: string;
}

export interface DesktopFetchJsonResult {
  ok: boolean;
  status: number;
  statusText?: string;
  bodyText?: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface DesktopBridgeAPI {
  isDesktop: true;
  platform: string;
  appVersion?: string;
  getStorageInfo: () => Promise<DesktopStorageInfo>;
  openStorageFolder: (subfolder?: string) => Promise<{ ok: boolean; error?: string }>;
  saveFile: (payload: {
    filename: string;
    category: 'exports' | 'backups' | 'attachments';
    base64Data: string;
    mimeType?: string;
  }) => Promise<DesktopSaveFileResult>;
  relocateStorage: (payload: {
    backupBase64: string;
    backupFilename: string;
  }) => Promise<DesktopRelocateResult>;
  relaunchApp: () => Promise<void>;
  appendLog: (level: 'info' | 'warn' | 'error', message: string) => Promise<void>;
  fetchJson?: (url: string) => Promise<DesktopFetchJsonResult>;
  downloadAndRunInstaller?: (payload: {
    downloadUrl: string;
    fileName: string;
  }) => Promise<{ ok: boolean; savedPath?: string; error?: string }>;
}

interface CapacitorPluginLike {
  writeFile?: (opts: {
    path: string;
    data: string;
    directory?: string;
    recursive?: boolean;
  }) => Promise<{ uri: string }>;
  getUri?: (opts: { path: string; directory?: string }) => Promise<{ uri: string }>;
  share?: (opts: {
    title?: string;
    text?: string;
    url?: string;
    dialogTitle?: string;
  }) => Promise<unknown>;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: {
    Filesystem?: CapacitorPluginLike;
    Share?: CapacitorPluginLike;
  };
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridgeAPI;
    Capacitor?: CapacitorGlobal;
  }
}

export interface StorageOverview {
  platform: RuntimePlatform;
  platformLabel: string;
  pathDisplay: string;
  isDefaultDriveD?: boolean;
  healthy: boolean;
  healthMessage: string;
  usedBytes: number | null;
  quotaBytes: number | null;
  subfolders?: DesktopSubfolderUsage[];
  canOpenFolder: boolean;
  canRelocate: boolean;
}

export function detectRuntimePlatform(): RuntimePlatform {
  if (typeof window === 'undefined') return 'web';
  if (window.desktopBridge?.isDesktop) return 'electron';
  if (window.Capacitor?.isNativePlatform?.()) return 'android';
  return 'web';
}

export function getPlatformDisplayLabel(platform: RuntimePlatform = detectRuntimePlatform()): string {
  switch (platform) {
    case 'electron':
      return 'نسخه نصب‌شده ویندوز (مستقل و آفلاین)';
    case 'android':
      return 'اپلیکیشن مستقل اندروید';
    default:
      return 'نسخه وب در مرورگر';
  }
}

export function isNativeInstalledRuntime(): boolean {
  const p = detectRuntimePlatform();
  return p === 'electron' || p === 'android';
}

export function blobToBase64Raw(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = String(reader.result || '');
      const commaIdx = result.indexOf(',');
      resolve(commaIdx >= 0 ? result.slice(commaIdx + 1) : result);
    };
    reader.onerror = () => reject(reader.error || new Error('خطا در تبدیل فایل'));
    reader.readAsDataURL(blob);
  });
}

function triggerBrowserDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 400);
}

export interface SaveFileOutcome {
  ok: boolean;
  method: 'electron-disk' | 'android-native' | 'browser-download';
  savedPath?: string;
  filename: string;
}

/**
 * Unified cross-platform file saver:
 * - Windows Electron: saves directly into D:\Daftar-Fani-Golzar\{Exports|Backups|Attachments}\
 * - Android Capacitor: writes via native Filesystem plugin and opens Android Share Sheet
 * - Web / Chrome: standard browser download
 */
export async function saveBinaryFile(
  blob: Blob,
  filename: string,
  category: 'exports' | 'backups' | 'attachments' = 'exports',
  mimeType?: string
): Promise<SaveFileOutcome> {
  const platform = detectRuntimePlatform();

  if (platform === 'electron' && window.desktopBridge) {
    try {
      const base64Data = await blobToBase64Raw(blob);
      const res = await window.desktopBridge.saveFile({
        filename,
        category,
        base64Data,
        mimeType: mimeType || blob.type || 'application/octet-stream',
      });
      if (res.ok) {
        return {
          ok: true,
          method: 'electron-disk',
          savedPath: res.savedPath,
          filename,
        };
      }
    } catch {
      // Fall back to standard download if IPC fails unexpectedly
    }
  }

  if (platform === 'android' && window.Capacitor?.Plugins?.Filesystem) {
    try {
      const base64Data = await blobToBase64Raw(blob);
      const fsPlugin = window.Capacitor.Plugins.Filesystem;
      const sharePlugin = window.Capacitor.Plugins.Share;
      const safeName = filename.replace(/[/\\:*?"<>|]/g, '_');
      const targetPath = `DaftarFani/${category}/${safeName}`;

      if (fsPlugin.writeFile) {
        const writeRes = await fsPlugin.writeFile({
          path: targetPath,
          data: base64Data,
          directory: 'CACHE',
          recursive: true,
        });

        if (sharePlugin?.share && writeRes?.uri) {
          await sharePlugin.share({
            title: filename,
            text: `فایل خروجی دفتر فنی اداره گلزار شهدا: ${filename}`,
            url: writeRes.uri,
            dialogTitle: 'ذخیره یا اشتراک‌گذاری فایل',
          });
        }

        return {
          ok: true,
          method: 'android-native',
          savedPath: writeRes?.uri || targetPath,
          filename,
        };
      }
    } catch {
      // Fall through to WebView download fallback
    }
  }

  triggerBrowserDownload(blob, filename);
  return {
    ok: true,
    method: 'browser-download',
    filename,
  };
}

/**
 * Mirrors newly added attachment blobs to D:\Daftar-Fani-Golzar\Attachments\ in Windows Desktop mode
 * so users can directly inspect physical attachment files alongside IndexedDB storage.
 */
export async function syncAttachmentToDesktopDisk(
  attachmentId: string,
  fileName: string,
  blob: Blob
): Promise<string | undefined> {
  if (detectRuntimePlatform() !== 'electron' || !window.desktopBridge) {
    return undefined;
  }
  try {
    const safeName = `${attachmentId}_${fileName.replace(/[/\\:*?"<>|]/g, '_')}`;
    const base64Data = await blobToBase64Raw(blob);
    const res = await window.desktopBridge.saveFile({
      filename: safeName,
      category: 'attachments',
      base64Data,
      mimeType: blob.type || 'application/octet-stream',
    });
    return res.ok ? res.savedPath : undefined;
  } catch {
    return undefined;
  }
}

export async function logDesktopEvent(
  level: 'info' | 'warn' | 'error',
  message: string
): Promise<void> {
  if (detectRuntimePlatform() === 'electron' && window.desktopBridge) {
    try {
      await window.desktopBridge.appendLog(level, message);
    } catch {
      // Ignore logging errors
    }
  }
}

export async function getStorageOverview(): Promise<StorageOverview> {
  const platform = detectRuntimePlatform();
  const platformLabel = getPlatformDisplayLabel(platform);

  if (platform === 'electron' && window.desktopBridge) {
    const info = await window.desktopBridge.getStorageInfo();
    return {
      platform,
      platformLabel,
      pathDisplay: info.dataRoot,
      isDefaultDriveD: info.isDefaultDriveD,
      healthy: info.healthy,
      healthMessage: info.healthMessage,
      usedBytes: info.totalBytes,
      quotaBytes: null,
      subfolders: info.subfolders,
      canOpenFolder: true,
      canRelocate: true,
    };
  }

  // Verify IndexedDB health on Web / Android
  let healthy = true;
  let healthMessage = 'پایگاه داده محلی (IndexedDB) سالم و آماده خواندن و نوشتن است.';
  try {
    const db = await getDB();
    await db.get('settings', 'app-settings');
  } catch (err) {
    healthy = false;
    healthMessage =
      err instanceof Error ? err.message : 'خطا در اتصال به پایگاه داده محلی دستگاه';
  }

  let usedBytes: number | null = null;
  let quotaBytes: number | null = null;
  if (typeof navigator !== 'undefined' && navigator.storage?.estimate) {
    try {
      const est = await navigator.storage.estimate();
      usedBytes = typeof est.usage === 'number' ? est.usage : null;
      quotaBytes = typeof est.quota === 'number' ? est.quota : null;
    } catch {
      // Optional API
    }
  }

  if (platform === 'android') {
    return {
      platform,
      platformLabel,
      pathDisplay: 'حافظه داخلی اختصاصی اپلیکیشن اندروید (ir.golzar.daftarfani)',
      healthy,
      healthMessage,
      usedBytes,
      quotaBytes,
      canOpenFolder: false,
      canRelocate: false,
    };
  }

  return {
    platform: 'web',
    platformLabel,
    pathDisplay: 'حافظه محلی مرورگر (IndexedDB — فضای ایزوله همین مرورگر، بدون مسیر پوشه مستقیم روی ویندوز)',
    healthy,
    healthMessage,
    usedBytes,
    quotaBytes,
    canOpenFolder: false,
    canRelocate: false,
  };
}
