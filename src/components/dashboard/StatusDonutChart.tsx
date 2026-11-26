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
  centerValue?: string;
  centerLabel?: string;
}

// Calm, clearly distinguishable administrative colors aligned with the approved dashboard mockup
export const STATUS_COLORS: Record<ProjectStatus, string> = {
  'در حال اجرا': '#4B8EE2',
  'تکمیل‌شده': '#5CA374',
  'دارای مشکل': '#E5A24C',
  'متوقف': '#C2C6CC',
  'شروع‌نشده': '#7C8EA6',
};

export const StatusDonutChart: React.FC<StatusDonutChartProps> = ({
  segments,
  total,
  selectedStatus,
  onSelectStatus,
  centerValue,
  centerLabel = 'کل پروژه‌ها',
}) => {
  const size = 168;
  const strokeWidth = 28;
  const center = size / 2;
  const radius = center - strokeWidth / 2 - 4;
  const circumference = 2 * Math.PI * radius;

  const nonZero = segments.filter((s) => s.count > 0);
  let cumulativeFraction = 0;

  return (
    <div className="flex w-full flex-col items-center gap-4 sm:flex-row sm:items-center sm:justify-between">
      {/* Interactive Legend (RTL start = right side, matching mockup) */}
      <div className="order-2 w-full flex-1 space-y-1.5 sm:order-1">
        {segments.map((seg) => {
          const active = selectedStatus === seg.status;
          return (
            <button
              key={seg.status}
              type="button"
              onClick={() => onSelectStatus(active ? 'همه' : seg.status)}
              className={`flex w-full items-center justify-between gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                active
                  ? 'border-[#243B5A] bg-[#E5EBF2] font-medium text-[#243B5A]'
                  : 'border-transparent bg-transparent text-[#263448] hover:bg-[#F5F2EB]'
              }`}
            >
              <span className="flex items-center gap-2 min-w-0">
                <span
                  className="h-2.5 w-2.5 shrink-0 rounded-full"
                  style={{ backgroundColor: seg.color }}
                />
                <span className="truncate">{seg.status}</span>
              </span>
              <span className="shrink-0 tabular-nums text-[11px] text-[#5B6573]">
                {toPersianDigits(seg.count)}
              </span>
            </button>
          );
        })}
      </div>

      {/* SVG Donut Ring */}
      <div className="relative order-1 flex shrink-0 items-center justify-center sm:order-2">
        <svg
          width={size}
          height={size}
          viewBox={`0 0 ${size} ${size}`}
          role="img"
          aria-label="نمودار وضعیت پروژه‌ها"
        >
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
                  strokeDasharray={`${Math.max(0, dashLength - 1)} ${circumference}`}
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
          <span className="text-2xl font-bold tabular-nums text-[#1D3250]">
            {centerValue ?? toPersianDigits(total)}
          </span>
          <span className="mt-0.5 text-[11px] text-[#5B6573]">{centerLabel}</span>
        </button>
      </div>
    </div>
  );
};
