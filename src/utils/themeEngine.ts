import { AppearanceConfig } from '../types';
import { DEFAULT_APPEARANCE } from '../db/seedData';

export interface ThemePreset {
  id: string;
  name: string;
  tagline: string;
  primaryColor: string;
  headerColor: string;
  accentColor: string;
  canvasColor: string;
  cardSurface: string;
  softTint: string;
}

export const THEME_PRESETS: ThemePreset[] = [
  {
    id: 'navy-gold',
    name: 'سرمه‌ای و طلایی رسمی',
    tagline: 'کلاسیک اداری (پیش‌فرض)',
    primaryColor: '#243B5A',
    headerColor: '#354F73',
    accentColor: '#B99A62',
    canvasColor: '#FAF8F3',
    cardSurface: '#F2EEE6',
    softTint: '#E5EBF2',
  },
  {
    id: 'jade-ivory',
    name: 'سبز یشمی و عاجی',
    tagline: 'آرام، خوانا و متین',
    primaryColor: '#1E4D3B',
    headerColor: '#2B6650',
    accentColor: '#B89352',
    canvasColor: '#F6F9F6',
    cardSurface: '#EAF1EB',
    softTint: '#E0ECE5',
  },
  {
    id: 'persian-teal',
    name: 'فیروزه‌ای ایرانی',
    tagline: 'الهام‌گرفته از کاشی فیروزه',
    primaryColor: '#155263',
    headerColor: '#216C80',
    accentColor: '#C2955A',
    canvasColor: '#F4F8F9',
    cardSurface: '#E7F0F2',
    softTint: '#DCEBF0',
  },
  {
    id: 'burgundy-cream',
    name: 'زرشکی و کرم اصیل',
    tagline: 'وقار و اصالت سازمانی',
    primaryColor: '#6B2434',
    headerColor: '#843446',
    accentColor: '#B8925A',
    canvasColor: '#FAF7F5',
    cardSurface: '#F2E9E6',
    softTint: '#F2E3E6',
  },
  {
    id: 'walnut-parchment',
    name: 'قهوه‌ای چوبی و کاهی',
    tagline: 'گرم و مناسب مطالعه طولانی',
    primaryColor: '#4E3728',
    headerColor: '#694C39',
    accentColor: '#B78B4C',
    canvasColor: '#FAF7F1',
    cardSurface: '#F1EAE0',
    softTint: '#EFE6DA',
  },
  {
    id: 'royal-plum',
    name: 'ارغوانی اداری',
    tagline: 'متمایز و چشم‌نواز',
    primaryColor: '#43325E',
    headerColor: '#59457A',
    accentColor: '#B59663',
    canvasColor: '#F8F7FA',
    cardSurface: '#EEEBF4',
    softTint: '#E7E2F0',
  },
  {
    id: 'cobalt-ice',
    name: 'آبی کبود و نقره‌ای',
    tagline: 'شفاف، مهندسی و مدرن',
    primaryColor: '#1F4E79',
    headerColor: '#2E6699',
    accentColor: '#5E85AA',
    canvasColor: '#F5F8FB',
    cardSurface: '#E8EFF6',
    softTint: '#DFEAF4',
  },
  {
    id: 'charcoal-copper',
    name: 'ذغالی مدرن و مسی',
    tagline: 'مینیمال و پُرکنتراست',
    primaryColor: '#2C343E',
    headerColor: '#404B59',
    accentColor: '#B87B4B',
    canvasColor: '#F7F7F5',
    cardSurface: '#ECECE8',
    softTint: '#E4E7EB',
  },
];

export const PRIMARY_SWATCHES: Array<{ label: string; color: string; accent: string }> = [
  { label: 'سرمه‌ای رسمی', color: '#243B5A', accent: '#B99A62' },
  { label: 'سبز یشمی', color: '#1E4D3B', accent: '#B89352' },
  { label: 'فیروزه‌ای', color: '#155263', accent: '#C2955A' },
  { label: 'آبی کبود', color: '#1F4E79', accent: '#6288AC' },
  { label: 'سبز زیتونی', color: '#3B5232', accent: '#B69452' },
  { label: 'زرشکی اصیل', color: '#6B2434', accent: '#B8925A' },
  { label: 'ارغوانی', color: '#43325E', accent: '#B59663' },
  { label: 'قهوه‌ای چوبی', color: '#4E3728', accent: '#B78B4C' },
  { label: 'خاکستری سربی', color: '#394856', accent: '#B69664' },
  { label: 'ذغالی', color: '#2C343E', accent: '#B87B4B' },
];

export const CANVAS_SURFACE_PRESETS: Array<{
  id: string;
  label: string;
  canvas: string;
  surface: string;
}> = [
  { id: 'warm-cream', label: 'کرم گرم (پیش‌فرض)', canvas: '#FAF8F3', surface: '#F2EEE6' },
  { id: 'pure-paper', label: 'سفید کاغذی', canvas: '#F8F9FA', surface: '#EEF0F3' },
  { id: 'soft-mint', label: 'عاجی مریم‌گلی', canvas: '#F6F9F6', surface: '#EAF1EB' },
  { id: 'cool-mist', label: 'آبی بسیار ملایم', canvas: '#F4F8FB', surface: '#E7EFF6' },
  { id: 'warm-sand', label: 'کاهی ملایم', canvas: '#FAF6EE', surface: '#F0E8DA' },
  { id: 'stone-gray', label: 'طوسی سنگی', canvas: '#F5F5F3', surface: '#E9E9E4' },
];

export const RADIUS_PRESETS: Array<{ label: string; shortLabel: string; value: number }> = [
  { label: 'تیز و رسمی (۶ پیکسل)', shortLabel: 'رسمی', value: 6 },
  { label: 'استاندارد (۱۲ پیکسل)', shortLabel: 'استاندارد', value: 12 },
  { label: 'نرم و گرد (۱۶ پیکسل)', shortLabel: 'نرم', value: 16 },
];

function clamp(n: number, min = 0, max = 255): number {
  return Math.max(min, Math.min(max, Math.round(n)));
}

function parseHex(hex: string): [number, number, number] {
  const clean = hex.replace('#', '').trim();
  if (/^[0-9a-fA-F]{6}$/.test(clean)) {
    return [
      parseInt(clean.slice(0, 2), 16),
      parseInt(clean.slice(2, 4), 16),
      parseInt(clean.slice(4, 6), 16),
    ];
  }
  return [36, 59, 90];
}

function toHex(r: number, g: number, b: number): string {
  return (
    '#' +
    [clamp(r), clamp(g), clamp(b)]
      .map((v) => v.toString(16).padStart(2, '0'))
      .join('')
      .toUpperCase()
  );
}

export function mixHex(hexA: string, hexB: string, weightB: number): string {
  const [r1, g1, b1] = parseHex(hexA);
  const [r2, g2, b2] = parseHex(hexB);
  const w = Math.max(0, Math.min(1, weightB));
  return toHex(r1 * (1 - w) + r2 * w, g1 * (1 - w) + g2 * w, b1 * (1 - w) + b2 * w);
}

/** Ensures any custom picked primary color remains dark enough for crisp white text contrast */
export function normalizePrimaryForContrast(hex: string): string {
  const [r, g, b] = parseHex(hex);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  if (luminance > 0.52) {
    return mixHex(hex, '#182230', 0.45);
  }
  return toHex(r, g, b);
}

export function buildAppearanceFromPrimary(
  primaryHex: string,
  prev: AppearanceConfig,
  accentOverride?: string
): AppearanceConfig {
  const safePrimary = normalizePrimaryForContrast(primaryHex);
  return {
    ...prev,
    presetId: 'custom',
    primaryColor: safePrimary,
    headerColor: mixHex(safePrimary, '#FFFFFF', 0.14),
    accentColor: accentOverride ?? prev.accentColor ?? DEFAULT_APPEARANCE.accentColor,
    softTint: mixHex(safePrimary, '#FFFFFF', 0.87),
  };
}

export function resolveAppearance(raw?: AppearanceConfig | null): Required<AppearanceConfig> {
  const primary = raw?.primaryColor || DEFAULT_APPEARANCE.primaryColor;
  const header = raw?.headerColor || mixHex(primary, '#FFFFFF', 0.14);
  const accent = raw?.accentColor || DEFAULT_APPEARANCE.accentColor;
  const canvas = raw?.canvasColor || DEFAULT_APPEARANCE.canvasColor;
  const cardSurface = raw?.cardSurface || DEFAULT_APPEARANCE.cardSurface;
  const softTint = raw?.softTint || mixHex(primary, '#FFFFFF', 0.87);
  const radiusPx = typeof raw?.radiusPx === 'number' ? raw.radiusPx : DEFAULT_APPEARANCE.radiusPx;

  return {
    presetId: raw?.presetId || 'navy-gold',
    primaryColor: primary,
    headerColor: header,
    accentColor: accent,
    canvasColor: canvas,
    cardSurface,
    softTint,
    radiusPx,
  };
}

export function applyAppearanceToDocument(raw?: AppearanceConfig | null): void {
  if (typeof document === 'undefined') return;
  const cfg = resolveAppearance(raw);
  const root = document.documentElement;
  const deepPrimary = mixHex(cfg.primaryColor, '#0E1724', 0.2);
  const borderAccent = mixHex(cfg.accentColor, '#FFFFFF', 0.35);

  root.setAttribute('data-app-theme', 'active');
  root.style.setProperty('--app-primary', cfg.primaryColor);
  root.style.setProperty('--app-primary-light', cfg.headerColor);
  root.style.setProperty('--app-primary-deep', deepPrimary);
  root.style.setProperty('--accent-gold', cfg.accentColor);
  root.style.setProperty('--border-accent', borderAccent);
  root.style.setProperty('--bg-canvas', cfg.canvasColor);
  root.style.setProperty('--app-card-surface', cfg.cardSurface);
  root.style.setProperty('--bg-soft-blue', cfg.softTint);
  root.style.setProperty('--app-radius', `${cfg.radiusPx}px`);

  // Keep mobile browser status/address bar color synchronized with the active canvas
  const themeMeta = document.querySelector('meta[name="theme-color"]');
  if (themeMeta) {
    themeMeta.setAttribute('content', cfg.canvasColor);
  }
}
