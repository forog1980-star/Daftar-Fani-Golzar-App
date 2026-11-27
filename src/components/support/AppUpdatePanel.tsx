import React from 'react';
import {
  CheckCircle2,
  CloudDownload,
  RefreshCw,
  ShieldCheck,
  Wifi,
  WifiOff,
  AlertCircle,
} from 'lucide-react';
import { useAppUpdater } from '../../utils/appUpdater';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/format';
import { PWAInstallButton } from '../layout/PWAInstallButton';

interface AppUpdatePanelProps {
  compact?: boolean;
}

export const AppUpdatePanel: React.FC<AppUpdatePanelProps> = ({ compact = false }) => {
  const updater = useAppUpdater();
  const isOnline = useOnlineStatus();
  const isBusy = updater.status === 'checking' || updater.status === 'updating';

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
      {/* Header with App Icon Preview */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] pb-4">
        <div className="flex items-center gap-3.5 min-w-0">
          <div className="h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-[#D5C39E] bg-[#FBEFD7]">
            <img
              src="./app-icon.png"
              alt="آیکون رسمی نرم‌افزار دفتر فنی"
              className="h-full w-full object-cover"
            />
          </div>
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-bold text-[#243B5A]">
              به‌روزرسانی نرم‌افزار و نصب آفلاین (PWA)
            </h3>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5B6573]">
              <span className="tabular-nums font-medium text-[#263448]">
                نسخه فعلی: {toPersianDigits(updater.currentVersion)}
              </span>
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

      {/* Clear User-Friendly Guidance */}
      {!compact && (
        <p className="text-xs leading-6 text-[#5B6573]">
          به دلیل عملکرد آفلاین نرم‌افزار، هر زمان تغییرات جدیدی روی مخزن گیت‌هاب منتشر شود کافی است
          یک‌بار با اتصال به اینترنت دکمه «بررسی و دریافت به‌روزرسانی از گیت‌هاب» را بزنید تا نسخه
          جدید بدون نیاز به نصب مجدد اعمال شود.
        </p>
      )}

      {/* Status Feedback Box */}
      {updater.statusMessage && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-2.5 rounded-lg border px-3.5 py-2.5 text-xs leading-6 ${
            updater.status === 'update-available'
              ? 'border-[#D5C39E] bg-[#FAF8F3] text-[#243B5A]'
              : updater.status === 'up-to-date'
                ? 'border-[#C6D5C4] bg-[#E7ECE6] text-[#263448]'
                : updater.status === 'offline' || updater.status === 'error'
                  ? 'border-[#D8B4B4] bg-[#FBF1F1] text-[#9E3B3B]'
                  : 'border-[#E2DDD2] bg-[#FAF8F3] text-[#263448]'
          }`}
        >
          {updater.status === 'up-to-date' ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3D6B59]" />
          ) : updater.status === 'offline' || updater.status === 'error' ? (
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#9E3B3B]" />
          ) : (
            <CloudDownload className="mt-0.5 h-4 w-4 shrink-0 text-[#243B5A]" />
          )}
          <span>{updater.statusMessage}</span>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5">
        <button
          type="button"
          disabled={isBusy}
          onClick={() => updater.checkForUpdate()}
          className="inline-flex items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2.5 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] disabled:opacity-60 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${isBusy ? 'animate-spin' : ''}`} />
          <span>
            {updater.status === 'checking'
              ? 'در حال بررسی نسخه جدید...'
              : 'بررسی و دریافت به‌روزرسانی از گیت‌هاب'}
          </span>
        </button>

        {updater.needRefresh && (
          <button
            type="button"
            disabled={isBusy}
            onClick={() => updater.applyUpdate(false)}
            className="inline-flex items-center gap-2 rounded-lg border border-[#3D6B59] bg-[#3D6B59] px-4 py-2.5 text-xs font-medium text-[#FFFFFF] transition-colors hover:opacity-90 disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <CloudDownload className="h-3.5 w-3.5" />
            <span>اعمال نسخه جدید و بارگذاری مجدد</span>
          </button>
        )}

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
      </div>

      {/* Data Safety Assurance */}
      <div className="flex items-center gap-2 border-t border-[#ECE7DC] pt-3 text-[11px] text-[#5B6573]">
        <ShieldCheck className="h-4 w-4 shrink-0 text-[#3D6B59]" />
        <span>
          در فرآیند به‌روزرسانی نرم‌افزار، تمامی پرونده‌ها، بودجه‌ها، تصاویر و پیوست‌های ذخیره‌شده در
          حافظه محلی دستگاه (IndexedDB) کاملاً محفوظ می‌مانند.
        </span>
      </div>
    </div>
  );
};
