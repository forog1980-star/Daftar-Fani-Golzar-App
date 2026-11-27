import React, { useMemo, useState } from 'react';
import { Check, Edit2, Plus, Search, Trash2 } from 'lucide-react';
import { ActionItem, ActionPriority, ActionStatus } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  formatJalaliDate,
  generateId,
  isOverdue,
  isUpcomingDeadline,
  todayIsoDate,
  toPersianDigits,
} from '../../utils/format';
import { FloatingWindow } from '../layout/FloatingWindow';
import { ConfirmDialog } from '../layout/ConfirmDialog';
import { HelpSectionId } from '../help/helpContent';
import { SectionHelpLink } from '../help/SectionHelpLink';

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
                <th className="px-4 py-3 font-medium">نتیجه پیگیری</th>
                <th className="px-4 py-3 font-medium">عملیات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#ECE7DA]">
              {filtered.map((act) => {
                const overdue = act.status === 'عقب‌افتاده' || isOverdue(act.dueDate, act.status);
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
                    <td className="px-4 py-3 text-xs text-[#5B6268] max-w-[240px]">
                      {act.followUpResult || '—'}
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

      {editing !== undefined && (
        <ActionEditorWindow
          initial={editing}
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
  projects: Array<{ id: string; title: string; code: string }>;
  deviceId: string;
  onSave: (item: ActionItem, isNew: boolean) => Promise<void>;
  onClose: () => void;
}> = ({ initial, projects, deviceId, onSave, onClose }) => {
  const isNew = !initial;
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    const now = new Date().toISOString();
    await onSave(
      {
        id: initial?.id ?? generateId('act'),
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
      width={660}
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
            <input
              type="date"
              value={registeredDate}
              onChange={(e) => setRegisteredDate(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-[#5B6268]">مهلت انجام</label>
            <input
              type="date"
              value={dueDate}
              onChange={(e) => setDueDate(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
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
            <input
              type="date"
              value={completedDate}
              onChange={(e) => setCompletedDate(e.target.value)}
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
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
            {isNew ? 'ثبت اقدام' : 'ذخیره تغییرات'}
          </button>
        </div>
      </form>
    </FloatingWindow>
  );
};
