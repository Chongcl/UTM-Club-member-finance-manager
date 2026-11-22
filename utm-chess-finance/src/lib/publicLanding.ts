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

export interface PublicLandingConfig {
  nav_subtitle?: string;
  hero_badge?: string;
  hero_title?: string;
  hero_subtitle?: string;
  hero_primary_cta?: string;
  hero_show_stats?: boolean;
  hero_fallback_eyebrow?: string;
  hero_fallback_title?: string;
  hero_fallback_desc?: string;
  show_events_section?: boolean;
  events_eyebrow?: string;
  events_title?: string;
  events_subtitle?: string;
  show_highlights_section?: boolean;
  highlights_eyebrow?: string;
  highlights_title?: string;
  footer_about?: string;
  footer_columns?: PublicFooterColumn[];
}

export interface ResolvedPublicLandingConfig {
  nav_subtitle: string;
  hero_badge: string;
  hero_title: string;
  hero_subtitle: string;
  hero_primary_cta: string;
  hero_show_stats: boolean;
  hero_fallback_eyebrow: string;
  hero_fallback_title: string;
  hero_fallback_desc: string;
  show_events_section: boolean;
  events_eyebrow: string;
  events_title: string;
  events_subtitle: string;
  show_highlights_section: boolean;
  highlights_eyebrow: string;
  highlights_title: string;
  footer_about: string;
  footer_columns: PublicFooterColumn[];
}

export interface LegacyShowcaseFields {
  clubName?: string;
  tagline?: string;
  about?: string;
  instagramUrl?: string;
  contactEmail?: string;
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
      ],
    },
  ];

  return {
    nav_subtitle: cfg.nav_subtitle ?? 'Official Student Club Portal',
    hero_badge: cfg.hero_badge ?? `Welcome to ${clubName}`,
    hero_title: cfg.hero_title ?? clubName,
    hero_subtitle: cfg.hero_subtitle ?? defaultTagline,
    hero_primary_cta: cfg.hero_primary_cta ?? 'Explore Open Events',
    hero_show_stats: cfg.hero_show_stats !== false,
    hero_fallback_eyebrow: cfg.hero_fallback_eyebrow ?? 'Campus Event & Activity Hub',
    hero_fallback_title:
      cfg.hero_fallback_title ?? 'Discover Public Workshops, Tournaments & Gatherings',
    hero_fallback_desc:
      cfg.hero_fallback_desc ??
      'Browse open events below to register directly as a guest participant and receive your digital Entry Pass QR.',
    show_events_section: cfg.show_events_section !== false,
    events_eyebrow: cfg.events_eyebrow ?? 'Guest Registration Open',
    events_title: cfg.events_title ?? 'Open Public Events',
    events_subtitle: cfg.events_subtitle ?? 'Open to non-members & visiting participants',
    show_highlights_section: cfg.show_highlights_section !== false,
    highlights_eyebrow: cfg.highlights_eyebrow ?? 'Pinned Announcements',
    highlights_title: cfg.highlights_title ?? 'Club Highlights',
    footer_about: cfg.footer_about ?? ((legacy?.about || '').trim() || defaultTagline),
    footer_columns: Array.isArray(cfg.footer_columns)
      ? cfg.footer_columns
      : defaultColumns,
  };
}
