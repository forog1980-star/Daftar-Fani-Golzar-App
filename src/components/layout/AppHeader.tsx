import React from 'react';
import { ArrowRight, Home } from 'lucide-react';
import { AppRoute } from '../../types';

interface AppHeaderProps {
  route: AppRoute;
  title: string;
  onBack: () => void;
  onHome: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({ route, title, onBack, onHome }) => {
  const isHome = route === 'home';

  return (
    <header className="sticky top-0 z-30 border-b border-[#E2DDD0] bg-[#FAF8F3]">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3 min-w-0">
          {!isHome && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-1.5 border border-[#CEC7B6] bg-[#FFFFFF] px-3 text-sm font-medium text-[#2B3033] transition-colors hover:bg-[#F3EFE6] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowRight className="h-4 w-4" />
              <span>بازگشت</span>
            </button>
          )}
          <h1 className="truncate text-base font-semibold text-[#2B3033] sm:text-lg">
            {title}
          </h1>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {!isHome && (
            <button
              type="button"
              onClick={onHome}
              className="inline-flex h-9 items-center gap-1.5 border border-[#E2DDD0] bg-[#F3EFE6] px-3 text-sm font-medium text-[#2B3033] transition-colors hover:bg-[#ECE7DA] whitespace-nowrap shrink-0 cursor-pointer"
              title="صفحه اصلی"
            >
              <Home className="h-4 w-4 text-[#2D5A63]" />
              <span className="hidden sm:inline">صفحه اصلی</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
