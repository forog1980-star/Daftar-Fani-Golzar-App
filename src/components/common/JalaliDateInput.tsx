import React, { useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Calendar, ChevronLeft, ChevronRight, X } from 'lucide-react';
import {
  getJalaliMonthFirstWeekday,
  JALALI_MONTH_NAMES,
  JALALI_WEEKDAY_SHORT,
  jalaliMonthLength,
  jalaliPartsToIso,
  jalaliPartsToString,
  parseAnyDateToJalaliParts,
  parseJalaliInputToIso,
  todayJalaliParts,
} from '../../utils/jalali';
import { todayIsoDate, toPersianDigits } from '../../utils/format';

interface JalaliDateInputProps {
  value: string;
  onChange: (isoDate: string) => void;
  disabled?: boolean;
  required?: boolean;
  placeholder?: string;
  className?: string;
  compact?: boolean;
  allowClear?: boolean;
  ariaLabel?: string;
}

export const JalaliDateInput: React.FC<JalaliDateInputProps> = ({
  value,
  onChange,
  disabled = false,
  required = false,
  placeholder = 'انتخاب تاریخ شمسی (۱۴۰۵/۰۱/۰۱)',
  className = '',
  compact = false,
  allowClear,
  ariaLabel,
}) => {
  const canClear = allowClear ?? !required;
  const parsed = useMemo(() => parseAnyDateToJalaliParts(value), [value]);
  const today = useMemo(() => todayJalaliParts(), []);

  const [open, setOpen] = useState(false);
  const [textVal, setTextVal] = useState(() =>
    parsed ? toPersianDigits(jalaliPartsToString(parsed)) : ''
  );
  const [viewYear, setViewYear] = useState<number>(() => parsed?.jy ?? today.jy);
  const [viewMonth, setViewMonth] = useState<number>(() => parsed?.jm ?? today.jm);
  const [popoverPos, setPopoverPos] = useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 280,
  });

  const anchorRef = useRef<HTMLDivElement | null>(null);
  const popoverRef = useRef<HTMLDivElement | null>(null);

  // Sync display text whenever external value changes
  useEffect(() => {
    const p = parseAnyDateToJalaliParts(value);
    setTextVal(p ? toPersianDigits(jalaliPartsToString(p)) : '');
    if (p) {
      setViewYear(p.jy);
      setViewMonth(p.jm);
    }
  }, [value]);

  const computePosition = () => {
    if (!anchorRef.current) return;
    const rect = anchorRef.current.getBoundingClientRect();
    const popW = 284;
    const popH = 316;
    const margin = 8;

    let left = rect.right - popW;
    if (left < margin) left = margin;
    if (left + popW > window.innerWidth - margin) {
      left = Math.max(margin, window.innerWidth - popW - margin);
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const top =
      spaceBelow >= popH + margin
        ? rect.bottom + 4
        : Math.max(margin, rect.top - popH - 4);

    setPopoverPos({ top, left, width: popW });
  };

  useEffect(() => {
    if (!open) return;
    computePosition();

    const handleOutside = (e: MouseEvent | TouchEvent) => {
      const target = e.target as Node | null;
      if (
        anchorRef.current?.contains(target) ||
        popoverRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };

    const handleScrollOrResize = () => computePosition();

    document.addEventListener('mousedown', handleOutside);
    document.addEventListener('touchstart', handleOutside);
    window.addEventListener('keydown', handleKey);
    window.addEventListener('resize', handleScrollOrResize);
    window.addEventListener('scroll', handleScrollOrResize, true);
    return () => {
      document.removeEventListener('mousedown', handleOutside);
      document.removeEventListener('touchstart', handleOutside);
      window.removeEventListener('keydown', handleKey);
      window.removeEventListener('resize', handleScrollOrResize);
      window.removeEventListener('scroll', handleScrollOrResize, true);
    };
  }, [open]);

  const handleManualCommit = () => {
    const trimmed = textVal.trim();
    if (!trimmed) {
      if (canClear) {
        onChange('');
      } else {
        setTextVal(parsed ? toPersianDigits(jalaliPartsToString(parsed)) : '');
      }
      return;
    }
    const iso = parseJalaliInputToIso(trimmed);
    if (iso) {
      onChange(iso);
      const p = parseAnyDateToJalaliParts(iso);
      if (p) {
        setViewYear(p.jy);
        setViewMonth(p.jm);
        setTextVal(toPersianDigits(jalaliPartsToString(p)));
      }
    } else {
      // Revert invalid typing back to the last valid date
      setTextVal(parsed ? toPersianDigits(jalaliPartsToString(parsed)) : '');
    }
  };

  const selectDay = (day: number) => {
    const iso = jalaliPartsToIso(viewYear, viewMonth, day);
    onChange(iso);
    setOpen(false);
  };

  const goPrevMonth = () => {
    if (viewMonth === 1) {
      setViewMonth(12);
      setViewYear((y) => y - 1);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const goNextMonth = () => {
    if (viewMonth === 12) {
      setViewMonth(1);
      setViewYear((y) => y + 1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  const daysInMonth = jalaliMonthLength(viewYear, viewMonth);
  const firstWeekday = getJalaliMonthFirstWeekday(viewYear, viewMonth);

  const yearOptions = useMemo(() => {
    const minY = Math.min(today.jy - 10, viewYear - 5);
    const maxY = Math.max(today.jy + 12, viewYear + 5);
    const list: number[] = [];
    for (let y = minY; y <= maxY; y += 1) list.push(y);
    return list;
  }, [today.jy, viewYear]);

  return (
    <div ref={anchorRef} className="relative w-full">
      <div
        className={`flex w-full items-center gap-1 border border-[#CEC7B6] bg-[#FAF8F3] focus-within:border-[#243B5A] ${
          disabled ? 'opacity-50 pointer-events-none' : ''
        } ${compact ? 'px-2 py-1 text-xs' : 'px-2.5 py-2 text-sm'} ${className}`}
      >
        <input
          type="text"
          dir="ltr"
          inputMode="numeric"
          disabled={disabled}
          required={required}
          aria-label={ariaLabel}
          value={textVal}
          placeholder={placeholder}
          onFocus={() => {
            if (!disabled) setOpen(true);
          }}
          onChange={(e) => setTextVal(e.target.value)}
          onBlur={handleManualCommit}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              handleManualCommit();
              setOpen(false);
            }
          }}
          className="min-w-0 flex-1 bg-transparent text-right tabular-nums text-[#263448] placeholder:text-[#8E959C] focus:outline-none"
        />

        {canClear && value && !disabled && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onChange('');
              setTextVal('');
            }}
            className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded text-[#788290] hover:bg-[#E8E5DE] hover:text-[#9E3B3B] cursor-pointer"
            title="پاک کردن تاریخ"
            aria-label="پاک کردن تاریخ"
          >
            <X className="h-3 w-3" />
          </button>
        )}

        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
          title="انتخاب از تقویم شمسی"
          aria-label="باز کردن تقویم شمسی"
        >
          <Calendar className={compact ? 'h-3.5 w-3.5' : 'h-4 w-4'} />
        </button>
      </div>

      {open &&
        !disabled &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            ref={popoverRef}
            dir="rtl"
            style={{
              position: 'fixed',
              top: popoverPos.top,
              left: popoverPos.left,
              width: popoverPos.width,
              zIndex: 9999,
            }}
            className="rounded-xl border border-[#D4CEBF] bg-[#FFFFFF] p-3 shadow-[0_12px_32px_rgba(29,50,80,0.18)]"
          >
            {/* Header: Prev / Month + Year selectors / Next */}
            <div className="mb-2.5 flex items-center justify-between gap-1.5">
              <button
                type="button"
                onClick={goPrevMonth}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E0D5] bg-[#FAF8F3] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                title="ماه قبل"
              >
                <ChevronRight className="h-4 w-4" />
              </button>

              <div className="flex flex-1 items-center justify-center gap-1">
                <select
                  value={viewMonth}
                  onChange={(e) => setViewMonth(Number(e.target.value))}
                  aria-label="ماه شمسی"
                  className="h-7 rounded-lg border border-[#E5E0D5] bg-[#FAF8F3] px-1.5 text-xs font-semibold text-[#1D3250] focus:border-[#243B5A] focus:outline-none"
                >
                  {JALALI_MONTH_NAMES.map((name, idx) => (
                    <option key={name} value={idx + 1}>
                      {name}
                    </option>
                  ))}
                </select>
                <select
                  value={viewYear}
                  onChange={(e) => setViewYear(Number(e.target.value))}
                  aria-label="سال شمسی"
                  className="h-7 rounded-lg border border-[#E5E0D5] bg-[#FAF8F3] px-1.5 text-xs font-semibold tabular-nums text-[#1D3250] focus:border-[#243B5A] focus:outline-none"
                >
                  {yearOptions.map((y) => (
                    <option key={y} value={y}>
                      {toPersianDigits(y)}
                    </option>
                  ))}
                </select>
              </div>

              <button
                type="button"
                onClick={goNextMonth}
                className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg border border-[#E5E0D5] bg-[#FAF8F3] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                title="ماه بعد"
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
            </div>

            {/* Weekday Header (Sat..Fri) */}
            <div className="mb-1 grid grid-cols-7 gap-1 text-center text-[11px] font-semibold">
              {JALALI_WEEKDAY_SHORT.map((wd, idx) => (
                <div
                  key={wd}
                  className={`py-1 ${idx === 6 ? 'text-[#9E3B3B]' : 'text-[#5B6573]'}`}
                >
                  {wd}
                </div>
              ))}
            </div>

            {/* Days Grid */}
            <div className="grid grid-cols-7 gap-1 text-center">
              {Array.from({ length: firstWeekday }).map((_, i) => (
                <div key={`pad-${i}`} className="h-8" />
              ))}
              {Array.from({ length: daysInMonth }).map((_, idx) => {
                const day = idx + 1;
                const isSelected =
                  parsed !== null &&
                  parsed.jy === viewYear &&
                  parsed.jm === viewMonth &&
                  parsed.jd === day;
                const isToday =
                  today.jy === viewYear && today.jm === viewMonth && today.jd === day;
                const isFriday = (firstWeekday + idx) % 7 === 6;

                return (
                  <button
                    key={day}
                    type="button"
                    onClick={() => selectDay(day)}
                    className={`flex h-8 w-full items-center justify-center rounded-lg text-xs tabular-nums transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-[#243B5A] font-bold text-[#FAF8F3]'
                        : isToday
                          ? 'border border-[#B99A62] bg-[#FAF4E6] font-bold text-[#1D3250] hover:bg-[#F2E7C9]'
                          : isFriday
                            ? 'text-[#9E3B3B] hover:bg-[#FBEAE8]'
                            : 'text-[#263448] hover:bg-[#E5EBF2]'
                    }`}
                  >
                    {toPersianDigits(day)}
                  </button>
                );
              })}
            </div>

            {/* Footer Controls */}
            <div className="mt-2.5 flex items-center justify-between gap-2 border-t border-[#ECE7DC] pt-2">
              <button
                type="button"
                onClick={() => {
                  const iso = todayIsoDate();
                  onChange(iso);
                  setViewYear(today.jy);
                  setViewMonth(today.jm);
                  setOpen(false);
                }}
                className="rounded-lg border border-[#243B5A] bg-[#E5EBF2] px-2.5 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#243B5A] hover:text-[#FAF8F3] cursor-pointer"
              >
                امروز ({toPersianDigits(`${today.jy}/${String(today.jm).padStart(2, '0')}/${String(today.jd).padStart(2, '0')}`)})
              </button>

              {canClear && (
                <button
                  type="button"
                  onClick={() => {
                    onChange('');
                    setTextVal('');
                    setOpen(false);
                  }}
                  className="rounded-lg border border-[#E2DDD2] px-2.5 py-1 text-[11px] text-[#5B6573] hover:border-[#9E3B3B] hover:text-[#9E3B3B] cursor-pointer"
                >
                  پاک کردن
                </button>
              )}
            </div>
          </div>,
          document.body
        )}
    </div>
  );
};
