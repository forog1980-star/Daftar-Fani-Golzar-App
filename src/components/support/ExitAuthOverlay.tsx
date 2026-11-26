import React, { useState } from 'react';
import { AppSettings } from '../../types';
import { OFFICIAL_GOLZAR_LOGO } from '../../utils/officialAssets';

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
      <div className="w-full max-w-md rounded-xl border border-[#E2DDD2] bg-[#FFFFFF] p-7 space-y-5">
        <div className="border-b border-[#E8E5DE] pb-4 text-center">
          <img
            src={settings.officialLogoDataUrl || OFFICIAL_GOLZAR_LOGO}
            alt="آرم رسمی گلزار شهدای تهران"
            className="mx-auto h-14 w-auto max-w-[240px] object-contain"
          />
          <h2 className="mt-3 text-base font-semibold text-[#243B5A]">
            دفتر فنی اداره گلزار شهدا
          </h2>
          <p className="mt-1 text-xs leading-6 text-[#5B6573]">
            {mode === 'exited'
              ? 'نشست کاری شما با موفقیت بسته شد. تمام اطلاعات در حافظه محلی دستگاه ذخیره هستند.'
              : 'سامانه محلی مدیریت پروژه‌ها و اعتبارات'}
          </p>
        </div>

        {mode === 'login' && settings.auth.enabled ? (
          <form onSubmit={handleLogin} className="space-y-3.5">
            {error && (
              <div className="rounded-lg border border-[#D8B4B4] bg-[#FBF1F1] px-3 py-2 text-xs text-[#9E3B3B]">
                {error}
              </div>
            )}
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">نام کاربری</label>
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                dir="ltr"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs text-[#5B6573]">رمز عبور</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-[#D7D2C6] bg-[#FAF8F3] px-3 py-2 text-sm text-[#263448]"
                dir="ltr"
              />
            </div>
            <button
              type="submit"
              className="w-full rounded-lg border border-[#243B5A] bg-[#243B5A] py-2.5 text-sm font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
            >
              ورود به نرم‌افزار
            </button>
          </form>
        ) : (
          <div className="space-y-3">
            <button
              type="button"
              onClick={onEnterApp}
              className="w-full rounded-lg border border-[#243B5A] bg-[#243B5A] py-2.5 text-sm font-medium text-[#FAF8F3] hover:bg-[#354F73] cursor-pointer"
            >
              ورود مجدد به سامانه
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
