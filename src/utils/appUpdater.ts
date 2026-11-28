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
  source: 'github-releases' | 'alternate-mirror';
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

export interface NetworkEndpointRecord {
  label: string;
  url: string;
  outcome: 'ok' | 'http-error' | 'timeout' | 'network-error' | 'cors-error' | 'invalid-json';
  httpStatus?: number;
  attempts: number;
}

export interface NetworkDiagnosticSnapshot {
  onlineFlag: boolean;
  connectionType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
  totalAttempts: number;
  retryCount: number;
  endpoints: NetworkEndpointRecord[];
  summaryPersian: string;
}

export interface RetryBackoffOptions {
  maxRetries?: number;
  baseDelayMs?: number;
  maxDelayMs?: number;
  onRetry?: (attempt: number, totalAttempts: number, delayMs: number) => void;
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
  usedFallback: boolean;
  fallbackSourceLabel: string | null;
  attemptedUrls: string[];
  retryStatusText: string | null;
  networkReport: NetworkDiagnosticSnapshot | null;
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
export const OFFICIAL_GITHUB_RAW_VERSION_URL =
  'https://raw.githubusercontent.com/forog1980-star/Daftar-Fani-Golzar-App/main/public/version.json';
export const OFFICIAL_GITHUB_API_VERSION_URL =
  'https://api.github.com/repos/forog1980-star/Daftar-Fani-Golzar-App/contents/public/version.json';

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.1';
export const LOCAL_BUILD_ID =
  typeof __APP_BUILD_ID__ !== 'undefined' ? __APP_BUILD_ID__ : 'dev-local';

export interface ResilientFetchResult {
  ok: boolean;
  status: number;
  bodyText: string;
  networkError?: 'timeout' | 'cors' | 'network';
  attempts: number;
}

interface NavigatorConnectionLike {
  effectiveType?: string;
  type?: string;
  downlink?: number;
  rtt?: number;
}

function readNetworkConnectionInfo(): {
  onlineFlag: boolean;
  connectionType: string | null;
  downlinkMbps: number | null;
  rttMs: number | null;
} {
  const onlineFlag = typeof navigator === 'undefined' ? true : navigator.onLine !== false;
  const conn =
    typeof navigator !== 'undefined'
      ? ((navigator as Navigator & { connection?: NavigatorConnectionLike }).connection ?? null)
      : null;

  const rawType = conn?.effectiveType || conn?.type || null;
  const connectionType = typeof rawType === 'string' && rawType.trim() ? rawType.trim().toUpperCase() : null;
  const downlinkMbps = typeof conn?.downlink === 'number' && Number.isFinite(conn.downlink) ? conn.downlink : null;
  const rttMs = typeof conn?.rtt === 'number' && Number.isFinite(conn.rtt) ? conn.rtt : null;

  return { onlineFlag, connectionType, downlinkMbps, rttMs };
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isRetryableFailure(res: ResilientFetchResult): boolean {
  if (res.ok) return false;
  if (res.networkError) return true; // timeout, network, or transient CORS/gateway drop
  // Retry transient server/rate-limit statuses; do NOT waste retries on 404/401/400
  return res.status === 408 || res.status === 429 || res.status >= 500;
}

async function singleFetchText(
  targetUrl: string,
  headers?: Record<string, string>
): Promise<Omit<ResilientFetchResult, 'attempts'>> {
  // On Windows Electron Desktop, prefer main-process net.fetch to honor Windows proxy/certs and avoid custom-scheme CORS
  if (typeof window !== 'undefined' && typeof window.desktopBridge?.fetchJson === 'function') {
    try {
      const ipcRes = await window.desktopBridge.fetchJson(targetUrl);
      if (ipcRes && typeof ipcRes.status === 'number') {
        if (ipcRes.status > 0) {
          return {
            ok: Boolean(ipcRes.ok),
            status: ipcRes.status,
            bodyText: ipcRes.bodyText || '',
          };
        }
        return {
          ok: false,
          status: 0,
          bodyText: '',
          networkError: ipcRes.errorCode === 'TIMEOUT' ? 'timeout' : 'network',
        };
      }
    } catch {
      // Fall through to standard fetch
    }
  }

  const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timeoutId = controller ? setTimeout(() => controller.abort(), 10000) : null;
  try {
    const res = await fetch(targetUrl, {
      cache: 'no-store',
      headers,
      signal: controller?.signal,
    });
    const bodyText = await res.text();
    return { ok: res.ok, status: res.status, bodyText };
  } catch (err) {
    const isAbort = err instanceof Error && err.name === 'AbortError';
    let isCrossOrigin = false;
    try {
      const parsed = new URL(targetUrl);
      isCrossOrigin =
        typeof window !== 'undefined' &&
        (window.location.protocol === 'http:' || window.location.protocol === 'https:') &&
        parsed.origin !== window.location.origin;
    } catch {
      isCrossOrigin = false;
    }
    return {
      ok: false,
      status: 0,
      bodyText: '',
      networkError: isAbort ? 'timeout' : isCrossOrigin ? 'cors' : 'network',
    };
  } finally {
    if (timeoutId) clearTimeout(timeoutId);
  }
}

/**
 * Performs an HTTPS fetch with configurable exponential backoff retries for transient failures.
 * Delays follow `min(maxDelayMs, baseDelayMs * 2^(attempt-1))` (e.g. 600ms -> 1200ms).
 */
export async function fetchWithExponentialBackoff(
  targetUrl: string,
  headers?: Record<string, string>,
  options: RetryBackoffOptions = {}
): Promise<ResilientFetchResult> {
  const maxRetries = Math.max(0, options.maxRetries ?? 2);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? 600);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? 4000);
  const totalAttempts = maxRetries + 1;

  let lastResult: ResilientFetchResult = {
    ok: false,
    status: 0,
    bodyText: '',
    networkError: 'network',
    attempts: 0,
  };

  for (let attempt = 1; attempt <= totalAttempts; attempt++) {
    const single = await singleFetchText(targetUrl, headers);
    lastResult = { ...single, attempts: attempt };

    if (!isRetryableFailure(lastResult) || attempt === totalAttempts) {
      return lastResult;
    }

    const delayMs = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
    options.onRetry?.(attempt + 1, totalAttempts, delayMs);
    if (delayMs > 0) {
      await sleep(delayMs);
    }
  }

  return lastResult;
}

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
    message:
      'برای بررسی انتشار فایل‌های نصبی ویندوز (EXE) و اندروید (APK)، بررسی به‌روزرسانی را اجرا کنید.',
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
  usedFallback: false,
  fallbackSourceLabel: null,
  attemptedUrls: [],
  retryStatusText: null,
  networkReport: null,
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

  const ghPagesRootMatch = trimmed.match(/^https?:\/\/([^./\s]+)\.github\.io\/([^/\s#?]+)\/?$/i);
  if (ghPagesRootMatch) {
    const [, owner, repo] = ghPagesRootMatch;
    return `https://${owner}.github.io/${repo}/version.json`;
  }

  return trimmed;
}

/**
 * Builds an ordered, deduplicated fallback chain of version.json mirrors
 * (GitHub Pages -> raw.githubusercontent.com -> GitHub Contents API).
 */
export function buildVersionFallbackCandidates(rawSource: string, resolvedPrimary: string): string[] {
  const candidates: string[] = [resolvedPrimary];
  const { owner, repo } = extractRepoFromSourceUrl(rawSource || resolvedPrimary);
  const isKnownGitHubSource =
    !rawSource.trim() ||
    /github\.io|github\.com|raw\.githubusercontent\.com/i.test(resolvedPrimary);

  if (isKnownGitHubSource) {
    const pagesUrl = `https://${owner}.github.io/${repo}/version.json`;
    const rawUrl = `https://raw.githubusercontent.com/${owner}/${repo}/main/public/version.json`;
    const apiUrl = `https://api.github.com/repos/${owner}/${repo}/contents/public/version.json`;
    for (const mirror of [pagesUrl, rawUrl, apiUrl]) {
      if (!candidates.includes(mirror)) {
        candidates.push(mirror);
      }
    }
  }
  return candidates;
}

function getEndpointLabel(url: string): string {
  if (url.includes('github.io')) return 'GitHub Pages (version.json)';
  if (url.includes('raw.githubusercontent.com')) return 'GitHub Raw Mirror';
  if (url.includes('api.github.com') && url.includes('/releases')) return 'GitHub Releases API';
  if (url.includes('api.github.com')) return 'GitHub Contents API';
  return 'سرور سفارشی نسخه';
}

function decodeBase64Utf8(b64: string): string {
  const clean = b64.replace(/\s+/g, '');
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(clean, 'base64').toString('utf-8');
  }
  const binary = atob(clean);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return new TextDecoder('utf-8').decode(bytes);
}

interface RemoteInstallersMirrorConfig {
  windowsExeUrl?: string;
  windowsExeName?: string;
  windowsExeSizeBytes?: number;
  androidApkUrl?: string;
  androidApkName?: string;
  androidApkSizeBytes?: number;
}

interface RemoteVersionManifest {
  version?: string;
  buildId?: string;
  builtAt?: string;
  notes?: string[];
  changelog?: string[];
  installers?: RemoteInstallersMirrorConfig;
}

let cachedManifestInstallers: {
  version: string;
  builtAt: string | null;
  installers: RemoteInstallersMirrorConfig;
} | null = null;

function parseRemoteVersionManifest(bodyText: string): RemoteVersionManifest | null {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    if (
      parsed.encoding === 'base64' &&
      typeof parsed.content === 'string' &&
      typeof parsed.version !== 'string'
    ) {
      const decoded = decodeBase64Utf8(parsed.content);
      const inner = JSON.parse(decoded) as RemoteVersionManifest | null;
      if (
        inner &&
        typeof inner === 'object' &&
        !Array.isArray(inner) &&
        typeof inner.version === 'string' &&
        inner.version.trim()
      ) {
        return inner;
      }
      return null;
    }

    const direct = parsed as RemoteVersionManifest;
    if (typeof direct.version === 'string' && direct.version.trim()) {
      return direct;
    }
    return null;
  } catch {
    return null;
  }
}

export interface UrlValidationResult {
  valid: boolean;
  resolvedUrl: string;
  error?: string;
}

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

    if (!parsed.hostname || (!parsed.hostname.includes('.') && !isLocalHttp)) {
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

export function compareSemver(a: string, b: string): number {
  const pa = a
    .replace(/^v/i, '')
    .split('-')[0]
    .split('.')
    .map((n) => parseInt(n, 10) || 0);
  const pb = b
    .replace(/^v/i, '')
    .split('-')[0]
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
        if (registration && navigator.onLine !== false) {
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

function isValidDirectBinaryUrl(url: unknown, ext: '.exe' | '.apk', requireGitHubHost: boolean): url is string {
  if (typeof url !== 'string') return false;
  try {
    const parsed = new URL(url.trim());
    if (parsed.protocol !== 'https:') return false;
    if (requireGitHubHost && !parsed.hostname.endsWith('github.com')) return false;
    // Reject generic HTML pages like /releases or /releases/latest
    if (/\/releases\/?$/i.test(parsed.pathname) || /\/releases\/latest\/?$/i.test(parsed.pathname)) {
      return false;
    }
    return parsed.pathname.toLowerCase().endsWith(ext);
  } catch {
    return false;
  }
}

function buildMirrorAssetIfValid(
  url: unknown,
  nameFallback: string,
  sizeBytes: unknown,
  ext: '.exe' | '.apk',
  releaseTag: string,
  publishedAt: string | null
): VerifiedReleaseAsset | null {
  if (!isValidDirectBinaryUrl(url, ext, false)) return null;
  const parsed = new URL(url.trim());
  const pathBase = parsed.pathname.split('/').pop() || nameFallback;
  return {
    name: pathBase,
    downloadUrl: parsed.toString(),
    sizeBytes: typeof sizeBytes === 'number' && sizeBytes > 0 ? sizeBytes : 0,
    releaseTag,
    publishedAt,
    isPrerelease: false,
    source: 'alternate-mirror',
  };
}

/**
 * Pure parser for GitHub Releases API payload with optional verified alternate-mirror fallback.
 * NEVER fabricates URLs and NEVER falls back to the generic `/releases` HTML page.
 */
export function extractVerifiedInstallersFromReleases(
  releasesPayload: unknown,
  repoFullName: string = DEFAULT_GITHUB_REPO_FULL,
  checkedAt: string = new Date().toISOString(),
  mirrorConfig?: {
    version: string;
    builtAt: string | null;
    installers: RemoteInstallersMirrorConfig;
  } | null
): VerifiedReleaseInstallers {
  const checkedApiUrl = `https://api.github.com/repos/${repoFullName}/releases`;
  const mirrorTag = mirrorConfig?.version ? `v${mirrorConfig.version.replace(/^v/i, '')}` : 'mirror';
  const mirrorExe = mirrorConfig
    ? buildMirrorAssetIfValid(
        mirrorConfig.installers.windowsExeUrl,
        mirrorConfig.installers.windowsExeName || 'Daftar-Fani-Golzar-Setup.exe',
        mirrorConfig.installers.windowsExeSizeBytes,
        '.exe',
        mirrorTag,
        mirrorConfig.builtAt
      )
    : null;
  const mirrorApk = mirrorConfig
    ? buildMirrorAssetIfValid(
        mirrorConfig.installers.androidApkUrl,
        mirrorConfig.installers.androidApkName || 'Daftar-Fani-Golzar.apk',
        mirrorConfig.installers.androidApkSizeBytes,
        '.apk',
        mirrorTag,
        mirrorConfig.builtAt
      )
    : null;

  if (!Array.isArray(releasesPayload)) {
    if (mirrorExe || mirrorApk) {
      return {
        status: mirrorExe && mirrorApk ? 'available' : 'partial',
        repoFullName,
        checkedApiUrl,
        releaseTag: mirrorTag,
        releaseName: mirrorTag,
        publishedAt: mirrorConfig?.builtAt ?? null,
        windowsExe: mirrorExe,
        androidApk: mirrorApk,
        message: 'لینک مستقیم فایل نصبی از طریق سرور جایگزین معتبر تأیید شد.',
        lastCheckedAt: checkedAt,
      };
    }
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

  let windowsExe: VerifiedReleaseAsset | null = null;
  let androidApk: VerifiedReleaseAsset | null = null;
  let primaryRelease: GitHubReleaseRaw | null = null;

  if (publishedReleases.length > 0) {
    const orderedReleases = [
      ...publishedReleases.filter((r) => !r.prerelease),
      ...publishedReleases.filter((r) => Boolean(r.prerelease)),
    ];

    for (const rel of orderedReleases) {
      const assets = Array.isArray(rel.assets) ? rel.assets : [];
      const tag =
        typeof rel.tag_name === 'string' && rel.tag_name.trim() ? rel.tag_name.trim() : 'release';
      const publishedAt = typeof rel.published_at === 'string' ? rel.published_at : null;
      const isPrerelease = Boolean(rel.prerelease);

      if (!windowsExe) {
        const exeCandidates = assets.filter(
          (a) =>
            typeof a?.name === 'string' &&
            a.name.toLowerCase().endsWith('.exe') &&
            !a.name.toLowerCase().endsWith('.blockmap') &&
            isValidDirectBinaryUrl(a.browser_download_url, '.exe', true) &&
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
            source: 'github-releases',
          };
          primaryRelease ??= rel;
        }
      }

      if (!androidApk) {
        const apkCandidates = assets.filter(
          (a) =>
            typeof a?.name === 'string' &&
            a.name.toLowerCase().endsWith('.apk') &&
            isValidDirectBinaryUrl(a.browser_download_url, '.apk', true) &&
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
            source: 'github-releases',
          };
          primaryRelease ??= rel;
        }
      }

      if (windowsExe && androidApk) break;
    }
  }

  // Merge verified alternate mirror if GitHub Releases lacked either asset
  windowsExe = windowsExe ?? mirrorExe;
  androidApk = androidApk ?? mirrorApk;

  if (!primaryRelease && !windowsExe && !androidApk) {
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
        'تا این لحظه هیچ نسخه منتشرشده‌ای (Release) شامل فایل نصبی EXE یا APK در گیت‌هاب ثبت نشده است. برای فعال شدن دانلود مستقیم، در بخش GitHub Actions گردش‌کار «Build Standalone Installers» را با گزینه publish_release فعال اجرا کنید.',
      lastCheckedAt: checkedAt,
    };
  }

  const latest = primaryRelease ?? publishedReleases[0];
  const releaseTag =
    (typeof latest?.tag_name === 'string' ? latest.tag_name : null) ??
    windowsExe?.releaseTag ??
    androidApk?.releaseTag ??
    null;
  const releaseName =
    (typeof latest?.name === 'string' && latest.name.trim() ? latest.name.trim() : null) ??
    releaseTag;
  const publishedAt =
    (typeof latest?.published_at === 'string' ? latest.published_at : null) ??
    windowsExe?.publishedAt ??
    androidApk?.publishedAt ??
    null;

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
        ? 'فایل نصبی ویندوز (EXE) آماده دانلود مستقیم است، اما فایل نصبی اندروید (APK) هنوز در Releases منتشر نشده است.'
        : 'فایل نصبی اندروید (APK) آماده دانلود مستقیم است، اما فایل نصبی ویندوز (EXE) هنوز در Releases منتشر نشده است.',
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
 * Verifies an installer download link before launching download so broken/dead/HTML links
 * show a direct Persian error message instead of navigating to an empty/404 page.
 */
export async function verifyInstallerDownloadUrl(
  asset: VerifiedReleaseAsset | null,
  expectedExt: '.exe' | '.apk'
): Promise<{ ok: boolean; error?: string }> {
  if (!asset || !asset.downloadUrl) {
    return {
      ok: false,
      error:
        expectedExt === '.exe'
          ? 'فایل نصبی ویندوز (EXE) در Releases یا سرور جایگزین موجود نیست.'
          : 'فایل نصبی اندروید (APK) در Releases یا سرور جایگزین موجود نیست.',
    };
  }

  if (!isValidDirectBinaryUrl(asset.downloadUrl, expectedExt, false)) {
    return {
      ok: false,
      error: 'نشانی دانلود معتبر نیست یا به صفحه عمومی به‌جای فایل نصبی اشاره می‌کند.',
    };
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    return {
      ok: false,
      error: 'دستگاه در حالت آفلاین است. ابتدا به اینترنت متصل شوید و سپس دانلود را آغاز کنید.',
    };
  }

  // On Electron Desktop, perform real HEAD probe via Windows native network stack (zero CORS limitation)
  if (typeof window !== 'undefined' && typeof window.desktopBridge?.verifyDownloadUrl === 'function') {
    const headRes = await window.desktopBridge.verifyDownloadUrl(asset.downloadUrl);
    if (!headRes.ok) {
      return {
        ok: false,
        error: headRes.error || 'لینک دانلود فایل نصبی در دسترس نیست یا حذف شده است.',
      };
    }
    return { ok: true };
  }

  // On Web/Android: GitHub Releases URLs were already verified via live GitHub Releases API (size > 0);
  // for non-GitHub alternate mirrors, run a HEAD probe if CORS permits.
  if (asset.source === 'alternate-mirror') {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 8000) : null;
    try {
      const res = await fetch(asset.downloadUrl, {
        method: 'HEAD',
        cache: 'no-store',
        signal: controller?.signal,
      });
      if (!res.ok) {
        return {
          ok: false,
          error: `لینک دانلود در سرور جایگزین خراب یا غیرفعال است (کد خطا: HTTP ${res.status}).`,
        };
      }
      const ct = (res.headers.get('content-type') || '').toLowerCase();
      if (ct.includes('text/html')) {
        return {
          ok: false,
          error: 'سرور جایگزین به‌جای فایل نصبی، صفحه وب (HTML) برگرداند.',
        };
      }
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') {
        return {
          ok: false,
          error: 'سرور دانلود در زمان مقرر پاسخ نداد. لطفاً اتصال اینترنت را بررسی کنید.',
        };
      }
      // On browser, CORS-opaque HEAD failures can occur on valid CDNs; allow direct anchor download when online
    } finally {
      if (timer) clearTimeout(timer);
    }
  }

  return { ok: true };
}

/**
 * Queries GitHub Releases API with exponential backoff retries to verify real published EXE/APK direct download URLs.
 */
export async function checkVerifiedReleaseInstallers(
  overrideUrl?: string,
  retryOptions?: RetryBackoffOptions
): Promise<VerifiedReleaseInstallers> {
  const sourceUrl = overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl;
  const { owner, repo } = extractRepoFromSourceUrl(sourceUrl);
  const repoFullName = `${owner}/${repo}`;
  const checkedApiUrl = `https://api.github.com/repos/${repoFullName}/releases`;
  const nowIso = new Date().toISOString();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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

  const fetchRes = await fetchWithExponentialBackoff(
    checkedApiUrl,
    { Accept: 'application/vnd.github+json' },
    {
      maxRetries: retryOptions?.maxRetries ?? 2,
      baseDelayMs: retryOptions?.baseDelayMs ?? 600,
      maxDelayMs: retryOptions?.maxDelayMs ?? 3000,
    }
  );

  if (fetchRes.networkError) {
    if (cachedManifestInstallers) {
      const mirrorOnly = extractVerifiedInstallersFromReleases(
        null,
        repoFullName,
        nowIso,
        cachedManifestInstallers
      );
      if (mirrorOnly.status === 'available' || mirrorOnly.status === 'partial') {
        emit({ releaseInstallers: mirrorOnly });
        return mirrorOnly;
      }
    }
    const errState: VerifiedReleaseInstallers = {
      status: 'error',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message:
        fetchRes.networkError === 'timeout'
          ? 'زمان انتظار برای دریافت فهرست Releases گیت‌هاب پس از تلاش‌های مجدد به پایان رسید.'
          : 'اتصال به سرویس Releases گیت‌هاب برقرار نشد (خطای شبکه یا محدودیت دسترسی).',
      lastCheckedAt: nowIso,
    };
    emit({ releaseInstallers: errState });
    return errState;
  }

  if (!fetchRes.ok) {
    const msg =
      fetchRes.status === 403
        ? 'محدودیت موقت تعداد درخواست‌های API گیت‌هاب (HTTP 403). چند دقیقه بعد مجدداً تلاش کنید.'
        : fetchRes.status === 404
          ? 'مخزن یا بخش Releases گیت‌هاب در نشانی مشخص‌شده یافت نشد (HTTP 404).'
          : `بررسی Releases گیت‌هاب با خطای HTTP ${fetchRes.status} مواجه شد.`;
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

  try {
    const payload = JSON.parse(fetchRes.bodyText) as unknown;
    const parsed = extractVerifiedInstallersFromReleases(
      payload,
      repoFullName,
      nowIso,
      cachedManifestInstallers
    );
    emit({ releaseInstallers: parsed });
    return parsed;
  } catch {
    const errState: VerifiedReleaseInstallers = {
      status: 'error',
      repoFullName,
      checkedApiUrl,
      releaseTag: null,
      releaseName: null,
      publishedAt: null,
      windowsExe: null,
      androidApk: null,
      message: 'پاسخ دریافت‌شده از سرویس Releases گیت‌هاب قالب معتبر JSON نداشت.',
      lastCheckedAt: nowIso,
    };
    emit({ releaseInstallers: errState });
    return errState;
  }
}

function buildReadableNetworkReport(
  endpoints: NetworkEndpointRecord[],
  succeeded: boolean
): NetworkDiagnosticSnapshot {
  const conn = readNetworkConnectionInfo();
  const totalAttempts = endpoints.reduce((sum, ep) => sum + ep.attempts, 0);
  const retryCount = Math.max(0, totalAttempts - endpoints.length);

  let summaryPersian: string;
  if (!conn.onlineFlag) {
    summaryPersian =
      'سیستم عامل وضعیت شبکه دستگاه را «آفلاین» گزارش می‌کند. لطفاً اتصال Wi-Fi یا کابل شبکه را بررسی کنید.';
  } else if (succeeded) {
    summaryPersian = `اتصال به سرورهای گیت‌هاب برقرار است${conn.connectionType ? ` (نوع ارتباط: ${conn.connectionType})` : ''}.`;
  } else {
    const hasTimeout = endpoints.some((e) => e.outcome === 'timeout');
    const hasCors = endpoints.some((e) => e.outcome === 'cors-error');
    const has404 = endpoints.every((e) => e.outcome === 'http-error' && e.httpStatus === 404);
    if (has404) {
      summaryPersian =
        'اتصال اینترنت برقرار است، اما فایل نسخه در هیچ‌یک از نشانی‌های بررسی‌شده یافت نشد (خطای ۴۰۴).';
    } else if (hasTimeout) {
      summaryPersian =
        'دستگاه به شبکه محلی متصل است، اما سرورهای گیت‌هاب در مهلت زمانی پاسخ ندادند (احتمال کندی اینترنت، محدودیت شبکه سازمانی یا نیاز به بررسی پروکسی/فایروال).';
    } else if (hasCors) {
      summaryPersian =
        'دستگاه به شبکه متصل است، اما مرورگر به دلیل خطای شبکه یا محدودیت CORS/فیلترینگ نتوانست پاسخ سرورهای گیت‌هاب را دریافت کند.';
    } else {
      summaryPersian =
        'دستگاه به شبکه محلی متصل است، اما ارتباط با تمامی سرورهای گیت‌هاب پس از تلاش مجدد (توقف نمایی) ناموفق بود. وضعیت اینترنت، پروکسی سیستم یا فایروال را بررسی کنید.';
    }
  }

  return {
    onlineFlag: conn.onlineFlag,
    connectionType: conn.connectionType,
    downlinkMbps: conn.downlinkMbps,
    rttMs: conn.rttMs,
    totalAttempts,
    retryCount,
    endpoints,
    summaryPersian,
  };
}

export async function checkForAppUpdate(
  overrideUrl?: string,
  retryOptions?: RetryBackoffOptions
): Promise<AppUpdateState> {
  const rawSource = overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl;
  const validation = validateVersionSourceUrl(rawSource);

  if (!validation.valid) {
    emit({
      checkedUrl: validation.resolvedUrl,
      status: 'error',
      errorCategory: 'invalid-url',
      httpStatus: null,
      swWarning: null,
      retryStatusText: null,
      networkReport: null,
      statusMessage: validation.error || 'نشانی فایل version.json نامعتبر است.',
    });
    return currentState;
  }

  const baseManifestUrl = validation.resolvedUrl;

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineReport = buildReadableNetworkReport([], false);
    emit({
      checkedUrl: baseManifestUrl,
      status: 'offline',
      errorCategory: 'offline',
      httpStatus: null,
      retryStatusText: null,
      networkReport: offlineReport,
      statusMessage:
        'دستگاه در حالت آفلاین است. برای بررسی به‌روزرسانی، ابتدا به اینترنت متصل شوید و مجدداً دکمه «بررسی به‌روزرسانی» را بزنید.',
    });
    return currentState;
  }

  emit({
    checkedUrl: baseManifestUrl,
    status: 'checking',
    errorCategory: null,
    httpStatus: null,
    swWarning: null,
    retryStatusText: null,
    networkReport: null,
    statusMessage: 'در حال اتصال به سرور و بررسی آخرین نسخه نرم‌افزار...',
  });

  const nowIso = new Date().toISOString();
  if (typeof window !== 'undefined') {
    window.localStorage.setItem(LAST_CHECK_KEY, nowIso);
  }

  let foundUpdate = false;
  let swWarning: string | null = null;

  // 1. Isolated Service Worker check — ONLY on eligible web origins; NEVER blocks remote checks!
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
        'بررسی Service Worker مرورگر با خطا مواجه شد، اما بررسی مستقیم نسخه از سرور به‌صورت مستقل انجام شد.';
    }
  }

  // 2. Check version.json mirrors with exponential backoff retry on each mirror
  const candidateUrls = buildVersionFallbackCandidates(rawSource, baseManifestUrl);
  const attemptedUrls: string[] = [];
  const endpointRecords: NetworkEndpointRecord[] = [];

  let activeUrl = baseManifestUrl;
  let usedFallback = false;
  let fallbackSourceLabel: string | null = null;
  let lastFetchRes: ResilientFetchResult = {
    ok: false,
    status: 0,
    bodyText: '',
    networkError: 'network',
    attempts: 0,
  };
  let parsedData: RemoteVersionManifest | null = null;
  let hadInvalidJson = false;

  for (let i = 0; i < candidateUrls.length; i++) {
    const candidate = candidateUrls[i];
    const label = getEndpointLabel(candidate);
    attemptedUrls.push(candidate);
    const bustUrl = new URL(candidate);
    if (!candidate.includes('api.github.com/repos/')) {
      bustUrl.searchParams.set('t', String(Date.now()));
    }
    activeUrl = candidate;

    const res = await fetchWithExponentialBackoff(bustUrl.toString(), undefined, {
      maxRetries: retryOptions?.maxRetries ?? 2,
      baseDelayMs: retryOptions?.baseDelayMs ?? 600,
      maxDelayMs: retryOptions?.maxDelayMs ?? 3000,
      onRetry: (nextAttempt, totalAttempts, delayMs) => {
        emit({
          retryStatusText: `عدم پاسخ از ${label} — تلاش مجدد (${nextAttempt} از ${totalAttempts}) پس از ${Math.round(delayMs / 100) / 10} ثانیه...`,
        });
      },
    });
    lastFetchRes = res;

    if (res.ok) {
      const parsed = parseRemoteVersionManifest(res.bodyText);
      if (parsed) {
        parsedData = parsed;
        usedFallback = i > 0;
        fallbackSourceLabel = i > 0 ? label : null;
        endpointRecords.push({
          label,
          url: candidate,
          outcome: 'ok',
          httpStatus: res.status,
          attempts: res.attempts,
        });
        break;
      }
      hadInvalidJson = true;
      endpointRecords.push({
        label,
        url: candidate,
        outcome: 'invalid-json',
        httpStatus: res.status,
        attempts: res.attempts,
      });
    } else {
      endpointRecords.push({
        label,
        url: candidate,
        outcome:
          res.networkError === 'timeout'
            ? 'timeout'
            : res.networkError === 'cors'
              ? 'cors-error'
              : res.networkError === 'network'
                ? 'network-error'
                : 'http-error',
        httpStatus: res.status > 0 ? res.status : undefined,
        attempts: res.attempts,
      });
    }
  }

  // Cache optional alternate installer mirror from version.json BEFORE checking Releases
  if (parsedData?.installers) {
    cachedManifestInstallers = {
      version: parsedData.version || LOCAL_APP_VERSION,
      builtAt: typeof parsedData.builtAt === 'string' ? parsedData.builtAt : null,
      installers: parsedData.installers,
    };
  }

  // 3. Also query GitHub Releases (serves both direct EXE/APK downloads AND version fallback if version.json failed!)
  const releaseInfo = await checkVerifiedReleaseInstallers(rawSource, retryOptions);

  // If ALL version.json mirrors failed, fall back to published GitHub Release tag_name as version source!
  if (!parsedData && releaseInfo.releaseTag && /\d+\.\d+/.test(releaseInfo.releaseTag)) {
    const cleanTagVersion = releaseInfo.releaseTag.replace(/^v/i, '').trim();
    parsedData = {
      version: cleanTagVersion,
      builtAt: releaseInfo.publishedAt ?? undefined,
      notes: [],
    };
    activeUrl = releaseInfo.checkedApiUrl;
    usedFallback = true;
    fallbackSourceLabel = 'GitHub Releases API (نسخه برچسب انتشار)';
    endpointRecords.push({
      label: 'GitHub Releases API',
      url: releaseInfo.checkedApiUrl,
      outcome: 'ok',
      httpStatus: 200,
      attempts: 1,
    });
  } else if (!parsedData) {
    endpointRecords.push({
      label: 'GitHub Releases API',
      url: releaseInfo.checkedApiUrl,
      outcome: releaseInfo.status === 'error' ? 'network-error' : 'ok',
      attempts: 1,
    });
  }

  if (!parsedData) {
    const networkReport = buildReadableNetworkReport(endpointRecords, false);

    if (hadInvalidJson && lastFetchRes.ok) {
      emit({
        checkedUrl: activeUrl,
        usedFallback: false,
        fallbackSourceLabel: null,
        attemptedUrls,
        retryStatusText: null,
        networkReport,
        lastCheckedAt: nowIso,
        status: 'error',
        errorCategory: 'json',
        httpStatus: lastFetchRes.status,
        swWarning,
        statusMessage:
          'پاسخ دریافت‌شده از نشانی version.json قالب معتبر JSON ندارد یا فاقد فیلد نسخه (version) است.',
      });
      return currentState;
    }

    if (lastFetchRes.networkError) {
      const category: UpdateErrorCategory =
        lastFetchRes.networkError === 'cors' ? 'cors' : 'network';

      emit({
        checkedUrl: activeUrl,
        usedFallback: false,
        fallbackSourceLabel: null,
        attemptedUrls,
        retryStatusText: null,
        networkReport,
        lastCheckedAt: nowIso,
        status: 'error',
        errorCategory: category,
        httpStatus: null,
        swWarning,
        statusMessage:
          lastFetchRes.networkError === 'timeout'
            ? 'پس از چند نوبت تلاش مجدد (توقف نمایی)، پاسخی از سرورهای بررسی نسخه دریافت نشد.'
            : category === 'cors'
              ? 'خطای شبکه یا محدودیت CORS هنگام بررسی نسخه نرم‌افزار در مرورگر.'
              : 'اتصال شبکه‌ای به سرورهای گیت‌هاب پس از تلاش مجدد برقرار نشد.',
      });
      return currentState;
    }

    const statusHint =
      lastFetchRes.status === 404
        ? 'فایل version.json در نشانی‌های بررسی‌شده یافت نشد (HTTP 404).'
        : lastFetchRes.status === 403
          ? 'دسترسی به سرور بررسی نسخه مجاز نبود یا با محدودیت موقت مواجه شد (HTTP 403).'
          : lastFetchRes.status >= 500
            ? `سرور میزبان با خطای داخلی مواجه شد (HTTP ${lastFetchRes.status}).`
            : `دریافت اطلاعات نسخه با پاسخ ناموفق HTTP ${lastFetchRes.status} مواجه شد.`;

    emit({
      checkedUrl: activeUrl,
      usedFallback: false,
      fallbackSourceLabel: null,
      attemptedUrls,
      retryStatusText: null,
      networkReport,
      lastCheckedAt: nowIso,
      status: 'error',
      errorCategory: 'http',
      httpStatus: lastFetchRes.status,
      swWarning,
      statusMessage: statusHint,
    });
    return currentState;
  }

  const remoteVersion = (parsedData.version || LOCAL_APP_VERSION).trim();
  const remoteBuildId = typeof parsedData.buildId === 'string' ? parsedData.buildId.trim() : null;
  const remoteBuiltAt = typeof parsedData.builtAt === 'string' ? parsedData.builtAt.trim() : null;
  const rawNotes = Array.isArray(parsedData.notes)
    ? parsedData.notes
    : Array.isArray(parsedData.changelog)
      ? parsedData.changelog
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

  const successReport = buildReadableNetworkReport(endpointRecords, true);

  if (foundUpdate || currentState.needRefresh) {
    emit({
      checkedUrl: activeUrl,
      usedFallback,
      fallbackSourceLabel,
      attemptedUrls,
      retryStatusText: null,
      networkReport: successReport,
      needRefresh: true,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'update-available',
      errorCategory: null,
      httpStatus: lastFetchRes.status || 200,
      swWarning,
      statusMessage: `نسخه جدید (${remoteVersion}) در مخزن منتشر شده است. برای دریافت آخرین تغییرات اقدام کنید.`,
    });
  } else {
    emit({
      checkedUrl: activeUrl,
      usedFallback,
      fallbackSourceLabel,
      attemptedUrls,
      retryStatusText: null,
      networkReport: successReport,
      needRefresh: false,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'up-to-date',
      errorCategory: null,
      httpStatus: lastFetchRes.status || 200,
      swWarning,
      statusMessage: `بررسی نسخه با موفقیت انجام شد؛ نرم‌افزار هم‌اکنون روی آخرین نسخه (${remoteVersion}) قرار دارد.`,
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

  if (typeof navigator !== 'undefined' && navigator.onLine === false && forceHardRefresh) {
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
