import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  CheckCircle2,
  Download,
  FolderCog,
  FolderOpen,
  HardDrive,
  RefreshCw,
  RotateCw,
  ShieldAlert,
  Smartphone,
  Globe,
} from 'lucide-react';
import { AppStore } from '../../hooks/useAppStore';
import { buildFullZipBackupBlob, createFullZipBackup } from '../../utils/backupSync';
import { formatFileSize, formatJalaliDateTime, toPersianDigits } from '../../utils/format';
import {
  blobToBase64Raw,
  getStorageOverview,
  StorageOverview,
} from '../../utils/platformBridge';

interface StorageLocationPanelProps {
  store: AppStore;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

export const StorageLocationPanel: React.FC<StorageLocationPanelProps> = ({
  store,
  onNotice,
  onError,
}) => {
  const [overview, setOverview] = useState<StorageOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [busyBackup, setBusyBackup] = useState(false);
  const [busyRelocate, setBusyRelocate] = useState(false);
  const [relocateDoneInfo, setRelocateDoneInfo] = useState<{
    newRoot: string;
    backupPath?: string;
    copiedFiles?: number;
  } | null>(null);

  const loadOverview = useCallback(async () => {
    setLoading(true);
    try {
      const info = await getStorageOverview();
      setOverview(info);
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در بررسی وضعیت محل ذخیره اطلاعات');
    } finally {
      setLoading(false);
    }
  }, [onError]);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview, store.settings.lastSavedAt, store.settings.lastBackupAt]);

  const handleOpenFolder = async (subfolder?: string) => {
    if (!window.desktopBridge) return;
    const res = await window.desktopBridge.openStorageFolder(subfolder);
    if (!res.ok) {
      onError(res.error || 'امکان باز کردن پوشه اطلاعات وجود نداشت.');
    }
  };

  const handleBackupNow = async () => {
    setBusyBackup(true);
    onError('');
    try {
      const outcome = await createFullZipBackup(
        store.settings.deviceId,
        store.settings.deviceName
      );
      await store.saveSettings({
        ...store.settings,
        lastBackupAt: new Date().toISOString(),
      });
      await loadOverview();
      onNotice(
        outcome.savedPath
          ? `نسخه پشتیبان کامل (ZIP) با موفقیت در مسیر «${outcome.savedPath}» ذخیره شد.`
          : 'نسخه پشتیبان کامل (ZIP شامل تمامی داده‌ها، تصاویر و پیوست‌ها) با موفقیت تهیه و دریافت شد.'
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در تهیه نسخه پشتیبان کامل');
    } finally {
      setBusyBackup(false);
    }
  };

  const handleRelocateStorage = async () => {
    if (!window.desktopBridge) return;
    setBusyRelocate(true);
    onError('');
    try {
      // Mandatory backup BEFORE copying/relocating any data
      const { blob, filename } = await buildFullZipBackupBlob(
        store.settings.deviceId,
        store.settings.deviceName
      );
      const backupBase64 = await blobToBase64Raw(blob);
      const preMigrationName = `pre-migration-${filename}`;

      const res = await window.desktopBridge.relocateStorage({
        backupBase64,
        backupFilename: preMigrationName,
      });

      if (res.cancelled) {
        return;
      }
      if (!res.ok || !res.newRoot) {
        onError(res.error || 'انتقال محل ذخیره اطلاعات ناموفق بود. مسیر فعلی تغییر نکرد.');
        return;
      }

      await store.saveSettings({
        ...store.settings,
        lastBackupAt: new Date().toISOString(),
      });

      setRelocateDoneInfo({
        newRoot: res.newRoot,
        backupPath: res.backupPath,
        copiedFiles: res.copiedFiles,
      });
      onNotice(
        `انتقال ایمن با تهیه پشتیبان کامل انجام شد. برای فعال‌سازی مسیر جدید «${res.newRoot}»، نرم‌افزار را مجدداً اجرا کنید.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در فرآیند انتقال محل ذخیره اطلاعات');
    } finally {
      setBusyRelocate(false);
    }
  };

  const PlatformIcon =
    overview?.platform === 'electron'
      ? HardDrive
      : overview?.platform === 'android'
        ? Smartphone
        : Globe;

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] pb-3.5">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-sm font-bold text-[#243B5A]">
            <PlatformIcon className="h-4 w-4 text-[#B88A2E]" />
            <span>محل ذخیره اطلاعات</span>
          </div>
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-[#5B6573]">
            <span>محیط اجرای فعلی:</span>
            <strong className="font-semibold text-[#243B5A]">
              {overview?.platformLabel || 'در حال بررسی...'}
            </strong>
          </div>
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          disabled={loading}
          className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 text-xs font-medium text-[#263448] hover:border-[#243B5A] hover:bg-[#E5EBF2] disabled:opacity-50 cursor-pointer whitespace-nowrap"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
          <span>بروزرسانی وضعیت</span>
        </button>
      </div>

      {/* Key Metrics Grid (flat single-elevation, hairline dividers, tabular-nums) */}
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3.5 py-3 sm:col-span-2">
          <div className="text-[11px] text-[#5B6573]">مسیر کامل محل ذخیره اطلاعات</div>
          <div
            dir={overview?.platform === 'electron' ? 'ltr' : 'rtl'}
            className={`mt-1 break-all text-xs font-semibold text-[#1D3250] ${
              overview?.platform === 'electron' ? 'text-left font-mono' : 'leading-6'
            }`}
          >
            {overview?.pathDisplay || 'در حال بررسی...'}
          </div>
          {overview?.platform === 'electron' && overview.isDefaultDriveD && (
            <div className="mt-1 text-[11px] text-[#3D6B59]">
              مسیر استاندارد روی درایو D فعال است (مستقل از مرورگر Chrome و درایو C).
            </div>
          )}
        </div>

        <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3.5 py-3">
          <div className="text-[11px] text-[#5B6573]">فضای اشغالشده تقریبی</div>
          <div className="mt-1 text-xs font-bold tabular-nums text-[#1D3250]">
            {overview?.usedBytes !== null && overview?.usedBytes !== undefined
              ? formatFileSize(overview.usedBytes)
              : 'نامشخص'}
          </div>
          <div className="mt-1 text-[11px] text-[#788290]">
            {overview?.platform === 'electron'
              ? 'مجموع پایگاه داده، پیوست‌ها و پشتیبان‌ها'
              : overview?.quotaBytes
                ? `سهمیه در دسترس: ${formatFileSize(overview.quotaBytes)}`
                : 'برآورد حافظه محلی دستگاه'}
          </div>
        </div>

        <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3.5 py-3">
          <div className="text-[11px] text-[#5B6573]">زمان آخرین پشتیبان‌گیری</div>
          <div className="mt-1 text-xs font-semibold tabular-nums text-[#1D3250]">
            {store.settings.lastBackupAt
              ? formatJalaliDateTime(store.settings.lastBackupAt)
              : 'هنوز ثبت نشده'}
          </div>
          <div className="mt-1.5 flex items-center gap-1 text-[11px]">
            {overview?.healthy !== false ? (
              <>
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-[#3D6B59]" />
                <span className="font-medium text-[#3D6B59]">سلامت ذخیره‌سازی: سالم</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-[#9E3B3B]" />
                <span className="font-medium text-[#9E3B3B]">نیاز به بررسی دسترسی</span>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Health detail message */}
      {overview && (
        <div
          className={`flex items-start gap-2 rounded-lg border px-3.5 py-2.5 text-xs leading-6 ${
            overview.healthy
              ? 'border-[#C6D5C4] bg-[#E7ECE6]/70 text-[#263448]'
              : 'border-[#D8B4B4] bg-[#FBF1F1] text-[#9E3B3B]'
          }`}
        >
          {overview.healthy ? (
            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-[#3D6B59]" />
          ) : (
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-[#9E3B3B]" />
          )}
          <span>{overview.healthMessage}</span>
        </div>
      )}

      {/* Windows Electron: 5 Structured Subfolders Breakdown */}
      {overview?.platform === 'electron' && overview.subfolders && (
        <div className="overflow-x-auto rounded-lg border border-[#E2DDD2]">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#E2DDD2] bg-[#FAF8F3] text-[11px] text-[#5B6573]">
                <th className="px-3 py-2 font-medium">زیرپوشه</th>
                <th className="px-3 py-2 font-medium">کاربرد واقعی</th>
                <th className="px-3 py-2 font-medium">تعداد فایل</th>
                <th className="px-3 py-2 font-medium">حجم</th>
                <th className="px-3 py-2 font-medium text-left">باز کردن</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DC]">
              {overview.subfolders.map((sub) => (
                <tr key={sub.name} className="hover:bg-[#FAF8F3]/70">
                  <td dir="ltr" className="px-3 py-2 text-left font-mono font-semibold text-[#243B5A]">
                    {sub.name}\
                  </td>
                  <td className="px-3 py-2 text-[#263448]">{sub.label}</td>
                  <td className="px-3 py-2 tabular-nums text-[#5B6573]">
                    {toPersianDigits(sub.fileCount)}
                  </td>
                  <td className="px-3 py-2 tabular-nums text-[#263448]">
                    {formatFileSize(sub.bytes)}
                  </td>
                  <td className="px-3 py-2 text-left">
                    <button
                      type="button"
                      onClick={() => void handleOpenFolder(sub.name)}
                      className="inline-flex items-center gap-1 rounded border border-[#D7D2C6] bg-[#FFFFFF] px-2 py-1 text-[11px] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                    >
                      <FolderOpen className="h-3 w-3" />
                      <span>باز کردن</span>
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Chrome / Web Explicit Honesty Notice (Section 3 Requirement) */}
      {overview?.platform === 'web' && (
        <div className="space-y-2 rounded-lg border border-[#E0CFA8] bg-[#FAF6EC] px-4 py-3 text-xs leading-6 text-[#5C4315]">
          <p className="font-medium">
            اطلاعات این نسخه در حافظه محلی همین مرورگر و همین دستگاه ذخیره می‌شود. حذف داده‌های سایت یا
            پاک‌کردن اطلاعات مرورگر ممکن است باعث ازدست‌رفتن اطلاعات شود. برای انتقال اطلاعات به نسخه
            نصب‌شده از پشتیبان یا خروجی JSON استفاده کنید.
          </p>
          <p className="text-[11px] text-[#7A5E29]">
            مرورگرهای وب به دلایل امنیتی مسیر پوشه مستقیم روی درایو ویندوز را در اختیار برنامه قرار
            نمی‌دهند و اطلاعات در فضای ایزوله پروفایل همین مرورگر نگهداری می‌شوند. در نسخه نصب‌شده
            ویندوز (EXE)، مسیر واقعی اطلاعات به‌طور مستقیم روی{' '}
            <code dir="ltr" className="rounded bg-[#FFFFFF]/80 px-1.5 py-0.5 font-mono text-[#243B5A]">
              D:\Daftar-Fani-Golzar
            </code>{' '}
            قرار می‌گیرد و بستن یا پاک‌کردن Chrome هیچ تأثیری روی آن ندارد.
          </p>
        </div>
      )}

      {/* Android Explicit Notice */}
      {overview?.platform === 'android' && (
        <div className="rounded-lg border border-[#D7DFEA] bg-[#F4F7FB] px-4 py-3 text-xs leading-6 text-[#243B5A]">
          اطلاعات اپلیکیشن اندروید به‌صورت آفلاین در فضای اختصاصی برنامه روی گوشی ذخیره می‌شود و
          خروجی‌های Word، Excel، PDF، JSON و ZIP از طریق قابلیت اشتراک‌گذاری بومی Android ذخیره یا
          ارسال می‌گردند. گوشی دستگاه مکمل است و انتقال اطلاعات با کامپیوتر مرجع از طریق فایل کنترل‌شده
          JSON انجام می‌شود.
        </div>
      )}

      {/* Safe Relocation Completion Prompt (Windows Electron) */}
      {relocateDoneInfo && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[#C6D5C4] bg-[#E7ECE6] px-4 py-3 text-xs text-[#263448]">
          <div className="space-y-0.5">
            <div className="font-semibold text-[#1D3250]">
              انتقال ایمن اطلاعات با موفقیت تأیید شد ({toPersianDigits(relocateDoneInfo.copiedFiles ?? 0)}{' '}
              فایل کپی شد)
            </div>
            <div>
              مسیر جدید:{' '}
              <code dir="ltr" className="font-mono font-semibold text-[#243B5A]">
                {relocateDoneInfo.newRoot}
              </code>
            </div>
          </div>
          <button
            type="button"
            onClick={() => void window.desktopBridge?.relaunchApp()}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3.5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
          >
            <RotateCw className="h-3.5 w-3.5" />
            <span>راه‌اندازی مجدد برای فعال‌سازی مسیر جدید</span>
          </button>
        </div>
      )}

      {/* Action Buttons */}
      <div className="flex flex-wrap items-center gap-2.5 pt-1">
        {overview?.canOpenFolder && (
          <button
            type="button"
            onClick={() => void handleOpenFolder()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
          >
            <FolderOpen className="h-4 w-4" />
            <span>باز کردن پوشه اطلاعات</span>
          </button>
        )}

        <button
          type="button"
          disabled={busyBackup}
          onClick={() => void handleBackupNow()}
          className={`inline-flex h-10 items-center gap-2 rounded-lg px-4 text-xs font-medium disabled:opacity-60 cursor-pointer whitespace-nowrap ${
            overview?.canOpenFolder
              ? 'border border-[#243B5A] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2]'
              : 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3] hover:bg-[#354F73]'
          }`}
        >
          <Download className="h-4 w-4" />
          <span>{busyBackup ? 'در حال تهیه پشتیبان...' : 'تهیه نسخه پشتیبان کامل (ZIP)'}</span>
        </button>

        {overview?.canRelocate && (
          <button
            type="button"
            disabled={busyRelocate}
            onClick={() => void handleRelocateStorage()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-4 text-xs font-medium text-[#263448] hover:border-[#243B5A] hover:bg-[#E5EBF2] disabled:opacity-60 cursor-pointer whitespace-nowrap"
          >
            <FolderCog className="h-4 w-4 text-[#243B5A]" />
            <span>
              {busyRelocate ? 'در حال پشتیبان‌گیری و انتقال ایمن...' : 'انتخاب محل جایگزین (انتقال ایمن)'}
            </span>
          </button>
        )}
      </div>
    </div>
  );
};
