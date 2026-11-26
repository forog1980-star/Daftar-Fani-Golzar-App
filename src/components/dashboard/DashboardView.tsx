import React, { useMemo, useState } from 'react';
import {
  Archive,
  CalendarClock,
  FolderOpen,
  HardDrive,
  Image as ImageIcon,
} from 'lucide-react';
import { AppRoute, Project, ProjectStatus } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import { useOnlineStatus } from '../../hooks/usePWAInstall';
import {
  daysUntil,
  formatJalaliDate,
  formatJalaliDateTime,
  formatRial,
  isOverdue,
  isUpcomingDeadline,
  toPersianDigits,
} from '../../utils/format';
import { STATUS_COLORS, StatusDonutChart } from './StatusDonutChart';
import { GolzarGalleryWidget } from './GolzarGalleryWidget';

interface DashboardViewProps {
  store: AppStore;
  onNavigate: (route: AppRoute) => void;
  onOpenProject: (project: Project) => void;
  onOpenGolzarManager: () => void;
}

const ORDERED_STATUSES: ProjectStatus[] = [
  'در حال اجرا',
  'شروع‌نشده',
  'دارای مشکل',
  'متوقف',
  'تکمیل‌شده',
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  store,
  onNavigate,
  onOpenProject,
  onOpenGolzarManager,
}) => {
  const isOnline = useOnlineStatus();
  const { projects, budgets, payments, actions, activities, golzarImages, projectImages, settings } =
    store;

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'همه'>('همه');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');

  const activeProjects = projects.filter(
    (p) => p.status !== 'تکمیل‌شده' && p.status !== 'متوقف'
  );
  const inProgressProjects = projects.filter((p) => p.status === 'در حال اجرا');
  const notStartedProjects = projects.filter((p) => p.status === 'شروع‌نشده');
  const issueProjects = projects.filter((p) => p.status === 'دارای مشکل');

  const urgentOrOverdueActions = actions.filter(
    (a) =>
      a.status !== 'تکمیل‌شده' &&
      a.status !== 'لغوشده' &&
      (a.priority === 'فوری' || a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status))
  );
  const upcomingActions = actions.filter((a) => isUpcomingDeadline(a.dueDate, a.status, 14));

  const totalApprovedCredit = budgets.reduce((s, b) => s + (b.approvedCredit || 0), 0);
  const totalPaid = payments.reduce((s, p) => s + (p.amount || 0), 0);
  const overallUsagePct =
    totalApprovedCredit > 0 ? Math.round((totalPaid / totalApprovedCredit) * 100) : 0;

  // 6 Top KPI Cards (Section 3) — harmonious cream/white cards, calm navy accents
  const topSixCards = [
    {
      label: 'کل پروژه‌ها',
      value: toPersianDigits(projects.length),
      sub: `${toPersianDigits(activeProjects.length)} پرونده فعال`,
      route: 'projects' as AppRoute,
    },
    {
      label: 'در حال اجرا',
      value: toPersianDigits(inProgressProjects.length),
      sub: 'در مسیر اجرا و نظارت',
      route: 'projects' as AppRoute,
    },
    {
      label: 'شروع‌نشده',
      value: toPersianDigits(notStartedProjects.length),
      sub: 'در مرحله برآورد یا ابلاغ',
      route: 'projects' as AppRoute,
    },
    {
      label: 'دارای مشکل',
      value: toPersianDigits(issueProjects.length),
      sub: 'نیازمند پیگیری مدیریتی',
      route: 'projects' as AppRoute,
      alert: issueProjects.length > 0,
    },
    {
      label: 'اقدامات فوری و عقب‌افتاده',
      value: toPersianDigits(urgentOrOverdueActions.length),
      sub: `${toPersianDigits(upcomingActions.length)} مهلت نزدیک`,
      route: 'actions' as AppRoute,
      alert: urgentOrOverdueActions.length > 0,
    },
    {
      label: 'جذب اعتبار مصوب',
      value: `${toPersianDigits(overallUsagePct)}٪`,
      sub: formatRial(totalPaid),
      route: 'budget' as AppRoute,
    },
  ];

  const donutSegments = useMemo(
    () =>
      ORDERED_STATUSES.map((status) => ({
        status,
        count: projects.filter((p) => p.status === status).length,
        color: STATUS_COLORS[status],
      })),
    [projects]
  );

  const filteredProjects = useMemo(() => {
    if (statusFilter === 'همه') return projects;
    return projects.filter((p) => p.status === statusFilter);
  }, [projects, statusFilter]);

  const selectedProject = useMemo(() => {
    const found = filteredProjects.find((p) => p.id === selectedProjectId);
    return found ?? filteredProjects[0] ?? projects[0] ?? null;
  }, [filteredProjects, selectedProjectId, projects]);

  const selectedProjectBudget = selectedProject
    ? budgets.find((b) => b.projectId === selectedProject.id)
    : undefined;

  const selectedProjectImage = selectedProject
    ? projectImages.find((img) => img.projectId === selectedProject.id)
    : undefined;

  const projectNameMap = useMemo(
    () => new Map(projects.map((p) => [p.id, p.title])),
    [projects]
  );

  return (
    <div className="animate-page-in mx-auto max-w-[1280px] space-y-5 px-4 py-5 sm:px-6">
      {/* Row 1: Six Top Information Cards */}
      <section aria-label="خلاصه وضعیت دفتر فنی">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {topSixCards.map((card) => (
            <button
              key={card.label}
              type="button"
              onClick={() => onNavigate(card.route)}
              className="flex flex-col justify-between rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 text-right transition-colors hover:border-[#243B5A] hover:bg-[#F2EEE6]/60 cursor-pointer"
            >
              <span className="text-xs font-medium text-[#5B6573]">{card.label}</span>
              <span
                className={`mt-2.5 text-2xl font-semibold tabular-nums ${
                  card.alert ? 'text-[#9E3B3B]' : 'text-[#243B5A]'
                }`}
              >
                {card.value}
              </span>
              <span className="mt-1 truncate text-[11px] text-[#788290]">{card.sub}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Row 2: Donut Status Chart + Selected Project Detailed Report + Golzar Rotating Gallery */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        {/* Left/Center 8 cols: Project Status Donut + Project Detailed Panel */}
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 xl:col-span-8">
          {/* Project Status Donut Chart */}
          <div className="flex flex-col justify-between rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 lg:col-span-5">
            <div className="mb-4 flex items-center justify-between border-b border-[#E8E5DE] pb-2.5">
              <h2 className="text-sm font-semibold text-[#243B5A]">وضعیت پروژه‌ها</h2>
              {statusFilter !== 'همه' && (
                <button
                  type="button"
                  onClick={() => setStatusFilter('همه')}
                  className="text-[11px] text-[#354F73] hover:underline cursor-pointer"
                >
                  نمایش همه
                </button>
              )}
            </div>
            <StatusDonutChart
              segments={donutSegments}
              total={projects.length}
              selectedStatus={statusFilter}
              onSelectStatus={(st) => setStatusFilter(st)}
            />
          </div>

          {/* Selected Project Detailed Report */}
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 lg:col-span-7">
            <div className="mb-3.5 flex flex-wrap items-center justify-between gap-2 border-b border-[#E8E5DE] pb-2.5">
              <h2 className="text-sm font-semibold text-[#243B5A]">گزارش تفصیلی پروژه</h2>
              {filteredProjects.length > 0 && (
                <select
                  value={selectedProject?.id ?? ''}
                  onChange={(e) => setSelectedProjectId(e.target.value)}
                  className="max-w-[240px] rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-2.5 py-1 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none"
                  aria-label="انتخاب پروژه برای نمایش تفصیلی"
                >
                  {filteredProjects.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.code} — {p.title}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {!selectedProject ? (
              <div className="py-8 text-center text-xs text-[#788290]">
                پروژه‌ای با وضعیت انتخاب‌شده ثبت نشده است.
              </div>
            ) : (
              <div className="space-y-3.5">
                {/* Project Header + Dedicated Project Image */}
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start">
                  <div className="h-24 w-full shrink-0 overflow-hidden rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] sm:w-32">
                    {selectedProjectImage ? (
                      <img
                        src={selectedProjectImage.dataUrl}
                        alt={selectedProject.title}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="flex h-full w-full flex-col items-center justify-center gap-1 text-[#9BA3AE]">
                        <ImageIcon className="h-5 w-5" />
                        <span className="text-[10px]">بدون تصویر</span>
                      </div>
                    )}
                  </div>

                  <div className="min-w-0 flex-1 space-y-1">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-[#5B6573]">
                      <span className="font-medium text-[#243B5A]">کد {selectedProject.code}</span>
                      <span>·</span>
                      <span>{selectedProject.type}</span>
                      <span>·</span>
                      <span className="font-medium text-[#354F73]">{selectedProject.status}</span>
                    </div>
                    <div className="text-sm font-semibold text-[#263448]">
                      {selectedProject.title}
                    </div>
                    <div className="text-xs text-[#5B6573]">
                      محل اجرا: {selectedProject.location || '—'} · واحد متولی:{' '}
                      {selectedProject.responsibleDepartment || '—'}
                    </div>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => onOpenProject(selectedProject)}
                        className="inline-flex items-center gap-1 rounded-lg border border-[#243B5A] bg-[#E5EBF2] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#243B5A] hover:text-[#FAF8F3] cursor-pointer"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>گشودن پرونده کامل پروژه</span>
                      </button>
                    </div>
                  </div>
                </div>

                {/* Detailed Fields Grid */}
                <div className="grid grid-cols-2 gap-2.5 text-xs sm:grid-cols-3">
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-2.5">
                    <div className="text-[11px] text-[#788290]">پیشرفت فیزیکی</div>
                    <div className="mt-0.5 font-semibold tabular-nums text-[#243B5A]">
                      {toPersianDigits(selectedProject.physicalProgress)} درصد
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-2.5">
                    <div className="text-[11px] text-[#788290]">اعتبار مصوب</div>
                    <div className="mt-0.5 font-semibold tabular-nums text-[#263448]">
                      {formatRial(selectedProjectBudget?.approvedCredit)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-2.5">
                    <div className="text-[11px] text-[#788290]">اعتبار تخصیص‌یافته</div>
                    <div className="mt-0.5 font-semibold tabular-nums text-[#263448]">
                      {formatRial(selectedProjectBudget?.allocatedCredit)}
                    </div>
                  </div>
                  <div className="rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-2.5">
                    <div className="text-[11px] text-[#788290]">تاریخ شروع / ابلاغ</div>
                    <div className="mt-0.5 font-medium tabular-nums text-[#263448]">
                      {formatJalaliDate(selectedProject.notificationDate || selectedProject.contractDate)}
                    </div>
                  </div>
                  <div className="col-span-2 rounded-lg border border-[#E8E5DE] bg-[#FAF8F3] p-2.5">
                    <div className="text-[11px] text-[#788290]">اطلاعات قراردادی</div>
                    <div className="mt-0.5 text-[#263448]">
                      پیمانکار: {selectedProject.contractor || '—'} · شماره قرارداد:{' '}
                      {selectedProject.contractNumber || '—'} · مبلغ:{' '}
                      {formatRial(selectedProject.contractAmount)}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Side Column (4 cols): Rotating Golzar Shohada Images + Backup & Offline Cards */}
        <div className="space-y-4 xl:col-span-4">
          <GolzarGalleryWidget
            images={golzarImages}
            onManageClick={onOpenGolzarManager}
          />

          {/* Last Backup & Offline Status */}
          <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-4 space-y-3">
            <div className="flex items-start gap-2.5">
              <Archive className="mt-0.5 h-4 w-4 shrink-0 text-[#B99A62]" />
              <div className="min-w-0 text-xs">
                <div className="font-semibold text-[#243B5A]">آخرین پشتیبان‌گیری</div>
                <div className="mt-0.5 tabular-nums text-[#5B6573]">
                  {settings.lastBackupAt
                    ? formatJalaliDateTime(settings.lastBackupAt)
                    : 'هنوز پشتیبان‌گیری انجام نشده است'}
                </div>
              </div>
            </div>

            <div className="flex items-start gap-2.5 border-t border-[#E8E5DE] pt-3">
              <HardDrive className="mt-0.5 h-4 w-4 shrink-0 text-[#354F73]" />
              <div className="min-w-0 text-xs">
                <div className="font-semibold text-[#243B5A]">وضعیت ذخیره‌سازی</div>
                <div className="mt-0.5 text-[#5B6573]">
                  {isOnline
                    ? 'آفلاین؛ داده‌ها در دستگاه شما ذخیره شده‌اند.'
                    : 'آفلاین؛ داده‌ها در دستگاه شما ذخیره شده‌اند.'}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Row 3: Upcoming Deadlines + Important Actions */}
      <section className="grid grid-cols-1 gap-5 lg:grid-cols-2">
        {/* مهلت‌های نزدیک */}
        <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-4 py-3">
            <div className="flex items-center gap-2">
              <CalendarClock className="h-4 w-4 text-[#243B5A]" />
              <h3 className="text-sm font-semibold text-[#243B5A]">مهلت‌های نزدیک</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="text-xs text-[#354F73] hover:underline cursor-pointer"
            >
              مشاهده همه
            </button>
          </div>
          {upcomingActions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#788290]">
              مهلت نزدیکی در ۱۴ روز آینده ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E5DE]">
              {upcomingActions.slice(0, 5).map((act) => {
                const diff = daysUntil(act.dueDate);
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onNavigate('actions')}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-[#FAF8F3] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-[#263448]">{act.title}</div>
                      <div className="mt-0.5 truncate text-[11px] text-[#788290]">
                        {act.projectId ? projectNameMap.get(act.projectId) ?? 'عمومی' : 'عمومی دفتر فنی'}
                      </div>
                    </div>
                    <div className="shrink-0 text-left text-xs tabular-nums">
                      <div className="font-medium text-[#243B5A]">{formatJalaliDate(act.dueDate)}</div>
                      <div className="text-[11px] text-[#B99A62]">
                        {diff === 0 ? 'امروز' : `${toPersianDigits(diff ?? 0)} روز مانده`}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>

        {/* اقدامات مهم */}
        <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] overflow-hidden">
          <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#243B5A]">اقدامات مهم و فوری</h3>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="text-xs text-[#354F73] hover:underline cursor-pointer"
            >
              مدیریت اقدامات
            </button>
          </div>
          {urgentOrOverdueActions.length === 0 ? (
            <div className="p-6 text-center text-xs text-[#788290]">
              اقدام فوری یا عقب‌افتاده‌ای ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-[#E8E5DE]">
              {urgentOrOverdueActions.slice(0, 5).map((act) => {
                const overdue = act.status === 'عقب‌افتاده' || isOverdue(act.dueDate, act.status);
                return (
                  <button
                    key={act.id}
                    type="button"
                    onClick={() => onNavigate('actions')}
                    className="flex w-full items-center justify-between gap-3 px-4 py-3 text-right hover:bg-[#FAF8F3] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-[#263448]">{act.title}</div>
                      <div className="mt-0.5 text-[11px] text-[#788290]">
                        {act.priority} · {act.projectId ? projectNameMap.get(act.projectId) ?? 'عمومی' : 'عمومی'}
                      </div>
                    </div>
                    <div className="shrink-0 text-left text-xs">
                      <div className={overdue ? 'font-medium text-[#9E3B3B]' : 'text-[#243B5A]'}>
                        {overdue ? 'عقب‌افتاده' : act.status}
                      </div>
                      <div className="tabular-nums text-[11px] text-[#788290]">
                        {formatJalaliDate(act.dueDate)}
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </section>

      {/* Row 4: Real Recent Changes Log (Zero Fake/Sample Logs) */}
      <section className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#243B5A]">آخرین تغییرات</h3>
          <span className="text-xs tabular-nums text-[#5B6573]">
            {toPersianDigits(activities.length)} رویداد واقعی ثبت‌شده
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-6 text-center text-xs text-[#788290]">
            هنوز رویداد واقعی ثبت نشده است. با ثبت یا اصلاح پرونده پروژه، بودجه، اقدام، سند یا ورود فایل JSON، گزارش دقیق زمان‌دار آن در این بخش ثبت می‌شود.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#E8E5DE] bg-[#FAF8F3] text-[#5B6573]">
                  <th className="px-4 py-2.5 font-medium">عملیات</th>
                  <th className="px-4 py-2.5 font-medium">شرح رویداد</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">تاریخ و ساعت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E5DE]">
                {activities.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-4 py-2.5 font-medium text-[#243B5A] whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-[#263448]">{log.summary}</td>
                    <td className="px-4 py-2.5 tabular-nums text-[#788290] whitespace-nowrap">
                      {formatJalaliDateTime(log.timestamp)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
};
