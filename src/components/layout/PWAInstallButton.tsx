import React, { useState } from 'react';
import { Download, Smartphone, WifiOff } from 'lucide-react';
import { useOnlineStatus, usePWAInstall } from '../../hooks/usePWAInstall';
import { detectRuntimePlatform, isNativeInstalledRuntime } from '../../utils/platformBridge';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showGuide, setShowGuide] = useState(false);

  if (isNativeInstalledRuntime()) {
    const platform = detectRuntimePlatform();
    return compact ? null : (
      <div className="rounded-lg border border-[#D5DEC8] bg-[#F2F6EE] px-3.5 py-2 text-xs text-[#2D6A4F]">
        {platform === 'electron'
          ? 'نسخه مستقل دسکتاپ ویندوز نصب و فعال است.'
          : 'اپلیکیشن مستقل اندروید نصب و فعال است.'}
      </div>
    );
  }

  if (isInstalled) {
    return compact ? null : (
      <div className="rounded-lg border border-[#D5DEC8] bg-[#F2F6EE] px-3.5 py-2 text-xs text-[#2D6A4F]">
        نرم‌افزار با آیکون اختصاصی روی این دستگاه نصب و فعال است.
      </div>
    );
  }

  if (isInstallable) {
    return (
      <button
        type="button"
        onClick={install}
        className="inline-flex items-center gap-2 rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] transition-colors hover:bg-[#354F73] whitespace-nowrap shrink-0 cursor-pointer"
      >
        <Download className="h-3.5 w-3.5" />
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
          className="inline-flex items-center gap-2 rounded-lg border border-[#CEC7B6] bg-[#FFFFFF] px-3.5 py-2 text-xs font-medium text-[#263448] transition-colors hover:bg-[#F2EEE6] whitespace-nowrap shrink-0 cursor-pointer"
        >
          <Smartphone className="h-3.5 w-3.5 text-[#243B5A]" />
          <span>{isIOS ? 'راهنمای نصب روی iOS' : 'راهنمای نصب روی گوشی و سیستم'}</span>
        </button>

        {showGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#243B5A]/30 p-4">
            <div className="w-full max-w-md rounded-[var(--app-radius)] border border-[#CEC7B6] bg-[#FAF8F3] p-6">
              <div className="flex items-center gap-3">
                <img
                  src="./app-icon.png"
                  alt="آیکون نرم‌افزار دفتر فنی"
                  className="h-12 w-12 shrink-0 rounded-xl border border-[#D5C39E] bg-[#FBEFD7] object-cover"
                />
                <div>
                  <h3 className="text-sm font-bold text-[#243B5A]">
                    نصب نرم‌افزار دفتر فنی اداره گلزار شهدا
                  </h3>
                  <p className="text-[11px] text-[#5B6573]">
                    نصب با آیکون اختصاصی روی صفحه اصلی گوشی و دسکتاپ
                  </p>
                </div>
              </div>
              <div className="mt-4 space-y-2 text-xs leading-6 text-[#5B6573]">
                {isIOS ? (
                  <>
                    <p>۱. در مرورگر Safari دکمه اشتراک‌گذاری (Share) را لمس کنید.</p>
                    <p>۲. گزینه «Add to Home Screen» را انتخاب و تأیید کنید.</p>
                  </>
                ) : (
                  <p>
                    در مرورگرهای Chrome یا Edge (گوشی یا کامپیوتر)، از نوار آدرس یا منوی مرورگر گزینه
                    «Install App / افزودن به صفحه اصلی» را انتخاب کنید تا نرم‌افزار با آیکون اختصاصی
                    به‌صورت آفلاین و مستقل نصب شود.
                  </p>
                )}
              </div>
              <div className="mt-5 flex justify-end">
                <button
                  type="button"
                  onClick={() => setShowGuide(false)}
                  className="rounded-lg border border-[#243B5A] bg-[#243B5A] px-4 py-2 text-xs font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
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
