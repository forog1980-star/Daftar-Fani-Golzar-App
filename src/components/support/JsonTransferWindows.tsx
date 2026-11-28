import React, { useEffect, useState } from 'react';
import { CheckCircle2, Download, FileJson, Share2, Upload } from 'lucide-react';
import { SyncConflict, SyncEntityStore, SyncPackage } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  analyzeIncomingSyncPackage,
  applyApprovedSyncDecisions,
  buildSyncPackage,
  SyncAnalysisResult,
} from '../../utils/backupSync';
import {
  formatFileSize,
  formatJalaliDateTime,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { estimateJsonSizeBytes } from '../../utils/imageMedia';
import { saveBinaryFile } from '../../utils/platformBridge';
import { FloatingWindow } from '../layout/FloatingWindow';

const STORE_LABELS: Record<SyncEntityStore, string> = {
  projects: 'پرونده پروژه',
  budgets: 'بودجه و اعتبارات',
  payments: 'سابقه پرداخت',
  proposals: 'پیشنهاد بودجه',
  actions: 'اقدام و پیگیری',
  documents: 'سند / مکاتبه',
  people: 'اشخاص و امضاها',
  formTemplates: 'قالب فرم',
  formSubmissions: 'فرم تکمیل‌شده',
};

// Window 1: Dedicated JSON Export Window (Section 8)
export const JsonExportWindow: React.FC<{
  store: AppStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const [includeMedia, setIncludeMedia] = useState(true);
  const [includeAttachments, setIncludeAttachments] = useState(true);
  const [pkgPreview, setPkgPreview] = useState<{
    pkg: SyncPackage;
    sizeBytes: number;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [confirmed, setConfirmed] = useState(false);
  const [resultInfo, setResultInfo] = useState<{
    fileName: string;
    exportedAt: string;
    sizeBytes: number;
    blob: Blob;
  } | null>(null);
  const [shareNote, setShareNote] = useState('');

  useEffect(() => {
    let active = true;
    setLoading(true);
    buildSyncPackage(
      store.settings.deviceId,
      store.settings.deviceName,
      includeAttachments,
      includeMedia
    )
      .then((pkg) => {
        if (!active) return;
        setPkgPreview({
          pkg,
          sizeBytes: estimateJsonSizeBytes(pkg),
        });
        setLoading(false);
      })
      .catch(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [store.settings.deviceId, store.settings.deviceName, includeAttachments, includeMedia]);

  const handleGenerateExport = async () => {
    if (!pkgPreview || !confirmed) return;
    const jsonText = JSON.stringify(pkgPreview.pkg, null, 2);
    const blob = new Blob([jsonText], { type: 'application/json;charset=utf-8' });
    const fileName = `daftar-fani-data-${todayIsoDate()}.json`;

    await saveBinaryFile(blob, fileName, 'exports', 'application/json');

    const now = new Date().toISOString();
    await store.saveSettings({
      ...store.settings,
      lastBackupAt: now,
    });

    setResultInfo({
      fileName,
      exportedAt: now,
      sizeBytes: blob.size,
      blob,
    });
  };

  const handleOsShare = async () => {
    if (!resultInfo) return;
    setShareNote('');
    try {
      const file = new File([resultInfo.blob], resultInfo.fileName, {
        type: 'application/json',
      });
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          title: 'بسته اطلاعات دفتر فنی اداره گلزار شهدا',
          text: 'فایل خروجی JSON جهت انتقال به دستگاه مقابل (ایتا یا ذخیره‌سازی محلی)',
          files: [file],
        });
        setShareNote('پنجره اشتراک‌گذاری سیستم‌عامل (برای ارسال در ایتا یا ذخیره) باز شد.');
      } else {
        setShareNote(
          'مرورگر فعلی از اشتراک‌گذاری مستقیم فایل پشتیبانی نمی‌کند؛ فایل JSON در پوشه Downloads ذخیره شده و می‌توانید آن را از طریق ایتا یا کابل USB منتقل کنید.'
        );
      }
    } catch {
      setShareNote('اشتراک‌گذاری توسط کاربر لغو شد یا در این مرورگر در دسترس نیست.');
    }
  };

  const sizeMb = pkgPreview ? pkgPreview.sizeBytes / (1024 * 1024) : 0;

  return (
    <FloatingWindow title="خروجی JSON (انتقال اطلاعات بین دستگاه‌ها)" onClose={onClose} width={660}>
      <div className="space-y-4">
        <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-3.5 text-xs leading-6 text-[#5B6573]">
          روش رسمی انتقال اطلاعات میان گوشی و رایانه صرفاً فایل JSON است. می‌توانید فایل تولیدشده را از طریق ایتا (به‌عنوان وسیله انتقال) یا در حالت اضطراری با کابل USB به دستگاه مقابل منتقل کنید.
        </div>

        <div className="space-y-2 border border-[#E8E5DE] bg-[#FFFFFF] p-3.5 rounded-lg">
          <div className="text-xs font-semibold text-[#243B5A]">تنظیمات محتوای فایل خروجی</div>
          <label className="flex items-center gap-2 text-xs text-[#263448] cursor-pointer">
            <input
              type="checkbox"
              checked={includeMedia}
              onChange={(e) => setIncludeMedia(e.target.checked)}
              className="h-4 w-4 accent-[#243B5A]"
            />
            <span>
              شامل تصاویر گلزار شهدا ({toPersianDigits(store.golzarImages.length)})، تصاویر اختصاصی
              پروژه‌ها ({toPersianDigits(store.projectImages.length)}) و آرم رسمی
            </span>
          </label>
          <label className="flex items-center gap-2 text-xs text-[#263448] cursor-pointer">
            <input
              type="checkbox"
              checked={includeAttachments}
              onChange={(e) => setIncludeAttachments(e.target.checked)}
              className="h-4 w-4 accent-[#243B5A]"
            />
            <span>
              شامل فایل‌های پیوست اسناد و پروژه‌ها ({toPersianDigits(store.attachments.length)} فایل)
            </span>
          </label>
        </div>

        {loading || !pkgPreview ? (
          <div className="p-4 text-center text-xs text-[#66707D]">
            در حال محاسبه خلاصه رکوردها و حجم تقریبی فایل JSON...
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 text-xs">
              <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                <div className="text-[#5B6573]">پرونده پروژه‌ها</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {toPersianDigits(pkgPreview.pkg.records.projects.length)}
                </div>
              </div>
              <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                <div className="text-[#5B6573]">بودجه، پرداخت و پیشنهاد</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {toPersianDigits(
                    pkgPreview.pkg.records.budgets.length +
                      pkgPreview.pkg.records.payments.length +
                      pkgPreview.pkg.records.proposals.length
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                <div className="text-[#5B6573]">اقدامات و پیگیری‌ها</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {toPersianDigits(pkgPreview.pkg.records.actions.length)}
                </div>
              </div>
              <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                <div className="text-[#5B6573]">اسناد، مکاتبات و فرم‌ها</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {toPersianDigits(
                    pkgPreview.pkg.records.documents.length +
                      pkgPreview.pkg.records.formSubmissions.length
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                <div className="text-[#5B6573]">تصاویر و پیوست‌ها</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {toPersianDigits(
                    (pkgPreview.pkg.golzarImages?.length ?? 0) +
                      (pkgPreview.pkg.projectImages?.length ?? 0) +
                      pkgPreview.pkg.attachmentsMeta.length
                  )}
                </div>
              </div>
              <div className="rounded-lg border border-[#E8E5DE] bg-[#E5EBF2] p-3">
                <div className="text-[#243B5A]">حجم تقریبی فایل خروجی</div>
                <div className="mt-1 font-semibold tabular-nums text-[#243B5A]">
                  {formatFileSize(pkgPreview.sizeBytes)}
                </div>
              </div>
            </div>

            {sizeMb > 12 && (
              <div className="rounded-lg border border-[#D8C79B] bg-[#FAF5E8] px-3.5 py-2.5 text-xs text-[#7D5E24]">
                توجه: حجم تقریبی فایل ({formatFileSize(pkgPreview.sizeBytes)}) نسبتاً بالاست. در صورت نیاز به فایل سبک‌تر می‌توانید گزینه پیوست‌های حجیم را موقتاً غیرفعال کنید.
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-3 text-xs text-[#263448] cursor-pointer">
              <input
                type="checkbox"
                checked={confirmed}
                onChange={(e) => setConfirmed(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#243B5A]"
              />
              <span>
                خلاصه داده‌ها و حجم تقریبی فایل را بررسی کردم و تولید فایل خروجی JSON را تأیید می‌کنم.
              </span>
            </label>

            <div className="flex flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-xs text-[#263448] hover:bg-[#F2EEE6] cursor-pointer"
              >
                بستن
              </button>
              <button
                type="button"
                disabled={!confirmed}
                onClick={handleGenerateExport}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] disabled:opacity-45 cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>تولید و ذخیره فایل JSON</span>
              </button>
            </div>
          </>
        )}

        {resultInfo && (
          <div className="space-y-3 rounded-lg border border-[#C6D5C4] bg-[#E7ECE6] p-4 text-xs text-[#263448]">
            <div className="flex items-center gap-2 font-semibold text-[#243B5A]">
              <CheckCircle2 className="h-4 w-4 text-[#3D6B59]" />
              <span>فایل JSON با موفقیت تولید شد</span>
            </div>
            <div className="space-y-1 text-[#3B4856]">
              <div>نام فایل: <span className="font-mono" dir="ltr">{resultInfo.fileName}</span></div>
              <div>زمان تولید: {formatJalaliDateTime(resultInfo.exportedAt)}</div>
              <div>حجم نهایی: {formatFileSize(resultInfo.sizeBytes)}</div>
              <div>محل ذخیره: پوشه دانلود مرورگر (Downloads) روی دستگاه فعلی</div>
            </div>
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleOsShare}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3.5 py-1.5 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              >
                <Share2 className="h-3.5 w-3.5" />
                <span>اشتراک‌گذاری فایل (ارسال از طریق ایتا / سیستم‌عامل)</span>
              </button>
            </div>
            {shareNote && <div className="text-[11px] text-[#354F73]">{shareNote}</div>}
          </div>
        )}
      </div>
    </FloatingWindow>
  );
};

// Window 2: Dedicated JSON Import Window with Pre-check, Conflict Resolution & Explicit Confirmation (Section 8)
export const JsonImportWindow: React.FC<{
  store: AppStore;
  onClose: () => void;
}> = ({ store, onClose }) => {
  const [selectedFileName, setSelectedFileName] = useState('');
  const [analysis, setAnalysis] = useState<SyncAnalysisResult | null>(null);
  const [conflicts, setConflicts] = useState<SyncConflict[]>([]);
  const [importNewRecords, setImportNewRecords] = useState(true);
  const [importMedia, setImportMedia] = useState(true);
  const [explicitApprove, setExplicitApprove] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [appliedSummary, setAppliedSummary] = useState('');

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorMessage('');
    setAppliedSummary('');
    setExplicitApprove(false);
    setSelectedFileName(file.name);

    try {
      const text = await file.text();
      const parsed = JSON.parse(text) as SyncPackage;

      // Schema & integrity pre-check
      if (!parsed || typeof parsed !== 'object' || !parsed.records || !parsed.schemaVersion) {
        throw new Error(
          'ساختار فایل انتخاب‌شده با نسخه و قالب استاندارد نرم‌افزار دفتر فنی سازگار نیست.'
        );
      }

      const result = await analyzeIncomingSyncPackage(parsed);
      setAnalysis(result);
      setConflicts(result.conflicts);
    } catch (err) {
      setAnalysis(null);
      setConflicts([]);
      setErrorMessage(
        err instanceof Error
          ? err.message
          : 'فایل JSON انتخاب‌شده معتبر یا قابل خواندن نیست.'
      );
    } finally {
      e.target.value = '';
    }
  };

  const setConflictDecision = (
    conflictId: string,
    resolution: 'keep-local' | 'accept-remote' | 'keep-both'
  ) => {
    setConflicts((prev) =>
      prev.map((c) => (c.id === conflictId ? { ...c, resolution } : c))
    );
  };

  const allConflictsResolved = conflicts.every((c) => Boolean(c.resolution));

  const handleCommitImport = async () => {
    if (!analysis || !explicitApprove || !allConflictsResolved) return;
    const res = await applyApprovedSyncDecisions(
      analysis,
      conflicts,
      importNewRecords,
      store.settings.deviceId,
      importMedia
    );
    await store.recordImportActivity(
      `ورود اطلاعات از فایل JSON (${selectedFileName}): ${toPersianDigits(res.added)} رکورد جدید، ${toPersianDigits(res.updated)} به‌روزرسانی و ${toPersianDigits(res.mediaAdded)} تصویر ثبت شد.`
    );
    await store.saveSettings({
      ...store.settings,
      lastSyncAt: new Date().toISOString(),
    });
    await store.refresh();

    setAppliedSummary(
      `عملیات ورود در IndexedDB با موفقیت ثبت شد: ${toPersianDigits(res.added)} رکورد جدید، ${toPersianDigits(res.updated)} جایگزینی تأییدشده، ${toPersianDigits(res.duplicated)} نسخه جداگانه، ${toPersianDigits(res.keptLocal)} حفظ نسخه محلی و ${toPersianDigits(res.mediaAdded)} تصویر جدید.`
    );
    setAnalysis(null);
    setConflicts([]);
  };

  return (
    <FloatingWindow title="ورودی JSON (پیش‌بررسی، رفع تعارض و ثبت در دستگاه)" onClose={onClose} width={760}>
      <div className="space-y-4">
        <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-3.5 text-xs leading-6 text-[#5B6573]">
          ابتدا فایل JSON دریافتی از ایتا یا USB را انتخاب کنید. پیش از هر تغییری در اطلاعات این دستگاه، سلامت، نسخه، رکوردهای جدید، تصاویر و تعارض‌ها به شما نمایش داده می‌شوند و بدون تأیید صریح شما هیچ داده‌ای ثبت یا جایگزین نخواهد شد.
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer">
            <Upload className="h-3.5 w-3.5" />
            <span>انتخاب فایل JSON از دستگاه</span>
            <input
              type="file"
              accept=".json,application/json"
              onChange={handleFileSelect}
              className="hidden"
            />
          </label>
          {selectedFileName && (
            <span className="inline-flex items-center gap-1.5 text-xs text-[#263448]">
              <FileJson className="h-4 w-4 text-[#243B5A]" />
              <span>{selectedFileName}</span>
            </span>
          )}
        </div>

        {errorMessage && (
          <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-4 py-3 text-xs text-[#9E3B3B]">
            {errorMessage}
          </div>
        )}

        {appliedSummary && (
          <div className="rounded-lg border border-[#C6D5C4] bg-[#E7ECE6] px-4 py-3 text-xs text-[#263448]">
            {appliedSummary}
          </div>
        )}

        {analysis && (
          <div className="space-y-4 rounded-lg border border-[#243B5A] bg-[#FFFFFF] p-4">
            <div className="border-b border-[#E8E5DE] pb-3">
              <div className="text-sm font-semibold text-[#243B5A]">
                نتیجه پیش‌بررسی فایل از «{analysis.sourceDeviceName}»
              </div>
              <div className="mt-1 text-xs text-[#5B6573]">
                نسخه ساختار: {toPersianDigits(analysis.schemaVersion)} (سازگار و سالم) · رکورد جدید:{' '}
                {toPersianDigits(analysis.newRecords.length)} · رکورد یکسان:{' '}
                {toPersianDigits(analysis.identicalCount)} · تعارض نیازمند تصمیم:{' '}
                {toPersianDigits(conflicts.length)} · تصاویر و پیوست جدید:{' '}
                {toPersianDigits(
                  analysis.newAttachments.length +
                    analysis.newGolzarImages.length +
                    analysis.newProjectImages.length
                )}
              </div>
            </div>

            <div className="flex flex-wrap gap-4 text-xs text-[#263448]">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importNewRecords}
                  onChange={(e) => setImportNewRecords(e.target.checked)}
                  className="h-4 w-4 accent-[#243B5A]"
                />
                <span>افزودن رکوردهای جدید ({toPersianDigits(analysis.newRecords.length)})</span>
              </label>
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={importMedia}
                  onChange={(e) => setImportMedia(e.target.checked)}
                  className="h-4 w-4 accent-[#243B5A]"
                />
                <span>
                  وارد کردن تصاویر گلزار ({toPersianDigits(analysis.newGolzarImages.length)}) و تصاویر
                  پروژه‌ها ({toPersianDigits(analysis.newProjectImages.length)}) با حفظ ارتباط پروژه
                </span>
              </label>
            </div>

            {conflicts.length > 0 && (
              <div className="space-y-3">
                <div className="text-xs font-semibold text-[#9E3B3B]">
                  تعارض‌های شناسایی‌شده (تصمیم‌گیری کاربر الزامی است):
                </div>
                {conflicts.map((conf) => (
                  <div
                    key={conf.id}
                    className="space-y-2.5 rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-3.5"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#243B5A]">
                        {STORE_LABELS[conf.store]}: {conf.recordLabel}
                      </span>
                      <span className="text-[11px] text-[#66707D]">
                        محلی: {formatJalaliDateTime(conf.localUpdatedAt)} | فایل:{' '}
                        {formatJalaliDateTime(conf.remoteUpdatedAt)}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          { val: 'keep-local', label: 'نگهداری نسخه این دستگاه' },
                          { val: 'accept-remote', label: 'پذیرش نسخه فایل ورودی' },
                          { val: 'keep-both', label: 'نگهداری هر دو نسخه جداگانه' },
                        ] as const
                      ).map((opt) => (
                        <button
                          key={opt.val}
                          type="button"
                          onClick={() => setConflictDecision(conf.id, opt.val)}
                          className={`rounded-lg px-3 py-1.5 text-xs font-medium cursor-pointer ${
                            conf.resolution === opt.val
                              ? 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                              : 'border border-[#CEC7B6] bg-[#FFFFFF] text-[#263448] hover:bg-[#E5EBF2]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}

            <label className="flex items-start gap-2.5 rounded-lg border border-[#D8C79B] bg-[#FAF5E8] p-3 text-xs text-[#263448] cursor-pointer">
              <input
                type="checkbox"
                checked={explicitApprove}
                onChange={(e) => setExplicitApprove(e.target.checked)}
                className="mt-0.5 h-4 w-4 accent-[#243B5A]"
              />
              <span>
                نتیجه پیش‌بررسی و تصمیم‌های تعارض را بررسی کردم و ثبت تغییرات تأییدشده در حافظه محلی این دستگاه (IndexedDB) را تأیید می‌کنم.
              </span>
            </label>

            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setAnalysis(null);
                  setConflicts([]);
                }}
                className="rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-xs text-[#263448] cursor-pointer"
              >
                انصراف بدون تغییر
              </button>
              <button
                type="button"
                disabled={!explicitApprove || !allConflictsResolved}
                onClick={handleCommitImport}
                className="rounded-lg border border-[#243B5A] bg-[#243B5A] px-5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] disabled:opacity-45 cursor-pointer"
              >
                تأیید و ثبت در دستگاه
              </button>
            </div>
          </div>
        )}
      </div>
    </FloatingWindow>
  );
};
