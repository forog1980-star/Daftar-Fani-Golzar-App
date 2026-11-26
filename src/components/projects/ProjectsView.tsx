import React, { useMemo, useState } from 'react';
import { Edit2, FolderOpen, Plus, RotateCcw, Search, Trash2, X } from 'lucide-react';
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

const PERSIAN_DIGITS = '۰۱۲۳۴۵۶۷۸۹';
const ARABIC_DIGITS = '٠١٢٣٤٥٦٧٨٩';

function normalizeSearchText(input: string): string {
  if (!input) return '';
  let out = input
    .replace(/[۰-۹]/g, (d) => String(PERSIAN_DIGITS.indexOf(d)))
    .replace(/[٠-٩]/g, (d) => String(ARABIC_DIGITS.indexOf(d)))
    .replace(/ي/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/ة/g, 'ه')
    .replace(/\u200c/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
  return out;
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

  const normalizedQuery = useMemo(() => normalizeSearchText(search), [search]);

  const filtered = useMemo(() => {
    const tokens = normalizedQuery ? normalizedQuery.split(' ').filter(Boolean) : [];
    return store.projects.filter((p) => {
      if (typeFilter !== 'همه' && p.type !== typeFilter) return false;
      if (statusFilter !== 'همه' && p.status !== statusFilter) return false;
      if (tokens.length === 0) return true;

      const searchable = normalizeSearchText(
        `${p.title} ${p.code} ${p.contractor} ${p.location} ${p.contractNumber}`
      );
      return tokens.every((token) => searchable.includes(token));
    });
  }, [store.projects, normalizedQuery, typeFilter, statusFilter]);

  const hasActiveFilters = Boolean(normalizedQuery) || typeFilter !== 'همه' || statusFilter !== 'همه';

  const resetFilters = () => {
    setSearch('');
    setTypeFilter('همه');
    setStatusFilter('همه');
  };

  return (
    <div className="animate-page-in mx-auto max-w-[1280px] px-4 py-5 sm:px-6 space-y-5">
      {/* Toolbar with Live Search */}
      <div className="rounded-2xl border border-[#E2DDD2] bg-[#FFFFFF] p-4 space-y-3">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 flex-col gap-2.5 sm:flex-row sm:items-center">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="pointer-events-none absolute right-3 top-3 h-4 w-4 text-[#788290]" />
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape' && search) {
                    setSearch('');
                  }
                }}
                placeholder="جست‌وجوی آنی با عنوان یا کد پروژه (پیمانکار، محل اجرا یا شماره قرارداد)..."
                aria-label="جست‌وجوی آنی پروژه‌ها با عنوان یا کد پروژه"
                className="h-10 w-full rounded-xl border border-[#CEC8BA] bg-[#FAF8F3] pr-9 pl-9 text-sm text-[#263448] focus:border-[#243B5A] focus:bg-[#FFFFFF] focus:outline-none transition-colors"
              />
              {search && (
                <button
                  type="button"
                  onClick={() => setSearch('')}
                  className="absolute left-2.5 top-2 inline-flex h-6 w-6 items-center justify-center rounded-lg text-[#788290] hover:bg-[#E8E5DE] hover:text-[#243B5A] cursor-pointer"
                  aria-label="پاک کردن جست‌وجو"
                  title="پاک کردن جست‌وجو"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
              <select
                value={typeFilter}
                onChange={(e) => setTypeFilter(e.target.value)}
                className="h-10 rounded-xl border border-[#CEC8BA] bg-[#FAF8F3] px-3 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
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
                className="h-10 rounded-xl border border-[#CEC8BA] bg-[#FAF8F3] px-3 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                aria-label="فیلتر وضعیت پروژه"
              >
                {statuses.map((s) => (
                  <option key={s} value={s}>
                    وضعیت: {s}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setEditing(null)}
            className="inline-flex h-10 w-full items-center justify-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] whitespace-nowrap shrink-0 cursor-pointer lg:w-auto"
          >
            <Plus className="h-4 w-4" />
            <span>ثبت پروژه جدید</span>
          </button>
        </div>

        {/* Live Search Result Summary */}
        {hasActiveFilters && (
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-[#EFECE4] pt-2.5 text-xs text-[#5B6573]">
            <span className="tabular-nums">
              نتیجه جست‌وجو: نمایش{' '}
              <strong className="font-semibold text-[#1D3250]">
                {toPersianDigits(filtered.length)}
              </strong>{' '}
              از {toPersianDigits(store.projects.length)} پرونده پروژه
            </span>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <RotateCcw className="h-3 w-3" />
              <span>پاک کردن جست‌وجو و فیلترها</span>
            </button>
          </div>
        )}
      </div>

      {/* Projects Table with Dedicated Project Thumbnails */}
      <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-8 text-center">
            <p className="text-sm text-[#5B6573]">
              {hasActiveFilters
                ? 'هیچ پرونده پروژه‌ای مطابق عبارت جست‌وجو یا فیلترهای انتخاب‌شده یافت نشد.'
                : 'هنوز پرونده پروژه‌ای ثبت نشده است.'}
            </p>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
              {hasActiveFilters && (
                <button
                  type="button"
                  onClick={resetFilters}
                  className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#CEC8BA] bg-[#FAF8F3] px-4 text-xs font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>نمایش همه پروژه‌ها</span>
                </button>
              )}
              <button
                type="button"
                onClick={() => setEditing(null)}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#243B5A] bg-[#243B5A] px-4 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>ایجاد پرونده پروژه جدید</span>
              </button>
            </div>
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
                              <span className="font-medium text-[#243B5A] tabular-nums">
                                {p.code}
                              </span>{' '}
                              · {p.location || 'محل نامشخص'}
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
