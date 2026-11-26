import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react';
import { GolzarImageRecord } from '../../types';
import { toPersianDigits } from '../../utils/format';
import { BUILTIN_GOLZAR_GALLERY } from '../../utils/officialAssets';

interface GolzarGalleryWidgetProps {
  images: GolzarImageRecord[];
  onManageClick?: () => void;
  variant?: 'sidebar' | 'card';
}

// Rotating Golzar Shohada image display: 10s interval, smooth fade, pause/next/prev.
// Uses user's custom IndexedDB images if added, and falls back gracefully to the 4 official local Golzar photos.
export const GolzarGalleryWidget: React.FC<GolzarGalleryWidgetProps> = ({
  images,
  onManageClick,
  variant = 'card',
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const slides = useMemo(
    () =>
      images.length > 0
        ? images.map((img) => ({
            id: img.id,
            src: img.dataUrl,
            caption: img.caption || img.fileName,
          }))
        : BUILTIN_GOLZAR_GALLERY,
    [images]
  );

  const safeIndex = slides.length > 0 ? index % slides.length : 0;

  useEffect(() => {
    if (slides.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % slides.length);
    }, 10000);
    return () => clearInterval(timer);
  }, [slides.length, paused]);

  const current = slides[safeIndex];
  const isSidebar = variant === 'sidebar';

  if (isSidebar) {
    return (
      <div className="overflow-hidden rounded-xl border border-[#E5E0D5] bg-[#FAF8F3]">
        <div className="relative">
          <div className="aspect-[4/5] w-full overflow-hidden bg-[#F2EEE6]">
            <img
              key={current.id}
              src={current.src}
              alt={current.caption}
              className="animate-page-in h-full w-full object-cover"
            />
          </div>

          <div className="absolute top-2 left-2 flex items-center gap-1 rounded-lg border border-[#E2DDD2]/90 bg-[#FFFFFF]/90 p-1">
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  title="تصویر قبلی"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setPaused((p) => !p)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  title={paused ? 'ادامه نمایش چرخشی' : 'توقف چرخش'}
                >
                  {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                </button>
                <button
                  type="button"
                  onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  title="تصویر بعدی"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </>
            )}
            {onManageClick && (
              <button
                type="button"
                onClick={onManageClick}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                title="مدیریت و افزودن تصاویر گلزار"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center justify-between gap-1.5 border-t border-[#E8E5DE] bg-[#FFFFFF] px-2.5 py-1.5 text-[11px] text-[#5B6573]">
            <span className="truncate">{current.caption}</span>
            {slides.length > 1 && (
              <span className="shrink-0 tabular-nums text-[10px]">
                {toPersianDigits(safeIndex + 1)}/{toPersianDigits(slides.length)}
              </span>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col overflow-hidden rounded-2xl border border-[#E2DDD2] bg-[#FFFFFF]">
      <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-4 py-2.5">
        <span className="text-xs font-semibold text-[#243B5A]">تصاویر گلزار شهدا</span>
        <div className="flex items-center gap-1">
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev - 1 + slides.length) % slides.length)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title="تصویر قبلی"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setPaused((p) => !p)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title={paused ? 'ادامه نمایش چرخشی' : 'توقف چرخش'}
              >
                {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={() => setIndex((prev) => (prev + 1) % slides.length)}
                className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title="تصویر بعدی"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {onManageClick && (
            <button
              type="button"
              onClick={onManageClick}
              className="inline-flex h-6 items-center gap-1 rounded border border-[#D7D2C6] bg-[#FFFFFF] px-2 text-[11px] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              title="مدیریت تصاویر گلزار"
            >
              <Plus className="h-3 w-3" />
              <span>مدیریت</span>
            </button>
          )}
        </div>
      </div>

      <div className="relative bg-[#FAF8F3]">
        <div className="aspect-[16/9] w-full overflow-hidden bg-[#F2EEE6]">
          <img
            key={current.id}
            src={current.src}
            alt={current.caption}
            className="animate-page-in h-full w-full object-cover"
          />
        </div>
        <div className="flex items-center justify-between gap-2 border-t border-[#E8E5DE] bg-[#FFFFFF] px-3.5 py-2 text-[11px] text-[#5B6573]">
          <span className="truncate">{current.caption}</span>
          {slides.length > 1 && (
            <span className="shrink-0 tabular-nums">
              {toPersianDigits(safeIndex + 1)} / {toPersianDigits(slides.length)}
            </span>
          )}
        </div>
      </div>
    </div>
  );
};
