import React, { useMemo, useState } from 'react';
import { Edit2, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Project, ProjectStatus } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { formatJalaliDate, formatRial, toPersianDigits } from '../../utils/format';
import { ProjectFormModal } from './ProjectFormModal';
import { ConfirmDialog } from '../layout/ConfirmDialog';

interface ProjectsViewProps {
  store: AppStore;
  onOpenProject: (project: Project) => void;
}

export const ProjectsView: React.FC<ProjectsViewProps> = ({ store, onOpenProject }) => {
  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<string>('همه');
  const [statusFilter, setStatusFilter] = useState<string>('همه');
  const [editing, setEditing] = useState<Project | null | undefined>(undefined);
  const [deleting, setDeleting] = useState<Project | null>(null);

  const projectTypes = useMemo(() => {
    const set = new Set<string>(['فرهنگی', 'عمرانی', 'بهسازی', 'مرمت']);
    store.projects.forEach((p) => set.add(p.type));
    return ['همه', ...Array.from(set)];
  }, [store.projects]);

  const statuses: Array<'همه' | ProjectStatus> = [
    'همه',
    'شروع‌نشده',
    'در حال اجرا',
    'دارای مشکل',
    'متوقف',
    'تکمیل‌شده',
  ];

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return store.projects.filter((p) => {
      if (typeFilter !== 'همه' && p.type !== typeFilter) return false;
      if (statusFilter !== 'همه' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.title.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.contractor.toLowerCase().includes(q) ||
        p.location.toLowerCase().includes(q) ||
        p.contractNumber.toLowerCase().includes(q)
      );
    });
  }, [store.projects, search, typeFilter, statusFilter]);

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-5">
      {/* Action & Filter Toolbar */}
      <div className="flex flex-col gap-3 border border-[#E2DDD0] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#7C8287]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجو در نام، کد، پیمانکار، محل اجرا یا شماره قرارداد..."
              className="w-full border border-[#CEC7B6] bg-[#FAF8F3] py-2 pr-9 pl-3 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            aria-label="فیلتر نوع پروژه"
          >
            {projectTypes.map((t) => (
              <option key={t} value={t}>
                نوع: {t}
              </option>
            ))}
          </select>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#2B3033] focus:border-[#2D5A63] focus:outline-none"
            aria-label="فیلتر وضعیت پروژه"
          >
            {statuses.map((s) => (
              <option key={s} value={s}>
                وضعیت: {s}
              </option>
            ))}
          </select>
        </div>

        <button
          type="button"
          onClick={() => setEditing(null)}
          className="inline-flex items-center justify-center gap-1.5 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-sm font-medium text-[#FAF8F3] hover:bg-[#234850] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>ثبت پروژه جدید</span>
        </button>
      </div>

      {/* Projects Table */}
      <div className="border border-[#E2DDD0] bg-[#FFFFFF]">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#5B6268]">
              هیچ پرونده پروژه‌ای با فیلترهای انتخاب‌شده یافت نشد.
            </p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="mt-4 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-sm text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              ایجاد پرونده پروژه جدید
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD0] bg-[#F3EFE6] text-xs text-[#5B6268]">
                  <th className="px-4 py-3 font-medium">کد / موضوع پروژه</th>
                  <th className="px-4 py-3 font-medium">نوع و وضعیت</th>
                  <th className="px-4 py-3 font-medium">پیمانکار / مجری</th>
                  <th className="px-4 py-3 font-medium">مبلغ قرارداد</th>
                  <th className="px-4 py-3 font-medium">پیشرفت</th>
                  <th className="px-4 py-3 font-medium">ابلاغ</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DA]">
                {filtered.map((p) => {
                  const enabledStages = p.stages.filter((s) => s.enabled);
                  const doneStages = enabledStages.filter((s) => s.status === 'انجام‌شده').length;
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF8F3]">
                      <td className="px-4 py-3">
                        <button
                          type="button"
                          onClick={() => onOpenProject(p)}
                          className="text-right font-medium text-[#2B3033] hover:text-[#2D5A63] hover:underline cursor-pointer"
                        >
                          {p.title}
                        </button>
                        <div className="mt-0.5 text-xs text-[#7C8287]">
                          {p.code} · {p.location || 'محل نامشخص'}
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-[#2B3033]">{p.type}</div>
                        <div
                          className={`mt-0.5 text-xs font-medium ${
                            p.status === 'دارای مشکل'
                              ? 'text-[#B43E3E]'
                              : p.status === 'در حال اجرا'
                                ? 'text-[#2D6A4F]'
                                : p.status === 'تکمیل‌شده'
                                  ? 'text-[#2D5A63]'
                                  : 'text-[#7C8287]'
                          }`}
                        >
                          {p.status}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#2B3033]">
                        {p.contractor || 'تعیین‌نشده'}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#2B3033] whitespace-nowrap">
                        {formatRial(p.contractAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-semibold tabular-nums text-[#2D5A63]">
                          {toPersianDigits(p.physicalProgress)}٪
                        </div>
                        <div className="text-[11px] tabular-nums text-[#7C8287]">
                          {toPersianDigits(doneStages)} از {toPersianDigits(enabledStages.length)} مرحله
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#5B6268] whitespace-nowrap">
                        {formatJalaliDate(p.notificationDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenProject(p)}
                            className="inline-flex items-center gap-1 border border-[#2D5A63] bg-[#FAF8F3] px-2.5 py-1.5 text-xs font-medium text-[#2D5A63] hover:bg-[#E5EFF0] cursor-pointer"
                            title="گشودن پرونده پروژه"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span>پرونده</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] bg-[#FFFFFF] text-[#5B6268] hover:border-[#2D5A63] hover:text-[#2D5A63] cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(p)}
                            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] bg-[#FFFFFF] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
                            title="حذف کنترل‌شده"
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
      </div>

      {editing !== undefined && (
        <ProjectFormModal
          initial={editing}
          processTemplates={store.settings.processTemplates}
          deviceId={store.settings.deviceId}
          onSave={async (proj, isNew) => {
            await store.saveProject(proj, isNew);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="حذف کنترل‌شده پرونده پروژه"
        message={`آیا از حذف پرونده «${deleting?.title ?? ''}» اطمینان دارید؟ اسناد و پرداخت‌های ثبت‌شده جداگانه حذف نمی‌شوند، اما پیوند پرونده از فهرست پروژه‌ها برداشته می‌شود.`}
        confirmLabel="حذف پرونده"
        danger
        onCancel={() => setDeleting(null)}
        onConfirm={async () => {
          if (deleting) {
            await store.deleteProject(deleting);
            setDeleting(null);
          }
        }}
      />
    </div>
  );
};
