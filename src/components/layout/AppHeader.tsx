import React from 'react';
import { ArrowRight, HelpCircle, Menu, Settings } from 'lucide-react';
import { AppRoute } from '../../types';

interface AppHeaderProps {
  route: AppRoute;
  canGoBack: boolean;
  officialLogoDataUrl?: string;
  onBack: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
  onToggleMobileMenu: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  canGoBack,
  officialLogoDataUrl,
  onBack,
  onOpenSettings,
  onOpenGuide,
  onToggleMobileMenu,
}) => {
  return (
    <header className="sticky top-0 z-30 border-b border-[#D9D4C8] bg-[#FFFFFF]">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-3 px-4 py-3 sm:px-6">
        {/* Right side (RTL start): Mobile menu button + Official Logo slot + Title & Subtitle */}
        <div className="flex items-center gap-3 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-[#D9D4C8] bg-[#FAF8F3] text-[#243B5A] hover:bg-[#E5EBF2] lg:hidden cursor-pointer"
            aria-label="باز کردن منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Official Logo Placeholder / Uploaded Employer Logo (Section 11) */}
          <div
            className="flex h-11 w-11 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-[#D9D4C8] bg-[#FAF8F3] p-1"
            title={officialLogoDataUrl ? 'آرم رسمی دفتر فنی اداره گلزار شهدا' : 'جایگاه موقت آرم رسمی دفتر فنی'}
          >
            {officialLogoDataUrl ? (
              <img
                src={officialLogoDataUrl}
                alt="آرم رسمی دفتر فنی اداره گلزار شهدا"
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full flex-col items-center justify-center rounded bg-[#243B5A] text-[#FAF8F3]">
                <span className="text-[10px] font-semibold leading-tight">دفتر</span>
                <span className="text-[9px] text-[#B99A62] leading-tight">فنی</span>
              </div>
            )}
          </div>

          <div className="min-w-0">
            <h1 className="truncate text-sm font-semibold text-[#243B5A] sm:text-base">
              دفتر فنی اداره گلزار شهدا
            </h1>
            <p className="truncate text-[11px] text-[#5B6573] sm:text-xs">
              سامانه محلی مدیریت پروژه‌ها و اعتبارات
            </p>
          </div>
        </div>

        {/* Left side (RTL end): Settings, Guide, Back */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] px-2.5 text-xs font-medium text-[#263448] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap shrink-0 cursor-pointer"
            title="تنظیمات"
          >
            <Settings className="h-4 w-4 text-[#243B5A]" />
            <span className="hidden sm:inline">تنظیمات</span>
          </button>

          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] px-2.5 text-xs font-medium text-[#263448] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap shrink-0 cursor-pointer"
            title="راهنما"
          >
            <HelpCircle className="h-4 w-4 text-[#243B5A]" />
            <span className="hidden sm:inline">راهنما</span>
          </button>

          {canGoBack && (
            <button
              type="button"
              onClick={onBack}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg border border-[#243B5A] bg-[#243B5A] px-3 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] whitespace-nowrap shrink-0 cursor-pointer"
            >
              <ArrowRight className="h-3.5 w-3.5" />
              <span>بازگشت</span>
            </button>
          )}
        </div>
      </div>
    </header>
  );
};
