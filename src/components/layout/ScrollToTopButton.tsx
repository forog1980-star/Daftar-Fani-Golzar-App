import React, { useEffect, useState } from 'react';
import { ArrowUp } from 'lucide-react';

interface ScrollToTopButtonProps {
  /** Scroll offset in pixels after which the button becomes active */
  threshold?: number;
}

export const ScrollToTopButton: React.FC<ScrollToTopButtonProps> = ({ threshold = 420 }) => {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setVisible(window.scrollY >= threshold);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [threshold]);

  const scrollToTop = () => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  return (
    <button
      type="button"
      onClick={scrollToTop}
      aria-label="بازگشت به بالای صفحه"
      title="بازگشت به بالای صفحه"
      aria-hidden={!visible}
      tabIndex={visible ? 0 : -1}
      className={`fixed bottom-5 left-1/2 z-40 inline-flex h-11 w-11 -translate-x-1/2 items-center justify-center rounded-full border border-[#D5C39E] bg-[#243B5A] text-[#FAF8F3] transition-all duration-200 hover:bg-[#354F73] active:scale-95 cursor-pointer ${
        visible
          ? 'translate-y-0 opacity-100 pointer-events-auto'
          : 'translate-y-4 opacity-0 pointer-events-none'
      }`}
    >
      <ArrowUp className="h-5 w-5" />
    </button>
  );
};
