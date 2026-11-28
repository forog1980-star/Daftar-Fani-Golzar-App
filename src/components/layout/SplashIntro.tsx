import React, { useEffect } from 'react';
import { OFFICIAL_GOLZAR_LOGO } from '../../utils/officialAssets';
import { isNativeInstalledRuntime } from '../../utils/platformBridge';

interface SplashIntroProps {
  logoUrl?: string;
  onComplete: () => void;
}

export const SplashIntro: React.FC<SplashIntroProps> = ({ logoUrl, onComplete }) => {
  const isNative = isNativeInstalledRuntime();
  const durationMs = isNative ? 1600 : 3200;

  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, durationMs);
    return () => clearTimeout(timer);
  }, [durationMs, onComplete]);

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onComplete}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') onComplete();
      }}
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[#FAF8F3] px-6 cursor-pointer"
      aria-label="صفحه آغازین دفتر فنی اداره گلزار شهدا — برای ورود فوری لمس یا کلیک کنید"
    >
      <div
        className={`${isNative ? 'animate-splash-logo-fast' : 'animate-splash-logo'} flex flex-col items-center justify-center select-none`}
      >
        <img
          src={logoUrl || OFFICIAL_GOLZAR_LOGO}
          alt="آرم رسمی گلزار شهدای تهران"
          className="h-auto w-[250px] max-w-[82vw] object-contain sm:w-[340px]"
        />
      </div>
    </div>
  );
};
