import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';

export type AppUpdateStatus =
  | 'idle'
  | 'checking'
  | 'up-to-date'
  | 'update-available'
  | 'updating'
  | 'offline'
  | 'error';

export interface AppUpdateState {
  currentVersion: string;
  currentBuildId: string;
  remoteVersion: string | null;
  remoteBuildId: string | null;
  needRefresh: boolean;
  offlineReady: boolean;
  swRegistered: boolean;
  status: AppUpdateStatus;
  statusMessage: string;
  lastCheckedAt: string | null;
}

const LAST_CHECK_KEY = 'daftar-fani-last-update-check';

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.0';
export const LOCAL_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-local';

let swRegistration: ServiceWorkerRegistration | null = null;
let triggerSwReload: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;

let currentState: AppUpdateState = {
  currentVersion: LOCAL_APP_VERSION,
  currentBuildId: LOCAL_BUILD_ID,
  remoteVersion: null,
  remoteBuildId: null,
  needRefresh: false,
  offlineReady: false,
  swRegistered: false,
  status: 'idle',
  statusMessage: '',
  lastCheckedAt:
    typeof window !== 'undefined' ? window.localStorage.getItem(LAST_CHECK_KEY) : null,
};

const listeners = new Set<() => void>();

function emit(patch: Partial<AppUpdateState>) {
  currentState = { ...currentState, ...patch };
  listeners.forEach((fn) => fn());
}

export function initAppUpdater(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (!('serviceWorker' in navigator)) return;

  try {
    triggerSwReload = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        swRegistration = registration ?? null;
        emit({ swRegistered: Boolean(registration) });
      },
      onOfflineReady() {
        emit({ offlineReady: true });
      },
      onNeedRefresh() {
        emit({
          needRefresh: true,
          status: 'update-available',
          statusMessage:
            'نسخه جدید نرم‌افزار دریافت شد و آماده اعمال است. برای فعال‌سازی دکمه «اعمال به‌روزرسانی» را بزنید.',
        });
      },
      onRegisterError() {
        emit({ swRegistered: false });
      },
    });
  } catch {
    emit({ swRegistered: false });
  }
}

interface RemoteVersionManifest {
  version?: string;
  buildId?: string;
  builtAt?: string;
}

export async function checkForAppUpdate(): Promise<AppUpdateState> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emit({
      status: 'offline',
      statusMessage:
        'دستگاه در حالت آفلاین است. برای بررسی و دریافت تغییرات جدید از گیت‌هاب، یک‌بار به اینترنت متصل شوید و مجدداً تلاش کنید.',
    });
    return currentState;
  }

  emit({
    status: 'checking',
    statusMessage: 'در حال اتصال به سرور / گیت‌هاب و بررسی نسخه جدید...',
  });

  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_CHECK_KEY, nowIso);
  }

  let foundUpdate = false;
  let remoteVersion: string | null = null;
  let remoteBuildId: string | null = null;

  try {
    // 1. Trigger browser Service Worker check against GitHub Pages / hosting server
    if ('serviceWorker' in navigator) {
      const reg = swRegistration ?? (await navigator.serviceWorker.getRegistration());
      if (reg) {
        swRegistration = reg;
        await reg.update();
        if (reg.waiting || reg.installing) {
          foundUpdate = true;
        }
      }
    }

    // 2. Fetch fresh non-cached version.json from the live deployment URL (e.g. GitHub Pages)
    const manifestUrl = new URL(`./version.json?t=${Date.now()}`, window.location.href).toString();
    const res = await fetch(manifestUrl, {
      cache: 'no-store',
      headers: { 'Cache-Control': 'no-cache, no-store, must-revalidate' },
    });

    if (res.ok) {
      const contentType = res.headers.get('content-type') || '';
      if (contentType.includes('application/json') || contentType.includes('text/plain')) {
        const data = (await res.json()) as RemoteVersionManifest;
        remoteVersion = data.version || null;
        remoteBuildId = data.buildId || null;

        if (
          remoteBuildId &&
          remoteBuildId !== 'dev-local' &&
          LOCAL_BUILD_ID !== 'dev-local' &&
          remoteBuildId !== LOCAL_BUILD_ID
        ) {
          foundUpdate = true;
        } else if (remoteVersion && remoteVersion !== LOCAL_APP_VERSION) {
          foundUpdate = true;
        }
      }
    }

    if (foundUpdate || currentState.needRefresh) {
      emit({
        needRefresh: true,
        remoteVersion,
        remoteBuildId,
        lastCheckedAt: nowIso,
        status: 'update-available',
        statusMessage: remoteVersion
          ? `به‌روزرسانی جدید (نسخه ${remoteVersion}) شناسایی شد. اطلاعات محلی شما کاملاً حفظ می‌شود؛ برای اعمال کلیک کنید.`
          : 'نسخه جدید نرم‌افزار در سرور شناسایی شد و آماده اعمال است.',
      });
    } else {
      emit({
        needRefresh: false,
        remoteVersion: remoteVersion ?? LOCAL_APP_VERSION,
        remoteBuildId,
        lastCheckedAt: nowIso,
        status: 'up-to-date',
        statusMessage:
          'بررسی با موفقیت انجام شد. نرم‌افزار هم‌اکنون روی آخرین نسخه منتشرشده قرار دارد.',
      });
    }
  } catch {
    emit({
      lastCheckedAt: nowIso,
      status: 'error',
      statusMessage:
        'برقراری ارتباط با سرور گیت‌هاب انجام نشد. لطفاً وضعیت اینترنت را بررسی کرده و دوباره امتحان کنید.',
    });
  }

  return currentState;
}

/**
 * Applies a pending Service Worker update or performs a safe shell cache clear + reload.
 * IMPORTANT: Never touches IndexedDB (`daftar-fani-golzar-db`) or user records.
 */
export async function applyAppUpdate(forceHardRefresh = false): Promise<void> {
  if (typeof window === 'undefined') return;

  if (typeof navigator !== 'undefined' && !navigator.onLine && forceHardRefresh) {
    emit({
      status: 'offline',
      statusMessage:
        'برای دریافت اجباری فایل‌های جدید از سرور باید به اینترنت متصل باشید.',
    });
    return;
  }

  emit({
    status: 'updating',
    statusMessage: 'در حال اعمال نسخه جدید نرم‌افزار (بدون تغییر در اطلاعات محلی شما)...',
  });

  try {
    if (!forceHardRefresh && triggerSwReload && swRegistration?.waiting) {
      await triggerSwReload(true);
      return;
    }

    // Clear ONLY static asset CacheStorage entries — NEVER touch IndexedDB!
    if ('caches' in window) {
      const cacheNames = await window.caches.keys();
      await Promise.all(cacheNames.map((name) => window.caches.delete(name)));
    }

    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }

    // Reload cleanly with cache-busting query removed after load
    const nextUrl = new URL(window.location.href);
    nextUrl.searchParams.set('updated', String(Date.now()));
    window.location.replace(nextUrl.toString());
  } catch {
    window.location.reload();
  }
}

export function useAppUpdater() {
  const [state, setState] = useState<AppUpdateState>(currentState);

  useEffect(() => {
    const onChange = () => setState(currentState);
    listeners.add(onChange);
    // Clean up ?updated= query param after a completed hard refresh
    if (typeof window !== 'undefined' && window.location.search.includes('updated=')) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('updated');
      window.history.replaceState({}, '', cleanUrl.toString());
    }
    return () => {
      listeners.delete(onChange);
    };
  }, []);

  return {
    ...state,
    checkForUpdate: checkForAppUpdate,
    applyUpdate: applyAppUpdate,
  };
}
