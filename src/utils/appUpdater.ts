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

export type UpdateErrorCategory =
  | 'invalid-url'
  | 'offline'
  | 'network'
  | 'cors'
  | 'http'
  | 'json'
  | 'sw'
  | null;

export interface VerifiedReleaseAsset {
  name: string;
  downloadUrl: string;
  sizeBytes: number;
  releaseTag: string;
  publishedAt: string | null;
  isPrerelease: boolean;
}

export type ReleaseInstallersStatus =
  | 'idle'
  | 'loading'
  | 'available'
  | 'partial'
  | 'no-release'
  | 'offline'
  | 'error';

export interface VerifiedReleaseInstallers {
  status: ReleaseInstallersStatus;
  repoFullName: string;
  checkedApiUrl: string;
  releaseTag: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  windowsExe: VerifiedReleaseAsset | null;
  androidApk: VerifiedReleaseAsset | null;
  message: string;
  lastCheckedAt: string | null;
}

export interface AppUpdateState {
  currentVersion: string;
  currentBuildId: string;
  remoteVersion: string | null;
  remoteBuildId: string | null;
  remoteBuiltAt: string | null;
  remoteNotes: string[];
  versionSourceUrl: string;
  checkedUrl: string;
  needRefresh: boolean;
  offlineReady: boolean;
  swRegistered: boolean;
  swWarning: string | null;
  status: AppUpdateStatus;
  statusMessage: string;
  errorCategory: UpdateErrorCategory;
  httpStatus: number | null;
  lastCheckedAt: string | null;
  releaseInstallers: VerifiedReleaseInstallers;
}

const LAST_CHECK_KEY = 'daftar-fani-last-update-check';
const CUSTOM_VERSION_URL_KEY = 'daftar-fani-github-version-url';

export const DEFAULT_GITHUB_OWNER = 'forog1980-star';
export const DEFAULT_GITHUB_REPO = 'Daftar-Fani-Golzar-App';
export const DEFAULT_GITHUB_REPO_FULL = `${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}`;

export const OFFICIAL_GITHUB_APP_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/';
export const OFFICIAL_GITHUB_VERSION_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/version.json';

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.0';
export const LOCAL_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-local';

let swRegistration: ServiceWorkerRegistration | null = null;
let triggerSwReload: ((reloadPage?: boolean) => Promise<void>) | null = null;
let initialized = false;

function loadSavedVersionUrl(): string {
  if (typeof window === 'undefined') return '';
  return window.localStorage.getItem(CUSTOM_VERSION_URL_KEY) || '';
}

function createInitialReleaseInstallers(sourceUrl: string): VerifiedReleaseInstallers {
  const { owner, repo } = extractRepoFromSourceUrl(sourceUrl);
  const repoFullName = `${owner}/${repo}`;
  return {
    status: 'idle',
    repoFullName,
    checkedApiUrl: `https://api.github.com/repos/${repoFullName}/releases`,
    releaseTag: null,
    releaseName: null,
    publishedAt: null,
    windowsExe: null,
    androidApk: null,
    message: 'برای بررسی انتشار فایل‌های نصبی ویندوز (EXE) و اندروید (APK)، بررسی به‌روزرسانی را اجرا کنید.',
    lastCheckedAt: null,
  };
}

const initialSavedUrl = loadSavedVersionUrl();

let currentState: AppUpdateState = {
  currentVersion: LOCAL_APP_VERSION,
  currentBuildId: LOCAL_BUILD_ID,
  remoteVersion: null,
  remoteBuildId: null,
  remoteBuiltAt: null,
  remoteNotes: [],
  versionSourceUrl: initialSavedUrl,
  checkedUrl: resolveVersionManifestUrl(initialSavedUrl),
  needRefresh: false,
  offlineReady: false,
  swRegistered: false,
  swWarning: null,
  status: 'idle',
  statusMessage: '',
  errorCategory: null,
  httpStatus: null,
  lastCheckedAt:
    typeof window !== 'undefined' ? window.localStorage.getItem(LAST_CHECK_KEY) : null,
  releaseInstallers: createInitialReleaseInstallers(initialSavedUrl),
};

const listeners = new Set<() => void>();

function emit(patch: Partial<AppUpdateState>) {
  currentState = { ...currentState, ...patch };
  listeners.forEach((fn) => fn());
}

/**
 * Extracts GitHub owner/repo from a custom URL (github.com, github.io, raw.githubusercontent.com)
 * or falls back to the official Daftar-Fani-Golzar-App repository.
 */
export function extractRepoFromSourceUrl(customUrl?: string): { owner: string; repo: string } {
  const trimmed = (customUrl || '').trim();
  if (!trimmed) {
    return { owner: DEFAULT_GITHUB_OWNER, repo: DEFAULT_GITHUB_REPO };
  }

  const ghRepo = trimmed.match(/^https?:\/\/github\.com\/([^/\s]+)\/([^/\s#?]+?)(?:\.git)?(?:\/|$)/i);
  if (ghRepo) {
    return { owner: ghRepo[1], repo: ghRepo[2] };
  }

  const rawGh = trimmed.match(/^https?:\/\/raw\.githubusercontent\.com\/([^/\s]+)\/([^/\s]+)\//i);
  if (rawGh) {
    return { owner: rawGh[1], repo: rawGh[2] };
  }

  const ghPages = trimmed.match(/^https?:\/\/([^./\s]+)\.github\.io\/([^/\s#?]+)(?:\/|$)/i);
  if (ghPages) {
    return { owner: ghPages[1], repo: ghPages[2] };
  }

  return { owner: DEFAULT_GITHUB_OWNER, repo: DEFAULT_GITHUB_REPO };
}

/**
 * Normalizes a user-supplied GitHub URL into a direct fetchable version.json endpoint.
 * Accepts:
 *  - empty string -> uses deployed `./version.json` on GitHub Pages, or official GitHub Pages URL otherwise
 *  - `https://github.com/user/repo` -> `https://raw.githubusercontent.com/user/repo/main/public/version.json`
 *  - `https://github.com/user/repo/blob/branch/path` -> `https://raw.githubusercontent.com/user/repo/branch/path`
 *  - direct `https://.../version.json` URL
 */
export function resolveVersionManifestUrl(customUrl: string): string {
  const trimmed = customUrl.trim();
  if (!trimmed) {
    if (
      typeof window !== 'undefined' &&
      (window.location.protocol === 'https:' || window.location.protocol === 'http:') &&
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

export interface UrlValidationResult {
  valid: boolean;
  resolvedUrl: string;
  error?: string;
}

/**
 * Validates that the resolved version.json source URL is a safe, well-formed HTTP(S) URL
 * without exposing local filesystem paths or unsupported schemes.
 */
export function validateVersionSourceUrl(customUrl: string): UrlValidationResult {
  const resolved = resolveVersionManifestUrl(customUrl);
  try {
    const parsed = new URL(resolved);
    const isHttps = parsed.protocol === 'https:';
    const isLocalHttp =
      parsed.protocol === 'http:' &&
      (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1');

    if (!isHttps && !isLocalHttp) {
      return {
        valid: false,
        resolvedUrl: resolved,
        error:
          'نشانی بررسی نسخه باید با پروتکل امن HTTPS شروع شود (مثال: https://forog1980-star.github.io/Daftar-Fani-Golzar-App/version.json).',
      };
    }

    if (!parsed.hostname || !parsed.hostname.includes('.') && !isLocalHttp) {
      return {
        valid: false,
        resolvedUrl: resolved,
        error: 'دامنه موجود در نشانی version.json معتبر نیست. لطفاً نشانی کامل را بررسی کنید.',
      };
    }

    return { valid: true, resolvedUrl: parsed.toString() };
  } catch {
    return {
      valid: false,
      resolvedUrl: resolved,
      error:
        'نشانی واردشده برای فایل version.json ساختار معتبر ندارد. لطفاً نشانی مخزن گیت‌هاب یا فایل version.json را به‌درستی وارد کنید.',
    };
  }
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
  emit({
    versionSourceUrl: cleaned,
    checkedUrl: resolveVersionManifestUrl(cleaned),
    releaseInstallers: createInitialReleaseInstallers(cleaned),
  });
}

function isServiceWorkerEligibleOrigin(): boolean {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return false;
  return (
    window.location.protocol === 'https:' ||
    (window.location.protocol === 'http:' &&
      (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'))
  );
}

export function initAppUpdater(): void {
  if (initialized || typeof window === 'undefined') return;
  initialized = true;

  if (!isServiceWorkerEligibleOrigin()) return;

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

interface GitHubReleaseAssetRaw {
  name?: string;
  browser_download_url?: string;
  size?: number;
}

interface GitHubReleaseRaw {
  tag_name?: string;
  name?: string;
  draft?: boolean;
  prerelease?: boolean;
  published_at?: string;
  assets?: GitHubReleaseAssetRaw[];
}

function isValidDirectAssetUrl(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' && parsed.hostname.endsWith('github.com');
  } catch {
    return false;
  }
}

/**
 * Pure parser for GitHub Releases API payload.
 * Extracts ONLY genuinely published direct `.exe` and `.apk` download assets.
 * NEVER fabricates URLs and NEVER falls back to the generic `/releases` HTML page.
 */
export function extractVerifiedInstallersFromReleases(
  releasesPayload: unknown,
  repoFullName: string = DEFAULT_GITHUB_REPO_FULL,
  checkedAt: string = new Date().toISOString()
): VerifiedReleaseInstallers {
  const checkedApiUrl = `https://api.github.com/repos/${repoFullName}/releases`;
  if (!Array.isArray(releasesPayload)) {
    return {
      status: 'error',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message: 'پاسخ دریافت‌شده از سرویس Releases گیت‌هاب قالب معتبر نداشت.',
      lastCheckedAt: checkedAt,
    };
  }

  const publishedReleases = (releasesPayload as GitHubReleaseRaw[]).filter(
    (rel) => rel && !rel.draft && Array.isArray(rel.assets)
  );

  if (publishedReleases.length === 0) {
    return {
      status: 'no-release',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message:
        'تا این لحظه هیچ نسخه منتشرشده‌ای (Release) شامل فایل نصبی EXE یا APK در مخزن گیت‌هاب ثبت نشده است.',
      lastCheckedAt: checkedAt,
    };
  }

  // Prefer stable releases first, then fall back to prereleases if needed
  const orderedReleases = [
    ...publishedReleases.filter((r) => !r.prerelease),
    ...publishedReleases.filter((r) => Boolean(r.prerelease)),
  ];

  let windowsExe: VerifiedReleaseAsset | null = null;
  let androidApk: VerifiedReleaseAsset | null = null;
  let primaryRelease: GitHubReleaseRaw | null = null;

  for (const rel of orderedReleases) {
    const assets = Array.isArray(rel.assets) ? rel.assets : [];
    const tag = typeof rel.tag_name === 'string' && rel.tag_name.trim() ? rel.tag_name.trim() : 'release';
    const publishedAt = typeof rel.published_at === 'string' ? rel.published_at : null;
    const isPrerelease = Boolean(rel.prerelease);

    if (!windowsExe) {
      const exeCandidates = assets.filter(
        (a) =>
          typeof a?.name === 'string' &&
          a.name.toLowerCase().endsWith('.exe') &&
          !a.name.toLowerCase().endsWith('.blockmap') &&
          isValidDirectAssetUrl(a.browser_download_url) &&
          typeof a.size === 'number' &&
          a.size > 0
      );
      const preferredExe =
        exeCandidates.find((a) => /setup|installer/i.test(a.name || '')) ?? exeCandidates[0];

      if (preferredExe && preferredExe.name && preferredExe.browser_download_url) {
        windowsExe = {
          name: preferredExe.name,
          downloadUrl: preferredExe.browser_download_url,
          sizeBytes: preferredExe.size || 0,
          releaseTag: tag,
          publishedAt,
          isPrerelease,
        };
        primaryRelease ??= rel;
      }
    }

    if (!androidApk) {
      const apkCandidates = assets.filter(
        (a) =>
          typeof a?.name === 'string' &&
          a.name.toLowerCase().endsWith('.apk') &&
          isValidDirectAssetUrl(a.browser_download_url) &&
          typeof a.size === 'number' &&
          a.size > 0
      );
      const preferredApk = apkCandidates[0];
      if (preferredApk && preferredApk.name && preferredApk.browser_download_url) {
        androidApk = {
          name: preferredApk.name,
          downloadUrl: preferredApk.browser_download_url,
          sizeBytes: preferredApk.size || 0,
          releaseTag: tag,
          publishedAt,
          isPrerelease,
        };
        primaryRelease ??= rel;
      }
    }

    if (windowsExe && androidApk) break;
  }

  const latest = primaryRelease ?? orderedReleases[0];
  const releaseTag = typeof latest.tag_name === 'string' ? latest.tag_name : null;
  const releaseName = typeof latest.name === 'string' && latest.name.trim() ? latest.name.trim() : releaseTag;
  const publishedAt = typeof latest.published_at === 'string' ? latest.published_at : null;

  if (windowsExe && androidApk) {
    return {
      status: 'available',
      repoFullName,
      checkedApiUrl,
      releaseTag,
      releaseName,
      publishedAt,
      windowsExe,
      androidApk,
      message: `فایل‌های نصبی مستقیم ویندوز (EXE) و اندروید (APK) برای نسخه ${releaseTag ?? ''} آماده دانلود هستند.`,
      lastCheckedAt: checkedAt,
    };
  }

  if (windowsExe || androidApk) {
    return {
      status: 'partial',
      repoFullName,
      checkedApiUrl,
      releaseTag,
      releaseName,
      publishedAt,
      windowsExe,
      androidApk,
      message: windowsExe
        ? 'فایل نصبی ویندوز (EXE) منتشر شده است، اما فایل نصبی اندروید (APK) هنوز در Releases منتشر نشده است.'
        : 'فایل نصبی اندروید (APK) منتشر شده است، اما فایل نصبی ویندوز (EXE) هنوز در Releases منتشر نشده است.',
      lastCheckedAt: checkedAt,
    };
  }

  return {
    status: 'no-release',
    repoFullName,
    checkedApiUrl,
    releaseTag,
    releaseName,
    publishedAt,
    windowsExe: null,
    androidApk: null,
    message:
      'در نسخه منتشرشده Releases، فایل نصبی مستقیم EXE یا APK یافت نشد (فایل نصبی هنوز منتشر نشده است).',
    lastCheckedAt: checkedAt,
  };
}

/**
 * Queries GitHub Releases API to verify real published EXE / APK direct download URLs.
 * Read-only, never fabricates download URLs, never leaks sensitive paths.
 */
export async function checkVerifiedReleaseInstallers(
  overrideUrl?: string
): Promise<VerifiedReleaseInstallers> {
  const sourceUrl = overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl;
  const { owner, repo } = extractRepoFromSourceUrl(sourceUrl);
  const repoFullName = `${owner}/${repo}`;
  const checkedApiUrl = `https://api.github.com/repos/${repoFullName}/releases`;
  const nowIso = new Date().toISOString();

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineState: VerifiedReleaseInstallers = {
      status: 'offline',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message: 'دستگاه در حالت آفلاین است؛ امکان بررسی فایل‌های منتشرشده در Releases گیت‌هاب وجود ندارد.',
      lastCheckedAt: nowIso,
    };
    emit({ releaseInstallers: offlineState });
    return offlineState;
  }

  emit({
    releaseInstallers: {
      ...currentState.releaseInstallers,
      status: 'loading',
      repoFullName,
      checkedApiUrl,
      message: 'در حال بررسی فایل‌های نصبی منتشرشده در Releases گیت‌هاب...',
    },
  });

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

  try {
    const res = await fetch(checkedApiUrl, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
      },
      signal: controller?.signal,
    });

    if (!res.ok) {
      const msg =
        res.status === 403
          ? 'محدودیت موقت تعداد درخواست‌های API گیت‌هاب (HTTP 403). چند دقیقه بعد مجدداً تلاش کنید.'
          : res.status === 404
            ? 'مخزن یا بخش Releases گیت‌هاب در نشانی مشخص‌شده یافت نشد (HTTP 404).'
            : `بررسی Releases گیت‌هاب با خطای HTTP ${res.status} مواجه شد.`;
      const errState: VerifiedReleaseInstallers = {
        status: 'error',
        repoFullName,
        checkedApiUrl,
        releaseTag: null,
        releaseName: null,
        publishedAt: null,
        windowsExe: null,
        androidApk: null,
        message: msg,
        lastCheckedAt: nowIso,
      };
      emit({ releaseInstallers: errState });
      return errState;
    }

    const payload = (await res.json()) as unknown;
    const parsed = extractVerifiedInstallersFromReleases(payload, repoFullName, nowIso);
    emit({ releaseInstallers: parsed });
    return parsed;
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const errState: VerifiedReleaseInstallers = {
      status: 'error',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message: isAbort
        ? 'زمان انتظار برای دریافت فهرست Releases گیت‌هاب به پایان رسید. اتصال اینترنت را بررسی کنید.'
        : 'اتصال به سرویس Releases گیت‌هاب برقرار نشد (خطای شبکه یا محدودیت دسترسی).',
      lastCheckedAt: nowIso,
    };
    emit({ releaseInstallers: errState });
    return errState;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

export async function checkForAppUpdate(overrideUrl?: string): Promise<AppUpdateState> {
  const rawSource = overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl;
  const validation = validateVersionSourceUrl(rawSource);

  if (!validation.valid) {
    emit({
      checkedUrl: validation.resolvedUrl,
      status: 'error',
      errorCategory: 'invalid-url',
      httpStatus: null,
      swWarning: null,
      statusMessage: validation.error || 'نشانی فایل version.json نامعتبر است.',
    });
    return currentState;
  }

  const baseManifestUrl = validation.resolvedUrl;

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    emit({
      checkedUrl: baseManifestUrl,
      status: 'offline',
      errorCategory: 'offline',
      httpStatus: null,
      statusMessage:
        'دستگاه در حالت آفلاین است. برای بررسی فایل version.json در مخزن گیت‌هاب، ابتدا به اینترنت متصل شوید و مجدداً دکمه «بررسی به‌روزرسانی» را بزنید.',
    });
    return currentState;
  }

  emit({
    checkedUrl: baseManifestUrl,
    status: 'checking',
    errorCategory: null,
    httpStatus: null,
    swWarning: null,
    statusMessage: 'در حال اتصال به سرور و بررسی فایل version.json...',
  });

  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_CHECK_KEY, nowIso);
  }

  // Trigger read-only Releases check in parallel (never blocks version.json result)
  void checkVerifiedReleaseInstallers(rawSource);

  let foundUpdate = false;
  let swWarning: string | null = null;

  // 1. Isolated Service Worker check — ONLY on eligible web origins; NEVER blocks version.json fetch!
  if (isServiceWorkerEligibleOrigin()) {
    try {
      const reg = swRegistration ?? (await navigator.serviceWorker.getRegistration());
      if (reg) {
        swRegistration = reg;
        await reg.update();
        if (reg.waiting || reg.installing) {
          foundUpdate = true;
        }
      }
    } catch {
      swWarning =
        'بررسی Service Worker مرورگر با خطا مواجه شد، اما بررسی مستقیم فایل version.json به‌صورت مستقل انجام شد.';
    }
  }

  // 2. Fetch fresh non-cached version.json independently
  const fetchUrl = new URL(baseManifestUrl);
  fetchUrl.searchParams.set('t', String(Date.now()));

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;

  let res: Response;
  try {
    res = await fetch(fetchUrl.toString(), {
      cache: 'no-store',
      signal: controller?.signal,
    });
  } catch (err) {
    if (timeoutId) clearTimeout(timeoutId);
    const isAbort = err instanceof Error && err.name === 'AbortError';
    const isCrossOrigin =
      typeof window !== 'undefined' &&
      (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
      fetchUrl.origin !== window.location.origin;

    const category: UpdateErrorCategory = isAbort
      ? 'network'
      : isCrossOrigin
        ? 'cors'
        : 'network';

    emit({
      checkedUrl: baseManifestUrl,
      lastCheckedAt: nowIso,
      status: 'error',
      errorCategory: category,
      httpStatus: null,
      swWarning,
      statusMessage: isAbort
        ? 'زمان انتظار برای دریافت فایل version.json به پایان رسید. اتصال اینترنت یا فیلترشکن/فایروال را بررسی کنید.'
        : isCrossOrigin
          ? 'خطای شبکه یا محدودیت CORS هنگام دریافت فایل version.json از سرور مقصد. اتصال اینترنت و نشانی فایل را بررسی کنید.'
          : 'اتصال شبکه‌ای برای دریافت فایل version.json برقرار نشد. وضعیت اتصال اینترنت یا فایروال سیستم را بررسی کنید.',
    });
    return currentState;
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }

  if (!res.ok) {
    const statusHint =
      res.status === 404
        ? 'فایل version.json در نشانی مشخص‌شده یافت نشد (HTTP 404).'
        : res.status === 403
          ? 'دسترسی به نشانی version.json مجاز نبود (HTTP 403).'
          : res.status >= 500
            ? `سرور میزبان فایل version.json با خطای داخلی مواجه شد (HTTP ${res.status}).`
            : `دریافت فایل version.json با پاسخ ناموفق HTTP ${res.status} مواجه شد.`;

    emit({
      checkedUrl: baseManifestUrl,
      lastCheckedAt: nowIso,
      status: 'error',
      errorCategory: 'http',
      httpStatus: res.status,
      swWarning,
      statusMessage: statusHint,
    });
    return currentState;
  }

  let data: RemoteVersionManifest;
  try {
    const rawText = await res.text();
    const parsed = JSON.parse(rawText) as unknown;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Invalid JSON root');
    }
    data = parsed as RemoteVersionManifest;
    if (typeof data.version !== 'string' || !data.version.trim()) {
      throw new Error('Missing version field');
    }
  } catch {
    emit({
      checkedUrl: baseManifestUrl,
      lastCheckedAt: nowIso,
      status: 'error',
      errorCategory: 'json',
      httpStatus: res.status,
      swWarning,
      statusMessage:
        'پاسخ دریافت‌شده از نشانی version.json قالب معتبر JSON ندارد یا فاقد فیلد نسخه (version) است.',
    });
    return currentState;
  }

  const remoteVersion = data.version.trim();
  const remoteBuildId = typeof data.buildId === 'string' ? data.buildId.trim() : null;
  const remoteBuiltAt = typeof data.builtAt === 'string' ? data.builtAt.trim() : null;
  const rawNotes = Array.isArray(data.notes)
    ? data.notes
    : Array.isArray(data.changelog)
      ? data.changelog
      : [];
  const remoteNotes = rawNotes.filter(
    (n): n is string => typeof n === 'string' && n.trim().length > 0
  );

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
      checkedUrl: baseManifestUrl,
      needRefresh: true,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'update-available',
      errorCategory: null,
      httpStatus: res.status,
      swWarning,
      statusMessage: `نسخه جدید (${remoteVersion}) در مخزن منتشر شده است. برای دریافت آخرین تغییرات اقدام کنید.`,
    });
  } else {
    emit({
      checkedUrl: baseManifestUrl,
      needRefresh: false,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'up-to-date',
      errorCategory: null,
      httpStatus: res.status,
      swWarning,
      statusMessage: `فایل version.json با موفقیت بررسی شد؛ نرم‌افزار هم‌اکنون روی آخرین نسخه (${remoteVersion}) قرار دارد.`,
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
      errorCategory: 'offline',
      statusMessage: 'برای دریافت فایل‌های نسخه جدید از سرور باید به اینترنت متصل باشید.',
    });
    return;
  }

  emit({
    status: 'updating',
    errorCategory: null,
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

    if (isServiceWorkerEligibleOrigin()) {
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
    checkReleaseInstallers: checkVerifiedReleaseInstallers,
    applyUpdate: applyAppUpdate,
    setCustomSourceUrl: setCustomVersionSourceUrl,
  };
}
