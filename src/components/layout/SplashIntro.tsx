import React, { useEffect } from 'react';

interface SplashIntroProps {
  onComplete: () => void;
}

export const SplashIntro: React.FC<SplashIntroProps> = ({ onComplete }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onComplete();
    }, 1150);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[#FAF8F3]"
      aria-label="صفحه آغازین دفتر فنی اداره گلزار شهدا"
    >
      <div
        className="animate-splash-r select-none text-[120px] font-semibold leading-none tracking-tight text-[#243B5A]"
        dir="ltr"
      >
        R
      </div>
    </div>
  );
};
