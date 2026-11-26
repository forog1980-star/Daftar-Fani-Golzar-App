import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Pause, Play } from 'lucide-react';
import { GolzarImageRecord } from '../../types';
import { toPersianDigits } from '../../utils/format';

interface GolzarGalleryWidgetProps {
  images: GolzarImageRecord[];
  onManageClick?: () => void;
}

// Rotating Golzar Shohada image display (Section 4): 10s interval (8-12s), smooth fade, pause/next/prev, no fake/internet images
export const GolzarGalleryWidget: React.FC<GolzarGalleryWidgetProps> = ({
  images,
  onManageClick,
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  const safeIndex = images.length > 0 ? index % images.length : 0;

  useEffect(() => {
    if (images.length <= 1 || paused) return;
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % images.length);
    }, 10000); // 10 seconds (within 8-12s requirement)
    return () => clearInterval(timer);
  }, [images.length, paused]);

  const current = images[safeIndex];

  return (
    <div className="flex flex-col border border-[#E2DDD2] bg-[#FFFFFF] rounded-[var(--app-radius)] overflow-hidden">
      <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-3.5 py-2.5">
        <span className="text-xs font-semibold text-[#243B5A]">تصاویر گلزار شهدا</span>
        {images.length > 0 && (
          <div className="flex items-center gap-1">
            {images.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={() => setIndex((prev) => (prev - 1 + images.length) % images.length)}
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
                  onClick={() => setIndex((prev) => (prev + 1) % images.length)}
                  className="inline-flex h-6 w-6 items-center justify-center rounded border border-[#D7D2C6] bg-[#FFFFFF] text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                  title="تصویر بعدی"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                </button>
              </>
            )}
          </div>
        )}
      </div>

      {current ? (
        <div className="relative bg-[#FAF8F3]">
          <div className="aspect-[16/10] w-full overflow-hidden bg-[#F2EEE6]">
            <img
              key={current.id}
              src={current.dataUrl}
              alt={current.caption || current.fileName}
              className="animate-page-in h-full w-full object-cover"
            />
          </div>
          <div className="flex items-center justify-between gap-2 border-t border-[#E8E5DE] bg-[#FFFFFF] px-3 py-2 text-[11px] text-[#5B6573]">
            <span className="truncate">{current.caption || 'گلزار شهدا'}</span>
            {images.length > 1 && (
              <span className="shrink-0 tabular-nums">
                {toPersianDigits(safeIndex + 1)} / {toPersianDigits(images.length)}
              </span>
            )}
          </div>
        </div>
      ) : (
        <div className="flex aspect-[16/10] flex-col items-center justify-center gap-2 bg-[#FAF8F3] p-4 text-center">
          <ImageIcon className="h-7 w-7 text-[#9BA3AE]" />
          <div className="text-xs font-medium text-[#263448]">
            تصویر گلزار شهدا هنوز بارگذاری نشده است
          </div>
          <p className="text-[11px] leading-5 text-[#66707D]">
            تصاویر واقعی از بخش «پشتیبانی ← مدیریت تصاویر گلزار» قابل افزودن هستند.
          </p>
          {onManageClick && (
            <button
              type="button"
              onClick={onManageClick}
              className="mt-1 rounded border border-[#243B5A] bg-[#FFFFFF] px-3 py-1 text-[11px] font-medium text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              افزودن تصاویر گلزار
            </button>
          )}
        </div>
      )}
    </div>
  );
};
