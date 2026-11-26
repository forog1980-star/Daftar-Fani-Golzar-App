import React, { useState } from 'react';
import { AppSettings } from '../../types';

interface ExitAuthOverlayProps {
  mode: 'exited' | 'login';
  settings: AppSettings;
  onEnterApp: () => void;
}

export const ExitAuthOverlay: React.FC<ExitAuthOverlayProps> = ({
  mode,
  settings,
  onEnterApp,
}) => {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    if (
      username.trim() === settings.auth.testUsername &&
      password.trim() === settings.auth.testPassword
    ) {
      setError('');
      onEnterApp();
    } else {
      setError('نام کاربری یا رمز عبور آزمایشی مطابقت ندارد.');
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-[#FAF8F3] p-4">
      <div className="w-full max-w-md border border-[#E2DDD0] bg-[#FFFFFF] p-7 space-y-5">
        <div className="border-b border-[#ECE7DA] pb-4 text-center">
          <div className="text-2xl font-semibold text-[#2D5A63]" dir="ltr">
            R
          </div>
          <h2 className="mt-2 text-base font-semibold text-[#2B3033]">
            دفتر فنی اداره گلزار شهدا
          </h2>
          <p className="mt-1 text-xs text-[#5B6268]">
            {mode === 'exited'
              ? 'نشست کاری شما به صورت ایمن بسته شد. تمام داده‌ها در حافظه محلی دستگاه ذخیره هستند.'
              : 'حالت آزمایشی ورود فعال است.'}
          </p>
        </div>

        {mode === 'login' && settings.auth.enabled ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            {error && (
              <div className="border border-[#DFC0C0] bg-[#FAF0F0] px-3 py-2 text-xs text-[#B43E3E]">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">نام کاربری</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6268]">رمز عبور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full border border-[#CEC7B6] bg-[#FAF8F3] px-3 py-2 text-sm"
                dir="ltr"
              />
            </div>
            <p className="text-[11px] leading-5 text-[#7C8287]">
              توجه: مقادیر 000 / 000 صرفاً جهت تست داخلی معماری ورود هستند و جایگزین سازوکار امنیت واقعی نیستند.
            </p>
            <button
              type="submit"
              className="w-full border border-[#2D5A63] bg-[#2D5A63] py-2.5 text-sm font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              ورود به نرم‌افزار
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onEnterApp}
              className="w-full border border-[#2D5A63] bg-[#2D5A63] py-2.5 text-sm font-medium text-[#FAF8F3] hover:bg-[#234850] cursor-pointer"
            >
              ورود مجدد به صفحه اصلی
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
