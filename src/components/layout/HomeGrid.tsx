import React from 'react';
import {
  BarChart3,
  CheckSquare,
  FileText,
  FolderKanban,
  HelpCircle,
  LayoutDashboard,
  LogOut,
  Wallet,
} from 'lucide-react';
import { AppRoute } from '../../types';

interface HomeGridProps {
  onNavigate: (route: AppRoute) => void;
  onExit: () => void;
  hasSampleData: boolean;
}

const MAIN_SECTIONS: Array<{
  route: AppRoute;
  title: string;
  subtitle: string;
  icon: React.ComponentType<{ className?: string }>;
}> = [
  {
    route: 'dashboard',
    title: 'داشبورد',
    subtitle: 'وضعیت واقعی پروژه‌ها، اقدامات فوری، مهلت‌ها و آخرین تغییرات',
    icon: LayoutDashboard,
  },
  {
    route: 'projects',
    title: 'پرونده پروژه‌ها',
    subtitle: 'مشخصات، مراحل اجرایی قابل تنظیم، قراردادها و پیوست‌های هر پروژه',
    icon: FolderKanban,
  },
  {
    route: 'budget',
    title: 'بودجه و اعتبارات',
    subtitle: 'اعتبارات مصوب و تخصیصی، پرداخت‌ها، مانده اعتبار و پیشنهاد بودجه سال آینده',
    icon: Wallet,
  },
  {
    route: 'actions',
    title: 'اقدامات و پیگیری‌ها',
    subtitle: 'ثبت، پیگیری، اولویت‌بندی اقدامات فوری، عقب‌افتاده و تکمیل‌شده',
    icon: CheckSquare,
  },
  {
    route: 'documents',
    title: 'اسناد و مکاتبات',
    subtitle: 'نامه‌ها، صورتجلسات، پیوست‌ها و فرم‌ساز سازمانی',
    icon: FileText,
  },
  {
    route: 'reports',
    title: 'گزارش‌ها',
    subtitle: 'تهیه گزارش‌های مدیریتی و خروجی Word، Excel، PDF و JSON',
    icon: BarChart3,
  },
];

export const HomeGrid: React.FC<HomeGridProps> = ({
  onNavigate,
  onExit,
  hasSampleData,
}) => {
  return (
    <div className="animate-page-in mx-auto max-w-5xl px-4 py-8 sm:px-6 sm:py-12">
      <div className="mb-8 border-b border-[#E2DDD0] pb-6">
        <h2 className="text-2xl font-semibold text-[#2B3033]">
          دفتر فنی اداره گلزار شهدا
        </h2>
        <p className="mt-1.5 text-sm text-[#5B6268]">
          سامانه محلی مدیریت پرونده پروژه‌ها، اعتبارات، اقدامات، اسناد و گزارش‌های دفتر فنی
        </p>
        {hasSampleData && (
          <p className="mt-3 text-xs text-[#8C6423]">
            توجه: بخشی از رکوردهای فعلی داده‌های آزمایشی نمونه جهت بررسی عملکرد نرم‌افزار هستند و اطلاعات واقعی سازمان محسوب نمی‌شوند (قابل حذف از بخش پشتیبانی).
          </p>
        )}
      </div>

      {/* 6 Main Sections */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {MAIN_SECTIONS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.route}
              type="button"
              onClick={() => onNavigate(item.route)}
              className="group flex flex-col items-start justify-between border border-[#E2DDD0] bg-[#FFFFFF] p-6 text-right transition-colors hover:border-[#2D5A63] hover:bg-[#F8F5EC] cursor-pointer"
            >
              <div className="mb-5 flex h-11 w-11 items-center justify-center border border-[#E2DDD0] bg-[#FAF8F3] text-[#2D5A63] transition-colors group-hover:border-[#2D5A63] group-hover:bg-[#E5EFF0]">
                <Icon className="h-5 w-5" />
              </div>
              <div>
                <div className="text-base font-semibold text-[#2B3033]">
                  {item.title}
                </div>
                <p className="mt-1.5 text-xs leading-6 text-[#5B6268]">
                  {item.subtitle}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Two Secondary Options: Support & Exit */}
      <div className="mt-8 grid grid-cols-1 gap-4 border-t border-[#E2DDD0] pt-6 sm:grid-cols-2">
        <button
          type="button"
          onClick={() => onNavigate('support')}
          className="flex items-center gap-4 border border-[#E2DDD0] bg-[#F3EFE6] px-5 py-4 text-right transition-colors hover:border-[#2D5A63] hover:bg-[#ECE7DA] cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#D4CEBF] bg-[#FAF8F3] text-[#2D5A63]">
            <HelpCircle className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#2B3033]">پشتیبانی</div>
            <div className="mt-0.5 text-xs text-[#5B6268]">
              راهنما، تنظیمات، اشخاص و امضاها، پشتیبان‌گیری و ارتباط بین دستگاه‌ها
            </div>
          </div>
        </button>

        <button
          type="button"
          onClick={onExit}
          className="flex items-center gap-4 border border-[#E2DDD0] bg-[#F3EFE6] px-5 py-4 text-right transition-colors hover:border-[#B43E3E] hover:bg-[#F7ECEC] cursor-pointer"
        >
          <div className="flex h-10 w-10 shrink-0 items-center justify-center border border-[#D4CEBF] bg-[#FAF8F3] text-[#7A3E3E]">
            <LogOut className="h-5 w-5" />
          </div>
          <div>
            <div className="text-sm font-semibold text-[#2B3033]">خروج</div>
            <div className="mt-0.5 text-xs text-[#5B6268]">
              پایان نشست کاری و بازگشت به صفحه وضعیت ورود
            </div>
          </div>
        </button>
      </div>
    </div>
  );
};
