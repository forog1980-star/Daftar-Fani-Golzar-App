import React, { useEffect, useState } from 'react';
import { CheckCircle2, FileSpreadsheet, FileText, X } from 'lucide-react';
import {
  exportToExcelXlsx,
  exportToWordDocx,
  ExportTablePayload,
} from '../../utils/exportEngine';

interface SectionReportExportBarProps {
  buildExport: () => { payload: ExportTablePayload; slug: string };
}

export const SectionReportExportBar: React.FC<SectionReportExportBarProps> = ({ buildExport }) => {
  const [exportingFormat, setExportingFormat] = useState<'word' | 'excel' | null>(null);
  const [notice, setNotice] = useState<{ title: string; detail: string } | null>(null);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(null), 4500);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const handleExport = async (format: 'word' | 'excel') => {
    if (exportingFormat) return;
    setExportingFormat(format);
    try {
      const { payload, slug } = buildExport();
      if (format === 'word') {
        await exportToWordDocx(payload, slug);
        setNotice({
          title: 'خروجی Word آماده شد',
          detail: 'فایل Word راست‌چین در قطع A4 با فونت B Zar دریافت شد.',
        });
      } else {
        await exportToExcelXlsx(payload, slug);
        setNotice({
          title: 'خروجی Excel آماده شد',
          detail: 'فایل Excel راست‌چین در قطع A4 با فونت B Zar دریافت شد.',
        });
      }
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
              onClick={() => handleExport('word')}
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
              onClick={() => handleExport('excel')}
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
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-1/2 z-50 w-[min(92vw,420px)] -translate-x-1/2 rounded-2xl border border-[#C6D5C4] bg-[#FFFFFF] p-4 shadow-[0_14px_34px_rgba(29,50,80,0.18)]"
        >
          <div className="flex items-start gap-3">
            <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E7ECE6] text-[#2D6A4F]">
              <CheckCircle2 className="h-5 w-5" />
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <div className="text-xs font-bold text-[#1D3250]">{notice.title}</div>
              <p className="text-xs leading-5 text-[#5B6573]">{notice.detail}</p>
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
