import React, { useEffect, useState } from 'react';
import {
  AlertCircle,
  CheckCircle2,
  ExternalLink,
  FileSpreadsheet,
  FileText,
  FolderOpen,
  X,
} from 'lucide-react';
import {
  exportToExcelXlsx,
  exportToWordDocx,
  ExportTablePayload,
} from '../../utils/exportEngine';
import {
  openSavedDesktopFile,
  revealSavedDesktopFile,
  SaveFileOutcome,
} from '../../utils/platformBridge';

interface SectionReportExportBarProps {
  buildExport: () => { payload: ExportTablePayload; slug: string };
}

interface ExportNoticeState {
  kind: 'success' | 'error';
  title: string;
  detail: string;
  savedPath?: string;
  canOpenDesktop?: boolean;
}

function buildOutcomeNotice(label: 'Word' | 'Excel', outcome: SaveFileOutcome): ExportNoticeState | null {
  if (outcome.cancelled) return null;
  if (!outcome.ok) {
    return {
      kind: 'error',
      title: `خطا در ذخیره فایل ${label}`,
      detail: outcome.error || `ذخیره فایل ${label} ناموفق بود. لطفاً دسترسی ذخیره‌سازی دستگاه را بررسی کنید.`,
    };
  }
  if (outcome.method === 'electron-disk' && outcome.savedPath) {
    return {
      kind: 'success',
      title: `خروجی ${label} ذخیره شد`,
      detail: `فایل در مسیر زیر ذخیره و در پوشه سیستم نمایش داده شد: ${outcome.savedPath}`,
      savedPath: outcome.savedPath,
      canOpenDesktop: true,
    };
  }
  if (outcome.method === 'android-native') {
    return {
      kind: 'success',
      title: `خروجی ${label} روی گوشی ذخیره شد`,
      detail: outcome.savedPath
        ? `فایل در ${outcome.savedPath} ذخیره و پنجره اشتراک‌گذاری/باز کردن اندروید باز شد.`
        : `فایل ${outcome.filename} آماده و در پنجره اشتراک‌گذاری اندروید باز شد.`,
    };
  }
  return {
    kind: 'success',
    title: `خروجی ${label} آماده شد`,
    detail: `فایل ${label} راست‌چین در قطع A4 با فونت B Zar (${outcome.filename}) بارگیری شد.`,
  };
}

export const SectionReportExportBar: React.FC<SectionReportExportBarProps> = ({ buildExport }) => {
  const [exportingFormat, setExportingFormat] = useState<'word' | 'excel' | null>(null);
  const [notice, setNotice] = useState<ExportNoticeState | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), notice.canOpenDesktop ? 9000 : 5500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleExport = async (format: 'word' | 'excel') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const { payload, slug } = buildExport();
      if (format === 'word') {
        const outcome = await exportToWordDocx(payload, slug);
        setNotice(buildOutcomeNotice('Word', outcome));
      } else {
        const outcome = await exportToExcelXlsx(payload, slug);
        setNotice(buildOutcomeNotice('Excel', outcome));
      }
    } catch (err) {
      setNotice({
        kind: 'error',
        title: format === 'word' ? 'خطا در تولید خروجی Word' : 'خطا در تولید خروجی Excel',
        detail: err instanceof Error ? err.message : 'تولید یا ذخیره فایل خروجی با خطا مواجه شد.',
      });
    } finally {
      setExportingFormat(null);
    }
  };

  return (
    <>
      <section
        aria-label="خروجی گزارش"
        className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] px-4 py-3.5 sm:px-5 shadow-[0_2px_8px_rgba(29,50,80,0.04)]"
      >
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h3 className="text-sm font-bold text-[#1D3250]">خروجی گزارش</h3>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExport('word')}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#263B54] bg-[#263B54] px-4 text-xs font-medium text-[#FFFFFF] transition-colors hover:bg-[#364F6D] disabled:opacity-60 cursor-pointer whitespace-nowrap sm:flex-initial"
            >
              <FileText className="h-4 w-4 shrink-0" />
              <span>
                {exportingFormat === 'word' ? 'در حال آماده‌سازی Word...' : 'خروجی Word'}
              </span>
            </button>
            <button
              type="button"
              disabled={exportingFormat !== null}
              onClick={() => void handleExport('excel')}
              className="inline-flex h-10 flex-1 items-center justify-center gap-2 rounded-xl border border-[#C2A866] bg-[#F2E7C9] px-4 text-xs font-semibold text-[#263B54] transition-colors hover:bg-[#EADBB2] disabled:opacity-60 cursor-pointer whitespace-nowrap sm:flex-initial"
            >
              <FileSpreadsheet className="h-4 w-4 shrink-0 text-[#263B54]" />
              <span>
                {exportingFormat === 'excel' ? 'در حال آماده‌سازی Excel...' : 'خروجی Excel'}
              </span>
            </button>
          </div>
        </div>
      </section>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          aria-live="polite"
          className={`fixed bottom-6 left-1/2 z-50 w-[min(92vw,460px)] -translate-x-1/2 rounded-2xl border bg-[#FFFFFF] p-4 shadow-[0_14px_34px_rgba(29,50,80,0.18)] ${
            notice.kind === 'error' ? 'border-[#D8B4B4]' : 'border-[#C6D5C4]'
          }`}
        >
          <div className="flex items-start gap-3">
            <div
              className={`mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
                notice.kind === 'error'
                  ? 'bg-[#FBF1F1] text-[#9E3B3B]'
                  : 'bg-[#E7ECE6] text-[#2D6A4F]'
              }`}
            >
              {notice.kind === 'error' ? (
                <AlertCircle className="h-5 w-5" />
              ) : (
                <CheckCircle2 className="h-5 w-5" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1.5">
              <div
                className={`text-xs font-bold ${
                  notice.kind === 'error' ? 'text-[#9E3B3B]' : 'text-[#1D3250]'
                }`}
              >
                {notice.title}
              </div>
              <p className="text-xs leading-5 text-[#5B6573] break-words">{notice.detail}</p>
              {notice.canOpenDesktop && notice.savedPath && (
                <div className="flex flex-wrap items-center gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => void openSavedDesktopFile(notice.savedPath!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#243B5A] px-2.5 py-1 text-[11px] font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                  >
                    <ExternalLink className="h-3 w-3" />
                    <span>باز کردن فایل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void revealSavedDesktopFile(notice.savedPath!)}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  >
                    <FolderOpen className="h-3 w-3" />
                    <span>نمایش در پوشه</span>
                  </button>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setNotice(null)}
              aria-label="بستن اعلان"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] text-[#5B6573] hover:border-[#243B5A] hover:text-[#243B5A] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
};
