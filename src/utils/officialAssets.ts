// Official local Golzar Shohada assets provided by the employer (precached offline by Service Worker)

const BASE_URL = import.meta.env.BASE_URL || '/';
const assetUrl = (relativePath: string) =>
  `${BASE_URL.endsWith('/') ? BASE_URL : `${BASE_URL}/`}${relativePath.replace(/^\/+/, '')}`;

export const OFFICIAL_GOLZAR_LOGO = assetUrl('assets/aistudio/_______________300x_15082119.png');

export interface BuiltInGolzarSlide {
  id: string;
  src: string;
  caption: string;
}

export const BUILTIN_GOLZAR_GALLERY: BuiltInGolzarSlide[] = [
  {
    id: 'builtin-golzar-tulips-garden',
    src: assetUrl('assets/aistudio/1399010310022700199606710_b718659f.jpg'),
    caption: 'گلستان لاله‌ها و محوطه گلزار شهدا',
  },
  {
    id: 'builtin-golzar-yellow-tulips',
    src: assetUrl('assets/aistudio/13990103100351813199607010_346d4cc5.jpg'),
    caption: 'لاله‌های بهاری و آب‌نمای گلزار شهدا',
  },
  {
    id: 'builtin-golzar-lanterns',
    src: assetUrl('assets/aistudio/610385_760_03f433ca.jpg'),
    caption: 'فانوس‌های مزار مطهر شهدا',
  },
  {
    id: 'builtin-golzar-visit',
    src: assetUrl('assets/aistudio/610270_243_c9627e8e.jpg'),
    caption: 'فضای معنوی گلزار شهدای تهران',
  },
];

// Calm neutral floral imagery from Golzar Shohada used when a project has no dedicated photo yet
export const NEUTRAL_FLORAL_IMAGES = [
  assetUrl('assets/aistudio/1399010310022700199606710_b718659f.jpg'),
  assetUrl('assets/aistudio/13990103100351813199607010_346d4cc5.jpg'),
];

export function getNeutralProjectImage(seedKey?: string): string {
  if (!seedKey) return NEUTRAL_FLORAL_IMAGES[0];
  let hash = 0;
  for (let i = 0; i < seedKey.length; i++) {
    hash = (hash * 31 + seedKey.charCodeAt(i)) >>> 0;
  }
  return NEUTRAL_FLORAL_IMAGES[hash % NEUTRAL_FLORAL_IMAGES.length];
}
