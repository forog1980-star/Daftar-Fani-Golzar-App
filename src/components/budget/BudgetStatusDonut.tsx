import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PieChart, X } from 'lucide-react';
import { LetterheadConfig, Project, ProjectBudget } from '../../types';
import { formatAmount, formatRial, todayIsoDate, toPersianDigits } from '../../utils/format';
import { ExportDonutChartData, ExportTablePayload } from '../../utils/exportEngine';

export interface ProjectFinancialRow {
  project: Project;
  budget: ProjectBudget;
  paidAmount: number;
  remainingCredit: number;
  usagePercent: number;
  fundingPercent: number;
  physicalToFundingRatio: number;
}

interface BudgetStatusDonutProps {
  rows: ProjectFinancialRow[];
  scopeProjectId: string;
  onScopeChange: (projectId: string) => void;
}

type DonutSegmentKey = 'allocated' | 'spent' | 'remaining';

interface DonutSliceDef {
  key: DonutSegmentKey;
  label: string;
  shortLabel: string;
  value: number;
  color: string;
  explanation: string;
}

export function computeBudgetScopeMetrics(scopedRows: ProjectFinancialRow[]) {
  const approved = scopedRows.reduce((s, r) => s + (r.budget.approvedCredit || 0), 0);
  const allocated = scopedRows.reduce((s, r) => s + (r.budget.allocatedCredit || 0), 0);
  const funded = scopedRows.reduce((s, r) => s + (r.budget.fundedCredit || 0), 0);
  const committed = scopedRows.reduce((s, r) => s + (r.budget.committedAmount || 0), 0);
  const spent = scopedRows.reduce((s, r) => s + (r.paidAmount || 0), 0);
  const rawRemaining = scopedRows.reduce((s, r) => s + r.remainingCredit, 0);
  const positiveRemaining = Math.max(0, rawRemaining);

  const effectiveAllocated = allocated > 0 ? allocated : funded > 0 ? funded : approved;
  const totalBudget = approved > 0 ? approved : effectiveAllocated;
  const baseCredit = funded > 0 ? funded : totalBudget;
  const usagePct = baseCredit > 0 ? Math.round((spent / baseCredit) * 100) : 0;
  const allocationPct = totalBudget > 0 ? Math.round((effectiveAllocated / totalBudget) * 100) : 0;
  const remainingPct =
    baseCredit > 0 ? Math.max(0, Math.round((positiveRemaining / baseCredit) * 100)) : 0;

  return {
    totalBudget,
    approved,
    allocated: effectiveAllocated,
    funded,
    committed,
    spent,
    rawRemaining,
    positiveRemaining,
    baseCredit,
    usagePct,
    allocationPct,
    remainingPct,
  };
}

export function buildBudgetReportPayload(
  rows: ProjectFinancialRow[],
  scopeProjectId: string,
  letterhead: LetterheadConfig
): { payload: ExportTablePayload; slug: string } {
  const scopedRows =
    scopeProjectId === 'همه'
      ? rows
      : rows.filter((r) => r.project.id === scopeProjectId);

  const selectedProject =
    scopeProjectId === 'همه'
      ? null
      : rows.find((r) => r.project.id === scopeProjectId)?.project ?? null;

  const metrics = computeBudgetScopeMetrics(scopedRows);

  const scopeTitle = selectedProject
    ? `گزارش وضعیت بودجه پروژه: ${selectedProject.title}`
    : 'گزارش جامع وضعیت بودجه دفتر فنی';

  const statusDesc =
    metrics.rawRemaining < 0
      ? `کسری اعتبار به میزان ${formatRial(Math.abs(metrics.rawRemaining))}`
      : `باقیمانده قابل مصرف به میزان ${formatRial(metrics.rawRemaining)}`;

  const narrativeParagraphs = [
    selectedProject
      ? `این گزارش وضعیت بودجه پروژه «${selectedProject.title}» (کد ${selectedProject.code}) را در چهار شاخص اصلی بودجه کل، تخصیص‌یافته، هزینه‌شده و باقیمانده ارائه می‌دهد.`
      : `این گزارش وضعیت جامع بودجه ${toPersianDigits(scopedRows.length)} پرونده پروژه دفتر فنی اداره گلزار شهدا را بر مبنای داده‌های واقعی ثبت‌شده ارائه می‌دهد.`,
    `بودجه کل مصوب برابر با ${formatRial(metrics.totalBudget)} و مبلغ تخصیص‌یافته معادل ${formatRial(metrics.allocated)} (${toPersianDigits(metrics.allocationPct)} درصد بودجه کل) است.`,
    `تا تاریخ تهیه گزارش، مبلغ هزینه‌شده (پرداخت‌شده) معادل ${formatRial(metrics.spent)} (${toPersianDigits(metrics.usagePct)} درصد اعتبار مبنا) بوده و وضعیت نهایی دارای ${statusDesc} است.`,
  ];

  const donutChartData: ExportDonutChartData = {
    title: 'نمودار دوناتی وضعیت بودجه (تخصیص‌یافته، هزینه‌شده و باقیمانده — مبالغ به ریال)',
    centerLabel: 'درصد هزینه‌شده',
    centerValue: `${toPersianDigits(metrics.usagePct)}٪`,
    segments: [
      {
        label: 'تخصیص‌یافته',
        value: metrics.allocated,
        formattedValue: formatAmount(metrics.allocated),
        percentText: `${toPersianDigits(metrics.allocationPct)}٪`,
        color: '#E6CA80',
      },
      {
        label: 'هزینه‌شده',
        value: metrics.spent,
        formattedValue: formatAmount(metrics.spent),
        percentText: `${toPersianDigits(metrics.usagePct)}٪`,
        color: '#6E9E89',
      },
      {
        label: 'باقیمانده',
        value: metrics.positiveRemaining,
        formattedValue: formatAmount(metrics.rawRemaining),
        percentText: `${toPersianDigits(metrics.remainingPct)}٪`,
        color: '#3F5D7D',
      },
    ],
  };

  const payload: ExportTablePayload = {
    title: scopeTitle,
    documentNumber: `ب-${Math.floor(100 + Math.random() * 899)}`,
    date: todayIsoDate(),
    letterhead: {
      ...letterhead,
      showDateAndNumber: true,
    },
    narrativeParagraphs,
    donutChartData,
    summaryRows: [
      { label: 'بودجه کل (ریال)', value: formatAmount(metrics.totalBudget) },
      { label: 'تخصیص‌یافته (ریال)', value: formatAmount(metrics.allocated) },
      { label: 'هزینه‌شده (ریال)', value: formatAmount(metrics.spent) },
      { label: 'باقیمانده (ریال)', value: formatAmount(metrics.rawRemaining) },
      { label: 'درصد هزینه‌شده', value: `${toPersianDigits(metrics.usagePct)} درصد` },
    ],
    headers: [
      'کد پروژه',
      'عنوان پروژه',
      'بودجه کل (ریال)',
      'تخصیص‌یافته (ریال)',
      'هزینه‌شده (ریال)',
      'باقیمانده (ریال)',
      'درصد هزینه‌شده',
    ],
    rows: scopedRows.map((r) => [
      r.project.code,
      r.project.title,
      formatAmount(r.budget.approvedCredit),
      formatAmount(r.budget.allocatedCredit || r.budget.fundedCredit),
      formatAmount(r.paidAmount),
      formatAmount(r.remainingCredit),
      `${toPersianDigits(r.usagePercent.toFixed(1))}٪`,
    ]),
  };

  const slug = selectedProject
    ? `budget-report-${selectedProject.code}-${todayIsoDate()}`
    : `budget-status-report-${todayIsoDate()}`;

  return { payload, slug };
}

export const BudgetStatusDonut: React.FC<BudgetStatusDonutProps> = ({
  rows,
  scopeProjectId,
  onScopeChange,
}) => {
  // Separate hover/touch-hold transient state from desktop click pinned state
  const [hoverOrHoldKey, setHoverOrHoldKey] = useState<DonutSegmentKey | null>(null);
  const [pinnedKey, setPinnedKey] = useState<DonutSegmentKey | null>(null);
  const isTouchHoldingRef = useRef(false);
  const donutContainerRef = useRef<HTMLDivElement | null>(null);

  const activeKey = hoverOrHoldKey ?? pinnedKey;

  useEffect(() => {
    if (!pinnedKey) return;
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        donutContainerRef.current &&
        !donutContainerRef.current.contains(event.target as Node)
      ) {
        setPinnedKey(null);
      }
    };
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setPinnedKey(null);
        setHoverOrHoldKey(null);
      }
    };
    document.addEventListener('mousedown', handleOutsideClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handleOutsideClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [pinnedKey]);

  const scopedRows = useMemo(
    () =>
      scopeProjectId === 'همه'
        ? rows
        : rows.filter((r) => r.project.id === scopeProjectId),
    [rows, scopeProjectId]
  );

  const metrics = useMemo(() => computeBudgetScopeMetrics(scopedRows), [scopedRows]);

  const slices = useMemo<DonutSliceDef[]>(
    () => [
      {
        key: 'allocated',
        label: 'تخصیص‌یافته',
        shortLabel: 'تخصیص‌یافته',
        value: metrics.allocated,
        color: '#C9A44C',
        explanation: 'میزان اعتبار تخصیص‌یافته از بودجه کل برای اجرا و تأمین پروژه‌ها',
      },
      {
        key: 'spent',
        label: 'هزینه‌شده',
        shortLabel: 'هزینه‌شده',
        value: metrics.spent,
        color: '#2D6A4F',
        explanation: 'جمع مبالغ پرداخت‌شده و هزینه‌شده ثبت‌شده در سوابق مالی',
      },
      {
        key: 'remaining',
        label: 'باقیمانده',
        shortLabel: 'باقیمانده',
        value: metrics.positiveRemaining,
        color: '#243B5A',
        explanation:
          metrics.rawRemaining < 0
            ? 'اعتبار پروژه دارای کسری نسبت به هزینه‌های انجام‌شده است'
            : 'مانده اعتبار قابل مصرف پس از کسر هزینه‌های ثبت‌شده',
      },
    ],
    [metrics]
  );

  const donutTotal = useMemo(
    () => slices.reduce((sum, s) => sum + Math.max(0, s.value), 0),
    [slices]
  );

  const radius = 78;
  const strokeWidth = 28;
  const circumference = 2 * Math.PI * radius;

  const arcSegments = useMemo(() => {
    let offsetAcc = 0;
    return slices.map((slice) => {
      const ratio = donutTotal > 0 ? Math.max(0, slice.value) / donutTotal : 0;
      const dashLen = ratio * circumference;
      const currentOffset = offsetAcc;
      offsetAcc += dashLen;
      const pct =
        slice.key === 'allocated'
          ? metrics.allocationPct
          : slice.key === 'spent'
            ? metrics.usagePct
            : metrics.remainingPct;
      return {
        ...slice,
        ratio,
        dashLen,
        offset: currentOffset,
        percentLabel: `${toPersianDigits(pct)}٪`,
      };
    });
  }, [slices, donutTotal, circumference, metrics.allocationPct, metrics.usagePct, metrics.remainingPct]);

  const activeSlice = activeKey ? arcSegments.find((s) => s.key === activeKey) ?? null : null;

  // Ordered summary items strictly as requested: بودجه کل -> تخصیص‌یافته -> هزینه‌شده -> باقیمانده
  const orderedSummaryItems = [
    {
      id: 'total',
      label: 'بودجه کل',
      value: formatAmount(metrics.totalBudget),
      badge: '۱۰۰٪',
      dotColor: '#6C7A89',
      valueColor: 'text-[#1D3250]',
    },
    {
      id: 'allocated',
      label: 'تخصیص‌یافته',
      value: formatAmount(metrics.allocated),
      badge: `${toPersianDigits(metrics.allocationPct)}٪`,
      dotColor: '#C9A44C',
      valueColor: 'text-[#8B6B2E]',
    },
    {
      id: 'spent',
      label: 'هزینه‌شده',
      value: formatAmount(metrics.spent),
      badge: `${toPersianDigits(metrics.usagePct)}٪`,
      dotColor: '#2D6A4F',
      valueColor: 'text-[#2D6A4F]',
    },
    {
      id: 'remaining',
      label: 'باقیمانده',
      value: formatAmount(metrics.rawRemaining),
      badge: `${toPersianDigits(metrics.remainingPct)}٪`,
      dotColor: '#243B5A',
      valueColor: metrics.rawRemaining < 0 ? 'text-[#B43E3E]' : 'text-[#243B5A]',
    },
  ];

  const handleTouchMoveOnDonut = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!isTouchHoldingRef.current || e.pointerType === 'mouse') return;
    const hitEl = document.elementFromPoint(e.clientX, e.clientY);
    const segKey = hitEl?.getAttribute('data-donut-segment') as DonutSegmentKey | null;
    if (segKey === 'allocated' || segKey === 'spent' || segKey === 'remaining') {
      setHoverOrHoldKey(segKey);
    }
  };

  return (
    <section
      aria-label="نمودار دوناتی وضعیت بودجه"
      className="rounded-2xl border border-[#E2DDD0] bg-[#FFFFFF] p-4 sm:p-5 shadow-[0_2px_8px_rgba(29,50,80,0.04)] space-y-4"
    >
      {/* Clean, Uncluttered Header */}
      <div className="flex flex-col gap-2.5 border-b border-[#EFECE4] pb-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl bg-[#EEF3F9] text-[#243B5A]">
            <PieChart className="h-4 w-4" />
          </div>
          <h2 className="text-sm font-bold text-[#1D3250]">
            نمای دوناتی وضعیت بودجه <span className="font-normal text-[#5B6573]">(ارقام به ریال)</span>
          </h2>
        </div>

        <select
          value={scopeProjectId}
          onChange={(e) => {
            onScopeChange(e.target.value);
            setPinnedKey(null);
            setHoverOrHoldKey(null);
          }}
          aria-label="انتخاب دامنه وضعیت بودجه"
          className="h-9 w-full rounded-xl border border-[#D4CEBF] bg-[#FAF8F3] px-3 text-xs text-[#263448] focus:border-[#243B5A] focus:outline-none sm:w-auto sm:max-w-[260px]"
        >
          <option value="همه">کل پروژه‌های دفتر فنی ({toPersianDigits(rows.length)})</option>
          {rows.map((r) => (
            <option key={r.project.id} value={r.project.id}>
              {r.project.code} — {r.project.title}
            </option>
          ))}
        </select>
      </div>

      {/* Donut Chart + Passive Ordered Summary Rows */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 lg:items-center">
        {/* Interactive Donut with Compact Floating Tooltip (Touch Hold + Desktop Click/Hover) */}
        <div
          ref={donutContainerRef}
          className="relative flex flex-col items-center justify-center pt-3 pb-1 lg:col-span-5"
        >
          {/* Compact Floating Mini-Tooltip (Explains ONLY the active slice; Zero Layout Shift) */}
          {activeSlice && (
            <div
              role="tooltip"
              className={`absolute -top-2 left-1/2 z-20 w-[min(92%,268px)] -translate-x-1/2 rounded-xl border border-[#C9A44C]/55 bg-[#1D3250] px-3 py-2.5 text-[#FAF8F3] shadow-[0_10px_24px_rgba(29,50,80,0.26)] ${
                pinnedKey && !hoverOrHoldKey ? 'pointer-events-auto' : 'pointer-events-none'
              }`}
            >
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="h-2.5 w-2.5 shrink-0 rounded-full"
                    style={{ backgroundColor: activeSlice.color }}
                  />
                  <span className="truncate text-xs font-bold">{activeSlice.label}</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <span className="rounded-md bg-[#FAF8F3]/15 px-1.5 py-0.5 text-[11px] font-semibold tabular-nums">
                    {activeSlice.percentLabel}
                  </span>
                  {pinnedKey && (
                    <button
                      type="button"
                      onClick={() => {
                        setPinnedKey(null);
                        setHoverOrHoldKey(null);
                      }}
                      aria-label="بستن پنجره وضعیت"
                      className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-[#FAF8F3]/15 text-[#FAF8F3] hover:bg-[#FAF8F3]/25 cursor-pointer"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </div>
              </div>
              <div className="mt-1 text-xs font-semibold tabular-nums text-[#F6E4B0]">
                {formatRial(
                  activeSlice.key === 'remaining' ? metrics.rawRemaining : activeSlice.value
                )}
              </div>
              <p className="mt-0.5 text-[10px] leading-4 text-[#D6E0EC]">
                {activeSlice.explanation}
              </p>
            </div>
          )}

          <div
            className="relative flex items-center justify-center touch-none select-none"
            onPointerMove={handleTouchMoveOnDonut}
            onPointerLeave={(e) => {
              if (e.pointerType === 'mouse') {
                setHoverOrHoldKey(null);
              }
            }}
            onPointerUp={(e) => {
              if (e.pointerType !== 'mouse') {
                isTouchHoldingRef.current = false;
                setHoverOrHoldKey(null);
              }
            }}
            onPointerCancel={() => {
              isTouchHoldingRef.current = false;
              setHoverOrHoldKey(null);
            }}
          >
            <svg
              viewBox="0 0 220 220"
              className="h-52 w-52 sm:h-56 sm:w-56 overflow-visible"
              role="img"
              aria-label="نمودار دوناتی وضعیت بودجه"
            >
              {/* Base Track */}
              <circle
                cx="110"
                cy="110"
                r={radius}
                fill="none"
                stroke="#EFECE4"
                strokeWidth={strokeWidth}
              />

              {/* Donut Segments */}
              {donutTotal > 0 &&
                arcSegments.map((seg) => {
                  const isSelected = activeKey === seg.key;
                  return (
                    <circle
                      key={seg.key}
                      data-donut-segment={seg.key}
                      cx="110"
                      cy="110"
                      r={radius}
                      fill="none"
                      stroke={seg.color}
                      strokeWidth={isSelected ? strokeWidth + 5 : strokeWidth}
                      strokeDasharray={`${Math.max(0, seg.dashLen - 2)} ${circumference}`}
                      strokeDashoffset={-seg.offset}
                      transform="rotate(-90 110 110)"
                      tabIndex={0}
                      role="button"
                      aria-label={`${seg.label}: ${formatRial(
                        seg.key === 'remaining' ? metrics.rawRemaining : seg.value
                      )} (${seg.percentLabel})`}
                      className="cursor-pointer outline-none transition-all duration-150"
                      style={{
                        opacity: activeKey && !isSelected ? 0.45 : 1,
                      }}
                      onPointerEnter={(e) => {
                        if (e.pointerType === 'mouse') {
                          setHoverOrHoldKey(seg.key);
                        }
                      }}
                      onPointerDown={(e) => {
                        if (e.pointerType !== 'mouse') {
                          e.preventDefault();
                          isTouchHoldingRef.current = true;
                          setPinnedKey(null);
                          setHoverOrHoldKey(seg.key);
                        }
                      }}
                      onClick={(e) => {
                        e.stopPropagation();
                        setPinnedKey((prev) => (prev === seg.key ? null : seg.key));
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setPinnedKey((prev) => (prev === seg.key ? null : seg.key));
                        }
                      }}
                    />
                  );
                })}

              {/* Center Circle */}
              <circle
                cx="110"
                cy="110"
                r={radius - strokeWidth / 2 - 4}
                fill="#FFFFFF"
                stroke="#E8E4DA"
                strokeWidth="1"
                onClick={() => {
                  setPinnedKey(null);
                  setHoverOrHoldKey(null);
                }}
              />
            </svg>

            {/* Center Text Overlay */}
            <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center px-6">
              {activeSlice ? (
                <>
                  <span className="text-[11px] font-medium text-[#5B6573]">
                    {activeSlice.shortLabel}
                  </span>
                  <span
                    className="mt-0.5 text-lg font-bold tabular-nums"
                    style={{ color: activeSlice.color }}
                  >
                    {activeSlice.percentLabel}
                  </span>
                </>
              ) : (
                <>
                  <span className="text-[11px] text-[#788290]">هزینه‌شده</span>
                  <span className="mt-0.5 text-xl font-bold tabular-nums text-[#1D3250]">
                    {toPersianDigits(metrics.usagePct)}٪
                  </span>
                  <span className="mt-0.5 text-[10px] text-[#788290]">لمس یا کلیک روی هر بخش</span>
                </>
              )}
            </div>
          </div>
        </div>

        {/* Ordered Passive Summary List: بودجه کل -> تخصیص‌یافته -> هزینه‌شده -> باقیمانده */}
        <div className="space-y-2 lg:col-span-7">
          {orderedSummaryItems.map((item) => (
            <div
              key={item.id}
              className="flex items-center justify-between gap-3 rounded-xl border border-[#ECE7DC] bg-[#FAF8F3] px-4 py-3"
            >
              <div className="flex items-center gap-2.5 min-w-0">
                <span
                  className="h-3 w-3 shrink-0 rounded-full"
                  style={{ backgroundColor: item.dotColor }}
                />
                <span className="text-xs font-bold text-[#1D3250]">{item.label}</span>
              </div>
              <div className="flex items-center gap-2.5 shrink-0">
                <span className={`text-sm font-bold tabular-nums ${item.valueColor}`}>
                  {item.value}
                </span>
                <span className="min-w-[42px] rounded-md border border-[#E2DDD0] bg-[#FFFFFF] px-2 py-0.5 text-center text-[11px] font-semibold tabular-nums text-[#5B6573]">
                  {item.badge}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};
