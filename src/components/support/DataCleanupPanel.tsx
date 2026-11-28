import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  DatabaseZap,
  Eraser,
  RotateCcw,
  ShieldCheck,
  Trash2,
} from 'lucide-react';
import { AppStore } from '../../hooks/useAppStore';
import {
  FullWipeInspection,
  inspectFullDataWipe,
  inspectSampleDataCleanup,
  SampleCleanupInspection,
} from '../../db/database';
import { createFullZipBackup } from '../../utils/backupSync';
import { toPersianDigits } from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';

interface DataCleanupPanelProps {
  store: AppStore;
  onNotice: (msg: string) => void;
  onError: (msg: string) => void;
}

const FULL_WIPE_PHRASE = 'حذف کامل';

export const DataCleanupPanel: React.FC<DataCleanupPanelProps> = ({
  store,
  onNotice,
  onError,
}) => {
  const [sampleInfo, setSampleInfo] = useState<SampleCleanupInspection | null>(null);
  const [fullInfo, setFullInfo] = useState<FullWipeInspection | null>(null);

  // Modal A: Sample Data Cleanup
  const [sampleModalOpen, setSampleModalOpen] = useState(false);
  const [includeLinkedAtts, setIncludeLinkedAtts] = useState(true);
  const [sampleConfirmChecked, setSampleConfirmChecked] = useState(false);
  const [sampleBusy, setSampleBusy] = useState(false);

  // Modal B: Full Data Wipe (strict multi-step protection)
  const [wipeModalOpen, setWipeModalOpen] = useState(false);
  const [wipeConfirmChecked, setWipeConfirmChecked] = useState(false);
  const [wipePhraseInput, setWipePhraseInput] = useState('');
  const [wipeBusy, setWipeBusy] = useState(false);

  const refreshInspections = useCallback(async () => {
    const [s, f] = await Promise.all([inspectSampleDataCleanup(), inspectFullDataWipe()]);
    setSampleInfo(s);
    setFullInfo(f);
  }, []);

  useEffect(() => {
    void refreshInspections();
  }, [
    refreshInspections,
    store.projects.length,
    store.budgets.length,
    store.payments.length,
    store.proposals.length,
    store.actions.length,
    store.documents.length,
    store.attachments.length,
  ]);

  const openSampleCleanupModal = async () => {
    await refreshInspections();
    setIncludeLinkedAtts(true);
    setSampleConfirmChecked(false);
    setSampleModalOpen(true);
  };

  const openFullWipeModal = async () => {
    await refreshInspections();
    setWipeConfirmChecked(false);
    setWipePhraseInput('');
    setWipeModalOpen(true);
  };

  const handleExecuteSampleCleanup = async () => {
    if (!sampleConfirmChecked) return;
    setSampleBusy(true);
    onError('');
    try {
      // Mandatory full ZIP backup BEFORE deleting sample records
      await createFullZipBackup(store.settings.deviceId, store.settings.deviceName);
      await store.saveSettings({
        ...store.settings,
        lastBackupAt: new Date().toISOString(),
      });

      const res = await store.removeSampleDataSafeNow(includeLinkedAtts);
      await refreshInspections();
      setSampleModalOpen(false);
      onNotice(
        `ابتدا نسخه پشتیبان کامل تهیه شد و سپس ${toPersianDigits(res.removed)} رکورد آزمایشی و ${toPersianDigits(res.removedAttachments)} پیوست/تصویر مرتبط با موفقیت پاکسازی شد. تنظیمات، فرم‌های مرجع و داده‌های واقعی حفظ شدند.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در پاکسازی اطلاعات آزمایشی');
    } finally {
      setSampleBusy(false);
    }
  };

  const handleExecuteFullWipe = async () => {
    if (!wipeConfirmChecked || wipePhraseInput.trim() !== FULL_WIPE_PHRASE) return;
    setWipeBusy(true);
    onError('');
    try {
      // Mandatory full ZIP backup BEFORE full wipe
      await createFullZipBackup(store.settings.deviceId, store.settings.deviceName);
      await store.saveSettings({
        ...store.settings,
        lastBackupAt: new Date().toISOString(),
      });

      const res = await store.wipeAllDataSafeNow(true);
      await refreshInspections();
      setWipeModalOpen(false);
      onNotice(
        `ابتدا نسخه پشتیبان کامل (ZIP) ذخیره شد و سپس ${toPersianDigits(res.removedTotal)} رکورد عملیاتی از این دستگاه پاکسازی گردید. تنظیمات اصلی، قالب‌های مرجع و ساختار پایگاه داده سالم باقی ماندند.`
      );
    } catch (err) {
      onError(err instanceof Error ? err.message : 'خطا در پاکسازی کامل اطلاعات');
    } finally {
      setWipeBusy(false);
    }
  };

  const sampleCount = sampleInfo?.totalRecords ?? 0;
  const fullCount = fullInfo?.totalRecords ?? 0;

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-5">
      {/* Section Header */}
      <div className="border-b border-[#E8E5DE] pb-3.5">
        <div className="flex items-center gap-2 text-sm font-bold text-[#243B5A]">
          <DatabaseZap className="h-4 w-4 text-[#B88A2E]" />
          <span>مدیریت و پاکسازی اطلاعات</span>
        </div>
        <p className="mt-1 text-xs leading-6 text-[#5B6573]">
          برای شروع کار واقعی با پرونده‌های دفتر فنی، ابتدا اطلاعات آزمایشی نمونه را به‌صورت ایمن
          پاکسازی کنید. پیش از هر دو عملیات، نسخه پشتیبان کامل (ZIP) و نقطه بازگشت داخلی به‌طور
          خودکار تهیه می‌شود و هیچ داده‌ای از دستگاه‌های دیگر حذف نمی‌گردد.
        </p>
      </div>

      {/* Part A: Sample Data Cleanup */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#243B5A]">
            <Eraser className="h-4 w-4 text-[#243B5A]" />
            <span>الف) پاکسازی اطلاعات آزمایشی (آماده‌سازی برای ورود اطلاعات واقعی)</span>
          </div>
          <span className="text-xs tabular-nums text-[#5B6573]">
            تعداد رکوردهای آزمایشی شناسایی‌شده:{' '}
            <strong className="text-[#1D3250]">{toPersianDigits(sampleCount)} مورد</strong>
          </span>
        </div>

        {sampleInfo && sampleCount > 0 ? (
          <div className="grid grid-cols-2 gap-2 text-[11px] sm:grid-cols-4 lg:grid-cols-5">
            {[
              { label: 'پروژه‌های آزمایشی', val: sampleInfo.counts.projects },
              { label: 'بودجه و پرداخت آزمایشی', val: sampleInfo.counts.budgets + sampleInfo.counts.payments + sampleInfo.counts.proposals },
              { label: 'اقدامات آزمایشی', val: sampleInfo.counts.actions },
              { label: 'اسناد و فرم‌های آزمایشی', val: sampleInfo.counts.documents + sampleInfo.counts.formSubmissions },
              { label: 'پیوست‌ها و تصاویر آزمایشی', val: sampleInfo.counts.attachments + sampleInfo.counts.projectImages },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] px-3 py-2"
              >
                <div className="text-[#5B6573]">{item.label}</div>
                <div className="mt-0.5 text-xs font-bold tabular-nums text-[#1D3250]">
                  {toPersianDigits(item.val)}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-lg border border-[#C6D5C4] bg-[#E7ECE6]/70 px-3.5 py-2.5 text-xs text-[#263448]">
            <ShieldCheck className="h-4 w-4 shrink-0 text-[#3D6B59]" />
            <span>
              در حال حاضر هیچ داده آزمایشی در پایگاه داده وجود ندارد و نرم‌افزار برای ثبت اطلاعات
              واقعی آماده است.
            </span>
          </div>
        )}

        <div className="text-[11px] leading-5 text-[#5B6573]">
          موارد محفوظ در پاکسازی آزمایشی: تنظیمات اصلی برنامه، کاربران، ساختار پایگاه داده،{' '}
          {toPersianDigits(sampleInfo?.preservedCounts.referenceFormTemplates ?? 0)} قالب فرم مرجع
          سازمانی و تمامی پرونده‌های واقعی ثبت‌شده توسط شما.
        </div>

        <div className="flex flex-wrap items-center gap-2.5 pt-1">
          {sampleCount > 0 ? (
            <button
              type="button"
              onClick={() => void openSampleCleanupModal()}
              className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
            >
              <Eraser className="h-4 w-4" />
              <span>بررسی و پاکسازی اطلاعات آزمایشی</span>
            </button>
          ) : (
            <button
              type="button"
              onClick={async () => {
                await store.loadSampleDataNow();
                await refreshInspections();
                onNotice('داده‌های نمونه آزمایشی برای تست مجدداً بارگذاری شدند.');
              }}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3.5 text-xs font-medium text-[#263448] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>بارگذاری مجدد داده‌های نمونه آزمایشی</span>
            </button>
          )}
        </div>
      </div>

      {/* Divider separating Sample Cleanup from Full Data Wipe */}
      <div className="border-t border-[#E8E5DE] pt-4 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2 text-xs font-bold text-[#9E3B3B]">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            <span>ب) پاکسازی کامل اطلاعات (عملیات حساس و مجزا)</span>
          </div>
          <span className="text-xs tabular-nums text-[#5B6573]">
            مجموع کل رکوردهای عملیاتی دستگاه:{' '}
            <strong className="text-[#9E3B3B]">{toPersianDigits(fullCount)} مورد</strong>
          </span>
        </div>

        <p className="text-xs leading-6 text-[#5B6573]">
          این عملیات تمامی پرونده‌های پروژه، بودجه، پرداخت‌ها، اقدامات، اسناد، پیوست‌ها و تاریخچه
          تغییرات موجود در همین دستگاه را حذف می‌کند (تنظیمات اصلی برنامه، قالب‌های فرم مرجع و فایل‌های
          نصب حفظ می‌شوند). برای جلوگیری از حذف اشتباهی، پیش از اجرا پشتیبان کامل تهیه شده و تأیید
          چندمرحله‌ای الزامی است.
        </p>

        <div>
          <button
            type="button"
            disabled={fullCount === 0}
            onClick={() => void openFullWipeModal()}
            className="inline-flex h-10 items-center gap-2 rounded-lg border border-[#C99B9B] bg-[#FBF1F1] px-4 text-xs font-medium text-[#9E3B3B] hover:border-[#9E3B3B] hover:bg-[#F7E3E3] disabled:opacity-50 cursor-pointer whitespace-nowrap"
          >
            <Trash2 className="h-4 w-4" />
            <span>باز کردن پنجره پاکسازی کامل اطلاعات</span>
          </button>
        </div>
      </div>

      {/* Modal A: Sample Cleanup Confirmation */}
      {sampleModalOpen && sampleInfo && (
        <FloatingWindow
          title="تأیید پاکسازی اطلاعات آزمایشی"
          onClose={() => !sampleBusy && setSampleModalOpen(false)}
          width={560}
        >
          <div className="space-y-4 text-xs leading-6 text-[#263448]">
            <div className="rounded-lg border border-[#D7DFEA] bg-[#F4F7FB] px-3.5 py-3 text-[#243B5A]">
              پیش از حذف هرگونه رکورد آزمایشی، یک <strong>نسخه پشتیبان کامل (ZIP)</strong> و یک{' '}
              <strong>نقطه بازگشت داخلی</strong> به‌طور خودکار ذخیره می‌شود.
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-[#1D3250]">خلاصه اطلاعات آزمایشی که حذف می‌شوند:</div>
              <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-3 tabular-nums">
                <li>پروژه‌های آزمایشی: {toPersianDigits(sampleInfo.counts.projects)}</li>
                <li>بودجه‌های آزمایشی: {toPersianDigits(sampleInfo.counts.budgets)}</li>
                <li>پرداخت‌های آزمایشی: {toPersianDigits(sampleInfo.counts.payments)}</li>
                <li>پیشنهادهای بودجه: {toPersianDigits(sampleInfo.counts.proposals)}</li>
                <li>اقدامات و پیگیری‌ها: {toPersianDigits(sampleInfo.counts.actions)}</li>
                <li>اسناد و مکاتبات: {toPersianDigits(sampleInfo.counts.documents)}</li>
                <li>اشخاص نمونه: {toPersianDigits(sampleInfo.counts.people)}</li>
                <li>فرم‌های تکمیل‌شده نمونه: {toPersianDigits(sampleInfo.counts.formSubmissions)}</li>
              </ul>
            </div>

            {sampleInfo.counts.attachments + sampleInfo.counts.projectImages > 0 && (
              <label className="flex items-start gap-2.5 rounded-lg border border-[#E2DDD2] bg-[#FFFFFF] p-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeLinkedAtts}
                  onChange={(e) => setIncludeLinkedAtts(e.target.checked)}
                  className="mt-0.5 h-4 w-4 accent-[#243B5A]"
                />
                <span>
                  پیوست‌ها و تصاویر آزمایشی مرتبط ({toPersianDigits(sampleInfo.counts.attachments)}{' '}
                  پیوست و {toPersianDigits(sampleInfo.counts.projectImages)} تصویر پروژه آزمایشی) نیز
                  پاکسازی شوند.
                </span>
              </label>
            )}

            <div className="rounded-lg border border-[#C6D5C4] bg-[#E7ECE6]/70 px-3.5 py-2.5 text-[11px] text-[#263448]">
              موارد حفظ‌شده: تنظیمات برنامه، کاربران، ساختار پایگاه داده،{' '}
              {toPersianDigits(sampleInfo.preservedCounts.referenceFormTemplates)} قالب فرم مرجع و{' '}
              {toPersianDigits(sampleInfo.preservedCounts.realProjects)} پروژه واقعی.
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={sampleConfirmChecked}
                onChange={(e) => setSampleConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#243B5A]"
              />
              <span className="font-medium text-[#1D3250]">
                خلاصه بالا را بررسی کردم و تهیه پشتیبان و پاکسازی اطلاعات آزمایشی را تأیید می‌کنم.
              </span>
            </label>

            <div className="flex justify-end gap-2 border-t border-[#E8E5DE] pt-3">
              <button
                type="button"
                disabled={sampleBusy}
                onClick={() => setSampleModalOpen(false)}
                className="rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-4 py-2 text-xs text-[#263448] hover:bg-[#FAF8F3] cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={!sampleConfirmChecked || sampleBusy}
                onClick={() => void handleExecuteSampleCleanup()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] disabled:opacity-50 cursor-pointer"
              >
                <Eraser className="h-3.5 w-3.5" />
                <span>
                  {sampleBusy
                    ? 'در حال پشتیبان‌گیری و پاکسازی...'
                    : 'تهیه پشتیبان و پاکسازی اطلاعات آزمایشی'}
                </span>
              </button>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Modal B: Full Data Wipe Confirmation (High Friction) */}
      {wipeModalOpen && fullInfo && (
        <FloatingWindow
          title="تأیید چندمرحله‌ای پاکسازی کامل اطلاعات"
          onClose={() => !wipeBusy && setWipeModalOpen(false)}
          width={560}
        >
          <div className="space-y-4 text-xs leading-6 text-[#263448]">
            <div className="flex items-start gap-2.5 rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3.5 py-3 text-[#9E3B3B]">
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
              <div>
                <strong>هشدار عملیات حساس:</strong> تمامی رکوردهای عملیاتی این دستگاه (هم آزمایشی و هم
                واقعی) حذف خواهند شد. پیش از حذف، یک فایل پشتیبان کامل (ZIP) به‌طور خودکار ذخیره می‌شود.
              </div>
            </div>

            <div className="space-y-1.5">
              <div className="font-semibold text-[#1D3250]">
                خلاصه کل اطلاعاتی که از این دستگاه حذف می‌شوند ({toPersianDigits(fullInfo.totalRecords)}{' '}
                رکورد):
              </div>
              <ul className="grid grid-cols-2 gap-1.5 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-3 tabular-nums">
                <li>پرونده پروژه‌ها: {toPersianDigits(fullInfo.counts.projects)}</li>
                <li>ردیف‌های بودجه: {toPersianDigits(fullInfo.counts.budgets)}</li>
                <li>سوابق پرداخت: {toPersianDigits(fullInfo.counts.payments)}</li>
                <li>پیشنهادهای بودجه: {toPersianDigits(fullInfo.counts.proposals)}</li>
                <li>اقدامات و پیگیری‌ها: {toPersianDigits(fullInfo.counts.actions)}</li>
                <li>اسناد و مکاتبات: {toPersianDigits(fullInfo.counts.documents)}</li>
                <li>فایل‌های پیوست: {toPersianDigits(fullInfo.counts.attachments)}</li>
                <li>اشخاص و امضاها: {toPersianDigits(fullInfo.counts.people)}</li>
                <li>فرم‌های پرشده: {toPersianDigits(fullInfo.counts.formSubmissions)}</li>
                <li>تصاویر پروژه‌ها: {toPersianDigits(fullInfo.counts.projectImages)}</li>
              </ul>
            </div>

            <div className="rounded-lg border border-[#C6D5C4] bg-[#E7ECE6]/70 px-3.5 py-2.5 text-[11px] text-[#263448]">
              تنظیمات برنامه، سربرگ، {toPersianDigits(fullInfo.referenceFormTemplatesCount)} قالب فرم
              مرجع، ساختار پایگاه داده و اطلاعات سایر دستگاه‌ها دست‌نخورده باقی می‌مانند.
            </div>

            <label className="flex items-start gap-2.5 cursor-pointer">
              <input
                type="checkbox"
                checked={wipeConfirmChecked}
                onChange={(e) => setWipeConfirmChecked(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#9E3B3B]"
              />
              <span className="font-medium text-[#9E3B3B]">
                آگاه هستم که تمامی اطلاعات عملیاتی همین دستگاه حذف می‌شود و این اقدام را تأیید می‌کنم.
              </span>
            </label>

            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">
                برای فعال‌شدن دکمه حذف، عبارت{' '}
                <strong className="text-[#9E3B3B]">{FULL_WIPE_PHRASE}</strong> را دقیقاً وارد کنید:
              </label>
              <input
                type="text"
                value={wipePhraseInput}
                onChange={(e) => setWipePhraseInput(e.target.value)}
                placeholder={FULL_WIPE_PHRASE}
                className="w-full rounded-lg border border-[#D8B4B4] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448] focus:border-[#9E3B3B] focus:outline-none"
              />
            </div>

            <div className="flex justify-end gap-2 border-t border-[#E8E5DE] pt-3">
              <button
                type="button"
                disabled={wipeBusy}
                onClick={() => setWipeModalOpen(false)}
                className="rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-4 py-2 text-xs text-[#263448] hover:bg-[#FAF8F3] cursor-pointer"
              >
                انصراف
              </button>
              <button
                type="button"
                disabled={
                  !wipeConfirmChecked || wipePhraseInput.trim() !== FULL_WIPE_PHRASE || wipeBusy
                }
                onClick={() => void handleExecuteFullWipe()}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#9E3B3B] bg-[#9E3B3B] px-4 py-2 text-xs font-medium text-[#FFFFFF] hover:opacity-90 disabled:opacity-40 cursor-pointer"
              >
                <Trash2 className="h-3.5 w-3.5" />
                <span>
                  {wipeBusy ? 'در حال پشتیبان‌گیری و پاکسازی کامل...' : 'تهیه پشتیبان و پاکسازی کامل'}
                </span>
              </button>
            </div>
          </div>
        </FloatingWindow>
      )}
    </div>
  );
};
