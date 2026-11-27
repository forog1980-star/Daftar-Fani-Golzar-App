import React from 'react';
import { ArrowLeft, Menu } from 'lucide-react';
import { AppRoute } from '../../types';
import { OFFICIAL_GOLZAR_LOGO } from '../../utils/officialAssets';

interface AppHeaderProps {
  route: AppRoute;
  pageTitle: string;
  pageSubtitle?: string;
  canGoBack: boolean;
  backTooltip?: string;
  officialLogoDataUrl?: string;
  onBack: () => void;
  onToggleMobileMenu: () => void;
}

export const AppHeader: React.FC<AppHeaderProps> = ({
  route,
  pageTitle,
  pageSubtitle,
  canGoBack,
  backTooltip,
  officialLogoDataUrl,
  onBack,
  onToggleMobileMenu,
}) => {
  const logoSrc = officialLogoDataUrl || OFFICIAL_GOLZAR_LOGO;
  const isDashboard = route === 'dashboard' || route === 'home';

  return (
    <header
      className={
        isDashboard
          ? 'relative z-20 border-b border-[#D5C39E]/75 bg-[#FAF8F3]'
          : 'sticky top-0 z-30 border-b border-[#D5C39E]/75 bg-[#FAF8F3]/95 backdrop-blur-sm'
      }
    >
      <div className="mx-auto max-w-[1440px] px-3 py-2.5 sm:px-6">
        {isDashboard ? (
          <>
            {/* Dashboard Desktop Header (lg+): Clean official logo + title ONLY (no redundant buttons) */}
            <div className="hidden lg:flex items-center gap-3.5 py-0.5">
              <div
                className="flex shrink-0 items-center"
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
                <h1 className="text-xl font-bold leading-snug text-[#1D3250]">
                  دفتر فنی اداره گلزار شهدا
                </h1>
                <p className="text-xs text-[#566374]">
                  سامانه محلی مدیریت پروژه‌ها و اعتبارات
                </p>
              </div>
            </div>

            {/* Dashboard Mobile & Tablet Header (< lg): ONLY hamburger menu + official logo + clean title */}
            <div className="flex flex-col gap-1.5 lg:hidden">
              <div className="flex items-center justify-between gap-2">
                <button
                  type="button"
                  onClick={onToggleMobileMenu}
                  className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2] cursor-pointer"
                  aria-label="باز کردن منو"
                >
                  <Menu className="h-5 w-5" />
                </button>

                <div className="flex min-w-0 flex-1 items-center justify-center px-1">
                  <img
                    src={logoSrc}
                    alt="آرم رسمی گلزار شهدای تهران"
                    className="h-9 sm:h-10 w-auto max-w-full object-contain"
                  />
                </div>

                {/* Balance spacer so logo stays centered */}
                <div className="h-10 w-10 shrink-0" aria-hidden="true" />
              </div>

              <div className="text-center">
                <h1 className="text-sm sm:text-base font-bold leading-snug text-[#1D3250]">
                  دفتر فنی اداره گلزار شهدا
                </h1>
                <p className="text-[11px] text-[#566374]">
                  سامانه محلی مدیریت پروژه‌ها و اعتبارات
                </p>
              </div>
            </div>
          </>
        ) : (
          /* Inner Pages Header (Mobile & Desktop): ONLY page title + compact Back button (NO logo, NO brand header, NO Help/Settings) */
          <div className="flex min-h-[42px] items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <button
                type="button"
                onClick={onToggleMobileMenu}
                className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-[#DFD8CA] bg-[#FFFFFF] text-[#243B5A] hover:bg-[#E5EBF2] lg:hidden cursor-pointer"
                aria-label="باز کردن منو"
              >
                <Menu className="h-4.5 w-4.5" />
              </button>

              <div className="min-w-0">
                <h1 className="truncate text-sm font-bold leading-snug text-[#1D3250] sm:text-base lg:text-lg">
                  {pageTitle}
                </h1>
                {pageSubtitle && (
                  <p className="truncate text-[11px] text-[#566374]">{pageSubtitle}</p>
                )}
              </div>
            </div>

            {canGoBack && (
              <button
                type="button"
                onClick={onBack}
                className="inline-flex h-8 shrink-0 items-center justify-center gap-1 rounded-lg border border-[#DFD8CA] bg-[#FFFFFF] px-2.5 text-xs font-medium text-[#243B5A] transition-colors hover:border-[#243B5A] hover:bg-[#E5EBF2] whitespace-nowrap cursor-pointer"
                title={backTooltip || 'بازگشت به صفحه قبل'}
              >
                <span>بازگشت</span>
                <ArrowLeft className="h-3.5 w-3.5 shrink-0" />
              </button>
            )}
          </div>
        )}
      </div>
    </header>
  );
};
