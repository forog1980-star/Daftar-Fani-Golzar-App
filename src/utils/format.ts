import {
  jalaliPartsToString,
  parseAnyDateToJalaliParts,
  parseAnyDateToLocalDate,
} from './jalali';

export function generateId(prefix = 'rec'): string {
  const random = Math.random().toString(36).slice(2, 8);
  return `${prefix}_${Date.now().toString(36)}_${random}`;
}

export function getOrCreateDeviceId(): string {
  const key = 'daftar_fani_device_id';
  let id = localStorage.getItem(key);
  if (!id) {
    id = `dev_${Math.random().toString(36).slice(2, 10)}`;
    localStorage.setItem(key, id);
  }
  return id;
}

export function getDefaultDeviceName(): string {
  const ua = navigator.userAgent.toLowerCase();
  if (/android|iphone|ipad|mobile/.test(ua)) {
    return 'دستگاه موبایل دفتر فنی';
  }
  return 'رایانه دفتر فنی';
}

export function todayIsoDate(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function formatJalaliDate(iso?: string): string {
  if (!iso || !iso.trim()) return '—';
  const parts = parseAnyDateToJalaliParts(iso);
  if (parts) {
    return toPersianDigits(jalaliPartsToString(parts));
  }
  return toPersianDigits(iso);
}

export function formatJalaliDateTime(iso?: string): string {
  if (!iso || !iso.trim()) return '—';
  const parts = parseAnyDateToJalaliParts(iso);
  const d = new Date(iso);
  if (parts && !Number.isNaN(d.getTime())) {
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return toPersianDigits(`${jalaliPartsToString(parts)}، ${hh}:${mm}`);
  }
  if (parts) {
    return toPersianDigits(jalaliPartsToString(parts));
  }
  return toPersianDigits(iso);
}

export function toPersianDigits(value: string | number): string {
  const map: Record<string, string> = {
    '0': '۰',
    '1': '۱',
    '2': '۲',
    '3': '۳',
    '4': '۴',
    '5': '۵',
    '6': '۶',
    '7': '۷',
    '8': '۸',
    '9': '۹',
  };
  return String(value).replace(/[0-9]/g, (d) => map[d] ?? d);
}

export function formatAmount(amount: number | undefined | null): string {
  const num = Number(amount || 0);
  return new Intl.NumberFormat('fa-IR').format(Math.round(num));
}

export function formatRial(amount: number | undefined | null): string {
  return `${formatAmount(amount)} ریال`;
}

export function formatNumber(value: number | undefined | null): string {
  return new Intl.NumberFormat('fa-IR').format(Number(value || 0));
}

export function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${toPersianDigits(bytes)} بایت`;
  if (bytes < 1024 * 1024) return `${toPersianDigits((bytes / 1024).toFixed(1))} کیلوبایت`;
  return `${toPersianDigits((bytes / (1024 * 1024)).toFixed(2))} مگابایت`;
}

export function daysUntil(isoDate?: string): number | null {
  if (!isoDate) return null;
  const target = parseAnyDateToLocalDate(isoDate);
  if (!target) return null;
  const now = new Date();
  const startToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
  const startTarget = target.getTime();
  return Math.round((startTarget - startToday) / (1000 * 60 * 60 * 24));
}

export function isOverdue(dueDate?: string, status?: string): boolean {
  if (!dueDate) return false;
  if (status === 'تکمیل‌شده' || status === 'لغوشده') return false;
  const diff = daysUntil(dueDate);
  return diff !== null && diff < 0;
}

export function isUpcomingDeadline(dueDate?: string, status?: string, withinDays = 7): boolean {
  if (!dueDate) return false;
  if (status === 'تکمیل‌شده' || status === 'لغوشده') return false;
  const diff = daysUntil(dueDate);
  return diff !== null && diff >= 0 && diff <= withinDays;
}

export function sanitizeCsvOrXml(text: unknown): string {
  return String(text ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export function computeRecordFingerprint(record: Record<string, unknown>): string {
  const clone = { ...record };
  delete clone.updatedAt;
  delete clone.updatedByDevice;
  return JSON.stringify(clone);
}
