import React from 'react';
import { ArrowLeft, HelpCircle, Menu, Settings } from 'lucide-react';
import { AppRoute } from '../../types';
import { OFFICIAL_GOLZAR_LOGO } from '../../utils/officialAssets';

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
  const logoSrc = officialLogoDataUrl || OFFICIAL_GOLZAR_LOGO;

  return (
    <header className="sticky top-0 z-30 border-b border-[#D5C39E]/75 bg-[#FAF8F3]/95 backdrop-blur-sm">
      <div className="mx-auto flex max-w-[1440px] items-center justify-between gap-2 px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Right side (RTL start): Mobile menu + Official Horizontal Golzar Shohada Logo + Title & Subtitle */}
        <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
          <button
            type="button"
            onClick={onToggleMobileMenu}
            className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2DDD2] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2] lg:hidden cursor-pointer"
            aria-label="باز کردن منو"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Official Horizontal Green & Gold Golzar Shohada Logo */}
          <div
            className="flex shrink-0 items-center py-0.5"
            title="آرم رسمی گلزار شهدای تهران — بهشت زهرا (س)"
          >
            <img
              src={logoSrc}
              alt="آرم رسمی گلزار شهدای تهران"
              className="h-9 w-auto max-w-[130px] object-contain sm:h-12 sm:max-w-[200px]"
            />
          </div>

          <div className="hidden h-8 w-px shrink-0 bg-[#DFD8CA] sm:block" aria-hidden="true" />

          <div className="min-w-0">
            <h1 className="truncate text-sm font-bold text-[#1D3250] sm:text-xl">
              دفتر فنی اداره گلزار شهدا
            </h1>
            <p className="truncate text-[11px] text-[#566374] sm:text-xs">
              سامانه محلی مدیریت پروژه‌ها و اعتبارات
            </p>
          </div>
        </div>

        {/* Left side (RTL end): Rounded Cream Action Buttons (Back, Guide, Settings) */}
        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            disabled={!canGoBack}
            onClick={onBack}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-2.5 sm:px-3.5 text-xs font-medium transition-colors whitespace-nowrap shrink-0 ${
              canGoBack
                ? 'border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer'
                : 'border-[#EAE4D8] bg-[#F5F2EB] text-[#9BA3AE] cursor-default'
            }`}
            title="بازگشت به صفحه قبلی"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">بازگشت</span>
          </button>

          <button
            type="button"
            onClick={onOpenGuide}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-2.5 sm:px-3.5 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap shrink-0 cursor-pointer"
            title="راهنما"
          >
            <HelpCircle className="h-4 w-4 text-[#243B5A]" />
            <span className="hidden sm:inline">راهنما</span>
          </button>

          <button
            type="button"
            onClick={onOpenSettings}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-2.5 sm:px-3.5 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap shrink-0 cursor-pointer"
            title="تنظیمات"
          >
            <Settings className="h-4 w-4 text-[#243B5A]" />
            <span className="hidden sm:inline">تنظیمات</span>
          </button>
        </div>
      </div>
    </header>
  );
};
