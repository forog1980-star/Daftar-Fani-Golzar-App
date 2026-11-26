import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit2,
  Eye,
  FilePlus2,
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
  Project,
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

export const ProjectDetailView: React.FC<ProjectDetailViewProps> = ({
  projectId,
  store,
  onNavigate,
}) => {
  const project = store.projects.find((p) => p.id === projectId);
  const [tab, setTab] = useState<DetailTab>('overview');
  const [editingProject, setEditingProject] = useState(false);
  const [newStageTitle, setNewStageTitle] = useState('');
  const [quickDocCat, setQuickDocCat] = useState<DocumentCategory | null>(null);
  const [quickActionOpen, setQuickActionOpen] = useState(false);
  const [previewAtt, setPreviewAtt] = useState<{ att: AttachmentRecord; url: string } | null>(null);
  const [deletingAtt, setDeletingAtt] = useState<AttachmentRecord | null>(null);

  // Quick Doc modal fields
  const [docNumber, setDocNumber] = useState('');
  const [docDate, setDocDate] = useState(todayIsoDate());
  const [docSubject, setDocSubject] = useState('');
  const [docParty, setDocParty] = useState('');
  const [docSummary, setDocSummary] = useState('');

  // Quick Action fields
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
      <div className="mx-auto max-w-5xl p-8 text-center text-sm text-[#5B6268]">
        پرونده پروژه مورد نظر یافت نشد.
      </div>
    );
  }

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
    { key: 'overview', label: 'مشخصات کلی' },
    { key: 'stages', label: 'فرایند اجرا' },
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
              className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
            >
              <FilePlus2 className="h-3.5 w-3.5" />
              <span>ثبت {cat}</span>
            </button>
          ))}
        </div>

        {list.length === 0 ? (
          <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-6 text-center text-sm text-[#7C8287]">
            {emptyMsg}
          </div>
        ) : (
          <div className="divide-y divide-[#ECE7DA] border border-[#E2DDD0] bg-[#FFFFFF]">
            {list.map((doc) => (
              <div key={doc.id} className="p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="text-sm font-medium text-[#2B3033]">{doc.subject}</div>
                  <div className="text-xs text-[#5B6268]">
                    {doc.category} · شماره {doc.documentNumber || '—'} · {formatJalaliDate(doc.date)}
                  </div>
                </div>
                {doc.senderOrReceiver && (
                  <div className="mt-1 text-xs text-[#5B6268]">طرف مکاتبه: {doc.senderOrReceiver}</div>
                )}
                {doc.summary && (
                  <p className="mt-1.5 text-xs leading-6 text-[#5B6268]">{doc.summary}</p>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
      {/* Project Header Banner */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-[#5B6268]">
              <span>کد {project.code}</span>
              <span aria-hidden="true">·</span>
              <span>{project.type}</span>
              <span aria-hidden="true">·</span>
              <span
                className={
                  project.status === 'دارای مشکل'
                    ? 'font-medium text-[#B43E3E]'
                    : 'font-medium text-[#2D5A63]'
                }
              >
                {project.status}
              </span>
              {project.isSample && (
                <>
                  <span aria-hidden="true">·</span>
                  <span className="text-[#8C6423]">داده آزمایشی نمونه</span>
                </>
              )}
            </div>
            <h2 className="mt-1.5 text-lg font-semibold text-[#2B3033]">{project.title}</h2>
            <p className="mt-1 text-xs text-[#5B6268]">
              محل اجرا: {project.location || 'ثبت‌نشده'} · پیمانکار: {project.contractor || 'ثبت‌نشده'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => onNavigate('budget')}
              className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            >
              <Wallet className="h-3.5 w-3.5 text-[#2D5A63]" />
              <span>بخش بودجه</span>
            </button>
            <button
              type="button"
              onClick={exportSingleProjectWord}
              className="inline-flex items-center gap-1.5 border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-1.5 text-xs font-medium text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            >
              <Download className="h-3.5 w-3.5 text-[#2D5A63]" />
              <span>خروجی Word پرونده</span>
            </button>
            <button
              type="button"
              onClick={() => setEditingProject(true)}
              className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-3 py-1.5 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              <Edit2 className="h-3.5 w-3.5" />
              <span>ویرایش مشخصات</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="mt-5 flex flex-wrap gap-1 border-t border-[#ECE7DA] pt-3">
          {tabs.map((t) => (
            <button
              key={t.key}
              type="button"
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
                tab === t.key
                  ? 'border border-[#2D5A63] bg-[#E5EFF0] text-[#2D5A63]'
                  : 'border border-transparent text-[#5B6268] hover:bg-[#F3EFE6] hover:text-[#2B3033]'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab Content */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF] p-5">
        {tab === 'overview' && (
          <div className="space-y-6">
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
                <div key={item.label} className="border border-[#ECE7DA] bg-[#FAF8F3] p-3.5">
                  <div className="text-xs text-[#7C8287]">{item.label}</div>
                  <div className="mt-1 text-sm font-medium text-[#2B3033] tabular-nums">
                    {item.val}
                  </div>
                </div>
              ))}
            </div>

            {budget && (
              <div className="border-t border-[#E2DDD0] pt-5">
                <div className="mb-3 flex items-center justify-between">
                  <h3 className="text-sm font-semibold text-[#2B3033]">خلاصه وضعیت مالی پروژه</h3>
                  <button
                    type="button"
                    onClick={() => onNavigate('budget')}
                    className="text-xs font-medium text-[#2D5A63] hover:underline cursor-pointer"
                  >
                    مدیریت کامل در بخش بودجه و اعتبارات
                  </button>
                </div>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="border border-[#ECE7DA] p-3">
                    <div className="text-xs text-[#7C8287]">اعتبار مصوب</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                      {formatRial(budget.approvedCredit)}
                    </div>
                  </div>
                  <div className="border border-[#ECE7DA] p-3">
                    <div className="text-xs text-[#7C8287]">تأمین اعتبار</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums">
                      {formatRial(budget.fundedCredit)}
                    </div>
                  </div>
                  <div className="border border-[#ECE7DA] p-3">
                    <div className="text-xs text-[#7C8287]">مبلغ پرداخت‌شده</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#2D6A4F]">
                      {formatRial(totalPaid)}
                    </div>
                  </div>
                  <div className="border border-[#ECE7DA] p-3">
                    <div className="text-xs text-[#7C8287]">مانده اعتبار تأمین‌شده</div>
                    <div className="mt-1 text-sm font-semibold tabular-nums text-[#2D5A63]">
                      {formatRial((budget.fundedCredit || budget.approvedCredit) - totalPaid)}
                    </div>
                  </div>
                </div>
              </div>
            )}

            <div className="border-t border-[#E2DDD0] pt-4">
              <h3 className="text-sm font-semibold text-[#2B3033]">توضیحات و سوابق</h3>
              <p className="mt-2 text-sm leading-7 text-[#5B6268]">
                {project.description || 'توضیحی ثبت نشده است.'}
              </p>
            </div>

            {projectForms.length > 0 && (
              <div className="border-t border-[#E2DDD0] pt-4">
                <h3 className="text-sm font-semibold text-[#2B3033]">
                  فرم‌های سازمانی و گزارش‌های مرتبط ({toPersianDigits(projectForms.length)})
                </h3>
                <div className="mt-2 divide-y divide-[#ECE7DA] border border-[#E2DDD0]">
                  {projectForms.map((f) => (
                    <div key={f.id} className="flex items-center justify-between px-4 py-2.5 text-xs">
                      <span className="font-medium text-[#2B3033]">{f.templateTitle}</span>
                      <span className="text-[#5B6268]">
                        شماره {f.submissionNumber} · {formatJalaliDate(f.submissionDate)} · {f.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {tab === 'stages' && (
          <div className="space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-sm font-semibold text-[#2B3033]">
                  مراحل فرایند اجرای پروژه ({project.type})
                </h3>
                <p className="mt-0.5 text-xs text-[#5B6268]">
                  همه مراحل برای همه پروژه‌ها اجباری نیستند؛ می‌توانید هر مرحله را فعال/غیرفعال کرده یا مرحله اختصاصی اضافه کنید.
                </p>
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newStageTitle}
                  onChange={(e) => setNewStageTitle(e.target.value)}
                  placeholder="افزودن مرحله جدید..."
                  className="border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-1.5 text-xs text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
                />
                <button
                  type="button"
                  onClick={addCustomStage}
                  className="inline-flex items-center gap-1 border border-[#2D5A63] bg-[#2D5A63] px-3 py-1.5 text-xs text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  <span>افزودن</span>
                </button>
              </div>
            </div>

            <div className="divide-y divide-[#ECE7DA] border border-[#E2DDD0]">
              {project.stages.map((st, idx) => (
                <div
                  key={st.id}
                  className={`flex flex-col gap-3 p-3.5 sm:flex-row sm:items-center sm:justify-between ${
                    st.enabled ? 'bg-[#FFFFFF]' : 'bg-[#FAF8F3] opacity-65'
                  }`}
                >
                  <div className="flex items-start gap-3">
                    <input
                      type="checkbox"
                      checked={st.enabled}
                      onChange={(e) => updateStage(st.id, { enabled: e.target.checked })}
                      className="mt-1 h-4 w-4 accent-[#2D5A63] cursor-pointer"
                      title="فعال بودن مرحله در این پروژه"
                    />
                    <div>
                      <div className="text-sm font-medium text-[#2B3033]">
                        {toPersianDigits(idx + 1)}. {st.title}
                      </div>
                      <input
                        type="text"
                        value={st.notes ?? ''}
                        onChange={(e) => updateStage(st.id, { notes: e.target.value })}
                        placeholder="ثبت یادداشت یا وضعیت مرحله..."
                        className="mt-1.5 w-full min-w-[240px] border-b border-[#E2DDD0] bg-transparent pb-0.5 text-xs text-[#5B6268] focus:border-[#2D5A63] focus:outline-none"
                      />
                    </div>
                  </div>

                  {st.enabled && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <select
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
                        className="border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
                      >
                        <option value="انجام‌نشده">انجام‌نشده</option>
                        <option value="در حال انجام">در حال انجام</option>
                        <option value="انجام‌شده">انجام‌شده</option>
                      </select>
                      <input
                        type="date"
                        value={st.completedDate ?? ''}
                        onChange={(e) => updateStage(st.id, { completedDate: e.target.value })}
                        className="border border-[#CEC7B6] bg-[#FAF8F3] px-2 py-1 text-xs text-[#5B6268]"
                        title="تاریخ انجام مرحله"
                      />
                      {st.status === 'انجام‌شده' && <Check className="h-4 w-4 text-[#2D6A4F]" />}
                    </div>
                  )}
                </div>
              ))}
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
              <h3 className="text-sm font-semibold text-[#2B3033]">اقدامات و پیگیری‌های این پروژه</h3>
              <button
                type="button"
                onClick={() => setQuickActionOpen(true)}
                className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-3 py-1.5 text-xs text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ثبت اقدام برای این پروژه</span>
              </button>
            </div>
            {projectActions.length === 0 ? (
              <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-6 text-center text-sm text-[#7C8287]">
                اقدامی به این پروژه متصل نشده است.
              </div>
            ) : (
              <div className="divide-y divide-[#ECE7DA] border border-[#E2DDD0]">
                {projectActions.map((a) => (
                  <div key={a.id} className="flex flex-wrap items-center justify-between gap-3 p-4">
                    <div>
                      <div className="text-sm font-medium text-[#2B3033]">{a.title}</div>
                      <div className="mt-1 text-xs text-[#5B6268]">
                        اولویت: {a.priority} · وضعیت: {a.status} · مهلت: {formatJalaliDate(a.dueDate)}
                      </div>
                      {a.followUpResult && (
                        <div className="mt-1 text-xs text-[#2D5A63]">
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
                <h3 className="text-sm font-semibold text-[#2B3033]">
                  تصاویر و فایل‌های پیوست پرونده (ذخیره‌سازی محلی IndexedDB)
                </h3>
                <p className="mt-0.5 text-xs text-[#5B6268]">
                  پشتیبانی از PDF، Word، Excel و تصاویر بدون نیاز به سرور ابری
                </p>
              </div>
              <label className="inline-flex items-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer">
                <Upload className="h-3.5 w-3.5" />
                <span>افزودن تصویر یا فایل پیوست</span>
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
              <div className="border border-[#E2DDD0] bg-[#FAF8F3] p-6 text-center text-sm text-[#7C8287]">
                فایل یا تصویری برای این پروژه بارگذاری نشده است.
              </div>
            ) : (
              <div className="divide-y divide-[#ECE7DA] border border-[#E2DDD0]">
                {projectAttachments.map((att) => (
                  <div key={att.id} className="flex items-center justify-between gap-3 p-3.5">
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#2B3033]">{att.fileName}</div>
                      <div className="mt-0.5 text-xs text-[#7C8287]">
                        {formatFileSize(att.size)} · {formatJalaliDate(att.createdAt)}
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {(att.mimeType.startsWith('image/') || att.mimeType === 'application/pdf') && (
                        <button
                          type="button"
                          onClick={() => openAttachmentPreview(att)}
                          className="inline-flex items-center gap-1 border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
                        >
                          <Eye className="h-3.5 w-3.5" />
                          <span>مشاهده</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => downloadAttachment(att)}
                        className="inline-flex items-center gap-1 border border-[#CEC7B6] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
                      >
                        <Download className="h-3.5 w-3.5" />
                        <span>دریافت</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setDeletingAtt(att)}
                        className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
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
                <label className="mb-1 block text-xs text-[#5B6268]">شماره سند</label>
                <input
                  type="text"
                  value={docNumber}
                  onChange={(e) => setDocNumber(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">تاریخ</label>
                <input
                  type="date"
                  value={docDate}
                  onChange={(e) => setDocDate(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">موضوع *</label>
              <input
                type="text"
                required
                value={docSubject}
                onChange={(e) => setDocSubject(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">فرستنده / گیرنده / طرف سند</label>
              <input
                type="text"
                value={docParty}
                onChange={(e) => setDocParty(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">شرح و خلاصه</label>
              <textarea
                rows={3}
                value={docSummary}
                onChange={(e) => setDocSummary(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickDocCat(null)}
                className="border border-[#CEC7B6] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs text-[#FAF8F3]"
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
              <label className="mb-1 block text-xs text-[#5B6268]">عنوان اقدام *</label>
              <input
                type="text"
                required
                value={actTitle}
                onChange={(e) => setActTitle(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">مهلت انجام</label>
                <input
                  type="date"
                  value={actDue}
                  onChange={(e) => setActDue(e.target.value)}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs text-[#5B6268]">اولویت</label>
                <select
                  value={actPriority}
                  onChange={(e) => setActPriority(e.target.value as 'فوری' | 'عادی' | 'کم')}
                  className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                >
                  <option value="فوری">فوری</option>
                  <option value="عادی">عادی</option>
                  <option value="کم">کم</option>
                </select>
              </div>
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">شرح اقدام</label>
              <textarea
                rows={3}
                value={actDesc}
                onChange={(e) => setActDesc(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
              />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setQuickActionOpen(false)}
                className="border border-[#CEC7B6] px-4 py-2 text-xs"
              >
                انصراف
              </button>
              <button
                type="submit"
                className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-xs text-[#FAF8F3]"
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
              className="max-h-[65vh] w-full object-contain border border-[#E2DDD0]"
            />
          ) : (
            <iframe
              src={previewAtt.url}
              title={previewAtt.att.fileName}
              className="h-[65vh] w-full border border-[#E2DDD0]"
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
