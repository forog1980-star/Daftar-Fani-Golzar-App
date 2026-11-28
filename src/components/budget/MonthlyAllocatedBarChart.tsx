import React, { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { BarChart3 } from 'lucide-react';
import { PaymentRecord } from '../../types';
import { formatAmount, formatRial, toPersianDigits } from '../../utils/format';
import {
  JALALI_MONTH_NAMES,
  parseAnyDateToJalaliParts,
  todayJalaliParts,
} from '../../utils/jalali';
import { ProjectFinancialRow } from './BudgetStatusDonut';

interface MonthlyAllocatedBarChartProps {
  rows: ProjectFinancialRow[];
  payments: PaymentRecord[];
  scopeProjectId: string;
}

interface MonthlyBarPoint {
  monthIndex: number;
  monthName: string;
  allocated: number;
  paid: number;
  projectCount: number;
  projectTitles: string[];
}

function formatCompactRialAxis(value: number): string {
  if (!value || value <= 0) return '۰';
  if (value >= 1_000_000_000_000) {
    const num = value / 1_000_000_000_000;
    return `${toPersianDigits(Number.isInteger(num) ? String(num) : num.toFixed(1))} ت`;
  }
  if (value >= 1_000_000_000) {
    const num = value / 1_000_000_000;
    return `${toPersianDigits(Number.isInteger(num) ? String(num) : num.toFixed(1))} م‌د`;
  }
  if (value >= 1_000_000) {
    const num = value / 1_000_000;
    return `${toPersianDigits(Number.isInteger(num) ? String(num) : num.toFixed(1))} م`;
  }
  return toPersianDigits(Math.round(value).toLocaleString('en-US'));
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: Array<{ payload: MonthlyBarPoint }>;
  currentYear: number;
  totalAnnualAllocated: number;
}

const MonthlyChartTooltip: React.FC<CustomTooltipProps> = ({
  active,
  payload,
  currentYear,
  totalAnnualAllocated,
}) => {
  if (!active || !payload || payload.length === 0) return null;
  const item = payload[0]?.payload;
  if (!item) return null;

  const sharePct =
    totalAnnualAllocated > 0 ? Math.round((item.allocated / totalAnnualAllocated) * 100) : 0;

  return (
    <div
      dir="rtl"
      className="max-w-[260px] rounded-xl border border-[#D4CEBF] bg-[#FFFFFF] p-3 text-right text-xs shadow-[0_8px_24px_rgba(29,50,80,0.14)] space-y-1.5"
    >
      <div className="flex items-center justify-between gap-3 border-b border-[#EFECE4] pb-1.5">
        <span className="font-bold text-[#1D3250]">
          {item.monthName} {toPersianDigits(currentYear)}
        </span>
        {item.allocated > 0 && (
          <span className="rounded bg-[#FAF8F3] px-1.5 py-0.5 text-[11px] font-semibold tabular-nums text-[#8F6C24]">
            {toPersianDigits(sharePct)}٪ سال
          </span>
        )}
      </div>

      <div className="flex items-center justify-between gap-4">
        <span className="text-[#5B6573]">اعتبار تخصیص‌یافته:</span>
        <span className="font-bold tabular-nums text-[#243B5A]">
          {formatRial(item.allocated)}
        </span>
      </div>

      {item.paid > 0 && (
        <div className="flex items-center justify-between gap-4">
          <span className="text-[#5B6573]">پرداخت‌شده این ماه:</span>
          <span className="font-semibold tabular-nums text-[#2D6A4F]">
            {formatRial(item.paid)}
          </span>
        </div>
      )}

      {item.projectTitles.length > 0 && (
        <div className="border-t border-[#EFECE4] pt-1.5 text-[11px] text-[#5B6573]">
          <div className="font-medium text-[#263448]">
            پروژه‌های دارای تخصیص ({toPersianDigits(item.projectCount)}):
          </div>
          <ul className="mt-0.5 space-y-0.5 text-[10.5px] text-[#5B6573]">
            {item.projectTitles.slice(0, 3).map((title) => (
              <li key={title} className="truncate">
                • {title}
              </li>
            ))}
            {item.projectTitles.length > 3 && (
              <li className="text-[#788290]">
                و {toPersianDigits(item.projectTitles.length - 3)} پروژه دیگر...
              </li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
};

export const MonthlyAllocatedBarChart: React.FC<MonthlyAllocatedBarChartProps> = ({
  rows,
  payments,
  scopeProjectId,
}) => {
  const currentYear = useMemo(() => todayJalaliParts().jy, []);

  const scopedRows = useMemo(
    () =>
      scopeProjectId === 'همه'
        ? rows
        : rows.filter((r) => r.project.id === scopeProjectId),
    [rows, scopeProjectId]
  );

  const selectedProjectTitle = useMemo(() => {
    if (scopeProjectId === 'همه') return 'همه پروژه‌های سال جاری';
    const found = rows.find((r) => r.project.id === scopeProjectId);
    return found ? found.project.title : 'پروژه انتخاب‌شده';
  }, [rows, scopeProjectId]);

  const monthlyData = useMemo<MonthlyBarPoint[]>(() => {
    const buckets: MonthlyBarPoint[] = JALALI_MONTH_NAMES.map((monthName, idx) => ({
      monthIndex: idx + 1,
      monthName,
      allocated: 0,
      paid: 0,
      projectCount: 0,
      projectTitles: [],
    }));

    for (const row of scopedRows) {
      const { budget, project } = row;
      const monthlyMap = budget.monthlyAllocations;
      const monthlyValues = monthlyMap
        ? Object.entries(monthlyMap).filter(([, val]) => Number(val) > 0)
        : [];

      if (
        monthlyValues.length > 0 &&
        (!budget.allocationYear || budget.allocationYear === currentYear)
      ) {
        for (const [mStr, val] of monthlyValues) {
          const m = Number(mStr);
          const amount = Number(val) || 0;
          if (m >= 1 && m <= 12 && amount > 0) {
            const bucket = buckets[m - 1];
            bucket.allocated += amount;
            if (!bucket.projectTitles.includes(project.title)) {
              bucket.projectTitles.push(project.title);
              bucket.projectCount += 1;
            }
          }
        }
        continue;
      }

      if ((budget.allocatedCredit || 0) <= 0) continue;

      const candidateDates = [
        budget.allocationDate,
        project.notificationDate,
        project.contractDate,
        project.ceoOrderDate,
        budget.updatedAt,
        budget.createdAt,
      ];

      let matchedMonth: number | null = null;
      for (const dStr of candidateDates) {
        const parsed = parseAnyDateToJalaliParts(dStr);
        if (parsed && parsed.jy === currentYear) {
          matchedMonth = parsed.jm;
          break;
        }
      }

      if (matchedMonth && matchedMonth >= 1 && matchedMonth <= 12) {
        const bucket = buckets[matchedMonth - 1];
        bucket.allocated += budget.allocatedCredit;
        if (!bucket.projectTitles.includes(project.title)) {
          bucket.projectTitles.push(project.title);
          bucket.projectCount += 1;
        }
      }
    }

    for (const pay of payments) {
      if (scopeProjectId !== 'همه' && pay.projectId !== scopeProjectId) continue;
      const parsed = parseAnyDateToJalaliParts(pay.date);
      if (parsed && parsed.jy === currentYear && parsed.jm >= 1 && parsed.jm <= 12) {
        buckets[parsed.jm - 1].paid += pay.amount || 0;
      }
    }

    return buckets;
  }, [scopedRows, payments, scopeProjectId, currentYear]);

  const summary = useMemo(() => {
    const totalAllocated = monthlyData.reduce((sum, m) => sum + m.allocated, 0);
    const activeMonths = monthlyData.filter((m) => m.allocated > 0);
    let peakMonth: MonthlyBarPoint | null = null;
    for (const m of activeMonths) {
      if (!peakMonth || m.allocated > peakMonth.allocated) {
        peakMonth = m;
      }
    }
    return {
      totalAllocated,
      activeMonthsCount: activeMonths.length,
      peakMonth,
    };
  }, [monthlyData]);

  return (
    <section
      aria-label="نمودار ستونی مقایسه اعتبارات تخصیص‌یافته در ماه‌های سال جاری"
      className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 shadow-[0_2px_8px_rgba(29,50,80,0.04)] sm:p-5 space-y-4"
    >
      {/* Header + Summary Metrics */}
      <div className="flex flex-col gap-3 border-b border-[#EFECE4] pb-3.5 lg:flex-row lg:items-center lg:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#FAF8F3] border border-[#E2DDD0] text-[#243B5A]">
              <BarChart3 className="h-4 w-4 text-[#B99A62]" />
            </span>
            <div>
              <h2 className="text-sm font-bold text-[#1D3250]">
                مقایسه اعتبارات تخصیص‌یافته در ماه‌های سال {toPersianDigits(currentYear)}
              </h2>
              <p className="text-[11px] text-[#5B6573]">
                محدوده نمایش: {selectedProjectTitle} (بر حسب ریال)
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3 text-xs">
          <div className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] px-3 py-1.5">
            <span className="text-[#788290]">جمع تخصیص سال جاری: </span>
            <strong className="tabular-nums text-[#1D3250]">
              {formatAmount(summary.totalAllocated)} ریال
            </strong>
          </div>

          <div className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] px-3 py-1.5">
            <span className="text-[#788290]">پربودجه‌ترین ماه: </span>
            <strong className="tabular-nums text-[#8F6C24]">
              {summary.peakMonth
                ? `${summary.peakMonth.monthName} (${formatAmount(summary.peakMonth.allocated)})`
                : 'ثبت‌نشده'}
            </strong>
          </div>

          <div className="rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] px-3 py-1.5">
            <span className="text-[#788290]">ماه‌های دارای تخصیص: </span>
            <strong className="tabular-nums text-[#243B5A]">
              {toPersianDigits(summary.activeMonthsCount)} از ۱۲ ماه
            </strong>
          </div>
        </div>
      </div>

      {/* Recharts BarChart */}
      {summary.totalAllocated === 0 ? (
        <div className="flex h-56 flex-col items-center justify-center rounded-xl border border-dashed border-[#DFD8CA] bg-[#FAF8F3] px-4 text-center text-xs text-[#788290] space-y-1.5">
          <div>
            هنوز اعتبار تخصیص‌یافته‌ای برای سال {toPersianDigits(currentYear)} در این محدوده ثبت نشده است.
          </div>
          <div className="text-[11px]">
            از بخش «ویرایش مالی» در جدول پایین می‌توانید مبلغ تخصیص و تفکیک ماهانه هر پروژه را ثبت کنید.
          </div>
        </div>
      ) : (
        <div className="space-y-2.5">
          <div className="h-[270px] w-full" dir="ltr">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart
                data={monthlyData}
                margin={{ top: 12, right: 12, left: 8, bottom: 8 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="#ECE7DC" vertical={false} />
                <XAxis
                  dataKey="monthName"
                  reversed
                  interval={0}
                  tick={{ fill: '#5B6268', fontSize: 11 }}
                  axisLine={{ stroke: '#DFD8CA' }}
                  tickLine={false}
                  height={38}
                />
                <YAxis
                  width={64}
                  tickFormatter={formatCompactRialAxis}
                  tick={{ fill: '#5B6268', fontSize: 11 }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  cursor={{ fill: 'rgba(229, 235, 242, 0.45)' }}
                  content={
                    <MonthlyChartTooltip
                      currentYear={currentYear}
                      totalAnnualAllocated={summary.totalAllocated}
                    />
                  }
                />
                <Bar
                  dataKey="allocated"
                  name="اعتبار تخصیص‌یافته"
                  radius={[6, 6, 0, 0]}
                  maxBarSize={38}
                >
                  {monthlyData.map((entry) => {
                    const isPeak =
                      summary.peakMonth !== null &&
                      entry.monthIndex === summary.peakMonth.monthIndex &&
                      entry.allocated > 0;
                    return (
                      <Cell
                        key={`cell-${entry.monthIndex}`}
                        fill={
                          entry.allocated <= 0
                            ? '#EAE5D9'
                            : isPeak
                              ? '#243B5A'
                              : '#C9A44C'
                        }
                      />
                    );
                  })}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Clean Legend */}
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#5B6573]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#243B5A]" />
                <span>بیشترین تخصیص ماهانه</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="h-2.5 w-2.5 rounded-sm bg-[#C9A44C]" />
                <span>سایر ماه‌های دارای تخصیص</span>
              </span>
            </div>
            <span>
              مبنای ماه: تفکیک ماهانه ثبت‌شده یا تاریخ تخصیص/ابلاغ پروژه در سال{' '}
              {toPersianDigits(currentYear)}
            </span>
          </div>
        </div>
      )}
    </section>
  );
};
