import React, { useEffect } from 'react';
import { OFFICIAL_GOLZAR_LOGO } from '../../utils/officialAssets';

interface SplashIntroProps {
  logoUrl?: string;
  onComplete: () => void;
}

export const SplashIntro: React.FC<SplashIntroProps> = ({ logoUrl, onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 6450);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF8F3] px-6"
      aria-label="صفحه آغازین دفتر فنی اداره گلزار شهدا"
    >
      <div className="animate-splash-logo flex flex-col items-center justify-center select-none">
        <img
          src={logoUrl || OFFICIAL_GOLZAR_LOGO}
          alt="آرم رسمی گلزار شهدای تهران"
          className="h-auto w-[250px] max-w-[82vw] object-contain sm:w-[340px]"
        />
      </div>
    </div>
  );
};
