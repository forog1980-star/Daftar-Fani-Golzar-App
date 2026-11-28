import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  Download,
  Info,
  Link2,
  Monitor,
  RefreshCw,
  ShieldCheck,
  Smartphone,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  resolveVersionManifestUrl,
  UpdateErrorCategory,
  useAppUpdater,
} from '../../utils/appUpdater';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { formatFileSize, formatJalaliDateTime, toPersianDigits } from '../../utils/format';
import {
  detectRuntimePlatform,
  getPlatformDisplayLabel,
  isNativeInstalledRuntime,
} from '../../utils/platformBridge';
import { PWAInstallButton } from '../layout/PWAInstallButton';

interface AppUpdatePanelProps {
  compact?: boolean;
}

const ERROR_CATEGORY_LABELS: Record<Exclude<UpdateErrorCategory, null>, string> = {
  'invalid-url': 'نشانی نامعتبر',
  offline: 'حالت آفلاین',
  network: 'خطای شبکه / زمان انتظار',
  cors: 'خطای شبکه یا محدودیت CORS',
  http: 'خطای پاسخ سرور (HTTP)',
  json: 'قالب نامعتبر JSON',
  sw: 'هشدار Service Worker',
};

export const AppUpdatePanel: React.FC<AppUpdatePanelProps> = ({ compact = false }) => {
  const updater = useAppUpdater();
  const isOnline = useOnlineStatus();
  const isBusy = updater.status === 'checking' || updater.status === 'updating';
  const runtimePlatform = detectRuntimePlatform();
  const isNativeRuntime = isNativeInstalledRuntime();
  const platformLabel = getPlatformDisplayLabel(runtimePlatform);

  const [showSourceConfig, setShowSourceConfig] = useState(false);
  const [sourceInput, setSourceInput] = useState(updater.versionSourceUrl);

  const effectiveVersionUrl =
    updater.checkedUrl ||
    (typeof window !== 'undefined' ? resolveVersionManifestUrl(sourceInput) : './version.json');

  const releaseInfo = updater.releaseInstallers;
  const windowsExe = releaseInfo.windowsExe;
  const androidApk = releaseInfo.androidApk;
  const isLoadingReleases = releaseInfo.status === 'loading';

  // Auto-check GitHub Releases once when online and in full panel so installer availability is accurate
  useEffect(() => {
    if (!compact && isOnline && releaseInfo.status === 'idle') {
      void updater.checkReleaseInstallers(updater.versionSourceUrl);
    }
  }, [compact, isOnline, releaseInfo.status, updater]);

  const handleCheckUpdate = async () => {
    const cleaned = sourceInput.trim();
    if (cleaned !== updater.versionSourceUrl) {
      updater.setCustomSourceUrl(cleaned);
    }
    await updater.checkForUpdate(cleaned);
  };

  const nativeDirectAsset = runtimePlatform === 'electron' ? windowsExe : androidApk;

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
      {/* Header with Official App Icon Preview */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] pb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#D5C39E] bg-[#F7F3E9]">
            <img
              src="./app-icon.png"
              alt="آیکون رسمی نرم‌افزار دفتر فنی اداره گلزار شهدا"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-bold text-[#243B5A]">
              نسخه‌های نصبی مستقل (ویندوز و اندروید) و به‌روزرسانی
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5B6573]">
              <span className="font-medium text-[#243B5A]">{platformLabel}</span>
              <span aria-hidden="true">·</span>
              <span className="tabular-nums font-medium text-[#263448]">
                نسخه فعلی: {toPersianDigits(updater.currentVersion)}
              </span>
              {updater.remoteVersion && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-[#243B5A]">
                    نسخه مخزن: {toPersianDigits(updater.remoteVersion)}
                  </span>
                </>
              )}
              <span aria-hidden="true">·</span>
              <span className="inline-flex items-center gap-1">
                {isOnline ? (
                  <>
                    <Wifi className="h-3.5 w-3.5 text-[#3D6B59]" />
                    <span className="text-[#3D6B59] font-medium">متصل به اینترنت</span>
                  </>
                ) : (
                  <>
                    <WifiOff className="h-3.5 w-3.5 text-[#9E3B3B]" />
                    <span className="text-[#9E3B3B] font-medium">حالت آفلاین</span>
                  </>
                )}
              </span>
              {updater.lastCheckedAt && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums text-[#788290]">
                    آخرین بررسی: {formatJalaliDateTime(updater.lastCheckedAt)}
                  </span>
                </>
              )}
            </div>
          </div>
        </div>

        <div className="shrink-0">
          <PWAInstallButton />
        </div>
      </div>

      {/* Exact version.json Endpoint Transparency */}
      {!compact && (
        <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3.5 py-2.5 text-[11px] text-[#5B6573] flex flex-wrap items-center justify-between gap-2">
          <span>نشانی بررسی نسخه (version.json):</span>
          <code
            dir="ltr"
            className="break-all rounded bg-[#FFFFFF] border border-[#E2DDD2] px-2 py-0.5 text-[11px] text-[#243B5A]"
          >
            {effectiveVersionUrl}
          </code>
        </div>
      )}

      {/* Direct Verified Installer Downloads (Windows EXE & Android APK from GitHub Releases API) */}
      {!compact && (
        <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-4 py-3.5 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="space-y-0.5 text-xs">
              <div className="font-semibold text-[#243B5A]">
                دریافت مستقیم فایل‌های نصبی منتشرشده (بدون نیاز به مرورگر Chrome)
              </div>
              <div className="text-[11px] text-[#5B6573]">
                لینک‌های زیر صرفاً پس از تأیید انتشار واقعی فایل EXE و APK در GitHub Releases فعال می‌شوند.
              </div>
            </div>
            <button
              type="button"
              disabled={isLoadingReleases || !isOnline}
              onClick={() => void updater.checkReleaseInstallers(sourceInput.trim())}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] text-[#243B5A] hover:bg-[#E5EBF2] disabled:opacity-50 cursor-pointer whitespace-nowrap"
            >
              <RefreshCw className={`h-3 w-3 ${isLoadingReleases ? 'animate-spin' : ''}`} />
              <span>بروزرسانی وضعیت Releases</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-2.5 md:grid-cols-2">
            {/* Windows EXE Card */}
            <div className="rounded-lg border border-[#E2DDD2] bg-[#FFFFFF] p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#243B5A]">
                    <Monitor className="h-3.5 w-3.5" />
                    <span>نسخه مستقل ویندوز (EXE)</span>
                  </div>
                  <div className="text-[11px] text-[#5B6573]">
                    مسیر ذخیره‌سازی داده: <code dir="ltr">D:\Daftar-Fani-Golzar</code>
                  </div>
                </div>
                {windowsExe && (
                  <span className="text-[11px] font-medium tabular-nums text-[#3D6B59]">
                    {windowsExe.releaseTag}
                  </span>
                )}
              </div>

              {windowsExe ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#5B6573] break-all">
                    فایل: <code dir="ltr">{windowsExe.name}</code> ({formatFileSize(windowsExe.sizeBytes)})
                  </div>
                  <a
                    href={windowsExe.downloadUrl}
                    download={windowsExe.name}
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>دانلود مستقیم نصاب ویندوز (EXE)</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#9E3B3B]">
                    {isLoadingReleases
                      ? 'در حال بررسی انتشار فایل ویندوز...'
                      : 'فایل نصبی ویندوز (EXE) هنوز در Releases منتشر نشده است.'}
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#F3EFE6] px-3 text-xs font-medium text-[#788290] cursor-not-allowed whitespace-nowrap"
                  >
                    <Monitor className="h-3.5 w-3.5" />
                    <span>دانلود مستقیم ویندوز (در انتظار انتشار)</span>
                  </button>
                </div>
              )}
            </div>

            {/* Android APK Card */}
            <div className="rounded-lg border border-[#E2DDD2] bg-[#FFFFFF] p-3 flex flex-col justify-between gap-2.5">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[#3D6B59]">
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>اپلیکیشن مستقل اندروید (APK)</span>
                  </div>
                  <div className="text-[11px] text-[#5B6573]">
                    نصب آفلاین روی گوشی و تبلت اندروید
                  </div>
                </div>
                {androidApk && (
                  <span className="text-[11px] font-medium tabular-nums text-[#3D6B59]">
                    {androidApk.releaseTag}
                  </span>
                )}
              </div>

              {androidApk ? (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#5B6573] break-all">
                    فایل: <code dir="ltr">{androidApk.name}</code> ({formatFileSize(androidApk.sizeBytes)})
                  </div>
                  <a
                    href={androidApk.downloadUrl}
                    download={androidApk.name}
                    rel="noopener noreferrer"
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#3D6B59] bg-[#3D6B59] px-3 text-xs font-medium text-[#FFFFFF] hover:opacity-90 whitespace-nowrap"
                  >
                    <Download className="h-3.5 w-3.5" />
                    <span>دانلود مستقیم اپ اندروید (APK)</span>
                  </a>
                </div>
              ) : (
                <div className="space-y-1.5">
                  <div className="text-[11px] text-[#9E3B3B]">
                    {isLoadingReleases
                      ? 'در حال بررسی انتشار فایل اندروید...'
                      : 'فایل نصبی اندروید (APK) هنوز در Releases منتشر نشده است.'}
                  </div>
                  <button
                    type="button"
                    disabled
                    className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#F3EFE6] px-3 text-xs font-medium text-[#788290] cursor-not-allowed whitespace-nowrap"
                  >
                    <Smartphone className="h-3.5 w-3.5" />
                    <span>دانلود مستقیم اندروید (در انتظار انتشار)</span>
                  </button>
                </div>
              )}
            </div>
          </div>

          {releaseInfo.message && (
            <div className="flex items-start gap-1.5 text-[11px] text-[#5B6573]">
              <Info className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#243B5A]" />
              <span>{releaseInfo.message}</span>
            </div>
          )}
        </div>
      )}

      {/* Clear User-Friendly Guidance tailored per runtime (Web / Windows EXE / Android APK) */}
      {!compact && (
        <p className="text-xs leading-6 text-[#5B6573]">
          با کلیک روی دکمه «بررسی به‌روزرسانی»، هنگام اتصال به اینترنت فایل{' '}
          <code dir="ltr" className="rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[11px] text-[#243B5A]">
            version.json
          </code>{' '}
          به‌صورت مستقیم بررسی می‌شود.{' '}
          {runtimePlatform === 'electron'
            ? 'در صورت انتشار فایل نصبی جدید ویندوز (EXE) در Releases، دکمه دانلود مستقیم در بالا فعال می‌شود و داده‌های شما در D:\\Daftar-Fani-Golzar بدون تغییر حفظ می‌شوند.'
            : runtimePlatform === 'android'
              ? 'در صورت انتشار فایل نصبی جدید اندروید (APK) در Releases، دکمه دانلود مستقیم در بالا فعال می‌شود و اطلاعات ذخیره‌شده در گوشی حفظ می‌شوند.'
              : 'در صورت انتشار نسخه جدید، می‌توانید تغییرات نسخه وب را به‌صورت مستقیم روی مرورگر همین دستگاه اعمال کنید.'}
        </p>
      )}

      {/* Status Feedback Box + Categorized Diagnostics + Optional Release Notes */}
      {updater.statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`space-y-2 rounded-lg border px-3.5 py-3 text-xs leading-6 ${
            updater.status === 'update-available'
              ? 'border-[#D5C39E] bg-[#FAF8F3] text-[#243B5A]'
              : updater.status === 'up-to-date'
                ? 'border-[#C6D5C4] bg-[#E7ECE6] text-[#263448]'
                : updater.status === 'offline' || updater.status === 'error'
                  ? 'border-[#D8B4B4] bg-[#FBF1F1] text-[#9E3B3B]'
                  : 'border-[#E2DDD2] bg-[#FAF8F3] text-[#263448]'
          }`}
        >
          <div className="flex items-start gap-2.5">
            {updater.status === 'up-to-date' ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3D6B59]" />
            ) : updater.status === 'offline' || updater.status === 'error' ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9E3B3B]" />
            ) : (
              <CloudDownload className="mt-0.5 h-4 w-4 shrink-0 text-[#243B5A]" />
            )}
            <div className="space-y-1 min-w-0">
              {updater.errorCategory && (
                <div className="text-[11px] font-bold">
                  نوع خطا: {ERROR_CATEGORY_LABELS[updater.errorCategory]}
                  {updater.httpStatus ? ` (${toPersianDigits(updater.httpStatus)})` : ''}
                </div>
              )}
              <div className="font-medium">{updater.statusMessage}</div>
              {updater.status === 'update-available' && updater.remoteBuiltAt && (
                <div className="text-[11px] tabular-nums text-[#5B6573]">
                  تاریخ انتشار نسخه جدید: {formatJalaliDateTime(updater.remoteBuiltAt)}
                </div>
              )}
            </div>
          </div>

          {updater.swWarning && (
            <div className="mr-6 rounded border border-[#E2DDD2] bg-[#FFFFFF]/80 px-2.5 py-1.5 text-[11px] text-[#5B6573]">
              {updater.swWarning}
            </div>
          )}

          {updater.status === 'update-available' && updater.remoteNotes.length > 0 && (
            <ul className="mr-6 list-disc space-y-0.5 text-[11px] text-[#263448]">
              {updater.remoteNotes.map((note, idx) => (
                <li key={idx}>{note}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={handleCheckUpdate}
          className="inline-flex items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2.5 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
          <span>
            {updater.status === 'checking' ? 'در حال بررسی...' : 'بررسی به‌روزرسانی'}
          </span>
        </button>

        {!isNativeRuntime && updater.needRefresh && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => updater.applyUpdate(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#3D6B59] bg-[#3D6B59] px-4 py-2.5 text-xs font-medium text-[#FFFFFF] transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <CloudDownload className="h-3.5 w-3.5" />
            <span>دریافت تغییرات و به‌روزرسانی محلی</span>
          </button>
        )}

        {!isNativeRuntime && (
          <button
            type="button"
            disabled={isBusy || !isOnline}
            onClick={() => updater.applyUpdate(true)}
            title="پاک‌سازی کش ظاهری مرورگر و بارگذاری مستقیم آخرین فایل‌های منتشرشده از گیت‌هاب (بدون حذف داده‌ها)"
            className="inline-flex items-center gap-2 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3.5 py-2.5 text-xs font-medium text-[#263448] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <CloudDownload className="h-3.5 w-3.5 text-[#243B5A]" />
            <span>دریافت اجباری آخرین نسخه</span>
          </button>
        )}

        {isNativeRuntime && updater.status === 'update-available' && nativeDirectAsset && (
          <a
            href={nativeDirectAsset.downloadUrl}
            download={nativeDirectAsset.name}
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-[#3D6B59] bg-[#3D6B59] px-4 py-2.5 text-xs font-medium text-[#FFFFFF] transition-colors hover:opacity-90 whitespace-nowrap"
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {runtimePlatform === 'electron'
                ? `دانلود مستقیم نسخه جدید ویندوز (${nativeDirectAsset.releaseTag})`
                : `دانلود مستقیم نسخه جدید اندروید (${nativeDirectAsset.releaseTag})`}
            </span>
          </a>
        )}

        {!compact && (
          <button
            type="button"
            onClick={() => setShowSourceConfig((v) => !v)}
            className="inline-flex items-center gap-1 rounded-lg px-2.5 py-2 text-[11px] text-[#5B6573] transition-colors hover:bg-[#FAF8F3] hover:text-[#243B5A] cursor-pointer whitespace-nowrap"
          >
            <Link2 className="h-3.5 w-3.5" />
            <span>نشانی مخزن گیت‌هاب</span>
            {showSourceConfig ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>
        )}
      </div>

      {/* Optional Custom GitHub Repository / version.json Source Configuration */}
      {!compact && showSourceConfig && (
        <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-3.5 space-y-2">
          <label className="block text-xs font-medium text-[#243B5A]">
            نشانی مخزن گیت‌هاب یا فایل version.json (اختیاری)
          </label>
          <div className="flex flex-col gap-2 sm:flex-row">
            <input
              type="url"
              dir="ltr"
              value={sourceInput}
              onChange={(e) => setSourceInput(e.target.value)}
              placeholder="https://github.com/forog1980-star/Daftar-Fani-Golzar-App"
              className="flex-1 rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-3 py-2 text-left text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => {
                updater.setCustomSourceUrl(sourceInput.trim());
                setShowSourceConfig(false);
              }}
              className="rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
            >
              ذخیره نشانی
            </button>
          </div>
          <p className="text-[11px] leading-5 text-[#788290]">
            در صورت خالی گذاشتن، به‌صورت خودکار نشانی{' '}
            <code dir="ltr" className="text-[#263448]">
              {typeof window !== 'undefined' ? resolveVersionManifestUrl(sourceInput) : './version.json'}
            </code>{' '}
            بررسی می‌شود.
          </p>
        </div>
      )}

      {/* Data Safety Assurance */}
      <div className="flex items-center gap-2 border-t border-[#ECE7DC] pt-3 text-[11px] text-[#5B6573]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#3D6B59]" />
        <span>
          {runtimePlatform === 'electron'
            ? 'در فرآیند به‌روزرسانی نسخه ویندوز، تمامی پرونده‌ها، صورت‌وضعیت‌ها، بودجه‌ها، تصاویر و پیوست‌ها در پوشه D:\\Daftar-Fani-Golzar کاملاً محفوظ می‌مانند و حذف نمی‌شوند.'
            : runtimePlatform === 'android'
              ? 'در فرآیند نصب نسخه جدید اپلیکیشن اندروید (با همان شناسه بسته)، اطلاعات ذخیره‌شده در حافظه داخلی برنامه محفوظ می‌مانند. تهیه پشتیبان ZIP پیش از ارتقا توصیه می‌شود.'
              : 'در فرآیند به‌روزرسانی نسخه وب، تمامی پرونده‌ها، صورت‌وضعیت‌ها، بودجه‌ها، تصاویر و پیوست‌های ذخیره‌شده در حافظه محلی مرورگر (IndexedDB) کاملاً محفوظ می‌مانند.'}
        </span>
      </div>
    </div>
  );
};
