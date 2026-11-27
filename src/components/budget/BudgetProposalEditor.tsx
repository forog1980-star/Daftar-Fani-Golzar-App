import React, { useMemo, useState } from 'react';
import {
  Calculator,
  Calendar,
  Camera,
  FileSpreadsheet,
  FileText,
  FolderKanban,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Trash2,
  Upload,
} from 'lucide-react';
import {
  BudgetEstimateLine,
  BudgetProposal,
  Project,
  ProposalDocumentItem,
  ProposalEstimateBasis,
  ProposalImageItem,
  ProposalPriority,
  ProposalStatus,
} from '../../types';
import { formatFileSize, formatJalaliDate, formatRial, generateId, toPersianDigits } from '../../utils/format';
import { compressImageFile } from '../../utils/imageMedia';
import { FloatingWindow } from '../layout/FloatingWindow';

interface BudgetProposalEditorProps {
  initial: BudgetProposal | null;
  projects: Project[];
  deviceId: string;
  onSave: (proposal: BudgetProposal, isNew: boolean) => Promise<void>;
  onClose: () => void;
}

const PROJECT_TYPES = ['عمرانی', 'بهسازی', 'مرمت', 'فرهنگی', 'تأسیساتی', 'تجهیزاتی', 'سایر'];
const PROPOSAL_STATUSES: ProposalStatus[] = [
  'پیش‌نویس',
  'در حال بررسی',
  'ارسال‌شده',
  'مصوب',
  'نیاز به اصلاح',
];
const ESTIMATE_BASES: ProposalEstimateBasis[] = [
  'فهرست بها',
  'استعلام قیمت',
  'برآورد کارشناسی',
  'قرارداد مشابه',
  'ترکیبی',
];

function computeDurationLabel(start?: string, end?: string): string | null {
  if (!start || !end) return null;
  const s = new Date(start);
  const e = new Date(end);
  if (Number.isNaN(s.getTime()) || Number.isNaN(e.getTime())) return null;
  const diffDays = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  if (diffDays < 0) return 'تاریخ پایان قبل از تاریخ شروع است';
  if (diffDays === 0) return 'کمتر از ۱ روز';
  const months = Math.floor(diffDays / 30);
  const remDays = diffDays % 30;
  if (months > 0 && remDays > 0) {
    return `${toPersianDigits(diffDays)} روز (حدود ${toPersianDigits(months)} ماه و ${toPersianDigits(remDays)} روز)`;
  }
  if (months > 0) {
    return `${toPersianDigits(diffDays)} روز (حدود ${toPersianDigits(months)} ماه)`;
  }
  return `${toPersianDigits(diffDays)} روز`;
}

export const BudgetProposalEditor: React.FC<BudgetProposalEditorProps> = ({
  initial,
  projects,
  deviceId,
  onSave,
  onClose,
}) => {
  // General & Project Identity
  const [relatedProjectId, setRelatedProjectId] = useState(initial?.relatedProjectId ?? '');
  const [fiscalYear, setFiscalYear] = useState(initial?.fiscalYear ?? '۱۴۰۶');
  const [projectCode, setProjectCode] = useState(initial?.projectCode ?? '');
  const [title, setTitle] = useState(initial?.title ?? '');
  const [projectType, setProjectType] = useState(initial?.projectType ?? 'عمرانی');
  const [location, setLocation] = useState(initial?.location ?? '');
  const [department, setDepartment] = useState(initial?.department ?? 'دفتر فنی اداره گلزار شهدا');
  const [responsiblePerson, setResponsiblePerson] = useState(initial?.responsiblePerson ?? '');
  const [priority, setPriority] = useState<ProposalPriority>(initial?.priority ?? 'بالا');
  const [proposalStatus, setProposalStatus] = useState<ProposalStatus>(
    initial?.proposalStatus ?? 'پیش‌نویس'
  );
  const [fundingSource, setFundingSource] = useState(initial?.fundingSource ?? '');

  // Schedule (Start / End)
  const [startDate, setStartDate] = useState(initial?.startDate ?? '');
  const [endDate, setEndDate] = useState(initial?.endDate ?? '');

  // Financial Estimate & Itemized Breakdown
  const [estimatedAmount, setEstimatedAmount] = useState(
    initial?.estimatedAmount ? String(initial.estimatedAmount) : ''
  );
  const [estimateBasis, setEstimateBasis] = useState<ProposalEstimateBasis>(
    initial?.estimateBasis ?? 'برآورد کارشناسی'
  );
  const [estimateSummary, setEstimateSummary] = useState(initial?.estimateSummary ?? '');
  const [estimateItems, setEstimateItems] = useState<BudgetEstimateLine[]>(
    initial?.estimateItems ?? []
  );

  // Description & Technical Justification
  const [description, setDescription] = useState(initial?.description ?? '');

  // Visual & Estimate Document Attachments (stored locally in IndexedDB)
  const [images, setImages] = useState<ProposalImageItem[]>(initial?.images ?? []);
  const [estimateDocuments, setEstimateDocuments] = useState<ProposalDocumentItem[]>(
    initial?.estimateDocuments ?? []
  );
  const [imageProcessing, setImageProcessing] = useState(false);
  const [imageError, setImageError] = useState('');
  const [docError, setDocError] = useState('');

  const itemsTotal = useMemo(
    () => estimateItems.reduce((sum, item) => sum + (Number(item.amount) || 0), 0),
    [estimateItems]
  );

  const durationLabel = useMemo(
    () => computeDurationLabel(startDate, endDate),
    [startDate, endDate]
  );

  const handleLinkProject = (projectId: string) => {
    setRelatedProjectId(projectId);
    const chosen = projects.find((p) => p.id === projectId);
    if (!chosen) return;
    if (!projectCode.trim()) setProjectCode(chosen.code || '');
    if (!title.trim()) setTitle(chosen.title || '');
    if (!location.trim()) setLocation(chosen.location || '');
    if (chosen.type) setProjectType(chosen.type);
    if (chosen.responsibleDepartment && department === 'دفتر فنی اداره گلزار شهدا') {
      setDepartment(chosen.responsibleDepartment);
    }
  };

  const handleFillFromProject = () => {
    const chosen = projects.find((p) => p.id === relatedProjectId);
    if (!chosen) return;
    setProjectCode(chosen.code || projectCode);
    setTitle(chosen.title || title);
    setLocation(chosen.location || location);
    if (chosen.type) setProjectType(chosen.type);
    if (chosen.responsibleDepartment) setDepartment(chosen.responsibleDepartment);
  };

  const addEstimateRow = () => {
    setEstimateItems((prev) => [
      ...prev,
      {
        id: generateId('est'),
        title: '',
        unit: 'مقطوع',
        quantity: 1,
        unitPrice: 0,
        amount: 0,
        note: '',
      },
    ]);
  };

  const updateEstimateRow = (
    id: string,
    patch: Partial<BudgetEstimateLine>,
    recalcAmount = false
  ) => {
    setEstimateItems((prev) =>
      prev.map((row) => {
        if (row.id !== id) return row;
        const next = { ...row, ...patch };
        if (recalcAmount) {
          const q = Number(next.quantity) || 0;
          const p = Number(next.unitPrice) || 0;
          if (q > 0 && p > 0) {
            next.amount = Math.round(q * p);
          }
        }
        return next;
      })
    );
  };

  const removeEstimateRow = (id: string) => {
    setEstimateItems((prev) => prev.filter((row) => row.id !== id));
  };

  const applyItemsSumToTotal = () => {
    setEstimatedAmount(String(itemsTotal));
  };

  const handleUploadImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setImageError('');
    setImageProcessing(true);
    try {
      const processedList: ProposalImageItem[] = [];
      for (const file of files.slice(0, 6)) {
        const compressed = await compressImageFile(file, 1100, 0.8);
        processedList.push({
          id: generateId('pimg'),
          dataUrl: compressed.dataUrl,
          caption: '',
          sizeBytes: compressed.sizeBytes,
          addedAt: new Date().toISOString(),
        });
      }
      setImages((prev) => [...prev, ...processedList]);
    } catch (err) {
      setImageError(err instanceof Error ? err.message : 'خطا در آماده‌سازی تصویر');
    } finally {
      setImageProcessing(false);
      e.target.value = '';
    }
  };

  const updateImageCaption = (id: string, caption: string) => {
    setImages((prev) => prev.map((img) => (img.id === id ? { ...img, caption } : img)));
  };

  const removeImage = (id: string) => {
    setImages((prev) => prev.filter((img) => img.id !== id));
  };

  const handleUploadEstimateDocs = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length === 0) return;
    setDocError('');
    try {
      const nextDocs: ProposalDocumentItem[] = [];
      for (const file of files.slice(0, 5)) {
        if (file.size > 4 * 1024 * 1024) {
          setDocError('حداکثر حجم مجاز هر سند پیوست ۴ مگابایت است.');
          continue;
        }
        const dataUrl = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(String(reader.result || ''));
          reader.onerror = () => reject(new Error('خطا در خواندن فایل مستند'));
          reader.readAsDataURL(file);
        });
        const cleanTitle = file.name.replace(/\.[^.]+$/, '') || 'سند برآورد';
        nextDocs.push({
          id: generateId('pdoc'),
          title: cleanTitle,
          mimeType: file.type || 'application/octet-stream',
          sizeBytes: file.size,
          dataUrl,
          addedAt: new Date().toISOString(),
        });
      }
      if (nextDocs.length > 0) {
        setEstimateDocuments((prev) => [...prev, ...nextDocs]);
      }
    } catch (err) {
      setDocError(err instanceof Error ? err.message : 'خطا در پیوست فایل برآورد');
    } finally {
      e.target.value = '';
    }
  };

  const updateDocTitle = (id: string, nextTitle: string) => {
    setEstimateDocuments((prev) =>
      prev.map((d) => (d.id === id ? { ...d, title: nextTitle } : d))
    );
  };

  const removeEstimateDoc = (id: string) => {
    setEstimateDocuments((prev) => prev.filter((d) => d.id !== id));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    const cleanedItems = estimateItems
      .filter((item) => item.title.trim() || item.amount > 0)
      .map((item) => ({
        ...item,
        title: item.title.trim() || 'ردیف برآورد',
        unit: item.unit?.trim() || undefined,
        note: item.note?.trim() || undefined,
        amount: Number(item.amount) || 0,
      }));
    const finalAmount =
      Number(estimatedAmount) > 0
        ? Number(estimatedAmount)
        : cleanedItems.reduce((s, r) => s + r.amount, 0);

    await onSave(
      {
        id: initial?.id ?? generateId('prop'),
        fiscalYear: fiscalYear.trim() || '۱۴۰۶',
        projectCode: projectCode.trim() || undefined,
        title: title.trim(),
        projectType: projectType.trim() || undefined,
        location: location.trim() || undefined,
        responsiblePerson: responsiblePerson.trim() || undefined,
        startDate: startDate || undefined,
        endDate: endDate || undefined,
        fundingSource: fundingSource.trim() || undefined,
        proposalStatus,
        estimateBasis,
        estimateSummary: estimateSummary.trim() || undefined,
        estimateItems: cleanedItems.length > 0 ? cleanedItems : undefined,
        images: images.length > 0 ? images : undefined,
        estimateDocuments: estimateDocuments.length > 0 ? estimateDocuments : undefined,
        description: description.trim(),
        priority,
        estimatedAmount: finalAmount,
        department: department.trim() || 'دفتر فنی اداره گلزار شهدا',
        relatedProjectId: relatedProjectId || undefined,
        isSample: initial?.isSample,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: deviceId,
      },
      !initial
    );
  };

  return (
    <FloatingWindow
      title={initial ? 'ویرایش پرونده پیشنهاد بودجه سال آینده' : 'ثبت پرونده پیشنهاد بودجه سال آینده'}
      onClose={onClose}
      width={780}
    >
      <form onSubmit={handleSubmit} className="space-y-5">
        {/* Section 1: General Info & Project Code */}
        <section className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3.5">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
              <FolderKanban className="h-4 w-4 text-[#243B5A]" />
              <span>۱. اطلاعات کلی و کد پروژه</span>
            </div>
            <span className="text-[11px] text-[#788290]">تنها عنوان الزامی است؛ سایر فیلدها آزاد و انعطاف‌پذیرند</span>
          </div>

          {/* Optional link to existing project */}
          <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-12 sm:items-end">
            <div className="sm:col-span-9">
              <label className="mb-1 block text-xs text-[#5B6268]">
                اتصال به پروژه موجود (اختیاری — برای تکمیل سریع کد و مشخصات)
              </label>
              <select
                value={relatedProjectId}
                onChange={(e) => handleLinkProject(e.target.value)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              >
                <option value="">پروژه جدید / مستقل (ورود آزاد اطلاعات)</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div className="sm:col-span-3">
              <button
                type="button"
                disabled={!relatedProjectId}
                onClick={handleFillFromProject}
                className="h-[34px] w-full rounded-lg border border-[#D4CEBF] bg-[#FFFFFF] px-2.5 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] disabled:opacity-45 cursor-pointer"
              >
                جایگزینی از پرونده پروژه
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-12">
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-[#5B6268]">سال مالی</label>
              <input
                type="text"
                value={fiscalYear}
                onChange={(e) => setFiscalYear(e.target.value)}
                placeholder="مثال: ۱۴۰۶"
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div className="sm:col-span-3">
              <label className="mb-1 block text-xs text-[#5B6268]">کد پروژه</label>
              <input
                type="text"
                value={projectCode}
                onChange={(e) => setProjectCode(e.target.value)}
                placeholder="مثال: ۱۴۰۶-۰۱"
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div className="sm:col-span-6">
              <label className="mb-1 block text-xs font-medium text-[#243B5A]">
                عنوان پروژه / پیشنهاد بودجه *
              </label>
              <input
                type="text"
                required
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="عنوان دقیق پروژه پیشنهادی را بنویسید"
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">نوع پروژه / عملیات</label>
              <select
                value={projectType}
                onChange={(e) => setProjectType(e.target.value)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              >
                {PROJECT_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">محل اجرا / قطعه / محدوده</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="مثال: قطعه ۲۴، محوطه غربی..."
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">واحد / معاونت پیشنهاددهنده</label>
              <input
                type="text"
                value={department}
                onChange={(e) => setDepartment(e.target.value)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-4">
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">مسئول پیگیری / کارشناس</label>
              <input
                type="text"
                value={responsiblePerson}
                onChange={(e) => setResponsiblePerson(e.target.value)}
                placeholder="نام مسئول یا واحد"
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">منبع پیشنهادی اعتبار</label>
              <input
                type="text"
                value={fundingSource}
                onChange={(e) => setFundingSource(e.target.value)}
                placeholder="استانی، ملی، داخلی..."
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">اولویت اجرا</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as ProposalPriority)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              >
                <option value="فوری">فوری</option>
                <option value="بالا">بالا</option>
                <option value="متوسط">متوسط</option>
                <option value="عادی">عادی</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">وضعیت پیشنهاد</label>
              <select
                value={proposalStatus}
                onChange={(e) => setProposalStatus(e.target.value as ProposalStatus)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              >
                {PROPOSAL_STATUSES.map((st) => (
                  <option key={st} value={st}>
                    {st}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </section>

        {/* Section 2: Schedule (Start & End Dates) */}
        <section className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
              <Calendar className="h-4 w-4 text-[#243B5A]" />
              <span>۲. زمان‌بندی پیش‌بینی‌شده (شروع و پایان)</span>
            </div>
            {durationLabel && (
              <span className="rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] px-2.5 py-1 text-[11px] font-medium text-[#243B5A]">
                مدت اجرا: {durationLabel}
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">
                تاریخ شروع پیش‌بینی‌شده
                {startDate && (
                  <span className="mr-1.5 text-[11px] text-[#243B5A]">
                    ({formatJalaliDate(startDate)})
                  </span>
                )}
              </label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">
                تاریخ پایان پیش‌بینی‌شده
                {endDate && (
                  <span className="mr-1.5 text-[11px] text-[#243B5A]">
                    ({formatJalaliDate(endDate)})
                  </span>
                )}
              </label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
          </div>
        </section>

        {/* Section 3: Financial Estimate & Itemized Breakdown */}
        <section className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3.5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
              <Calculator className="h-4 w-4 text-[#243B5A]" />
              <span>۳. برآورد بودجه و جزئیات ردیف‌های هزینه</span>
            </div>
            <button
              type="button"
              onClick={addEstimateRow}
              className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>افزودن ردیف برآورد</span>
            </button>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">
                مبلغ کل / سقف بودجه پیشنهادی (ریال)
              </label>
              <input
                type="number"
                min={0}
                value={estimatedAmount}
                onChange={(e) => setEstimatedAmount(e.target.value)}
                placeholder="مثال: 15000000000"
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs tabular-nums text-[#263448]"
              />
              {Number(estimatedAmount) > 0 && (
                <div className="mt-1 text-[11px] font-medium text-[#2D6A4F] tabular-nums">
                  {formatRial(Number(estimatedAmount))}
                </div>
              )}
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">مبنای برآورد</label>
              <select
                value={estimateBasis}
                onChange={(e) => setEstimateBasis(e.target.value as ProposalEstimateBasis)}
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              >
                {ESTIMATE_BASES.map((basis) => (
                  <option key={basis} value={basis}>
                    {basis}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">شرح مبنا / مفروضات برآورد</label>
              <input
                type="text"
                value={estimateSummary}
                onChange={(e) => setEstimateSummary(e.target.value)}
                placeholder="مثال: فهرست بها + ضریب تعدیل..."
                className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs text-[#263448]"
              />
            </div>
          </div>

          {/* Itemized Estimate Rows */}
          {estimateItems.length > 0 ? (
            <div className="space-y-2">
              <div className="overflow-x-auto rounded-lg border border-[#E2DDD0] bg-[#FFFFFF]">
                <table className="w-full text-right text-xs">
                  <thead>
                    <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-[11px] text-[#5B6268]">
                      <th className="px-2.5 py-2 font-medium">شرح ردیف برآورد</th>
                      <th className="px-2 py-2 font-medium w-20">واحد</th>
                      <th className="px-2 py-2 font-medium w-20">مقدار</th>
                      <th className="px-2 py-2 font-medium w-28">بهای واحد</th>
                      <th className="px-2 py-2 font-medium w-32">جمع ردیف (ریال)</th>
                      <th className="px-2 py-2 font-medium w-9" />
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#EFECE4]">
                    {estimateItems.map((row) => (
                      <tr key={row.id}>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.title}
                            onChange={(e) => updateEstimateRow(row.id, { title: e.target.value })}
                            placeholder="مثلاً: خرید مصالح، عملیات عمرانی..."
                            className="w-full rounded border border-[#E2DDD0] bg-[#FAF8F3] px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="text"
                            value={row.unit ?? ''}
                            onChange={(e) => updateEstimateRow(row.id, { unit: e.target.value })}
                            placeholder="متر/عدد"
                            className="w-full rounded border border-[#E2DDD0] bg-[#FAF8F3] px-2 py-1.5 text-xs"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min={0}
                            value={row.quantity ?? ''}
                            onChange={(e) =>
                              updateEstimateRow(
                                row.id,
                                { quantity: Number(e.target.value) || 0 },
                                true
                              )
                            }
                            className="w-full rounded border border-[#E2DDD0] bg-[#FAF8F3] px-2 py-1.5 text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min={0}
                            value={row.unitPrice ?? ''}
                            onChange={(e) =>
                              updateEstimateRow(
                                row.id,
                                { unitPrice: Number(e.target.value) || 0 },
                                true
                              )
                            }
                            className="w-full rounded border border-[#E2DDD0] bg-[#FAF8F3] px-2 py-1.5 text-xs tabular-nums"
                          />
                        </td>
                        <td className="p-1.5">
                          <input
                            type="number"
                            min={0}
                            value={row.amount || ''}
                            onChange={(e) =>
                              updateEstimateRow(row.id, { amount: Number(e.target.value) || 0 })
                            }
                            className="w-full rounded border border-[#CEC7B6] bg-[#FFFFFF] px-2 py-1.5 text-xs font-semibold tabular-nums text-[#1D3250]"
                          />
                        </td>
                        <td className="p-1.5 text-center">
                          <button
                            type="button"
                            onClick={() => removeEstimateRow(row.id)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#E2DDD0] text-[#788290] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                            title="حذف ردیف"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D8E2DC] bg-[#EDF3EF] px-3 py-2 text-xs">
                <span className="text-[#263448]">
                  جمع ردیف‌های برآورد ({toPersianDigits(estimateItems.length)} ردیف):{' '}
                  <strong className="tabular-nums text-[#1D3250]">{formatRial(itemsTotal)}</strong>
                </span>
                <button
                  type="button"
                  onClick={applyItemsSumToTotal}
                  className="rounded-lg border border-[#243B5A] bg-[#243B5A] px-3 py-1 text-[11px] font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  ثبت جمع ردیف‌ها به‌عنوان مبلغ کل
                </button>
              </div>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#D4CEBF] bg-[#FFFFFF] px-3 py-3 text-center text-[11px] text-[#788290]">
              می‌توانید مبلغ کل را مستقیم وارد کنید یا با «افزودن ردیف برآورد»، ریز اقلام و هزینه‌ها را ثبت نمایید.
            </div>
          )}
        </section>

        {/* Section 4: Descriptions & Technical Justification */}
        <section className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
            <FileText className="h-4 w-4 text-[#243B5A]" />
            <span>۴. توضیحات تکمیلی و توجیه فنی</span>
          </div>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="ضرورت اجرا، اهداف، مشخصات فنی، وضعیت فعلی محدوده و توضیحات تکمیلی..."
            className="w-full rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-2 text-xs leading-6 text-[#263448]"
          />
        </section>

        {/* Section 5: Visual Attachments (Site Photos / Sketches / Plans) */}
        <section className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-bold text-[#1D3250]">
              <ImageIcon className="h-4 w-4 text-[#243B5A]" />
              <span>۵. مستندات تصویری (عکس وضعیت موجود، کروکی یا نقشه)</span>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>افزودن تصویر از حافظه</span>
                <input
                  type="file"
                  accept="image/*"
                  multiple
                  onChange={handleUploadImages}
                  className="hidden"
                />
              </label>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-medium text-[#263448] hover:bg-[#F2EEE6] cursor-pointer">
                <Camera className="h-3.5 w-3.5 text-[#354F73]" />
                <span>ثبت با دوربین</span>
                <input
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleUploadImages}
                  className="hidden"
                />
              </label>
            </div>
          </div>

          {imageError && (
            <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9E3B3B]">
              {imageError}
            </div>
          )}

          {imageProcessing && (
            <div className="py-3 text-center text-xs text-[#5B6573]">
              در حال فشرده‌سازی و آماده‌سازی تصویر...
            </div>
          )}

          {images.length > 0 ? (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {images.map((img, idx) => (
                <div
                  key={img.id}
                  className="flex flex-col gap-2 rounded-xl border border-[#E2DDD0] bg-[#FFFFFF] p-2.5"
                >
                  <div className="relative h-36 w-full overflow-hidden rounded-lg border border-[#EFECE4] bg-[#FAF8F3]">
                    <img
                      src={img.dataUrl}
                      alt={img.caption || `مستند تصویری ${toPersianDigits(idx + 1)}`}
                      className="h-full w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(img.id)}
                      className="absolute top-2 left-2 inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D8B4B4] bg-[#FFFFFF]/95 text-[#9E3B3B] hover:bg-[#FBF1F1] cursor-pointer"
                      title="حذف تصویر"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      value={img.caption}
                      onChange={(e) => updateImageCaption(img.id, e.target.value)}
                      placeholder={`شرح کوتاه تصویر ${toPersianDigits(idx + 1)} (اختیاری)`}
                      className="flex-1 rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] px-2.5 py-1.5 text-[11px] text-[#263448]"
                    />
                    <span className="shrink-0 text-[10px] text-[#788290]">
                      {formatFileSize(img.sizeBytes)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-[#D4CEBF] bg-[#FFFFFF] px-3 py-4 text-center text-[11px] text-[#788290]">
              هنوز تصویری به این پیشنهاد پیوست نشده است (می‌توانید چند تصویر از وضعیت فعلی یا کروکی اضافه کنید).
            </div>
          )}

          {/* Estimate Documents (PDF / Word / Excel) */}
          <div className="border-t border-[#E6E0D3] pt-3 space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-[#1D3250]">
                <Paperclip className="h-3.5 w-3.5 text-[#354F73]" />
                <span>پیوست فایل مستندات برآورد (PDF، اکسل متره، ورد، استعلام قیمت)</span>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#3D6B59] bg-[#FFFFFF] px-3 py-1.5 text-[11px] font-medium text-[#3D6B59] hover:bg-[#E7ECE6] cursor-pointer">
                <FileSpreadsheet className="h-3.5 w-3.5" />
                <span>افزودن فایل برآورد</span>
                <input
                  type="file"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,image/*"
                  multiple
                  onChange={handleUploadEstimateDocs}
                  className="hidden"
                />
              </label>
            </div>

            {docError && (
              <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9E3B3B]">
                {docError}
              </div>
            )}

            {estimateDocuments.length > 0 ? (
              <div className="space-y-2">
                {estimateDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center gap-2 rounded-xl border border-[#E2DDD0] bg-[#FFFFFF] p-2.5"
                  >
                    <FileText className="h-4 w-4 shrink-0 text-[#243B5A]" />
                    <input
                      type="text"
                      value={doc.title}
                      onChange={(e) => updateDocTitle(doc.id, e.target.value)}
                      placeholder="عنوان مستند برآورد"
                      className="flex-1 rounded-lg border border-[#E2DDD0] bg-[#FAF8F3] px-2.5 py-1.5 text-xs text-[#263448]"
                    />
                    <span className="shrink-0 text-[10px] text-[#788290]">
                      {formatFileSize(doc.sizeBytes)}
                    </span>
                    <button
                      type="button"
                      onClick={() => removeEstimateDoc(doc.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E2DDD0] text-[#788290] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                      title="حذف فایل پیوست"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-lg border border-dashed border-[#D4CEBF] bg-[#FFFFFF] px-3 py-2.5 text-center text-[11px] text-[#788290]">
                فایل برآورد، متره یا استعلام قیمت را می‌توانید اینجا پیوست کنید (ذخیره محلی روی دستگاه).
              </div>
            )}
          </div>
        </section>

        {/* Actions */}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
            className="rounded-xl border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-xs font-medium text-[#263448] hover:bg-[#F3EFE6] cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="rounded-xl border border-[#243B5A] bg-[#243B5A] px-5 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
          >
            {initial ? 'ذخیره تغییرات پیشنهاد' : 'ثبت پرونده پیشنهاد بودجه'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
