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
  cancelled?: boolean;
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
    interactive?: boolean;
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
  verifyDownloadUrl?: (url: string) => Promise<{
    ok: boolean;
    status: number;
    contentType?: string;
    contentLength?: number;
    error?: string;
  }>;
  openFile?: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  showInFolder?: (filePath: string) => Promise<{ ok: boolean; error?: string }>;
  openExternal?: (url: string) => Promise<{ ok: boolean; error?: string }>;
  getLocalVersionInfo?: () => Promise<{
    ok: boolean;
    version: string | null;
    buildId: string | null;
    builtAt: string | null;
    activeDistDir: string;
    isOtaBundle: boolean;
    bundledVersion: string | null;
  }>;
  applyBundleUpdate?: (payload: { baseUrl?: string }) => Promise<{
    ok: boolean;
    version?: string;
    buildId?: string;
    filesCount?: number;
    activeDistDir?: string;
    error?: string;
    detail?: string;
  }>;
}

interface CapacitorPluginLike {
  [method: string]: ((opts: Record<string, unknown>) => Promise<unknown>) | undefined;
}

interface CapacitorGlobal {
  isNativePlatform?: () => boolean;
  getPlatform?: () => string;
  Plugins?: Record<string, CapacitorPluginLike | undefined>;
  registerPlugin?: (pluginName: string) => CapacitorPluginLike;
  nativePromise?: (
    pluginName: string,
    methodName: string,
    options?: Record<string, unknown>
  ) => Promise<unknown>;
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

export async function blobToBase64Raw(blob: Blob): Promise<string> {
  if (typeof FileReader === 'undefined') {
    const buf = new Uint8Array(await blob.arrayBuffer());
    let binary = '';
    const chunkSize = 0x8000;
    for (let i = 0; i < buf.length; i += chunkSize) {
      binary += String.fromCharCode(...buf.subarray(i, i + chunkSize));
    }
    return btoa(binary);
  }
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

export async function invokeCapacitorPlugin<T = Record<string, unknown>>(
  pluginName: 'Filesystem' | 'Share' | 'Browser' | 'WebView',
  methodName: string,
  options: Record<string, unknown> = {}
): Promise<T | null> {
  if (typeof window === 'undefined' || !window.Capacitor) return null;
  const cap = window.Capacitor;

  // 1. Direct plugin proxy on Capacitor.Plugins (when pre-registered)
  const directPlugin = cap.Plugins?.[pluginName];
  if (directPlugin && typeof directPlugin[methodName] === 'function') {
    return (await directPlugin[methodName]!(options)) as T;
  }

  // 2. Capacitor 5/6/7 runtime nativePromise bridge (works even without importing JS plugin wrapper)
  if (typeof cap.nativePromise === 'function') {
    return (await cap.nativePromise(pluginName, methodName, options)) as T;
  }

  // 3. Lazy registerPlugin fallback
  if (typeof cap.registerPlugin === 'function') {
    const proxy = cap.registerPlugin(pluginName);
    if (proxy && typeof proxy[methodName] === 'function') {
      return (await proxy[methodName]!(options)) as T;
    }
  }

  return null;
}

export function dataUrlToBlob(dataUrl: string, fallbackMime = 'application/octet-stream'): Blob {
  const parts = dataUrl.split(',');
  const header = parts[0] || '';
  const body = parts[1] || '';
  const mimeMatch = header.match(/data:([^;]+);base64/i);
  const mime = mimeMatch ? mimeMatch[1] : fallbackMime;
  const binary = atob(body);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new Blob([bytes], { type: mime });
}

export async function openExternalDownloadUrl(url: string, fileName?: string): Promise<void> {
  const platform = detectRuntimePlatform();

  if (platform === 'electron' && window.desktopBridge?.openExternal) {
    await window.desktopBridge.openExternal(url);
    return;
  }

  if (platform === 'android') {
    try {
      const opened = await invokeCapacitorPlugin('Browser', 'open', { url });
      if (opened !== null) return;
    } catch {
      // Fall through to system location navigation so Android handles APK/external URL
    }
    window.location.assign(url);
    return;
  }

  const anchor = document.createElement('a');
  anchor.href = url;
  if (fileName) anchor.download = fileName;
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}

export async function openSavedDesktopFile(savedPath: string): Promise<boolean> {
  if (detectRuntimePlatform() === 'electron' && window.desktopBridge?.openFile) {
    const res = await window.desktopBridge.openFile(savedPath);
    return Boolean(res?.ok);
  }
  return false;
}

export async function revealSavedDesktopFile(savedPath: string): Promise<boolean> {
  if (detectRuntimePlatform() === 'electron' && window.desktopBridge?.showInFolder) {
    const res = await window.desktopBridge.showInFolder(savedPath);
    return Boolean(res?.ok);
  }
  return false;
}

export interface SaveFileOutcome {
  ok: boolean;
  cancelled?: boolean;
  error?: string;
  method: 'electron-disk' | 'android-native' | 'browser-download';
  savedPath?: string;
  filename: string;
}

/**
 * Unified cross-platform file saver:
 * - Windows Electron: opens native Save As dialog (defaulting to D:\Daftar-Fani-Golzar\Exports\),
 *   writes archive copy, and reveals the saved file in Windows Explorer.
 * - Android Capacitor: writes via native Capacitor Filesystem bridge (Documents + Cache) and
 *   opens the native Android Share / Open-With sheet so files are genuinely delivered on phones.
 * - Web / Chrome: standard browser download.
 */
export async function saveBinaryFile(
  blob: Blob,
  filename: string,
  category: 'exports' | 'backups' | 'attachments' = 'exports',
  mimeType?: string,
  options?: { interactive?: boolean }
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
        interactive: options?.interactive ?? true,
      });
      if (res.cancelled) {
        return {
          ok: false,
          cancelled: true,
          method: 'electron-disk',
          filename,
        };
      }
      if (res.ok) {
        return {
          ok: true,
          method: 'electron-disk',
          savedPath: res.savedPath,
          filename,
        };
      }
      return {
        ok: false,
        method: 'electron-disk',
        filename,
        error: res.error || 'ذخیره فایل روی سیستم ویندوز با خطا مواجه شد.',
      };
    } catch (err) {
      return {
        ok: false,
        method: 'electron-disk',
        filename,
        error: err instanceof Error ? err.message : 'خطای ارتباط با سیستم فایل ویندوز',
      };
    }
  }

  if (platform === 'android' && window.Capacitor) {
    try {
      const base64Data = await blobToBase64Raw(blob);
      const safeName = filename.replace(/[/\\:*?"<>|]/g, '_');

      // 1. Write a persistent user-accessible copy to Documents/DaftarFaniGolzar/
      let docsSavedPath: string | undefined;
      try {
        const docsRes = await invokeCapacitorPlugin<{ uri?: string }>('Filesystem', 'writeFile', {
          path: `DaftarFaniGolzar/${safeName}`,
          data: base64Data,
          directory: 'DOCUMENTS',
          recursive: true,
        });
        if (docsRes?.uri) {
          docsSavedPath = `Documents/DaftarFaniGolzar/${safeName}`;
        }
      } catch {
        // On some Android versions Documents may require cache+share; proceed with Cache + Share below
      }

      // 2. Write a FileProvider-shareable copy to CACHE and trigger Android Share / Open-With sheet
      let shareUri: string | undefined;
      try {
        const cachePath = `DaftarFaniShare/${safeName}`;
        const cacheRes = await invokeCapacitorPlugin<{ uri?: string }>('Filesystem', 'writeFile', {
          path: cachePath,
          data: base64Data,
          directory: 'CACHE',
          recursive: true,
        });
        shareUri = cacheRes?.uri;
        if (!shareUri) {
          const uriRes = await invokeCapacitorPlugin<{ uri?: string }>('Filesystem', 'getUri', {
            path: cachePath,
            directory: 'CACHE',
          });
          shareUri = uriRes?.uri;
        }
      } catch {
        // Ignore if cache write failed while Documents write succeeded
      }

      if (shareUri) {
        try {
          await invokeCapacitorPlugin('Share', 'share', {
            title: filename,
            text: `فایل خروجی دفتر فنی اداره گلزار شهدا: ${filename}`,
            files: [shareUri],
            url: shareUri,
            dialogTitle: 'ذخیره، باز کردن یا اشتراک‌گذاری فایل',
          });
        } catch {
          // User may have closed share sheet after file was already written
        }
      }

      if (docsSavedPath || shareUri) {
        return {
          ok: true,
          method: 'android-native',
          savedPath: docsSavedPath || `حافظه برنامه (${safeName})`,
          filename,
        };
      }

      return {
        ok: false,
        method: 'android-native',
        filename,
        error:
          'پلاگین بومی ذخیره‌سازی فایل در این نسخه اندروید فعال نشد. لطفاً نسخه جدید APK را نصب کنید.',
      };
    } catch (err) {
      return {
        ok: false,
        method: 'android-native',
        filename,
        error: err instanceof Error ? err.message : 'خطا در ذخیره فایل روی گوشی اندروید',
      };
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
