import { useEffect, useState } from 'react';
import { registerSW } from 'virtual:pwa-register';
import {
  blobToBase64Raw,
  detectRuntimePlatform,
  invokeCapacitorPlugin,
} from './platformBridge';

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
  stableWindowsAssetUrl: string;
  stableAndroidAssetUrl: string;
  releaseTag: string | null;
  releaseName: string | null;
  publishedAt: string | null;
  windowsExe: VerifiedReleaseAsset | null;
  androidApk: VerifiedReleaseAsset | null;
  message: string;
  lastCheckedAt: string | null;
}

export interface DirectInstallerTarget {
  url: string;
  fileName: string;
  isVerifiedPublished: boolean;
  source: 'github-releases' | 'alternate-mirror' | 'stable-release-asset';
  releaseTag: string | null;
  sizeBytes: number;
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

export type LocalBundleSource =
  | 'electron-ota'
  | 'electron-bundled'
  | 'android-ota'
  | 'android-bundled'
  | 'web';

export interface UpdateCompletedNotice {
  version: string;
  buildId?: string;
  updatedAt: string;
}

export interface AppUpdateState {
  currentVersion: string;
  currentBuildId: string;
  localBundleDir: string | null;
  localBundleSource: LocalBundleSource;
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
  updateProgressText: string | null;
  networkReport: NetworkDiagnosticSnapshot | null;
  needRefresh: boolean;
  offlineReady: boolean;
  swRegistered: boolean;
  swWarning: string | null;
  status: AppUpdateStatus;
  statusMessage: string;
  errorMessage: string | null;
  errorCategory: UpdateErrorCategory;
  httpStatus: number | null;
  lastCheckedAt: string | null;
  lastUpdateActionAt: string | null;
  updateCompletedNotice: UpdateCompletedNotice | null;
  releaseInstallers: VerifiedReleaseInstallers;
}

const LAST_CHECK_KEY = 'daftar-fani-last-update-check';
const CUSTOM_VERSION_URL_KEY = 'daftar-fani-github-version-url';
const UPDATE_COMPLETED_NOTICE_KEY = 'daftar-fani-update-completed-notice-v1';
const LAST_SEEN_VERSION_KEY = 'daftar-fani-last-seen-version-v1';
const LAST_UPDATE_ACTION_KEY = 'daftar-fani-last-update-action-at-v1';
export const DUPLICATE_UPDATE_GUARD_MS = 5 * 60 * 1000;

export const DEFAULT_GITHUB_OWNER = 'forog1980-star';
export const DEFAULT_GITHUB_REPO = 'Daftar-Fani-Golzar-App';
export const DEFAULT_GITHUB_REPO_FULL = `${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}`;

export const DEFAULT_WINDOWS_EXE_FILENAME = 'Daftar-Fani-Golzar-Setup.exe';
export const DEFAULT_ANDROID_APK_FILENAME = 'Daftar-Fani-Golzar.apk';

/**
 * Stable direct GitHub Releases Asset URLs (matching `.github/workflows/build-installers.yml`
 * and `electron-builder.yml`). These URLs point directly to binary assets and NEVER open an
 * HTML `/releases` listing page.
 */
export const OFFICIAL_WINDOWS_RELEASE_ASSET_URL = `https://github.com/${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}/releases/latest/download/${DEFAULT_WINDOWS_EXE_FILENAME}`;
export const OFFICIAL_ANDROID_RELEASE_ASSET_URL = `https://github.com/${DEFAULT_GITHUB_OWNER}/${DEFAULT_GITHUB_REPO}/releases/latest/download/${DEFAULT_ANDROID_APK_FILENAME}`;

export const OFFICIAL_GITHUB_APP_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/';
export const OFFICIAL_GITHUB_VERSION_URL =
  'https://forog1980-star.github.io/Daftar-Fani-Golzar-App/version.json';
export const OFFICIAL_GITHUB_RAW_VERSION_URL =
  'https://raw.githubusercontent.com/forog1980-star/Daftar-Fani-Golzar-App/main/public/version.json';
export const OFFICIAL_GITHUB_API_VERSION_URL =
  'https://api.github.com/repos/forog1980-star/Daftar-Fani-Golzar-App/contents/public/version.json';

export const DEFAULT_BACKOFF_MAX_RETRIES = 3;
export const DEFAULT_BACKOFF_BASE_DELAY_MS = 500;
export const DEFAULT_BACKOFF_MAX_DELAY_MS = 4000;
export const NETWORK_ERROR_MESSAGE = 'Network error: check connection';

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.2';
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
 * Defaults to 3 retries after the initial attempt (4 total attempts) with increasing delays:
 * `min(maxDelayMs, baseDelayMs * 2^(attempt-1))` (e.g. 500ms -> 1000ms -> 2000ms).
 */
export async function fetchWithExponentialBackoff(
  targetUrl: string,
  headers?: Record<string, string>,
  options: RetryBackoffOptions = {}
): Promise<ResilientFetchResult> {
  const maxRetries = Math.max(0, options.maxRetries ?? DEFAULT_BACKOFF_MAX_RETRIES);
  const baseDelayMs = Math.max(0, options.baseDelayMs ?? DEFAULT_BACKOFF_BASE_DELAY_MS);
  const maxDelayMs = Math.max(baseDelayMs, options.maxDelayMs ?? DEFAULT_BACKOFF_MAX_DELAY_MS);
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

/**
 * Builds canonical, stable direct GitHub Releases Asset URLs (`/releases/latest/download/<file>`)
 * for the active repository.
 */
export function buildStableReleaseAssetUrls(sourceUrl?: string): {
  repoFullName: string;
  windowsExeUrl: string;
  windowsExeName: string;
  androidApkUrl: string;
  androidApkName: string;
} {
  const { owner, repo } = extractRepoFromSourceUrl(sourceUrl);
  const repoFullName = `${owner}/${repo}`;
  return {
    repoFullName,
    windowsExeUrl: `https://github.com/${repoFullName}/releases/latest/download/${DEFAULT_WINDOWS_EXE_FILENAME}`,
    windowsExeName: DEFAULT_WINDOWS_EXE_FILENAME,
    androidApkUrl: `https://github.com/${repoFullName}/releases/latest/download/${DEFAULT_ANDROID_APK_FILENAME}`,
    androidApkName: DEFAULT_ANDROID_APK_FILENAME,
  };
}

function createInitialReleaseInstallers(sourceUrl: string): VerifiedReleaseInstallers {
  const stable = buildStableReleaseAssetUrls(sourceUrl);
  return {
    status: 'idle',
    repoFullName: stable.repoFullName,
    checkedApiUrl: `https://api.github.com/repos/${stable.repoFullName}/releases`,
    stableWindowsAssetUrl: stable.windowsExeUrl,
    stableAndroidAssetUrl: stable.androidApkUrl,
    releaseTag: null,
    releaseName: null,
    publishedAt: null,
    windowsExe: null,
    androidApk: null,
    message:
      'لینک‌های دانلود مستقیم روی آدرس پایدار فایل‌های GitHub Releases تنظیم شده‌اند. پیش از دانلود، انتشار فایل به‌صورت خودکار بررسی می‌شود.',
    lastCheckedAt: null,
  };
}

function safeReadStorage(key: string): string | null {
  if (typeof window === 'undefined' || !window.localStorage) return null;
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeWriteStorage(key: string, value: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Ignore storage quota / private mode failures
  }
}

function safeRemoveStorage(key: string): void {
  if (typeof window === 'undefined' || !window.localStorage) return;
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignore storage failures
  }
}

export function recordCompletedUpdateNotice(
  version: string,
  buildId?: string
): UpdateCompletedNotice {
  const nowIso = new Date().toISOString();
  const notice: UpdateCompletedNotice = {
    version: version || LOCAL_APP_VERSION,
    buildId: buildId || LOCAL_BUILD_ID,
    updatedAt: nowIso,
  };
  safeWriteStorage(UPDATE_COMPLETED_NOTICE_KEY, JSON.stringify(notice));
  safeWriteStorage(LAST_SEEN_VERSION_KEY, notice.version);
  safeWriteStorage(LAST_UPDATE_ACTION_KEY, nowIso);
  return notice;
}

export function getRecentUpdateElapsedMs(): {
  isRecent: boolean;
  elapsedMs: number;
  lastUpdatedAt: string | null;
} {
  const candidate =
    safeReadStorage(LAST_UPDATE_ACTION_KEY) ||
    currentState.lastUpdateActionAt ||
    currentState.updateCompletedNotice?.updatedAt ||
    null;
  if (!candidate) {
    return { isRecent: false, elapsedMs: Infinity, lastUpdatedAt: null };
  }
  const parsedMs = Date.parse(candidate);
  if (!Number.isFinite(parsedMs)) {
    return { isRecent: false, elapsedMs: Infinity, lastUpdatedAt: null };
  }
  const elapsedMs = Date.now() - parsedMs;
  if (elapsedMs >= 0 && elapsedMs < DUPLICATE_UPDATE_GUARD_MS) {
    return { isRecent: true, elapsedMs, lastUpdatedAt: candidate };
  }
  return { isRecent: false, elapsedMs, lastUpdatedAt: candidate };
}

function loadInitialUpdateCompletedNotice(): UpdateCompletedNotice | null {
  if (typeof window === 'undefined') return null;

  const hasUpdatedParam =
    typeof window.location?.search === 'string' &&
    window.location.search.includes('updated=');

  const rawSaved = safeReadStorage(UPDATE_COMPLETED_NOTICE_KEY);
  if (rawSaved) {
    try {
      const parsed = JSON.parse(rawSaved) as Partial<UpdateCompletedNotice>;
      if (parsed && typeof parsed.version === 'string' && typeof parsed.updatedAt === 'string') {
        const ageMs = Date.now() - Date.parse(parsed.updatedAt);
        // Keep notice visible until user dismisses (expire automatically after 7 days)
        if (!Number.isFinite(ageMs) || ageMs < 7 * 24 * 60 * 60 * 1000) {
          const resolvedVersion =
            compareSemver(LOCAL_APP_VERSION, parsed.version) > 0
              ? LOCAL_APP_VERSION
              : parsed.version;
          safeWriteStorage(LAST_SEEN_VERSION_KEY, resolvedVersion);
          return {
            version: resolvedVersion,
            buildId: parsed.buildId || LOCAL_BUILD_ID,
            updatedAt: parsed.updatedAt,
          };
        }
        safeRemoveStorage(UPDATE_COMPLETED_NOTICE_KEY);
      }
    } catch {
      safeRemoveStorage(UPDATE_COMPLETED_NOTICE_KEY);
    }
  }

  if (hasUpdatedParam) {
    return recordCompletedUpdateNotice(LOCAL_APP_VERSION, LOCAL_BUILD_ID);
  }

  const lastSeen = safeReadStorage(LAST_SEEN_VERSION_KEY);
  if (lastSeen && lastSeen !== LOCAL_APP_VERSION) {
    return recordCompletedUpdateNotice(LOCAL_APP_VERSION, LOCAL_BUILD_ID);
  }

  if (!lastSeen) {
    safeWriteStorage(LAST_SEEN_VERSION_KEY, LOCAL_APP_VERSION);
  }
  return null;
}

export function dismissUpdateCompletedNotice(): void {
  safeRemoveStorage(UPDATE_COMPLETED_NOTICE_KEY);
  emit({ updateCompletedNotice: null });
}

const initialSavedUrl = loadSavedVersionUrl();
const initialUpdateCompletedNotice = loadInitialUpdateCompletedNotice();
const initialLastUpdateActionAt =
  safeReadStorage(LAST_UPDATE_ACTION_KEY) || initialUpdateCompletedNotice?.updatedAt || null;

let currentState: AppUpdateState = {
  currentVersion: LOCAL_APP_VERSION,
  currentBuildId: LOCAL_BUILD_ID,
  localBundleDir: null,
  localBundleSource:
    detectRuntimePlatform() === 'electron'
      ? 'electron-bundled'
      : detectRuntimePlatform() === 'android'
        ? 'android-bundled'
        : 'web',
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
  updateProgressText: null,
  networkReport: null,
  needRefresh: false,
  offlineReady: false,
  swRegistered: false,
  swWarning: null,
  status: 'idle',
  statusMessage: '',
  errorMessage: null,
  errorCategory: null,
  httpStatus: null,
  lastCheckedAt: safeReadStorage(LAST_CHECK_KEY),
  lastUpdateActionAt: initialLastUpdateActionAt,
  updateCompletedNotice: initialUpdateCompletedNotice,
  releaseInstallers: createInitialReleaseInstallers(initialSavedUrl),
};

const listeners = new Set<() => void>();

export function getAppUpdateState(): AppUpdateState {
  return currentState;
}

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
    const isGitHubHost = parsed.hostname === 'github.com' || parsed.hostname.endsWith('.github.com');
    if (requireGitHubHost && !isGitHubHost) return false;
    // Reject generic HTML pages like /releases, /releases/latest, /releases/tag/*, or /blob/*
    if (
      /\/releases\/?$/i.test(parsed.pathname) ||
      /\/releases\/latest\/?$/i.test(parsed.pathname) ||
      /\/releases\/tag\//i.test(parsed.pathname)
    ) {
      return false;
    }
    if (
      isGitHubHost &&
      !/\/releases\/(latest\/)?download\//i.test(parsed.pathname)
    ) {
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
  const stableWindowsAssetUrl = `https://github.com/${repoFullName}/releases/latest/download/${DEFAULT_WINDOWS_EXE_FILENAME}`;
  const stableAndroidAssetUrl = `https://github.com/${repoFullName}/releases/latest/download/${DEFAULT_ANDROID_APK_FILENAME}`;
  const mirrorTag = mirrorConfig?.version ? `v${mirrorConfig.version.replace(/^v/i, '')}` : 'mirror';
  const mirrorExe = mirrorConfig
    ? buildMirrorAssetIfValid(
        mirrorConfig.installers.windowsExeUrl,
        mirrorConfig.installers.windowsExeName || DEFAULT_WINDOWS_EXE_FILENAME,
        mirrorConfig.installers.windowsExeSizeBytes,
        '.exe',
        mirrorTag,
        mirrorConfig.builtAt
      )
    : null;
  const mirrorApk = mirrorConfig
    ? buildMirrorAssetIfValid(
        mirrorConfig.installers.androidApkUrl,
        mirrorConfig.installers.androidApkName || DEFAULT_ANDROID_APK_FILENAME,
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
        stableWindowsAssetUrl,
        stableAndroidAssetUrl,
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
      stableWindowsAssetUrl,
      stableAndroidAssetUrl,
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
      stableWindowsAssetUrl,
      stableAndroidAssetUrl,
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
      stableWindowsAssetUrl,
      stableAndroidAssetUrl,
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
      stableWindowsAssetUrl,
      stableAndroidAssetUrl,
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
    stableWindowsAssetUrl,
    stableAndroidAssetUrl,
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
 * Resolves the direct binary download target for Windows (EXE) or Android (APK).
 * Always returns a direct binary GitHub Releases Asset URL (verified `browser_download_url`
 * when published, or the canonical stable `/releases/latest/download/<filename>` Asset URL)
 * and NEVER returns a generic `/releases` HTML page.
 */
export function getDirectInstallerTarget(
  releaseInfo: VerifiedReleaseInstallers,
  platform: 'windows' | 'android'
): DirectInstallerTarget {
  const verified = platform === 'windows' ? releaseInfo.windowsExe : releaseInfo.androidApk;
  if (verified) {
    return {
      url: verified.downloadUrl,
      fileName: verified.name,
      isVerifiedPublished: true,
      source: verified.source,
      releaseTag: verified.releaseTag,
      sizeBytes: verified.sizeBytes,
    };
  }
  return platform === 'windows'
    ? {
        url: releaseInfo.stableWindowsAssetUrl,
        fileName: DEFAULT_WINDOWS_EXE_FILENAME,
        isVerifiedPublished: false,
        source: 'stable-release-asset',
        releaseTag: null,
        sizeBytes: 0,
      }
    : {
        url: releaseInfo.stableAndroidAssetUrl,
        fileName: DEFAULT_ANDROID_APK_FILENAME,
        isVerifiedPublished: false,
        source: 'stable-release-asset',
        releaseTag: null,
        sizeBytes: 0,
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
  const stable = buildStableReleaseAssetUrls(sourceUrl);
  const repoFullName = stable.repoFullName;
  const checkedApiUrl = `https://api.github.com/repos/${repoFullName}/releases`;
  const nowIso = new Date().toISOString();

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineState: VerifiedReleaseInstallers = {
      status: 'offline',
      repoFullName,
      checkedApiUrl,
      stableWindowsAssetUrl: stable.windowsExeUrl,
      stableAndroidAssetUrl: stable.androidApkUrl,
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
      stableWindowsAssetUrl: stable.windowsExeUrl,
      stableAndroidAssetUrl: stable.androidApkUrl,
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
      stableWindowsAssetUrl: stable.windowsExeUrl,
      stableAndroidAssetUrl: stable.androidApkUrl,
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
      stableWindowsAssetUrl: stable.windowsExeUrl,
      stableAndroidAssetUrl: stable.androidApkUrl,
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
      stableWindowsAssetUrl: stable.windowsExeUrl,
      stableAndroidAssetUrl: stable.androidApkUrl,
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

/**
 * Resolves the active local app version directly from the installed native app directory:
 * - Windows Electron: reads version.json from D:\Daftar-Fani-Golzar\AppBundle\current (or bundled dist)
 * - Android Capacitor: reads Capacitor WebView serverBasePath & DATA/app-bundle/active-meta.json
 * - Web / Chrome PWA: uses the active build version
 */
export async function refreshNativeLocalVersionInfo(): Promise<{
  version: string;
  buildId: string;
  localBundleDir: string | null;
  localBundleSource: LocalBundleSource;
}> {
  const platform = detectRuntimePlatform();

  if (platform === 'electron' && typeof window !== 'undefined' && window.desktopBridge?.getLocalVersionInfo) {
    try {
      const info = await window.desktopBridge.getLocalVersionInfo();
      if (info?.ok) {
        const version = info.version || LOCAL_APP_VERSION;
        const buildId = info.buildId || LOCAL_BUILD_ID;
        const localBundleSource: LocalBundleSource = info.isOtaBundle
          ? 'electron-ota'
          : 'electron-bundled';
        emit({
          currentVersion: version,
          currentBuildId: buildId,
          localBundleDir: info.activeDistDir || null,
          localBundleSource,
        });
        return { version, buildId, localBundleDir: info.activeDistDir || null, localBundleSource };
      }
    } catch {
      // Fall back to compiled constants
    }
  }

  if (platform === 'android' && typeof window !== 'undefined' && window.Capacitor) {
    try {
      const basePathRes = await invokeCapacitorPlugin<{ path?: string }>(
        'WebView',
        'getServerBasePath',
        {}
      );
      const serverBasePath = typeof basePathRes?.path === 'string' && basePathRes.path.trim()
        ? basePathRes.path.trim()
        : null;
      const isOta = Boolean(serverBasePath && serverBasePath.includes('app-bundle'));
      let version = LOCAL_APP_VERSION;
      let buildId = LOCAL_BUILD_ID;

      try {
        const metaRes = await invokeCapacitorPlugin<{ data?: string }>('Filesystem', 'readFile', {
          path: 'app-bundle/active-meta.json',
          directory: 'DATA',
          encoding: 'utf8',
        });
        if (metaRes?.data && isOta) {
          const parsed = JSON.parse(metaRes.data) as { version?: string; buildId?: string };
          if (parsed.version && compareSemver(parsed.version, LOCAL_APP_VERSION) >= 0) {
            version = parsed.version;
            if (parsed.buildId) buildId = parsed.buildId;
          }
        }
      } catch {
        // No OTA metadata yet; using bundled APK version
      }

      const localBundleSource: LocalBundleSource = isOta ? 'android-ota' : 'android-bundled';
      const localBundleDir = serverBasePath || 'assets/public (حافظه داخلی اپلیکیشن اندروید)';
      emit({
        currentVersion: version,
        currentBuildId: buildId,
        localBundleDir,
        localBundleSource,
      });
      return { version, buildId, localBundleDir, localBundleSource };
    } catch {
      // Fall back to compiled constants
    }
  }

  return {
    version: currentState.currentVersion || LOCAL_APP_VERSION,
    buildId: currentState.currentBuildId || LOCAL_BUILD_ID,
    localBundleDir: currentState.localBundleDir,
    localBundleSource: currentState.localBundleSource,
  };
}

/**
 * Resolves the GitHub Pages base URL used to download OTA native bundles (`native-bundle/update-manifest.json`).
 */
export function resolveUpdateBundleBaseUrl(customUrl?: string): string {
  const trimmed = (customUrl || '').trim();
  if (trimmed) {
    try {
      const parsed = new URL(trimmed);
      if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
        const cleanPath = parsed.pathname.replace(/\/version\.json$/i, '/');
        return `${parsed.origin}${cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`}`;
      }
      if (parsed.hostname.endsWith('.github.io')) {
        const cleanPath = parsed.pathname.replace(/\/version\.json$/i, '/');
        return `${parsed.origin}${cleanPath.endsWith('/') ? cleanPath : `${cleanPath}/`}`;
      }
    } catch {
      // Fall through to repo extraction
    }
  }
  const { owner, repo } = extractRepoFromSourceUrl(trimmed);
  return `https://${owner}.github.io/${repo}/`;
}

export async function checkForAppUpdate(
  overrideUrl?: string,
  retryOptions?: RetryBackoffOptions
): Promise<AppUpdateState> {
  const localInfo = await refreshNativeLocalVersionInfo();
  const rawSource = overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl;
  const validation = validateVersionSourceUrl(rawSource);

  if (!validation.valid) {
    const errText = validation.error || 'نشانی فایل version.json نامعتبر است.';
    emit({
      checkedUrl: validation.resolvedUrl,
      status: 'error',
      errorCategory: 'invalid-url',
      errorMessage: errText,
      httpStatus: null,
      swWarning: null,
      retryStatusText: null,
      updateProgressText: null,
      networkReport: null,
      statusMessage: errText,
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
      errorMessage: NETWORK_ERROR_MESSAGE,
      httpStatus: null,
      retryStatusText: null,
      updateProgressText: null,
      networkReport: offlineReport,
      statusMessage: NETWORK_ERROR_MESSAGE,
    });
    return currentState;
  }

  emit({
    checkedUrl: baseManifestUrl,
    status: 'checking',
    errorCategory: null,
    errorMessage: null,
    httpStatus: null,
    swWarning: null,
    retryStatusText: null,
    updateProgressText: null,
    networkReport: null,
    statusMessage: 'در حال اتصال به گیت‌هاب و بررسی آخرین نسخه نرم‌افزار...',
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
      maxRetries: retryOptions?.maxRetries ?? DEFAULT_BACKOFF_MAX_RETRIES,
      baseDelayMs: retryOptions?.baseDelayMs ?? DEFAULT_BACKOFF_BASE_DELAY_MS,
      maxDelayMs: retryOptions?.maxDelayMs ?? DEFAULT_BACKOFF_MAX_DELAY_MS,
      onRetry: (nextAttempt, totalAttempts, delayMs) => {
        retryOptions?.onRetry?.(nextAttempt, totalAttempts, delayMs);
        emit({
          retryStatusText: `عدم پاسخ از ${label} — تلاش مجدد (${nextAttempt - 1} از ${totalAttempts - 1}) پس از ${Math.round(delayMs / 100) / 10} ثانیه...`,
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

  // 3. Only query GitHub Releases as a last-resort version fallback if ALL version.json mirrors failed
  if (!parsedData) {
    const releaseInfo = await checkVerifiedReleaseInstallers(rawSource, retryOptions);
    if (releaseInfo.releaseTag && /\d+\.\d+/.test(releaseInfo.releaseTag)) {
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
    } else {
      endpointRecords.push({
        label: 'GitHub Releases API',
        url: releaseInfo.checkedApiUrl,
        outcome: releaseInfo.status === 'error' ? 'network-error' : 'ok',
        attempts: 1,
      });
    }
  }

  if (!parsedData) {
    const networkReport = buildReadableNetworkReport(endpointRecords, false);

    if (hadInvalidJson && lastFetchRes.ok) {
      const jsonErr =
        'پاسخ دریافت‌شده از نشانی version.json قالب معتبر JSON ندارد یا فاقد فیلد نسخه (version) است.';
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
        errorMessage: jsonErr,
        httpStatus: lastFetchRes.status,
        swWarning,
        statusMessage: jsonErr,
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
        errorMessage: NETWORK_ERROR_MESSAGE,
        httpStatus: null,
        swWarning,
        statusMessage: NETWORK_ERROR_MESSAGE,
      });
      return currentState;
    }

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
      errorMessage: NETWORK_ERROR_MESSAGE,
      httpStatus: lastFetchRes.status,
      swWarning,
      statusMessage: NETWORK_ERROR_MESSAGE,
    });
    return currentState;
  }

  const activeLocalVersion = localInfo.version || LOCAL_APP_VERSION;
  const activeLocalBuildId = localInfo.buildId || LOCAL_BUILD_ID;
  const remoteVersion = (parsedData.version || activeLocalVersion).trim();
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

  if (remoteVersion && compareSemver(remoteVersion, activeLocalVersion) > 0) {
    foundUpdate = true;
  } else if (
    remoteBuildId &&
    remoteBuildId !== 'dev-local' &&
    activeLocalBuildId !== 'dev-local' &&
    remoteBuildId !== activeLocalBuildId
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
      errorMessage: null,
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
      errorMessage: null,
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
      errorMessage: NETWORK_ERROR_MESSAGE,
      statusMessage: NETWORK_ERROR_MESSAGE,
    });
    return;
  }

  emit({
    status: 'updating',
    errorCategory: null,
    errorMessage: null,
    statusMessage: 'در حال دریافت آخرین تغییرات و به‌روزرسانی محلی (بدون تغییر در اطلاعات شما)...',
  });

  try {
    const notice = recordCompletedUpdateNotice(
      currentState.remoteVersion || currentState.currentVersion || LOCAL_APP_VERSION,
      currentState.remoteBuildId || currentState.currentBuildId || LOCAL_BUILD_ID
    );
    emit({
      updateCompletedNotice: notice,
      lastUpdateActionAt: notice.updatedAt,
    });

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

function isTextBundleFile(relPath: string): boolean {
  return /\.(html?|js|mjs|css|json|svg|txt|webmanifest|xml)$/i.test(relPath);
}

async function fetchBinaryWithBackoff(
  url: string,
  maxRetries = DEFAULT_BACKOFF_MAX_RETRIES
): Promise<Blob | null> {
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const controller = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = controller ? setTimeout(() => controller.abort(), 15000) : null;
    try {
      const res = await fetch(url, { cache: 'no-store', signal: controller?.signal });
      if (res.ok) {
        return await res.blob();
      }
      if (res.status === 404 || res.status === 403 || res.status === 400) {
        return null;
      }
    } catch {
      // Retry transient network failure
    } finally {
      if (timer) clearTimeout(timer);
    }
    if (attempt < maxRetries) {
      const delayMs = Math.min(
        DEFAULT_BACKOFF_MAX_DELAY_MS,
        DEFAULT_BACKOFF_BASE_DELAY_MS * Math.pow(2, attempt)
      );
      await sleep(delayMs);
    }
  }
  return null;
}

/**
 * Downloads the latest relative web bundle directly into Android's local app directory
 * (`DATA/app-bundle/v_<buildId>`) and switches Capacitor's built-in WebView serverBasePath
 * to boot the updated bundle immediately on `https://localhost` (100% preserving IndexedDB).
 */
export async function applyAndroidNativeBundleUpdate(
  baseUrl: string
): Promise<{ ok: boolean; version?: string; filesCount?: number; error?: string }> {
  const normalizedBase = baseUrl.endsWith('/') ? baseUrl : `${baseUrl}/`;
  const candidateBases = [`${normalizedBase}native-bundle/`, normalizedBase];

  let manifest: { version?: string; buildId?: string; builtAt?: string; files?: string[] } | null = null;
  let activeBase = '';

  for (const candidateBase of candidateBases) {
    const mRes = await fetchWithExponentialBackoff(
      `${candidateBase}update-manifest.json?t=${Date.now()}`
    );
    if (mRes.ok) {
      try {
        const parsed = JSON.parse(mRes.bodyText) as {
          version?: string;
          buildId?: string;
          builtAt?: string;
          files?: string[];
        };
        if (parsed && Array.isArray(parsed.files) && parsed.files.includes('index.html')) {
          manifest = parsed;
          activeBase = candidateBase;
          break;
        }
      } catch {
        // Try next candidate
      }
    }
  }

  if (!manifest || !activeBase || !manifest.files) {
    return { ok: false, error: NETWORK_ERROR_MESSAGE };
  }

  const safeFiles = manifest.files.filter(
    (f) =>
      typeof f === 'string' &&
      f.length > 0 &&
      !f.includes('..') &&
      !f.startsWith('/') &&
      !f.includes('\\')
  );
  if (!safeFiles.includes('index.html') || safeFiles.length > 250) {
    return { ok: false, error: 'فهرست فایل‌های به‌روزرسانی اندروید نامعتبر است.' };
  }

  const safeTag = String(manifest.buildId || manifest.version || Date.now()).replace(
    /[^a-zA-Z0-9._-]/g,
    '_'
  );
  const bundleDirRel = `app-bundle/v_${safeTag}`;

  for (let idx = 0; idx < safeFiles.length; idx++) {
    const rel = safeFiles[idx];
    emit({
      status: 'updating',
      updateProgressText: `در حال دریافت و ذخیره فایل ${idx + 1} از ${safeFiles.length} در دایرکتوری محلی برنامه...`,
    });

    const fileUrl = `${activeBase}${rel.split('/').map(encodeURIComponent).join('/')}?t=${Date.now()}`;
    if (isTextBundleFile(rel)) {
      const textRes = await fetchWithExponentialBackoff(fileUrl);
      if (!textRes.ok) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      let content = textRes.bodyText;
      if (rel === 'index.html') {
        if (!/<html/i.test(content) && !/<!doctype/i.test(content)) {
          return { ok: false, error: 'فایل index.html دریافت‌شده معتبر نیست.' };
        }
        content = content.replace(/(["'(])\/Daftar-Fani-Golzar-App\//gi, '$1./');
      }
      const written = await invokeCapacitorPlugin('Filesystem', 'writeFile', {
        path: `${bundleDirRel}/${rel}`,
        data: content,
        directory: 'DATA',
        encoding: 'utf8',
        recursive: true,
      });
      if (written === null) {
        return { ok: false, error: 'دسترسی نوشتن در دایرکتوری محلی اپلیکیشن اندروید فعال نیست.' };
      }
    } else {
      const blob = await fetchBinaryWithBackoff(fileUrl);
      if (!blob) {
        return { ok: false, error: NETWORK_ERROR_MESSAGE };
      }
      const b64 = await blobToBase64Raw(blob);
      const written = await invokeCapacitorPlugin('Filesystem', 'writeFile', {
        path: `${bundleDirRel}/${rel}`,
        data: b64,
        directory: 'DATA',
        recursive: true,
      });
      if (written === null) {
        return { ok: false, error: 'دسترسی نوشتن در دایرکتوری محلی اپلیکیشن اندروید فعال نیست.' };
      }
    }
  }

  // Persist active metadata for local version inspection
  await invokeCapacitorPlugin('Filesystem', 'writeFile', {
    path: 'app-bundle/active-meta.json',
    data: JSON.stringify(
      {
        version: manifest.version || LOCAL_APP_VERSION,
        buildId: manifest.buildId || safeTag,
        builtAt: manifest.builtAt || new Date().toISOString(),
        bundleDir: bundleDirRel,
      },
      null,
      2
    ),
    directory: 'DATA',
    encoding: 'utf8',
    recursive: true,
  });

  const uriRes = await invokeCapacitorPlugin<{ uri?: string }>('Filesystem', 'getUri', {
    path: bundleDirRel,
    directory: 'DATA',
  });
  const nativePath = uriRes?.uri ? decodeURIComponent(uriRes.uri.replace(/^file:\/\//i, '')) : '';
  if (!nativePath) {
    return { ok: false, error: 'مسیر دایرکتوری محلی بسته جدید اندروید قابل خواندن نبود.' };
  }

  emit({
    status: 'updating',
    updateProgressText: 'در حال فعال‌سازی نسخه جدید روی حافظه داخلی اپلیکیشن...',
  });

  const prevNoticeRaw = safeReadStorage(UPDATE_COMPLETED_NOTICE_KEY);
  const prevActionAtRaw = safeReadStorage(LAST_UPDATE_ACTION_KEY);
  // Persist the post-update notice BEFORE switching serverBasePath because Capacitor reloads the WebView immediately
  recordCompletedUpdateNotice(
    manifest.version || LOCAL_APP_VERSION,
    manifest.buildId || safeTag
  );

  const switched = await invokeCapacitorPlugin('WebView', 'setServerBasePath', {
    path: nativePath,
  });
  if (switched === null) {
    if (prevNoticeRaw) safeWriteStorage(UPDATE_COMPLETED_NOTICE_KEY, prevNoticeRaw);
    else safeRemoveStorage(UPDATE_COMPLETED_NOTICE_KEY);
    if (prevActionAtRaw) safeWriteStorage(LAST_UPDATE_ACTION_KEY, prevActionAtRaw);
    else safeRemoveStorage(LAST_UPDATE_ACTION_KEY);
    return { ok: false, error: 'پل WebView اندروید برای تغییر مسیر نسخه محلی در دسترس نیست.' };
  }
  await invokeCapacitorPlugin('WebView', 'persistServerBasePath', {});

  return {
    ok: true,
    version: manifest.version || LOCAL_APP_VERSION,
    filesCount: safeFiles.length,
  };
}

/**
 * Direct, zero-confirmation native updater:
 * Immediately downloads `update-manifest.json` from GitHub Pages (with exponential backoff)
 * and atomically replaces the local app bundle on installed Windows (Electron) and Android (Capacitor)
 * apps without extra dialogs or intermediate version-gate stops.
 * On Web/Chrome PWA, clears shell caches and reloads the latest build immediately.
 * IMPORTANT: Never touches IndexedDB (`daftar-fani-golzar-db`) or user records.
 */
export async function syncNativeUpdateManifestNow(overrideUrl?: string): Promise<AppUpdateState> {
  if (overrideUrl !== undefined) {
    setCustomVersionSourceUrl(overrideUrl);
  }

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    const offlineReport = buildReadableNetworkReport([], false);
    emit({
      status: 'offline',
      errorCategory: 'offline',
      errorMessage: NETWORK_ERROR_MESSAGE,
      updateProgressText: null,
      networkReport: offlineReport,
      statusMessage: NETWORK_ERROR_MESSAGE,
    });
    return currentState;
  }

  const platform = detectRuntimePlatform();
  const bundleBaseUrl = resolveUpdateBundleBaseUrl(
    overrideUrl !== undefined ? overrideUrl : currentState.versionSourceUrl
  );

  if (platform === 'web') {
    await applyAppUpdate(true);
    return currentState;
  }

  emit({
    status: 'updating',
    errorCategory: null,
    errorMessage: null,
    retryStatusText: null,
    checkedUrl: `${bundleBaseUrl}native-bundle/update-manifest.json`,
    updateProgressText:
      platform === 'electron'
        ? 'در حال دریافت مستقیم update-manifest.json و جایگزینی فایل‌های محلی ویندوز...'
        : 'در حال دریافت مستقیم update-manifest.json و جایگزینی فایل‌های محلی اندروید...',
    statusMessage: 'در حال دریافت بسته جدید و به‌روزرسانی خودکار نرم‌افزار بدون نیاز به تأیید اضافی...',
  });

  if (platform === 'electron') {
    if (typeof window !== 'undefined' && typeof window.desktopBridge?.applyBundleUpdate === 'function') {
      const res = await window.desktopBridge.applyBundleUpdate({ baseUrl: bundleBaseUrl });
      if (res.ok) {
        const nextVersion = res.version || currentState.currentVersion;
        const nextBuildId = res.buildId || currentState.currentBuildId;
        const notice = recordCompletedUpdateNotice(nextVersion, nextBuildId);
        emit({
          status: 'updating',
          currentVersion: nextVersion,
          currentBuildId: nextBuildId,
          remoteVersion: nextVersion,
          localBundleDir: res.activeDistDir || currentState.localBundleDir,
          localBundleSource: 'electron-ota',
          needRefresh: false,
          lastCheckedAt: notice.updatedAt,
          lastUpdateActionAt: notice.updatedAt,
          updateCompletedNotice: notice,
          updateProgressText: null,
          statusMessage: `فایل‌های نسخه ${nextVersion} مستقیماً در دایرکتوری محلی ویندوز جایگزین شد؛ در حال بارگذاری مجدد...`,
        });
        return currentState;
      }

      const networkReport = buildReadableNetworkReport(
        [
          {
            label: 'فایل مانیفست به‌روزرسانی (update-manifest.json)',
            url: `${bundleBaseUrl}native-bundle/update-manifest.json`,
            outcome: 'network-error',
            attempts: DEFAULT_BACKOFF_MAX_RETRIES + 1,
          },
        ],
        false
      );
      emit({
        status: 'error',
        errorCategory: 'network',
        errorMessage: res.error || NETWORK_ERROR_MESSAGE,
        updateProgressText: null,
        networkReport,
        statusMessage: res.error || NETWORK_ERROR_MESSAGE,
      });
      return currentState;
    }

    emit({
      status: 'error',
      errorCategory: 'network',
      errorMessage:
        'نسخه فعلی نصاب ویندوز قدیمی است و پل جایگزینی مستقیم دایرکتوری را ندارد. لطفاً یک‌بار آخرین نسخه نصاب ویندوز را نصب کنید.',
      updateProgressText: null,
      statusMessage: 'نسخه فعلی نصاب ویندوز قدیمی است و پل جایگزینی مستقیم دایرکتوری را ندارد.',
    });
    return currentState;
  }

  // Android Capacitor runtime
  const androidRes = await applyAndroidNativeBundleUpdate(bundleBaseUrl);
  if (androidRes.ok) {
    const nextVersion = androidRes.version || currentState.currentVersion;
    const notice = recordCompletedUpdateNotice(nextVersion, currentState.currentBuildId);
    emit({
      status: 'updating',
      currentVersion: nextVersion,
      remoteVersion: nextVersion,
      localBundleSource: 'android-ota',
      needRefresh: false,
      lastCheckedAt: notice.updatedAt,
      lastUpdateActionAt: notice.updatedAt,
      updateCompletedNotice: notice,
      updateProgressText: null,
      statusMessage: `فایل‌های نسخه ${nextVersion} مستقیماً در دایرکتوری داخلی اندروید جایگزین شد؛ در حال بارگذاری مجدد...`,
    });
    return currentState;
  }

  const androidReport = buildReadableNetworkReport(
    [
      {
        label: 'فایل مانیفست به‌روزرسانی (update-manifest.json)',
        url: `${bundleBaseUrl}native-bundle/update-manifest.json`,
        outcome: 'network-error',
        attempts: DEFAULT_BACKOFF_MAX_RETRIES + 1,
      },
    ],
    false
  );
  emit({
    status: 'error',
    errorCategory: 'network',
    errorMessage: androidRes.error || NETWORK_ERROR_MESSAGE,
    updateProgressText: null,
    networkReport: androidReport,
    statusMessage: androidRes.error || NETWORK_ERROR_MESSAGE,
  });
  return currentState;
}

/**
 * Unified single-click updater across ALL runtimes:
 * - Installed Windows Electron & Android Capacitor APK -> immediately runs `syncNativeUpdateManifestNow`
 *   to download `update-manifest.json` and replace local files with zero extra confirmation
 * - Online & Offline Chrome PWA -> checks `version.json` and refreshes shell cache when newer
 */
export async function applyUnifiedAppUpdate(overrideUrl?: string): Promise<AppUpdateState> {
  const platform = detectRuntimePlatform();
  if (platform === 'electron' || platform === 'android') {
    return syncNativeUpdateManifestNow(overrideUrl);
  }

  const checked = await checkForAppUpdate(overrideUrl);
  if (checked.status === 'offline' || checked.status === 'error') {
    return checked;
  }

  await applyAppUpdate(true);
  return currentState;
}

export function useAppUpdater() {
  const [state, setState] = useState<AppUpdateState>(currentState);

  useEffect(() => {
    const onChange = () => setState(currentState);
    listeners.add(onChange);
    void refreshNativeLocalVersionInfo();
    if (typeof window !== 'undefined' && window.location.search.includes('updated=')) {
      const cleanUrl = new URL(window.location.href);
      cleanUrl.searchParams.delete('updated');
      const preservedState =
        window.history.state && typeof window.history.state === 'object'
          ? window.history.state
          : {};
      window.history.replaceState(preservedState, '', cleanUrl.toString());
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
    syncManifestNow: syncNativeUpdateManifestNow,
    runUnifiedUpdate: applyUnifiedAppUpdate,
    refreshLocalVersion: refreshNativeLocalVersionInfo,
    dismissUpdateNotice: dismissUpdateCompletedNotice,
    getRecentUpdateInfo: getRecentUpdateElapsedMs,
    setCustomSourceUrl: setCustomVersionSourceUrl,
  };
}
