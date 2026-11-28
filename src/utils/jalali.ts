// Deterministic, zero-dependency Jalali (Solar Hijri / Shamsi) <-> Gregorian calendar engine.
// Based on the proven Kazimierz Borkowski astronomical/arithmetical Jalaali algorithm
// (exact across years 1300–1500 SH / 1921–2121 AD, completely immune to Android/iOS Intl fallbacks or UTC shifts).

export interface JalaliDateParts {
  jy: number;
  jm: number; // 1..12
  jd: number; // 1..31
}

export interface GregorianDateParts {
  gy: number;
  gm: number; // 1..12
  gd: number; // 1..31
}

export const JALALI_MONTH_NAMES = [
  'فروردین',
  'اردیبهشت',
  'خرداد',
  'تیر',
  'مرداد',
  'شهریور',
  'مهر',
  'آبان',
  'آذر',
  'دی',
  'بهمن',
  'اسفند',
] as const;

export const JALALI_WEEKDAY_SHORT = ['ش', 'ی', 'د', 'س', 'چ', 'پ', 'ج'] as const;

export function toEnglishDigits(input: string): string {
  return input
    .replace(/[۰-۹]/g, (d) => String(d.charCodeAt(0) - 0x06f0))
    .replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
}

function div(a: number, b: number): number {
  return Math.trunc(a / b);
}

function mod(a: number, b: number): number {
  return a - Math.trunc(a / b) * b;
}

const BREAKS = [
  -61, 9, 38, 199, 426, 686, 756, 818, 1111, 1181, 1210, 1635, 2060, 2097, 2192, 2262, 2324, 2394,
  2456, 3178,
];

function jalCal(jy: number): { leap: number; gy: number; march: number } {
  const bl = BREAKS.length;
  const gy = jy + 621;
  let leapJ = -14;
  let jp = BREAKS[0];
  let jump = 0;

  for (let i = 1; i < bl; i += 1) {
    const jm = BREAKS[i];
    jump = jm - jp;
    if (jy < jm) break;
    leapJ = leapJ + div(jump, 33) * 8 + div(mod(jump, 33), 4);
    jp = jm;
  }

  let n = jy - jp;
  leapJ = leapJ + div(n, 33) * 8 + div(mod(n, 33) + 3, 4);
  if (mod(jump, 33) === 4 && jump - n === 4) {
    leapJ += 1;
  }

  const leapG = div(gy, 4) - div((div(gy, 100) + 1) * 3, 4) - 150;
  const march = 20 + leapJ - leapG;

  if (jump - n < 6) {
    n = n - jump + div(jump + 4, 33) * 33;
  }
  let leap = mod(mod(n + 1, 33) - 1, 4);
  if (leap === -1) {
    leap = 4;
  }

  return { leap, gy, march };
}

function g2d(gy: number, gm: number, gd: number): number {
  let d =
    div((gy + div(gm - 8, 6) + 100100) * 1461, 4) +
    div(153 * mod(gm + 9, 12) + 2, 5) +
    gd -
    34840408;
  d = d - div(div(gy + 100100 + div(gm - 8, 6), 100) * 3, 4) + 752;
  return d;
}

function d2g(jdn: number): GregorianDateParts {
  let j = 4 * jdn + 139361631;
  j = j + div(div(4 * jdn + 183187720, 146097) * 3, 4) * 4 - 3908;
  const i = div(mod(j, 1461), 4) * 5 + 308;
  const gd = div(mod(i, 153), 5) + 1;
  const gm = mod(div(i, 153), 12) + 1;
  const gy = div(j, 1461) - 100100 + div(8 - gm, 6);
  return { gy, gm, gd };
}

function j2d(jy: number, jm: number, jd: number): number {
  const r = jalCal(jy);
  return g2d(r.gy, 3, r.march) + (jm - 1) * 31 - div(jm, 7) * (jm - 7) + jd - 1;
}

function d2j(jdn: number): JalaliDateParts {
  const gy = d2g(jdn).gy;
  let jy = gy - 621;
  const r = jalCal(jy);
  const jdn1f = g2d(gy, 3, r.march);
  let k = jdn - jdn1f;

  if (k >= 0) {
    if (k <= 185) {
      const jm = 1 + div(k, 31);
      const jd = mod(k, 31) + 1;
      return { jy, jm, jd };
    }
    k -= 186;
  } else {
    jy -= 1;
    k += 179;
    if (r.leap === 1) k += 1;
  }

  const jm = 7 + div(k, 30);
  const jd = mod(k, 30) + 1;
  return { jy, jm, jd };
}

export function gregorianToJalali(gy: number, gm: number, gd: number): JalaliDateParts {
  return d2j(g2d(gy, gm, gd));
}

export function jalaliToGregorian(jy: number, jm: number, jd: number): GregorianDateParts {
  return d2g(j2d(jy, jm, jd));
}

export function isJalaliLeapYear(jy: number): boolean {
  return jalCal(jy).leap === 0;
}

export function jalaliMonthLength(jy: number, jm: number): number {
  if (jm <= 6) return 31;
  if (jm <= 11) return 30;
  return isJalaliLeapYear(jy) ? 30 : 29;
}

// Returns 0 for Saturday (شنبه) .. 6 for Friday (جمعه)
export function getJalaliMonthFirstWeekday(jy: number, jm: number): number {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, 1);
  const jsDay = new Date(gy, gm - 1, gd).getDay(); // 0=Sun..6=Sat
  return (jsDay + 1) % 7; // 0=Sat, 1=Sun, 2=Mon, 3=Tue, 4=Wed, 5=Thu, 6=Fri
}

export function todayJalaliParts(): JalaliDateParts {
  const now = new Date();
  return gregorianToJalali(now.getFullYear(), now.getMonth() + 1, now.getDate());
}

export function jalaliPartsToIso(jy: number, jm: number, jd: number): string {
  const { gy, gm, gd } = jalaliToGregorian(jy, jm, jd);
  return `${String(gy).padStart(4, '0')}-${String(gm).padStart(2, '0')}-${String(gd).padStart(2, '0')}`;
}

export function jalaliPartsToString(parts: JalaliDateParts): string {
  return `${String(parts.jy).padStart(4, '0')}/${String(parts.jm).padStart(2, '0')}/${String(parts.jd).padStart(2, '0')}`;
}

// Parses either ISO YYYY-MM-DD, ISO datetime string, or Jalali 14xx/mm/dd into JalaliDateParts
export function parseAnyDateToJalaliParts(input?: string): JalaliDateParts | null {
  if (!input || !input.trim()) return null;
  const clean = toEnglishDigits(input.trim());

  // Already a Jalali date string (e.g. 1405/09/06 or 1405-9-6)
  const jMatch = clean.match(/^(1[2345]\d{2})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (jMatch) {
    const jy = Number(jMatch[1]);
    const jm = Number(jMatch[2]);
    const jd = Number(jMatch[3]);
    if (jm >= 1 && jm <= 12 && jd >= 1 && jd <= jalaliMonthLength(jy, jm)) {
      return { jy, jm, jd };
    }
    return null;
  }

  // Date-only ISO string YYYY-MM-DD (parsed as pure calendar date to avoid UTC off-by-one shift!)
  const isoDateOnly = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateOnly) {
    const gy = Number(isoDateOnly[1]);
    const gm = Number(isoDateOnly[2]);
    const gd = Number(isoDateOnly[3]);
    if (gy >= 1900 && gy <= 2200 && gm >= 1 && gm <= 12 && gd >= 1 && gd <= 31) {
      return gregorianToJalali(gy, gm, gd);
    }
    return null;
  }

  // Full ISO timestamp (uses local calendar date of the user's device)
  const d = new Date(clean);
  if (!Number.isNaN(d.getTime())) {
    return gregorianToJalali(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }

  return null;
}

// Parses user-typed Jalali input (e.g. "1405/09/15" or "۱۴۰۵/۹/۱۵") into canonical ISO "YYYY-MM-DD"
export function parseJalaliInputToIso(raw: string): string | null {
  const clean = toEnglishDigits(raw.trim()).replace(/[.،\s]+/g, '/');
  const match = clean.match(/^(1[2345]\d{2})[/-](\d{1,2})[/-](\d{1,2})$/);
  if (!match) return null;
  const jy = Number(match[1]);
  const jm = Number(match[2]);
  const jd = Number(match[3]);
  if (jm < 1 || jm > 12) return null;
  const maxDay = jalaliMonthLength(jy, jm);
  if (jd < 1 || jd > maxDay) return null;
  return jalaliPartsToIso(jy, jm, jd);
}

// Converts ISO date or Jalali date string into local midnight Date for accurate day-diff calculations
export function parseAnyDateToLocalDate(input?: string): Date | null {
  if (!input || !input.trim()) return null;
  const clean = toEnglishDigits(input.trim());

  const isoDateOnly = clean.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  if (isoDateOnly) {
    return new Date(Number(isoDateOnly[1]), Number(isoDateOnly[2]) - 1, Number(isoDateOnly[3]));
  }

  const jIso = parseJalaliInputToIso(clean);
  if (jIso) {
    const [y, m, d] = jIso.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  const d = new Date(clean);
  if (Number.isNaN(d.getTime())) return null;
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}
