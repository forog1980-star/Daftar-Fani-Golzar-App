import React, { useState } from 'react';
import { BarChart3, PieChart } from 'lucide-react';
import { Project, ProjectStatus } from '../../types';
import { toPersianDigits } from '../../utils/format';
import { STATUS_COLORS, StatusDonutChart, StatusSegment } from './StatusDonutChart';

export type StatisticalChartStyle = 'donut' | 'bar';

interface StatusChartPanelProps {
  title?: string;
  segments: StatusSegment[];
  total: number;
  selectedStatus: ProjectStatus | 'همه';
  onSelectStatus: (status: ProjectStatus | 'همه') => void;
  centerValue?: string;
  centerLabel?: string;
  /** Optional list of projects to also display individual project progress bars in Bar mode */
  projects?: Project[];
  selectedProjectId?: string;
  onSelectProject?: (projectId: string) => void;
  /** Whether clicking status rows filters by status */
  interactive?: boolean;
}

export const StatusChartPanel: React.FC<StatusChartPanelProps> = ({
  title,
  segments,
  total,
  selectedStatus,
  onSelectStatus,
  centerValue,
  centerLabel = 'کل پروژه‌ها',
  projects,
  selectedProjectId,
  onSelectProject,
  interactive = true,
}) => {
  // Default view is Donut ('donut'); user can toggle to Bar ('bar') at any time
  const [chartStyle, setChartStyle] = useState<StatisticalChartStyle>('donut');

  const maxSegmentCount = Math.max(1, ...segments.map((s) => s.count));

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Header Row with Title + Donut/Bar Toggle */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {title ? (
          <div className="text-xs font-semibold text-[#243B5A]">{title}</div>
        ) : (
          <div className="text-xs font-semibold text-[#243B5A]">گزارش آماری وضعیت پروژه‌ها</div>
        )}

        <div
          role="group"
          aria-label="نوع نمایش نمودار آماری"
          className="inline-flex items-center rounded-lg border border-[#E2DDD2] bg-[#F2EEE6] p-0.5"
        >
          <button
            type="button"
            onClick={() => setChartStyle('donut')}
            aria-pressed={chartStyle === 'donut'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              chartStyle === 'donut'
                ? 'bg-[#243B5A] text-[#FAF8F3]'
                : 'text-[#5B6573] hover:text-[#243B5A]'
            }`}
          >
            <PieChart className="h-3.5 w-3.5 shrink-0" />
            <span>دوناتی</span>
          </button>
          <button
            type="button"
            onClick={() => setChartStyle('bar')}
            aria-pressed={chartStyle === 'bar'}
            className={`inline-flex items-center gap-1 rounded-md px-2.5 py-1 text-[11px] font-medium transition-colors cursor-pointer ${
              chartStyle === 'bar'
                ? 'bg-[#243B5A] text-[#FAF8F3]'
                : 'text-[#5B6573] hover:text-[#243B5A]'
            }`}
          >
            <BarChart3 className="h-3.5 w-3.5 shrink-0" />
            <span>میله‌ای</span>
          </button>
        </div>
      </div>

      {/* Mode 1 (Default): Donut Chart */}
      {chartStyle === 'donut' ? (
        <div className="flex flex-1 items-center justify-center py-1">
          <StatusDonutChart
            segments={segments}
            total={total}
            selectedStatus={selectedStatus}
            onSelectStatus={interactive ? onSelectStatus : () => {}}
            centerValue={centerValue}
            centerLabel={centerLabel}
          />
        </div>
      ) : (
        /* Mode 2: Bar Chart (Status distribution bars + optional per-project progress bars) */
        <div className="space-y-3.5">
          {/* Status Distribution Horizontal Bars */}
          <div className="space-y-2">
            {segments.map((seg) => {
              const pctOfTotal = total > 0 ? Math.round((seg.count / total) * 100) : 0;
              const widthPct = seg.count > 0 ? Math.max(8, Math.round((seg.count / maxSegmentCount) * 100)) : 0;
              const active = selectedStatus === seg.status;

              const rowContent = (
                <>
                  <div className="flex items-center justify-between gap-2 text-[11px]">
                    <span className="flex min-w-0 items-center gap-1.5 font-medium text-[#263448]">
                      <span
                        className="h-2.5 w-2.5 shrink-0 rounded-full"
                        style={{ backgroundColor: seg.color }}
                      />
                      <span className="truncate">{seg.status}</span>
                    </span>
                    <span className="shrink-0 tabular-nums text-[#5B6573]">
                      {toPersianDigits(seg.count)} پروژه ({toPersianDigits(pctOfTotal)}٪)
                    </span>
                  </div>
                  <div className="mt-1 h-2.5 w-full overflow-hidden rounded-md bg-[#EAE6DC]">
                    <div
                      className="h-full rounded-md transition-all duration-300"
                      style={{
                        width: `${widthPct}%`,
                        backgroundColor: seg.color,
                      }}
                    />
                  </div>
                </>
              );

              if (!interactive) {
                return (
                  <div key={seg.status} className="rounded-lg px-2 py-1">
                    {rowContent}
                  </div>
                );
              }

              return (
                <button
                  key={seg.status}
                  type="button"
                  onClick={() => onSelectStatus(active ? 'همه' : seg.status)}
                  className={`block w-full rounded-lg border px-2 py-1.5 text-right transition-colors cursor-pointer ${
                    active
                      ? 'border-[#243B5A] bg-[#E5EBF2]/75'
                      : 'border-transparent hover:bg-[#F5F2EB]'
                  }`}
                >
                  {rowContent}
                </button>
              );
            })}
          </div>

          {/* Individual Project Progress Bars (when provided, e.g., on Dashboard) */}
          {projects && projects.length > 0 && (
            <div className="border-t border-[#E8E5DE] pt-3 space-y-2">
              <div className="flex items-center justify-between gap-2 text-[11px]">
                <span className="font-semibold text-[#243B5A]">
                  پیشرفت فیزیکی هر پروژه
                </span>
                {centerValue && (
                  <span className="tabular-nums text-[#5B6573]">
                    میانگین: <strong className="text-[#1D3250]">{centerValue}</strong>
                  </span>
                )}
              </div>

              <div className="max-h-40 space-y-2 overflow-y-auto pl-1">
                {projects.map((proj) => {
                  const pct = Math.max(0, Math.min(100, Number(proj.physicalProgress) || 0));
                  const isSelected = selectedProjectId === proj.id;
                  const barColor = STATUS_COLORS[proj.status] || '#243B5A';

                  return (
                    <button
                      key={proj.id}
                      type="button"
                      onClick={() => onSelectProject?.(proj.id)}
                      className={`block w-full rounded-lg border px-2 py-1.5 text-right transition-colors ${
                        onSelectProject ? 'cursor-pointer' : ''
                      } ${
                        isSelected
                          ? 'border-[#243B5A] bg-[#E5EBF2]/60'
                          : 'border-transparent hover:bg-[#F5F2EB]'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2 text-[11px]">
                        <span className="truncate font-medium text-[#263448]">
                          {proj.title}
                        </span>
                        <span className="shrink-0 font-semibold tabular-nums text-[#1D3250]">
                          {toPersianDigits(pct)}٪
                        </span>
                      </div>
                      <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[#EAE6DC]">
                        <div
                          className="h-full rounded-full transition-all duration-300"
                          style={{
                            width: `${Math.max(pct > 0 ? 4 : 0, pct)}%`,
                            backgroundColor: barColor,
                          }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
