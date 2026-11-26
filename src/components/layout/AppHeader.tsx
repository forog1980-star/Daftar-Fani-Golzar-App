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
      <div className="mx-auto max-w-[1440px] px-3 py-2.5 sm:px-6 sm:py-3">
        {/* Desktop Header (md+): Single balanced row */}
        <div className="hidden md:flex items-center justify-between gap-4">
          <div className="flex items-center gap-3.5 min-w-0">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#E2DDD2] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2] lg:hidden cursor-pointer"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div
              className="flex shrink-0 items-center py-0.5"
              title="آرم رسمی گلزار شهدای تهران — بهشت زهرا (س)"
            >
              <img
                src={logoSrc}
                alt="آرم رسمی گلزار شهدای تهران"
                className="h-12 w-auto max-w-[210px] object-contain"
              />
            </div>

            <div className="h-9 w-px shrink-0 bg-[#DFD8CA]" aria-hidden="true" />

            <div className="min-w-0">
              <h1 className="text-lg font-bold leading-snug text-[#1D3250] lg:text-xl">
                دفتر فنی اداره گلزار شهدا
              </h1>
              <p className="text-xs text-[#566374]">
                سامانه محلی مدیریت پروژه‌ها و اعتبارات
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={onBack}
              className={`inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-xl border px-3.5 text-xs font-medium transition-colors whitespace-nowrap ${
                canGoBack
                  ? 'border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer'
                  : 'border-[#EAE4D8] bg-[#F5F2EB] text-[#9BA3AE] cursor-default'
              }`}
              title="بازگشت به صفحه قبلی"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              <span>بازگشت</span>
            </button>

            <button
              type="button"
              onClick={onOpenGuide}
              className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-3.5 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap cursor-pointer"
              title="راهنما"
            >
              <HelpCircle className="h-4 w-4 text-[#243B5A]" />
              <span>راهنما</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex h-9 min-w-[94px] items-center justify-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-3.5 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap cursor-pointer"
              title="تنظیمات"
            >
              <Settings className="h-4 w-4 text-[#243B5A]" />
              <span>تنظیمات</span>
            </button>
          </div>
        </div>

        {/* Mobile Header (< md): Row 1 ONLY hamburger + official Golzar logo; Row 2 title + 3 aligned buttons */}
        <div className="flex flex-col gap-2.5 md:hidden">
          <div className="flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={onToggleMobileMenu}
              className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
              aria-label="باز کردن منو"
            >
              <Menu className="h-5 w-5" />
            </button>

            <div className="flex flex-1 items-center justify-center">
              <img
                src={logoSrc}
                alt="آرم رسمی گلزار شهدای تهران"
                className="h-10 w-auto max-w-[220px] object-contain"
              />
            </div>

            {/* Visual balance spacer matching menu button width so logo stays perfectly centered */}
            <div className="h-10 w-10 shrink-0" aria-hidden="true" />
          </div>

          <div className="text-center">
            <h1 className="text-sm font-bold text-[#1D3250]">
              دفتر فنی اداره گلزار شهدا
            </h1>
            <p className="text-[11px] text-[#566374]">
              سامانه محلی مدیریت پروژه‌ها و اعتبارات
            </p>
          </div>

          {/* 3 Equal-Width Aligned Mobile Action Buttons on Second Line */}
          <div className="grid grid-cols-3 gap-2">
            <button
              type="button"
              disabled={!canGoBack}
              onClick={onBack}
              className={`inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border px-2 text-xs font-medium transition-colors ${
                canGoBack
                  ? 'border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer'
                  : 'border-[#EAE4D8] bg-[#F5F2EB] text-[#9BA3AE] cursor-default'
              }`}
            >
              <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              <span>بازگشت</span>
            </button>

            <button
              type="button"
              onClick={onOpenGuide}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-2 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <HelpCircle className="h-3.5 w-3.5 shrink-0 text-[#243B5A]" />
              <span>راهنما</span>
            </button>

            <button
              type="button"
              onClick={onOpenSettings}
              className="inline-flex h-9 items-center justify-center gap-1.5 rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] px-2 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
            >
              <Settings className="h-3.5 w-3.5 shrink-0 text-[#243B5A]" />
              <span>تنظیمات</span>
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
