import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  AlignRight,
  BarChart3,
  CheckCircle2,
  CheckSquare,
  Download,
  FileJson,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Lightbulb,
  Printer,
  Settings2,
  SlidersHorizontal,
  Star,
  Table as TableIcon,
  Wallet,
  X,
} from 'lucide-react';
import { LetterheadConfig, ProjectStatus, SignatureSnapshot } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatJalaliDate,
  formatRial,
  isOverdue,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import {
  buildPrintableReportHtml,
  downloadPrintableReportHtml,
  exportToExcelXlsx,
  exportToJson,
  exportToWordDocx,
  ExportTablePayload,
} from '../../utils/exportEngine';
import { FloatingWindow } from '../layout/FloatingWindow';
import { SectionReportExportBar } from '../layout/SectionReportExportBar';
import { SignatureBlockEditor } from '../documents/SignatureBlockEditor';
import { STATUS_COLORS } from '../dashboard/StatusDonutChart';
import { StatusChartPanel } from '../dashboard/StatusChartPanel';
import { getNeutralProjectImage } from '../../utils/officialAssets';
import { HelpSectionId } from '../help/helpContent';
import { SectionHelpLink } from '../help/SectionHelpLink';

export type ReportType = 'projects' | 'budget' | 'proposals' | 'actions' | 'documents' | 'single-project';
export type ReportDisplayMode = 'table' | 'narrative' | 'chart';

interface ReportsViewProps {
  store: AppStore;
  initialReportType?: ReportType;
  initialDisplayMode?: ReportDisplayMode;
  onReportTypeChange?: (reportType: ReportType) => void;
  onDisplayModeChange?: (mode: ReportDisplayMode) => void;
  onOpenHelp?: (sectionId: HelpSectionId) => void;
}

interface SingleProjectReportSections {
  includeLetterhead: boolean;
  includeTechnicalOfficeTitle: boolean;
  includeDateAndNumber: boolean;
  includeBasicIdentity: boolean;
  includeContractInfo: boolean;
  includeStages: boolean;
  includeActions: boolean;
  includeBudget: boolean;
  includePayments: boolean;
  includeDocuments: boolean;
  includeImagesAndAttachments: boolean;
  includeSignatures: boolean;
}

const REPORT_CARDS: Array<{
  key: ReportType;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'projects', title: 'گزارش جامع پروژه‌ها', icon: FolderKanban },
  { key: 'budget', title: 'گزارش بودجه و اعتبارات', icon: Wallet },
  { key: 'proposals', title: 'گزارش پیشنهاد بودجه سالانه', icon: Lightbulb },
  { key: 'actions', title: 'گزارش اقدامات و پیگیری‌ها', icon: CheckSquare },
  { key: 'documents', title: 'گزارش اسناد و مکاتبات', icon: FileText },
  { key: 'single-project', title: 'گزارش تفصیلی پروژه', icon: Star },
];

const ORDERED_STATUSES: ProjectStatus[] = [
  'در حال اجرا',
  'شروع‌نشده',
  'دارای مشکل',
  'متوقف',
  'تکمیل‌شده',
];

export const ReportsView: React.FC<ReportsViewProps> = ({
  store,
  initialReportType = 'projects',
  initialDisplayMode = 'table',
  onReportTypeChange,
  onDisplayModeChange,
  onOpenHelp,
}) => {
  const [reportType, setReportType] = useState<ReportType>(initialReportType);
  const [displayMode, setDisplayMode] = useState<ReportDisplayMode>(initialDisplayMode);
  const [settingsModalOpen, setSettingsModalOpen] = useState(false);
  const [printPreviewOpen, setPrintPreviewOpen] = useState(false);

  const reportWorkspaceRef = useRef<HTMLDivElement | null>(null);
  const printIframeRef = useRef<HTMLIFrameElement | null>(null);

  useEffect(() => {
    setReportType(initialReportType);
  }, [initialReportType]);

  useEffect(() => {
    setDisplayMode(initialDisplayMode);
  }, [initialDisplayMode]);

  const handleSelectReportType = (next: ReportType, openSettings = false) => {
    setReportType(next);
    onReportTypeChange?.(next);
    if (openSettings) {
      setSettingsModalOpen(true);
      return;
    }
    // Smoothly scroll straight to the active report workspace so the user immediately sees the result
    setTimeout(() => {
      reportWorkspaceRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 50);
  };

  const handleSelectDisplayMode = (next: ReportDisplayMode) => {
    setDisplayMode(next);
    onDisplayModeChange?.(next);
  };
  const [selectedProjectId, setSelectedProjectId] = useState(store.projects[0]?.id ?? '');
  const [reportNumber, setReportNumber] = useState(`گ-${Math.floor(100 + Math.random() * 899)}`);
  const [letterhead, setLetterhead] = useState<LetterheadConfig>(store.settings.letterhead);
  const [signatures, setSignatures] = useState<SignatureSnapshot[]>([]);
  const [exportNotice, setExportNotice] = useState<{
    title: string;
    detail: string;
  } | null>(null);

  useEffect(() => {
    if (!exportNotice) return;
    const timer = window.setTimeout(() => setExportNotice(null), 5000);
    return () => window.clearTimeout(timer);
  }, [exportNotice]);

  const [singleSections, setSingleSections] = useState<SingleProjectReportSections>({
    includeLetterhead: true,
    includeTechnicalOfficeTitle: true,
    includeDateAndNumber: true,
    includeBasicIdentity: true,
    includeContractInfo: true,
    includeStages: true,
    includeActions: true,
    includeBudget: true,
    includePayments: true,
    includeDocuments: true,
    includeImagesAndAttachments: true,
    includeSignatures: true,
  });

  const projectMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p])),
    [store.projects]
  );

  const selectedProject = useMemo(
    () => store.projects.find((p) => p.id === selectedProjectId) ?? store.projects[0],
    [store.projects, selectedProjectId]
  );

  const selectedProjectImage = selectedProject
    ? store.projectImages.find((img) => img.projectId === selectedProject.id)
    : undefined;

  const selectedProjectActions = useMemo(
    () => (selectedProject ? store.actions.filter((a) => a.projectId === selectedProject.id) : []),
    [selectedProject, store.actions]
  );

  const selectedProjectPayments = useMemo(
    () => (selectedProject ? store.payments.filter((p) => p.projectId === selectedProject.id) : []),
    [selectedProject, store.payments]
  );

  const selectedProjectDocuments = useMemo(
    () => (selectedProject ? store.documents.filter((d) => d.projectId === selectedProject.id) : []),
    [selectedProject, store.documents]
  );

  const selectedProjectAttachments = useMemo(
    () =>
      selectedProject
        ? store.attachments.filter((att) => att.projectId === selectedProject.id)
        : [],
    [selectedProject, store.attachments]
  );

  const effectiveLetterhead = useMemo<LetterheadConfig>(() => {
    if (reportType !== 'single-project') return letterhead;
    return {
      organizationName: singleSections.includeLetterhead ? letterhead.organizationName : '',
      unitName: singleSections.includeTechnicalOfficeTitle ? letterhead.unitName : '',
      subtitle: singleSections.includeLetterhead ? letterhead.subtitle : '',
      showDateAndNumber: singleSections.includeDateAndNumber,
      showSignaturesFooter: singleSections.includeSignatures,
    };
  }, [letterhead, reportType, singleSections]);

  const reportPayload = useMemo<ExportTablePayload>(() => {
    const base = {
      documentNumber: reportNumber,
      date: todayIsoDate(),
      letterhead: effectiveLetterhead,
      signatures:
        effectiveLetterhead.showSignaturesFooter && signatures.length > 0 ? signatures : undefined,
    };

    if (reportType === 'projects') {
      const totalContract = store.projects.reduce((s, p) => s + (p.contractAmount || 0), 0);
      const avgProgress =
        store.projects.length > 0
          ? Math.round(
              store.projects.reduce((s, p) => s + (p.physicalProgress || 0), 0) /
                store.projects.length
            )
          : 0;
      return {
        ...base,
        title: 'گزارش جامع وضعیت پروژه‌های دفتر فنی اداره گلزار شهدا',
        summaryRows: [
          { label: 'تعداد کل پروژه‌ها', value: toPersianDigits(store.projects.length) },
          {
            label: 'در حال اجرا / دارای مشکل',
            value: `${toPersianDigits(store.projects.filter((p) => p.status === 'در حال اجرا').length)} / ${toPersianDigits(store.projects.filter((p) => p.status === 'دارای مشکل').length)}`,
          },
          { label: 'میانگین پیشرفت فیزیکی', value: `${toPersianDigits(avgProgress)} درصد` },
          { label: 'مجموع مبلغ قراردادها', value: formatRial(totalContract) },
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
      const totalApproved = store.budgets.reduce((s, b) => s + (b.approvedCredit || 0), 0);
      const totalAllocated = store.budgets.reduce((s, b) => s + (b.allocatedCredit || 0), 0);
      const totalFunded = store.budgets.reduce((s, b) => s + (b.fundedCredit || 0), 0);
      const totalPaid = store.payments.reduce((s, p) => s + (p.amount || 0), 0);
      const effectiveAllocated = totalAllocated > 0 ? totalAllocated : totalFunded > 0 ? totalFunded : totalApproved;
      const baseTotal = totalFunded > 0 ? totalFunded : totalApproved > 0 ? totalApproved : effectiveAllocated;
      const totalRemaining = baseTotal - totalPaid;
      const usagePct = baseTotal > 0 ? Math.round((totalPaid / baseTotal) * 100) : 0;
      const allocPct = totalApproved > 0 ? Math.round((effectiveAllocated / totalApproved) * 100) : 0;
      const remPct = baseTotal > 0 ? Math.max(0, Math.round((Math.max(0, totalRemaining) / baseTotal) * 100)) : 0;

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
          formatRial(b?.allocatedCredit),
          formatRial(b?.fundedCredit),
          formatRial(paid),
          formatRial(remaining),
          `${toPersianDigits(usage)}٪`,
        ];
      });
      return {
        ...base,
        title: 'گزارش بودجه، اعتبارات و وضعیت دوناتی پروژه‌ها',
        narrativeParagraphs: [
          `مجموع اعتبار مصوب پروژه‌های ثبت‌شده معادل ${formatRial(totalApproved)}، بودجه تخصیص‌یافته معادل ${formatRial(effectiveAllocated)} (${toPersianDigits(allocPct)} درصد مصوب) و مجموع تأمین اعتبار معادل ${formatRial(totalFunded)} است.`,
          `تا تاریخ تهیه این گزارش، مجموع بودجه هزینه‌شده (پرداخت‌شده) معادل ${formatRial(totalPaid)} (${toPersianDigits(usagePct)} درصد اعتبار مبنا) و مانده اعتبار برابر با ${formatRial(totalRemaining)} محاسبه شده است.`,
        ],
        donutChartData: {
          title: 'نمودار دوناتی وضعیت بودجه (تخصیص‌یافته، هزینه‌شده و مانده)',
          centerLabel: 'درصد جذب بودجه',
          centerValue: `${toPersianDigits(usagePct)}٪`,
          segments: [
            {
              label: 'بودجه هزینه‌شده (پرداخت‌شده)',
              value: totalPaid,
              formattedValue: formatRial(totalPaid),
              percentText: `${toPersianDigits(usagePct)}٪`,
              color: '#2D6A4F',
            },
            {
              label: 'بودجه مانده قابل مصرف',
              value: Math.max(0, totalRemaining),
              formattedValue: formatRial(totalRemaining),
              percentText: `${toPersianDigits(remPct)}٪`,
              color: '#243B5A',
            },
            {
              label: 'بودجه تخصیص‌یافته',
              value: effectiveAllocated,
              formattedValue: formatRial(effectiveAllocated),
              percentText: `${toPersianDigits(allocPct)}٪`,
              color: '#B99A62',
            },
          ],
        },
        summaryRows: [
          { label: 'جمع اعتبار مصوب', value: formatRial(totalApproved) },
          { label: 'بودجه تخصیص‌یافته', value: formatRial(effectiveAllocated) },
          { label: 'جمع تأمین اعتبار', value: formatRial(totalFunded) },
          { label: 'بودجه هزینه‌شده (پرداخت‌شده)', value: formatRial(totalPaid) },
          { label: 'جمع مانده اعتبار', value: formatRial(totalRemaining) },
        ],
        headers: [
          'کد',
          'پروژه',
          'اعتبار مصوب',
          'تخصیص‌یافته',
          'تأمین اعتبار',
          'هزینه‌شده',
          'مانده اعتبار',
          'درصد مصرف',
        ],
        rows,
      };
    }

    if (reportType === 'proposals') {
      const totalEstimated = store.proposals.reduce((s, p) => s + (p.estimatedAmount || 0), 0);
      const itemizedCount = store.proposals.filter((p) => (p.estimateItems?.length ?? 0) > 0).length;
      const imageCount = store.proposals.reduce((s, p) => s + (p.images?.length ?? 0), 0);
      return {
        ...base,
        title: 'گزارش جامع پیشنهاد بودجه سال آینده',
        summaryRows: [
          { label: 'تعداد پرونده‌های پیشنهادی', value: toPersianDigits(store.proposals.length) },
          { label: 'جمع برآورد اعتبار پیشنهادی', value: formatRial(totalEstimated) },
          { label: 'دارای جزئیات برآورد', value: `${toPersianDigits(itemizedCount)} مورد` },
          { label: 'مستندات تصویری پیوست', value: `${toPersianDigits(imageCount)} تصویر` },
        ],
        headers: [
          'کد پروژه',
          'سال',
          'عنوان پیشنهاد',
          'محل / حوزه',
          'شروع تا پایان',
          'مبنای برآورد',
          'اولویت / وضعیت',
          'برآورد مبلغ',
        ],
        rows: store.proposals.map((pr) => [
          pr.projectCode || '—',
          pr.fiscalYear,
          pr.title,
          [pr.location, pr.department].filter(Boolean).join(' · ') || '—',
          pr.startDate || pr.endDate
            ? `${pr.startDate ? formatJalaliDate(pr.startDate) : '؟'} تا ${pr.endDate ? formatJalaliDate(pr.endDate) : '؟'}`
            : '—',
          pr.estimateBasis
            ? `${pr.estimateBasis}${pr.estimateItems?.length ? ` (${toPersianDigits(pr.estimateItems.length)} ردیف)` : ''}`
            : 'برآورد کارشناسی',
          `${pr.priority} · ${pr.proposalStatus ?? 'پیش‌نویس'}`,
          formatRial(pr.estimatedAmount),
        ]),
      };
    }

    if (reportType === 'actions') {
      const overdueCount = store.actions.filter(
        (a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status)
      ).length;
      const doneCount = store.actions.filter((a) => a.status === 'تکمیل‌شده').length;
      return {
        ...base,
        title: 'گزارش اقدامات و پیگیری‌های دفتر فنی',
        summaryRows: [
          { label: 'تعداد کل اقدامات', value: toPersianDigits(store.actions.length) },
          { label: 'تکمیل‌شده', value: toPersianDigits(doneCount) },
          { label: 'اقدامات عقب‌افتاده', value: toPersianDigits(overdueCount) },
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
        title: 'گزارش اسناد، مکاتبات و صورتجلسات دفتر فنی',
        summaryRows: [
          { label: 'تعداد کل اسناد', value: toPersianDigits(store.documents.length) },
          { label: 'تعداد پیوست‌های محلی', value: toPersianDigits(store.attachments.length) },
        ],
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

    // Single-project customizable comprehensive dossier report
    const proj = selectedProject;
    if (!proj) {
      return {
        ...base,
        title: 'گزارش تکمیلی و تفصیلی پروژه',
        headers: ['شرح', 'مقدار'],
        rows: [],
      };
    }

    const bud = store.budgets.find((b) => b.projectId === proj.id);
    const paid = selectedProjectPayments.reduce((s, pay) => s + (pay.amount || 0), 0);

    const summaryRows: Array<{ label: string; value: string }> = [];
    if (singleSections.includeBasicIdentity) {
      summaryRows.push(
        { label: 'کد و عنوان پروژه', value: `${proj.code} — ${proj.title}` },
        {
          label: 'نوع، محل اجرا و واحد متولی',
          value: `${proj.type} · ${proj.location || '—'} · ${proj.responsibleDepartment || '—'}`,
        }
      );
    }
    if (singleSections.includeContractInfo) {
      summaryRows.push(
        {
          label: 'پیمانکار و شماره قرارداد',
          value: `${proj.contractor || '—'} (${proj.contractNumber || '—'})`,
        },
        {
          label: 'مبلغ و مدت قرارداد',
          value: `${formatRial(proj.contractAmount)} — ${proj.contractDuration || '—'}`,
        }
      );
    }
    if (singleSections.includeBudget) {
      summaryRows.push(
        {
          label: 'اعتبار مصوب / تخصیصی',
          value: `${formatRial(bud?.approvedCredit)} / ${formatRial(bud?.allocatedCredit)}`,
        },
        {
          label: 'تأمین اعتبار / مجموع پرداخت‌ها',
          value: `${formatRial(bud?.fundedCredit)} / ${formatRial(paid)}`,
        }
      );
    }
    summaryRows.push({
      label: 'وضعیت و پیشرفت فیزیکی',
      value: `${proj.status} — ${toPersianDigits(proj.physicalProgress)} درصد`,
    });

    const rows: string[][] = [];
    if (singleSections.includeStages) {
      proj.stages
        .filter((s) => s.enabled)
        .forEach((s, idx) => {
          rows.push([
            `مرحله ${toPersianDigits(idx + 1)}`,
            s.title,
            s.status,
            s.completedDate ? formatJalaliDate(s.completedDate) : '—',
            s.notes || '—',
          ]);
        });
    }
    if (singleSections.includeActions) {
      selectedProjectActions.forEach((act) => {
        rows.push([
          'اقدام و پیگیری',
          act.title,
          `${act.status} (${act.priority})`,
          formatJalaliDate(act.dueDate),
          act.followUpResult || act.notes || '—',
        ]);
      });
    }
    if (singleSections.includePayments) {
      selectedProjectPayments.forEach((pay) => {
        rows.push([
          'پرداخت / صورت‌وضعیت',
          `${pay.statementRef || 'سند پرداخت'} — ${formatRial(pay.amount)}`,
          pay.voucherNumber || 'ثبت محلی',
          formatJalaliDate(pay.date),
          pay.description || '—',
        ]);
      });
    }
    if (singleSections.includeDocuments) {
      selectedProjectDocuments.forEach((doc) => {
        rows.push([
          doc.category,
          doc.subject,
          doc.status,
          formatJalaliDate(doc.date),
          `${doc.documentNumber || 'بدون شماره'} — ${doc.senderOrReceiver || '—'}`,
        ]);
      });
    }
    if (singleSections.includeImagesAndAttachments) {
      if (selectedProjectImage) {
        rows.push([
          'تصویر اختصاصی پروژه',
          'تصویر ثبت‌شده در پرونده پروژه',
          'ثبت‌شده در پرونده',
          formatJalaliDate(selectedProjectImage.updatedAt),
          'متصل به همین پروژه',
        ]);
      }
      selectedProjectAttachments.forEach((att) => {
        rows.push([
          'پیوست محلی',
          att.fileName,
          att.mimeType,
          formatJalaliDate(att.createdAt),
          'ذخیره‌شده در IndexedDB',
        ]);
      });
    }

    return {
      ...base,
      title: `گزارش تکمیلی و تفصیلی پروژه: ${proj.title}`,
      summaryRows,
      headers: ['بخش', 'عنوان / شرح', 'وضعیت / مقدار', 'تاریخ', 'توضیحات'],
      rows,
      notes: proj.description,
    };
  }, [
    reportType,
    reportNumber,
    effectiveLetterhead,
    signatures,
    store.projects,
    store.budgets,
    store.payments,
    store.proposals,
    store.actions,
    store.documents,
    store.attachments,
    projectMap,
    selectedProject,
    selectedProjectImage,
    selectedProjectActions,
    selectedProjectPayments,
    selectedProjectDocuments,
    selectedProjectAttachments,
    singleSections,
  ]);

  // Narrative paragraphs generated from real IndexedDB data (Mode 1: گزارش متنی)
  const narrativeParagraphs = useMemo<string[]>(() => {
    if (reportType === 'projects') {
      const total = store.projects.length;
      const inProg = store.projects.filter((p) => p.status === 'در حال اجرا').length;
      const issue = store.projects.filter((p) => p.status === 'دارای مشکل').length;
      const done = store.projects.filter((p) => p.status === 'تکمیل‌شده').length;
      const totalAmt = store.projects.reduce((s, p) => s + (p.contractAmount || 0), 0);
      return [
        `در حال حاضر تعداد ${toPersianDigits(total)} پرونده پروژه در پایگاه داده محلی دفتر فنی اداره گلزار شهدا ثبت شده است که از این میان ${toPersianDigits(inProg)} پروژه در حال اجرا، ${toPersianDigits(issue)} پروژه دارای مشکل و ${toPersianDigits(done)} پروژه تکمیل‌شده هستند.`,
        `جمع کل مبلغ قراردادهای ثبت‌شده برابر با ${formatRial(totalAmt)} است. جزئیات پیشرفت فیزیکی و پیمانکار هر پروژه در نمای جدولی و خروجی‌های Word و Excel قابل ارائه است.`,
      ];
    }
    if (reportType === 'budget') {
      const approved = store.budgets.reduce((s, b) => s + (b.approvedCredit || 0), 0);
      const funded = store.budgets.reduce((s, b) => s + (b.fundedCredit || 0), 0);
      const paid = store.payments.reduce((s, p) => s + (p.amount || 0), 0);
      const pct = approved > 0 ? Math.round((paid / approved) * 100) : 0;
      return [
        `مجموع اعتبار مصوب پروژه‌های ثبت‌شده معادل ${formatRial(approved)} و مجموع اعتبار تأمین‌شده معادل ${formatRial(funded)} است.`,
        `تا تاریخ تهیه این گزارش، مجموع پرداخت‌های ثبت‌شده معادل ${formatRial(paid)} (${toPersianDigits(pct)} درصد اعتبار مصوب) بوده و مانده اعتبار هر پرونده در جدول مالی محاسبه شده است.`,
      ];
    }
    if (reportType === 'proposals') {
      const sum = store.proposals.reduce((s, p) => s + (p.estimatedAmount || 0), 0);
      const itemizedCount = store.proposals.filter((p) => (p.estimateItems?.length ?? 0) > 0).length;
      const imgCount = store.proposals.reduce((s, p) => s + (p.images?.length ?? 0), 0);
      return [
        `تعداد ${toPersianDigits(store.proposals.length)} پرونده پیشنهاد بودجه برای سال مالی آتی با جمع برآورد مالی ${formatRial(sum)} در دفتر فنی ثبت و اولویت‌بندی شده است.`,
        `از این میان ${toPersianDigits(itemizedCount)} پیشنهاد دارای ریز ردیف‌های برآورد مالی بوده و در مجموع ${toPersianDigits(imgCount)} مستند تصویری جهت بررسی و تصویب پیوست گردیده است.`,
      ];
    }
    if (reportType === 'actions') {
      const overdue = store.actions.filter(
        (a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status)
      ).length;
      const urgent = store.actions.filter((a) => a.priority === 'فوری').length;
      return [
        `در مجموع ${toPersianDigits(store.actions.length)} اقدام و پیگیری اداری-فنی ثبت شده است که ${toPersianDigits(urgent)} مورد دارای اولویت فوری و ${toPersianDigits(overdue)} مورد عقب‌افتاده از مهلت مقرر است.`,
      ];
    }
    if (reportType === 'documents') {
      return [
        `در بایگانی محلی اسناد و مکاتبات، تعداد ${toPersianDigits(store.documents.length)} سند/مکاتبه و ${toPersianDigits(store.attachments.length)} فایل پیوست نگهداری می‌شود.`,
      ];
    }
    if (!selectedProject) return ['پروژه‌ای برای تهیه گزارش تفصیلی انتخاب نشده است.'];
    const bud = store.budgets.find((b) => b.projectId === selectedProject.id);
    const paid = selectedProjectPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const completedStages = selectedProject.stages.filter(
      (s) => s.enabled && s.status === 'انجام‌شده'
    ).length;
    const totalStages = selectedProject.stages.filter((s) => s.enabled).length;
    return [
      `پرونده پروژه «${selectedProject.title}» با کد ${selectedProject.code} (نوع: ${selectedProject.type}) در محل «${selectedProject.location || 'ثبت‌نشده'}» به متولی‌گری «${selectedProject.responsibleDepartment || 'دفتر فنی'}» و پیمانکاری «${selectedProject.contractor || 'ثبت‌نشده'}» تعریف شده است.`,
      `وضعیت فعلی پروژه «${selectedProject.status}» با پیشرفت فیزیکی ${toPersianDigits(selectedProject.physicalProgress)} درصد است و از ${toPersianDigits(totalStages)} مرحله اجرایی فعال، تعداد ${toPersianDigits(completedStages)} مرحله تکمیل گردیده است.`,
      `اعتبار مصوب این پروژه ${formatRial(bud?.approvedCredit)}، تأمین اعتبار ${formatRial(bud?.fundedCredit)} و مجموع پرداخت‌های ثبت‌شده ${formatRial(paid)} است. تعداد ${toPersianDigits(selectedProjectActions.length)} اقدام پیگیری و ${toPersianDigits(selectedProjectDocuments.length)} سند و مکاتبه به این پرونده متصل شده است.`,
    ];
  }, [
    reportType,
    store.projects,
    store.budgets,
    store.payments,
    store.proposals,
    store.actions,
    store.documents,
    store.attachments,
    selectedProject,
    selectedProjectPayments,
    selectedProjectActions,
    selectedProjectDocuments,
  ]);

  // Chart data derived directly from IndexedDB (Mode 3: گزارش نموداری)
  const donutSegments = useMemo(
    () =>
      ORDERED_STATUSES.map((status) => ({
        status,
        count: store.projects.filter((p) => p.status === status).length,
        color: STATUS_COLORS[status],
      })),
    [store.projects]
  );

  const barChartItems = useMemo<
    Array<{ label: string; value: number; display: string; pct: number; color?: string }>
  >(() => {
    if (reportType === 'projects') {
      return store.projects.map((p) => ({
        label: `${p.code} — ${p.title}`,
        value: p.physicalProgress,
        display: `${toPersianDigits(p.physicalProgress)}٪`,
        pct: Math.max(0, Math.min(100, p.physicalProgress)),
        color: STATUS_COLORS[p.status],
      }));
    }
    if (reportType === 'budget') {
      const maxVal = Math.max(
        1,
        ...store.budgets.map((b) => Math.max(b.approvedCredit || 0, b.fundedCredit || 0))
      );
      return store.projects.map((p) => {
        const b = store.budgets.find((x) => x.projectId === p.id);
        const paid = store.payments
          .filter((pay) => pay.projectId === p.id)
          .reduce((s, pay) => s + (pay.amount || 0), 0);
        const approved = b?.approvedCredit || 0;
        return {
          label: `${p.code} — ${p.title}`,
          value: paid,
          display: `${formatRial(paid)} از ${formatRial(approved)}`,
          pct: Math.round((paid / maxVal) * 100),
        };
      });
    }
    if (reportType === 'proposals') {
      const maxVal = Math.max(1, ...store.proposals.map((pr) => pr.estimatedAmount || 0));
      return store.proposals.map((pr) => ({
        label: pr.title,
        value: pr.estimatedAmount,
        display: formatRial(pr.estimatedAmount),
        pct: Math.round((pr.estimatedAmount / maxVal) * 100),
      }));
    }
    if (reportType === 'actions') {
      const statuses = ['در انتظار', 'در حال پیگیری', 'تکمیل‌شده', 'عقب‌افتاده', 'لغوشده'];
      const total = Math.max(1, store.actions.length);
      return statuses.map((st) => {
        const c = store.actions.filter((a) => a.status === st).length;
        return {
          label: st,
          value: c,
          display: `${toPersianDigits(c)} مورد`,
          pct: Math.round((c / total) * 100),
        };
      });
    }
    if (reportType === 'documents') {
      const cats = Array.from(new Set(store.documents.map((d) => d.category)));
      const total = Math.max(1, store.documents.length);
      return cats.map((cat) => {
        const c = store.documents.filter((d) => d.category === cat).length;
        return {
          label: cat,
          value: c,
          display: `${toPersianDigits(c)} سند`,
          pct: Math.round((c / total) * 100),
        };
      });
    }
    // Single project stages & financial progress
    if (!selectedProject) return [];
    const enabled = selectedProject.stages.filter((s) => s.enabled);
    const done = enabled.filter((s) => s.status === 'انجام‌شده').length;
    const inProg = enabled.filter((s) => s.status === 'در حال انجام').length;
    const pending = enabled.filter((s) => s.status === 'انجام‌نشده').length;
    const bud = store.budgets.find((b) => b.projectId === selectedProject.id);
    const paid = selectedProjectPayments.reduce((s, p) => s + (p.amount || 0), 0);
    const financialPct =
      bud && bud.approvedCredit > 0 ? Math.min(100, Math.round((paid / bud.approvedCredit) * 100)) : 0;

    return [
      {
        label: 'پیشرفت فیزیکی کل پروژه',
        value: selectedProject.physicalProgress,
        display: `${toPersianDigits(selectedProject.physicalProgress)}٪`,
        pct: selectedProject.physicalProgress,
      },
      {
        label: 'جذب اعتبار مصوب (پرداخت‌ها)',
        value: financialPct,
        display: `${toPersianDigits(financialPct)}٪ (${formatRial(paid)})`,
        pct: financialPct,
      },
      {
        label: 'مراحل اجرایی انجام‌شده',
        value: done,
        display: `${toPersianDigits(done)} از ${toPersianDigits(enabled.length)}`,
        pct: enabled.length > 0 ? Math.round((done / enabled.length) * 100) : 0,
      },
      {
        label: 'مراحل در حال انجام / انجام‌نشده',
        value: inProg + pending,
        display: `${toPersianDigits(inProg)} جاری · ${toPersianDigits(pending)} باقی‌مانده`,
        pct: enabled.length > 0 ? Math.round(((inProg + pending) / enabled.length) * 100) : 0,
      },
    ];
  }, [
    reportType,
    store.projects,
    store.budgets,
    store.payments,
    store.proposals,
    store.actions,
    store.documents,
    selectedProject,
    selectedProjectPayments,
  ]);

  const handleExport = async (format: 'word' | 'excel' | 'pdf' | 'json') => {
    const slug = `report-${reportType}-${todayIsoDate()}`;
    if (format === 'word') {
      await exportToWordDocx(reportPayload, slug);
      setExportNotice({
        title: 'خروجی Word آماده شد',
        detail: 'فایل Word گزارش با سربرگ انتخابی تولید و روی دستگاه بارگیری شد.',
      });
    } else if (format === 'excel') {
      await exportToExcelXlsx(reportPayload, slug);
      setExportNotice({
        title: 'خروجی Excel آماده شد',
        detail: 'فایل Excel گزارش با موفقیت تولید و روی دستگاه ذخیره شد.',
      });
    } else if (format === 'pdf') {
      setSettingsModalOpen(false);
      setPrintPreviewOpen(true);
    } else {
      exportToJson(reportPayload, slug);
      setExportNotice({
        title: 'فایل JSON آماده شد',
        detail: 'خروجی ساخت‌یافته داده‌های گزارش آماده و بارگیری شد.',
      });
    }
  };

  const handleTriggerVisiblePrint = () => {
    const win = printIframeRef.current?.contentWindow;
    if (win) {
      win.focus();
      win.print();
    } else {
      window.print();
    }
  };

  const printableHtml = useMemo(
    () => (printPreviewOpen ? buildPrintableReportHtml(reportPayload) : ''),
    [printPreviewOpen, reportPayload]
  );

  const toggleSingleSection = (key: keyof SingleProjectReportSections) => {
    setSingleSections((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeCard = REPORT_CARDS.find((c) => c.key === reportType) ?? REPORT_CARDS[0];

  const cardCounts: Record<ReportType, string> = {
    projects: `${toPersianDigits(store.projects.length)} پروژه`,
    budget: `${toPersianDigits(store.budgets.length)} ردیف`,
    proposals: `${toPersianDigits(store.proposals.length)} پیشنهاد`,
    actions: `${toPersianDigits(store.actions.length)} اقدام`,
    documents: `${toPersianDigits(store.documents.length)} سند`,
    'single-project': selectedProject ? selectedProject.code : 'تک‌پروژه',
  };

  return (
    <div className="animate-page-in mx-auto max-w-[1280px] space-y-5 px-4 py-5 sm:px-6">
      {/* 1. Six Clean Interactive Report Cards (Click card -> scroll to report | Click gear -> open Settings & Export window) */}
      <section aria-label="انتخاب نوع گزارش" className="space-y-2.5">
        <div className="flex items-center justify-between gap-2 px-0.5">
          <span className="text-xs font-semibold text-[#243B5A]">
            انتخاب گزارش مورد نظر
          </span>
          {onOpenHelp && <SectionHelpLink sectionId="reports" onOpenHelp={onOpenHelp} />}
        </div>

        <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
          {REPORT_CARDS.map((card) => {
            const active = reportType === card.key;
            const Icon = card.icon;
            return (
              <div
                key={card.key}
                className={`relative flex flex-col rounded-2xl border transition-all ${
                  active
                    ? 'border-[#243B5A] bg-[#243B5A] text-[#FAF8F3] shadow-[0_6px_16px_rgba(29,50,80,0.16)]'
                    : 'border-[#E2DDD2] bg-[#FFFFFF] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#F5F7FB]'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectReportType(card.key, false)}
                  className="flex min-h-[82px] w-full flex-col items-center justify-center gap-1.5 px-3 pt-3.5 pb-2.5 text-center cursor-pointer"
                >
                  <Icon
                    className={`h-5 w-5 shrink-0 ${
                      active ? 'text-[#FAF8F3]' : 'text-[#354F73]'
                    }`}
                  />
                  <span className="text-xs font-semibold leading-5">{card.title}</span>
                  <span
                    className={`text-[10px] tabular-nums ${
                      active ? 'text-[#D6E0EC]' : 'text-[#788290]'
                    }`}
                  >
                    {cardCounts[card.key]}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => handleSelectReportType(card.key, true)}
                  aria-label={`تنظیمات و خروجی ${card.title}`}
                  title="تنظیمات و خروجی PDF / Excel / Word"
                  className={`absolute top-2 left-2 inline-flex h-6 w-6 items-center justify-center rounded-lg border transition-colors cursor-pointer ${
                    active
                      ? 'border-[#FAF8F3]/25 bg-[#FAF8F3]/12 text-[#FAF8F3] hover:bg-[#FAF8F3]/25'
                      : 'border-[#E6E2D8] bg-[#FAF8F3] text-[#5B6573] hover:border-[#243B5A] hover:text-[#243B5A]'
                  }`}
                >
                  <SlidersHorizontal className="h-3 w-3" />
                </button>
              </div>
            );
          })}
        </div>
      </section>

      {/* 2. Active Report Workspace (Auto-scroll target when clicking any report card) */}
      <div ref={reportWorkspaceRef} className="scroll-mt-20 space-y-4">
        {/* Clean Controls Bar */}
        <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 sm:p-5 space-y-4">
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex flex-wrap items-center gap-2.5">
              <h2 className="text-sm font-bold text-[#1D3250]">{activeCard.title}</h2>
              {reportType === 'single-project' && (
                <select
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  aria-label="انتخاب پروژه"
                  className="h-9 max-w-[260px] rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] px-3 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                >
                  {store.projects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* 3 Display Modes: Table / Narrative / Chart */}
            <div className="grid w-full grid-cols-3 gap-1.5 sm:w-auto sm:flex sm:items-center">
              {(
                [
                  { key: 'table', label: 'جدولی', icon: TableIcon },
                  { key: 'narrative', label: 'متنی', icon: AlignRight },
                  { key: 'chart', label: 'نموداری', icon: BarChart3 },
                ] as Array<{
                  key: ReportDisplayMode;
                  label: string;
                  icon: React.ComponentType<{ className?: string }>;
                }>
              ).map((mode) => {
                const Icon = mode.icon;
                return (
                  <button
                    key={mode.key}
                    type="button"
                    onClick={() => handleSelectDisplayMode(mode.key)}
                    className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl px-3 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                      displayMode === mode.key
                        ? 'border border-[#243B5A] bg-[#243B5A] text-[#FAF8F3]'
                        : 'border border-[#E2DDD2] bg-[#FAF8F3] text-[#263448] hover:bg-[#E5EBF2]'
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span>{mode.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Export Buttons + Settings Modal Trigger */}
          <div className="flex flex-col gap-2.5 border-t border-[#EFECE4] pt-3.5 lg:flex-row lg:items-center lg:justify-between">
            <div className="grid w-full grid-cols-2 gap-2 sm:w-auto sm:flex sm:flex-wrap sm:items-center">
              <button
                type="button"
                onClick={() => handleExport('word')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-3.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
              >
                <Download className="h-3.5 w-3.5 shrink-0" />
                <span>خروجی Word</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('excel')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#3D6B59] bg-[#FFFFFF] px-3.5 text-xs font-medium text-[#3D6B59] hover:bg-[#E7ECE6] cursor-pointer whitespace-nowrap"
              >
                <FileSpreadsheet className="h-3.5 w-3.5 shrink-0" />
                <span>خروجی Excel</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('pdf')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] px-3.5 text-xs font-medium text-[#263448] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
              >
                <Printer className="h-3.5 w-3.5 shrink-0" />
                <span>چاپ / PDF</span>
              </button>
              <button
                type="button"
                onClick={() => handleExport('json')}
                className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] px-3.5 text-xs font-medium text-[#263448] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
              >
                <FileJson className="h-3.5 w-3.5 shrink-0" />
                <span>JSON</span>
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSettingsModalOpen(true)}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#E2DDD2] bg-[#FAF8F3] px-3.5 text-xs font-medium text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
            >
              <Settings2 className="h-3.5 w-3.5 shrink-0" />
              <span>
                {reportType === 'single-project'
                  ? 'تنظیمات سربرگ، بخش‌ها و خروجی'
                  : 'تنظیمات سربرگ و خروجی'}
              </span>
            </button>
          </div>
        </section>

      {/* 3. Live Report Preview Sheet (Real Data Only) */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-6 space-y-5">
        {/* Formal Text-Only Letterhead Preview (No Logo Emblem on Standard Reports) */}
        {(effectiveLetterhead.organizationName ||
          effectiveLetterhead.unitName ||
          effectiveLetterhead.showDateAndNumber) && (
          <div className="border-b border-[#E2DDD2] pb-4 text-center">
            {effectiveLetterhead.organizationName && (
              <div className="text-base font-semibold text-[#243B5A]">
                {effectiveLetterhead.organizationName}
              </div>
            )}
            {effectiveLetterhead.unitName && (
              <div className="text-sm text-[#354F73]">{effectiveLetterhead.unitName}</div>
            )}
            {effectiveLetterhead.subtitle && (
              <div className="mt-0.5 text-xs text-[#788290]">{effectiveLetterhead.subtitle}</div>
            )}
            {effectiveLetterhead.showDateAndNumber && (
              <div className="mt-3 flex justify-between text-xs tabular-nums text-[#788290]">
                <span>تاریخ: {formatJalaliDate(todayIsoDate())}</span>
                <span>شماره: {reportNumber}</span>
              </div>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-[#243B5A]">{reportPayload.title}</h3>
          {store.hasSampleData && (
            <span className="rounded-md border border-[#E2DDD2] bg-[#FAF8F3] px-2.5 py-0.5 text-[11px] text-[#788290]">
              شامل داده‌های نمونه آزمایشی
            </span>
          )}
        </div>

        {/* Dedicated Project Image inside Single-Project Report Preview */}
        {reportType === 'single-project' &&
          selectedProject &&
          singleSections.includeImagesAndAttachments && (
            <div className="flex flex-col gap-3 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-3.5 sm:flex-row sm:items-center">
              <div className="relative h-28 w-full shrink-0 overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FFFFFF] sm:w-44">
                <img
                  src={
                    selectedProjectImage
                      ? selectedProjectImage.dataUrl
                      : getNeutralProjectImage(selectedProject.id)
                  }
                  alt={
                    selectedProjectImage
                      ? selectedProject.title
                      : `تصویر پیش‌فرض گلزار — ${selectedProject.title}`
                  }
                  className="h-full w-full object-cover"
                />
                {!selectedProjectImage && (
                  <div className="absolute inset-x-0 bottom-0 bg-[#1D3250]/75 px-2 py-1 text-[10px] text-[#FAF8F3] flex items-center gap-1">
                    <ImageIcon className="h-3 w-3 shrink-0" />
                    <span>تصویر پیش‌فرض گلزار</span>
                  </div>
                )}
              </div>
              <div className="text-xs leading-6 text-[#5B6573]">
                <div className="font-semibold text-[#243B5A]">
                  تصویر و پیوست‌های پرونده «{selectedProject.title}»
                </div>
                <div>
                  تصویر اختصاصی:{' '}
                  {selectedProjectImage
                    ? 'ثبت شده در پرونده پروژه'
                    : 'ثبت نشده (تصویر پیش‌فرض گلزار نمایش داده می‌شود)'}
                </div>
                <div>
                  تعداد پیوست‌های فایل محلی: {toPersianDigits(selectedProjectAttachments.length)}{' '}
                  فایل
                </div>
              </div>
            </div>
          )}

        {/* Summary KPI Strip */}
        {reportPayload.summaryRows && reportPayload.summaryRows.length > 0 && (
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {reportPayload.summaryRows.map((s) => (
              <div
                key={s.label}
                className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6]/70 px-3.5 py-2.5"
              >
                <div className="text-[11px] text-[#5B6573]">{s.label}</div>
                <div className="mt-0.5 text-xs font-semibold tabular-nums text-[#243B5A]">
                  {s.value}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Display Mode 1: Narrative Report */}
        {displayMode === 'narrative' && (
          <div className="space-y-3 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-5 text-sm leading-8 text-[#263448]">
            {narrativeParagraphs.map((para, idx) => (
              <p key={idx}>{para}</p>
            ))}
            {reportPayload.notes && (
              <p className="border-t border-[#E2DDD2] pt-3 text-xs leading-7 text-[#5B6573]">
                <strong>توضیحات تکمیلی پرونده:</strong> {reportPayload.notes}
              </p>
            )}
          </div>
        )}

        {/* Display Mode 2: Tabular Report */}
        {displayMode === 'table' && (
          <div className="overflow-x-auto rounded-lg border border-[#E2DDD2]">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#E2DDD2] bg-[#F2EEE6] text-[#243B5A]">
                  {reportPayload.headers.map((h) => (
                    <th key={h} className="px-3 py-2.5 font-semibold whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DE]">
                {reportPayload.rows.length === 0 ? (
                  <tr>
                    <td
                      colSpan={Math.max(1, reportPayload.headers.length)}
                      className="p-6 text-center text-[#788290]"
                    >
                      داده‌ای برای نمایش در این گزارش وجود ندارد.
                    </td>
                  </tr>
                ) : (
                  reportPayload.rows.map((r, i) => (
                    <tr key={i} className="hover:bg-[#FAF8F3]">
                      {r.map((cell, ci) => (
                        <td key={ci} className="px-3 py-2.5 text-[#263448]">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}

        {/* Display Mode 3: Chart Report (Real SVG/Bar Charts from IndexedDB) */}
        {displayMode === 'chart' && (
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
            {reportType === 'projects' && (
              <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-5 lg:col-span-5">
                <StatusChartPanel
                  title="توزیع وضعیت پروژه‌ها"
                  segments={donutSegments}
                  total={store.projects.length}
                  selectedStatus="همه"
                  onSelectStatus={() => {}}
                  interactive={false}
                />
              </div>
            )}

            <div
              className={`rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-5 space-y-3 ${
                reportType === 'projects' ? 'lg:col-span-7' : 'lg:col-span-12'
              }`}
            >
              <div className="text-xs font-semibold text-[#243B5A]">
                {reportType === 'projects'
                  ? 'پیشرفت فیزیکی هر پروژه (نمودار میله‌ای)'
                  : 'نمودار مقایسه‌ای بر مبنای داده‌های واقعی دستگاه'}
              </div>
              {barChartItems.length === 0 ? (
                <div className="py-8 text-center text-xs text-[#788290]">
                  داده‌ای برای ترسیم نمودار وجود ندارد.
                </div>
              ) : (
                <div className="space-y-3">
                  {barChartItems.map((item, idx) => (
                    <div key={`${item.label}-${idx}`} className="space-y-1">
                      <div className="flex items-center justify-between gap-2 text-xs">
                        <span className="truncate font-medium text-[#263448]">{item.label}</span>
                        <span className="shrink-0 tabular-nums text-[#354F73]">{item.display}</span>
                      </div>
                      <div className="h-3 w-full overflow-hidden rounded-md bg-[#E8E5DE]">
                        <div
                          className="h-full rounded-md transition-all duration-300"
                          style={{
                            width: `${Math.max(item.pct > 0 ? 3 : 0, Math.min(100, item.pct))}%`,
                            backgroundColor: item.color ?? '#243B5A',
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Signatures Block */}
        {effectiveLetterhead.showSignaturesFooter && (
          <SignatureBlockEditor
            signatures={signatures}
            people={store.people}
            onChange={setSignatures}
          />
        )}
      </section>
      </div>

      {/* Bottom Page Section: Standardized Word & Excel Report Export */}
      <SectionReportExportBar
        buildExport={() => ({
          slug: `report-${reportType}-${todayIsoDate()}`,
          payload: {
            ...reportPayload,
            narrativeParagraphs:
              reportPayload.narrativeParagraphs && reportPayload.narrativeParagraphs.length > 0
                ? reportPayload.narrativeParagraphs
                : narrativeParagraphs,
          },
        })}
      />

      {/* Report Settings & Export Floating Window */}
      {settingsModalOpen && (
        <FloatingWindow
          title={`تنظیمات و خروجی — ${activeCard.title}`}
          onClose={() => setSettingsModalOpen(false)}
          width={680}
        >
          <div className="space-y-4">
            {reportType === 'single-project' && (
              <div className="space-y-3 rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4">
                <div>
                  <label className="mb-1 block text-xs font-medium text-[#243B5A]">
                    پروژه مورد نظر برای گزارش تفصیلی
                  </label>
                  <select
                    value={selectedProject?.id ?? ''}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
                  >
                    {store.projects.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.title}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="text-xs font-semibold text-[#243B5A] pt-1">
                  بخش‌های قابل نمایش در گزارش
                </div>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 text-xs text-[#263448]">
                  {(
                    [
                      ['includeLetterhead', 'سربرگ انتخابی سازمان'],
                      ['includeTechnicalOfficeTitle', 'عنوان دفتر فنی'],
                      ['includeDateAndNumber', 'شماره و تاریخ گزارش'],
                      ['includeBasicIdentity', 'کد، عنوان و محل اجرا'],
                      ['includeContractInfo', 'اطلاعات قرارداد و مبلغ'],
                      ['includeStages', 'وضعیت و مراحل اجرایی'],
                      ['includeActions', 'اقدامات و پیگیری‌ها'],
                      ['includeBudget', 'بودجه و اعتبارات'],
                      ['includePayments', 'صورت‌وضعیت‌ها و پرداخت‌ها'],
                      ['includeDocuments', 'اسناد و مکاتبات'],
                      ['includeImagesAndAttachments', 'تصویر پروژه و پیوست‌ها'],
                      ['includeSignatures', 'اشخاص و امضاکنندگان'],
                    ] as Array<[keyof SingleProjectReportSections, string]>
                  ).map(([key, label]) => (
                    <label key={key} className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={singleSections[key]}
                        onChange={() => toggleSingleSection(key)}
                        className="h-4 w-4 accent-[#243B5A]"
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            <div className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3">
              <div className="text-xs font-semibold text-[#243B5A]">سربرگ و مشخصات گزارش</div>
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6573]">عنوان سازمانی سربرگ</label>
                  <input
                    type="text"
                    value={letterhead.organizationName}
                    onChange={(e) =>
                      setLetterhead((l) => ({ ...l, organizationName: e.target.value }))
                    }
                    className="w-full rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#263448]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6573]">واحد / اداره</label>
                  <input
                    type="text"
                    value={letterhead.unitName}
                    onChange={(e) => setLetterhead((l) => ({ ...l, unitName: e.target.value }))}
                    className="w-full rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#263448]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6573]">زیرعنوان سربرگ</label>
                  <input
                    type="text"
                    value={letterhead.subtitle}
                    onChange={(e) => setLetterhead((l) => ({ ...l, subtitle: e.target.value }))}
                    className="w-full rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#263448]"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-[11px] text-[#5B6573]">شماره گزارش</label>
                  <input
                    type="text"
                    value={reportNumber}
                    onChange={(e) => setReportNumber(e.target.value)}
                    className="w-full rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-2 text-xs text-[#263448]"
                  />
                </div>
              </div>
            </div>

            <div className="rounded-xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 space-y-2.5">
              <div className="text-xs font-semibold text-[#243B5A]">دریافت خروجی فوری</div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                <button
                  type="button"
                  onClick={() => handleExport('pdf')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-3 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>چاپ / PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('word')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#FFFFFF] px-3 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>Word</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('excel')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#3D6B59] bg-[#FFFFFF] px-3 text-xs font-medium text-[#3D6B59] hover:bg-[#E7ECE6] cursor-pointer"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  <span>Excel</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleExport('json')}
                  className="inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border border-[#D7D2C6] bg-[#FAF8F3] px-3 text-xs font-medium text-[#263448] hover:border-[#243B5A] cursor-pointer"
                >
                  <FileJson className="h-3.5 w-3.5" />
                  <span>JSON</span>
                </button>
              </div>
            </div>

            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  setSettingsModalOpen(false);
                  setTimeout(() => {
                    reportWorkspaceRef.current?.scrollIntoView({
                      behavior: 'smooth',
                      block: 'start',
                    });
                  }, 60);
                }}
                className="rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] px-4 py-2 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              >
                اعمال و مشاهده پیش‌نمایش گزارش
              </button>
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Real Visible Print / PDF Preview Modal (works reliably even inside iframes & mobile browsers) */}
      {printPreviewOpen && (
        <FloatingWindow
          title={`پیش‌نمایش چاپ و ذخیره PDF — ${activeCard.title}`}
          onClose={() => setPrintPreviewOpen(false)}
          width={860}
        >
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-[#E2DDD2] bg-[#FAF8F3] p-3">
              <span className="text-xs text-[#5B6573]">
                نسخه آماده چاپ A4 گزارش در زیر نمایش داده شده است.
              </span>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  onClick={handleTriggerVisiblePrint}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-3.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  <Printer className="h-3.5 w-3.5" />
                  <span>چاپ / ذخیره PDF</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    downloadPrintableReportHtml(
                      reportPayload,
                      `report-${reportType}-${todayIsoDate()}`
                    );
                    setExportNotice({
                      title: 'نسخه قابل چاپ آماده شد',
                      detail: 'فایل نسخه قابل چاپ گزارش با موفقیت روی دستگاه بارگیری شد.',
                    });
                  }}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#D7D2C6] bg-[#FFFFFF] px-3.5 text-xs font-medium text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                >
                  <Download className="h-3.5 w-3.5" />
                  <span>دانلود نسخه قابل چاپ</span>
                </button>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl border border-[#D7D2C6] bg-[#FFFFFF]">
              <iframe
                ref={printIframeRef}
                title="پیش‌نمایش چاپ گزارش"
                srcDoc={printableHtml}
                className="h-[62vh] w-full bg-[#FFFFFF]"
              />
            </div>
          </div>
        </FloatingWindow>
      )}

      {/* Standard Themed Export Notification Window */}
      {exportNotice && (
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
              <div className="text-xs font-bold text-[#1D3250]">{exportNotice.title}</div>
              <p className="text-xs leading-5 text-[#5B6573]">{exportNotice.detail}</p>
            </div>
            <button
              type="button"
              onClick={() => setExportNotice(null)}
              aria-label="بستن اعلان"
              className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] text-[#5B6573] hover:border-[#243B5A] hover:text-[#243B5A] cursor-pointer"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};
