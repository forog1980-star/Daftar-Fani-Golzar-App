import React from 'react';
import { AppRoute, Project } from '../../types';
import { AppStore } from '../../hooks/useAppStore';
import {
  daysUntil,
  formatJalaliDate,
  formatJalaliDateTime,
  isOverdue,
  isUpcomingDeadline,
  toPersianDigits,
} from '../../utils/format';

interface DashboardViewProps {
  store: AppStore;
  onNavigate: (route: AppRoute) => void;
  onOpenProject: (project: Project) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  store,
  onNavigate,
  onOpenProject,
}) => {
  const { projects, actions, activities } = store;

  const activeProjects = projects.filter(
    (p) => p.status !== 'تکمیل‌شده' && p.status !== 'متوقف'
  );
  const notStartedProjects = projects.filter((p) => p.status === 'شروع‌نشده');
  const inProgressProjects = projects.filter((p) => p.status === 'در حال اجرا');
  const issueProjects = projects.filter((p) => p.status === 'دارای مشکل');

  const urgentActions = actions.filter(
    (a) => a.priority === 'فوری' && a.status !== 'تکمیل‌شده' && a.status !== 'لغوشده'
  );
  const upcomingActions = actions.filter((a) => isUpcomingDeadline(a.dueDate, a.status, 7));
  const overdueActions = actions.filter(
    (a) => a.status === 'عقب‌افتاده' || isOverdue(a.dueDate, a.status)
  );

  const projectNameMap = new Map(projects.map((p) => [p.id, p.title]));

  const summaryMetrics = [
    { label: 'پروژه‌های فعال', count: activeProjects.length, tone: 'text-[#2D5A63]', route: 'projects' as AppRoute },
    { label: 'پروژه‌های شروع‌نشده', count: notStartedProjects.length, tone: 'text-[#5B6268]', route: 'projects' as AppRoute },
    { label: 'پروژه‌های در حال اجرا', count: inProgressProjects.length, tone: 'text-[#2D6A4F]', route: 'projects' as AppRoute },
    { label: 'پروژه‌های دارای مشکل', count: issueProjects.length, tone: 'text-[#B43E3E]', route: 'projects' as AppRoute },
    { label: 'اقدامات فوری', count: urgentActions.length, tone: 'text-[#B43E3E]', route: 'actions' as AppRoute },
    { label: 'مهلت‌های نزدیک (۷ روز)', count: upcomingActions.length, tone: 'text-[#A66B1C]', route: 'actions' as AppRoute },
    { label: 'کارهای عقب‌افتاده', count: overdueActions.length, tone: 'text-[#B43E3E]', route: 'actions' as AppRoute },
  ];

  return (
    <div className="animate-page-in mx-auto max-w-6xl px-4 py-6 sm:px-6 space-y-8">
      {/* Real Quantitative Summary Grid */}
      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-base font-semibold text-[#2B3033]">خلاصه وضعیت ثبت‌شده</h2>
          <span className="text-xs text-[#7C8287]">
            مجموع پرونده پروژه‌ها: {toPersianDigits(projects.length)}
          </span>
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-7">
          {summaryMetrics.map((m) => (
            <button
              key={m.label}
              type="button"
              onClick={() => onNavigate(m.route)}
              className="flex flex-col justify-between border border-[#E2DDD0] bg-[#FFFFFF] p-4 text-right transition-colors hover:border-[#2D5A63] hover:bg-[#F8F5EC] cursor-pointer"
            >
              <span className="text-xs leading-5 text-[#5B6268]">{m.label}</span>
              <span className={`mt-3 text-2xl font-semibold tabular-nums ${m.tone}`}>
                {toPersianDigits(m.count)}
              </span>
            </button>
          ))}
        </div>
      </section>

      {/* Two-column operational lists: Projects with Issues + Urgent/Overdue Actions */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Projects requiring attention */}
        <section className="border border-[#E2DDD0] bg-[#FFFFFF]">
          <div className="flex items-center justify-between border-b border-[#E2DDD0] bg-[#F3EFE6] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              پروژه‌های دارای مشکل و فعال
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('projects')}
              className="text-xs font-medium text-[#2D5A63] hover:underline cursor-pointer"
            >
              مشاهده همه پروژه‌ها
            </button>
          </div>

          {projects.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#7C8287]">
              هنوز پروژه‌ای ثبت نشده است. از بخش پرونده پروژه‌ها اولین پروژه را ثبت کنید.
            </div>
          ) : (
            <div className="divide-y divide-[#ECE7DA]">
              {[...issueProjects, ...inProgressProjects, ...notStartedProjects]
                .slice(0, 6)
                .map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => onOpenProject(p)}
                    className="flex w-full items-center justify-between gap-4 px-4 py-3.5 text-right transition-colors hover:bg-[#FAF8F3] cursor-pointer"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-sm font-medium text-[#2B3033]">
                        {p.title}
                      </div>
                      <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5B6268]">
                        <span>{p.code}</span>
                        <span aria-hidden="true">·</span>
                        <span>{p.type}</span>
                        <span aria-hidden="true">·</span>
                        <span
                          className={
                            p.status === 'دارای مشکل'
                              ? 'font-medium text-[#B43E3E]'
                              : p.status === 'در حال اجرا'
                                ? 'text-[#2D6A4F]'
                                : 'text-[#5B6268]'
                          }
                        >
                          {p.status}
                        </span>
                      </div>
                    </div>
                    <div className="shrink-0 text-left">
                      <div className="text-sm font-semibold tabular-nums text-[#2D5A63]">
                        {toPersianDigits(p.physicalProgress)}٪
                      </div>
                      <div className="text-[11px] text-[#7C8287]">پیشرفت فیزیکی</div>
                    </div>
                  </button>
                ))}
            </div>
          )}
        </section>

        {/* Urgent, Overdue & Upcoming Actions */}
        <section className="border border-[#E2DDD0] bg-[#FFFFFF]">
          <div className="flex items-center justify-between border-b border-[#E2DDD0] bg-[#F3EFE6] px-4 py-3">
            <h3 className="text-sm font-semibold text-[#2B3033]">
              اقدامات فوری، عقب‌افتاده و مهلت‌های نزدیک
            </h3>
            <button
              type="button"
              onClick={() => onNavigate('actions')}
              className="text-xs font-medium text-[#2D5A63] hover:underline cursor-pointer"
            >
              مدیریت اقدامات
            </button>
          </div>

          {urgentActions.length === 0 && overdueActions.length === 0 && upcomingActions.length === 0 ? (
            <div className="p-6 text-center text-sm text-[#7C8287]">
              اقدام فوری، عقب‌افتاده یا با مهلت نزدیک ثبت نشده است.
            </div>
          ) : (
            <div className="divide-y divide-[#ECE7DA]">
              {Array.from(
                new Map(
                  [...overdueActions, ...urgentActions, ...upcomingActions].map((a) => [a.id, a])
                ).values()
              )
                .slice(0, 6)
                .map((act) => {
                  const overdue = act.status === 'عقب‌افتاده' || isOverdue(act.dueDate, act.status);
                  const diff = daysUntil(act.dueDate);
                  return (
                    <button
                      key={act.id}
                      type="button"
                      onClick={() => onNavigate('actions')}
                      className="flex w-full items-start justify-between gap-4 px-4 py-3.5 text-right transition-colors hover:bg-[#FAF8F3] cursor-pointer"
                    >
                      <div className="min-w-0">
                        <div className="truncate text-sm font-medium text-[#2B3033]">
                          {act.title}
                        </div>
                        <div className="mt-1 flex flex-wrap items-center gap-2 text-xs text-[#5B6268]">
                          <span>{act.priority === 'فوری' ? 'اولویت فوری' : act.priority}</span>
                          <span aria-hidden="true">·</span>
                          <span>{act.status}</span>
                          {act.projectId && projectNameMap.get(act.projectId) && (
                            <>
                              <span aria-hidden="true">·</span>
                              <span className="truncate max-w-[200px]">
                                {projectNameMap.get(act.projectId)}
                              </span>
                            </>
                          )}
                        </div>
                      </div>
                      <div className="shrink-0 text-left">
                        <div
                          className={`text-xs font-medium tabular-nums ${
                            overdue ? 'text-[#B43E3E]' : 'text-[#A66B1C]'
                          }`}
                        >
                          {formatJalaliDate(act.dueDate)}
                        </div>
                        <div className="mt-0.5 text-[11px] text-[#7C8287]">
                          {overdue
                            ? 'عقب‌افتاده'
                            : diff === 0
                              ? 'مهلت امروز'
                              : diff !== null
                                ? `${toPersianDigits(diff)} روز مانده`
                                : ''}
                        </div>
                      </div>
                    </button>
                  );
                })}
            </div>
          )}
        </section>
      </div>

      {/* Recent Changes & Audit Trail */}
      <section className="border border-[#E2DDD0] bg-[#FFFFFF]">
        <div className="flex items-center justify-between border-b border-[#E2DDD0] bg-[#F3EFE6] px-4 py-3">
          <h3 className="text-sm font-semibold text-[#2B3033]">
            آخرین تغییرات و به‌روزرسانی‌ها
          </h3>
          <span className="text-xs text-[#7C8287]">
            {toPersianDigits(activities.length)} رویداد ثبت‌شده
          </span>
        </div>

        {activities.length === 0 ? (
          <div className="p-6 text-center text-sm text-[#7C8287]">
            تغییری در پایگاه داده محلی ثبت نشده است.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-right text-sm">
              <thead>
                <tr className="border-b border-[#E2DDD0] bg-[#FAF8F3] text-xs text-[#5B6268]">
                  <th className="px-4 py-2.5 font-medium">عملیات</th>
                  <th className="px-4 py-2.5 font-medium">شرح تغییر</th>
                  <th className="px-4 py-2.5 font-medium whitespace-nowrap">زمان ثبت</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#ECE7DA]">
                {activities.slice(0, 10).map((log) => (
                  <tr key={log.id} className="hover:bg-[#FAF8F3]">
                    <td className="px-4 py-2.5 text-xs font-medium text-[#2D5A63] whitespace-nowrap">
                      {log.action}
                    </td>
                    <td className="px-4 py-2.5 text-sm text-[#2B3033]">{log.summary}</td>
                    <td className="px-4 py-2.5 text-xs tabular-nums text-[#7C8287] whitespace-nowrap">
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
