import React from 'react';
import {
  BarChart3,
  CheckSquare,
  FileText,
  FolderKanban,
  HardDrive,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Wallet,
  X,
} from 'lucide-react';
import { AppRoute } from '../../types';
import { useOnlineStatus } from '../../hooks/usePWAInstall';

interface SidebarNavProps {
  currentRoute: AppRoute;
  mobileOpen: boolean;
  onCloseMobile: () => void;
  onNavigate: (route: AppRoute) => void;
  onExit: () => void;
}

// Exact 8-item ordered right sidebar menu per Section 3
const MENU_ITEMS: Array<{
  route: AppRoute | 'exit';
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  { route: 'dashboard', label: 'داشبورد', icon: LayoutDashboard },
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
  onCloseMobile,
  onNavigate,
  onExit,
}) => {
  const isOnline = useOnlineStatus();

  const renderMenuContent = () => (
    <div className="flex h-full flex-col justify-between bg-[#FFFFFF] p-3.5">
      <nav className="space-y-1" aria-label="منوی اصلی نرم‌افزار">
        {MENU_ITEMS.map((item) => {
          const Icon = item.icon;
          const isExit = item.route === 'exit';
          const isActive =
            item.route === currentRoute ||
            (item.route === 'projects' && currentRoute === 'project-detail') ||
            (item.route === 'dashboard' && currentRoute === 'home');

          return (
            <button
              key={item.route}
              type="button"
              onClick={() => {
                onCloseMobile();
                if (isExit) {
                  onExit();
                } else {
                  onNavigate(item.route as AppRoute);
                }
              }}
              className={`flex w-full items-center gap-3 rounded-lg px-3.5 py-2.5 text-right text-sm transition-colors cursor-pointer ${
                isExit
                  ? 'mt-3 border-t border-[#E8E5DE] pt-3 text-[#9E3B3B] hover:bg-[#FBF1F1]'
                  : isActive
                    ? 'bg-[#243B5A] font-medium text-[#FAF8F3]'
                    : 'text-[#263448] hover:bg-[#F2EEE6]'
              }`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isExit
                    ? 'text-[#9E3B3B]'
                    : isActive
                      ? 'text-[#B99A62]'
                      : 'text-[#354F73]'
                }`}
              />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Local-First Offline Status Footer */}
      <div className="mt-6 rounded-lg border border-[#E2DDD2] bg-[#FAF8F3] p-3 text-[11px] leading-5 text-[#5B6573]">
        <div className="flex items-center gap-1.5 font-medium text-[#243B5A]">
          <HardDrive className="h-3.5 w-3.5 text-[#354F73]" />
          <span>ذخیره‌سازی محلی</span>
        </div>
        <p className="mt-1">
          {isOnline
            ? 'آفلاین؛ داده‌ها در دستگاه شما ذخیره شده‌اند.'
            : 'آفلاین (بدون اینترنت)؛ داده‌ها در دستگاه شما ذخیره شده‌اند.'}
        </p>
      </div>
    </div>
  );

  return (
    <>
      {/* Desktop Persistent Right Sidebar */}
      <aside className="hidden w-60 shrink-0 border-l border-[#E2DDD2] bg-[#FFFFFF] lg:block">
        <div className="sticky top-[68px] h-[calc(100vh-68px)] overflow-y-auto">
          {renderMenuContent()}
        </div>
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 flex lg:hidden">
          <div className="relative flex w-64 max-w-[82vw] flex-col border-l border-[#D9D4C8] bg-[#FFFFFF]">
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
            <div className="flex-1 overflow-y-auto">{renderMenuContent()}</div>
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
