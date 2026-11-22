export type FooterLinkPlatform =
  | 'instagram'
  | 'facebook'
  | 'linkedin'
  | 'youtube'
  | 'tiktok'
  | 'twitter'
  | 'whatsapp'
  | 'email'
  | 'website'
  | 'link';

export type LandingThemePreset =
  | 'emerald'
  | 'indigo'
  | 'ocean'
  | 'amber'
  | 'crimson'
  | 'slate';

export type HeroLayoutMode = 'split' | 'centered' | 'banner';

export type CardSurfaceStyle = 'glass' | 'crisp' | 'elevated';

export type AnimationLevel = 'vivid' | 'smooth' | 'off';

export type LandingSectionId =
  | 'announcement'
  | 'hero'
  | 'metrics'
  | 'about'
  | 'events'
  | 'highlights'
  | 'faq'
  | 'cta'
  | 'footer';

export type FeatureIconName =
  | 'Trophy'
  | 'Users'
  | 'Sparkles'
  | 'Compass'
  | 'BookOpen'
  | 'Heart'
  | 'Zap'
  | 'Shield'
  | 'Target'
  | 'Calendar'
  | 'Award'
  | 'Globe';

export const FEATURE_ICON_NAMES: FeatureIconName[] = [
  'Trophy',
  'Users',
  'Sparkles',
  'Compass',
  'BookOpen',
  'Heart',
  'Zap',
  'Shield',
  'Target',
  'Calendar',
  'Award',
  'Globe',
];

export interface PublicMetricItem {
  id: string;
  value: string;
  label: string;
  sublabel?: string;
  icon?: FeatureIconName;
}

export interface PublicFeatureItem {
  id: string;
  title: string;
  description: string;
  icon: FeatureIconName;
  badge?: string;
}

export interface PublicFaqItem {
  id: string;
  question: string;
  answer: string;
}

export interface PublicFooterLink {
  id: string;
  label: string;
  url: string;
  platform?: FooterLinkPlatform;
}

export interface PublicFooterColumn {
  id: string;
  title: string;
  links: PublicFooterLink[];
}

export interface LegacyShowcaseFields {
  clubName?: string;
  tagline?: string;
  about?: string;
  instagramUrl?: string;
  contactEmail?: string;
}

export interface PublicLandingConfig {
  // Design & Motion Settings
  theme_preset?: LandingThemePreset;
  hero_layout?: HeroLayoutMode;
  card_style?: CardSurfaceStyle;
  animation_level?: AnimationLevel;
  section_order?: LandingSectionId[];

  // Top Announcement Ribbon
  show_announcement_bar?: boolean;
  announcement_text?: string;
  announcement_link_label?: string;
  announcement_link_url?: string;

  // Hero & Header
  nav_subtitle?: string;
  hero_badge?: string;
  hero_title?: string;
  hero_highlight_text?: string;
  hero_subtitle?: string;
  hero_primary_cta?: string;
  hero_secondary_cta_label?: string;
  hero_secondary_cta_url?: string;
  hero_cover_image_url?: string;
  hero_show_stats?: boolean;
  hero_fallback_eyebrow?: string;
  hero_fallback_title?: string;
  hero_fallback_desc?: string;

  // Impact Metrics Section
  show_metrics_section?: boolean;
  metrics_items?: PublicMetricItem[];

  // About & What We Do (Bento Feature Grid)
  show_about_section?: boolean;
  about_eyebrow?: string;
  about_title?: string;
  about_description?: string;
  about_image_url?: string;
  about_features?: PublicFeatureItem[];

  // Open Public Events Section
  show_events_section?: boolean;
  events_eyebrow?: string;
  events_title?: string;
  events_subtitle?: string;
  events_empty_title?: string;
  events_empty_desc?: string;

  // Club Highlights Section
  show_highlights_section?: boolean;
  highlights_eyebrow?: string;
  highlights_title?: string;

  // FAQ Section
  show_faq_section?: boolean;
  faq_eyebrow?: string;
  faq_title?: string;
  faq_subtitle?: string;
  faq_items?: PublicFaqItem[];

  // Bottom CTA Banner Section
  show_cta_section?: boolean;
  cta_badge?: string;
  cta_title?: string;
  cta_subtitle?: string;
  cta_primary_label?: string;
  cta_primary_action?: 'signup' | 'login' | 'events' | 'custom';
  cta_primary_url?: string;

  // Footer
  footer_about?: string;
  footer_columns?: PublicFooterColumn[];
  footer_copyright?: string;
}

export interface ResolvedPublicLandingConfig {
  theme_preset: LandingThemePreset;
  hero_layout: HeroLayoutMode;
  card_style: CardSurfaceStyle;
  animation_level: AnimationLevel;
  section_order: LandingSectionId[];

  show_announcement_bar: boolean;
  announcement_text: string;
  announcement_link_label: string;
  announcement_link_url: string;

  nav_subtitle: string;
  hero_badge: string;
  hero_title: string;
  hero_highlight_text: string;
  hero_subtitle: string;
  hero_primary_cta: string;
  hero_secondary_cta_label: string;
  hero_secondary_cta_url: string;
  hero_cover_image_url: string;
  hero_show_stats: boolean;
  hero_fallback_eyebrow: string;
  hero_fallback_title: string;
  hero_fallback_desc: string;

  show_metrics_section: boolean;
  metrics_items: PublicMetricItem[];

  show_about_section: boolean;
  about_eyebrow: string;
  about_title: string;
  about_description: string;
  about_image_url: string;
  about_features: PublicFeatureItem[];

  show_events_section: boolean;
  events_eyebrow: string;
  events_title: string;
  events_subtitle: string;
  events_empty_title: string;
  events_empty_desc: string;

  show_highlights_section: boolean;
  highlights_eyebrow: string;
  highlights_title: string;

  show_faq_section: boolean;
  faq_eyebrow: string;
  faq_title: string;
  faq_subtitle: string;
  faq_items: PublicFaqItem[];

  show_cta_section: boolean;
  cta_badge: string;
  cta_title: string;
  cta_subtitle: string;
  cta_primary_label: string;
  cta_primary_action: 'signup' | 'login' | 'events' | 'custom';
  cta_primary_url: string;

  footer_about: string;
  footer_columns: PublicFooterColumn[];
  footer_copyright: string;
}

export const DEFAULT_SECTION_ORDER: LandingSectionId[] = [
  'announcement',
  'hero',
  'metrics',
  'about',
  'events',
  'highlights',
  'faq',
  'cta',
  'footer',
];

export const REORDERABLE_MIDDLE_SECTIONS: LandingSectionId[] = [
  'metrics',
  'about',
  'events',
  'highlights',
  'faq',
  'cta',
];

export interface LandingSectionMeta {
  id: LandingSectionId;
  label: string;
  description: string;
  anchor?: string;
  reorderable: boolean;
  toggleKey?:
    | 'show_announcement_bar'
    | 'show_metrics_section'
    | 'show_about_section'
    | 'show_events_section'
    | 'show_highlights_section'
    | 'show_faq_section'
    | 'show_cta_section';
}

export const LANDING_SECTION_META: Record<LandingSectionId, LandingSectionMeta> = {
  announcement: {
    id: 'announcement',
    label: 'Announcement Bar',
    description: 'Top ribbon notice with optional link',
    reorderable: false,
    toggleKey: 'show_announcement_bar',
  },
  hero: {
    id: 'hero',
    label: 'Hero & Navbar',
    description: 'Headline, CTAs, cover image or poster slider',
    reorderable: false,
  },
  metrics: {
    id: 'metrics',
    label: 'Impact Metrics',
    description: 'By-the-numbers highlight cards',
    anchor: '#metrics',
    reorderable: true,
    toggleKey: 'show_metrics_section',
  },
  about: {
    id: 'about',
    label: 'About & Pillars',
    description: 'Club story, optional photo & Bento feature grid',
    anchor: '#about-club',
    reorderable: true,
    toggleKey: 'show_about_section',
  },
  events: {
    id: 'events',
    label: 'Open Public Events',
    description: 'Live guest-registration events & capacity bars',
    anchor: '#events',
    reorderable: true,
    toggleKey: 'show_events_section',
  },
  highlights: {
    id: 'highlights',
    label: 'Club Highlights',
    description: 'Pinned announcements & poster gallery',
    anchor: '#highlights',
    reorderable: true,
    toggleKey: 'show_highlights_section',
  },
  faq: {
    id: 'faq',
    label: 'FAQ & How to Join',
    description: 'Expandable Q&A accordion for visitors',
    anchor: '#faq',
    reorderable: true,
    toggleKey: 'show_faq_section',
  },
  cta: {
    id: 'cta',
    label: 'Bottom CTA Banner',
    description: 'High-contrast call-to-action strip above footer',
    reorderable: true,
    toggleKey: 'show_cta_section',
  },
  footer: {
    id: 'footer',
    label: 'Dark Footer & Socials',
    description: 'Club overview & configurable link columns',
    anchor: '#about',
    reorderable: false,
  },
};

export interface LandingThemeTokens {
  id: LandingThemePreset;
  name: string;
  swatchClass: string;
  pageBg: string;
  navBorder: string;
  announcementBg: string;
  badgeBg: string;
  badgeText: string;
  accentText: string;
  accentTextHover: string;
  primaryBtn: string;
  primaryBtnShadow: string;
  softBg: string;
  softBorder: string;
  hoverBorder: string;
  orbA: string;
  orbB: string;
  gradientText: string;
  fallbackGradient: string;
  ctaBannerBg: string;
  progressBar: string;
  iconBg: string;
  ringSelected: string;
  pillSelected: string;
}

export const LANDING_THEME_STYLES: Record<LandingThemePreset, LandingThemeTokens> = {
  emerald: {
    id: 'emerald',
    name: 'Emerald Campus',
    swatchClass: 'bg-emerald-600',
    pageBg: 'bg-gradient-to-b from-emerald-50/70 via-white to-slate-50',
    navBorder: 'border-emerald-100/90',
    announcementBg: 'bg-gradient-to-r from-emerald-700 via-teal-700 to-emerald-700 text-white',
    badgeBg: 'bg-emerald-100/90 border-emerald-200',
    badgeText: 'text-emerald-900',
    accentText: 'text-emerald-700',
    accentTextHover: 'hover:text-emerald-700',
    primaryBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    primaryBtnShadow: 'shadow-emerald-600/25',
    softBg: 'bg-emerald-50',
    softBorder: 'border-emerald-200',
    hoverBorder: 'hover:border-emerald-300',
    orbA: 'bg-emerald-200/45',
    orbB: 'bg-teal-200/40',
    gradientText: 'bg-gradient-to-r from-emerald-700 via-teal-600 to-emerald-500 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-900',
    ctaBannerBg: 'bg-gradient-to-br from-emerald-700 via-teal-800 to-slate-900',
    progressBar: 'bg-emerald-600',
    iconBg: 'bg-emerald-100 text-emerald-700',
    ringSelected: 'ring-emerald-500',
    pillSelected: 'bg-emerald-600 text-white',
  },
  indigo: {
    id: 'indigo',
    name: 'Royal Indigo',
    swatchClass: 'bg-indigo-600',
    pageBg: 'bg-gradient-to-b from-indigo-50/70 via-white to-slate-50',
    navBorder: 'border-indigo-100/90',
    announcementBg: 'bg-gradient-to-r from-indigo-700 via-violet-700 to-indigo-700 text-white',
    badgeBg: 'bg-indigo-100/90 border-indigo-200',
    badgeText: 'text-indigo-900',
    accentText: 'text-indigo-700',
    accentTextHover: 'hover:text-indigo-700',
    primaryBtn: 'bg-indigo-600 hover:bg-indigo-500 text-white',
    primaryBtnShadow: 'shadow-indigo-600/25',
    softBg: 'bg-indigo-50',
    softBorder: 'border-indigo-200',
    hoverBorder: 'hover:border-indigo-300',
    orbA: 'bg-indigo-200/45',
    orbB: 'bg-violet-200/40',
    gradientText: 'bg-gradient-to-r from-indigo-700 via-violet-600 to-blue-500 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-indigo-700 via-violet-700 to-slate-900',
    ctaBannerBg: 'bg-gradient-to-br from-indigo-700 via-violet-800 to-slate-900',
    progressBar: 'bg-indigo-600',
    iconBg: 'bg-indigo-100 text-indigo-700',
    ringSelected: 'ring-indigo-500',
    pillSelected: 'bg-indigo-600 text-white',
  },
  ocean: {
    id: 'ocean',
    name: 'Ocean Cyan',
    swatchClass: 'bg-sky-600',
    pageBg: 'bg-gradient-to-b from-sky-50/75 via-white to-slate-50',
    navBorder: 'border-sky-100/90',
    announcementBg: 'bg-gradient-to-r from-sky-700 via-cyan-700 to-sky-700 text-white',
    badgeBg: 'bg-sky-100/90 border-sky-200',
    badgeText: 'text-sky-900',
    accentText: 'text-sky-700',
    accentTextHover: 'hover:text-sky-700',
    primaryBtn: 'bg-sky-600 hover:bg-sky-500 text-white',
    primaryBtnShadow: 'shadow-sky-600/25',
    softBg: 'bg-sky-50',
    softBorder: 'border-sky-200',
    hoverBorder: 'hover:border-sky-300',
    orbA: 'bg-sky-200/45',
    orbB: 'bg-cyan-200/40',
    gradientText: 'bg-gradient-to-r from-sky-700 via-cyan-600 to-blue-600 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-sky-700 via-cyan-700 to-slate-900',
    ctaBannerBg: 'bg-gradient-to-br from-sky-700 via-cyan-800 to-slate-900',
    progressBar: 'bg-sky-600',
    iconBg: 'bg-sky-100 text-sky-700',
    ringSelected: 'ring-sky-500',
    pillSelected: 'bg-sky-600 text-white',
  },
  amber: {
    id: 'amber',
    name: 'Warm Amber',
    swatchClass: 'bg-amber-600',
    pageBg: 'bg-gradient-to-b from-amber-50/70 via-white to-stone-50',
    navBorder: 'border-amber-100/90',
    announcementBg: 'bg-gradient-to-r from-amber-600 via-orange-600 to-amber-600 text-white',
    badgeBg: 'bg-amber-100/90 border-amber-200',
    badgeText: 'text-amber-950',
    accentText: 'text-amber-700',
    accentTextHover: 'hover:text-amber-700',
    primaryBtn: 'bg-amber-600 hover:bg-amber-500 text-white',
    primaryBtnShadow: 'shadow-amber-600/25',
    softBg: 'bg-amber-50',
    softBorder: 'border-amber-200',
    hoverBorder: 'hover:border-amber-300',
    orbA: 'bg-amber-200/45',
    orbB: 'bg-orange-200/40',
    gradientText: 'bg-gradient-to-r from-amber-700 via-orange-600 to-rose-500 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-amber-600 via-orange-700 to-slate-900',
    ctaBannerBg: 'bg-gradient-to-br from-amber-600 via-orange-700 to-stone-900',
    progressBar: 'bg-amber-600',
    iconBg: 'bg-amber-100 text-amber-800',
    ringSelected: 'ring-amber-500',
    pillSelected: 'bg-amber-600 text-white',
  },
  crimson: {
    id: 'crimson',
    name: 'Crimson Pulse',
    swatchClass: 'bg-rose-600',
    pageBg: 'bg-gradient-to-b from-rose-50/70 via-white to-slate-50',
    navBorder: 'border-rose-100/90',
    announcementBg: 'bg-gradient-to-r from-rose-700 via-pink-700 to-rose-700 text-white',
    badgeBg: 'bg-rose-100/90 border-rose-200',
    badgeText: 'text-rose-900',
    accentText: 'text-rose-700',
    accentTextHover: 'hover:text-rose-700',
    primaryBtn: 'bg-rose-600 hover:bg-rose-500 text-white',
    primaryBtnShadow: 'shadow-rose-600/25',
    softBg: 'bg-rose-50',
    softBorder: 'border-rose-200',
    hoverBorder: 'hover:border-rose-300',
    orbA: 'bg-rose-200/45',
    orbB: 'bg-pink-200/40',
    gradientText: 'bg-gradient-to-r from-rose-700 via-pink-600 to-orange-500 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-rose-700 via-pink-700 to-slate-900',
    ctaBannerBg: 'bg-gradient-to-br from-rose-700 via-pink-800 to-slate-900',
    progressBar: 'bg-rose-600',
    iconBg: 'bg-rose-100 text-rose-700',
    ringSelected: 'ring-rose-500',
    pillSelected: 'bg-rose-600 text-white',
  },
  slate: {
    id: 'slate',
    name: 'Midnight Editorial',
    swatchClass: 'bg-slate-900',
    pageBg: 'bg-gradient-to-b from-slate-100/80 via-white to-slate-50',
    navBorder: 'border-slate-200/90',
    announcementBg: 'bg-gradient-to-r from-slate-900 via-slate-800 to-slate-900 text-white',
    badgeBg: 'bg-slate-200/80 border-slate-300',
    badgeText: 'text-slate-900',
    accentText: 'text-slate-800',
    accentTextHover: 'hover:text-slate-900',
    primaryBtn: 'bg-emerald-600 hover:bg-emerald-500 text-white',
    primaryBtnShadow: 'shadow-emerald-600/25',
    softBg: 'bg-slate-100',
    softBorder: 'border-slate-300',
    hoverBorder: 'hover:border-slate-400',
    orbA: 'bg-slate-300/45',
    orbB: 'bg-emerald-200/35',
    gradientText: 'bg-gradient-to-r from-slate-900 via-slate-700 to-emerald-600 bg-clip-text text-transparent',
    fallbackGradient: 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950',
    ctaBannerBg: 'bg-gradient-to-br from-slate-900 via-slate-800 to-emerald-950',
    progressBar: 'bg-slate-800',
    iconBg: 'bg-slate-200 text-slate-800',
    ringSelected: 'ring-slate-700',
    pillSelected: 'bg-slate-900 text-white',
  },
};

export const CARD_SURFACE_STYLES: Record<CardSurfaceStyle, string> = {
  glass: 'bg-white/80 backdrop-blur-md border border-white/70 shadow-sm',
  crisp: 'bg-white border border-slate-200 shadow-2xs',
  elevated: 'bg-white border border-slate-200/80 shadow-lg shadow-slate-900/5',
};

export interface PublicLandingTemplate {
  id: string;
  name: string;
  description: string;
  theme_preset: LandingThemePreset;
  hero_layout: HeroLayoutMode;
  card_style: CardSurfaceStyle;
  animation_level: AnimationLevel;
}

export const PUBLIC_LANDING_TEMPLATES: PublicLandingTemplate[] = [
  {
    id: 'emerald-campus',
    name: 'Emerald Campus',
    description: 'Fresh academic greens, split showcase, and glassmorphic depth',
    theme_preset: 'emerald',
    hero_layout: 'split',
    card_style: 'glass',
    animation_level: 'smooth',
  },
  {
    id: 'midnight-editorial',
    name: 'Midnight Editorial',
    description: 'Bold monochrome contrast with cinematic banner framing',
    theme_preset: 'slate',
    hero_layout: 'banner',
    card_style: 'crisp',
    animation_level: 'smooth',
  },
  {
    id: 'royal-tech',
    name: 'Royal Tech',
    description: 'Vibrant indigo typography with centered showcase layout',
    theme_preset: 'indigo',
    hero_layout: 'centered',
    card_style: 'elevated',
    animation_level: 'vivid',
  },
  {
    id: 'warm-community',
    name: 'Warm Community',
    description: 'Inviting amber glow designed for social gatherings & outreach',
    theme_preset: 'amber',
    hero_layout: 'split',
    card_style: 'glass',
    animation_level: 'vivid',
  },
];

export function moveArrayItem<T>(arr: T[], fromIndex: number, toIndex: number): T[] {
  if (
    fromIndex < 0 ||
    toIndex < 0 ||
    fromIndex >= arr.length ||
    toIndex >= arr.length ||
    fromIndex === toIndex
  ) {
    return arr;
  }
  const copy = [...arr];
  const [removed] = copy.splice(fromIndex, 1);
  copy.splice(toIndex, 0, removed);
  return copy;
}

export function duplicateArrayItem<T extends { id: string }>(
  arr: T[],
  index: number,
  idPrefix: string
): T[] {
  if (index < 0 || index >= arr.length) return arr;
  const source = arr[index];
  const cloned: T = {
    ...source,
    id: `${idPrefix}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
  };
  const copy = [...arr];
  copy.splice(index + 1, 0, cloned);
  return copy;
}

export function normalizeSectionOrder(raw?: LandingSectionId[]): LandingSectionId[] {
  const validMiddle = REORDERABLE_MIDDLE_SECTIONS;
  const incomingMiddle = Array.isArray(raw)
    ? raw.filter((id): id is LandingSectionId => validMiddle.includes(id))
    : [];
  const dedupedMiddle: LandingSectionId[] = [];
  for (const id of incomingMiddle) {
    if (!dedupedMiddle.includes(id)) dedupedMiddle.push(id);
  }
  for (const id of validMiddle) {
    if (!dedupedMiddle.includes(id)) dedupedMiddle.push(id);
  }
  return ['announcement', 'hero', ...dedupedMiddle, 'footer'];
}

export function normalizeExternalHref(
  rawUrl?: string,
  platform?: FooterLinkPlatform
): string {
  const clean = (rawUrl || '').trim();
  if (!clean) return '';
  if (
    clean.startsWith('#') ||
    clean.startsWith('/') ||
    /^mailto:/i.test(clean) ||
    /^tel:/i.test(clean) ||
    /^https?:\/\//i.test(clean)
  ) {
    return clean;
  }
  if (platform === 'email' || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    return `mailto:${clean}`;
  }
  return `https://${clean}`;
}

export function resolvePublicLandingConfig(
  rawConfig?: PublicLandingConfig | null,
  legacy?: LegacyShowcaseFields
): ResolvedPublicLandingConfig {
  const cfg = rawConfig && typeof rawConfig === 'object' ? rawConfig : {};
  const clubName = (legacy?.clubName || 'ClubSync').trim() || 'ClubSync';
  const defaultTagline =
    (legacy?.tagline || '').trim() ||
    'Campus activities, events, and student community — all in one portal.';

  const connectLinks: PublicFooterLink[] = [];
  if (legacy?.instagramUrl?.trim()) {
    connectLinks.push({
      id: 'legacy-ig',
      label: 'Instagram',
      url: legacy.instagramUrl.trim(),
      platform: 'instagram',
    });
  }
  if (legacy?.contactEmail?.trim()) {
    connectLinks.push({
      id: 'legacy-email',
      label: legacy.contactEmail.trim(),
      url: legacy.contactEmail.trim(),
      platform: 'email',
    });
  }

  const defaultColumns: PublicFooterColumn[] = [
    {
      id: 'col-connect',
      title: 'Connect With Us',
      links: connectLinks,
    },
    {
      id: 'col-quick',
      title: 'Quick Links',
      links: [
        { id: 'ql-events', label: 'Open Events', url: '#events', platform: 'link' },
        { id: 'ql-highlights', label: 'Club Highlights', url: '#highlights', platform: 'link' },
        { id: 'ql-faq', label: 'How to Join', url: '#faq', platform: 'link' },
      ],
    },
  ];

  const defaultMetrics: PublicMetricItem[] = [
    {
      id: 'metric-events',
      value: '12+',
      label: 'Annual Programs',
      sublabel: 'Workshops, leagues & showcases',
      icon: 'Calendar',
    },
    {
      id: 'metric-pillars',
      value: '5',
      label: 'Core Focus Units',
      sublabel: 'Skill building, outreach & community',
      icon: 'Compass',
    },
    {
      id: 'metric-guest',
      value: '100%',
      label: 'Digital Entry Pass',
      sublabel: 'Instant QR verification for guests',
      icon: 'Zap',
    },
  ];

  const defaultFeatures: PublicFeatureItem[] = [
    {
      id: 'feat-workshops',
      title: 'Hands-On Workshops',
      description: 'Weekly peer-led training, guided practice sessions, and curated skill tracks for every experience level.',
      icon: 'BookOpen',
      badge: 'Weekly',
    },
    {
      id: 'feat-tournaments',
      title: 'Signature Competitions',
      description: 'Campus-wide showcases, inter-faculty challenges, and friendly leagues open to students and visiting guests.',
      icon: 'Trophy',
      badge: 'Open',
    },
    {
      id: 'feat-community',
      title: 'Collaborative Network',
      description: 'Connect with passionate student organizers, alumni mentors, and interdisciplinary project teams across campus.',
      icon: 'Users',
      badge: 'Community',
    },
  ];

  const defaultFaqs: PublicFaqItem[] = [
    {
      id: 'faq-join',
      question: 'Do I need to be a club member to join public events?',
      answer:
        'Not at all! Any event listed under Open Public Events welcomes non-member students and visiting participants. Simply click Register as Guest and you will receive your digital Entry Pass QR immediately.',
    },
    {
      id: 'faq-membership',
      question: 'How do students apply for official club membership?',
      answer:
        'Click Sign Up at the top right corner to create your portal account with your matric number. Once reviewed by the club committee, you unlock internal activities, equipment borrowing, and member chat.',
    },
    {
      id: 'faq-pass',
      question: 'Where can I find my QR pass after registering as a guest?',
      answer:
        'Right after submitting your guest registration on the event page, your personal Entry Pass link and QR ticket are shown onscreen—save or bookmark that link for fast check-in on event day.',
    },
  ];

  const themePreset: LandingThemePreset =
    cfg.theme_preset && cfg.theme_preset in LANDING_THEME_STYLES
      ? cfg.theme_preset
      : 'emerald';

  const heroLayout: HeroLayoutMode =
    cfg.hero_layout === 'centered' || cfg.hero_layout === 'banner'
      ? cfg.hero_layout
      : 'split';

  const cardStyle: CardSurfaceStyle =
    cfg.card_style === 'crisp' || cfg.card_style === 'elevated'
      ? cfg.card_style
      : 'glass';

  const animationLevel: AnimationLevel =
    cfg.animation_level === 'vivid' || cfg.animation_level === 'off'
      ? cfg.animation_level
      : 'smooth';

  const ctaAction =
    cfg.cta_primary_action === 'login' ||
    cfg.cta_primary_action === 'events' ||
    cfg.cta_primary_action === 'custom'
      ? cfg.cta_primary_action
      : 'signup';

  return {
    theme_preset: themePreset,
    hero_layout: heroLayout,
    card_style: cardStyle,
    animation_level: animationLevel,
    section_order: normalizeSectionOrder(cfg.section_order),

    show_announcement_bar: cfg.show_announcement_bar === true,
    announcement_text:
      cfg.announcement_text ?? 'Registration for upcoming open campus activities is now live!',
    announcement_link_label: cfg.announcement_link_label ?? 'View Events',
    announcement_link_url: cfg.announcement_link_url ?? '#events',

    nav_subtitle: cfg.nav_subtitle ?? 'Official Student Club Portal',
    hero_badge: cfg.hero_badge ?? `Welcome to ${clubName}`,
    hero_title: cfg.hero_title ?? clubName,
    hero_highlight_text: cfg.hero_highlight_text ?? '',
    hero_subtitle: cfg.hero_subtitle ?? defaultTagline,
    hero_primary_cta: cfg.hero_primary_cta ?? 'Explore Open Events',
    hero_secondary_cta_label: cfg.hero_secondary_cta_label ?? '',
    hero_secondary_cta_url: cfg.hero_secondary_cta_url ?? '#about-club',
    hero_cover_image_url: cfg.hero_cover_image_url ?? '',
    hero_show_stats: cfg.hero_show_stats !== false,
    hero_fallback_eyebrow: cfg.hero_fallback_eyebrow ?? 'Campus Event & Activity Hub',
    hero_fallback_title:
      cfg.hero_fallback_title ?? 'Discover Public Workshops, Tournaments & Gatherings',
    hero_fallback_desc:
      cfg.hero_fallback_desc ??
      'Browse open events below to register directly as a guest participant and receive your digital Entry Pass QR.',

    show_metrics_section: cfg.show_metrics_section !== false,
    metrics_items: Array.isArray(cfg.metrics_items) ? cfg.metrics_items : defaultMetrics,

    show_about_section: cfg.show_about_section !== false,
    about_eyebrow: cfg.about_eyebrow ?? 'Who We Are',
    about_title: cfg.about_title ?? `Built for Curious Minds at ${clubName}`,
    about_description:
      cfg.about_description ??
      'We bring students together through structured workshops, friendly competitions, and collaborative community initiatives throughout the academic year.',
    about_image_url: cfg.about_image_url ?? '',
    about_features: Array.isArray(cfg.about_features) ? cfg.about_features : defaultFeatures,

    show_events_section: cfg.show_events_section !== false,
    events_eyebrow: cfg.events_eyebrow ?? 'Guest Registration Open',
    events_title: cfg.events_title ?? 'Open Public Events',
    events_subtitle: cfg.events_subtitle ?? 'Open to non-members & visiting participants',
    events_empty_title:
      cfg.events_empty_title ?? 'No public guest events open at the moment',
    events_empty_desc:
      cfg.events_empty_desc ??
      'Check back soon for upcoming tournaments, workshops, and open sessions. Already a club member? Sign in to view internal club activities.',

    show_highlights_section: cfg.show_highlights_section !== false,
    highlights_eyebrow: cfg.highlights_eyebrow ?? 'Pinned Announcements',
    highlights_title: cfg.highlights_title ?? 'Club Highlights',

    show_faq_section: cfg.show_faq_section !== false,
    faq_eyebrow: cfg.faq_eyebrow ?? 'Questions & Answers',
    faq_title: cfg.faq_title ?? 'Frequently Asked Questions',
    faq_subtitle:
      cfg.faq_subtitle ?? 'Everything visiting participants and new students ask first.',
    faq_items: Array.isArray(cfg.faq_items) ? cfg.faq_items : defaultFaqs,

    show_cta_section: cfg.show_cta_section !== false,
    cta_badge: cfg.cta_badge ?? 'Join the Community',
    cta_title: cfg.cta_title ?? `Ready to get involved with ${clubName}?`,
    cta_subtitle:
      cfg.cta_subtitle ??
      'Explore open campus events as a guest or register as an official member for full portal access.',
    cta_primary_label: cfg.cta_primary_label ?? 'Create Member Account',
    cta_primary_action: ctaAction,
    cta_primary_url: cfg.cta_primary_url ?? '#events',

    footer_about: cfg.footer_about ?? ((legacy?.about || '').trim() || defaultTagline),
    footer_columns: Array.isArray(cfg.footer_columns) ? cfg.footer_columns : defaultColumns,
    footer_copyright:
      cfg.footer_copyright ?? `${clubName} · Powered by ClubSync`,
  };
}
