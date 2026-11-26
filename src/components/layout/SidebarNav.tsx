import React from 'react';
import {
  BarChart3,
  CheckSquare,
  FileText,
  FolderKanban,
  HelpCircle,
  Home,
  LogOut,
  Wallet,
  X,
} from 'lucide-react';
import { AppRoute, GolzarImageRecord } from '../../types';
import { GolzarGalleryWidget } from '../dashboard/GolzarGalleryWidget';

interface SidebarNavProps {
  currentRoute: AppRoute;
  mobileOpen: boolean;
  golzarImages: GolzarImageRecord[];
  onCloseMobile: () => void;
  onNavigate: (route: AppRoute) => void;
  onOpenGolzarManager: () => void;
  onExit: () => void;
}

// Exact 8-item ordered right sidebar menu
const MENU_ITEMS: Array<{
  route: AppRoute | 'exit';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { route: 'dashboard', label: 'داشبورد', icon: Home },
  { route: 'projects', label: 'پرونده پروژه‌ها', icon: FolderKanban },
  { route: 'budget', label: 'بودجه و اعتبارات', icon: Wallet },
  { route: 'actions', label: 'اقدامات و پیگیری‌ها', icon: CheckSquare },
  { route: 'documents', label: 'اسناد و مکاتبات', icon: FileText },
  { route: 'reports', label: 'گزارش‌ها', icon: BarChart3 },
  { route: 'support', label: 'پشتیبانی', icon: HelpCircle },
  { route: 'exit', label: 'خروج', icon: LogOut },
];

export const SidebarNav: React.FC<SidebarNavProps> = ({
  currentRoute,
  mobileOpen,
  golzarImages,
  onCloseMobile,
  onNavigate,
  onOpenGolzarManager,
  onExit,
}) => {
  const renderMenuContent = (includeGallery: boolean) => (
    <div className="flex h-full flex-col justify-between gap-4">
      <nav className="space-y-1" aria-label="منوی اصلی نرم‌افزار">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isExit = item.route === 'exit';
          const isActive =
            item.route === currentRoute ||
            (item.route === 'projects' && currentRoute === 'project-detail') ||
            (item.route === 'dashboard' && currentRoute === 'home');

          return (
            <div key={item.route} className={isExit ? 'mt-2 border-t border-[#ECE7DC] pt-2' : ''}>
              <button
                type="button"
                onClick={() => {
                  onCloseMobile();
                  if (isExit) {
                    onExit();
                  } else {
                    onNavigate(item.route as AppRoute);
                  }
                }}
                className={`flex w-full items-center gap-3 rounded-xl px-3.5 py-2.5 text-right text-sm transition-colors cursor-pointer ${
                  isExit
                    ? 'text-[#243B5A] hover:bg-[#FBF1F1] hover:text-[#9E3B3B]'
                    : isActive
                      ? 'bg-[#243B5A] font-semibold text-[#FAF8F3]'
                      : 'text-[#243B5A] hover:bg-[#F2EEE6]'
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isExit
                      ? 'text-[#354F73]'
                      : isActive
                        ? 'text-[#FAF8F3]'
                        : 'text-[#2F4A6F]'
                  }`}
                />
                <span className="truncate">{item.label}</span>
              </button>
            </div>
          );
        })}
      </nav>

      {/* Golzar Shohada Rotating Image Card in bottom of right sidebar (matching approved mockup) */}
      {includeGallery && (
        <div className="mt-auto pt-2">
          <GolzarGalleryWidget
            images={golzarImages}
            onManageClick={onOpenGolzarManager}
            variant="sidebar"
          />
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Right Sidebar Card */}
      <aside className="hidden w-56 shrink-0 py-4 pr-4 xl:w-60 xl:pr-6 lg:block">
        <div className="sticky top-[82px] flex max-h-[calc(100vh-98px)] flex-col overflow-y-auto rounded-2xl border border-[#E5E0D5] bg-[#FFFFFF] p-3">
          {renderMenuContent(true)}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="relative flex w-68 max-w-[84vw] flex-col border-l border-[#D9D4C8] bg-[#FFFFFF]">
            <div className="flex items-center justify-between border-b border-[#E8E5DE] bg-[#F2EEE6] px-4 py-3">
              <span className="text-sm font-semibold text-[#243B5A]">منوی دفتر فنی</span>
              <button
                type="button"
                onClick={onCloseMobile}
                className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#D7D2C6] bg-[#FFFFFF] text-[#263448] cursor-pointer"
                aria-label="بستن منو"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-3">{renderMenuContent(true)}</div>
          </div>
          <div
            className="flex-1 bg-[#243B5A]/30"
            onClick={onCloseMobile}
            aria-hidden="true"
          />
        </div>
      )}
    </>
  );
};
