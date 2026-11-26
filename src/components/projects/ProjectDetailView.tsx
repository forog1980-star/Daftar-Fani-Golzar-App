import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit2,
  Eye,
  FilePlus2,
  Image as ImageIcon,
  Plus,
  Trash2,
  Upload,
  Wallet,
} from 'lucide-react';
import {
  ActionItem,
  AppRoute,
  AttachmentRecord,
  DocumentCategory,
  DocumentItem,
  ProjectStage,
} from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatFileSize,
  formatJalaliDate,
  formatRial,
  generateId,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { ProjectFormModal } from './ProjectFormModal';
import { ProjectImageUploader } from './ProjectImageUploader';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { exportToWordDocx } from '../../utils/exportEngine';

interface ProjectDetailViewProps {
  projectId: string;
  store: AppStore;
  onNavigate: (route: AppRoute) => void;
}

type DetailTab =
  | 'overview'
  | 'stages'
  | 'contracts'
  | 'minutes'
  | 'actions'
  | 'correspondence'
  | 'attachments';

type StageFilterMode = 'همه' | 'فعال' | 'انجام‌شده' | 'در حال انجام' | 'انجام‌نشده';

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
  store,
  onNavigate,
}) => {
  const project = store.projects.find((p) => p.id === projectId);
  const projectImage = store.projectImages.find((img) => img.projectId === projectId);

  const [tab, setTab] = useState<DetailTab>('overview');
  const [editingProject, setEditingProject] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [stageFilter, setStageFilter] = useState<StageFilterMode>('همه');
  const [stageSelectKey, setStageSelectKey] = useState<string>('همه');
  const [quickDocCat, setQuickDocCat] = useState<DocumentCategory | null>(null);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<{ att: AttachmentRecord; url: string } | null>(null);
  const [deletingAtt, setDeletingAtt] = useState<AttachmentRecord | null>(null);

  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(todayIsoDate());
  const [docSubject, setDocSubject] = useState('');
  const [docParty, setDocParty] = useState('');
  const [docSummary, setDocSummary] = useState('');

  const [actTitle, setActTitle] = useState('');
  const [actDesc, setActDesc] = useState('');
  const [actDue, setActDue] = useState(todayIsoDate());
  const [actPriority, setActPriority] = useState<'فوری' | 'عادی' | 'کم'>('عادی');

  const projectDocs = useMemo(
    () => store.documents.filter((d) => d.projectId === projectId),
    [store.documents, projectId]
  );
  const projectActions = useMemo(
    () => store.actions.filter((a) => a.projectId === projectId),
    [store.actions, projectId]
  );
  const projectAttachments = useMemo(
    () => store.attachments.filter((a) => a.projectId === projectId),
    [store.attachments, projectId]
  );
  const projectForms = useMemo(
    () => store.formSubmissions.filter((s) => s.projectId === projectId),
    [store.formSubmissions, projectId]
  );
  const budget = store.budgets.find((b) => b.projectId === projectId);
  const payments = store.payments.filter((p) => p.projectId === projectId);
  const totalPaid = payments.reduce((sum, p) => sum + (p.amount || 0), 0);

  if (!project) {
    return (
      <div className="mx-auto max-w-5xl p-8 text-center text-sm text-[#5B6573]">
        پرونده پروژه مورد نظر یافت نشد.
      </div>
    );
  }

  const filteredStages = project.stages.filter((st) => {
    if (stageSelectKey !== 'همه' && st.id !== stageSelectKey) return false;
    if (stageFilter === 'فعال') return st.enabled;
    if (stageFilter === 'انجام‌شده') return st.enabled && st.status === 'انجام‌شده';
    if (stageFilter === 'در حال انجام') return st.enabled && st.status === 'در حال انجام';
    if (stageFilter === 'انجام‌نشده') return st.enabled && st.status === 'انجام‌نشده';
    return true;
  });

  const updateStage = async (stageId: string, patch: Partial<ProjectStage>) => {
    const updatedStages = project.stages.map((s) =>
      s.id === stageId ? { ...s, ...patch } : s
    );
    await store.saveProject({ ...project, stages: updatedStages }, false);
  };

  const addCustomStage = async () => {
    if (!newStageTitle.trim()) return;
    const nextStage: ProjectStage = {
      id: generateId('stg'),
      key: generateId('custom'),
      title: newStageTitle.trim(),
      order: project.stages.length + 1,
      enabled: true,
      status: 'انجام‌نشده',
    };
    await store.saveProject({ ...project, stages: [...project.stages, nextStage] }, false);
    setNewStageTitle('');
  };

  const handleQuickDocSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickDocCat || !docSubject.trim()) return;
    const now = new Date().toISOString();
    const doc: DocumentItem = {
      id: generateId('doc'),
      category: quickDocCat,
      documentNumber: docNumber.trim(),
      date: docDate,
      subject: docSubject.trim(),
      senderOrReceiver: docParty.trim(),
      projectId: project.id,
      summary: docSummary.trim(),
      status: 'جاری',
      attachmentIds: [],
      createdAt: now,
      updatedAt: now,
      updatedByDevice: store.settings.deviceId,
    };
    await store.saveDocument(doc, true);
    setQuickDocCat(null);
    setDocNumber('');
    setDocSubject('');
    setDocParty('');
    setDocSummary('');
  };

  const handleQuickActionSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!actTitle.trim()) return;
    const now = new Date().toISOString();
    const item: ActionItem = {
      id: generateId('act'),
      title: actTitle.trim(),
      description: actDesc.trim(),
      projectId: project.id,
      registeredDate: todayIsoDate(),
      dueDate: actDue,
      priority: actPriority,
      status: 'در انتظار',
      followUpResult: '',
      notes: '',
      createdAt: now,
      updatedAt: now,
      updatedByDevice: store.settings.deviceId,
    };
    await store.saveAction(item, true);
    setQuickActionOpen(false);
    setActTitle('');
    setActDesc('');
  };

  const handleAttachmentUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files) return;
    for (const file of Array.from(files)) {
      await store.addAttachment(file, { projectId: project.id });
    }
    e.target.value = '';
  };

  const openAttachmentPreview = (att: AttachmentRecord) => {
    const url = URL.createObjectURL(att.data);
    setPreviewAtt({ att, url });
  };

  const downloadAttachment = (att: AttachmentRecord) => {
    const url = URL.createObjectURL(att.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 300);
  };

  const exportSingleProjectWord = async () => {
    await exportToWordDocx(
      {
        title: `گزارش پرونده پروژه: ${project.title}`,
        documentNumber: project.code,
        date: todayIsoDate(),
        letterhead: store.settings.letterhead,
        summaryRows: [
          { label: 'کد پروژه', value: project.code },
          { label: 'نوع و وضعیت', value: `${project.type} — ${project.status}` },
          { label: 'محل اجرا', value: project.location || '—' },
          { label: 'معاونت متولی', value: project.responsibleDepartment || '—' },
          { label: 'کارفرما / پیمانکار', value: `${project.client || '—'} / ${project.contractor || '—'}` },
          { label: 'شماره و مبلغ قرارداد', value: `${project.contractNumber || '—'} — ${formatRial(project.contractAmount)}` },
          { label: 'دستور ابلاغ مدیرعامل', value: `${project.ceoOrderNumber || '—'} (${formatJalaliDate(project.ceoOrderDate)})` },
          { label: 'پیشرفت فیزیکی / پرداخت‌شده', value: `${toPersianDigits(project.physicalProgress)}٪ — ${formatRial(totalPaid)}` },
        ],
        headers: ['ردیف', 'مرحله اجرایی', 'وضعیت', 'تاریخ اتمام', 'توضیحات'],
        rows: project.stages
          .filter((s) => s.enabled)
          .map((s, idx) => [
            toPersianDigits(idx + 1),
            s.title,
            s.status,
            s.completedDate ? formatJalaliDate(s.completedDate) : '—',
            s.notes || '—',
          ]),
        notes: project.description,
      },
      `project-${project.code}`
    );
  };

  const tabs: Array<{ key: DetailTab; label: string }> = [
    { key: 'overview', label: 'مشخصات و تصویر پروژه' },
    { key: 'stages', label: 'جدول مراحل اجرایی' },
    { key: 'contracts', label: 'قراردادها و دستورکارها' },
    { key: 'minutes', label: 'صورتجلسات و صورت‌وضعیت‌ها' },
    { key: 'actions', label: `اقدامات (${toPersianDigits(projectActions.length)})` },
    { key: 'correspondence', label: 'مکاتبات' },
    { key: 'attachments', label: `تصاویر و پیوست‌ها (${toPersianDigits(projectAttachments.length)})` },
  ];

  const renderDocList = (categories: DocumentCategory[], emptyMsg: string) => {
    const list = projectDocs.filter((d) => categories.includes(d.category));
    return (
      <div className="space-y-4">
        <div className="flex flex-wrap items-center gap-2">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() => setQuickDocCat(cat)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>ثبت {cat}</span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-6 text-center text-sm text-[#788290]">
            {emptyMsg}
          </div>
        ) : (
          <div className="divide-y divide-[#E8E5DE] rounded-lg border border-[#E2DDD2] bg-[#FFFFFF]">
            {list.map((doc) => (
              <div key={doc.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[#263448]">{doc.subject}</div>
                  <div className="text-xs text-[#5B6573]">
                    {doc.category} · شماره {doc.documentNumber || '—'} · {formatJalaliDate(doc.date)}
                  </div>
                </div>
                {doc.senderOrReceiver && (
                  <div className="mt-1 text-xs text-[#5B6573]">طرف مکاتبه: {doc.senderOrReceiver}</div>
                )}
                {doc.summary && (
                  <p className="mt-1.5 text-xs leading-6 text-[#5B6573]">{doc.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-page-in mx-auto max-w-[1280px] px-4 py-5 sm:px-6 space-y-5">
      {/* Project Header Banner with Dedicated Project Image */}
      <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] sm:w-32">
              {projectImage ? (
                <img
                  src={projectImage.dataUrl}
                  alt={project.title}
                  className="h-full w-full object-cover"
                />
              ) : (
                <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#9BA3AE]">
                  <ImageIcon className="h-5 w-5" />
                  <span className="text-[10px]">بدون تصویر</span>
                </div>
              )}
            </div>

            <div>
              <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B6573]">
                <span className="font-medium text-[#243B5A]">کد {project.code}</span>
                <span aria-hidden="true">·</span>
                <span>{project.type}</span>
                <span aria-hidden="true">·</span>
                <span
                  className={
                    project.status === 'دارای مشکل'
                      ? 'font-medium text-[#9E3B3B]'
                      : 'font-medium text-[#243B5A]'
                  }
                >
                  {project.status}
                </span>
              </div>
              <h2 className="mt-1.5 text-lg font-semibold text-[#263448]">{project.title}</h2>
              <p className="mt-1 text-xs text-[#5B6573]">
                محل اجرا: {project.location || 'ثبت‌نشده'} · پیمانکار: {project.contractor || 'ثبت‌نشده'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5 text-[#243B5A]" />
              <span>بخش بودجه</span>
            </button>
            <button
              type="button"
              onClick={exportSingleProjectWord}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#243B5A]" />
              <span>خروجی Word</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingProject(true)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3 py-1.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>ویرایش مشخصات</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-5 flex flex-wrap gap-1.5 border-t border-[#E8E5DE] pt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                tab === t.key
                  ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                  : 'border border-transparent text-[#5B6573] hover:bg-[#F2EEE6] hover:text-[#263448]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5">
        {tab === 'overview' && (
          <div className="space-y-6">
            {/* Section 5: Dedicated Project Image Manager */}
            <ProjectImageUploader
              projectTitle={project.title}
              currentImage={projectImage}
              onSaveImage={async (processed) => {
                await store.saveProjectImage(project.id, project.title, {
                  fileName: processed.fileName,
                  mimeType: processed.mimeType,
                  sizeBytes: processed.sizeBytes,
                  dataUrl: processed.dataUrl,
                });
              }}
              onDeleteImage={async () => {
                await store.deleteProjectImage(project.id, project.title);
              }}
            />

            <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {[
                { label: 'حوزه یا معاونت متولی', val: project.responsibleDepartment || '—' },
                { label: 'کارفرما', val: project.client || '—' },
                { label: 'پیمانکار یا مجری', val: project.contractor || '—' },
                { label: 'شماره قرارداد', val: project.contractNumber || '—' },
                { label: 'تاریخ قرارداد', val: formatJalaliDate(project.contractDate) },
                { label: 'مبلغ قرارداد', val: formatRial(project.contractAmount) },
                { label: 'مدت قرارداد', val: project.contractDuration || '—' },
                { label: 'تاریخ ابلاغ', val: formatJalaliDate(project.notificationDate) },
                { label: 'پیشرفت فیزیکی', val: `${toPersianDigits(project.physicalProgress)} درصد` },
                { label: 'شماره دستور مدیرعامل', val: project.ceoOrderNumber || '—' },
                { label: 'تاریخ دستور مدیرعامل', val: formatJalaliDate(project.ceoOrderDate) },
                { label: 'ملاحظات دستور ابلاغ', val: project.ceoOrderNotes || '—' },
              ].map((item) => (
                <div key={item.label} className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-3.5">
                  <div className="text-xs text-[#788290]">{item.label}</div>
                  <div className="mt-1 text-sm font-medium text-[#263448] tabular-nums">
                    {item.val}
                  </div>
                </div>
              ))}
            </div>

            {budget && (
              <div className="border-t border-[#E8E5DE] pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#243B5A]">خلاصه وضعیت مالی پروژه</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('budget')}
                    className="text-xs font-medium text-[#354F73] hover:underline cursor-pointer"
                  >
                    مدیریت کامل در بخش بودجه و اعتبارات
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                    <div className="text-xs text-[#5B6573]">اعتبار مصوب</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#243B5A]">
                      {formatRial(budget.approvedCredit)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#F2EEE6] p-3">
                    <div className="text-xs text-[#5B6573]">تأمین اعتبار</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#243B5A]">
                      {formatRial(budget.fundedCredit)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#E7ECE6] p-3">
                    <div className="text-xs text-[#5B6573]">مبلغ پرداخت‌شده</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#243B5A]">
                      {formatRial(totalPaid)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#E5EBF2] p-3">
                    <div className="text-xs text-[#5B6573]">مانده اعتبار</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#243B5A]">
                      {formatRial((budget.fundedCredit || budget.approvedCredit) - totalPaid)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[#E8E5DE] pt-4">
              <h3 className="text-sm font-semibold text-[#243B5A]">توضیحات و سوابق</h3>
              <p className="mt-2 text-sm leading-7 text-[#5B6573]">
                {project.description || 'توضیحی ثبت نشده است.'}
              </p>
            </div>

            {projectForms.length > 0 && (
              <div className="border-t border-[#E8E5DE] pt-4">
                <h3 className="text-sm font-semibold text-[#243B5A]">
                  فرم‌های سازمانی مرتبط ({toPersianDigits(projectForms.length)})
                </h3>
                <div className="mt-2 divide-y divide-[#E8E5DE] rounded-lg border border-[#E2DDD2]">
                  {projectForms.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <span className="font-medium text-[#263448]">{f.templateTitle}</span>
                      <span className="text-[#5B6573]">
                        شماره {f.submissionNumber} · {formatJalaliDate(f.submissionDate)} · {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* Section 7: Fixed Project Execution Stages Table with Top Filter/Selector Bar & Sticky Stage Column */}
        {tab === 'stages' && (
          <div className="space-y-4">
            {/* Top Sticky-Accessible Stage Selection & Filter Bar */}
            <div className="rounded-lg border border-[#E2DDD2] bg-[#F2EEE6] p-3.5 space-y-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <h3 className="text-sm font-semibold text-[#243B5A]">
                    جدول مراحل اجرایی پروژه ({project.type})
                  </h3>
                  <p className="mt-0.5 text-[11px] text-[#5B6573]">
                    نوار انتخاب و فیلتر مراحل در بالای جدول قرار دارد و ستون «مرحله اجرایی» هنگام اسکرول افقی ثابت می‌ماند.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <select
                    value={stageSelectKey}
                    onChange={(e) => setStageSelectKey(e.target.value)}
                    className="max-w-full rounded-lg border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                    aria-label="انتخاب مستقیم مرحله اجرایی"
                  >
                    <option value="همه">همه مراحل ({toPersianDigits(project.stages.length)})</option>
                    {project.stages.map((st, idx) => (
                      <option key={st.id} value={st.id}>
                        {toPersianDigits(idx + 1)}. {st.title}
                      </option>
                    ))}
                  </select>

                  <select
                    value={stageFilter}
                    onChange={(e) => setStageFilter(e.target.value as StageFilterMode)}
                    className="rounded-lg border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                    aria-label="فیلتر وضعیت مراحل"
                  >
                    <option value="همه">فیلتر: همه وضعیت‌ها</option>
                    <option value="فعال">فقط مراحل فعال</option>
                    <option value="انجام‌شده">انجام‌شده</option>
                    <option value="در حال انجام">در حال انجام</option>
                    <option value="انجام‌نشده">انجام‌نشده</option>
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2 border-t border-[#E2DDD2] pt-2.5">
                <input
                  type="text"
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  placeholder="افزودن مرحله اختصاصی جدید به این پروژه..."
                  className="flex-1 min-w-[200px] rounded-lg border border-[#CEC8BA] bg-[#FFFFFF] px-3 py-1.5 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomStage}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3.5 py-1.5 text-xs text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن مرحله</span>
                </button>
              </div>
            </div>

            {/* Horizontally Scrollable Table with Sticky Right-Pinned "مرحله اجرایی" Column */}
            <div className="w-full overflow-x-auto rounded-lg border border-[#E2DDD2]">
              <table className="w-full min-w-[760px] border-collapse text-right text-xs">
                <thead>
                  <tr className="border-b border-[#E2DDD2] bg-[#FAF8F3] text-[#5B6573]">
                    <th className="sticky right-0 z-10 w-[230px] min-w-[200px] border-l border-[#E2DDD2] bg-[#FAF8F3] px-3.5 py-3 font-semibold text-[#243B5A]">
                      مرحله اجرایی
                    </th>
                    <th className="w-[72px] px-3 py-3 text-center font-medium">فعال</th>
                    <th className="w-[140px] px-3 py-3 font-medium">وضعیت اجرا</th>
                    <th className="w-[150px] px-3 py-3 font-medium">تاریخ اتمام</th>
                    <th className="min-w-[220px] px-3 py-3 font-medium">یادداشت و توضیحات مرحله</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E5DE]">
                  {filteredStages.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-[#788290]">
                        مرحله‌ای با فیلتر انتخاب‌شده یافت نشد.
                      </td>
                    </tr>
                  ) : (
                    filteredStages.map((st) => {
                      const originalIndex = project.stages.findIndex((x) => x.id === st.id);
                      return (
                        <tr
                          key={st.id}
                          className={st.enabled ? 'bg-[#FFFFFF] hover:bg-[#FAF8F3]' : 'bg-[#FAF8F3] opacity-65'}
                        >
                          <td className="sticky right-0 z-10 border-l border-[#E2DDD2] bg-inherit px-3.5 py-3 font-medium text-[#263448]">
                            <div className="flex items-center justify-between gap-2">
                              <span>
                                {toPersianDigits(originalIndex + 1)}. {st.title}
                              </span>
                              {st.enabled && st.status === 'انجام‌شده' && (
                                <Check className="h-3.5 w-3.5 shrink-0 text-[#4F7765]" />
                              )}
                            </div>
                          </td>
                          <td className="px-3 py-3 text-center">
                            <input
                              type="checkbox"
                              checked={st.enabled}
                              onChange={(e) => updateStage(st.id, { enabled: e.target.checked })}
                              className="h-4 w-4 accent-[#243B5A] cursor-pointer"
                              aria-label={`فعال بودن مرحله ${st.title}`}
                            />
                          </td>
                          <td className="px-3 py-3">
                            <select
                              disabled={!st.enabled}
                              value={st.status}
                              onChange={(e) => {
                                const nextStatus = e.target.value as ProjectStage['status'];
                                updateStage(st.id, {
                                  status: nextStatus,
                                  completedDate:
                                    nextStatus === 'انجام‌شده'
                                      ? st.completedDate || todayIsoDate()
                                      : st.completedDate,
                                });
                              }}
                              className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2 py-1.5 text-xs text-[#263448] disabled:opacity-50"
                            >
                              <option value="انجام‌نشده">انجام‌نشده</option>
                              <option value="در حال انجام">در حال انجام</option>
                              <option value="انجام‌شده">انجام‌شده</option>
                            </select>
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="date"
                              disabled={!st.enabled}
                              value={st.completedDate ?? ''}
                              onChange={(e) => updateStage(st.id, { completedDate: e.target.value })}
                              className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2 py-1 text-xs text-[#263448] disabled:opacity-50"
                            />
                          </td>
                          <td className="px-3 py-3">
                            <input
                              type="text"
                              disabled={!st.enabled}
                              value={st.notes ?? ''}
                              onChange={(e) => updateStage(st.id, { notes: e.target.value })}
                              placeholder="ثبت یادداشت مرحله..."
                              className="w-full rounded border border-[#E2DDD2] bg-[#FAF8F3] px-2.5 py-1.5 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none disabled:opacity-50"
                            />
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {tab === 'contracts' &&
          renderDocList(
            ['قرارداد', 'دستورکار'],
            'هنوز قرارداد یا دستورکاری برای این پروژه ثبت نشده است.'
          )}

        {tab === 'minutes' &&
          renderDocList(
            ['صورتجلسه', 'صورت‌وضعیت'],
            'هنوز صورتجلسه یا صورت‌وضعیتی برای این پروژه ثبت نشده است.'
          )}

        {tab === 'correspondence' &&
          renderDocList(
            ['نامه وارده', 'نامه صادره', 'مکاتبه داخلی', 'پیوست'],
            'هنوز مکاتبه‌ای برای این پروژه ثبت نشده است.'
          )}

        {tab === 'actions' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-[#243B5A]">اقدامات و پیگیری‌های این پروژه</h3>
              <button
                type="button"
                onClick={() => setQuickActionOpen(true)}
                className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3 py-1.5 text-xs text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ثبت اقدام برای این پروژه</span>
              </button>
            </div>
            {projectActions.length === 0 ? (
              <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-6 text-center text-sm text-[#788290]">
                اقدامی به این پروژه متصل نشده است.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DE] rounded-lg border border-[#E2DDD2]">
                {projectActions.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-medium text-[#263448]">{a.title}</div>
                      <div className="mt-1 text-xs text-[#5B6573]">
                        اولویت: {a.priority} · وضعیت: {a.status} · مهلت: {formatJalaliDate(a.dueDate)}
                      </div>
                      {a.followUpResult && (
                        <div className="mt-1 text-xs text-[#243B5A]">
                          نتیجه پیگیری: {a.followUpResult}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {tab === 'attachments' && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-semibold text-[#243B5A]">
                  تصاویر و فایل‌های پیوست پرونده (ذخیره‌سازی محلی IndexedDB)
                </h3>
                <p className="mt-0.5 text-xs text-[#5B6573]">
                  پشتیبانی از PDF، Word، Excel و تصاویر بدون ارسال به سرور ابری
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>افزودن فایل پیوست</span>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.doc,.docx,.xls,.xlsx,image/*"
                  onChange={handleAttachmentUpload}
                  className="hidden"
                />
              </label>
            </div>

            {projectAttachments.length === 0 ? (
              <div className="rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-6 text-center text-sm text-[#788290]">
                فایل پیوستی برای این پروژه بارگذاری نشده است.
              </div>
            ) : (
              <div className="divide-y divide-[#E8E5DE] rounded-lg border border-[#E2DDD2]">
                {projectAttachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#263448]">{att.fileName}</div>
                      <div className="mt-0.5 text-xs text-[#788290]">
                        {formatFileSize(att.size)} · {formatJalaliDate(att.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') && (
                        <button
                          type="button"
                          onClick={() => openAttachmentPreview(att)}
                          className="inline-flex items-center gap-1 rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>مشاهده</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadAttachment(att)}
                        className="inline-flex items-center gap-1 rounded border border-[#CEC8BA] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>دریافت</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAtt(att)}
                        className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#5B6573] hover:border-[#9E3B3B] hover:text-[#9E3B3B] cursor-pointer"
                        title="حذف پیوست"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {editingProject && (
        <ProjectFormModal
          initial={project}
          processTemplates={store.settings.processTemplates}
          deviceId={store.settings.deviceId}
          onSave={async (proj, isNew) => {
            await store.saveProject(proj, isNew);
          }}
          onClose={() => setEditingProject(false)}
        />
      )}

      {quickDocCat && (
        <FloatingWindow
          title={`ثبت ${quickDocCat} برای پروژه ${project.code}`}
          onClose={() => setQuickDocCat(null)}
          width={560}
        >
          <form onSubmit={handleQuickDocSubmit} className="space-y-3.5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">شماره سند</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">تاریخ</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">موضوع *</label>
              <input
                type="text"
                required
                value={docSubject}
                onChange={(e) => setDocSubject(e.target.value)}
                className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">فرستنده / گیرنده / طرف سند</label>
              <input
                type="text"
                value={docParty}
                onChange={(e) => setDocParty(e.target.value)}
                className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">شرح و خلاصه</label>
              <textarea
                rows={3}
                value={docSummary}
                onChange={(e) => setDocSummary(e.target.value)}
                className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickDocCat(null)}
                className="rounded border border-[#CEC8BA] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3]"
              >
                ثبت در پرونده
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}

      {quickActionOpen && (
        <FloatingWindow
          title={`ثبت اقدام جدید برای ${project.code}`}
          onClose={() => setQuickActionOpen(false)}
          width={520}
        >
          <form onSubmit={handleQuickActionSubmit} className="space-y-3.5">
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">عنوان اقدام *</label>
              <input
                type="text"
                required
                value={actTitle}
                onChange={(e) => setActTitle(e.target.value)}
                className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">مهلت انجام</label>
                <input
                  type="date"
                  value={actDue}
                  onChange={(e) => setActDue(e.target.value)}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6573]">اولویت</label>
                <select
                  value={actPriority}
                  onChange={(e) => setActPriority(e.target.value as 'فوری' | 'عادی' | 'کم')}
                  className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
                >
                  <option value="فوری">فوری</option>
                  <option value="عادی">عادی</option>
                  <option value="کم">کم</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">شرح اقدام</label>
              <textarea
                rows={3}
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                className="w-full rounded border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickActionOpen(false)}
                className="rounded border border-[#CEC8BA] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="rounded border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3]"
              >
                ثبت اقدام
              </button>
            </div>
          </form>
        </FloatingWindow>
      )}

      {previewAtt && (
        <FloatingWindow
          title={`پیش‌نمایش: ${previewAtt.att.fileName}`}
          onClose={() => {
            URL.revokeObjectURL(previewAtt.url);
            setPreviewAtt(null);
          }}
          width={760}
        >
          {previewAtt.att.mimeType.startsWith('image/') ? (
            <img
              src={previewAtt.url}
              alt={previewAtt.att.fileName}
              className="max-h-[65vh] w-full object-contain border border-[#E2DDD2]"
            />
          ) : (
            <iframe
              src={previewAtt.url}
              title={previewAtt.att.fileName}
              className="h-[65vh] w-full border border-[#E2DDD2]"
            />
          )}
        </FloatingWindow>
      )}

      <ConfirmDialog
        open={Boolean(deletingAtt)}
        title="حذف فایل پیوست"
        message={`آیا از حذف فایل «${deletingAtt?.fileName ?? ''}» از حافظه محلی اطمینان دارید؟`}
        confirmLabel="حذف فایل"
        danger
        onCancel={() => setDeletingAtt(null)}
        onConfirm={async () => {
          if (deletingAtt) {
            await store.deleteAttachment(deletingAtt);
            setDeletingAtt(null);
          }
        }}
      />
    </div>
  );
};
