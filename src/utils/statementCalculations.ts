import {
  LetterheadConfig,
  ProgressStatement,
  ProgressStatementStatus,
  Project,
  StatementWorkflowStage,
} from '../types';
import { ExportTablePayload } from './exportEngine';
import { formatAmount, formatJalaliDate, formatRial, todayIsoDate, toPersianDigits } from './format';

export const PROGRESS_STATEMENT_STATUSES: ProgressStatementStatus[] = [
  'ثبت‌شده',
  'در کنترل',
  'دارای نقص',
  'تأیید فنی',
  'ارجاع مالی',
  'متوقف',
  'پرداخت‌شده',
  'مختومه',
];

export const DEFAULT_STATEMENT_TYPES: string[] = ['موقت', 'قطعی', 'تعدیل'];

export interface StatementFinancialInput {
  initialContractAmount: number;
  contractAdjustmentAmount: number;
  apply25PercentCeiling: boolean;
  ceilingPercent: number;
  previousStatementsTotal: number;
  currentStatementAmount: number;
  deductionsAmount: number;
  vatEnabled: boolean;
  vatRate: number;
  vatManualOverride: boolean;
  vatAmount: number;
  penaltiesAndShortfall: number;
  otherDeductions: number;
}

export interface StatementFinancialComputed {
  modifiedContractAmount: number;
  allowedCeilingAmount: number;
  cumulativeAmount: number;
  remainingBeforeCeiling: number;
  exceedsCeiling: boolean;
  ceilingExcessAmount: number;
  effectiveVatAmount: number;
  grossWithVat: number;
  totalDeductions: number;
  netPayableAmount: number;
  cumulativePercentOfContract: number;
}

function safeNum(v: unknown): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
}

/**
 * Pure, transparent financial calculation for Progress Statements.
 * All intermediate figures are returned explicitly so users can review every step.
 */
export function calculateStatementFinancials(
  input: StatementFinancialInput
): StatementFinancialComputed {
  const initial = Math.max(0, safeNum(input.initialContractAmount));
  const adjustment = safeNum(input.contractAdjustmentAmount);
  const modifiedContractAmount = Math.max(0, initial + adjustment);

  const ceilingPercent = Math.max(0, safeNum(input.ceilingPercent));
  const allowedCeilingAmount = input.apply25PercentCeiling
    ? Math.round(modifiedContractAmount * (1 + ceilingPercent / 100))
    : modifiedContractAmount;

  const previousTotal = Math.max(0, safeNum(input.previousStatementsTotal));
  const currentAmount = Math.max(0, safeNum(input.currentStatementAmount));
  const cumulativeAmount = previousTotal + currentAmount;

  const remainingBeforeCeiling = allowedCeilingAmount - cumulativeAmount;
  const exceedsCeiling = allowedCeilingAmount > 0 && cumulativeAmount > allowedCeilingAmount;
  const ceilingExcessAmount = exceedsCeiling ? cumulativeAmount - allowedCeilingAmount : 0;

  const vatRate = Math.max(0, safeNum(input.vatRate));
  const effectiveVatAmount = input.vatEnabled
    ? input.vatManualOverride
      ? Math.max(0, Math.round(safeNum(input.vatAmount)))
      : Math.round((currentAmount * vatRate) / 100)
    : 0;

  const grossWithVat = currentAmount + effectiveVatAmount;

  const deductions = Math.max(0, safeNum(input.deductionsAmount));
  const penalties = Math.max(0, safeNum(input.penaltiesAndShortfall));
  const otherDed = Math.max(0, safeNum(input.otherDeductions));
  const totalDeductions = deductions + penalties + otherDed;

  const netPayableAmount = grossWithVat - totalDeductions;
  const cumulativePercentOfContract =
    modifiedContractAmount > 0 ? (cumulativeAmount / modifiedContractAmount) * 100 : 0;

  return {
    modifiedContractAmount,
    allowedCeilingAmount,
    cumulativeAmount,
    remainingBeforeCeiling,
    exceedsCeiling,
    ceilingExcessAmount,
    effectiveVatAmount,
    grossWithVat,
    totalDeductions,
    netPayableAmount,
    cumulativePercentOfContract,
  };
}

/**
 * Creates the 7 independent review & referral stages.
 * Strictly separates technical office opinion from management, HSE, funding, finance referral, and final result.
 */
export function createDefaultWorkflowStages(): StatementWorkflowStage[] {
  return [
    {
      key: 'supervisor',
      title: 'بررسی ناظر / دفتر فنی (صرفاً نظر فنی)',
      domain: 'technical',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'ناظر / کارشناس دفتر فنی',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'management',
      title: 'بررسی مدیریت اداره گلزار شهدا',
      domain: 'management',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'مدیر اداره گلزار شهدا',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'ceo_referral',
      title: 'ارجاع مدیرعامل',
      domain: 'management',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'مدیرعامل',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'hse',
      title: 'بررسی ایمنی و بهداشت (HSE) در صورت نیاز',
      domain: 'hse',
      required: false,
      status: 'عدم نیاز',
      date: '',
      responsibleName: '',
      responsibleRole: 'مسئول ایمنی و HSE',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'funding',
      title: 'تأمین اعتبار (مستقل از نظر فنی)',
      domain: 'financial',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'مسئول بودجه و تأمین اعتبار',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'finance_referral',
      title: 'ارجاع مالی و رسیدگی اسنادی (دستور پرداخت مستقل)',
      domain: 'financial',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'امور مالی و ذی‌حسابی',
      notes: '',
      holdOrReturnReason: '',
    },
    {
      key: 'final_result',
      title: 'نتیجه نهایی رسیدگی و وضعیت پرونده',
      domain: 'final',
      required: true,
      status: 'در انتظار',
      date: '',
      responsibleName: '',
      responsibleRole: 'جمع‌بندی نهایی',
      notes: '',
      holdOrReturnReason: '',
    },
  ];
}

export function normalizeStatementNumber(value: string): string {
  const persianToEnglish: Record<string, string> = {
    '۰': '0',
    '۱': '1',
    '۲': '2',
    '۳': '3',
    '۴': '4',
    '۵': '5',
    '۶': '6',
    '۷': '7',
    '۸': '8',
    '۹': '9',
    '٠': '0',
    '١': '1',
    '٢': '2',
    '٣': '3',
    '٤': '4',
    '٥': '5',
    '٦': '6',
    '٧': '7',
    '٨': '8',
    '٩': '9',
  };
  return value
    .trim()
    .replace(/[۰-۹٠-٩]/g, (d) => persianToEnglish[d] ?? d)
    .replace(/\s+/g, ' ')
    .toLowerCase();
}

export function findDuplicateStatementNumber(
  statements: ProgressStatement[],
  projectId: string,
  statementNumber: string,
  excludeId?: string
): ProgressStatement | null {
  const target = normalizeStatementNumber(statementNumber);
  if (!target) return null;
  return (
    statements.find(
      (s) =>
        s.projectId === projectId &&
        s.id !== excludeId &&
        normalizeStatementNumber(s.statementNumber) === target
    ) ?? null
  );
}

export interface ProjectStatementsSummary {
  count: number;
  totalCurrentGross: number;
  totalNetPayable: number;
  technicallyApprovedAmount: number;
  financeReferredOrPaidAmount: number;
  paidAmount: number;
  hasDefectsCount: number;
  latestStatement?: ProgressStatement;
}

export function summarizeProjectStatements(
  statements: ProgressStatement[],
  projectId: string
): ProjectStatementsSummary {
  const list = statements
    .filter((s) => s.projectId === projectId)
    .sort((a, b) => (b.receiptDate || b.createdAt).localeCompare(a.receiptDate || a.createdAt));

  let totalCurrentGross = 0;
  let totalNetPayable = 0;
  let technicallyApprovedAmount = 0;
  let financeReferredOrPaidAmount = 0;
  let paidAmount = 0;
  let hasDefectsCount = 0;

  for (const st of list) {
    const calc = calculateStatementFinancials(st);
    totalCurrentGross += st.currentStatementAmount || 0;
    totalNetPayable += calc.netPayableAmount;
    if (
      st.technicalReviewResult === 'تأیید فنی' ||
      st.technicalReviewResult === 'تأیید فنی مشروط' ||
      st.status === 'تأیید فنی' ||
      st.status === 'ارجاع مالی' ||
      st.status === 'پرداخت‌شده' ||
      st.status === 'مختومه'
    ) {
      technicallyApprovedAmount += calc.netPayableAmount;
    }
    if (st.status === 'ارجاع مالی' || st.status === 'پرداخت‌شده' || st.status === 'مختومه') {
      financeReferredOrPaidAmount += calc.netPayableAmount;
    }
    if (st.status === 'پرداخت‌شده' || st.status === 'مختومه') {
      paidAmount += calc.netPayableAmount;
    }
    if (st.status === 'دارای نقص' || st.defectResolutionStatus === 'باقی‌مانده') {
      hasDefectsCount++;
    }
  }

  return {
    count: list.length,
    totalCurrentGross,
    totalNetPayable,
    technicallyApprovedAmount,
    financeReferredOrPaidAmount,
    paidAmount,
    hasDefectsCount,
    latestStatement: list[0],
  };
}

export function createNewStatementDraft(
  project: Project,
  existingProjectStatements: ProgressStatement[],
  deviceId: string
): ProgressStatement {
  const prevTotal = existingProjectStatements
    .filter((s) => s.status !== 'متوقف')
    .reduce((sum, s) => sum + (s.currentStatementAmount || 0), 0);
  const nextNumber = String(existingProjectStatements.length + 1);
  const now = new Date().toISOString();

  const baseFinancials: StatementFinancialInput = {
    initialContractAmount: project.contractAmount || 0,
    contractAdjustmentAmount: 0,
    apply25PercentCeiling: true,
    ceilingPercent: 25,
    previousStatementsTotal: prevTotal,
    currentStatementAmount: 0,
    deductionsAmount: 0,
    vatEnabled: false,
    vatRate: 10,
    vatManualOverride: false,
    vatAmount: 0,
    penaltiesAndShortfall: 0,
    otherDeductions: 0,
  };
  const computed = calculateStatementFinancials(baseFinancials);

  return {
    id: `stmt_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`,
    projectId: project.id,
    projectCode: project.code,
    projectTitle: project.title,
    contractOrOrderNumber: project.contractNumber || '',
    contractorName: project.contractor || '',
    statementNumber: nextNumber,
    statementType: 'موقت',
    workPeriodFrom: '',
    workPeriodTo: '',
    workPeriodLabel: '',
    receiptDate: todayIsoDate(),
    preparationDate: todayIsoDate(),
    referralDate: '',
    status: 'ثبت‌شده',
    ...baseFinancials,
    deductionsNotes: '',
    otherDeductionsNotes: '',
    modifiedContractAmount: computed.modifiedContractAmount,
    allowedCeilingAmount: computed.allowedCeilingAmount,
    cumulativeAmount: computed.cumulativeAmount,
    netPayableAmount: computed.netPayableAmount,
    receivedDocuments: '',
    documentReviewNotes: '',
    supervisorReport: '',
    quantityVerification: '',
    discrepanciesAndDefects: '',
    expertOpinion: '',
    technicalReviewResult: 'در انتظار بررسی',
    defectResolutionStatus: 'فاقد نقص',
    workflowStages: createDefaultWorkflowStages(),
    signatures: [],
    history: [],
    attachmentIds: [],
    createdAt: now,
    updatedAt: now,
    updatedByDevice: deviceId,
  };
}

export function buildProgressStatementExportPayload(
  statement: ProgressStatement,
  letterhead: LetterheadConfig
): ExportTablePayload {
  const calc = calculateStatementFinancials(statement);
  const workPeriodText =
    statement.workPeriodLabel?.trim() ||
    (statement.workPeriodFrom || statement.workPeriodTo
      ? `از ${statement.workPeriodFrom ? formatJalaliDate(statement.workPeriodFrom) : '—'} تا ${statement.workPeriodTo ? formatJalaliDate(statement.workPeriodTo) : '—'}`
      : '—');

  const summaryRows: Array<{ label: string; value: string }> = [
    { label: 'نام و کد پروژه', value: `${statement.projectTitle} (${statement.projectCode || '—'})` },
    { label: 'شماره قرارداد / دستورکار', value: statement.contractOrOrderNumber || '—' },
    { label: 'نام پیمانکار / مجری', value: statement.contractorName || '—' },
    {
      label: 'شماره و نوع صورت‌وضعیت',
      value: `شماره ${toPersianDigits(statement.statementNumber || '—')} — نوع: ${statement.statementType}`,
    },
    { label: 'دوره کارکرد', value: workPeriodText },
    {
      label: 'تاریخ دریافت / تهیه / ارجاع',
      value: `دریافت: ${formatJalaliDate(statement.receiptDate)} | تهیه: ${formatJalaliDate(statement.preparationDate)} | ارجاع: ${formatJalaliDate(statement.referralDate)}`,
    },
    { label: 'وضعیت فعلی صورت‌وضعیت', value: statement.status },
    { label: 'مبلغ اولیه قرارداد', value: formatRial(statement.initialContractAmount) },
    { label: 'افزایش / کاهش قرارداد', value: formatRial(statement.contractAdjustmentAmount) },
    { label: 'مبلغ اصلاح‌شده قرارداد', value: formatRial(calc.modifiedContractAmount) },
    {
      label: statement.apply25PercentCeiling
        ? `سقف مجاز (با لحاظ ${toPersianDigits(statement.ceilingPercent)}٪)`
        : 'سقف مجاز قرارداد (بدون افزایش ۲۵٪)',
      value: calc.exceedsCeiling
        ? `${formatRial(calc.allowedCeilingAmount)} — هشدار: عبور به میزان ${formatRial(calc.ceilingExcessAmount)}`
        : formatRial(calc.allowedCeilingAmount),
    },
    { label: 'جمع صورت‌وضعیت‌های قبلی', value: formatRial(statement.previousStatementsTotal) },
    { label: 'مبلغ صورت‌وضعیت فعلی (ناخالص)', value: formatRial(statement.currentStatementAmount) },
    {
      label: 'جمع تجمعی تا این صورت‌وضعیت',
      value: `${formatRial(calc.cumulativeAmount)} (${toPersianDigits(calc.cumulativePercentOfContract.toFixed(1))}٪ قرارداد)`,
    },
    {
      label: 'ارزش افزوده',
      value: statement.vatEnabled
        ? `${formatRial(calc.effectiveVatAmount)} (${statement.vatManualOverride ? 'دستی' : `${toPersianDigits(statement.vatRate)}٪`})`
        : 'مشمول نیست (۰ ریال)',
    },
    {
      label: 'کسورات قانونی / قراردادی',
      value: `${formatRial(statement.deductionsAmount)}${statement.deductionsNotes ? ` (${statement.deductionsNotes})` : ''}`,
    },
    { label: 'جریمه و کسرکار', value: formatRial(statement.penaltiesAndShortfall) },
    {
      label: 'سایر کسورات',
      value: `${formatRial(statement.otherDeductions)}${statement.otherDeductionsNotes ? ` (${statement.otherDeductionsNotes})` : ''}`,
    },
    { label: 'مبلغ خالص قابل پرداخت (محاسبه‌شده)', value: formatRial(calc.netPayableAmount) },
    { label: 'نتیجه بررسی فنی دفتر فنی (مستقل از تأیید مالی)', value: statement.technicalReviewResult },
    { label: 'وضعیت رفع نقص', value: statement.defectResolutionStatus },
  ];

  const narrativeParagraphs: string[] = [];
  if (statement.receivedDocuments?.trim()) {
    narrativeParagraphs.push(`مدارک دریافتی: ${statement.receivedDocuments.trim()}`);
  }
  if (statement.documentReviewNotes?.trim()) {
    narrativeParagraphs.push(`بررسی مدارک: ${statement.documentReviewNotes.trim()}`);
  }
  if (statement.supervisorReport?.trim()) {
    narrativeParagraphs.push(`گزارش ناظر: ${statement.supervisorReport.trim()}`);
  }
  if (statement.quantityVerification?.trim()) {
    narrativeParagraphs.push(`کنترل مقادیر و احجام: ${statement.quantityVerification.trim()}`);
  }
  if (statement.discrepanciesAndDefects?.trim()) {
    narrativeParagraphs.push(`مغایرت‌ها و نواقص: ${statement.discrepanciesAndDefects.trim()}`);
  }
  if (statement.expertOpinion?.trim()) {
    narrativeParagraphs.push(
      `نظریه فنی کارشناس دفتر فنی (صرفاً نظر فنی و مجزا از تأمین اعتبار و دستور پرداخت): ${statement.expertOpinion.trim()}`
    );
  }

  const rows: string[][] = statement.workflowStages.map((stage, idx) => [
    toPersianDigits(idx + 1),
    stage.title,
    stage.status,
    stage.date ? formatJalaliDate(stage.date) : '—',
    [stage.responsibleName, stage.responsibleRole].filter(Boolean).join(' — ') || '—',
    [stage.notes, stage.holdOrReturnReason ? `علت توقف/عودت: ${stage.holdOrReturnReason}` : '']
      .filter(Boolean)
      .join(' | ') || '—',
  ]);

  return {
    title: 'فرم رسیدگی به صورت‌وضعیت ـ مدیریت اداره گلزار شهدا',
    subtitle: `پروژه: ${statement.projectTitle} | صورت‌وضعیت شماره ${toPersianDigits(statement.statementNumber)} (${statement.statementType})`,
    documentNumber: `ص‌وض-${statement.projectCode || ''}-${statement.statementNumber || ''}`,
    date: statement.receiptDate || todayIsoDate(),
    letterhead,
    summaryRows,
    narrativeParagraphs,
    headers: ['ردیف', 'مرحله گردش ارجاع و بررسی', 'وضعیت', 'تاریخ', 'مسئول / سمت', 'توضیحات و علت توقف یا عودت'],
    rows,
    notes:
      'توضیح سیستمی: نظر فنی دفتر فنی صرفاً ناظر بر کنترل مدارک، متره و انطباق فنی بوده و به‌هیچ‌وجه جایگزین تأیید مالی، تأمین اعتبار یا دستور پرداخت نیست.',
    signatures: statement.signatures,
  };
}
