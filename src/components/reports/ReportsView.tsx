import React, { useMemo, useState } from 'react';
import { Download, FileJson, FileSpreadsheet, Printer } from 'lucide-react';
import { LetterheadConfig, SignatureSnapshot } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatJalaliDate,
  formatRial,
  isOverdue,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import {
  exportToExcelXlsx,
  exportToJson,
  exportToPdfPrint,
  exportToWordDocx,
  ExportTablePayload,
} from '../../utils/exportEngine';
import { SignatureBlockEditor } from '../documents/SignatureBlockEditor';

interface ReportsViewProps {
  store: AppStore;
}

type ReportType = 'projects' | 'budget' | 'proposals' | 'actions' | 'documents' | 'single-project';

export const ReportsView: React.FC<ReportsViewProps> = ({ store }) => {
  const [reportType, setReportType] = useState<ReportType>('projects');
  const [selectedProjectId, setSelectedProjectId] = useState(store.projects[0]?.id ?? '');
  const [reportNumber, setReportNumber] = useState(`گ-${Math.floor(100 + Math.random() * 899)}`);
  const [letterhead, setLetterhead] = useState<LetterheadConfig>(store.settings.letterhead);
  const [signatures, setSignatures] = useState<SignatureSnapshot[]>([]);
  const [exportMessage, setExportMessage] = useState('');

  const projectMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p])),
    [store.projects]
  );

  const reportPayload = useMemo<ExportTablePayload>(() => {
    const base = {
      documentNumber: reportNumber,
      date: todayIsoDate(),
      letterhead,
      signatures: signatures.length > 0 ? signatures : undefined,
    };

    if (reportType === 'projects') {
      return {
        ...base,
        title: 'گزارش جامع وضعیت پروژه‌های دفتر فنی اداره گلزار شهدا',
        summaryRows: [
          { label: 'تعداد کل پروژه‌ها', value: toPersianDigits(store.projects.length) },
          {
            label: 'در حال اجرا / دارای مشکل',
            value: `${toPersianDigits(store.projects.filter((p) => p.status === 'در حال اجرا').length)} / ${toPersianDigits(store.projects.filter((p) => p.status === 'دارای مشکل').length)}`,
          },
          {
            label: 'مجموع مبلغ قراردادها',
            value: formatRial(store.projects.reduce((s, p) => s + (p.contractAmount || 0), 0)),
          },
        ],
        headers: ['کد', 'نام پروژه', 'نوع', 'وضعیت', 'پیمانکار', 'مبلغ قرارداد', 'پیشرفت فیزیکی'],
        rows: store.projects.map((p) => [
          p.code,
          p.title,
          p.type,
          p.status,
          p.contractor || '—',
          formatRial(p.contractAmount),
          `${toPersianDigits(p.physicalProgress)}٪`,
        ]),
      };
    }

    if (reportType === 'budget') {
      const rows = store.projects.map((p) => {
        const b = store.budgets.find((x) => x.projectId === p.id);
        const paid = store.payments
          .filter((pay) => pay.projectId === p.id)
          .reduce((s, pay) => s + (pay.amount || 0), 0);
        const baseCredit = b?.fundedCredit || b?.approvedCredit || 0;
        const remaining = baseCredit - paid;
        const usage = baseCredit > 0 ? ((paid / baseCredit) * 100).toFixed(1) : '0';
        return [
          p.code,
          p.title,
          formatRial(b?.approvedCredit),
          formatRial(b?.fundedCredit),
          formatRial(paid),
          formatRial(remaining),
          `${toPersianDigits(usage)}٪`,
        ];
      });
      return {
        ...base,
        title: 'گزارش بودجه، اعتبارات و پرداخت‌های پروژه‌ها',
        headers: [
          'کد',
          'پروژه',
          'اعتبار مصوب',
          'تأمین اعتبار',
          'پرداخت‌شده',
          'مانده اعتبار',
          'درصد مصرف',
        ],
        rows,
      };
    }

    if (reportType === 'proposals') {
      return {
        ...base,
        title: 'فهرست پیشنهادهای بودجه سال آینده',
        summaryRows: [
          { label: 'تعداد پیشنهادها', value: toPersianDigits(store.proposals.length) },
          {
            label: 'جمع برآورد اعتبار پیشنهادی',
            value: formatRial(store.proposals.reduce((s, p) => s + (p.estimatedAmount || 0), 0)),
          },
        ],
        headers: ['سال', 'عنوان پیشنهاد', 'حوزه', 'اولویت', 'برآورد مبلغ', 'شرح'],
        rows: store.proposals.map((pr) => [
          pr.fiscalYear,
          pr.title,
          pr.department,
          pr.priority,
          formatRial(pr.estimatedAmount),
          pr.description || '—',
        ]),
      };
    }

    if (reportType === 'actions') {
      return {
        ...base,
        title: 'گزارش اقدامات و پیگیری‌های دفتر فنی',
        summaryRows: [
          { label: 'تعداد کل اقدامات', value: toPersianDigits(store.actions.length) },
          {
            label: 'اقدامات عقب‌افتاده',
            value: toPersianDigits(
              store.actions.filter((a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status))
                .length
            ),
          },
        ],
        headers: ['عنوان اقدام', 'پروژه مرتبط', 'اولویت', 'وضعیت', 'مهلت', 'نتیجه پیگیری'],
        rows: store.actions.map((a) => [
          a.title,
          a.projectId ? projectMap.get(a.projectId)?.title ?? '—' : 'عمومی',
          a.priority,
          a.status,
          formatJalaliDate(a.dueDate),
          a.followUpResult || '—',
        ]),
      };
    }

    if (reportType === 'documents') {
      return {
        ...base,
        title: 'فهرست اسناد، مکاتبات و صورتجلسات دفتر فنی',
        headers: ['نوع سند', 'شماره', 'تاریخ', 'موضوع', 'طرف مکاتبه', 'پروژه مرتبط', 'وضعیت'],
        rows: store.documents.map((d) => [
          d.category,
          d.documentNumber || '—',
          formatJalaliDate(d.date),
          d.subject,
          d.senderOrReceiver || '—',
          d.projectId ? projectMap.get(d.projectId)?.title ?? '—' : 'عمومی',
          d.status,
        ]),
      };
    }

    // Single project dossier report
    const proj = store.projects.find((p) => p.id === selectedProjectId) ?? store.projects[0];
    if (!proj) {
      return {
        ...base,
        title: 'گزارش پرونده پروژه',
        headers: ['مرحله', 'وضعیت'],
        rows: [],
      };
    }
    const bud = store.budgets.find((b) => b.projectId === proj.id);
    const paid = store.payments
      .filter((pay) => pay.projectId === proj.id)
      .reduce((s, pay) => s + (pay.amount || 0), 0);

    return {
      ...base,
      title: `گزارش تفصیلی پرونده پروژه: ${proj.title}`,
      summaryRows: [
        { label: 'کد و نوع پروژه', value: `${proj.code} — ${proj.type}` },
        { label: 'محل اجرا و معاونت متولی', value: `${proj.location || '—'} / ${proj.responsibleDepartment || '—'}` },
        { label: 'پیمانکار / شماره قرارداد', value: `${proj.contractor || '—'} (${proj.contractNumber || '—'})` },
        { label: 'مبلغ قرارداد / مدت', value: `${formatRial(proj.contractAmount)} — ${proj.contractDuration || '—'}` },
        { label: 'اعتبار مصوب / پرداخت‌شده', value: `${formatRial(bud?.approvedCredit)} / ${formatRial(paid)}` },
        { label: 'پیشرفت فیزیکی / وضعیت', value: `${toPersianDigits(proj.physicalProgress)}٪ — ${proj.status}` },
      ],
      headers: ['ردیف', 'مرحله اجرایی', 'وضعیت', 'تاریخ اتمام', 'توضیحات'],
      rows: proj.stages
        .filter((s) => s.enabled)
        .map((s, idx) => [
          toPersianDigits(idx + 1),
          s.title,
          s.status,
          s.completedDate ? formatJalaliDate(s.completedDate) : '—',
          s.notes || '—',
        ]),
      notes: proj.description,
    };
  }, [
    reportType,
    selectedProjectId,
    reportNumber,
    letterhead,
    signatures,
    store.projects,
    store.budgets,
    store.payments,
    store.proposals,
    store.actions,
    store.documents,
    projectMap,
  ]);

  const handleExport = async (format: 'word' | 'excel' | 'pdf' | 'json') => {
    const slug = `report-${reportType}-${todayIsoDate()}`;
    if (format === 'word') {
      await exportToWordDocx(reportPayload, slug);
      setExportMessage('خروجی Word راست‌چین با فونت Zar اندازه ۱۴ پوینت تولید و بارگیری شد.');
    } else if (format === 'excel') {
      await exportToExcelXlsx(reportPayload, slug);
      setExportMessage('خروجی Excel راست‌چین با فونت Zar اندازه ۱۴ پوینت تولید و بارگیری شد.');
    } else if (format === 'pdf') {
      exportToPdfPrint(reportPayload);
      setExportMessage('نمای چاپ و ذخیره PDF (فونت Zar ۱۴) آماده شد.');
    } else {
      exportToJson(reportPayload, slug);
      setExportMessage('فایل ساخت‌یافته JSON تولید و بارگیری شد.');
    }
  };

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
      {/* Report Type & Letterhead Selector */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { key: 'projects', label: 'گزارش جامع پروژه‌ها' },
                { key: 'budget', label: 'بودجه و اعتبارات' },
                { key: 'proposals', label: 'پیشنهاد بودجه سال آینده' },
                { key: 'actions', label: 'اقدامات و پیگیری‌ها' },
                { key: 'documents', label: 'اسناد و مکاتبات' },
                { key: 'single-project', label: 'گزارش تک‌پروژه' },
              ] as Array<{ key: ReportType; label: string }>
            ).map((r) => (
              <button
                key={r.key}
                type="button"
                onClick={() => setReportType(r.key)}
                className={`px-3 py-1.5 text-xs font-medium cursor-pointer ${
                  reportType === r.key
                    ? 'border border-[#2D5A63] bg-[#E5EFF0] text-[#2D5A63]'
                    : 'border border-transparent text-[#5B6268] hover:bg-[#F3EFE6]'
                }`}
              >
                {r.label}
              </button>
            ))}
          </div>

          {reportType === 'single-project' && (
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-1.5 text-xs"
            >
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title}
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Selectable Letterhead Controls */}
        <div className="grid grid-cols-1 gap-3 border-t border-[#ECE7DA] pt-4 sm:grid-cols-4">
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">عنوان سازمانی سربرگ</label>
            <input
              type="text"
              value={letterhead.organizationName}
              onChange={(e) =>
                setLetterhead((l) => ({ ...l, organizationName: e.target.value }))
              }
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">واحد / اداره</label>
            <input
              type="text"
              value={letterhead.unitName}
              onChange={(e) => setLetterhead((l) => ({ ...l, unitName: e.target.value }))}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">زیرعنوان سربرگ</label>
            <input
              type="text"
              value={letterhead.subtitle}
              onChange={(e) => setLetterhead((l) => ({ ...l, subtitle: e.target.value }))}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
            />
          </div>
          <div>
            <label className="mb-1 block text-[11px] text-[#5B6268]">شماره گزارش</label>
            <input
              type="text"
              value={reportNumber}
              onChange={(e) => setReportNumber(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
            />
          </div>
        </div>

        {/* Export Action Buttons */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#ECE7DA] pt-4">
          <div className="text-xs text-[#5B6268]">
            خروجی Word و Excel کاملاً راست‌چین، دارای جدول‌بندی استاندارد فارسی و فونت Zar اندازه ۱۴ پوینت هستند.
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleExport('word')}
              className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-3.5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5" />
              <span>خروجی Word</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('excel')}
              className="inline-flex items-center gap-1.5 border border-[#2D6A4F] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#2D6A4F] hover:bg-[#F2F6EE] cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>خروجی Excel</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('pdf')}
              className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-3.5 py-2 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>چاپ / PDF</span>
            </button>
            <button
              type="button"
              onClick={() => handleExport('json')}
              className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-3.5 py-2 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            >
              <FileJson className="h-3.5 w-3.5" />
              <span>JSON</span>
            </button>
          </div>
        </div>

        {exportMessage && (
          <div className="border border-[#D5DEC8] bg-[#F2F6EE] px-3 py-2 text-xs text-[#2D6A4F]">
            {exportMessage}
          </div>
        )}
      </div>

      {/* Live Preview Sheet */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-6 space-y-5">
        <div className="border-b border-[#E2DDD0] pb-4 text-center">
          <div className="text-base font-semibold text-[#2B3033]">{letterhead.organizationName}</div>
          <div className="text-sm text-[#5B6268]">{letterhead.unitName}</div>
          {letterhead.subtitle && (
            <div className="mt-0.5 text-xs text-[#7C8287]">{letterhead.subtitle}</div>
          )}
          <div className="mt-3 flex justify-between text-xs text-[#7C8287]">
            <span>تاریخ: {formatJalaliDate(todayIsoDate())}</span>
            <span>شماره: {reportNumber}</span>
          </div>
        </div>

        <h3 className="text-sm font-semibold text-[#2D5A63]">{reportPayload.title}</h3>

        {reportPayload.summaryRows && reportPayload.summaryRows.length > 0 && (
          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
            {reportPayload.summaryRows.map((s) => (
              <div key={s.label} className="border border-[#ECE7DA] bg-[#FAF8F3] px-3 py-2">
                <div className="text-[11px] text-[#7C8287]">{s.label}</div>
                <div className="mt-0.5 text-xs font-medium text-[#2B3033] tabular-nums">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        <div className="overflow-x-auto border border-[#E2DDD0]">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-[#5B6268]">
                {reportPayload.headers.map((h) => (
                  <th key={h} className="px-3 py-2.5 font-medium">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DA]">
              {reportPayload.rows.length === 0 ? (
                <tr>
                  <td
                    colSpan={Math.max(1, reportPayload.headers.length)}
                    className="p-6 text-center text-[#7C8287]"
                  >
                    داده‌ای برای نمایش در این گزارش وجود ندارد.
                  </td>
                </tr>
              ) : (
                reportPayload.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-[#FAF8F3]">
                    {r.map((cell, ci) => (
                      <td key={ci} className="px-3 py-2.5 text-[#2B3033]">
                        {cell}
                      </td>
                    ))}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Optional Signatures attached to Report */}
        <SignatureBlockEditor
          signatures={signatures}
          people={store.people}
          onChange={setSignatures}
        />
      </div>
    </div>
  );
};
