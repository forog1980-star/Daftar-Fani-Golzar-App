import React, { useMemo, useState } from 'react';
import { Edit2, FolderOpen, Plus, Search, Trash2 } from 'lucide-react';
import { Project, ProjectStatus } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { formatJalaliDate, formatRial, toPersianDigits } from '../../utils/format';
import { getNeutralProjectImage } from '../../utils/officialAssets';
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

  const projectImageMap = useMemo(
    () => new Map(store.projectImages.map((img) => [img.projectId, img])),
    [store.projectImages]
  );

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
    <div className="animate-page-in mx-auto max-w-[1280px] px-4 py-5 sm:px-6 space-y-5">
      {/* Toolbar */}
      <div className="flex flex-col gap-3 rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-1 flex-wrap items-center gap-2.5">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="pointer-events-none absolute right-3 top-2.5 h-4 w-4 text-[#788290]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="جست‌وجو در نام، کد، پیمانکار، محل اجرا یا شماره قرارداد..."
              className="w-full rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] py-2 pr-9 pl-3 text-sm text-[#263448] focus:border-[#243B5A] focus:outline-none"
            />
          </div>

          <select
            value={typeFilter}
            onChange={(e) => setTypeFilter(e.target.value)}
            className="rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
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
            className="rounded-lg border border-[#CEC8BA] bg-[#FAF8F3] px-3 py-2 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
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
          className="inline-flex items-center justify-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>ثبت پروژه جدید</span>
        </button>
      </div>

      {/* Projects Table with Dedicated Project Thumbnails */}
      <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#5B6573]">
              هیچ پرونده پروژه‌ای با فیلترهای انتخاب‌شده یافت نشد.
            </p>
            <button
              type="button"
              onClick={() => setEditing(null)}
              className="mt-4 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
            >
              ایجاد پرونده پروژه جدید
            </button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD2] bg-[#F2EEE6] text-xs text-[#5B6573]">
                  <th className="px-4 py-3 font-medium">تصویر و موضوع پروژه</th>
                  <th className="px-4 py-3 font-medium">نوع و وضعیت</th>
                  <th className="px-4 py-3 font-medium">پیمانکار / مجری</th>
                  <th className="px-4 py-3 font-medium">مبلغ قرارداد</th>
                  <th className="px-4 py-3 font-medium">پیشرفت</th>
                  <th className="px-4 py-3 font-medium">ابلاغ</th>
                  <th className="px-4 py-3 font-medium">عملیات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DE]">
                {filtered.map((p) => {
                  const enabledStages = p.stages.filter((s) => s.enabled);
                  const doneStages = enabledStages.filter((s) => s.status === 'انجام‌شده').length;
                  const pImg = projectImageMap.get(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-[#FAF8F3]">
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <div className="flex h-11 w-14 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FAF8F3]">
                            <img
                              src={pImg ? pImg.dataUrl : getNeutralProjectImage(p.id)}
                              alt={pImg ? p.title : `تصویر پیش‌فرض گلزار — ${p.title}`}
                              className="h-full w-full object-cover"
                            />
                          </div>
                          <div className="min-w-0">
                            <button
                              type="button"
                              onClick={() => onOpenProject(p)}
                              className="text-right text-sm font-medium text-[#263448] hover:text-[#243B5A] hover:underline cursor-pointer"
                            >
                              {p.title}
                            </button>
                            <div className="mt-0.5 text-xs text-[#788290]">
                              {p.code} · {p.location || 'محل نامشخص'}
                            </div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs text-[#263448]">{p.type}</div>
                        <div
                          className={`mt-0.5 text-xs font-medium ${
                            p.status === 'دارای مشکل'
                              ? 'text-[#9E3B3B]'
                              : p.status === 'در حال اجرا'
                                ? 'text-[#243B5A]'
                                : p.status === 'تکمیل‌شده'
                                  ? 'text-[#4F7765]'
                                  : 'text-[#788290]'
                          }`}
                        >
                          {p.status}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-[#263448]">
                        {p.contractor || 'تعیین‌نشده'}
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#263448] whitespace-nowrap">
                        {formatRial(p.contractAmount)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="text-xs font-semibold tabular-nums text-[#243B5A]">
                          {toPersianDigits(p.physicalProgress)}٪
                        </div>
                        <div className="text-[11px] tabular-nums text-[#788290]">
                          {toPersianDigits(doneStages)} از {toPersianDigits(enabledStages.length)} مرحله
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs tabular-nums text-[#5B6573] whitespace-nowrap">
                        {formatJalaliDate(p.notificationDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => onOpenProject(p)}
                            className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#E5EBF2] px-2.5 py-1.5 text-xs font-medium text-[#243B5A] hover:bg-[#243B5A] hover:text-[#FAF8F3] cursor-pointer"
                            title="گشودن پرونده پروژه"
                          >
                            <FolderOpen className="h-3.5 w-3.5" />
                            <span>پرونده</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => setEditing(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4CEBF] bg-[#FFFFFF] text-[#5B6573] hover:border-[#243B5A] hover:text-[#243B5A] cursor-pointer"
                            title="ویرایش"
                          >
                            <Edit2 className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => setDeleting(p)}
                            className="inline-flex h-7 w-7 items-center justify-center rounded-lg border border-[#D4CEBF] bg-[#FFFFFF] text-[#5B6573] hover:border-[#9E3B3B] hover:text-[#9E3B3B] cursor-pointer"
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
        message={`آیا از حذف پرونده «${deleting?.title ?? ''}» اطمینان دارید؟`}
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
