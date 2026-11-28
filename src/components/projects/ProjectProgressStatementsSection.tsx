import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardCheck,
  Edit2,
  FileSpreadsheet,
  Plus,
  Printer,
  Trash2,
} from 'lucide-react';
import { ProgressStatement, Project } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  buildProgressStatementExportPayload,
  calculateStatementFinancials,
  createNewStatementDraft,
  summarizeProjectStatements,
} from '../../utils/statementCalculations';
import { exportToExcelXlsx, exportToPdfPrint } from '../../utils/exportEngine';
import { formatAmount, formatJalaliDate, formatRial, toPersianDigits } from '../../utils/format';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { ProgressStatementModal } from './ProgressStatementModal';

interface ProjectProgressStatementsSectionProps {
  project: Project;
  store: AppStore;
}

const STATUS_BADGE_CLASS: Record<string, string> = {
  ثبت‌شده: 'border-[#D7D2C6] bg-[#FAF8F3] text-[#263448]',
  'در کنترل': 'border-[#CAD6E6] bg-[#EEF3F9] text-[#243B5A]',
  'دارای نقص': 'border-[#E6C5C5] bg-[#FBF1F1] text-[#9E3B3B]',
  'تأیید فنی': 'border-[#C6D5C4] bg-[#E7ECE6] text-[#2D6A4F]',
  'ارجاع مالی': 'border-[#D4B46A] bg-[#FDF6E3] text-[#785616]',
  متوقف: 'border-[#E6C5C5] bg-[#FBF1F1] text-[#9E3B3B]',
  پرداخت‌شده: 'border-[#3D6B59] bg-[#E7ECE6] text-[#1E4D38]',
  مختومه: 'border-[#B8C4D4] bg-[#E5EBF2] text-[#1D3250]',
};

export const ProjectProgressStatementsSection: React.FC<
  ProjectProgressStatementsSectionProps
> = ({ project, store }) => {
  const [modalState, setModalState] = useState<{
    statement: ProgressStatement;
    isNew: boolean;
  } | null>(null);
  const [deleting, setDeleting] = useState<ProgressStatement | null>(null);

  const projectStatements = useMemo(
    () =>
      store.progressStatements
        .filter((s) => s.projectId === project.id)
        .sort((a, b) => (b.receiptDate || b.createdAt).localeCompare(a.receiptDate || a.createdAt)),
    [store.progressStatements, project.id]
  );

  const summary = useMemo(
    () => summarizeProjectStatements(store.progressStatements, project.id),
    [store.progressStatements, project.id]
  );

  const openCreateModal = () => {
    const draft = createNewStatementDraft(project, projectStatements, store.settings.deviceId);
    setModalState({ statement: draft, isNew: true });
  };

  const handlePrint = (st: ProgressStatement) => {
    const payload = buildProgressStatementExportPayload(st, store.settings.letterhead);
    exportToPdfPrint(payload);
  };

  const handleExcel = async (st: ProgressStatement) => {
    const payload = buildProgressStatementExportPayload(st, store.settings.letterhead);
    await exportToExcelXlsx(payload, `صورت-وضعیت-${project.code}-${st.statementNumber}`);
  };

  return (
    <div className="rounded-xl border border-[#D4CEBF] bg-[#FFFFFF] p-4 sm:p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#EFECE4] pb-3.5">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2 text-sm font-bold text-[#1D3250]">
            <ClipboardCheck className="h-4 w-4 text-[#243B5A]" />
            <span>رسیدگی به صورت‌وضعیت ـ مدیریت اداره گلزار شهدا</span>
          </div>
          <p className="text-[11px] text-[#5B6573]">
            ثبت، محاسبه مالی، کنترل فنی مدارک و گردش ارجاع مستقل صورت‌وضعیت‌های این پروژه (مجزا از صورتجلسه تحویل)
          </p>
        </div>

        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3.5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
        >
          <Plus className="h-3.5 w-3.5" />
          <span>ثبت و رسیدگی به صورت‌وضعیت</span>
        </button>
      </div>

      {/* Project Statements Financial Summary Strip */}
      {projectStatements.length > 0 && (
        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4 text-xs tabular-nums">
          <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] p-2.5">
            <div className="text-[11px] text-[#788290]">تعداد صورت‌وضعیت‌ها</div>
            <div className="mt-0.5 font-bold text-[#1D3250]">
              {toPersianDigits(summary.count)} فقره
            </div>
          </div>
          <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] p-2.5">
            <div className="text-[11px] text-[#788290]">جمع ناخالص کارکرد (ریال)</div>
            <div className="mt-0.5 font-bold text-[#243B5A]">
              {formatAmount(summary.totalCurrentGross)}
            </div>
          </div>
          <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] p-2.5">
            <div className="text-[11px] text-[#788290]">جمع خالص قابل پرداخت (ریال)</div>
            <div className="mt-0.5 font-bold text-[#2D6A4F]">
              {formatAmount(summary.totalNetPayable)}
            </div>
          </div>
          <div className="rounded-lg border border-[#ECE7DC] bg-[#FAF8F3] p-2.5">
            <div className="text-[11px] text-[#788290]">ارجاع مالی / پرداخت‌شده (ریال)</div>
            <div className="mt-0.5 font-bold text-[#785616]">
              {formatAmount(summary.financeReferredOrPaidAmount)}
            </div>
          </div>
        </div>
      )}

      {/* Statements List */}
      {projectStatements.length === 0 ? (
        <div className="rounded-lg border border-dashed border-[#D4CEBF] bg-[#FAF8F3] p-5 text-center text-xs text-[#788290]">
          هنوز صورت‌وضعیتی در این پرونده ثبت نشده است. با دکمه «ثبت و رسیدگی به صورت‌وضعیت» اولین فرم رسیدگی را ایجاد کنید.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-[#E2DDD0]">
          <table className="w-full text-right text-xs">
            <thead>
              <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-[11px] text-[#5B6268]">
                <th className="px-3 py-2.5 font-medium">شماره / نوع</th>
                <th className="px-3 py-2.5 font-medium">تاریخ دریافت / دوره</th>
                <th className="px-3 py-2.5 font-medium">مبلغ فعلی / تجمعی (ریال)</th>
                <th className="px-3 py-2.5 font-medium">خالص قابل پرداخت (ریال)</th>
                <th className="px-3 py-2.5 font-medium">نظر فنی و وضعیت</th>
                <th className="px-3 py-2.5 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DA]">
              {projectStatements.map((st) => {
                const calc = calculateStatementFinancials(st);
                const badgeCls =
                  STATUS_BADGE_CLASS[st.status] ??
                  'border-[#D7D2C6] bg-[#FAF8F3] text-[#263448]';
                return (
                  <tr key={st.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="font-bold text-[#1D3250] tabular-nums">
                        شماره {toPersianDigits(st.statementNumber)}
                      </div>
                      <div className="text-[11px] text-[#5B6573]">{st.statementType}</div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      <div className="text-[#263448]">{formatJalaliDate(st.receiptDate)}</div>
                      <div className="text-[11px] text-[#788290]">
                        {st.workPeriodLabel ||
                          (st.workPeriodFrom || st.workPeriodTo
                            ? `${formatJalaliDate(st.workPeriodFrom)} تا ${formatJalaliDate(st.workPeriodTo)}`
                            : '—')}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 tabular-nums whitespace-nowrap">
                      <div className="font-medium text-[#243B5A]">
                        {formatAmount(st.currentStatementAmount)}
                      </div>
                      <div className="text-[11px] text-[#788290]">
                        تجمعی: {formatAmount(calc.cumulativeAmount)}
                      </div>
                      {calc.exceedsCeiling && (
                        <div className="mt-0.5 inline-flex items-center gap-1 text-[10px] font-medium text-[#B43E3E]">
                          <AlertTriangle className="h-3 w-3" />
                          <span>عبور از سقف مجاز</span>
                        </div>
                      )}
                    </td>
                    <td className="px-3 py-2.5 font-bold tabular-nums text-[#2D6A4F] whitespace-nowrap">
                      {formatRial(calc.netPayableAmount)}
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap space-y-1">
                      <span
                        className={`inline-block rounded border px-2 py-0.5 text-[11px] font-medium ${badgeCls}`}
                      >
                        {st.status}
                      </span>
                      <div className="text-[10px] text-[#5B6573]">
                        فنی: {st.technicalReviewResult}
                      </div>
                    </td>
                    <td className="px-3 py-2.5 whitespace-nowrap">
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => setModalState({ statement: st, isNew: false })}
                          className="inline-flex h-7 items-center gap-1 rounded border border-[#243B5A] bg-[#FFFFFF] px-2 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                          title="مشاهده و ویرایش صورت‌وضعیت"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>رسیدگی</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handlePrint(st)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                          title="چاپ / PDF"
                        >
                          <Printer className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleExcel(st)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#3D6B59] hover:bg-[#E7ECE6] cursor-pointer"
                          title="خروجی Excel"
                        >
                          <FileSpreadsheet className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(st)}
                          className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#5B6573] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                          title="حذف صورت‌وضعیت"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {modalState && (
        <ProgressStatementModal
          project={project}
          initial={modalState.statement}
          isNew={modalState.isNew}
          store={store}
          onClose={() => setModalState(null)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف صورت‌وضعیت"
        message={`آیا از حذف صورت‌وضعیت شماره «${deleting ? toPersianDigits(deleting.statementNumber) : ''}» (${deleting?.statementType ?? ''}) اطمینان دارید؟`}
        confirmLabel="حذف صورت‌وضعیت"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await store.deleteProgressStatement(deleting);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
};
