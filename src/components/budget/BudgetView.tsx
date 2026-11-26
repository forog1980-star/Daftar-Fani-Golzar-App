import React, { useMemo, useState } from 'react';
import { Edit2, FolderOpen, Plus, Trash2 } from 'lucide-react';
import {
  BudgetProposal,
  PaymentRecord,
  Project,
  ProjectBudget,
  ProposalPriority,
} from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatJalaliDate,
  formatRial,
  generateId,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';

interface BudgetViewProps {
  store: AppStore;
  onOpenProject: (project: Project) => void;
}

export const BudgetView: React.FC<BudgetViewProps> = ({ store, onOpenProject }) => {
  const [subTab, setSubTab] = useState<'credits' | 'payments' | 'proposals'>('credits');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('همه');
  const [editingBudget, setEditingBudget] = useState<{ project: Project; budget: ProjectBudget } | null>(null);
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [proposalEditing, setProposalEditing] = useState<BudgetProposal | null | undefined>(undefined);
  const [deletingPayment, setDeletingPayment] = useState<PaymentRecord | null>(null);
  const [deletingProposal, setDeletingProposal] = useState<BudgetProposal | null>(null);

  // Payment form state
  const [payProjectId, setPayProjectId] = useState(store.projects[0]?.id ?? '');
  const [payDate, setPayDate] = useState(todayIsoDate());
  const [payAmount, setPayAmount] = useState('');
  const [payVoucher, setPayVoucher] = useState('');
  const [payStatementRef, setPayStatementRef] = useState('');
  const [payDesc, setPayDesc] = useState('');

  // Proposal form state
  const [propYear, setPropYear] = useState('۱۴۰۶');
  const [propTitle, setPropTitle] = useState('');
  const [propDesc, setPropDesc] = useState('');
  const [propPriority, setPropPriority] = useState<ProposalPriority>('بالا');
  const [propAmount, setPropAmount] = useState('');
  const [propDept, setPropDept] = useState('دفتر فنی اداره گلزار شهدا');

  const projectFinancialRows = useMemo(() => {
    return store.projects.map((project) => {
      const budget: ProjectBudget =
        store.budgets.find((b) => b.projectId === project.id) ?? {
          id: `bud_${project.id}`,
          projectId: project.id,
          approvedCredit: 0,
          notifiedCredit: 0,
          allocatedCredit: 0,
          fundedCredit: 0,
          committedAmount: project.contractAmount || 0,
          submittedStatementAmount: 0,
          approvedStatementAmount: 0,
          notes: '',
          createdAt: project.createdAt,
          updatedAt: project.updatedAt,
          updatedByDevice: store.settings.deviceId,
        };
      const paidAmount = store.payments
        .filter((p) => p.projectId === project.id)
        .reduce((sum, p) => sum + (p.amount || 0), 0);

      const baseCredit = budget.fundedCredit > 0 ? budget.fundedCredit : budget.approvedCredit;
      const remainingCredit = baseCredit - paidAmount;
      const usagePercent = baseCredit > 0 ? (paidAmount / baseCredit) * 100 : 0;

      // نسبت پیشرفت فیزیکی به تأمین اعتبار (درصد تأمین اعتبار نسبت به اعتبار مصوب)
      const fundingPercent =
        budget.approvedCredit > 0 ? (budget.fundedCredit / budget.approvedCredit) * 100 : 0;
      const physicalToFundingRatio =
        fundingPercent > 0 ? project.physicalProgress / fundingPercent : 0;

      return {
        project,
        budget,
        paidAmount,
        remainingCredit,
        usagePercent,
        fundingPercent,
        physicalToFundingRatio,
      };
    });
  }, [store.projects, store.budgets, store.payments, store.settings.deviceId]);

  const totals = useMemo(() => {
    return projectFinancialRows.reduce(
      (acc, r) => ({
        approved: acc.approved + r.budget.approvedCredit,
        funded: acc.funded + r.budget.fundedCredit,
        paid: acc.paid + r.paidAmount,
        remaining: acc.remaining + r.remainingCredit,
      }),
      { approved: 0, funded: 0, paid: 0, remaining: 0 }
    );
  }, [projectFinancialRows]);

  const openProposalEditor = (prop: BudgetProposal | null) => {
    setProposalEditing(prop);
    setPropYear(prop?.fiscalYear ?? '۱۴۰۶');
    setPropTitle(prop?.title ?? '');
    setPropDesc(prop?.description ?? '');
    setPropPriority(prop?.priority ?? 'بالا');
    setPropAmount(String(prop?.estimatedAmount ?? ''));
    setPropDept(prop?.department ?? 'دفتر فنی اداره گلزار شهدا');
  };

  const handleSavePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    const targetProj = store.projects.find((p) => p.id === payProjectId);
    if (!targetProj || !(Number(payAmount) > 0)) return;
    const now = new Date().toISOString();
    await store.savePayment(
      {
        id: generateId('pay'),
        projectId: targetProj.id,
        date: payDate,
        amount: Number(payAmount),
        voucherNumber: payVoucher.trim(),
        statementRef: payStatementRef.trim(),
        description: payDesc.trim(),
        createdAt: now,
        updatedAt: now,
        updatedByDevice: store.settings.deviceId,
      },
      true,
      targetProj.title
    );
    setPaymentModalOpen(false);
    setPayAmount('');
    setPayVoucher('');
    setPayStatementRef('');
    setPayDesc('');
  };

  const handleSaveProposal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!propTitle.trim()) return;
    const now = new Date().toISOString();
    const isNew = !proposalEditing;
    await store.saveProposal(
      {
        id: proposalEditing?.id ?? generateId('prop'),
        fiscalYear: propYear.trim() || '۱۴۰۶',
        title: propTitle.trim(),
        description: propDesc.trim(),
        priority: propPriority,
        estimatedAmount: Number(propAmount) || 0,
        department: propDept.trim(),
        createdAt: proposalEditing?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: store.settings.deviceId,
      },
      isNew
    );
    setProposalEditing(undefined);
  };

  const filteredPayments = store.payments.filter(
    (p) => selectedProjectId === 'همه' || p.projectId === selectedProjectId
  );

  const projectMap = new Map(store.projects.map((p) => [p.id, p]));

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-6">
      {/* Totals Strip */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <div className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
          <div className="text-xs text-[#5B6268]">جمع اعتبار مصوب</div>
          <div className="mt-2 text-base font-semibold tabular-nums text-[#2B3033]">
            {formatRial(totals.approved)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
          <div className="text-xs text-[#5B6268]">جمع تأمین اعتبار</div>
          <div className="mt-2 text-base font-semibold tabular-nums text-[#243B5A]">
            {formatRial(totals.funded)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
          <div className="text-xs text-[#5B6268]">جمع مبالغ پرداخت‌شده</div>
          <div className="mt-2 text-base font-semibold tabular-nums text-[#2D6A4F]">
            {formatRial(totals.paid)}
          </div>
        </div>
        <div className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
          <div className="text-xs text-[#5B6268]">جمع مانده اعتبار</div>
          <div
            className={`mt-2 text-base font-semibold tabular-nums ${
              totals.remaining < 0 ? 'text-[#B43E3E]' : 'text-[#2B3033]'
            }`}
          >
            {formatRial(totals.remaining)}
          </div>
        </div>
      </div>

      {/* Sub-navigation */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-3.5 shadow-[0_2px_8px_rgba(29,50,80,0.04)] lg:flex-row lg:items-center lg:justify-between">
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
          {[
            { key: 'credits' as const, label: 'وضعیت اعتبارات پروژه‌ها' },
            { key: 'payments' as const, label: `سوابق پرداخت‌ها (${toPersianDigits(store.payments.length)})` },
            { key: 'proposals' as const, label: `پیشنهاد بودجه سال آینده (${toPersianDigits(store.proposals.length)})` },
          ].map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setSubTab(t.key)}
              className={`inline-flex h-9 items-center justify-center rounded-xl px-3.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                subTab === t.key
                  ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                  : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {(subTab === 'payments' || subTab === 'proposals') && (
          <div className="flex items-center gap-2 shrink-0">
            {subTab === 'payments' && (
              <button
                type="button"
                onClick={() => {
                  setPayProjectId(store.projects[0]?.id ?? '');
                  setPaymentModalOpen(true);
                }}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap lg:w-auto"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>ثبت پرداخت جدید</span>
              </button>
            )}
            {subTab === 'proposals' && (
              <button
                type="button"
                onClick={() => openProposalEditor(null)}
                className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap lg:w-auto"
              >
                <Plus className="h-3.5 w-3.5 shrink-0" />
                <span>ثبت پیشنهاد بودجه سال آینده</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Tab 1: Per-Project Financial Matrix */}
      {subTab === 'credits' && (
        <div className="overflow-x-auto rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
          {projectFinancialRows.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7C8287]">
              ابتدا از بخش پرونده پروژه‌ها یک پروژه ثبت کنید تا جدول اعتبارات آن نمایش داده شود.
            </div>
          ) : (
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-[#5B6268]">
                  <th className="px-3 py-3 font-medium">پروژه</th>
                  <th className="px-3 py-3 font-medium">مصوب / ابلاغی</th>
                  <th className="px-3 py-3 font-medium">تخصیص / تأمین</th>
                  <th className="px-3 py-3 font-medium">تعهدشده</th>
                  <th className="px-3 py-3 font-medium">ص‌وض ارائه‌شده / تأییدشده</th>
                  <th className="px-3 py-3 font-medium">پرداخت‌شده</th>
                  <th className="px-3 py-3 font-medium">مانده اعتبار</th>
                  <th className="px-3 py-3 font-medium">مصرف / نسبت فیزیکی به تأمین</th>
                  <th className="px-3 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DA]">
                {projectFinancialRows.map((row) => (
                  <tr key={row.project.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-3 py-3">
                      <button
                        type="button"
                        onClick={() => onOpenProject(row.project)}
                        className="text-right font-medium text-[#2B3033] hover:text-[#243B5A] hover:underline cursor-pointer"
                      >
                        {row.project.title}
                      </button>
                      <div className="mt-0.5 text-[11px] text-[#7C8287]">
                        {row.project.code} · پیشرفت فیزیکی {toPersianDigits(row.project.physicalProgress)}٪
                      </div>
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <div>{formatRial(row.budget.approvedCredit)}</div>
                      <div className="text-[11px] text-[#7C8287]">{formatRial(row.budget.notifiedCredit)}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <div>{formatRial(row.budget.allocatedCredit)}</div>
                      <div className="text-[11px] text-[#243B5A]">{formatRial(row.budget.fundedCredit)}</div>
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      {formatRial(row.budget.committedAmount)}
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <div>{formatRial(row.budget.submittedStatementAmount)}</div>
                      <div className="text-[11px] text-[#2D6A4F]">
                        {formatRial(row.budget.approvedStatementAmount)}
                      </div>
                    </td>
                    <td className="px-3 py-3 font-semibold tabular-nums text-[#2D6A4F] whitespace-nowrap">
                      {formatRial(row.paidAmount)}
                    </td>
                    <td
                      className={`px-3 py-3 font-semibold tabular-nums whitespace-nowrap ${
                        row.remainingCredit < 0 ? 'text-[#B43E3E]' : 'text-[#2B3033]'
                      }`}
                    >
                      {formatRial(row.remainingCredit)}
                    </td>
                    <td className="px-3 py-3 tabular-nums whitespace-nowrap">
                      <div>مصرف: {toPersianDigits(row.usagePercent.toFixed(1))}٪</div>
                      <div className="text-[11px] text-[#5B6268]">
                        نسبت فیزیکی/تأمین: {toPersianDigits(row.physicalToFundingRatio.toFixed(2))}
                      </div>
                    </td>
                    <td className="px-3 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => setEditingBudget({ project: row.project, budget: row.budget })}
                          className="inline-flex items-center gap-1 border border-[#243B5A] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                        >
                          <Edit2 className="h-3 w-3" />
                          <span>ویرایش مالی</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setPayProjectId(row.project.id);
                            setPaymentModalOpen(true);
                          }}
                          className="border border-[#CEC7B6] bg-[#FFFFFF] px-2 py-1 text-xs text-[#2B3033] hover:bg-[#F3EFE6] cursor-pointer"
                          title="ثبت پرداخت برای این پروژه"
                        >
                          + پرداخت
                        </button>
                        <button
                          type="button"
                          onClick={() => onOpenProject(row.project)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                          title="گشودن پرونده پروژه"
                        >
                          <FolderOpen className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Tab 2: Payments History */}
      {subTab === 'payments' && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <select
              value={selectedProjectId}
              onChange={(e) => setSelectedProjectId(e.target.value)}
              className="border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#2B3033]"
            >
              <option value="همه">همه پروژه‌ها</option>
              {store.projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title}
                </option>
              ))}
            </select>
            <span className="text-xs text-[#7C8287]">
              هر پرداخت به‌صورت خودکار از مانده اعتبار پروژه کسر و در سوابق مالی حفظ می‌شود.
            </span>
          </div>

          <div className="border border-[#E2DDD0] bg-[#FFFFFF] overflow-x-auto">
            {filteredPayments.length === 0 ? (
              <div className="p-8 text-center text-sm text-[#7C8287]">
                سابقه پرداختی ثبت نشده است.
              </div>
            ) : (
              <table className="w-full text-right text-sm">
                <thead>
                  <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                    <th className="px-4 py-3 font-medium">پروژه</th>
                    <th className="px-4 py-3 font-medium">تاریخ پرداخت</th>
                    <th className="px-4 py-3 font-medium">شماره سند</th>
                    <th className="px-4 py-3 font-medium">بابت / صورت‌وضعیت</th>
                    <th className="px-4 py-3 font-medium">مبلغ پرداختی</th>
                    <th className="px-4 py-3 font-medium">حذف</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#ECE7DA]">
                  {filteredPayments.map((pay) => (
                    <tr key={pay.id} className="hover:bg-[#FAF8F3]">
                      <td className="px-4 py-3 text-xs font-medium text-[#2B3033]">
                        {projectMap.get(pay.projectId)?.title ?? 'پروژه حذف‌شده'}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#5B6268] whitespace-nowrap">
                        {formatJalaliDate(pay.date)}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#2B3033] whitespace-nowrap">
                        {pay.voucherNumber || '—'}
                      </td>
                      <td className="px-4 py-3 text-xs text-[#5B6268]">
                        <div>{pay.statementRef || '—'}</div>
                        {pay.description && (
                          <div className="text-[11px] text-[#7C8287]">{pay.description}</div>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs font-semibold tabular-nums text-[#2D6A4F] whitespace-nowrap">
                        {formatRial(pay.amount)}
                      </td>
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => setDeletingPayment(pay)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                          title="حذف پرداخت"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* Tab 3: Next-Year Budget Proposals */}
      {subTab === 'proposals' && (
        <div className="border border-[#E2DDD0] bg-[#FFFFFF] overflow-x-auto">
          {store.proposals.length === 0 ? (
            <div className="p-8 text-center text-sm text-[#7C8287]">
              پیشنهاد بودجه‌ای برای سال آینده ثبت نشده است.
            </div>
          ) : (
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                  <th className="px-4 py-3 font-medium">سال</th>
                  <th className="px-4 py-3 font-medium">عنوان و شرح پیشنهاد</th>
                  <th className="px-4 py-3 font-medium">حوزه مرتبط</th>
                  <th className="px-4 py-3 font-medium">اولویت</th>
                  <th className="px-4 py-3 font-medium">برآورد مبلغ</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DA]">
                {store.proposals.map((pr) => (
                  <tr key={pr.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-4 py-3 text-xs tabular-nums text-[#5B6268] whitespace-nowrap">
                      {pr.fiscalYear}
                    </td>
                    <td className="px-4 py-3">
                      <div className="text-sm font-medium text-[#2B3033]">{pr.title}</div>
                      <div className="mt-0.5 text-xs text-[#5B6268]">{pr.description}</div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6268]">{pr.department}</td>
                    <td className="px-4 py-3 text-xs font-medium whitespace-nowrap">
                      <span
                        className={
                          pr.priority === 'فوری'
                            ? 'text-[#B43E3E]'
                            : pr.priority === 'بالا'
                              ? 'text-[#A66B1C]'
                              : 'text-[#243B5A]'
                        }
                      >
                        {pr.priority}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-semibold tabular-nums text-[#2B3033] whitespace-nowrap">
                      {formatRial(pr.estimatedAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => openProposalEditor(pr)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingProposal(pr)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit Project Budget Floating Window */}
      {editingBudget && (
        <BudgetEditWindow
          project={editingBudget.project}
          initial={editingBudget.budget}
          onClose={() => setEditingBudget(null)}
          onSave={async (updated) => {
            await store.saveBudget(updated, editingBudget.project.title);
            setEditingBudget(null);
          }}
        />
      )}

      {/* New Payment Floating Window */}
      {paymentModalOpen && (
        <FloatingWindow
          title="ثبت پرداخت مالی (کسر خودکار از مانده اعتبار)"
          onClose={() => setPaymentModalOpen(false)}
          width={560}
        >
          <form onSubmit={handleSavePayment} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">پروژه مرتبط *</label>
              <select
                required
                value={payProjectId}
                onChange={(e) => setPayProjectId(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              >
                {store.projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">مبلغ پرداختی (ریال) *</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={payAmount}
                  onChange={(e) => setPayAmount(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">تاریخ پرداخت</label>
                <input
                  type="date"
                  value={payDate}
                  onChange={(e) => setPayDate(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">شماره سند مالی / چک</label>
                <input
                  type="text"
                  value={payVoucher}
                  onChange={(e) => setPayVoucher(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">مرجع صورت‌وضعیت</label>
                <input
                  type="text"
                  value={payStatementRef}
                  onChange={(e) => setPayStatementRef(e.target.value)}
                  placeholder="مثال: صورت‌وضعیت موقت ۲"
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">توضیحات</label>
              <textarea
                rows={2}
                value={payDesc}
                onChange={(e) => setPayDesc(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setPaymentModalOpen(false)}
                className="border border-[#CEC7B6] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3]"
              >
                ثبت پرداخت
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}

      {/* Proposal Floating Window */}
      {proposalEditing !== undefined && (
        <FloatingWindow
          title={proposalEditing ? 'ویرایش پیشنهاد بودجه' : 'ثبت پیشنهاد بودجه سال آینده'}
          onClose={() => setProposalEditing(undefined)}
          width={560}
        >
          <form onSubmit={handleSaveProposal} className="space-y-3.5">
            <div className="grid grid-cols-3 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">سال مالی</label>
                <input
                  type="text"
                  value={propYear}
                  onChange={(e) => setPropYear(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div className="col-span-2">
                <label className="mb-1 block text-xs text-[#5B6268]">عنوان پیشنهاد *</label>
                <input
                  type="text"
                  required
                  value={propTitle}
                  onChange={(e) => setPropTitle(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">اولویت</label>
                <select
                  value={propPriority}
                  onChange={(e) => setPropPriority(e.target.value as ProposalPriority)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                >
                  <option value="فوری">فوری</option>
                  <option value="بالا">بالا</option>
                  <option value="متوسط">متوسط</option>
                  <option value="عادی">عادی</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">برآورد مبلغ (ریال)</label>
                <input
                  type="number"
                  min={0}
                  value={propAmount}
                  onChange={(e) => setPropAmount(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">حوزه یا معاونت پیشنهاددهنده</label>
              <input
                type="text"
                value={propDept}
                onChange={(e) => setPropDept(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">شرح و توجیه فنی</label>
              <textarea
                rows={3}
                value={propDesc}
                onChange={(e) => setPropDesc(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setProposalEditing(undefined)}
                className="border border-[#CEC7B6] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3]"
              >
                ذخیره پیشنهاد
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}

      <ConfirmDialog
        open={Boolean(deletingPayment)}
        title="حذف رکورد پرداخت"
        message={`آیا از حذف پرداخت به مبلغ ${formatRial(deletingPayment?.amount)} اطمینان دارید؟ مانده اعتبار پروژه متناسب با این تغییر بازمحاسبه می‌شود.`}
        confirmLabel="حذف پرداخت"
        danger
        onCancel={() => setDeletingPayment(null)}
        onConfirm={async () => {
          if (deletingPayment) {
            await store.deletePayment(deletingPayment);
            setDeletingPayment(null);
          }
        }}
      />

      <ConfirmDialog
        open={Boolean(deletingProposal)}
        title="حذف پیشنهاد بودجه"
        message={`آیا از حذف پیشنهاد «${deletingProposal?.title ?? ''}» اطمینان دارید؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setDeletingProposal(null)}
        onConfirm={async () => {
          if (deletingProposal) {
            await store.deleteProposal(deletingProposal);
            setDeletingProposal(null);
          }
        }}
      />
    </div>
  );
};

const BudgetEditWindow: React.FC<{
  project: Project;
  initial: ProjectBudget;
  onSave: (budget: ProjectBudget) => Promise<void>;
  onClose: () => void;
}> = ({ project, initial, onSave, onClose }) => {
  const [approvedCredit, setApprovedCredit] = useState(String(initial.approvedCredit));
  const [notifiedCredit, setNotifiedCredit] = useState(String(initial.notifiedCredit));
  const [allocatedCredit, setAllocatedCredit] = useState(String(initial.allocatedCredit));
  const [fundedCredit, setFundedCredit] = useState(String(initial.fundedCredit));
  const [committedAmount, setCommittedAmount] = useState(String(initial.committedAmount));
  const [submittedStatementAmount, setSubmittedStatementAmount] = useState(
    String(initial.submittedStatementAmount)
  );
  const [approvedStatementAmount, setApprovedStatementAmount] = useState(
    String(initial.approvedStatementAmount)
  );
  const [notes, setNotes] = useState(initial.notes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    await onSave({
      ...initial,
      approvedCredit: Number(approvedCredit) || 0,
      notifiedCredit: Number(notifiedCredit) || 0,
      allocatedCredit: Number(allocatedCredit) || 0,
      fundedCredit: Number(fundedCredit) || 0,
      committedAmount: Number(committedAmount) || 0,
      submittedStatementAmount: Number(submittedStatementAmount) || 0,
      approvedStatementAmount: Number(approvedStatementAmount) || 0,
      notes: notes.trim(),
    });
  };

  return (
    <FloatingWindow title={`ویرایش بودجه و اعتبارات: ${project.title}`} onClose={onClose} width={660}>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
          {[
            { label: 'اعتبار مصوب (ریال)', val: approvedCredit, set: setApprovedCredit },
            { label: 'اعتبار ابلاغی (ریال)', val: notifiedCredit, set: setNotifiedCredit },
            { label: 'اعتبار تخصیص‌یافته (ریال)', val: allocatedCredit, set: setAllocatedCredit },
            { label: 'تأمین اعتبار (ریال)', val: fundedCredit, set: setFundedCredit },
            { label: 'مبلغ تعهدشده (ریال)', val: committedAmount, set: setCommittedAmount },
            {
              label: 'صورت‌وضعیت ارائه‌شده (ریال)',
              val: submittedStatementAmount,
              set: setSubmittedStatementAmount,
            },
            {
              label: 'صورت‌وضعیت تأییدشده (ریال)',
              val: approvedStatementAmount,
              set: setApprovedStatementAmount,
            },
          ].map((field) => (
            <div key={field.label}>
              <label className="mb-1 block text-xs text-[#5B6268]">{field.label}</label>
              <input
                type="number"
                min={0}
                value={field.val}
                onChange={(e) => field.set(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033]"
              />
            </div>
          ))}
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">ملاحظات مالی</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>
        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3]"
          >
            ذخیره اطلاعات مالی
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
