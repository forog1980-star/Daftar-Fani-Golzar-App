import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  Calculator,
  CheckCircle2,
  ClipboardCheck,
  FileSpreadsheet,
  GitBranch,
  History,
  PenTool,
  Printer,
  Save,
  ShieldAlert,
} from 'lucide-react';
import {
  DefectResolutionStatus,
  ProgressStatement,
  ProgressStatementStatus,
  Project,
  StatementWorkflowStage,
  StatementWorkflowStageStatus,
  TechnicalReviewResult,
} from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  buildProgressStatementExportPayload,
  calculateStatementFinancials,
  DEFAULT_STATEMENT_TYPES,
  findDuplicateStatementNumber,
  PROGRESS_STATEMENT_STATUSES,
} from '../../utils/statementCalculations';
import { exportToExcelXlsx, exportToPdfPrint } from '../../utils/exportEngine';
import {
  formatAmount,
  formatJalaliDateTime,
  formatRial,
  toPersianDigits,
} from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';
import { JalaliDateInput } from '../common/JalaliDateInput';
import { SignatureBlockEditor } from '../documents/SignatureBlockEditor';

type SectionTab = 'basic' | 'financial' | 'technical' | 'workflow' | 'signatures' | 'history';

const WORKFLOW_STATUS_OPTIONS: StatementWorkflowStageStatus[] = [
  'در انتظار',
  'در حال بررسی',
  'تأییدشده',
  'نیازمند اصلاح',
  'متوقف / عودت',
  'عدم نیاز',
];

const TECHNICAL_RESULT_OPTIONS: TechnicalReviewResult[] = [
  'در انتظار بررسی',
  'تأیید فنی',
  'تأیید فنی مشروط',
  'نیازمند رفع نقص',
  'عدم تأیید فنی',
];

const DEFECT_STATUS_OPTIONS: DefectResolutionStatus[] = [
  'فاقد نقص',
  'در دست رفع توسط پیمانکار',
  'رفع‌شده و تأیید مجدد',
  'باقی‌مانده',
];

interface ProgressStatementModalProps {
  project: Project;
  initial: ProgressStatement;
  isNew: boolean;
  store: AppStore;
  onClose: () => void;
  onSaved?: (saved: ProgressStatement) => void;
}

export const ProgressStatementModal: React.FC<ProgressStatementModalProps> = ({
  project,
  initial,
  isNew,
  store,
  onClose,
  onSaved,
}) => {
  const [section, setSection] = useState<SectionTab>('basic');
  const [form, setForm] = useState<ProgressStatement>(initial);
  const [customTypeMode, setCustomTypeMode] = useState(
    !DEFAULT_STATEMENT_TYPES.includes(initial.statementType)
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const computed = useMemo(() => calculateStatementFinancials(form), [form]);

  const duplicateMatch = useMemo(
    () =>
      findDuplicateStatementNumber(
        store.progressStatements,
        project.id,
        form.statementNumber,
        isNew ? undefined : form.id
      ),
    [store.progressStatements, project.id, form.statementNumber, isNew, form.id]
  );

  const patchForm = (patch: Partial<ProgressStatement>) => {
    setForm((prev) => ({ ...prev, ...patch }));
  };

  const updateStage = (key: StatementWorkflowStage['key'], patch: Partial<StatementWorkflowStage>) => {
    setForm((prev) => ({
      ...prev,
      workflowStages: prev.workflowStages.map((st) =>
        st.key === key ? { ...st, ...patch } : st
      ),
    }));
  };

  const buildSnapshotStatement = (): ProgressStatement => ({
    ...form,
    statementNumber: form.statementNumber.trim(),
    statementType: form.statementType.trim() || 'موقت',
    contractOrOrderNumber: form.contractOrOrderNumber.trim(),
    contractorName: form.contractorName.trim(),
    vatAmount: computed.effectiveVatAmount,
    modifiedContractAmount: computed.modifiedContractAmount,
    allowedCeilingAmount: computed.allowedCeilingAmount,
    cumulativeAmount: computed.cumulativeAmount,
    netPayableAmount: computed.netPayableAmount,
  });

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.statementNumber.trim()) {
      setSection('basic');
      setErrorMsg('وارد کردن «شماره صورت‌وضعیت» الزامی است.');
      return;
    }
    if (!form.receiptDate.trim()) {
      setSection('basic');
      setErrorMsg('انتخاب «تاریخ دریافت» صورت‌وضعیت الزامی است.');
      return;
    }
    setErrorMsg('');
    setSaving(true);
    try {
      const prepared = buildSnapshotStatement();
      const saved = await store.saveProgressStatement(prepared, isNew);
      onSaved?.(saved);
      onClose();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'خطا در ذخیره‌سازی صورت‌وضعیت');
    } finally {
      setSaving(false);
    }
  };

  const handleExportExcel = async () => {
    const payload = buildProgressStatementExportPayload(
      buildSnapshotStatement(),
      store.settings.letterhead
    );
    await exportToExcelXlsx(
      payload,
      `صورت-وضعیت-${project.code}-${form.statementNumber || 'جدید'}`
    );
  };

  const handlePrintPdf = () => {
    const payload = buildProgressStatementExportPayload(
      buildSnapshotStatement(),
      store.settings.letterhead
    );
    exportToPdfPrint(payload);
  };

  const tabs: Array<{
    key: SectionTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
  }> = [
    { key: 'basic', label: 'الف) مشخصات پایه', icon: ClipboardCheck },
    { key: 'financial', label: 'ب) اطلاعات مالی', icon: Calculator },
    { key: 'technical', label: 'ج) کنترل فنی و مدارک', icon: ShieldAlert },
    { key: 'workflow', label: 'د) گردش ارجاع و بررسی', icon: GitBranch },
    { key: 'signatures', label: 'هـ) امضاها', icon: PenTool },
    { key: 'history', label: `تاریخچه (${toPersianDigits(form.history.length)})`, icon: History },
  ];

  return (
    <FloatingWindow
      title={`رسیدگی به صورت‌وضعیت ـ مدیریت اداره گلزار شهدا (${project.code})`}
      onClose={onClose}
      width={940}
    >
      <form onSubmit={handleSave} className="space-y-4">
        {/* Top Summary Banner */}
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] px-4 py-3 text-xs">
          <div className="space-y-0.5">
            <div className="font-bold text-[#1D3250]">
              {project.code} — {project.title}
            </div>
            <div className="text-[11px] text-[#5B6573]">
              صورت‌وضعیت شماره {toPersianDigits(form.statementNumber || '—')} ({form.statementType}) · وضعیت:{' '}
              <strong className="text-[#243B5A]">{form.status}</strong>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-4 tabular-nums">
            <div>
              <span className="text-[#788290]">مبلغ فعلی: </span>
              <strong className="text-[#243B5A]">{formatRial(form.currentStatementAmount)}</strong>
            </div>
            <div>
              <span className="text-[#788290]">خالص قابل پرداخت: </span>
              <strong className="text-[#2D6A4F]">{formatRial(computed.netPayableAmount)}</strong>
            </div>
          </div>
        </div>

        {/* Duplicate Statement Number Warning */}
        {duplicateMatch && (
          <div className="flex items-start gap-2 rounded-lg border border-[#D4B46A] bg-[#FDF6E3] px-3.5 py-2.5 text-xs text-[#785616]">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-[#B38834]" />
            <div>
              <strong>هشدار شماره تکراری:</strong> در پرونده این پروژه قبلاً صورت‌وضعیتی با شماره «
              {toPersianDigits(duplicateMatch.statementNumber)}» ({duplicateMatch.statementType} — وضعیت:{' '}
              {duplicateMatch.status}) ثبت شده است. در صورت اصلاح یا ثبت مجدد، شماره صورت‌وضعیت را کنترل کنید.
            </div>
          </div>
        )}

        {errorMsg && (
          <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3.5 py-2.5 text-xs text-[#9E3B3B]">
            {errorMsg}
          </div>
        )}

        {/* 5 Structured Tabs + History */}
        <div className="flex flex-wrap gap-1.5 border-b border-[#E2DDD0] pb-2.5">
          {tabs.map((t) => {
            const Icon = t.icon;
            const active = section === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setSection(t.key)}
                className={`inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors cursor-pointer ${
                  active
                    ? 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                    : 'border border-[#E2DDD0] bg-[#FAF8F3] text-[#263448] hover:bg-[#E5EBF2]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span>{t.label}</span>
              </button>
            );
          })}
        </div>

        {/* SECTION الف: Basic Information */}
        {section === 'basic' && (
          <div className="space-y-3.5">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-xs text-[#5B6573]">نام و موضوع پروژه</label>
                <input
                  type="text"
                  value={form.projectTitle}
                  onChange={(e) => patchForm({ projectTitle: e.target.value })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">کد پروژه</label>
                <input
                  type="text"
                  value={form.projectCode}
                  onChange={(e) => patchForm({ projectCode: e.target.value })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">شماره قرارداد یا دستورکار</label>
                <input
                  type="text"
                  value={form.contractOrOrderNumber}
                  onChange={(e) => patchForm({ contractOrOrderNumber: e.target.value })}
                  placeholder="مثال: ۱۴۰۵/ف/۱۲۴"
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">نام پیمانکار / مجری</label>
                <input
                  type="text"
                  value={form.contractorName}
                  onChange={(e) => patchForm({ contractorName: e.target.value })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">شماره صورت‌وضعیت *</label>
                <input
                  type="text"
                  required
                  value={form.statementNumber}
                  onChange={(e) => patchForm({ statementNumber: e.target.value })}
                  placeholder="مثال: ۱ یا موقت-۲"
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">نوع صورت‌وضعیت</label>
                {!customTypeMode ? (
                  <select
                    value={form.statementType}
                    onChange={(e) => {
                      if (e.target.value === '__custom__') {
                        setCustomTypeMode(true);
                        patchForm({ statementType: '' });
                      } else {
                        patchForm({ statementType: e.target.value });
                      }
                    }}
                    className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                  >
                    {DEFAULT_STATEMENT_TYPES.map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                    <option value="__custom__">سایر (ورود نوع دلخواه...)</option>
                  </select>
                ) : (
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={form.statementType}
                      onChange={(e) => patchForm({ statementType: e.target.value })}
                      placeholder="نوع دلخواه (مثلاً ماقبل قطعی)"
                      className="flex-1 rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-2 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => {
                        setCustomTypeMode(false);
                        patchForm({ statementType: 'موقت' });
                      }}
                      className="rounded border border-[#CEC8BA] bg-[#FFFFFF] px-2 text-[11px] text-[#5B6573] cursor-pointer"
                    >
                      لیست
                    </button>
                  </div>
                )}
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">وضعیت پرونده صورت‌وضعیت</label>
                <select
                  value={form.status}
                  onChange={(e) => patchForm({ status: e.target.value as ProgressStatementStatus })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs font-medium text-[#243B5A]"
                >
                  {PROGRESS_STATEMENT_STATUSES.map((st) => (
                    <option key={st} value={st}>
                      {st}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">شروع دوره کارکرد</label>
                <JalaliDateInput
                  value={form.workPeriodFrom ?? ''}
                  onChange={(v) => patchForm({ workPeriodFrom: v })}
                  placeholder="از تاریخ (شمسی)"
                  ariaLabel="شروع دوره کارکرد"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">پایان دوره کارکرد</label>
                <JalaliDateInput
                  value={form.workPeriodTo ?? ''}
                  onChange={(v) => patchForm({ workPeriodTo: v })}
                  placeholder="تا تاریخ (شمسی)"
                  ariaLabel="پایان دوره کارکرد"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">شرح دوره کارکرد (اختیاری)</label>
                <input
                  type="text"
                  value={form.workPeriodLabel ?? ''}
                  onChange={(e) => patchForm({ workPeriodLabel: e.target.value })}
                  placeholder="مثال: مهر تا آبان ۱۴۰۵"
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">تاریخ دریافت *</label>
                <JalaliDateInput
                  value={form.receiptDate}
                  onChange={(v) => patchForm({ receiptDate: v })}
                  required
                  ariaLabel="تاریخ دریافت صورت‌وضعیت"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">تاریخ تهیه / تنظیم</label>
                <JalaliDateInput
                  value={form.preparationDate ?? ''}
                  onChange={(v) => patchForm({ preparationDate: v })}
                  ariaLabel="تاریخ تهیه صورت‌وضعیت"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">تاریخ ارجاع</label>
                <JalaliDateInput
                  value={form.referralDate ?? ''}
                  onChange={(v) => patchForm({ referralDate: v })}
                  ariaLabel="تاریخ ارجاع صورت‌وضعیت"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION ب: Financial Information */}
        {section === 'financial' && (
          <div className="space-y-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">مبلغ اولیه قرارداد (ریال)</label>
                <input
                  type="number"
                  min={0}
                  value={form.initialContractAmount}
                  onChange={(e) => patchForm({ initialContractAmount: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">
                  افزایش / کاهش قرارداد (ریال — منفی برای کاهش)
                </label>
                <input
                  type="number"
                  value={form.contractAdjustmentAmount}
                  onChange={(e) =>
                    patchForm({ contractAdjustmentAmount: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div className="rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] p-2.5 space-y-1.5">
                <label className="flex items-center gap-2 text-xs font-medium text-[#243B5A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.apply25PercentCeiling}
                    onChange={(e) => patchForm({ apply25PercentCeiling: e.target.checked })}
                    className="h-4 w-4 accent-[#243B5A]"
                  />
                  <span>اعمال سقف مجاز افزایش قرارداد</span>
                </label>
                {form.apply25PercentCeiling && (
                  <div className="flex items-center gap-2 text-[11px] text-[#5B6573]">
                    <span>درصد سقف مجاز:</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      value={form.ceilingPercent}
                      onChange={(e) => patchForm({ ceilingPercent: Number(e.target.value) || 0 })}
                      className="w-16 rounded border border-[#CEC8BA] bg-[#FFFFFF] px-2 py-0.5 text-xs tabular-nums"
                    />
                    <span>درصد</span>
                  </div>
                )}
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">
                  جمع صورت‌وضعیت‌های قبلی (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.previousStatementsTotal}
                  onChange={(e) =>
                    patchForm({ previousStatementsTotal: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-semibold text-[#1D3250]">
                  مبلغ صورت‌وضعیت فعلی — ناخالص (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.currentStatementAmount}
                  onChange={(e) =>
                    patchForm({ currentStatementAmount: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-[#243B5A] bg-[#FFFFFF] px-3 py-2 text-xs font-semibold tabular-nums"
                />
              </div>
            </div>

            {/* VAT Control */}
            <div className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-3.5 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <label className="flex items-center gap-2 text-xs font-medium text-[#243B5A] cursor-pointer">
                  <input
                    type="checkbox"
                    checked={form.vatEnabled}
                    onChange={(e) => patchForm({ vatEnabled: e.target.checked })}
                    className="h-4 w-4 accent-[#243B5A]"
                  />
                  <span>محاسبه مالیات بر ارزش افزوده (قابل تنظیم برای این صورت‌وضعیت)</span>
                </label>
                {form.vatEnabled && (
                  <label className="flex items-center gap-1.5 text-[11px] text-[#5B6573] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={form.vatManualOverride}
                      onChange={(e) =>
                        patchForm({
                          vatManualOverride: e.target.checked,
                          vatAmount: computed.effectiveVatAmount,
                        })
                      }
                      className="h-3.5 w-3.5 accent-[#243B5A]"
                    />
                    <span>ورود دستی مبلغ ارزش افزوده</span>
                  </label>
                )}
              </div>

              {form.vatEnabled && (
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-[11px] text-[#5B6573]">درصد ارزش افزوده</label>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.5}
                      disabled={form.vatManualOverride}
                      value={form.vatRate}
                      onChange={(e) => patchForm({ vatRate: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs tabular-nums disabled:opacity-60"
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-[11px] text-[#5B6573]">
                      مبلغ ارزش افزوده (ریال)
                    </label>
                    <input
                      type="number"
                      min={0}
                      disabled={!form.vatManualOverride}
                      value={form.vatManualOverride ? form.vatAmount : computed.effectiveVatAmount}
                      onChange={(e) => patchForm({ vatAmount: Number(e.target.value) || 0 })}
                      className="w-full rounded border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs tabular-nums disabled:bg-[#F3EFE6]"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Deductions, Penalties, Other Deductions */}
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">
                  کسورات قانونی و قراردادی (ریال)
                </label>
                <input
                  type="number"
                  min={0}
                  value={form.deductionsAmount}
                  onChange={(e) => patchForm({ deductionsAmount: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
                <input
                  type="text"
                  value={form.deductionsNotes ?? ''}
                  onChange={(e) => patchForm({ deductionsNotes: e.target.value })}
                  placeholder="شرح (بیمه، حسن انجام کار، علی‌الحساب...)"
                  className="mt-1.5 w-full rounded border border-[#E2DDD0] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px]"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">جریمه و کسرکار (ریال)</label>
                <input
                  type="number"
                  min={0}
                  value={form.penaltiesAndShortfall}
                  onChange={(e) =>
                    patchForm({ penaltiesAndShortfall: Number(e.target.value) || 0 })
                  }
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">سایر کسورات (ریال)</label>
                <input
                  type="number"
                  min={0}
                  value={form.otherDeductions}
                  onChange={(e) => patchForm({ otherDeductions: Number(e.target.value) || 0 })}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs tabular-nums"
                />
                <input
                  type="text"
                  value={form.otherDeductionsNotes ?? ''}
                  onChange={(e) => patchForm({ otherDeductionsNotes: e.target.value })}
                  placeholder="شرح سایر کسورات..."
                  className="mt-1.5 w-full rounded border border-[#E2DDD0] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px]"
                />
              </div>
            </div>

            {/* Transparent Calculation Breakdown */}
            <div className="rounded-xl border border-[#CAD6E6] bg-[#F5F8FC] p-4 space-y-2.5 text-xs">
              <div className="font-bold text-[#1D3250]">
                جمع‌بندی خودکار و شفاف محاسبات مالی (قابل بررسی و کنترل)
              </div>
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3 tabular-nums">
                <div className="rounded-lg border border-[#E2DDD0] bg-[#FFFFFF] p-2.5">
                  <div className="text-[11px] text-[#788290]">مبلغ اصلاح‌شده قرارداد</div>
                  <div className="font-semibold text-[#1D3250]">
                    {formatRial(computed.modifiedContractAmount)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2DDD0] bg-[#FFFFFF] p-2.5">
                  <div className="text-[11px] text-[#788290]">
                    {form.apply25PercentCeiling
                      ? `سقف مجاز (با ${toPersianDigits(form.ceilingPercent)}٪)`
                      : 'سقف مجاز (بدون افزایش ۲۵٪)'}
                  </div>
                  <div
                    className={`font-semibold ${computed.exceedsCeiling ? 'text-[#B43E3E]' : 'text-[#1D3250]'}`}
                  >
                    {formatRial(computed.allowedCeilingAmount)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2DDD0] bg-[#FFFFFF] p-2.5">
                  <div className="text-[11px] text-[#788290]">جمع تجمعی صورت‌وضعیت‌ها</div>
                  <div className="font-semibold text-[#243B5A]">
                    {formatRial(computed.cumulativeAmount)} (
                    {toPersianDigits(computed.cumulativePercentOfContract.toFixed(1))}٪)
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2DDD0] bg-[#FFFFFF] p-2.5">
                  <div className="text-[11px] text-[#788290]">مبلغ ناخالص + ارزش افزوده</div>
                  <div className="font-semibold text-[#243B5A]">
                    {formatRial(computed.grossWithVat)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#E2DDD0] bg-[#FFFFFF] p-2.5">
                  <div className="text-[11px] text-[#788290]">جمع کل کسورات و جرایم</div>
                  <div className="font-semibold text-[#9E3B3B]">
                    {formatRial(computed.totalDeductions)}
                  </div>
                </div>
                <div className="rounded-lg border border-[#3D6B59] bg-[#E7ECE6] p-2.5">
                  <div className="text-[11px] text-[#2D6A4F]">مبلغ خالص قابل پرداخت</div>
                  <div className="text-sm font-bold text-[#1E4D38]">
                    {formatRial(computed.netPayableAmount)}
                  </div>
                </div>
              </div>

              {computed.exceedsCeiling && (
                <div className="flex items-center gap-2 rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9E3B3B]">
                  <AlertTriangle className="h-4 w-4 shrink-0" />
                  <span>
                    هشدار مالی: جمع تجمعی صورت‌وضعیت‌ها به میزان{' '}
                    <strong>{formatRial(computed.ceilingExcessAmount)}</strong> از سقف مجاز قرارداد
                    عبور کرده است.
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* SECTION ج: Technical & Document Control */}
        {section === 'technical' && (
          <div className="space-y-3.5">
            <div className="rounded-lg border border-[#CAD6E6] bg-[#EEF3F9] px-3.5 py-2 text-[11px] leading-5 text-[#1D3250]">
              توجه: ثبت اطلاعات این بخش صرفاً بیانگر <strong>کنترل فنی و مدارک در دفتر فنی</strong>{' '}
              بوده و مستقل از تأمین اعتبار، تأیید مالی و دستور پرداخت است.
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">نتیجه بررسی فنی دفتر فنی</label>
                <select
                  value={form.technicalReviewResult}
                  onChange={(e) =>
                    patchForm({ technicalReviewResult: e.target.value as TechnicalReviewResult })
                  }
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs font-medium"
                >
                  {TECHNICAL_RESULT_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">وضعیت رفع نقص</label>
                <select
                  value={form.defectResolutionStatus}
                  onChange={(e) =>
                    patchForm({ defectResolutionStatus: e.target.value as DefectResolutionStatus })
                  }
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                >
                  {DEFECT_STATUS_OPTIONS.map((opt) => (
                    <option key={opt} value={opt}>
                      {opt}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">مدارک دریافتی از پیمانکار</label>
                <textarea
                  rows={2}
                  value={form.receivedDocuments}
                  onChange={(e) => patchForm({ receivedDocuments: e.target.value })}
                  placeholder="مثال: ریز متره، صورتجلسات انجام کار، برگ آزمایش مصالح، نامه ارسال..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">بررسی مدارک</label>
                <textarea
                  rows={2}
                  value={form.documentReviewNotes}
                  onChange={(e) => patchForm({ documentReviewNotes: e.target.value })}
                  placeholder="نتیجه تطبیق کامل بودن مدارک با مفاد قرارداد..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">گزارش ناظر</label>
                <textarea
                  rows={2}
                  value={form.supervisorReport}
                  onChange={(e) => patchForm({ supervisorReport: e.target.value })}
                  placeholder="خلاصه گزارش ناظر مقیم یا کارگاهی..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">کنترل مقادیر و احجام کارکرد</label>
                <textarea
                  rows={2}
                  value={form.quantityVerification}
                  onChange={(e) => patchForm({ quantityVerification: e.target.value })}
                  placeholder="انطباق احجام و ردیف‌های فهرست بها با بازدید میدانی..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">مغایرت‌ها و نواقص</label>
                <textarea
                  rows={2}
                  value={form.discrepanciesAndDefects}
                  onChange={(e) => patchForm({ discrepanciesAndDefects: e.target.value })}
                  placeholder="درج دقیق مغایرت‌های متراژ، نقص مدارک یا موارد نیازمند اصلاح..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">نظر کارشناس دفتر فنی</label>
                <textarea
                  rows={2}
                  value={form.expertOpinion}
                  onChange={(e) => patchForm({ expertOpinion: e.target.value })}
                  placeholder="نظریه کارشناسی فنی دفتر فنی جهت ارجاع به مراحل بعدی..."
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        {/* SECTION د: Independent 7-Stage Referral & Review Workflow */}
        {section === 'workflow' && (
          <div className="space-y-3">
            <div className="rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] px-3.5 py-2 text-[11px] leading-5 text-[#5B6573]">
              هر مرحله از گردش ارجاع و بررسی کاملاً مستقل ثبت می‌شود. تأیید فنی دفتر فنی به‌هیچ‌وجه به‌معنای تأیید مالی، تأمین اعتبار یا دستور پرداخت نیست و هر مرحله تاریخ، مسئول، وضعیت، توضیح و علت توقف یا عودت مجزا دارد.
            </div>

            <div className="space-y-2.5">
              {form.workflowStages.map((stage, idx) => {
                const isHoldOrReturn =
                  stage.status === 'متوقف / عودت' || stage.status === 'نیازمند اصلاح';
                return (
                  <div
                    key={stage.key}
                    className={`rounded-xl border p-3.5 space-y-2.5 ${
                      stage.status === 'تأییدشده'
                        ? 'border-[#C6D5C4] bg-[#F5F9F4]'
                        : isHoldOrReturn
                          ? 'border-[#E6C5C5] bg-[#FDF6F6]'
                          : 'border-[#E2DDD0] bg-[#FFFFFF]'
                    }`}
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
                        <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#243B5A] text-[10px] text-[#FAF8F3] tabular-nums">
                          {toPersianDigits(idx + 1)}
                        </span>
                        <span>{stage.title}</span>
                      </div>
                      <select
                        value={stage.status}
                        onChange={(e) =>
                          updateStage(stage.key, {
                            status: e.target.value as StatementWorkflowStageStatus,
                          })
                        }
                        className="rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1 text-xs font-medium text-[#243B5A]"
                      >
                        {WORKFLOW_STATUS_OPTIONS.map((opt) => (
                          <option key={opt} value={opt}>
                            {opt}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-3">
                      <div>
                        <label className="mb-1 block text-[11px] text-[#5B6573]">تاریخ بررسی / ارجاع</label>
                        <JalaliDateInput
                          value={stage.date ?? ''}
                          onChange={(v) => updateStage(stage.key, { date: v })}
                          compact
                          ariaLabel={`تاریخ ${stage.title}`}
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[#5B6573]">مسئول بررسی / اقدام‌کننده</label>
                        <input
                          type="text"
                          value={stage.responsibleName}
                          onChange={(e) => updateStage(stage.key, { responsibleName: e.target.value })}
                          placeholder="نام و نام خانوادگی مسئول..."
                          className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[#5B6573]">سمت / واحد</label>
                        <input
                          type="text"
                          value={stage.responsibleRole ?? ''}
                          onChange={(e) => updateStage(stage.key, { responsibleRole: e.target.value })}
                          className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>

                    <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
                      <div>
                        <label className="mb-1 block text-[11px] text-[#5B6573]">توضیحات / هامش این مرحله</label>
                        <input
                          type="text"
                          value={stage.notes}
                          onChange={(e) => updateStage(stage.key, { notes: e.target.value })}
                          placeholder="شرح اقدام، شماره ارجاع یا نظر مستقل این مرحله..."
                          className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                        />
                      </div>
                      <div>
                        <label className="mb-1 block text-[11px] text-[#5B6573]">
                          علت توقف / عودت (در صورت وجود)
                        </label>
                        <input
                          type="text"
                          value={stage.holdOrReturnReason ?? ''}
                          onChange={(e) =>
                            updateStage(stage.key, { holdOrReturnReason: e.target.value })
                          }
                          placeholder="در صورت توقف یا برگشت پرونده، علت دقیق ثبت شود..."
                          className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1.5 text-xs"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* SECTION هـ: Configurable Signatories with Historical Snapshots */}
        {section === 'signatures' && (
          <div className="space-y-2.5">
            <SignatureBlockEditor
              signatures={form.signatures}
              people={store.people}
              onChange={(next) => patchForm({ signatures: next })}
            />
          </div>
        )}

        {/* History Log */}
        {section === 'history' && (
          <div className="space-y-2.5">
            {form.history.length === 0 ? (
              <div className="rounded-xl border border-dashed border-[#CEC8BA] bg-[#FAF8F3] p-6 text-center text-xs text-[#788290]">
                با ذخیره این فرم، تاریخچه ثبت، ویرایش‌ها و تغییر وضعیت‌ها به‌صورت خودکار در اینجا نگهداری می‌شود.
              </div>
            ) : (
              <div className="divide-y divide-[#ECE7DA] rounded-xl border border-[#E2DDD0] bg-[#FFFFFF]">
                {[...form.history].reverse().map((h) => (
                  <div key={h.id} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 text-xs">
                    <div>
                      <div className="font-medium text-[#1D3250]">{h.summary}</div>
                      <div className="text-[11px] text-[#788290]">
                        ثبت‌کننده: {h.actor}
                        {h.statusAfter ? ` · وضعیت: ${h.statusAfter}` : ''}
                      </div>
                    </div>
                    <span className="text-[11px] tabular-nums text-[#5B6573]">
                      {formatJalaliDateTime(h.timestamp)}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Footer Actions: Print/PDF, Excel, Cancel, Save */}
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#E2DDD0] pt-3">
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handlePrintPdf}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <Printer className="h-3.5 w-3.5" />
              <span>چاپ / PDF</span>
            </button>
            <button
              type="button"
              onClick={() => void handleExportExcel()}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D6B59] bg-[#FFFFFF] px-3 py-2 text-xs font-medium text-[#3D6B59] hover:bg-[#E7ECE6] cursor-pointer"
            >
              <FileSpreadsheet className="h-3.5 w-3.5" />
              <span>خروجی Excel</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-[#CEC8BA] px-4 py-2 text-xs text-[#5B6573] hover:bg-[#FAF8F3] cursor-pointer"
            >
              انصراف
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] disabled:opacity-60 cursor-pointer"
            >
              {saving ? (
                <CheckCircle2 className="h-3.5 w-3.5 animate-pulse" />
              ) : (
                <Save className="h-3.5 w-3.5" />
              )}
              <span>{isNew ? 'ذخیره صورت‌وضعیت' : 'ذخیره تغییرات'}</span>
            </button>
          </div>
        </div>
      </form>
    </FloatingWindow>
  );
};
