import React, { useEffect, useRef, useState } from 'react';
import {
  Archive,
  Download,
  FileJson,
  HelpCircle,
  History,
  RotateCcw,
  Save,
  Trash2,
  Upload,
} from 'lucide-react';
import { AppearanceConfig } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { DEFAULT_APPEARANCE, MASTER_STAGE_CATALOG } from '../../db/seedData';
import { createFullZipBackup, restoreFullZipBackup } from '../../utils/backupSync';
import { formatJalaliDateTime, toPersianDigits } from '../../utils/format';
import { applyAppearanceToDocument, resolveAppearance } from '../../utils/themeEngine';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { PeopleManager } from './PeopleManager';
import { MediaManagerView } from './MediaManagerView';
import { JsonExportWindow, JsonImportWindow } from './JsonTransferWindows';
import { HelpCenterView } from '../help/HelpCenterView';
import { HelpSectionId } from '../help/helpContent';
import { AppearanceSettingsPanel } from './AppearanceSettingsPanel';
import { AppUpdatePanel } from './AppUpdatePanel';

export type SupportTab = 'settings' | 'media' | 'transfer' | 'backup' | 'people' | 'guide';

interface SupportViewProps {
  store: AppStore;
  initialTab?: SupportTab;
  initialHelpSection?: HelpSectionId | null;
  onTabChange?: (tab: SupportTab) => void;
  onHelpSectionChange?: (section: HelpSectionId | null) => void;
}

export const SupportView: React.FC<SupportViewProps> = ({
  store,
  initialTab = 'settings',
  initialHelpSection = null,
  onTabChange,
  onHelpSectionChange,
}) => {
  const [tab, setTab] = useState<SupportTab>(initialTab);
  const [deviceName, setDeviceName] = useState(store.settings.deviceName);
  const [orgName, setOrgName] = useState(store.settings.letterhead.organizationName);
  const [unitName, setUnitName] = useState(store.settings.letterhead.unitName);
  const [subtitle, setSubtitle] = useState(store.settings.letterhead.subtitle);
  const [authEnabled, setAuthEnabled] = useState(store.settings.auth.enabled);
  const [selectedProcessType, setSelectedProcessType] = useState('عمرانی');
  const [processTemplates, setProcessTemplates] = useState(store.settings.processTemplates);
  const [appearance, setAppearance] = useState<AppearanceConfig>(() =>
    resolveAppearance(store.settings.appearance)
  );

  const [openExportWindow, setOpenExportWindow] = useState(false);
  const [openImportWindow, setOpenImportWindow] = useState(false);

  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');
  const [confirmClearSamples, setConfirmClearSamples] = useState(false);
  const [rollbackTargetId, setRollbackTargetId] = useState<string | null>(null);

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const savedAppearanceRef = useRef(store.settings.appearance);
  savedAppearanceRef.current = store.settings.appearance;

  // Live preview of appearance changes immediately across the entire application
  useEffect(() => {
    applyAppearanceToDocument(appearance);
  }, [appearance]);

  // Restore persisted theme if the user navigates away without saving preview changes
  useEffect(() => {
    return () => {
      applyAppearanceToDocument(savedAppearanceRef.current);
    };
  }, []);

  const handleSaveAppearanceNow = async (nextAppearance: AppearanceConfig) => {
    const resolved = resolveAppearance(nextAppearance);
    setAppearance(resolved);
    await store.saveSettings({
      ...store.settings,
      appearance: resolved,
    });
    setNotice('پالت رنگی و تنظیمات ظاهری با موفقیت روی کل نرم‌افزار ذخیره شد.');
    setError('');
  };

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
      appearance: resolveAppearance(appearance),
    });
    setNotice('تنظیمات ظاهری و سازمانی با موفقیت در حافظه محلی دستگاه ذخیره شد.');
    setError('');
  };

  const handleResetAppearance = async () => {
    const resetVal = { ...DEFAULT_APPEARANCE };
    setAppearance(resetVal);
    await store.saveSettings({
      ...store.settings,
      appearance: resetVal,
    });
    setNotice('ظاهر نرم‌افزار به پالت پیش‌فرض سرمه‌ای و طلایی بازگردانده شد.');
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
    setNotice(
      'فایل پشتیبان کامل (.zip شامل اطلاعات، تصاویر گلزار، تصاویر پروژه‌ها و پیوست‌ها) تولید و بارگیری شد.'
    );
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
        `بازیابی کامل با موفقیت انجام شد (${toPersianDigits(res.restoredCounts.projects)} پروژه، ${toPersianDigits(res.restoredCounts.documents)} سند، ${toPersianDigits(res.restoredCounts.attachments)} پیوست، ${toPersianDigits(res.restoredCounts.golzarImages + res.restoredCounts.projectImages)} تصویر). یک نقطه بازگشت خودکار ذخیره شد.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'خطا در بازیابی نسخه پشتیبان');
    } finally {
      e.target.value = '';
    }
  };

  return (
    <div className="animate-page-in mx-auto max-w-[1280px] space-y-5 px-4 py-5 sm:px-6">
      {/* Settings Tabs — hidden on Help page so no duplicate top navigation appears */}
      {tab !== 'guide' && (
        <div className="grid grid-cols-2 gap-2 rounded-2xl border border-[#E2DDD2] bg-[#FFFFFF] p-3 sm:grid-cols-3 lg:grid-cols-5">
          {(
            [
              { key: 'settings', label: 'تنظیمات ظاهری و سازمانی' },
              { key: 'media', label: 'مدیریت تصاویر و آرم رسمی' },
              { key: 'transfer', label: 'ورودی و خروجی JSON' },
              { key: 'backup', label: 'پشتیبان‌گیری و بازیابی (ZIP)' },
              { key: 'people', label: `اشخاص و امضاها (${toPersianDigits(store.people.length)})` },
            ] as Array<{ key: SupportTab; label: string }>
          ).map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => {
                setTab(t.key);
                setNotice('');
                setError('');
                onTabChange?.(t.key);
              }}
              className={`inline-flex min-h-[40px] items-center justify-center rounded-xl px-2.5 py-2 text-center text-xs font-medium leading-4 transition-colors cursor-pointer ${
                tab === t.key
                  ? 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                  : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#263448] hover:bg-[#F2EEE6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {notice && (
        <div className="rounded-lg border border-[#C6D5C4] bg-[#E7ECE6] px-4 py-3 text-xs text-[#263448]">
          {notice}
        </div>
      )}
      {error && (
        <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9E3B3B]">
          {error}
        </div>
      )}

      {/* Tab 1: Software Update (GitHub/PWA), Multi-Palette Appearance & Org Settings */}
      {tab === 'settings' && (
        <form onSubmit={handleSaveSettings} className="space-y-5">
          {/* Software Update & Installable PWA Icon Card */}
          <AppUpdatePanel />

          {/* Redesigned Multi-Palette Appearance Customizer */}
          <AppearanceSettingsPanel
            value={appearance}
            savedValue={store.settings.appearance}
            onChange={setAppearance}
            onSaveNow={handleSaveAppearanceNow}
            onReset={handleResetAppearance}
          />

          {/* Device Identity & Letterhead */}
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
            <h3 className="text-sm font-semibold text-[#243B5A]">
              هویت دستگاه و سربرگ پیش‌فرض گزارش‌ها و فرم‌ها
            </h3>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">
                  نام این دستگاه (درج‌شده در فایل خروجی JSON)
                </label>
                <input
                  type="text"
                  value={deviceName}
                  onChange={(e) => setDeviceName(e.target.value)}
                  className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                />
                <div className="mt-1 text-[11px] text-[#788290]">
                  شناسه محلی دستگاه: {store.settings.deviceId}
                </div>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">عنوان سازمان در سربرگ</label>
                <input
                  type="text"
                  value={orgName}
                  onChange={(e) => setOrgName(e.target.value)}
                  className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">واحد / اداره</label>
                <input
                  type="text"
                  value={unitName}
                  onChange={(e) => setUnitName(e.target.value)}
                  className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">زیرعنوان سربرگ</label>
                <input
                  type="text"
                  value={subtitle}
                  onChange={(e) => setSubtitle(e.target.value)}
                  className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                />
              </div>
            </div>
          </div>

          {/* Configurable Project Process Templates */}
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h3 className="text-sm font-semibold text-[#243B5A]">
                  الگوی مراحل اجرای پروژه بر اساس نوع پروژه
                </h3>
                <p className="mt-0.5 text-xs text-[#5B6573]">
                  مراحل پیش‌فرض هر نوع پروژه (فرهنگی، عمرانی، بهسازی، مرمت) را تنظیم کنید.
                </p>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {['عمرانی', 'بهسازی', 'مرمت', 'فرهنگی'].map((t) => (
                  <button
                    key={t}
                    type="button"
                    onClick={() => setSelectedProcessType(t)}
                    className={`rounded-lg px-3 py-1 text-xs cursor-pointer ${
                      selectedProcessType === t
                        ? 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                        : 'border border-[#E2DDD2] bg-[#FAF8F3] text-[#263448]'
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
                    className="flex items-center gap-2 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] px-3 py-2 text-xs text-[#263448] cursor-pointer"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleStageInTemplate(selectedProcessType, st.key)}
                      className="h-4 w-4 accent-[#243B5A]"
                    />
                    <span>
                      {toPersianDigits(idx + 1)}. {st.title}
                    </span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* Auth Architecture */}
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-3">
            <h3 className="text-sm font-semibold text-[#243B5A]">
              معماری ورود و خروج (پیش‌فرض غیرفعال)
            </h3>
            <label className="flex items-center gap-2.5 text-xs text-[#263448] cursor-pointer">
              <input
                type="checkbox"
                checked={authEnabled}
                onChange={(e) => setAuthEnabled(e.target.checked)}
                className="h-4 w-4 accent-[#243B5A]"
              />
              <span>فعال‌سازی صفحه ورود آزمایشی هنگام آغاز برنامه (auth.enabled)</span>
            </label>
            <p className="text-xs leading-6 text-[#788290]">
              در حالت استاندارد مقدار <code>auth.enabled = false</code> است و برنامه مستقیماً باز
              می‌شود.
            </p>
          </div>

          <div className="flex justify-end">
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-5 py-2.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
            >
              <Save className="h-4 w-4" />
              <span>ذخیره تنظیمات</span>
            </button>
          </div>
        </form>
      )}

      {/* Tab 2: Media Manager (Golzar Gallery + Project Images + Official Logo) */}
      {tab === 'media' && <MediaManagerView store={store} />}

      {/* Tab 3: JSON Data Transfer ONLY (Section 8 — Two Dedicated Windows, Zero WebRTC) */}
      {tab === 'transfer' && (
        <div className="space-y-5">
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
                <FileJson className="h-4 w-4 text-[#B99A62]" />
                <span>انتقال اطلاعات بین دستگاه‌ها (فایل JSON)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab('guide');
                  onTabChange?.('guide');
                }}
                aria-label="راهنمای انتقال اطلاعات"
                title="راهنمای انتقال اطلاعات"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-6 text-[#5B6573]">
              خروجی JSON از دستگاه مبدأ، انتقال فایل (ایتا یا USB) و ورود تأییدشده در دستگاه مقصد.
            </p>
            <div className="text-xs text-[#788290]">
              آخرین همگام‌سازی JSON ثبت‌شده:{' '}
              {store.settings.lastSyncAt
                ? formatJalaliDateTime(store.settings.lastSyncAt)
                : 'هنوز انتقالی ثبت نشده است'}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {/* Export JSON Card */}
            <div className="flex flex-col justify-between rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
                  <Download className="h-4 w-4 text-[#243B5A]" />
                  <span>خروجی JSON</span>
                </div>
                <p className="text-xs leading-6 text-[#5B6573]">
                  تولید فایل JSON شامل داده‌ها، تصاویر و پیوست‌ها پس از مشاهده خلاصه و تأیید کاربر.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenExportWindow(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
              >
                <Download className="h-4 w-4" />
                <span>گشودن پنجره خروجی JSON</span>
              </button>
            </div>

            {/* Import JSON Card */}
            <div className="flex flex-col justify-between rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
              <div className="space-y-1.5">
                <div className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
                  <Upload className="h-4 w-4 text-[#243B5A]" />
                  <span>ورودی JSON</span>
                </div>
                <p className="text-xs leading-6 text-[#5B6573]">
                  پیش‌بررسی ساختار فایل، مدیریت تعارض‌ها و ثبت امن در حافظه محلی صرفاً پس از تأیید.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setOpenImportWindow(true)}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-[#243B5A] bg-[#E5EBF2] px-4 py-2.5 text-xs font-medium text-[#243B5A] hover:bg-[#243B5A] hover:text-[#FAF8F3] cursor-pointer"
              >
                <Upload className="h-4 w-4" />
                <span>گشودن پنجره ورودی JSON</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Full Backup & Restore (ZIP) + Rollback */}
      {tab === 'backup' && (
        <div className="space-y-5">
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
                <Archive className="h-4 w-4 text-[#B99A62]" />
                <span>پشتیبان‌گیری و بازیابی کامل (ZIP)</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setTab('guide');
                  onTabChange?.('guide');
                }}
                aria-label="راهنمای پشتیبان‌گیری"
                title="راهنمای پشتیبان‌گیری"
                className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              >
                <HelpCircle className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs leading-6 text-[#5B6573]">
              فایل پشتیبان کامل (<code>.zip</code>) شامل تمام اطلاعات، تصاویر و پیوست‌هاست؛ پیش از هر
              بازیابی نقطه بازگشت خودکار ذخیره می‌شود.
            </p>

            <div className="text-xs text-[#788290]">
              آخرین پشتیبان‌گیری ثبت‌شده:{' '}
              {store.settings.lastBackupAt
                ? formatJalaliDateTime(store.settings.lastBackupAt)
                : 'هنوز پشتیبان‌گیری انجام نشده است'}
            </div>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={handleFullBackup}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>دریافت فایل پشتیبان کامل (ZIP)</span>
              </button>

              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#263448] hover:bg-[#E5EBF2] cursor-pointer">
                <Upload className="h-3.5 w-3.5 text-[#243B5A]" />
                <span>بازیابی از فایل پشتیبان (ZIP)</span>
                <input type="file" accept=".zip" onChange={handleRestoreZip} className="hidden" />
              </label>
            </div>
          </div>

          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-3">
            <div className="flex items-center gap-2 text-sm font-semibold text-[#243B5A]">
              <History className="h-4 w-4 text-[#354F73]" />
              <span>نقاط بازگشت به وضعیت قبلی ({toPersianDigits(store.snapshots.length)})</span>
            </div>

            {store.snapshots.length === 0 ? (
              <div className="text-xs text-[#788290]">
                هنوز نقطه بازگشتی ثبت نشده است. هنگام اجرای اولین بازیابی نسخه پشتیبان، وضعیت قبلی
                به‌صورت خودکار اینجا نگهداری می‌شود.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DE] rounded-lg border border-[#E2DDD2]">
                {store.snapshots.map((snap) => (
                  <div
                    key={snap.id}
                    className="flex flex-wrap items-center justify-between gap-3 p-3.5 text-xs"
                  >
                    <div>
                      <div className="font-medium text-[#263448]">{snap.reason}</div>
                      <div className="mt-0.5 text-[#788290]">
                        زمان ثبت: {formatJalaliDateTime(snap.createdAt)} · پروژه‌ها:{' '}
                        {toPersianDigits(snap.data.projects.length)} · اسناد:{' '}
                        {toPersianDigits(snap.data.documents.length)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setRollbackTargetId(snap.id)}
                      className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#FAF8F3] px-3 py-1.5 text-xs text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
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

      {/* Tab 5: People & Signatures */}
      {tab === 'people' && <PeopleManager store={store} />}

      {/* Tab 6: Unified Help Center + Software Version, PWA Install & Sample Data Controls */}
      {tab === 'guide' && (
        <div className="space-y-5">
          <HelpCenterView
            initialSection={initialHelpSection}
            onSectionChange={onHelpSectionChange}
          />

          {/* Software Version, GitHub Update, PWA Install & Sample Data Controls */}
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AppUpdatePanel compact />

            <div className="flex flex-col justify-between rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-3">
              <div className="space-y-1.5">
                <h3 className="text-sm font-semibold text-[#243B5A]">مدیریت داده‌های نمونه آزمایشی</h3>
                <p className="text-xs leading-6 text-[#5B6573]">
                  حذف داده‌های نمونه هیچ تأثیری بر پرونده‌ها و اطلاعات واقعی ثبت‌شده توسط شما ندارد.
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2.5 pt-1">
                {store.hasSampleData ? (
                  <button
                    type="button"
                    onClick={() => setConfirmClearSamples(true)}
                    className="inline-flex items-center gap-1.5 rounded-lg border border-[#9E3B3B] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    <span>حذف تمام داده‌های نمونه آزمایشی</span>
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={async () => {
                      await store.loadSampleDataNow();
                      setNotice('داده‌های نمونه آزمایشی بارگذاری شدند.');
                    }}
                    className="rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                  >
                    بارگذاری مجدد داده‌های نمونه آزمایشی
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Independent Floating Windows for JSON Export & Import (Section 8) */}
      {openExportWindow && (
        <JsonExportWindow store={store} onClose={() => setOpenExportWindow(false)} />
      )}
      {openImportWindow && (
        <JsonImportWindow store={store} onClose={() => setOpenImportWindow(false)} />
      )}

      <ConfirmDialog
        open={confirmClearSamples}
        title="حذف داده‌های نمونه آزمایشی"
        message="آیا می‌خواهید تمام رکوردهای نمونه آزمایشی حذف شوند؟ داده‌های واقعی ثبت‌شده توسط شما دست‌نخورده باقی می‌مانند."
        confirmLabel="حذف داده‌های نمونه"
        danger
        onCancel={() => setConfirmClearSamples(false)}
        onConfirm={async () => {
          const removed = await store.removeSampleDataNow();
          setConfirmClearSamples(false);
          setNotice(`${toPersianDigits(removed)} رکورد نمونه آزمایشی با موفقیت حذف شد.`);
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
