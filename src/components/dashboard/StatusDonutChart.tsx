import React from 'react';
import { ProjectStatus } from '../../types';
import { toPersianDigits } from '../../utils/format';

export interface StatusSegment {
  status: ProjectStatus;
  count: number;
  color: string;
}

interface StatusDonutChartProps {
  segments: StatusSegment[];
  total: number;
  selectedStatus: ProjectStatus | 'همه';
  onSelectStatus: (status: ProjectStatus | 'همه') => void;
}

export const STATUS_COLORS: Record<ProjectStatus, string> = {
  'در حال اجرا': '#243B5A', // Primary Navy
  'شروع‌نشده': '#8E99A8', // Calm cool gray
  'دارای مشکل': '#A65252', // Muted administrative crimson
  'متوقف': '#B99A62', // Matte gold
  'تکمیل‌شده': '#5B7C6F', // Soft sage green
};

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({
  segments,
  total,
  selectedStatus,
  onSelectStatus,
}) => {
  const size = 188;
  const strokeWidth = 26;
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  const nonZero = segments.filter((s) => s.count > 0);
  let cumulativeFraction = 0;

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="relative flex shrink-0 items-center justify-center">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="نمودار وضعیت پروژه‌ها"
        >
          {/* Base track */}
          <circle
            cx={center}
            cy={center}
            r={radius}
            fill="none"
            stroke="#E8E5DE"
            strokeWidth={strokeWidth}
          />
          {total > 0 &&
            nonZero.map((seg) => {
              const fraction = seg.count / total;
              const dashLength = fraction * circumference;
              const dashOffset = -cumulativeFraction * circumference;
              cumulativeFraction += fraction;
              const isSelected = selectedStatus === seg.status;
              return (
                <circle
                  key={seg.status}
                  cx={center}
                  cy={center}
                  r={radius}
                  fill="none"
                  stroke={seg.color}
                  strokeWidth={isSelected ? strokeWidth + 4 : strokeWidth}
                  strokeDasharray={`${Math.max(0, dashLength - 1.5)} ${circumference}`}
                  strokeDashoffset={dashOffset}
                  transform={`rotate(-90 ${center} ${center})`}
                  className="cursor-pointer transition-all duration-200"
                  onClick={() =>
                    onSelectStatus(selectedStatus === seg.status ? 'همه' : seg.status)
                  }
                />
              );
            })}
        </svg>

        <button
          type="button"
          onClick={() => onSelectStatus('همه')}
          className="absolute inset-0 m-auto flex h-24 w-24 flex-col items-center justify-center rounded-full text-center cursor-pointer"
          title="نمایش همه وضعیت‌ها"
        >
          <span className="text-2xl font-semibold tabular-nums text-[#243B5A]">
            {toPersianDigits(total)}
          </span>
          <span className="text-[11px] text-[#5B6573]">کل پروژه‌ها</span>
        </button>
      </div>

      {/* Interactive Legend */}
      <div className="w-full flex-1 space-y-1.5">
        {segments.map((seg) => {
          const pct = total > 0 ? Math.round((seg.count / total) * 100) : 0;
          const active = selectedStatus === seg.status;
          return (
            <button
              key={seg.status}
              type="button"
              onClick={() => onSelectStatus(active ? 'همه' : seg.status)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-1.5 text-xs transition-colors cursor-pointer ${
                active
                  ? 'border-[#243B5A] bg-[#E5EBF2] font-medium text-[#243B5A]'
                  : 'border-transparent bg-[#FAF8F3] text-[#263448] hover:border-[#E8E5DE]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-sm"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate">{seg.status}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[#5B6573]">
                {toPersianDigits(seg.count)} ({toPersianDigits(pct)}٪)
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
};
