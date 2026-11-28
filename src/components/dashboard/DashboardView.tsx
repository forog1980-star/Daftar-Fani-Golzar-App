import React, { useMemo, useState } from 'react';
import {
  AlertTriangle,
  BarChart3,
  Bell,
  CalendarDays,
  CheckCircle2,
  CheckSquare,
  ChevronDown,
  ChevronUp,
  Clock,
  Database,
  FileText,
  Folder,
  FolderOpen,
  Image as ImageIcon,
  Lightbulb,
  Play,
  Star,
  Wallet,
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
import { ReportType } from '../reports/ReportsView';
import { STATUS_COLORS } from './StatusDonutChart';
import { StatusChartPanel } from './StatusChartPanel';
import { getNeutralProjectImage } from '../../utils/officialAssets';
import { HelpSectionId } from '../help/helpContent';
import { SectionHelpLink } from '../help/SectionHelpLink';

interface DashboardViewProps {
  store: AppStore;
  onNavigate: (route: AppRoute) => void;
  onOpenProject: (project: Project) => void;
  onOpenGolzarManager: () => void;
  onOpenReport: (reportType: ReportType) => void;
  onOpenHelp?: (sectionId: HelpSectionId) => void;
}

const ORDERED_STATUSES: ProjectStatus[] = [
  'در حال اجرا',
  'تکمیل‌شده',
  'دارای مشکل',
  'متوقف',
  'شروع‌نشده',
];

const QUICK_REPORT_TABS: Array<{
  key: ReportType;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { key: 'projects', label: 'گزارش جامع پروژه', icon: BarChart3 },
  { key: 'budget', label: 'بودجه و اعتبارات', icon: Wallet },
  { key: 'proposals', label: 'پیشنهاد بودجه سالانه', icon: Lightbulb },
  { key: 'actions', label: 'اقدامات و پیگیری‌ها', icon: CheckSquare },
  { key: 'documents', label: 'اسناد و مکاتبات', icon: FileText },
  { key: 'single-project', label: 'گزارش تکمیلی', icon: Star },
];

export const DashboardView: React.FC<DashboardViewProps> = ({
  store,
  onNavigate,
  onOpenProject,
  onOpenGolzarManager,
  onOpenReport,
  onOpenHelp,
}) => {
  const isOnline = useOnlineStatus();
  const { projects, budgets, actions, activities, projectImages, settings } = store;

  const [statusFilter, setStatusFilter] = useState<ProjectStatus | 'همه'>('همه');
  const [selectedProjectId, setSelectedProjectId] = useState<string>('');
  const [showAllActivities, setShowAllActivities] = useState(false);

  const activeProjects = projects.filter(
    (p) => p.status !== 'تکمیل‌شده' && p.status !== 'متوقف'
  );
  const inProgressProjects = projects.filter((p) => p.status === 'در حال اجرا');
  const issueProjects = projects.filter((p) => p.status === 'دارای مشکل');

  const urgentActions = actions.filter(
    (a) =>
      a.status !== 'تکمیل‌شده' &&
      a.status !== 'لغوشده' &&
      (a.priority === 'فوری' || a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status))
  );
  const upcoming7Days = actions.filter((a) => isUpcomingDeadline(a.dueDate, a.status, 7));
  const upcomingList = actions.filter((a) => isUpcomingDeadline(a.dueDate, a.status, 14));

  const overallProgressPct = useMemo(() => {
    if (projects.length === 0) return 0;
    const sum = projects.reduce((acc, p) => acc + (Number(p.physicalProgress) || 0), 0);
    return Math.round(sum / projects.length);
  }, [projects]);

  // 5 Top Stat Cards matching approved mockup (calm harmonious tints, responsive mobile 2-col -> desktop 5-col)
  const topStatCards = [
    {
      label: 'پرونده‌های فعال',
      value: toPersianDigits(activeProjects.length),
      bg: 'bg-[#EAF2FB] border-[#D7E4F3]',
      iconColor: 'text-[#2D76D3]',
      icon: Folder,
      route: 'projects' as AppRoute,
    },
    {
      label: 'در حال اجرا',
      value: toPersianDigits(inProgressProjects.length),
      bg: 'bg-[#EDF5EC] border-[#D8E7D6]',
      iconColor: 'text-[#4D9B4A]',
      icon: Play,
      route: 'projects' as AppRoute,
    },
    {
      label: 'دارای مشکل',
      value: toPersianDigits(issueProjects.length),
      bg: 'bg-[#FBF0E4] border-[#EFE0CE]',
      iconColor: 'text-[#D97A31]',
      icon: AlertTriangle,
      route: 'projects' as AppRoute,
    },
    {
      label: 'اقدامات فوری',
      value: toPersianDigits(urgentActions.length),
      bg: 'bg-[#F2EEFA] border-[#E3DCF2]',
      iconColor: 'text-[#7F67C2]',
      icon: Bell,
      route: 'actions' as AppRoute,
    },
    {
      label: 'مهلت‌های نزدیک',
      subLabel: '(۷ روز)',
      value: toPersianDigits(upcoming7Days.length),
      bg: 'bg-[#E9F5F0] border-[#D4E9E0]',
      iconColor: 'text-[#2F9E84]',
      icon: CalendarDays,
      route: 'actions' as AppRoute,
      spanMobileFull: true,
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

  const importantActionsTable = useMemo(() => {
    const activeOnly = actions.filter((a) => a.status !== 'تکمیل‌شده' && a.status !== 'لغوشده');
    const rank = { فوری: 0, عادی: 1, کم: 2 } as const;
    return [...activeOnly].sort((a, b) => rank[a.priority] - rank[b.priority]).slice(0, 5);
  }, [actions]);

  const latestActivity = activities[0] ?? null;

  const statusBadgeClass = (status: ProjectStatus) => {
    if (status === 'در حال اجرا') return 'bg-[#E3F2E5] text-[#2B6B40] border-[#CBE5CF]';
    if (status === 'دارای مشکل') return 'bg-[#FBEAE8] text-[#9E3B3B] border-[#ECCAC6]';
    if (status === 'تکمیل‌شده') return 'bg-[#E5EBF2] text-[#243B5A] border-[#CFDCEB]';
    if (status === 'متوقف') return 'bg-[#F6EFE2] text-[#8B6B2E] border-[#E7D8BA]';
    return 'bg-[#F2EEE6] text-[#5B6573] border-[#E2DDD2]';
  };

  const priorityBadge = (priority: string) => {
    if (priority === 'فوری')
      return { label: 'بالا', cls: 'bg-[#FADDD8] text-[#9E3B3B]' };
    if (priority === 'عادی')
      return { label: 'متوسط', cls: 'bg-[#FAE9CE] text-[#916021]' };
    return { label: 'پایین', cls: 'bg-[#E1F1E4] text-[#2E6B42]' };
  };

  const daysBadgeClass = (diff: number | null) => {
    if (diff === null || diff <= 5) return 'bg-[#FBE8CE] text-[#9A5E1B]';
    if (diff <= 8) return 'bg-[#DCEBFB] text-[#235699]';
    return 'bg-[#E0F1E2] text-[#2E6B42]';
  };

  return (
    <div className="animate-page-in space-y-4 px-3 py-4 sm:px-5 lg:pl-6 lg:pr-4">
      {/* Row 1: Five Top KPI Cards (matching mockup layout on desktop & 2+2+1 on mobile) */}
      <section aria-label="شاخص‌های کلیدی دفتر فنی">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5 items-stretch">
          {topStatCards.map((card) => {
            const Icon = card.icon;
            return (
              <button
                key={card.label}
                type="button"
                onClick={() => onNavigate(card.route)}
                className={`flex min-h-[86px] items-center justify-between gap-2 rounded-2xl border px-3.5 py-3 text-right transition-colors hover:brightness-[0.98] cursor-pointer ${card.bg} ${
                  card.spanMobileFull ? 'col-span-2 sm:col-span-1' : ''
                }`}
              >
                <div className="flex flex-1 flex-col items-center justify-center text-center">
                  <span className="text-xs font-semibold leading-4 text-[#243B5A]">
                    {card.label}
                  </span>
                  {card.subLabel && (
                    <span className="mt-0.5 text-[10px] leading-3 text-[#5B6573]">
                      {card.subLabel}
                    </span>
                  )}
                  <span className="mt-1.5 text-2xl font-bold leading-none tabular-nums text-[#1D3250]">
                    {card.value}
                  </span>
                </div>
                <Icon className={`h-8 w-8 shrink-0 sm:h-9 sm:w-9 ${card.iconColor}`} />
              </button>
            );
          })}
        </div>
      </section>

      {/* Row 2: Unified «وضعیت پروژه‌ها» Card (6 Quick Report Tabs + Detailed Project Panel + Donut Chart) */}
      <section className="rounded-2xl border border-[#E5E0D5] bg-[#FFFFFF] p-4 sm:p-5 space-y-4">
        {/* Panel Title */}
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-[#243B5A]" />
            <h2 className="text-sm font-bold text-[#1D3250] sm:text-base">وضعیت پروژه‌ها</h2>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {statusFilter !== 'همه' && (
              <button
                type="button"
                onClick={() => setStatusFilter('همه')}
                className="rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              >
                حذف فیلتر وضعیت ({statusFilter})
              </button>
            )}
            {onOpenHelp && <SectionHelpLink sectionId="dashboard" onOpenHelp={onOpenHelp} />}
          </div>
        </div>

        {/* 6 Quick Report Navigation Buttons — evenly aligned proportional grid */}
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
          {QUICK_REPORT_TABS.map((tab, idx) => {
            const Icon = tab.icon;
            const isPrimary = idx === 0;
            return (
              <button
                key={tab.key}
                type="button"
                onClick={() => onOpenReport(tab.key)}
                className={`inline-flex h-10 items-center justify-center gap-1.5 rounded-xl border px-2.5 text-xs font-medium transition-colors cursor-pointer whitespace-nowrap ${
                  isPrimary
                    ? 'border-[#243B5A] bg-[#243B5A] text-[#FAF8F3] hover:bg-[#354F73]'
                    : 'border-[#E2E6EE] bg-[#F5F7FB] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2]'
                }`}
              >
                <Icon className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Two-Column Body: Right = Detailed Project Report (7 cols) | Left = Donut Chart (5 cols) */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-12">
          {/* Right Panel: Selected Project Detailed Report + Dedicated Project Image */}
          <div className="rounded-xl border border-[#ECE8DF] bg-[#FFFFFF] p-3.5 sm:p-4 lg:col-span-7">
            {!selectedProject ? (
              <div className="py-10 text-center text-xs text-[#788290]">
                پروژه‌ای با وضعیت انتخاب‌شده ثبت نشده است.
              </div>
            ) : (
              <div className="flex flex-col gap-4 md:flex-row md:items-stretch">
                {/* Dedicated Project Image (Default Golzar fallback hidden on mobile/tablet; shown only on desktop) */}
                <div
                  className={`relative shrink-0 overflow-hidden rounded-xl border border-[#E2DDD2] bg-[#FAF8F3] md:w-40 lg:w-44 ${
                    selectedProjectImage ? 'hidden md:block' : 'hidden lg:block'
                  }`}
                >
                  {selectedProjectImage ? (
                    <img
                      src={selectedProjectImage.dataUrl}
                      alt={selectedProject.title}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <button
                      type="button"
                      onClick={() => onOpenProject(selectedProject)}
                      className="group relative block h-full w-full cursor-pointer text-right"
                      title="تصویر اختصاصی برای این پروژه ثبت نشده است — برای بارگذاری کلیک کنید"
                    >
                      <img
                        src={getNeutralProjectImage(selectedProject.id)}
                        alt={`تصویر پیش‌فرض گلزار — ${selectedProject.title}`}
                        className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.02]"
                      />
                      <div className="absolute inset-x-0 bottom-0 bg-[#1D3250]/75 px-2.5 py-1.5 text-[10px] text-[#FAF8F3] flex items-center justify-between gap-1">
                        <span className="truncate">تصویر پیش‌فرض گلزار</span>
                        <ImageIcon className="h-3 w-3 shrink-0 opacity-85" />
                      </div>
                    </button>
                  )}
                </div>

                {/* Project Info + Rounded Spec Box */}
                <div className="flex min-w-0 flex-1 flex-col justify-between gap-3">
                  <div className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-bold text-[#1D3250]">گزارش تفصیلی پروژه</h3>
                      {filteredProjects.length > 1 && (
                        <select
                          value={selectedProject.id}
                          onChange={(e) => setSelectedProjectId(e.target.value)}
                          className="max-w-[190px] rounded-lg border border-[#DCE1EA] bg-[#F5F7FB] px-2 py-1 text-[11px] text-[#243B5A] focus:border-[#243B5A] focus:outline-none"
                          aria-label="انتخاب پروژه"
                        >
                          {filteredProjects.map((p) => (
                            <option key={p.id} value={p.id}>
                              {p.code} — {p.title}
                            </option>
                          ))}
                        </select>
                      )}
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <p className="truncate text-xs font-semibold text-[#2B4366] sm:text-sm">
                        {selectedProject.title}
                      </p>
                      <button
                        type="button"
                        onClick={() => onOpenProject(selectedProject)}
                        className="inline-flex shrink-0 items-center gap-1 text-[11px] font-medium text-[#354F73] hover:underline cursor-pointer"
                      >
                        <FolderOpen className="h-3.5 w-3.5" />
                        <span>پرونده کامل</span>
                      </button>
                    </div>
                  </div>

                  {/* Soft Rounded Spec Table Box (matching mockup) */}
                  <div className="grid grid-cols-1 gap-x-4 gap-y-2 rounded-xl border border-[#E6EBF3] bg-[#F5F7FB] p-3 text-xs sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">کد پروژه:</span>
                      <span className="font-semibold tabular-nums text-[#1D3250]" dir="ltr">
                        {selectedProject.code}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">وضعیت:</span>
                      <span
                        className={`rounded-full border px-2.5 py-0.5 text-[11px] font-medium ${statusBadgeClass(
                          selectedProject.status
                        )}`}
                      >
                        {selectedProject.status}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">واحد اجرا:</span>
                      <span className="truncate font-medium text-[#263448]">
                        {selectedProject.responsibleDepartment || 'دفتر فنی'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">پیشرفت فیزیکی:</span>
                      <span className="font-bold tabular-nums text-[#1D3250]">
                        {toPersianDigits(selectedProject.physicalProgress)}٪
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">شروع پروژه:</span>
                      <span className="font-medium tabular-nums text-[#263448]">
                        {formatJalaliDate(
                          selectedProject.notificationDate || selectedProject.contractDate
                        )}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[#5B6573]">اعتبار مصوب:</span>
                      <span className="truncate font-semibold tabular-nums text-[#1D3250]">
                        {formatRial(selectedProjectBudget?.approvedCredit)}
                      </span>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Left Panel: Statistical Chart (Default Donut + Toggleable Bar Chart with Project Progress) */}
          <div className="flex items-stretch justify-center rounded-xl border border-[#ECE8DF] bg-[#FCFBF8] p-4 lg:col-span-5">
            <StatusChartPanel
              title="گزارش آماری پروژه‌ها"
              segments={donutSegments}
              total={projects.length}
              selectedStatus={statusFilter}
              onSelectStatus={(st) => setStatusFilter(st)}
              centerValue={`${toPersianDigits(overallProgressPct)}٪`}
              centerLabel="پیشرفت کلی"
              projects={filteredProjects}
              selectedProjectId={selectedProject?.id}
              onSelectProject={(id) => setSelectedProjectId(id)}
            />
          </div>
        </div>
      </section>

      {/* Row 3: Two Navy-Header Table Cards («اقدامات مهم» & «مهلت نزدیک») */}
      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {/* Right Card: اقدامات مهم */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E0D5] bg-[#FFFFFF]">
          <div className="flex items-center justify-between bg-[#243B5A] px-4 py-2.5 text-[#FAF8F3]">
            <div className="flex items-center gap-2">
              <Star className="h-4 w-4 text-[#FAF8F3]" />
              <h3 className="text-sm font-semibold">اقدامات مهم</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="text-[11px] text-[#DCE6F5] hover:underline cursor-pointer"
            >
              مشاهده همه
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#EAE5DC] bg-[#F4F6FA] text-[#4E5B6B]">
                  <th className="px-4 py-2.5 font-semibold">شرح اقدام</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">مهلت</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">اولویت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {importantActionsTable.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-[#788290]">
                      اقدام فعالی ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  importantActionsTable.map((act) => {
                    const pr = priorityBadge(act.priority);
                    return (
                      <tr
                        key={act.id}
                        onClick={() => onNavigate('actions')}
                        className="cursor-pointer transition-colors hover:bg-[#FAF8F3]"
                      >
                        <td className="px-4 py-3 font-medium text-[#263448]">{act.title}</td>
                        <td className="px-3 py-3 tabular-nums text-[#354F73] whitespace-nowrap">
                          {formatJalaliDate(act.dueDate)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block min-w-[54px] rounded-full px-2.5 py-0.5 text-[11px] font-medium ${pr.cls}`}
                          >
                            {pr.label}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Left Card: مهلت نزدیک */}
        <div className="overflow-hidden rounded-2xl border border-[#E5E0D5] bg-[#FFFFFF]">
          <div className="flex items-center justify-between bg-[#243B5A] px-4 py-2.5 text-[#FAF8F3]">
            <div className="flex items-center gap-2">
              <Clock className="h-4 w-4 text-[#FAF8F3]" />
              <h3 className="text-sm font-semibold">مهلت نزدیک</h3>
            </div>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="text-[11px] text-[#DCE6F5] hover:underline cursor-pointer"
            >
              مدیریت مهلت‌ها
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs">
              <thead>
                <tr className="border-b border-[#EAE5DC] bg-[#F4F6FA] text-[#4E5B6B]">
                  <th className="px-4 py-2.5 font-semibold">عنوان</th>
                  <th className="px-3 py-2.5 font-semibold whitespace-nowrap">مهلت</th>
                  <th className="px-3 py-2.5 text-center font-semibold whitespace-nowrap">وضعیت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#EFECE4]">
                {upcomingList.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-6 text-center text-[#788290]">
                      مهلت نزدیکی در ۱۴ روز آینده ثبت نشده است.
                    </td>
                  </tr>
                ) : (
                  upcomingList.slice(0, 5).map((act) => {
                    const diff = daysUntil(act.dueDate);
                    return (
                      <tr
                        key={act.id}
                        onClick={() => onNavigate('actions')}
                        className="cursor-pointer transition-colors hover:bg-[#FAF8F3]"
                      >
                        <td className="px-4 py-3 font-medium text-[#263448]">{act.title}</td>
                        <td className="px-3 py-3 tabular-nums text-[#354F73] whitespace-nowrap">
                          {formatJalaliDate(act.dueDate)}
                        </td>
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={`inline-block min-w-[68px] rounded-full px-2.5 py-0.5 text-[11px] font-medium tabular-nums ${daysBadgeClass(
                              diff
                            )}`}
                          >
                            {diff === 0 ? 'امروز' : `${toPersianDigits(diff ?? 0)} روز دیگر`}
                          </span>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      {/* Row 4: Footer Status Strip — Last Backup, Offline Ready, and Recent Changes (last so its expandable drawer attaches directly below it on mobile & desktop) */}
      <footer
        aria-label="نوار وضعیت سامانه"
        className="rounded-2xl border border-[#E5E0D5] bg-[#FFFFFF] p-3 space-y-3"
      >
        <div className="grid grid-cols-1 gap-2.5 md:grid-cols-3 items-stretch text-xs">
          {/* Card 1: Last Backup */}
          <button
            type="button"
            onClick={() => onNavigate('support')}
            className="flex h-full min-h-[62px] w-full items-center gap-3 rounded-xl border border-[#ECE8DF] bg-[#F8F7F4] px-3.5 py-2.5 text-right transition-colors hover:border-[#243B5A] hover:bg-[#F2EEE6]/70 cursor-pointer"
          >
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF6] text-[#243B5A]">
              <Database className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#1D3250]">آخرین پشتیبان‌گیری</div>
              <div className="mt-0.5 truncate text-xs tabular-nums text-[#5B6573]">
                {settings.lastBackupAt
                  ? formatJalaliDateTime(settings.lastBackupAt)
                  : 'انجام نشده'}
              </div>
            </div>
          </button>

          {/* Card 2: Offline Local Storage Indicator */}
          <div className="flex h-full min-h-[62px] w-full items-center gap-3 rounded-xl border border-[#D4E6D6] bg-[#F3FAF4] px-3.5 py-2.5 text-right">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#DFF0E1] text-[#2E7D32]">
              <CheckCircle2 className="h-4 w-4" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="text-[11px] font-semibold text-[#1F5624]">
                {isOnline ? 'وضعیت آفلاین آماده' : 'حالت آفلاین (بدون اینترنت)'}
              </div>
              <div className="mt-0.5 truncate text-xs text-[#3C5A40]">
                داده‌ها در دستگاه ذخیره شده است
              </div>
            </div>
          </div>

          {/* Card 3 (Last — directly above expandable log): Real Recent Changes */}
          <button
            type="button"
            onClick={() => setShowAllActivities((v) => !v)}
            className={`flex h-full min-h-[62px] w-full items-center justify-between gap-3 rounded-xl border px-3.5 py-2.5 text-right transition-colors cursor-pointer ${
              showAllActivities
                ? 'border-[#243B5A] bg-[#EEF3F9]'
                : 'border-[#ECE8DF] bg-[#F8F7F4] hover:border-[#243B5A] hover:bg-[#F2EEE6]/70'
            }`}
            title={
              latestActivity
                ? `${formatJalaliDateTime(latestActivity.timestamp)} — ${latestActivity.summary}`
                : 'مشاهده فهرست آخرین تغییرات'
            }
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#E8EEF6] text-[#243B5A]">
                <Clock className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-semibold text-[#1D3250]">آخرین تغییرات</div>
                <div className="mt-0.5 truncate text-xs tabular-nums text-[#5B6573]">
                  {latestActivity
                    ? formatJalaliDateTime(latestActivity.timestamp)
                    : 'تغییری ثبت نشده'}
                </div>
              </div>
            </div>
            {activities.length > 0 && (
              <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-[#FFFFFF] border border-[#E5E0D5] text-[#243B5A]">
                {showAllActivities ? (
                  <ChevronUp className="h-3.5 w-3.5" />
                ) : (
                  <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            )}
          </button>
        </div>

        {/* Expandable Real Recent Changes Log Table */}
        {showAllActivities && (
          <div className="overflow-x-auto rounded-xl border border-[#E8E5DE]">
            {activities.length === 0 ? (
              <div className="p-4 text-center text-xs text-[#788290]">
                هنوز رویداد واقعی ثبت نشده است.
              </div>
            ) : (
              <table className="w-full text-right text-xs">
                <thead>
                  <tr className="border-b border-[#E8E5DE] bg-[#F4F6FA] text-[#4E5B6B]">
                    <th className="px-3.5 py-2 font-semibold">عملیات</th>
                    <th className="px-3.5 py-2 font-semibold">شرح رویداد</th>
                    <th className="px-3.5 py-2 font-semibold whitespace-nowrap">تاریخ و ساعت</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#EFECE4]">
                  {activities.slice(0, 10).map((log) => (
                    <tr key={log.id} className="hover:bg-[#FAF8F3]">
                      <td className="px-3.5 py-2 font-medium text-[#243B5A] whitespace-nowrap">
                        {log.action}
                      </td>
                      <td className="px-3.5 py-2 text-[#263448]">{log.summary}</td>
                      <td className="px-3.5 py-2 tabular-nums text-[#788290] whitespace-nowrap">
                        {formatJalaliDateTime(log.timestamp)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </footer>
    </div>
  );
};
