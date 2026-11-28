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
  remoteBuiltAt: string | null;
  remoteNotes: string[];
  versionSourceUrl: string;
  needRefresh: boolean;
  offlineReady: boolean;
  swRegistered: boolean;
  status: AppUpdateStatus;
  statusMessage: string;
  lastCheckedAt: string | null;
}

const LAST_CHECK_KEY = 'daftar-fani-last-update-check';
const CUSTOM_VERSION_URL_KEY = 'daftar-fani-github-version-url';

export const OFFICIAL_GITHUB_APP_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/';
export const OFFICIAL_GITHUB_VERSION_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/version.json';

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.3.3';
export const LOCAL_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-local';

let swRegistration: ServiceWorkerRegistration | null = null;
let triggerSwReload: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;

function loadSavedVersionUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CUSTOM_VERSION_URL_KEY) || '';
}

let currentState: AppUpdateState = {
  currentVersion: LOCAL_APP_VERSION,
  currentBuildId: LOCAL_BUILD_ID,
  remoteVersion: null,
  remoteBuildId: null,
  remoteBuiltAt: null,
  remoteNotes: [],
  versionSourceUrl: loadSavedVersionUrl(),
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

/**
 * Normalizes a user-supplied GitHub URL into a direct fetchable version.json endpoint.
 * Accepts:
 *  - empty string -> uses deployed `./version.json` on GitHub Pages, or official GitHub Pages URL otherwise
 *  - `https://github.com/user/repo` -> `https://raw.githubusercontent.com/user/repo/main/public/version.json`
 *  - direct `https://.../version.json` URL
 */
export function resolveVersionManifestUrl(customUrl: string): string {
  const trimmed = customUrl.trim();
  if (!trimmed) {
    if (
      typeof window !== 'undefined' &&
      window.location.hostname.endsWith('github.io')
    ) {
      return new URL('./version.json', window.location.href).toString();
    }
    return OFFICIAL_GITHUB_VERSION_URL;
  }

  const ghRepoMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?\/?$/i
  );
  if (ghRepoMatch) {
    const [, owner, repo] = ghRepoMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/main/public/version.json`;
  }

  const ghBlobMatch = trimmed.match(
    /^https?:\/\/github\.com\/([^/\s]+)\/([^/\s]+)\/blob\/([^/\s]+)\/(.+)$/i
  );
  if (ghBlobMatch) {
    const [, owner, repo, branch, filePath] = ghBlobMatch;
    return `https://raw.githubusercontent.com/${owner}/${repo}/${branch}/${filePath}`;
  }

  return trimmed;
}

/** Compares two dot-separated semantic versions (e.g., "1.4.0" > "1.3.0"). Returns 1, 0, or -1. */
export function compareSemver(a: string, b: string): number {
  const pa = a
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = b
    .replace(/^v/i, '')
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const len = Math.max(pa.length, pb.length);
  for (let i = 0; i < len; i++) {
    const va = pa[i] ?? 0;
    const vb = pb[i] ?? 0;
    if (va > vb) return 1;
    if (va < vb) return -1;
  }
  return 0;
}

export function setCustomVersionSourceUrl(url: string): void {
  const cleaned = url.trim();
  if (typeof window !== 'undefined') {
    if (cleaned) {
      window.localStorage.setItem(CUSTOM_VERSION_URL_KEY, cleaned);
    } else {
      window.localStorage.removeItem(CUSTOM_VERSION_URL_KEY);
    }
  }
  emit({ versionSourceUrl: cleaned });
}

export function initAppUpdater(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (!('serviceWorker' in navigator)) return;

  try {
    let hadController = Boolean(navigator.serviceWorker.controller);
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (hadController) {
        emit({
          needRefresh: true,
          status: 'update-available',
          statusMessage:
            'نسخه جدید نرم‌افزار فعال شد. برای مشاهده آخرین تغییرات دکمه «دریافت تغییرات و به‌روزرسانی محلی» را بزنید.',
        });
      }
      hadController = true;
    });

    triggerSwReload = registerSW({
      immediate: true,
      onRegisteredSW(_swUrl, registration) {
        swRegistration = registration ?? null;
        emit({ swRegistered: Boolean(registration) });
        if (registration && navigator.onLine) {
          registration.update().catch(() => {});
        }
      },
      onOfflineReady() {
        emit({ offlineReady: true });
      },
      onNeedRefresh() {
        emit({
          needRefresh: true,
          status: 'update-available',
          statusMessage:
            'نسخه جدید نرم‌افزار دریافت شد و آماده اعمال است. برای به‌روزرسانی محلی دکمه «دریافت تغییرات و به‌روزرسانی محلی» را بزنید.',
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
  notes?: string[];
  changelog?: string[];
}

export async function checkForAppUpdate(overrideUrl?: string): Promise<AppUpdateState> {
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emit({
      status: 'offline',
      statusMessage:
        'دستگاه در حالت آفلاین است. برای بررسی فایل version.json در مخزن گیت‌هاب، ابتدا به اینترنت متصل شوید و مجدداً دکمه «بررسی به‌روزرسانی» را بزنید.',
    });
    return currentState;
  }

  emit({
    status: 'checking',
    statusMessage: 'در حال اتصال به گیت‌هاب و بررسی فایل version.json...',
  });

  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_CHECK_KEY, nowIso);
  }

  let foundUpdate = false;
  let remoteVersion: string | null = null;
  let remoteBuildId: string | null = null;
  let remoteBuiltAt: string | null = null;
  let remoteNotes: string[] = [];

  try {
    // 1. Trigger browser Service Worker check against the hosted GitHub Pages deployment
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

    // 2. Fetch fresh non-cached version.json from GitHub / GitHub Pages
    const baseManifestUrl = resolveVersionManifestUrl(
      overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl
    );
    const fetchUrl = new URL(baseManifestUrl);
    fetchUrl.searchParams.set('t', String(Date.now()));

    const res = await fetch(fetchUrl.toString(), {
      cache: 'no-store',
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status}`);
    }

    const data = (await res.json()) as RemoteVersionManifest;
    remoteVersion = typeof data.version === 'string' ? data.version.trim() : null;
    remoteBuildId = typeof data.buildId === 'string' ? data.buildId.trim() : null;
    remoteBuiltAt = typeof data.builtAt === 'string' ? data.builtAt.trim() : null;
    const rawNotes = Array.isArray(data.notes)
      ? data.notes
      : Array.isArray(data.changelog)
        ? data.changelog
        : [];
    remoteNotes = rawNotes.filter((n): n is string => typeof n === 'string' && n.trim().length > 0);

    if (remoteVersion && compareSemver(remoteVersion, LOCAL_APP_VERSION) > 0) {
      foundUpdate = true;
    } else if (
      remoteBuildId &&
      remoteBuildId !== 'dev-local' &&
      LOCAL_BUILD_ID !== 'dev-local' &&
      remoteBuildId !== LOCAL_BUILD_ID
    ) {
      foundUpdate = true;
    }

    if (foundUpdate || currentState.needRefresh) {
      emit({
        needRefresh: true,
        remoteVersion,
        remoteBuildId,
        remoteBuiltAt,
        remoteNotes,
        lastCheckedAt: nowIso,
        status: 'update-available',
        statusMessage: remoteVersion
          ? `نسخه جدید (${remoteVersion}) در مخزن گیت‌هاب منتشر شده است. برای دریافت آخرین تغییرات و به‌روزرسانی محلی اقدام کنید.`
          : 'نسخه جدید نرم‌افزار در مخزن گیت‌هاب شناسایی شد و آماده اعمال است.',
      });
    } else {
      emit({
        needRefresh: false,
        remoteVersion: remoteVersion ?? LOCAL_APP_VERSION,
        remoteBuildId,
        remoteBuiltAt,
        remoteNotes,
        lastCheckedAt: nowIso,
        status: 'up-to-date',
        statusMessage: `فایل version.json بررسی شد؛ نرم‌افزار هم‌اکنون روی آخرین نسخه (${remoteVersion ?? LOCAL_APP_VERSION}) قرار دارد.`,
      });
    }
  } catch {
    emit({
      lastCheckedAt: nowIso,
      status: 'error',
      statusMessage:
        'دریافت فایل version.json از گیت‌هاب ناموفق بود. لطفاً اتصال اینترنت یا نشانی مخزن را بررسی کرده و دوباره تلاش کنید.',
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
      statusMessage: 'برای دریافت فایل‌های نسخه جدید از سرور باید به اینترنت متصل باشید.',
    });
    return;
  }

  emit({
    status: 'updating',
    statusMessage: 'در حال دریافت آخرین تغییرات و به‌روزرسانی محلی (بدون تغییر در اطلاعات شما)...',
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
    setCustomSourceUrl: setCustomVersionSourceUrl,
  };
}
