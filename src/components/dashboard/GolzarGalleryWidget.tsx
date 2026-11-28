import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Pause, Play, Plus } from 'lucide-react';
import { GolzarImageRecord } from '../../types';
import { BUILTIN_GOLZAR_GALLERY } from '../../utils/officialAssets';

interface GolzarGalleryWidgetProps {
  images: GolzarImageRecord[];
  onManageClick?: () => void;
  variant?: 'sidebar' | 'card';
}

const CONTROLS_AUTO_HIDE_MS = 4000;

// Rotating Golzar Shohada image display: 10s interval, smooth fade, auto-hiding overlay controls after 4s.
// Uses user's custom IndexedDB images if added, and falls back gracefully to the 4 official local Golzar photos.
export const GolzarGalleryWidget: React.FC<GolzarGalleryWidgetProps> = ({
  images,
  onManageClick,
  variant = 'card',
}) => {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimerRef = useRef<number | null>(null);

  const scheduleHideControls = useCallback(() => {
    if (hideTimerRef.current !== null) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(() => {
      setControlsVisible(false);
      hideTimerRef.current = null;
    }, CONTROLS_AUTO_HIDE_MS);
  }, []);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    scheduleHideControls();
  }, [scheduleHideControls]);

  useEffect(() => {
    scheduleHideControls();
    return () => {
      if (hideTimerRef.current !== null) {
        window.clearTimeout(hideTimerRef.current);
      }
    };
  }, [scheduleHideControls]);

  const slides = useMemo(
    () =>
      images.length > 0
        ? images.map((img) => ({
            id: img.id,
            src: img.dataUrl,
            alt: 'تصویر گلزار شهدای تهران',
          }))
        : BUILTIN_GOLZAR_GALLERY.map((item) => ({
            id: item.id,
            src: item.src,
            alt: item.caption,
          })),
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
      <div
        className="overflow-hidden rounded-xl border border-[#E5E0D5] bg-[#FAF8F3]"
        onMouseEnter={revealControls}
        onMouseMove={revealControls}
        onTouchStart={revealControls}
        onClick={revealControls}
      >
        <div className="relative">
          <div className="aspect-[4/3] w-full overflow-hidden bg-[#F2EEE6]">
            <img
              key={current.id}
              src={current.src}
              alt={current.alt}
              className="animate-page-in h-full w-full object-cover"
            />
          </div>

          <div
            className={`absolute top-2 left-2 flex items-center gap-1 rounded-lg border border-[#E2DDD2]/90 bg-[#FFFFFF]/90 p-1 backdrop-blur-[2px] transition-opacity duration-500 ${
              controlsVisible
                ? 'opacity-100 pointer-events-auto'
                : 'opacity-0 pointer-events-none'
            }`}
          >
            {slides.length > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    revealControls();
                    setIndex((prev) => (prev - 1 + slides.length) % slides.length);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  title="تصویر قبلی"
                >
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    revealControls();
                    setPaused((p) => !p);
                  }}
                  className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  title={paused ? 'ادامه نمایش چرخشی' : 'توقف چرخش'}
                >
                  {paused ? <Play className="h-2.5 w-2.5" /> : <Pause className="h-2.5 w-2.5" />}
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    revealControls();
                    setIndex((prev) => (prev + 1) % slides.length);
                  }}
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
                onClick={(e) => {
                  e.stopPropagation();
                  onManageClick();
                }}
                className="inline-flex h-5 w-5 items-center justify-center rounded text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                title="مدیریت و افزودن تصاویر گلزار"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col overflow-hidden rounded-2xl border border-[#E2DDD2] bg-[#FFFFFF]"
      onMouseEnter={revealControls}
      onMouseMove={revealControls}
      onTouchStart={revealControls}
      onClick={revealControls}
    >
      <div className="relative bg-[#FAF8F3]">
        <div className="aspect-[16/9] w-full overflow-hidden bg-[#F2EEE6]">
          <img
            key={current.id}
            src={current.src}
            alt={current.alt}
            className="animate-page-in h-full w-full object-cover"
          />
        </div>

        <div
          className={`absolute top-2.5 left-2.5 flex items-center gap-1 rounded-lg border border-[#E2DDD2]/90 bg-[#FFFFFF]/90 p-1 backdrop-blur-[2px] transition-opacity duration-500 ${
            controlsVisible
              ? 'opacity-100 pointer-events-auto'
              : 'opacity-0 pointer-events-none'
          }`}
        >
          {slides.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  revealControls();
                  setIndex((prev) => (prev - 1 + slides.length) % slides.length);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title="تصویر قبلی"
              >
                <ChevronRight className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  revealControls();
                  setPaused((p) => !p);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title={paused ? 'ادامه نمایش چرخشی' : 'توقف چرخش'}
              >
                {paused ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  revealControls();
                  setIndex((prev) => (prev + 1) % slides.length);
                }}
                className="inline-flex h-6 w-6 items-center justify-center rounded text-[#263448] hover:bg-[#E5EBF2] cursor-pointer"
                title="تصویر بعدی"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
              </button>
            </>
          )}
          {onManageClick && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onManageClick();
              }}
              className="inline-flex h-6 items-center gap-1 rounded px-2 text-[11px] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              title="مدیریت تصاویر گلزار"
            >
              <Plus className="h-3 w-3" />
              <span>مدیریت</span>
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
