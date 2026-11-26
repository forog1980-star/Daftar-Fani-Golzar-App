import React, { useState } from 'react';
import {
  Archive,
  Download,
  History,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppStore } from '../../hooks/useAppStore';
import { MASTER_STAGE_CATALOG } from '../../db/seedData';
import { createFullZipBackup, restoreFullZipBackup } from '../../utils/backupSync';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/format';
import { PWAInstallButton } from '../layout/PWAInstallButton';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { PeopleManager } from './PeopleManager';
import { SyncConflictView } from './SyncConflictView';

interface SupportViewProps {
  store: AppStore;
}

type SupportTab = 'settings' | 'people' | 'backup' | 'sync' | 'guide';

export const SupportView: React.FC<SupportViewProps> = ({ store }) => {
  const [tab, setTab] = useState<SupportTab>('settings');
  const [deviceName, setDeviceName] = useState(store.settings.deviceName);
  const [orgName, setOrgName] = useState(store.settings.letterhead.organizationName);
  const [unitName, setUnitName] = useState(store.settings.letterhead.unitName);
  const [subtitle, setSubtitle] = useState(store.settings.letterhead.subtitle);
  const [authEnabled, setAuthEnabled] = useState(store.settings.auth.enabled);
  const [selectedProcessType, setSelectedProcessType] = useState('عمرانی');
  const [processTemplates, setProcessTemplates] = useState(store.settings.processTemplates);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmClearSamples, setConfirmClearSamples] = useState(false);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    await store.saveSettings({
      ...store.settings,
      deviceName: deviceName.trim() || store.settings.deviceName,
      auth: {
        ...store.settings.auth,
        enabled: authEnabled,
      },
      letterhead: {
        ...store.settings.letterhead,
        organizationName: orgName.trim(),
        unitName: unitName.trim(),
        subtitle: subtitle.trim(),
      },
      processTemplates,
    });
    setNotice('تنظیمات نرم‌افزار در حافظه محلی دستگاه ذخیره شد.');
    setError('');
  };

  const toggleStageInTemplate = (type: string, stageKey: string) => {
    const current = new Set(processTemplates[type] ?? []);
    if (current.has(stageKey)) current.delete(stageKey);
    else current.add(stageKey);
    setProcessTemplates((prev) => ({
      ...prev,
      [type]: Array.from(current),
    }));
  };

  const handleFullBackup = async () => {
    setError('');
    await createFullZipBackup(store.settings.deviceId, store.settings.deviceName);
    await store.saveSettings({
      ...store.settings,
      lastBackupAt: new Date().toISOString(),
    });
    setNotice('فایل پشتیبان کامل (.zip شامل داده‌های JSON و تمام فایل‌های پیوست) تولید و بارگیری شد.');
  };

  const handleRestoreZip = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setNotice('');
    try {
      const res = await restoreFullZipBackup(file, store.settings.deviceId);
      await store.refresh();
      setNotice(
        `بازیابی کامل با موفقیت انجام شد (${toPersianDigits(res.restoredCounts.projects)} پروژه، ${toPersianDigits(res.restoredCounts.documents)} سند، ${toPersianDigits(res.restoredCounts.attachments)} پیوست). یک نسخه خودکار از وضعیت قبلی برای امکان بازگشت ذخیره گردید.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بازیابی نسخه پشتیبان');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
      {/* Support Navigation Tabs */}
      <div className="flex flex-wrap gap-1.5 border border-[#E2DDD0] bg-[#FFFFFF] p-3">
        {(
          [
            { key: 'settings', label: 'تنظیمات، فرایندها و ورود' },
            { key: 'people', label: `اشخاص و امضاها (${toPersianDigits(store.people.length)})` },
            { key: 'backup', label: 'پشتیبان‌گیری و بازیابی کامل' },
            { key: 'sync', label: 'ارتباط دستگاه‌ها و رفع تعارض' },
            { key: 'guide', label: 'راهنما، نصب PWA و داده‌های آزمایشی' },
          ] as Array<{ key: SupportTab; label: string }>
        ).map((t) => (
          <button
            key={t.key}
            type="button"
            onClick={() => {
              setTab(t.key);
              setNotice('');
              setError('');
            }}
            className={`px-3.5 py-2 text-xs font-medium cursor-pointer ${
              tab === t.key
                ? 'border border-[#2D5A63] bg-[#E5EFF0] text-[#2D5A63]'
                : 'border border-transparent text-[#5B6268] hover:bg-[#F3EFE6]'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {notice && (
        <div className="border border-[#D5DEC8] bg-[#F2F6EE] px-4 py-3 text-xs text-[#2D6A4F]">
          {notice}
        </div>
      )}
      {error && (
        <div className="border border-[#DFC0C0] bg-[#FAF0F0] px-4 py-3 text-xs text-[#B43E3E]">
          {error}
        </div>
      )}

      {/* Tab 1: Settings, Process Templates & Auth toggle */}
      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-5">
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              هویت دستگاه و سربرگ پیش‌فرض گزارش‌ها و فرم‌ها
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">نام این دستگاه (برای همگام‌سازی)</label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
                <div className="mt-1 text-[11px] text-[#7C8287]">
                  شناسه محلی دستگاه: {store.settings.deviceId}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">عنوان سازمان در سربرگ</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">واحد / اداره</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">زیرعنوان سربرگ</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
          </div>

          {/* Configurable Project Process Templates */}
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#2B3033]">
                  الگوی مراحل اجرای پروژه بر اساس نوع پروژه
                </h3>
                <p className="mt-0.5 text-xs text-[#5B6268]">
                  مراحل پیش‌فرض هر نوع پروژه (فرهنگی، عمرانی، بهسازی، مرمت) را تنظیم کنید.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['عمرانی', 'بهسازی', 'مرمت', 'فرهنگی'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedProcessType(t)}
                    className={`px-3 py-1 text-xs cursor-pointer ${
                      selectedProcessType === t
                        ? 'border border-[#2D5A63] bg-[#E5EFF0] text-[#2D5A63]'
                        : 'border border-[#E2DDD0] bg-[#FAF8F3] text-[#5B6268]'
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {MASTER_STAGE_CATALOG.map((st, idx) => {
                const checked = (processTemplates[selectedProcessType] ?? []).includes(st.key);
                return (
                  <label
                    key={st.key}
                    className="flex items-center gap-2 border border-[#ECE7DA] bg-[#FAF8F3] px-3 py-2 text-xs text-[#2B3033] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStageInTemplate(selectedProcessType, st.key)}
                      className="h-4 w-4 accent-[#2D5A63]"
                    />
                    <span>
                      {toPersianDigits(idx + 1)}. {st.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Auth Architecture (Section 16) */}
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              معماری ورود و خروج (پیش‌فرض غیرفعال)
            </h3>
            <label className="flex items-center gap-2.5 text-xs text-[#2B3033] cursor-pointer">
              <input
                type="checkbox"
                checked={authEnabled}
                onChange={(e) => setAuthEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#2D5A63]"
              />
              <span>فعال‌سازی صفحه ورود آزمایشی هنگام آغاز برنامه (auth.enabled)</span>
            </label>
            <p className="text-xs leading-6 text-[#7C8287]">
              در حالت استاندارد مقدار <code>auth.enabled = false</code> است و برنامه مستقیماً باز می‌شود.
              در صورت فعال‌سازی جهت آزمایش داخلی، مقادیر آزمایشی <code>000 / 000</code> صرفاً برای تست
              ساختار ورود هستند و امنیت واقعی محسوب نمی‌شوند.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-5 py-2.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>ذخیره تنظیمات</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: People & Signatures */}
      {tab === 'people' && <PeopleManager store={store} />}

      {/* Tab 3: Full Backup & Restore + Rollback */}
      {tab === 'backup' && (
        <div className="space-y-5">
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2B3033]">
              <Archive className="h-4 w-4 text-[#2D5A63]" />
              <span>پشتیبان‌گیری و بازیابی کامل (JSON + تمام فایل‌های پیوست)</span>
            </div>
            <p className="text-xs leading-6 text-[#5B6268]">
              نسخه پشتیبان به‌صورت فایل فشرده <code>.zip</code> شامل تمام اطلاعات ساخت‌یافته و
              فایل‌های پیوست (PDF، Word، Excel و تصاویر) تولید می‌شود. پیش از هر بازیابی، وضعیت فعلی
              به‌طور خودکار ذخیره می‌شود تا در صورت نیاز امکان بازگشت به وضعیت قبلی وجود داشته باشد.
            </p>

            <div className="text-xs text-[#7C8287]">
              آخرین پشتیبان‌گیری ثبت‌شده:{' '}
              {store.settings.lastBackupAt
                ? formatJalaliDateTime(store.settings.lastBackupAt)
                : 'هنوز پشتیبان‌گیری انجام نشده است'}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleFullBackup}
                className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>دریافت فایل پشتیبان کامل (ZIP)</span>
              </button>

              <label className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-[#2D5A63]" />
                <span>بازیابی از فایل پشتیبان (ZIP)</span>
                <input type="file" accept=".zip" onChange={handleRestoreZip} className="hidden" />
              </label>
            </div>
          </div>

          {/* Rollback Snapshots */}
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#2B3033]">
              <History className="h-4 w-4 text-[#2D5A63]" />
              <span>نقاط بازگشت به وضعیت قبلی ({toPersianDigits(store.snapshots.length)})</span>
            </div>

            {store.snapshots.length === 0 ? (
              <div className="text-xs text-[#7C8287]">
                هنوز نقطه بازگشتی ثبت نشده است. هنگام اجرای اولین بازیابی نسخه پشتیبان، وضعیت قبلی
                به‌صورت خودکار در اینجا نگهداری می‌شود.
              </div>
            ) : (
              <div className="divide-y divide-[#ECE7DA] border border-[#E2DDD0]">
                {store.snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#2B3033]">{snap.reason}</div>
                      <div className="mt-0.5 text-[#7C8287]">
                        زمان ثبت: {formatJalaliDateTime(snap.createdAt)} · پروژه‌ها:{' '}
                        {toPersianDigits(snap.data.projects.length)} · اسناد:{' '}
                        {toPersianDigits(snap.data.documents.length)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRollbackTargetId(snap.id)}
                      className="inline-flex items-center gap-1 border border-[#2D5A63] bg-[#FAF8F3] px-3 py-1.5 text-xs text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
                    >
                      <RotateCcw className="h-3.5 w-3.5" />
                      <span>بازگشت به این وضعیت</span>
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tab 4: Device Sync & Conflict Resolution */}
      {tab === 'sync' && <SyncConflictView store={store} />}

      {/* Tab 5: PWA Install, Sample Data Control & User Guide */}
      {tab === 'guide' && (
        <div className="space-y-5">
          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              نصب نرم‌افزار (PWA) و کارکرد آفلاین
            </h3>
            <p className="text-xs leading-6 text-[#5B6268]">
              این نرم‌افزار با معماری Local-First و Service Worker طراحی شده است و پس از نصب روی
              موبایل یا رایانه بدون نیاز به اینترنت و بدون ذخیره اطلاعات در سرور ابری کار می‌کند.
            </p>
            <div className="pt-1">
              <PWAInstallButton />
            </div>
          </div>

          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              مدیریت داده‌های آزمایشی نمونه
            </h3>
            <p className="text-xs leading-6 text-[#5B6268]">
              داده‌های نمونه صرفاً جهت آزمایش و ارزیابی امکانات نرم‌افزار درج شده‌اند و به‌هیچ‌وجه
              اطلاعات واقعی اداره گلزار شهدا محسوب نمی‌شوند. با حذف داده‌های نمونه، اطلاعاتی که خود
              شما ثبت کرده‌اید کاملاً محفوظ می‌مانند.
            </p>
            <div className="flex flex-wrap items-center gap-2.5 pt-1">
              {store.hasSampleData ? (
                <button
                  type="button"
                  onClick={() => setConfirmClearSamples(true)}
                  className="inline-flex items-center gap-1.5 border border-[#B43E3E] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#B43E3E] hover:bg-[#FAF0F0] cursor-pointer"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                  <span>حذف تمام داده‌های آزمایشی نمونه</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={async () => {
                    await store.loadSampleDataNow();
                    setNotice('داده‌های آزمایشی نمونه بارگذاری شدند.');
                  }}
                  className="border border-[#CEC7B6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
                >
                  بارگذاری مجدد داده‌های آزمایشی نمونه
                </button>
              )}
            </div>
          </div>

          <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-2.5">
            <h3 className="text-sm font-semibold text-[#2B3033]">راهنمای سریع استفاده</h3>
            <ol className="list-decimal list-inside space-y-1.5 text-xs leading-6 text-[#5B6268]">
              <li>در بخش «پرونده پروژه‌ها»، پروژه جدید ثبت کرده و مراحل اجرایی متناسب با نوع پروژه را فعال یا تکمیل کنید.</li>
              <li>در بخش «بودجه و اعتبارات»، ارقام مصوب/تخصیصی و پرداخت‌ها را ثبت کنید تا مانده اعتبار و نسبت پیشرفت فیزیکی به تأمین اعتبار محاسبه شود.</li>
              <li>در بخش «اقدامات و پیگیری‌ها»، مهلت‌ها و اولویت‌ها را مدیریت کنید تا هشدارهای واقعی در داشبورد نمایش داده شوند.</li>
              <li>در بخش «اسناد و مکاتبات»، نامه‌ها و پیوست‌های محلی را بایگانی کنید و از تب «فرم‌ساز سازمانی» فایل‌های Word/Excel را به قالب قابل تکمیل تبدیل کنید یا دو فرم مرجع را تکمیل نمایید.</li>
              <li>در بخش «گزارش‌ها»، خروجی Word و Excel راست‌چین با فونت Zar اندازه ۱۴ پوینت یا PDF و JSON دریافت کنید.</li>
              <li>در دسکتاپ، پنجره‌های ثبت و ویرایش به‌صورت شناور و قابل جابه‌جایی از نوار عنوان هستند.</li>
            </ol>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={confirmClearSamples}
        title="حذف داده‌های آزمایشی نمونه"
        message="آیا می‌خواهید تمام رکوردهای آزمایشی نمونه حذف شوند؟ داده‌های واقعی ثبت‌شده توسط شما دست‌نخورده باقی می‌مانند."
        confirmLabel="حذف داده‌های نمونه"
        danger
        onCancel={() => setConfirmClearSamples(false)}
        onConfirm={async () => {
          const removed = await store.removeSampleDataNow();
          setConfirmClearSamples(false);
          setNotice(`${toPersianDigits(removed)} رکورد آزمایشی نمونه با موفقیت حذف شد.`);
        }}
      />

      <ConfirmDialog
        open={Boolean(rollbackTargetId)}
        title="بازگشت به وضعیت قبلی"
        message="آیا مطمئن هستید که می‌خواهید داده‌های فعلی به وضعیت ذخیره‌شده در این نقطه بازگشت برگردانده شوند؟"
        confirmLabel="تأیید بازگشت"
        onCancel={() => setRollbackTargetId(null)}
        onConfirm={async () => {
          if (rollbackTargetId) {
            await store.rollbackToSnapshot(rollbackTargetId);
            setRollbackTargetId(null);
            setNotice('بازگشت به وضعیت قبلی با موفقیت انجام شد.');
          }
        }}
      />
    </div>
  );
};
