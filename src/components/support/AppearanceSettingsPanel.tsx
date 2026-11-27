import React, { useMemo } from 'react';
import { Check, Palette, Pipette, RotateCcw, Save } from 'lucide-react';
import { AppearanceConfig } from '../../types';
import {
  buildAppearanceFromPrimary,
  CANVAS_SURFACE_PRESETS,
  PRIMARY_SWATCHES,
  RADIUS_PRESETS,
  resolveAppearance,
  THEME_PRESETS,
  ThemePreset,
} from '../../utils/themeEngine';

interface AppearanceSettingsPanelProps {
  value: AppearanceConfig;
  savedValue?: AppearanceConfig;
  onChange: (next: AppearanceConfig) => void;
  onSaveNow: (next: AppearanceConfig) => Promise<void> | void;
  onReset: () => Promise<void> | void;
}

export const AppearanceSettingsPanel: React.FC<AppearanceSettingsPanelProps> = ({
  value,
  savedValue,
  onChange,
  onSaveNow,
  onReset,
}) => {
  const current = useMemo(() => resolveAppearance(value), [value]);
  const saved = useMemo(() => resolveAppearance(savedValue), [savedValue]);

  const isDirty =
    current.primaryColor !== saved.primaryColor ||
    current.headerColor !== saved.headerColor ||
    current.accentColor !== saved.accentColor ||
    current.canvasColor !== saved.canvasColor ||
    current.cardSurface !== saved.cardSurface ||
    current.radiusPx !== saved.radiusPx;

  const activePresetId = useMemo(() => {
    const found = THEME_PRESETS.find(
      (p) =>
        p.primaryColor.toUpperCase() === current.primaryColor.toUpperCase() &&
        p.canvasColor.toUpperCase() === current.canvasColor.toUpperCase() &&
        p.cardSurface.toUpperCase() === current.cardSurface.toUpperCase()
    );
    return found?.id ?? null;
  }, [current]);

  const handleSelectPreset = (preset: ThemePreset) => {
    onChange({
      presetId: preset.id,
      primaryColor: preset.primaryColor,
      headerColor: preset.headerColor,
      accentColor: preset.accentColor,
      canvasColor: preset.canvasColor,
      cardSurface: preset.cardSurface,
      softTint: preset.softTint,
      radiusPx: current.radiusPx,
    });
  };

  return (
    <div className="rounded-[var(--app-radius)] border border-[#E2DDD2] bg-[#FFFFFF] p-5 space-y-5">
      {/* Header Row */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E8E5DE] pb-4">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <Palette className="h-4.5 w-4.5 text-[#B99A62]" />
            <h3 className="text-sm font-bold text-[#243B5A]">
              ظاهر نرم‌افزار و انتخاب پالت رنگی
            </h3>
          </div>
          <p className="text-xs text-[#5B6573]">
            با کلیک روی هر تم، رنگ منو، دکمه‌ها، سربرگ‌ها و زمینه کل نرم‌افزار همان لحظه تغییر می‌کند.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={onReset}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-xs font-medium text-[#263448] transition-colors hover:bg-[#E5EBF2] cursor-pointer whitespace-nowrap"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            <span>بازگشت به پیش‌فرض</span>
          </button>

          <button
            type="button"
            onClick={() => onSaveNow(current)}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3.5 py-2 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] cursor-pointer whitespace-nowrap"
          >
            <Save className="h-3.5 w-3.5" />
            <span>{isDirty ? 'ذخیره پالت انتخاب‌شده' : 'پالت ذخیره شده است'}</span>
          </button>
        </div>
      </div>

      {isDirty && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#D5C39E] bg-[#FAF8F3] px-3.5 py-2.5 text-xs text-[#263448]">
          <span>
            پیش‌نمایش زنده روی کل نرم‌افزار فعال است. برای ماندگار شدن در دفعات بعدی، دکمه «ذخیره پالت انتخاب‌شده» را بزنید.
          </span>
        </div>
      )}

      {/* Step 1: 8 Curated Administrative Theme Cards */}
      <div className="space-y-2.5">
        <div className="flex items-center justify-between">
          <span className="text-xs font-semibold text-[#243B5A]">
            ۱. انتخاب سریع تم‌های رنگی آماده (۸ پالت هماهنگ)
          </span>
          <span className="text-[11px] text-[#788290]">
            تغییر هم‌زمان رنگ اصلی، رنگ مکمل و زمینه
          </span>
        </div>

        <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
          {THEME_PRESETS.map((preset) => {
            const isSelected = activePresetId === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                onClick={() => handleSelectPreset(preset)}
                className={`group flex flex-col justify-between rounded-xl border p-3 text-right transition-colors cursor-pointer ${
                  isSelected
                    ? 'border-[#243B5A] bg-[#E5EBF2]/70 ring-1 ring-[#243B5A]'
                    : 'border-[#E2DDD2] bg-[#FFFFFF] hover:border-[#CEC8BA] hover:bg-[#FAF8F3]'
                }`}
              >
                {/* 4-color visual palette strip */}
                <div className="mb-2.5 flex items-center justify-between gap-2">
                  <div className="flex h-6 flex-1 overflow-hidden rounded-lg border border-black/10">
                    <span
                      className="h-full w-5/12"
                      style={{ backgroundColor: preset.primaryColor }}
                      title="رنگ اصلی"
                    />
                    <span
                      className="h-full w-2/12"
                      style={{ backgroundColor: preset.accentColor }}
                      title="رنگ مکمل"
                    />
                    <span
                      className="h-full w-3/12"
                      style={{ backgroundColor: preset.cardSurface }}
                      title="سطح کارت‌ها"
                    />
                    <span
                      className="h-full w-2/12"
                      style={{ backgroundColor: preset.canvasColor }}
                      title="زمینه صفحه"
                    />
                  </div>
                  <span
                    className={`flex h-5 w-5 shrink-0 items-center justify-center rounded-full border text-white transition-colors ${
                      isSelected ? 'border-transparent' : 'border-[#D7D2C6] bg-transparent'
                    }`}
                    style={isSelected ? { backgroundColor: preset.primaryColor } : undefined}
                  >
                    {isSelected && <Check className="h-3 w-3" />}
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold text-[#263448]">{preset.name}</div>
                  <div className="mt-0.5 text-[11px] text-[#788290]">{preset.tagline}</div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Step 2 + Live Preview Split */}
      <div className="grid grid-cols-1 gap-5 border-t border-[#E8E5DE] pt-5 lg:grid-cols-12">
        {/* Fine-Tuning Controls */}
        <div className="space-y-5 lg:col-span-7">
          {/* Primary Color Swatches + Custom Color Picker */}
          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-semibold text-[#243B5A]">
                ۲. انتخاب جداگانه رنگ اصلی (منوی فعال، دکمه‌ها و عناوین)
              </span>
              <span className="font-mono text-[11px] tabular-nums text-[#788290]" dir="ltr">
                {current.primaryColor}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {PRIMARY_SWATCHES.map((swatch) => {
                const active =
                  current.primaryColor.toUpperCase() === swatch.color.toUpperCase();
                return (
                  <button
                    key={swatch.color}
                    type="button"
                    onClick={() =>
                      onChange(buildAppearanceFromPrimary(swatch.color, current, swatch.accent))
                    }
                    title={swatch.label}
                    className={`inline-flex items-center gap-2 rounded-lg border px-2.5 py-1.5 text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-[#243B5A] bg-[#E5EBF2] font-semibold text-[#243B5A]'
                        : 'border-[#E2DDD2] bg-[#FAF8F3] text-[#263448] hover:border-[#CEC8BA]'
                    }`}
                  >
                    <span
                      className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full border border-black/15 text-white"
                      style={{ backgroundColor: swatch.color }}
                    >
                      {active && <Check className="h-2.5 w-2.5" />}
                    </span>
                    <span>{swatch.label}</span>
                  </button>
                );
              })}

              {/* Custom Color Picker */}
              <label className="inline-flex items-center gap-2 rounded-lg border border-dashed border-[#B99A62] bg-[#FFFFFF] px-2.5 py-1.5 text-xs font-medium text-[#263448] transition-colors hover:bg-[#FAF8F3] cursor-pointer">
                <Pipette className="h-3.5 w-3.5 text-[#B99A62]" />
                <span>رنگ دلخواه</span>
                <input
                  type="color"
                  value={current.primaryColor}
                  onChange={(e) =>
                    onChange(buildAppearanceFromPrimary(e.target.value, current))
                  }
                  className="h-5 w-6 cursor-pointer border-0 bg-transparent p-0"
                  aria-label="انتخاب رنگ اصلی دلخواه"
                />
              </label>
            </div>
          </div>

          {/* Background & Surface Selector */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[#243B5A]">
              ۳. رنگ پس‌زمینه صفحات و کادرهای فرعی
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {CANVAS_SURFACE_PRESETS.map((s) => {
                const active =
                  current.canvasColor.toUpperCase() === s.canvas.toUpperCase() &&
                  current.cardSurface.toUpperCase() === s.surface.toUpperCase();
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() =>
                      onChange({
                        ...current,
                        presetId: 'custom',
                        canvasColor: s.canvas,
                        cardSurface: s.surface,
                      })
                    }
                    className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-right text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-[#243B5A] bg-[#E5EBF2] font-semibold text-[#243B5A]'
                        : 'border-[#E2DDD2] bg-[#FFFFFF] text-[#263448] hover:bg-[#FAF8F3]'
                    }`}
                  >
                    <span className="flex shrink-0 -space-x-1 space-x-reverse">
                      <span
                        className="h-4 w-4 rounded-full border border-[#C6C0B4]"
                        style={{ backgroundColor: s.canvas }}
                      />
                      <span
                        className="h-4 w-4 rounded-full border border-[#C6C0B4]"
                        style={{ backgroundColor: s.surface }}
                      />
                    </span>
                    <span className="truncate">{s.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Corner Radius Selector */}
          <div className="space-y-2.5">
            <div className="text-xs font-semibold text-[#243B5A]">
              ۴. فرم گوشه‌های کارت‌ها و پنجره‌ها
            </div>
            <div className="grid grid-cols-3 gap-2">
              {RADIUS_PRESETS.map((r) => {
                const active = current.radiusPx === r.value;
                return (
                  <button
                    key={r.value}
                    type="button"
                    onClick={() => onChange({ ...current, radiusPx: r.value })}
                    className={`flex items-center justify-center gap-2 rounded-lg border px-3 py-2 text-xs transition-colors cursor-pointer ${
                      active
                        ? 'border-[#243B5A] bg-[#243B5A] font-medium text-[#FAF8F3]'
                        : 'border-[#E2DDD2] bg-[#FAF8F3] text-[#263448] hover:border-[#CEC8BA]'
                    }`}
                  >
                    <span
                      className={`h-3.5 w-3.5 shrink-0 border-2 ${
                        active ? 'border-[#FAF8F3]' : 'border-[#243B5A]'
                      }`}
                      style={{ borderRadius: `${Math.max(2, Math.round(r.value / 3))}px` }}
                    />
                    <span className="truncate">{r.shortLabel}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Interactive Mini-App Live Preview */}
        <div className="lg:col-span-5">
          <div className="mb-2 flex items-center justify-between text-xs">
            <span className="font-semibold text-[#243B5A]">پیش‌نمایش زنده اجزای نرم‌افزار</span>
            <span className="text-[11px] text-[#788290]">نمای واقعی اعمال رنگ‌ها</span>
          </div>

          <div
            className="border border-[#D7D2C6] p-3.5 space-y-3 transition-colors"
            style={{
              backgroundColor: current.canvasColor,
              borderRadius: `${current.radiusPx}px`,
            }}
          >
            {/* Mini Header */}
            <div
              className="flex items-center justify-between border-b pb-2.5"
              style={{ borderColor: `${current.accentColor}66` }}
            >
              <div className="flex items-center gap-2">
                <img
                  src="./app-icon.png"
                  alt="آیکون نرم‌افزار"
                  className="h-7 w-7 rounded-md border border-black/10 object-cover"
                />
                <div>
                  <div
                    className="text-xs font-bold leading-tight"
                    style={{ color: current.primaryColor }}
                  >
                    دفتر فنی اداره گلزار شهدا
                  </div>
                  <div className="text-[10px] text-[#5B6573]">سربرگ و تیتر بخش‌ها</div>
                </div>
              </div>
              <span
                className="px-2 py-1 text-[10px] font-medium text-[#FAF8F3]"
                style={{
                  backgroundColor: current.primaryColor,
                  borderRadius: `${Math.max(4, current.radiusPx - 4)}px`,
                }}
              >
                دکمه اصلی
              </span>
            </div>

            {/* Mini Sidebar + Content Preview */}
            <div className="grid grid-cols-12 gap-2.5">
              {/* Mini Sidebar */}
              <div
                className="col-span-4 space-y-1 border border-[#E2DDD2] bg-[#FFFFFF] p-2"
                style={{ borderRadius: `${Math.max(6, current.radiusPx - 2)}px` }}
              >
                <div
                  className="px-2 py-1.5 text-[10px] font-semibold text-[#FAF8F3]"
                  style={{
                    backgroundColor: current.primaryColor,
                    borderRadius: `${Math.max(4, current.radiusPx - 5)}px`,
                  }}
                >
                  بخش فعال منو
                </div>
                <div
                  className="px-2 py-1 text-[10px]"
                  style={{
                    backgroundColor: current.cardSurface,
                    color: current.primaryColor,
                    borderRadius: `${Math.max(4, current.radiusPx - 5)}px`,
                  }}
                >
                  منوی عادی
                </div>
                <div className="px-2 py-1 text-[10px] text-[#5B6573]">گزارش‌ها</div>
              </div>

              {/* Mini Content Card */}
              <div
                className="col-span-8 space-y-2 border border-[#E2DDD2] bg-[#FFFFFF] p-2.5"
                style={{ borderRadius: `${Math.max(6, current.radiusPx - 2)}px` }}
              >
                <div className="flex items-center justify-between">
                  <span
                    className="text-[11px] font-bold"
                    style={{ color: current.primaryColor }}
                  >
                    کارت اطلاعات پروژه
                  </span>
                  <span
                    className="h-2.5 w-2.5 rounded-full"
                    style={{ backgroundColor: current.accentColor }}
                    title="رنگ تأکید"
                  />
                </div>
                <div
                  className="p-2 text-[10px] leading-4 text-[#263448]"
                  style={{
                    backgroundColor: current.softTint,
                    borderRadius: `${Math.max(4, current.radiusPx - 6)}px`,
                  }}
                >
                  کادر برجسته فیلترها و بخش‌های انتخاب‌شده
                </div>
                <div className="flex items-center justify-end gap-1.5 pt-0.5">
                  <span
                    className="border px-2 py-1 text-[10px] font-medium"
                    style={{
                      borderColor: current.primaryColor,
                      color: current.primaryColor,
                      backgroundColor: current.canvasColor,
                      borderRadius: `${Math.max(4, current.radiusPx - 6)}px`,
                    }}
                  >
                    دکمه فرعی
                  </span>
                  <span
                    className="px-2.5 py-1 text-[10px] font-medium text-[#FAF8F3]"
                    style={{
                      backgroundColor: current.headerColor,
                      borderRadius: `${Math.max(4, current.radiusPx - 6)}px`,
                    }}
                  >
                    ذخیره
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
