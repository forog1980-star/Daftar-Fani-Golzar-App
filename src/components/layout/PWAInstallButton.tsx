import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isInstalled) {
    return compact ? null : (
      <div className="border border-[#D5DEC8] bg-[#F2F6EE] px-4 py-3 text-sm text-[#2D6A4F]">
        نرم‌افزار به صورت مستقل (PWA) روی این دستگاه نصب و فعال است.
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-sm font-medium text-[#FAF8F3] transition-colors hover:bg-[#234850] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-4 w-4" />
        <span>نصب نرم‌افزار روی دستگاه</span>
      </button>
    );
  }

  if (isIOS || !compact) {
    return (
      <>
        <button
          type="button"
          onClick={() => setShowGuide(true)}
          className="inline-flex items-center gap-2 border border-[#CEC7B6] bg-[#FFFFFF] px-4 py-2 text-sm font-medium text-[#2B3033] transition-colors hover:bg-[#F3EFE6] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="h-4 w-4 text-[#2D5A63]" />
          <span>{isIOS ? 'راهنمای نصب روی iOS' : 'راهنمای نصب PWA'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#2B3033]/35 p-4">
            <div className="w-full max-w-md border border-[#CEC7B6] bg-[#FAF8F3] p-6">
              <h3 className="text-base font-semibold text-[#2B3033]">
                نصب نرم‌افزار دفتر فنی اداره گلزار شهدا
              </h3>
              <div className="mt-3 space-y-2 text-sm leading-7 text-[#5B6268]">
                {isIOS ? (
                  <>
                    <p>۱. در مرورگر Safari دکمه اشتراک‌گذاری (Share) را لمس کنید.</p>
                    <p>۲. گزینه «Add to Home Screen» را انتخاب و تأیید کنید.</p>
                  </>
                ) : (
                  <>
                    <p>
                      در مرورگرهای Chrome یا Edge، از نوار آدرس یا منوی مرورگر گزینه
                      «Install App / افزودن به صفحه اصلی» را انتخاب کنید تا نرم‌افزار به صورت
                      آفلاین و مستقل اجرا شود.
                    </p>
                  </>
                )}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="border border-[#2D5A63] bg-[#2D5A63] px-4 py-2 text-sm font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};

export const OfflineBanner: React.FC = () => {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="border-b border-[#E0CFA8] bg-[#F7F0DE] px-4 py-2 text-xs text-[#7D5417]">
      <div className="mx-auto flex max-w-6xl items-center gap-2">
        <WifiOff className="h-3.5 w-3.5 shrink-0" />
        <span>
          حالت آفلاین فعال است — تمام داده‌ها و پیوست‌ها به صورت محلی روی این دستگاه ذخیره و بازیابی می‌شوند.
        </span>
      </div>
    </div>
  );
};
