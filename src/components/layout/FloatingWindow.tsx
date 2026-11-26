import React, { useEffect, useRef, useState } from 'react';
import { Maximize2, Minus, Move, X } from 'lucide-react';

interface FloatingWindowProps {
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  width?: number;
  maxHeightClass?: string;
}

// Desktop: draggable floating window (flat 2D, hairline border, zero shadow)
// Mobile (<768px): clean full-screen overlay sheet
export const FloatingWindow: React.FC<FloatingWindowProps> = ({
  title,
  onClose,
  children,
  width = 720,
  maxHeightClass = 'max-h-[82vh]',
}) => {
  const [minimized, setMinimized] = useState(false);
  const [isDesktop, setIsDesktop] = useState(
    typeof window !== 'undefined' ? window.innerWidth >= 768 : true
  );
  const [pos, setPos] = useState(() => {
    if (typeof window === 'undefined') return { x: 120, y: 64 };
    const safeW = Math.min(width, window.innerWidth - 32);
    return {
      x: Math.max(16, Math.round((window.innerWidth - safeW) / 2)),
      y: Math.max(48, Math.round(window.innerHeight * 0.08)),
    };
  });

  const dragRef = useRef<{ startX: number; startY: number; origX: number; origY: number } | null>(
    null
  );

  useEffect(() => {
    const onResize = () => setIsDesktop(window.innerWidth >= 768);
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      if (!dragRef.current) return;
      const dx = e.clientX - dragRef.current.startX;
      const dy = e.clientY - dragRef.current.startY;
      const nextX = Math.max(8, Math.min(window.innerWidth - 260, dragRef.current.origX + dx));
      const nextY = Math.max(8, Math.min(window.innerHeight - 64, dragRef.current.origY + dy));
      setPos({ x: nextX, y: nextY });
    };
    const onUp = () => {
      dragRef.current = null;
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp);
    return () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
    };
  }, []);

  const handleDragStart = (e: React.PointerEvent) => {
    if (!isDesktop) return;
    dragRef.current = {
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
    };
  };

  if (!isDesktop) {
    return (
      <div className="fixed inset-0 z-40 flex flex-col bg-[#FAF8F3]">
        <div className="flex items-center justify-between border-b border-[#E2DDD0] bg-[#F3EFE6] px-4 py-3">
          <h3 className="truncate text-sm font-semibold text-[#2B3033]">{title}</h3>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-9 w-9 items-center justify-center border border-[#CEC7B6] bg-[#FFFFFF] text-[#2B3033] hover:bg-[#ECE7DA] cursor-pointer"
            aria-label="بستن پنجره"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{children}</div>
      </div>
    );
  }

  return (
    <div
      className="fixed z-40 flex flex-col border border-[#BDB6A4] bg-[#FFFFFF]"
      style={{
        left: `${pos.x}px`,
        top: `${pos.y}px`,
        width: `${Math.min(width, window.innerWidth - 32)}px`,
      }}
      role="dialog"
      aria-label={title}
    >
      <div
        onPointerDown={handleDragStart}
        className="flex cursor-move select-none items-center justify-between border-b border-[#E2DDD0] bg-[#F3EFE6] px-4 py-2.5"
      >
        <div className="flex items-center gap-2 min-w-0">
          <Move className="h-3.5 w-3.5 shrink-0 text-[#7C8287]" />
          <h3 className="truncate text-sm font-semibold text-[#2B3033]">{title}</h3>
        </div>
        <div className="flex items-center gap-1.5 shrink-0" onPointerDown={(e) => e.stopPropagation()}>
          <button
            type="button"
            onClick={() => setMinimized((m) => !m)}
            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] bg-[#FAF8F3] text-[#5B6268] hover:bg-[#ECE7DA] cursor-pointer"
            title={minimized ? 'گستردن پنجره' : 'کوچک کردن پنجره'}
          >
            {minimized ? <Maximize2 className="h-3.5 w-3.5" /> : <Minus className="h-3.5 w-3.5" />}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="inline-flex h-7 w-7 items-center justify-center border border-[#D4CEBF] bg-[#FAF8F3] text-[#5B6268] hover:border-[#B43E3E] hover:text-[#B43E3E] cursor-pointer"
            title="بستن"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      {!minimized && (
        <div className={`overflow-y-auto bg-[#FFFFFF] p-5 ${maxHeightClass}`}>{children}</div>
      )}
    </div>
  );
};
