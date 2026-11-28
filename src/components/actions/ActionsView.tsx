import React, { useMemo, useState } from 'react';
import {
  Check,
  Download,
  Edit2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  Upload,
} from 'lucide-react';
import { ActionItem, ActionPriority, ActionStatus, AttachmentRecord } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatFileSize,
  formatJalaliDate,
  generateId,
  isOverdue,
  isUpcomingDeadline,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { SectionReportExportBar } from '../layout/SectionReportExportBar';
import { HelpSectionId } from '../help/helpContent';
import { SectionHelpLink } from '../help/SectionHelpLink';
import { JalaliDateInput } from '../common/JalaliDateInput';

interface ActionsViewProps {
  store: AppStore;
  onOpenHelp?: (sectionId: HelpSectionId) => void;
}

type ActionFilterMode = 'همه' | 'فوری' | 'عقب‌افتاده' | 'مهلت نزدیک' | 'تکمیل‌شده';

export const ActionsView: React.FC<ActionsViewProps> = ({ store, onOpenHelp }) => {
  const [filterMode, setFilterMode] = useState<ActionFilterMode>('همه');
  const [search, setSearch] = useState('');
  const [editing, setEditing] = useState<ActionItem | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<ActionItem | null>(null);

  const projectMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p.title])),
    [store.projects]
  );

  const projectCodeMap = useMemo(
    () => new Map(store.projects.map((p) => [p.id, p.code])),
    [store.projects]
  );

  const getActionAttachments = (act: ActionItem): AttachmentRecord[] => {
    const idSet = new Set(act.attachmentIds ?? []);
    return store.attachments.filter((att) => att.actionId === act.id || idSet.has(att.id));
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
    }, 250);
  };

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.actions.filter((a) => {
      const overdue = a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status);
      if (filterMode === 'فوری' && (a.priority !== 'فوری' || a.status === 'تکمیل‌شده')) return false;
      if (filterMode === 'عقب‌افتاده' && !overdue) return false;
      if (filterMode === 'مهلت نزدیک' && !isUpcomingDeadline(a.dueDate, a.status, 7)) return false;
      if (filterMode === 'تکمیل‌شده' && a.status !== 'تکمیل‌شده') return false;
      if (!q) return true;
      return (
        a.title.toLowerCase().includes(q) ||
        a.description.toLowerCase().includes(q) ||
        a.followUpResult.toLowerCase().includes(q) ||
        (a.projectId && (projectMap.get(a.projectId) ?? '').toLowerCase().includes(q))
      );
    });
  }, [store.actions, filterMode, search, projectMap]);

  const markCompleted = async (item: ActionItem) => {
    await store.saveAction(
      {
        ...item,
        status: 'تکمیل‌شده',
        completedDate: todayIsoDate(),
      },
      false
    );
  };

  const counts = {
    all: store.actions.length,
    urgent: store.actions.filter((a) => a.priority === 'فوری' && a.status !== 'تکمیل‌شده').length,
    overdue: store.actions.filter((a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status)).length,
    upcoming: store.actions.filter((a) => isUpcomingDeadline(a.dueDate, a.status, 7)).length,
    done: store.actions.filter((a) => a.status === 'تکمیل‌شده').length,
  };

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
      {/* Filter Bar */}
      <div className="flex flex-col gap-3 rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap">
            {(
              [
                { key: 'همه', label: `همه (${toPersianDigits(counts.all)})` },
                { key: 'فوری', label: `اقدامات فوری (${toPersianDigits(counts.urgent)})` },
                { key: 'عقب‌افتاده', label: `عقب‌افتاده (${toPersianDigits(counts.overdue)})` },
                { key: 'مهلت نزدیک', label: `مهلت نزدیک (${toPersianDigits(counts.upcoming)})` },
                { key: 'تکمیل‌شده', label: `تکمیل‌شده (${toPersianDigits(counts.done)})` },
              ] as Array<{ key: ActionFilterMode; label: string }>
            ).map((f) => (
              <button
                key={f.key}
                type="button"
                onClick={() => setFilterMode(f.key)}
                className={`inline-flex h-9 items-center justify-center rounded-xl px-3 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  filterMode === f.key
                    ? 'border border-[#243B5A] bg-[#E5EBF2] text-[#243B5A]'
                    : 'border border-[#ECE7DC] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#F3EFE6]'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="inline-flex h-10 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer whitespace-nowrap lg:flex-none"
            >
              <Plus className="h-3.5 w-3.5 shrink-0" />
              <span>ثبت اقدام جدید</span>
            </button>
            {onOpenHelp && <SectionHelpLink sectionId="actions" onOpenHelp={onOpenHelp} />}
          </div>
        </div>

        <div className="relative">
          <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#7C8287]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="جست‌وجو در عنوان، شرح اقدام، نتیجه پیگیری یا نام پروژه..."
            className="h-10 w-full rounded-xl border border-[#CEC7B6] bg-[#FAF8F3] pr-9 pl-3 text-sm text-[#2B3033] focus:border-[#243B5A] focus:outline-none"
          />
        </div>
      </div>

      {/* Actions Table */}
      <div className="overflow-x-auto rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] shadow-[0_2px_8px_rgba(29,50,80,0.04)]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center text-sm text-[#7C8287]">
            موردی در این دسته‌بندی یافت نشد.
          </div>
        ) : (
          <table className="w-full text-right text-sm">
            <thead>
              <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                <th className="px-4 py-3 font-medium">عنوان و شرح اقدام</th>
                <th className="px-4 py-3 font-medium">پروژه مرتبط</th>
                <th className="px-4 py-3 font-medium">ثبت / مهلت</th>
                <th className="px-4 py-3 font-medium">اولویت و وضعیت</th>
                <th className="px-4 py-3 font-medium">نتیجه پیگیری و پیوست</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DA]">
              {filtered.map((act) => {
                const overdue = act.status === 'عقب‌افتاده' || isOverdue(act.dueDate, act.status);
                const linkedFiles = getActionAttachments(act);
                return (
                  <tr key={act.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-4 py-3">
                      <div className="font-medium text-[#2B3033]">{act.title}</div>
                      {act.description && (
                        <div className="mt-0.5 text-xs text-[#5B6268]">{act.description}</div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6268]">
                      {act.projectId ? projectMap.get(act.projectId) ?? '—' : 'عمومی دفتر فنی'}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums whitespace-nowrap">
                      <div className="text-[#7C8287]">ثبت: {formatJalaliDate(act.registeredDate)}</div>
                      <div className={overdue ? 'font-medium text-[#B43E3E]' : 'text-[#2B3033]'}>
                        مهلت: {formatJalaliDate(act.dueDate)}
                      </div>
                      {act.completedDate && (
                        <div className="text-[#2D6A4F]">
                          انجام: {formatJalaliDate(act.completedDate)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs whitespace-nowrap">
                      <div className={act.priority === 'فوری' ? 'font-medium text-[#B43E3E]' : 'text-[#5B6268]'}>
                        {act.priority}
                      </div>
                      <div
                        className={`mt-0.5 font-medium ${
                          act.status === 'تکمیل‌شده'
                            ? 'text-[#2D6A4F]'
                            : overdue
                              ? 'text-[#B43E3E]'
                              : 'text-[#243B5A]'
                        }`}
                      >
                        {overdue && act.status !== 'تکمیل‌شده' ? 'عقب‌افتاده' : act.status}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-xs text-[#5B6268] max-w-[260px]">
                      <div>{act.followUpResult || '—'}</div>
                      {linkedFiles.length > 0 && (
                        <div className="mt-1.5 flex flex-wrap gap-1.5">
                          {linkedFiles.map((att) => (
                            <button
                              key={att.id}
                              type="button"
                              onClick={() => downloadAttachment(att)}
                              className="inline-flex max-w-[200px] items-center gap-1 rounded border border-[#D4CEBF] bg-[#FAF8F3] px-2 py-0.5 text-[11px] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                              title={`دریافت ${att.fileName}`}
                            >
                              <Paperclip className="h-3 w-3 shrink-0" />
                              <span className="truncate">{att.fileName}</span>
                            </button>
                          ))}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <div className="flex items-center gap-1.5">
                        {act.status !== 'تکمیل‌شده' && (
                          <button
                            type="button"
                            onClick={() => markCompleted(act)}
                            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#2D6A4F] hover:border-[#2D6A4F] hover:bg-[#F2F6EE] cursor-pointer"
                            title="تکمیل اقدام"
                          >
                            <Check className="h-3.5 w-3.5" />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setEditing(act)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:text-[#243B5A] cursor-pointer"
                          title="ویرایش و ثبت نتیجه پیگیری"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeleting(act)}
                          className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                          title="حذف"
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
        )}
      </div>

      {/* Bottom Page Section: Actions Report Export (Word & Excel) */}
      <SectionReportExportBar
        buildExport={() => {
          const urgentCount = filtered.filter(
            (a) => a.priority === 'فوری' && a.status !== 'تکمیل‌شده'
          ).length;
          const overdueCount = filtered.filter(
            (a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status)
          ).length;
          const doneCount = filtered.filter((a) => a.status === 'تکمیل‌شده').length;

          return {
            slug: `actions-report-${todayIsoDate()}`,
            payload: {
              title:
                filterMode === 'همه'
                  ? 'گزارش اقدامات و پیگیری‌های دفتر فنی'
                  : `گزارش اقدامات و پیگیری‌های دفتر فنی (${filterMode})`,
              documentNumber: `اق-${Math.floor(100 + Math.random() * 899)}`,
              date: todayIsoDate(),
              letterhead: {
                ...store.settings.letterhead,
                showDateAndNumber: true,
              },
              narrativeParagraphs: [
                `این گزارش فهرست ${toPersianDigits(filtered.length)} اقدام و پیگیری ثبت‌شده در دفتر فنی اداره گلزار شهدا را همراه با کد پروژه مرتبط، اولویت، مهلت انجام، وضعیت و نتیجه پیگیری ارائه می‌دهد.`,
                `از مجموع موارد این فهرست، ${toPersianDigits(doneCount)} اقدام تکمیل‌شده، ${toPersianDigits(urgentCount)} اقدام فوری و ${toPersianDigits(overdueCount)} اقدام عقب‌افتاده از مهلت مقرر است.`,
              ],
              summaryRows: [
                { label: 'تعداد کل اقدامات', value: `${toPersianDigits(filtered.length)} مورد` },
                { label: 'تکمیل‌شده', value: `${toPersianDigits(doneCount)} مورد` },
                { label: 'اقدامات فوری', value: `${toPersianDigits(urgentCount)} مورد` },
                { label: 'اقدامات عقب‌افتاده', value: `${toPersianDigits(overdueCount)} مورد` },
              ],
              headers: [
                'کد پروژه',
                'عنوان اقدام',
                'پروژه مرتبط',
                'اولویت',
                'وضعیت',
                'تاریخ ثبت',
                'مهلت انجام',
                'نتیجه پیگیری',
              ],
              rows: filtered.map((act) => {
                const overdue = act.status === 'عقب‌افتاده' || isOverdue(act.dueDate, act.status);
                return [
                  act.projectId ? projectCodeMap.get(act.projectId) ?? '—' : 'عمومی',
                  act.title,
                  act.projectId ? projectMap.get(act.projectId) ?? '—' : 'عمومی دفتر فنی',
                  act.priority,
                  overdue && act.status !== 'تکمیل‌شده' ? 'عقب‌افتاده' : act.status,
                  formatJalaliDate(act.registeredDate),
                  formatJalaliDate(act.dueDate),
                  act.followUpResult || '—',
                ];
              }),
            },
          };
        }}
      />

      {editing !== undefined && (
        <ActionEditorWindow
          initial={editing}
          store={store}
          projects={store.projects.map((p) => ({ id: p.id, title: p.title, code: p.code }))}
          deviceId={store.settings.deviceId}
          onClose={() => setEditing(undefined)}
          onSave={async (item, isNew) => {
            await store.saveAction(item, isNew);
            setEditing(undefined);
          }}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف اقدام"
        message={`آیا از حذف اقدام «${deleting?.title ?? ''}» اطمینان دارید؟`}
        confirmLabel="حذف"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await store.deleteAction(deleting);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
};

const ActionEditorWindow: React.FC<{
  initial: ActionItem | null;
  store: AppStore;
  projects: Array<{ id: string; title: string; code: string }>;
  deviceId: string;
  onSave: (item: ActionItem, isNew: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ initial, store, projects, deviceId, onSave, onClose }) => {
  const isNew = !initial;
  const actionId = useMemo(() => initial?.id ?? generateId('act'), [initial]);
  const [title, setTitle] = useState(initial?.title ?? '');
  const [description, setDescription] = useState(initial?.description ?? '');
  const [projectId, setProjectId] = useState(initial?.projectId ?? '');
  const [registeredDate, setRegisteredDate] = useState(initial?.registeredDate ?? todayIsoDate());
  const [dueDate, setDueDate] = useState(initial?.dueDate ?? todayIsoDate());
  const [priority, setPriority] = useState<ActionPriority>(initial?.priority ?? 'عادی');
  const [status, setStatus] = useState<ActionStatus>(initial?.status ?? 'در انتظار');
  const [completedDate, setCompletedDate] = useState(initial?.completedDate ?? '');
  const [followUpResult, setFollowUpResult] = useState(initial?.followUpResult ?? '');
  const [notes, setNotes] = useState(initial?.notes ?? '');
  const [attachmentIds, setAttachmentIds] = useState<string[]>(initial?.attachmentIds ?? []);

  const linkedAttachments = store.attachments.filter(
    (a) => a.actionId === actionId || attachmentIds.includes(a.id)
  );

  const handleFileAdd = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;
    const addedIds: string[] = [];
    for (const file of Array.from(files)) {
      const rec = await store.addAttachment(file, {
        actionId,
        projectId: projectId || undefined,
      });
      addedIds.push(rec.id);
    }
    setAttachmentIds((prev) => Array.from(new Set([...prev, ...addedIds])));
    e.target.value = '';
  };

  const handleRemoveAttachment = async (att: AttachmentRecord) => {
    await store.deleteAttachment(att);
    setAttachmentIds((prev) => prev.filter((id) => id !== att.id));
  };

  const handleDownloadAttachment = (att: AttachmentRecord) => {
    const url = URL.createObjectURL(att.data);
    const a = document.createElement('a');
    a.href = url;
    a.download = att.fileName;
    document.body.appendChild(a);
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 250);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    await onSave(
      {
        id: actionId,
        title: title.trim(),
        description: description.trim(),
        projectId: projectId || undefined,
        registeredDate,
        dueDate,
        priority,
        status,
        completedDate: status === 'تکمیل‌شده' ? completedDate || todayIsoDate() : completedDate || undefined,
        followUpResult: followUpResult.trim(),
        notes: notes.trim(),
        attachmentIds,
        isSample: false,
        createdAt: initial?.createdAt ?? now,
        updatedAt: now,
        updatedByDevice: deviceId,
      },
      isNew
    );
  };

  return (
    <FloatingWindow
      title={isNew ? 'ثبت اقدام و پیگیری جدید' : `ویرایش اقدام: ${initial?.title}`}
      onClose={onClose}
      width={680}
    >
      <form onSubmit={handleSubmit} className="space-y-3.5">
        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">عنوان اقدام *</label>
          <input
            type="text"
            required
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">شرح اقدام</label>
          <textarea
            rows={2}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">پروژه مرتبط</label>
            <select
              value={projectId}
              onChange={(e) => setProjectId(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              <option value="">عمومی دفتر فنی (بدون پروژه)</option>
              {projects.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.code} — {p.title}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">اولویت</label>
            <select
              value={priority}
              onChange={(e) => setPriority(e.target.value as ActionPriority)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              <option value="فوری">فوری</option>
              <option value="عادی">عادی</option>
              <option value="کم">کم</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">تاریخ ثبت</label>
            <JalaliDateInput
              value={registeredDate}
              onChange={setRegisteredDate}
              required
              ariaLabel="تاریخ ثبت شمسی"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">مهلت انجام</label>
            <JalaliDateInput
              value={dueDate}
              onChange={setDueDate}
              required
              ariaLabel="مهلت انجام شمسی"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">وضعیت</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ActionStatus)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            >
              <option value="در انتظار">در انتظار</option>
              <option value="در حال انجام">در حال انجام</option>
              <option value="عقب‌افتاده">عقب‌افتاده</option>
              <option value="تکمیل‌شده">تکمیل‌شده</option>
              <option value="لغوشده">لغوشده</option>
            </select>
          </div>
        </div>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">تاریخ انجام</label>
            <JalaliDateInput
              value={completedDate}
              onChange={setCompletedDate}
              placeholder="انتخاب تاریخ انجام (شمسی)"
              ariaLabel="تاریخ انجام شمسی"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">نتیجه پیگیری</label>
            <input
              type="text"
              value={followUpResult}
              onChange={(e) => setFollowUpResult(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs text-[#5B6268]">توضیحات</label>
          <textarea
            rows={2}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
          />
        </div>

        {/* Universal Attachment Section — accepts any file type */}
        <div className="rounded-xl border border-[#E2DDD0] bg-[#FAF8F3] p-3.5 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="inline-flex items-center gap-1.5 text-xs font-medium text-[#2B3033]">
              <Paperclip className="h-3.5 w-3.5 text-[#243B5A]" />
              <span>الحاق پیوست</span>
            </span>
            <label className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#FFFFFF] px-3 py-1.5 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer">
              <Upload className="h-3.5 w-3.5" />
              <span>الحاق پیوست</span>
              <input
                type="file"
                multiple
                onChange={handleFileAdd}
                className="hidden"
              />
            </label>
          </div>

          {linkedAttachments.length > 0 && (
            <div className="divide-y divide-[#ECE7DA] rounded-lg border border-[#E2DDD0] bg-[#FFFFFF]">
              {linkedAttachments.map((att) => (
                <div
                  key={att.id}
                  className="flex items-center justify-between gap-2 px-3 py-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-medium text-[#263448]">{att.fileName}</div>
                    <div className="text-[11px] text-[#788290]">
                      {formatFileSize(att.size)} · {formatJalaliDate(att.createdAt)}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => handleDownloadAttachment(att)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                      title="دریافت فایل"
                    >
                      <Download className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleRemoveAttachment(att)}
                      className="inline-flex h-7 w-7 items-center justify-center rounded border border-[#D4CEBF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
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

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="border border-[#CEC7B6] px-4 py-2 text-xs cursor-pointer"
          >
            انصراف
          </button>
          <button
            type="submit"
            className="border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3] cursor-pointer"
          >
            {isNew ? 'ثبت اقدام' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
