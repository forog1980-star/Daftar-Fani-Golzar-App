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
  usedFallback: boolean;
  attemptedUrls: string[];
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

interface ResilientFetchResult {
  ok: boolean;
  status: number;
  bodyText: string;
  networkError?: 'timeout' | 'cors' | 'network';
}

async function resilientFetchText(
  targetUrl: string,
  headers?: Record<string, string>
): Promise<ResilientFetchResult> {
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
  const timeoutId = controller ? setTimeout(() => controller.abort(), 12000) : null;
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

export const LOCAL_APP_VERSION =
  typeof __APP_VERSION__ !== 'undefined' ? __APP_VERSION__ : '1.4.1';
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
  usedFallback: false,
  attemptedUrls: [],
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

  // If user enters a GitHub Pages root URL (e.g. https://forog1980-star.github.io/Daftar-Fani-Golzar-App/), append /version.json
  const ghPagesRootMatch = trimmed.match(
    /^https?:\/\/([^./\s]+)\.github\.io\/([^/\s#?]+)\/?$/i
  );
  if (ghPagesRootMatch) {
    const [, owner, repo] = ghPagesRootMatch;
    return `https://${owner}.github.io/${repo}/version.json`;
  }

  return trimmed;
}

/**
 * Builds an ordered, deduplicated fallback chain of version.json mirrors
 * (GitHub Pages -> raw.githubusercontent.com -> GitHub Contents API) so temporary
 * DNS/ISP/CDN issues on one endpoint automatically fail over to healthy mirrors.
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

function parseRemoteVersionManifest(bodyText: string): RemoteVersionManifest | null {
  try {
    const parsed = JSON.parse(bodyText) as Record<string, unknown> | null;
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return null;
    }

    // Handle GitHub Contents API envelope ({ encoding: 'base64', content: '...' })
    if (
      parsed.encoding === 'base64' &&
      typeof parsed.content === 'string' &&
      typeof parsed.version !== 'string'
    ) {
      const decoded = decodeBase64Utf8(parsed.content);
      const inner = JSON.parse(decoded) as RemoteVersionManifest | null;
      if (inner && typeof inner === 'object' && !Array.isArray(inner) && typeof inner.version === 'string' && inner.version.trim()) {
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

  // Capacitor Android may use https://localhost; it is still a packaged native app, not a PWA.
  if (window.desktopBridge?.isDesktop || window.Capacitor?.isNativePlatform?.()) return false;

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
    return (
      parsed.protocol === 'https:' &&
      parsed.hostname === 'github.com' &&
      parsed.pathname.toLowerCase().includes('/releases/download/')
    );
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
        'هنوز هیچ Release رسمی حاوی فایل نصبی منتشر نشده است. فایل‌های GitHub Actions جایگزین Release مستقیم نیستند.',
      lastCheckedAt: checkedAt,
    };
  }

  // Keep EXE and APK from the SAME release. Never mix installers from different versions.
  const orderedReleases = [
    ...publishedReleases.filter((release) => !release.prerelease),
    ...publishedReleases.filter((release) => Boolean(release.prerelease)),
  ];

  const candidates = orderedReleases.map((release) => {
    const assets = Array.isArray(release.assets) ? release.assets : [];
    const tag = typeof release.tag_name === 'string' && release.tag_name.trim()
      ? release.tag_name.trim()
      : 'release';
    const publishedAt = typeof release.published_at === 'string' ? release.published_at : null;
    const isPrerelease = Boolean(release.prerelease);

    const exeCandidates = assets.filter(
      (asset) =>
        typeof asset?.name === 'string' &&
        asset.name.toLowerCase().endsWith('.exe') &&
        !asset.name.toLowerCase().endsWith('.blockmap') &&
        isValidDirectAssetUrl(asset.browser_download_url) &&
        typeof asset.size === 'number' &&
        asset.size > 0
    );
    const preferredExe =
      exeCandidates.find((asset) => /setup|installer/i.test(asset.name || '')) ?? exeCandidates[0];

    const apkCandidates = assets.filter(
      (asset) =>
        typeof asset?.name === 'string' &&
        asset.name.toLowerCase().endsWith('.apk') &&
        isValidDirectAssetUrl(asset.browser_download_url) &&
        typeof asset.size === 'number' &&
        asset.size > 0
    );
    const preferredApk = apkCandidates[0];

    const windowsExe: VerifiedReleaseAsset | null =
      preferredExe?.name && preferredExe.browser_download_url
        ? {
            name: preferredExe.name,
            downloadUrl: preferredExe.browser_download_url,
            sizeBytes: preferredExe.size || 0,
            releaseTag: tag,
            publishedAt,
            isPrerelease,
          }
        : null;

    const androidApk: VerifiedReleaseAsset | null =
      preferredApk?.name && preferredApk.browser_download_url
        ? {
            name: preferredApk.name,
            downloadUrl: preferredApk.browser_download_url,
            sizeBytes: preferredApk.size || 0,
            releaseTag: tag,
            publishedAt,
            isPrerelease,
          }
        : null;

    return { release, tag, publishedAt, windowsExe, androidApk };
  });

  const selected = candidates.find((candidate) => candidate.windowsExe && candidate.androidApk)
    ?? candidates.find((candidate) => candidate.windowsExe || candidate.androidApk);

  if (!selected) {
    const latest = orderedReleases[0];
    const releaseTag = typeof latest?.tag_name === 'string' ? latest.tag_name : null;
    const releaseName =
      typeof latest?.name === 'string' && latest.name.trim() ? latest.name.trim() : releaseTag;
    return {
      status: 'no-release',
      repoFullName,
      checkedApiUrl,
      releaseTag,
      releaseName,
      publishedAt: typeof latest?.published_at === 'string' ? latest.published_at : null,
      windowsExe: null,
      androidApk: null,
      message: 'Release وجود دارد، اما فایل مستقیم معتبر EXE یا APK در آن پیدا نشد.',
      lastCheckedAt: checkedAt,
    };
  }

  const { release, tag: releaseTag, publishedAt, windowsExe, androidApk } = selected;
  const releaseName =
    typeof release.name === 'string' && release.name.trim() ? release.name.trim() : releaseTag;

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
      message: `فایل‌های نصبی ویندوز و اندروید هر دو از Release یکسان (${releaseTag}) آماده دریافت هستند.`,
      lastCheckedAt: checkedAt,
    };
  }

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
      ? 'فایل نصبی ویندوز منتشر شده است، اما APK متناظر در همین Release وجود ندارد.'
      : 'فایل نصبی اندروید منتشر شده است، اما EXE متناظر در همین Release وجود ندارد.',
    lastCheckedAt: checkedAt,
  };
}

/**
 * Queries GitHub Releases API to verify real published EXE / APK direct download URLs.
 * Read-only, never fabricates download URLs, never leaks sensitive paths.
 */
export async function checkVerifiedReleaseInstallers(
  overrideUrl?: string,
  expectedVersion?: string
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

  const fetchRes = await resilientFetchText(checkedApiUrl, {
    Accept: 'application/vnd.github+json',
  });

  if (fetchRes.networkError) {
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
          ? 'زمان انتظار برای دریافت فهرست Releases گیت‌هاب به پایان رسید. اتصال اینترنت را بررسی کنید.'
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
    let parsed = extractVerifiedInstallersFromReleases(payload, repoFullName, nowIso);
    const normalizedExpected = expectedVersion?.trim().replace(/^v/i, '');
    const normalizedRelease = parsed.releaseTag?.trim().replace(/^v/i, '');
    if (
      normalizedExpected &&
      normalizedRelease &&
      normalizedExpected !== normalizedRelease
    ) {
      parsed = {
        ...parsed,
        status: 'no-release',
        windowsExe: null,
        androidApk: null,
        message: `فایل‌های نصبی Release موجود با نسخه اعلام‌شده برنامه (${expectedVersion}) یکسان نیستند؛ برای جلوگیری از نصب نسخه قدیمی، لینک دانلود فعال نشد.`,
      };
    }
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

  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
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

  // 2. Fetch fresh non-cached version.json with 3-tier automatic fallback & in-loop JSON validation
  const candidateUrls = buildVersionFallbackCandidates(rawSource, baseManifestUrl);
  const attemptedUrls: string[] = [];

  let activeUrl = baseManifestUrl;
  let usedFallback = false;
  let lastFetchRes: ResilientFetchResult = {
    ok: false,
    status: 0,
    bodyText: '',
    networkError: 'network',
  };
  let parsedData: RemoteVersionManifest | null = null;
  let hadInvalidJson = false;

  for (let i = 0; i < candidateUrls.length; i++) {
    const candidate = candidateUrls[i];
    attemptedUrls.push(candidate);
    const bustUrl = new URL(candidate);
    // Avoid extra query params on GitHub Contents API where ref/path is sensitive
    if (!candidate.includes('api.github.com/repos/')) {
      bustUrl.searchParams.set('t', String(Date.now()));
    }
    activeUrl = candidate;
    const res = await resilientFetchText(bustUrl.toString());
    lastFetchRes = res;

    if (res.ok) {
      const parsed = parseRemoteVersionManifest(res.bodyText);
      if (parsed) {
        parsedData = parsed;
        usedFallback = i > 0;
        break;
      }
      hadInvalidJson = true;
    }
  }

  if (!parsedData) {
    if (hadInvalidJson && lastFetchRes.ok) {
      emit({
        checkedUrl: activeUrl,
        usedFallback: false,
        attemptedUrls,
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
        attemptedUrls,
        lastCheckedAt: nowIso,
        status: 'error',
        errorCategory: category,
        httpStatus: null,
        swWarning,
        statusMessage:
          lastFetchRes.networkError === 'timeout'
            ? 'زمان انتظار برای دریافت فایل version.json از تمام آینه‌های رسمی به پایان رسید. اتصال اینترنت یا فیلترشکن/فایروال را بررسی کنید.'
            : category === 'cors'
              ? 'خطای شبکه یا محدودیت CORS هنگام دریافت فایل version.json از سرور مقصد. اتصال اینترنت و نشانی فایل را بررسی کنید.'
              : 'اتصال شبکه‌ای به سرورهای گیت‌هاب برقرار نشد. وضعیت اتصال اینترنت، پروکسی ویندوز یا فایروال سیستم را بررسی کرده و دوباره تلاش کنید.',
      });
      return currentState;
    }

    const statusHint =
      lastFetchRes.status === 404
        ? 'فایل version.json در نشانی مشخص‌شده یافت نشد (HTTP 404).'
        : lastFetchRes.status === 403
          ? 'دسترسی به نشانی version.json مجاز نبود یا با محدودیت موقت مواجه شد (HTTP 403).'
          : lastFetchRes.status >= 500
            ? `سرور میزبان فایل version.json با خطای داخلی مواجه شد (HTTP ${lastFetchRes.status}).`
            : `دریافت فایل version.json با پاسخ ناموفق HTTP ${lastFetchRes.status} مواجه شد.`;

    emit({
      checkedUrl: activeUrl,
      usedFallback: false,
      attemptedUrls,
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
  // Only expose installer assets whose release tag matches the version manifest.
  void checkVerifiedReleaseInstallers(rawSource, remoteVersion);
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
    // Build IDs change on every Pages build. Compare them only for the web PWA;
    // installed Electron/Android packages must be updated by a versioned installer.
    isServiceWorkerEligibleOrigin() &&
    remoteBuildId &&
    remoteBuildId !== 'dev-local' &&
    LOCAL_BUILD_ID !== 'dev-local' &&
    remoteBuildId !== LOCAL_BUILD_ID
  ) {
    foundUpdate = true;
  }

  if (foundUpdate || currentState.needRefresh) {
    emit({
      checkedUrl: activeUrl,
      usedFallback,
      attemptedUrls,
      needRefresh: true,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'update-available',
      errorCategory: null,
      httpStatus: lastFetchRes.status,
      swWarning,
      statusMessage: isServiceWorkerEligibleOrigin()
        ? `نسخه وب جدید (${remoteVersion}) در دسترس است؛ تغییرات را از طریق به‌روزرسانی PWA دریافت کنید.`
        : `نسخه نصبی جدید (${remoteVersion}) شناسایی شد. نصب ویندوز یا اندروید فقط با فایل نصبی هم‌نسخه و امضای معتبر انجام می‌شود؛ وضعیت فایل‌ها را در بخش پشتیبانی بررسی کنید.`,
    });
  } else {
    emit({
      checkedUrl: activeUrl,
      usedFallback,
      attemptedUrls,
      needRefresh: false,
      remoteVersion,
      remoteBuildId,
      remoteBuiltAt,
      remoteNotes,
      lastCheckedAt: nowIso,
      status: 'up-to-date',
      errorCategory: null,
      httpStatus: lastFetchRes.status,
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

  // A page reload cannot replace a packaged Electron executable or Android APK.
  if (!isServiceWorkerEligibleOrigin()) {
    emit({
      status: 'error',
      errorCategory: 'sw',
      statusMessage:
        'تازه‌سازی صفحه، نسخه نصب‌شده ویندوز یا اندروید را به‌روزرسانی نمی‌کند. برای ویندوز باید نصاب EXE اجرا شود و برای اندروید باید APK هم‌امضا نصب شود.',
    });
    return;
  }

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
