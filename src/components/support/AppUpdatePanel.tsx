import React, { useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  CloudDownload,
  FolderCog,
  Link2,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
} from 'lucide-react';
import {
  LocalBundleSource,
  NetworkEndpointRecord,
  resolveVersionManifestUrl,
  UpdateErrorCategory,
  useAppUpdater,
} from '../../utils/appUpdater';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/format';
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

const BUNDLE_SOURCE_LABELS: Record<LocalBundleSource, string> = {
  'electron-ota': 'دایرکتوری به‌روزرسانی محلی ویندوز (OTA)',
  'electron-bundled': 'دایرکتوری داخلی بسته ویندوز',
  'android-ota': 'دایرکتوری به‌روزرسانی داخلی اندروید (OTA)',
  'android-bundled': 'دایرکتوری داخلی بسته اندروید',
  web: 'نسخه وب / PWA مرورگر',
};

function getEndpointOutcomeLabel(ep: NetworkEndpointRecord): string {
  switch (ep.outcome) {
    case 'ok':
      return 'موفق';
    case 'timeout':
      return 'عدم پاسخ (زمان انتظار)';
    case 'cors-error':
      return 'محدودیت CORS / شبکه';
    case 'network-error':
      return 'خطای اتصال شبکه';
    case 'invalid-json':
      return 'پاسخ غیرمعتبر (غیر JSON)';
    case 'http-error':
      return ep.httpStatus ? `خطای سرور (HTTP ${toPersianDigits(ep.httpStatus)})` : 'خطای سرور';
  }
}

export const AppUpdatePanel: React.FC<AppUpdatePanelProps> = ({ compact = false }) => {
  const updater = useAppUpdater();
  const isOnline = useOnlineStatus();
  const runtimePlatform = detectRuntimePlatform();
  const isNativeRuntime = isNativeInstalledRuntime();
  const platformLabel = getPlatformDisplayLabel(runtimePlatform);

  const [showSourceConfig, setShowSourceConfig] = useState(false);
  const [sourceInput, setSourceInput] = useState(updater.versionSourceUrl);
  const [runningUpdate, setRunningUpdate] = useState(false);

  const isBusy =
    updater.status === 'checking' || updater.status === 'updating' || runningUpdate;

  const effectiveVersionUrl =
    updater.checkedUrl ||
    (typeof window !== 'undefined' ? resolveVersionManifestUrl(sourceInput) : './version.json');

  const handleOneClickUpdate = async (overrideSource?: string) => {
    const cleaned = (overrideSource !== undefined ? overrideSource : sourceInput).trim();
    if (cleaned !== updater.versionSourceUrl) {
      updater.setCustomSourceUrl(cleaned);
    }

    setRunningUpdate(true);
    try {
      await updater.runUnifiedUpdate(cleaned);
    } finally {
      setRunningUpdate(false);
    }
  };

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
      {/* Header with Official App Icon, Active Version Badge & Runtime Status */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] pb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#D5C39E] bg-[#F7F3E9]">
            <img
              src="./app-icon.png"
              alt="آیکون رسمی نرم‌افزار دفتر فنی اداره گلزار شهدا"
              className="h-full w-full object-contain"
            />
          </div>
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="text-sm font-bold text-[#243B5A]">
                نسخه نرم‌افزار و به‌روزرسانی خودکار
              </h3>
              <span className="inline-flex items-center rounded-md border border-[#243B5A]/20 bg-[#E5EBF2] px-2 py-0.5 text-[11px] font-bold tabular-nums text-[#243B5A]">
                نسخه {toPersianDigits(updater.currentVersion)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5B6573]">
              <span className="font-medium text-[#243B5A]">{platformLabel}</span>
              <span aria-hidden="true">·</span>
              <span>{BUNDLE_SOURCE_LABELS[updater.localBundleSource]}</span>
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

      {/* Native App Directory & Checked Endpoint Transparency */}
      {!compact && (
        <div className="space-y-2 rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3.5 py-2.5 text-[11px] text-[#5B6573]">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>نشانی بررسی نسخه در گیت‌هاب:</span>
            <code
              dir="ltr"
              className="break-all rounded bg-[#FFFFFF] border border-[#E2DDD2] px-2 py-0.5 text-[11px] text-[#243B5A]"
            >
              {effectiveVersionUrl}
            </code>
          </div>
          {isNativeRuntime && updater.localBundleDir && (
            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#ECE7DC] pt-2">
              <span className="inline-flex items-center gap-1 font-medium text-[#243B5A]">
                <FolderCog className="h-3.5 w-3.5" />
                <span>مسیر محلی فایل‌های نسخه:</span>
              </span>
              <code
                dir="ltr"
                className="break-all rounded bg-[#FFFFFF] border border-[#E2DDD2] px-2 py-0.5 text-[11px] text-[#263448]"
              >
                {updater.localBundleDir}
              </code>
            </div>
          )}
        </div>
      )}

      {/* Clear Runtime-Aware Guidance */}
      {!compact && (
        <p className="text-xs leading-6 text-[#5B6573]">
          با کلیک روی دکمه «به‌روزرسانی نرم‌افزار»، آخرین نسخه با مکانیزم تلاش مجدد خودکار
          (توقف نمایی) از گیت‌هاب بررسی شده و در صورت وجود نسخه جدید،{' '}
          {runtimePlatform === 'electron'
            ? 'فایل‌های نسخه جدید مستقیماً در دایرکتوری محلی برنامه (D:\\Daftar-Fani-Golzar\\AppBundle) ذخیره و بلافاصله اعمال می‌شوند.'
            : runtimePlatform === 'android'
              ? 'فایل‌های نسخه جدید مستقیماً در دایرکتوری داخلی اپلیکیشن ذخیره شده و برنامه بلافاصله به آخرین نسخه ارتقا می‌یابد.'
              : 'کش ظاهری مرورگر به‌روزرسانی شده و برنامه بلافاصله با آخرین نسخه بارگذاری می‌شود.'}
        </p>
      )}

      {/* Status Feedback Box + Exponential Backoff Progress + Network Troubleshooting Guide */}
      {(updater.errorMessage ||
        updater.statusMessage ||
        updater.retryStatusText ||
        updater.updateProgressText) && (
        <div
          role={updater.status === 'error' || updater.status === 'offline' ? 'alert' : 'status'}
          aria-live="polite"
          className={`space-y-2.5 rounded-lg border px-3.5 py-3 text-xs leading-6 ${
            updater.status === 'update-available' || updater.status === 'updating'
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
              <div className="font-medium">
                {updater.updateProgressText || updater.errorMessage || updater.statusMessage}
              </div>
              {updater.retryStatusText && updater.status === 'checking' && (
                <div className="text-[11px] text-[#5B6573]">{updater.retryStatusText}</div>
              )}
              {updater.status === 'update-available' && updater.remoteBuiltAt && (
                <div className="text-[11px] tabular-nums text-[#5B6573]">
                  تاریخ انتشار نسخه جدید: {formatJalaliDateTime(updater.remoteBuiltAt)}
                </div>
              )}
            </div>
          </div>

          {updater.usedFallback &&
            (updater.status === 'up-to-date' || updater.status === 'update-available') && (
              <div className="mr-6 rounded border border-[#C6D5C4] bg-[#FFFFFF]/80 px-2.5 py-1.5 text-[11px] text-[#3D6B59]">
                بررسی نسخه با موفقیت از طریق منبع پشتیبان انجام شد
                {updater.fallbackSourceLabel ? ` (${updater.fallbackSourceLabel})` : ''}.
              </div>
            )}

          {updater.swWarning && (
            <div className="mr-6 rounded border border-[#E2DDD2] bg-[#FFFFFF]/80 px-2.5 py-1.5 text-[11px] text-[#5B6573]">
              {updater.swWarning}
            </div>
          )}

          {/* Dedicated Network Error Report & Troubleshooting Guide */}
          {(updater.status === 'error' || updater.status === 'offline') && (
            <div className="mr-6 space-y-2.5 rounded border border-[#E5C6C6] bg-[#FFFFFF]/90 px-3 py-2.5 text-[11px] text-[#263448]">
              <div className="font-semibold text-[#9E3B3B]">
                گزارش وضعیت اتصال و راهنمای رفع مشکل شبکه
              </div>

              {updater.networkReport && (
                <div className="space-y-2">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[#5B6573]">
                    <span>
                      وضعیت دستگاه:{' '}
                      <strong
                        className={
                          updater.networkReport.onlineFlag ? 'text-[#3D6B59]' : 'text-[#9E3B3B]'
                        }
                      >
                        {updater.networkReport.onlineFlag ? 'متصل به شبکه محلی' : 'آفلاین'}
                      </strong>
                    </span>
                    {updater.networkReport.connectionType && (
                      <span>
                        نوع ارتباط: <strong>{updater.networkReport.connectionType}</strong>
                      </span>
                    )}
                    {updater.networkReport.totalAttempts > 0 && (
                      <span className="tabular-nums">
                        مجموع تلاش‌ها (با توقف نمایی):{' '}
                        <strong>{toPersianDigits(updater.networkReport.totalAttempts)} نوبت</strong>
                      </span>
                    )}
                  </div>

                  <p className="leading-5 text-[#263448]">{updater.networkReport.summaryPersian}</p>

                  {updater.networkReport.endpoints.length > 0 && (
                    <ul className="space-y-1 border-t border-[#ECE7DC] pt-2">
                      {updater.networkReport.endpoints.map((ep, idx) => (
                        <li
                          key={`${ep.url}-${idx}`}
                          className="flex flex-wrap items-center justify-between gap-2 text-[11px]"
                        >
                          <span className="font-medium text-[#243B5A]">{ep.label}</span>
                          <span
                            className={`tabular-nums ${
                              ep.outcome === 'ok' ? 'text-[#3D6B59]' : 'text-[#9E3B3B]'
                            }`}
                          >
                            {getEndpointOutcomeLabel(ep)} ({toPersianDigits(ep.attempts)} تلاش)
                          </span>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              <ul className="list-disc space-y-1 border-t border-[#ECE7DC] pt-2 pr-4 text-[11px] leading-5 text-[#5B6573]">
                <li>از برقراری اتصال اینترنت پایدار (Wi-Fi یا شبکه اداری) اطمینان حاصل کنید.</li>
                <li>
                  در صورت محدودیت شبکه سازمانی یا فیلترینگ روی دامنه‌های گیت‌هاب، تنظیمات پروکسی یا
                  اتصال جایگزین را بررسی کنید.
                </li>
                <li>
                  پس از برقراری ارتباط، روی «تلاش مجدد» کلیک کنید تا بسته جدید بدون تغییر در
                  اطلاعات شما دریافت شود.
                </li>
              </ul>

              <div className="flex flex-wrap items-center gap-2 pt-1">
                <button
                  type="button"
                  disabled={isBusy}
                  onClick={() => void handleOneClickUpdate()}
                  className="inline-flex items-center gap-1 rounded border border-[#9E3B3B] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
                >
                  <RefreshCw className="h-3 w-3" />
                  <span>تلاش مجدد</span>
                </button>
                {(updater.versionSourceUrl.trim() || sourceInput.trim()) && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={async () => {
                      setSourceInput('');
                      updater.setCustomSourceUrl('');
                      await handleOneClickUpdate('');
                    }}
                    className="inline-flex items-center gap-1 rounded border border-[#243B5A] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  >
                    <Link2 className="h-3 w-3" />
                    <span>بازگشت به نشانی رسمی پیش‌فرض</span>
                  </button>
                )}
              </div>
            </div>
          )}

          {updater.remoteNotes.length > 0 &&
            (updater.status === 'update-available' || updater.status === 'up-to-date') && (
              <ul className="mr-6 list-disc space-y-0.5 text-[11px] text-[#263448]">
                {updater.remoteNotes.map((note, idx) => (
                  <li key={idx}>{note}</li>
                ))}
              </ul>
            )}
        </div>
      )}

      {/* Single Primary One-Click Auto-Update Action */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => void handleOneClickUpdate()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-5 py-2.5 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
          <span>
            {updater.status === 'updating'
              ? 'در حال دریافت و اعمال خودکار نسخه جدید...'
              : isBusy
                ? 'در حال بررسی و به‌روزرسانی...'
                : 'به‌روزرسانی نرم‌افزار'}
          </span>
        </button>

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
              {typeof window !== 'undefined'
                ? resolveVersionManifestUrl(sourceInput)
                : './version.json'}
            </code>{' '}
            همراه با آینه‌های پشتیبان رسمی بررسی می‌شود.
          </p>
        </div>
      )}

      {/* Data Safety Assurance */}
      <div className="flex items-center gap-2 border-t border-[#ECE7DC] pt-3 text-[11px] text-[#5B6573]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#3D6B59]" />
        <span>
          {runtimePlatform === 'electron'
            ? 'تمامی پرونده‌ها، صورت‌وضعیت‌ها، بودجه‌ها، تصاویر و پیوست‌های شما در پوشه D:\\Daftar-Fani-Golzar در تمام به‌روزرسانی‌ها کاملاً محفوظ می‌مانند.'
            : runtimePlatform === 'android'
              ? 'تمامی اطلاعات ثبت‌شده در حافظه داخلی اپلیکیشن اندروید هنگام به‌روزرسانی خودکار کاملاً محفوظ می‌مانند.'
              : 'تمامی پرونده‌ها، صورت‌وضعیت‌ها، بودجه‌ها، تصاویر و پیوست‌های ذخیره‌شده در حافظه محلی مرورگر (IndexedDB) کاملاً محفوظ می‌مانند.'}
        </span>
      </div>
    </div>
  );
};
