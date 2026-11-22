'use client';

import React, { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import {
  supabase,
  isSupabaseConfigured,
  Budget,
  Announcement,
} from '@/lib/supabase';
import {
  PublicLandingConfig,
  FooterLinkPlatform,
  LandingSectionId,
  FeatureIconName,
  AnimationLevel,
  LANDING_THEME_STYLES,
  CARD_SURFACE_STYLES,
  LANDING_SECTION_META,
  resolvePublicLandingConfig,
  normalizeExternalHref,
} from '@/lib/publicLanding';
import {
  Layers,
  Calendar,
  Clock,
  MapPin,
  Sparkles,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Pin,
  Instagram,
  Mail,
  X,
  LogIn,
  UserPlus,
  ExternalLink,
  Ticket,
  FileText,
  Maximize2,
  Globe,
  MessageCircle,
  Link2,
  Trophy,
  Users,
  Compass,
  BookOpen,
  Heart,
  Zap,
  Shield,
  Target,
  Award,
  Megaphone,
  Eye,
  EyeOff,
  Edit3,
  CheckCircle2,
} from 'lucide-react';

export interface PublicLandingPageProps {
  initialClubName?: string;
  initialLogoUrl?: string;
  initialBatch?: string;
  initialConfig?: PublicLandingConfig | null;
  previewConfig?: PublicLandingConfig | null;
  isPreview?: boolean;
  selectedSectionId?: LandingSectionId | null;
  hoveredSectionId?: LandingSectionId | null;
  showHiddenSections?: boolean;
  onSelectSection?: (id: LandingSectionId) => void;
  onHoverSection?: (id: LandingSectionId | null) => void;
  onQuickMoveSection?: (id: LandingSectionId, dir: 'up' | 'down') => void;
  onQuickToggleSection?: (id: LandingSectionId) => void;
  authMode: 'login' | 'signup';
  setAuthMode: (m: 'login' | 'signup') => void;
  email: string;
  setEmail: (v: string) => void;
  password: string;
  setPassword: (v: string) => void;
  fullName: string;
  setFullName: (v: string) => void;
  matricNo: string;
  setMatricNo: (v: string) => void;
  phoneNumber: string;
  setPhoneNumber: (v: string) => void;
  authError: string | null;
  setAuthError: (v: string | null) => void;
}

interface PublicStats {
  open_events_count: number;
  total_events_count: number;
}

interface PublicEventCard extends Budget {
  effective_fee: number;
  guest_registered_count: number;
}

function isPdfMedia(url?: string): boolean {
  if (!url) return false;
  return (
    url.toLowerCase().split('?')[0].endsWith('.pdf') ||
    url.startsWith('data:application/pdf')
  );
}

function parseDateChip(raw?: string): { month: string; day: string } | null {
  if (!raw) return null;
  const dt = new Date(raw);
  if (Number.isNaN(dt.getTime())) return null;
  const month = dt.toLocaleDateString('en-US', { month: 'short' }).toUpperCase();
  const day = String(dt.getDate()).padStart(2, '0');
  return { month, day };
}

export function FeatureIcon({
  name,
  className = 'w-5 h-5',
}: {
  name?: FeatureIconName;
  className?: string;
}) {
  switch (name) {
    case 'Trophy':
      return <Trophy className={className} />;
    case 'Users':
      return <Users className={className} />;
    case 'Compass':
      return <Compass className={className} />;
    case 'BookOpen':
      return <BookOpen className={className} />;
    case 'Heart':
      return <Heart className={className} />;
    case 'Zap':
      return <Zap className={className} />;
    case 'Shield':
      return <Shield className={className} />;
    case 'Target':
      return <Target className={className} />;
    case 'Calendar':
      return <Calendar className={className} />;
    case 'Award':
      return <Award className={className} />;
    case 'Globe':
      return <Globe className={className} />;
    default:
      return <Sparkles className={className} />;
  }
}

export function FooterPlatformIcon({
  platform,
  className = 'w-3.5 h-3.5 shrink-0',
}: {
  platform?: FooterLinkPlatform;
  className?: string;
}) {
  switch (platform) {
    case 'facebook':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7.5v3h2.6v8h3.4z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3.5C4.14 3.5 3.25 4.39 3.25 5.5C3.25 6.6 4.14 7.5 5.25 7.5C6.35 7.5 7.25 6.6 7.25 5.5C7.25 4.39 6.35 3.5 5.25 3.5ZM20.44 13.02C20.44 9.88 18.76 8.22 16.16 8.22C14.37 8.22 13.48 9.2 13.02 9.93V8.5H9.65C9.7 9.48 9.65 19.5 9.65 19.5H13.02V13.36C13.02 13.02 13.05 12.69 13.15 12.45C13.42 11.78 14.03 11.09 15.07 11.09C16.41 11.09 17.06 12.11 17.06 13.6V19.5H20.44V13.02Z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.58 7.19C21.35 6.33 20.67 5.65 19.81 5.42C18.25 5 12 5 12 5C12 5 5.75 5 4.19 5.42C3.33 5.65 2.65 6.33 2.42 7.19C2 8.75 2 12 2 12C2 12 2 15.25 2.42 16.81C2.65 17.67 3.33 18.35 4.19 18.58C5.75 19 12 19 12 19C12 19 18.25 19 19.81 18.58C20.67 18.35 21.35 17.67 21.58 16.81C22 15.25 22 12 22 12C22 12 22 8.75 21.58 7.19ZM10 15V9L15.2 12L10 15Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16.6 5.82C15.9 5.02 15.5 3.99 15.5 2.9H12.4V15.4C12.38 16.71 11.31 17.76 10 17.76C8.67 17.76 7.6 16.68 7.6 15.36C7.6 14.04 8.67 12.96 10 12.96C10.24 12.96 10.48 13 10.7 13.07V9.91C10.47 9.88 10.24 9.86 10 9.86C6.96 9.86 4.5 12.33 4.5 15.36C4.5 18.39 6.96 20.86 10 20.86C13.04 20.86 15.5 18.39 15.5 15.36V9.01C16.75 9.91 18.28 10.43 19.9 10.43V7.34C18.61 7.34 17.44 6.76 16.6 5.82Z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case 'instagram':
      return <Instagram className={className} />;
    case 'whatsapp':
      return <MessageCircle className={className} />;
    case 'email':
      return <Mail className={className} />;
    case 'website':
      return <Globe className={className} />;
    default:
      return <Link2 className={className} />;
  }
}

function Reveal({
  children,
  animationLevel,
  delayMs = 0,
  className = '',
}: {
  children: React.ReactNode;
  animationLevel: AnimationLevel;
  delayMs?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(animationLevel === 'off');

  useEffect(() => {
    if (animationLevel === 'off') {
      setVisible(true);
      return;
    }
    if (
      typeof window !== 'undefined' &&
      window.matchMedia &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      setVisible(true);
      return;
    }

    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return;
    }

    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            setVisible(true);
            obs.disconnect();
            break;
          }
        }
      },
      { threshold: 0.08, rootMargin: '0px 0px -24px 0px' }
    );

    obs.observe(node);
    return () => obs.disconnect();
  }, [animationLevel]);

  if (animationLevel === 'off') {
    return <div className={className}>{children}</div>;
  }

  return (
    <div
      ref={ref}
      style={{ transitionDelay: `${delayMs}ms` }}
      className={`transition-all duration-700 ease-out will-change-transform ${
        visible ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-5 scale-[0.985]'
      } ${className}`}
    >
      {children}
    </div>
  );
}

function AnimatedMetricValue({
  value,
  animationLevel,
}: {
  value: string;
  animationLevel: AnimationLevel;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const match = /^(\d+(?:\.\d+)?)([^\d/].*)?$/.exec((value || '').trim());
  const targetNum = match ? Number(match[1]) : null;
  const suffix = match?.[2] || '';
  const hasDecimal = Boolean(match?.[1]?.includes('.'));

  const [displayNum, setDisplayNum] = useState<number>(targetNum ?? 0);
  const [hasAnimated, setHasAnimated] = useState(false);

  useEffect(() => {
    if (targetNum === null || animationLevel === 'off') {
      setDisplayNum(targetNum ?? 0);
      return;
    }
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setDisplayNum(targetNum);
      return;
    }

    let rafId = 0;
    const obs = new IntersectionObserver(
      (entries) => {
        if (!hasAnimated && entries.some((e) => e.isIntersecting)) {
          setHasAnimated(true);
          const duration = animationLevel === 'vivid' ? 1100 : 800;
          const start = performance.now();
          const tick = (now: number) => {
            const p = Math.min(1, (now - start) / duration);
            const eased = 1 - Math.pow(1 - p, 3);
            setDisplayNum(targetNum * eased);
            if (p < 1) {
              rafId = requestAnimationFrame(tick);
            } else {
              setDisplayNum(targetNum);
            }
          };
          rafId = requestAnimationFrame(tick);
          obs.disconnect();
        }
      },
      { threshold: 0.25 }
    );

    obs.observe(node);
    return () => {
      obs.disconnect();
      if (rafId) cancelAnimationFrame(rafId);
    };
  }, [targetNum, animationLevel, hasAnimated]);

  if (targetNum === null || Number.isNaN(targetNum)) {
    return <span ref={ref}>{value}</span>;
  }

  const formatted = hasDecimal ? displayNum.toFixed(1) : Math.round(displayNum).toString();
  return (
    <span ref={ref}>
      {formatted}
      {suffix}
    </span>
  );
}

function EditableSectionWrapper({
  sectionId,
  isPreview,
  isVisible = true,
  showHiddenSections = false,
  selectedSectionId,
  hoveredSectionId,
  themeRingClass,
  themePillClass,
  canMoveUp = false,
  canMoveDown = false,
  hasToggle = false,
  onSelectSection,
  onHoverSection,
  onQuickMoveSection,
  onQuickToggleSection,
  children,
}: {
  sectionId: LandingSectionId;
  isPreview: boolean;
  isVisible?: boolean;
  showHiddenSections?: boolean;
  selectedSectionId?: LandingSectionId | null;
  hoveredSectionId?: LandingSectionId | null;
  themeRingClass: string;
  themePillClass: string;
  canMoveUp?: boolean;
  canMoveDown?: boolean;
  hasToggle?: boolean;
  onSelectSection?: (id: LandingSectionId) => void;
  onHoverSection?: (id: LandingSectionId | null) => void;
  onQuickMoveSection?: (id: LandingSectionId, dir: 'up' | 'down') => void;
  onQuickToggleSection?: (id: LandingSectionId) => void;
  children: React.ReactNode;
}) {
  const meta = LANDING_SECTION_META[sectionId];

  if (!isPreview) {
    return isVisible ? <>{children}</> : null;
  }

  const isSelected = selectedSectionId === sectionId;
  const isHovered = hoveredSectionId === sectionId;

  if (!isVisible && !showHiddenSections && !isSelected) {
    return null;
  }

  return (
    <div
      data-editor-section={sectionId}
      onMouseEnter={() => onHoverSection?.(sectionId)}
      onMouseLeave={() => onHoverSection?.(null)}
      onClick={(e) => {
        if ((e.target as HTMLElement).closest('a')) {
          e.preventDefault();
        }
        onSelectSection?.(sectionId);
      }}
      className={`relative group/editor-sec transition-all duration-200 cursor-pointer ${
        isSelected
          ? `ring-2 ${themeRingClass} ring-offset-2 ring-offset-white z-10 pl-pulse-ring`
          : isHovered
          ? 'outline-2 outline-dashed outline-slate-400/80 -outline-offset-2'
          : 'hover:outline-2 hover:outline-dashed hover:outline-slate-400/70 -outline-offset-2'
      }`}
    >
      {/* Floating Section Badge + Micro Toolbar */}
      <div
        className={`absolute top-2 left-3 z-20 flex items-center gap-1.5 transition-opacity duration-150 ${
          isSelected || isHovered
            ? 'opacity-100'
            : 'opacity-0 group-hover/editor-sec:opacity-100'
        }`}
      >
        <span
          className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-extrabold shadow-md ${
            isSelected ? themePillClass : 'bg-slate-900/90 text-white'
          }`}
        >
          <Edit3 className="w-2.5 h-2.5" />
          <span>{isSelected ? `Editing: ${meta.label}` : meta.label}</span>
          {!isVisible && <span className="opacity-75">(Hidden)</span>}
        </span>
      </div>

      <div
        className={`absolute top-2 right-3 z-20 flex items-center gap-1 bg-slate-900/90 text-white px-1.5 py-1 rounded-full shadow-lg transition-opacity duration-150 ${
          isSelected || isHovered
            ? 'opacity-100'
            : 'opacity-0 group-hover/editor-sec:opacity-100'
        }`}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={() => onSelectSection?.(sectionId)}
          className="px-2 py-0.5 rounded-full hover:bg-white/15 text-[10px] font-bold flex items-center gap-1 cursor-pointer"
          title={`Edit ${meta.label}`}
        >
          <Edit3 className="w-2.5 h-2.5" />
          <span>Edit</span>
        </button>
        {meta.reorderable && onQuickMoveSection && (
          <>
            <button
              type="button"
              disabled={!canMoveUp}
              onClick={() => onQuickMoveSection(sectionId, 'up')}
              className="p-1 rounded-full hover:bg-white/15 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Move section up"
            >
              <ChevronUp className="w-3 h-3" />
            </button>
            <button
              type="button"
              disabled={!canMoveDown}
              onClick={() => onQuickMoveSection(sectionId, 'down')}
              className="p-1 rounded-full hover:bg-white/15 disabled:opacity-30 cursor-pointer disabled:cursor-not-allowed"
              title="Move section down"
            >
              <ChevronDown className="w-3 h-3" />
            </button>
          </>
        )}
        {hasToggle && onQuickToggleSection && (
          <button
            type="button"
            onClick={() => onQuickToggleSection(sectionId)}
            className="p-1 rounded-full hover:bg-white/15 cursor-pointer"
            title={isVisible ? 'Hide section' : 'Show section'}
          >
            {isVisible ? <EyeOff className="w-3 h-3" /> : <Eye className="w-3 h-3 text-emerald-400" />}
          </button>
        )}
      </div>

      {!isVisible ? (
        <div className="bg-slate-100/90 border-y border-dashed border-slate-300 px-6 py-4 flex items-center justify-between text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <EyeOff className="w-4 h-4 text-slate-400" />
            <span className="font-bold text-slate-700">{meta.label}</span>
            <span>is currently hidden on the live page</span>
          </div>
          {onQuickToggleSection && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                onQuickToggleSection(sectionId);
              }}
              className="px-3 py-1 rounded-lg bg-white border border-slate-300 hover:border-emerald-400 text-slate-800 font-bold text-[11px] cursor-pointer"
            >
              Show Section
            </button>
          )}
        </div>
      ) : (
        children
      )}
    </div>
  );
}

export default function PublicLandingPage({
  initialClubName = 'ClubSync',
  initialLogoUrl = '',
  initialBatch = '2026/2027',
  initialConfig = null,
  previewConfig = null,
  isPreview = false,
  selectedSectionId = null,
  hoveredSectionId = null,
  showHiddenSections = false,
  onSelectSection,
  onHoverSection,
  onQuickMoveSection,
  onQuickToggleSection,
  authMode,
  setAuthMode,
  email,
  setEmail,
  password,
  setPassword,
  fullName,
  setFullName,
  matricNo,
  setMatricNo,
  phoneNumber,
  setPhoneNumber,
  authError,
  setAuthError,
}: PublicLandingPageProps) {
  const [clubName, setClubName] = useState(initialClubName);
  const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
  const [currentBatch, setCurrentBatch] = useState(initialBatch);
  const [tagline, setTagline] = useState(
    'Campus activities, events, and student community — all in one portal.'
  );
  const [clubAbout, setClubAbout] = useState('');
  const [instagramUrl, setInstagramUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [storedLandingConfig, setStoredLandingConfig] =
    useState<PublicLandingConfig | null>(initialConfig);

  const [stats, setStats] = useState<PublicStats>({
    open_events_count: 0,
    total_events_count: 0,
  });
  const [openEvents, setOpenEvents] = useState<PublicEventCard[]>([]);
  const [carouselPosts, setCarouselPosts] = useState<Announcement[]>([]);
  const [highlightPosts, setHighlightPosts] = useState<Announcement[]>([]);
  const [loadingPublic, setLoadingPublic] = useState(true);

  const [slideIdx, setSlideIdx] = useState(0);
  const [openFaqIds, setOpenFaqIds] = useState<string[]>(['faq-join']);
  const [lightboxPost, setLightboxPost] = useState<Announcement | null>(null);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const [submittingAuth, setSubmittingAuth] = useState(false);

  useEffect(() => {
    if (initialConfig) {
      setStoredLandingConfig(initialConfig);
    }
  }, [initialConfig]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setLoadingPublic(false);
      return;
    }

    let active = true;
    (async () => {
      try {
        const [settingsRes, statsRes, budgetsRes, annRes] = await Promise.all([
          supabase.from('club_settings_public').select('*').eq('id', 1).maybeSingle(),
          supabase.rpc('get_public_club_stats'),
          supabase
            .from('budgets')
            .select(
              'id, event_name, category, event_date, event_time, location, registration_fee, guest_fee, guest_capacity, is_public_registration, public_slug, description, status, created_at'
            )
            .is('deleted_at', null)
            .eq('is_public_registration', true)
            .eq('status', 'Active')
            .order('event_date', { ascending: true }),
          supabase
            .from('announcements')
            .select(
              'id, title, subtitle, content, poster_url, external_link, link_label, is_pinned, show_in_carousel, created_by, created_at'
            )
            .is('deleted_at', null)
            .order('created_at', { ascending: false })
            .limit(12),
        ]);

        if (!active) return;

        if (settingsRes.data) {
          const s = settingsRes.data as Record<string, unknown>;
          if (s.club_name) setClubName(String(s.club_name));
          if (s.logo_url) setLogoUrl(String(s.logo_url));
          if (s.current_batch) setCurrentBatch(String(s.current_batch));
          if (s.club_tagline) setTagline(String(s.club_tagline));
          if (s.club_about) setClubAbout(String(s.club_about));
          if (s.instagram_url) setInstagramUrl(String(s.instagram_url));
          if (s.contact_email) setContactEmail(String(s.contact_email));
          if (s.public_landing_config && typeof s.public_landing_config === 'object') {
            setStoredLandingConfig(s.public_landing_config as PublicLandingConfig);
          }
        }

        if (statsRes.data && typeof statsRes.data === 'object') {
          const st = statsRes.data as Partial<PublicStats>;
          setStats({
            open_events_count: Number(st.open_events_count || 0),
            total_events_count: Number(st.total_events_count || 0),
          });
        }

        const rawEvents = (budgetsRes.data || []) as Budget[];
        const validSlugEvents = rawEvents.filter((b) => Boolean(b.public_slug?.trim()));
        const enrichedEvents: PublicEventCard[] = await Promise.all(
          validSlugEvents.map(async (b) => {
            let regCount = 0;
            if (b.public_slug) {
              const { data: rpcEv } = await supabase.rpc('get_public_event_by_slug', {
                p_slug: b.public_slug,
              });
              if (rpcEv && typeof rpcEv === 'object' && 'guest_registered_count' in rpcEv) {
                regCount = Number(
                  (rpcEv as { guest_registered_count?: unknown }).guest_registered_count || 0
                );
              }
            }
            const effFee = Number(b.guest_fee ?? b.registration_fee ?? 0);
            return {
              ...b,
              effective_fee: effFee,
              guest_registered_count: regCount,
            };
          })
        );
        if (active) setOpenEvents(enrichedEvents);

        const anns = (annRes.data || []) as Announcement[];
        setCarouselPosts(anns.filter((a) => a.show_in_carousel));
        setHighlightPosts(anns.filter((a) => a.is_pinned).slice(0, 4));
      } finally {
        if (active) setLoadingPublic(false);
      }
    })();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (carouselPosts.length <= 1 || lightboxPost || authModalOpen) return;
    const id = setInterval(() => {
      setSlideIdx((prev) => (prev + 1) % carouselPosts.length);
    }, 5500);
    return () => clearInterval(id);
  }, [carouselPosts.length, lightboxPost, authModalOpen]);

  const resolvedConfig = resolvePublicLandingConfig(
    previewConfig ?? storedLandingConfig,
    {
      clubName,
      tagline,
      about: clubAbout,
      instagramUrl,
      contactEmail,
    }
  );

  const theme = LANDING_THEME_STYLES[resolvedConfig.theme_preset];
  const cardSurface = CARD_SURFACE_STYLES[resolvedConfig.card_style];
  const animLevel = resolvedConfig.animation_level;

  const openAuth = (targetMode: 'login' | 'signup') => {
    if (isPreview) return;
    setAuthError(null);
    setAuthMode(targetMode);
    setAuthModalOpen(true);
  };

  const scrollToTop = () => {
    if (isPreview) return;
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleAnchorClick = (e: React.MouseEvent<HTMLAnchorElement>, href: string) => {
    if (isPreview) {
      e.preventDefault();
      return;
    }
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  const toggleFaq = (id: string) => {
    setOpenFaqIds((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  const activeSlide = carouselPosts[slideIdx] || carouselPosts[0] || null;
  const visibleColumns = resolvedConfig.footer_columns.filter(
    (col) => col.title.trim() || col.links.some((l) => l.label.trim() && l.url.trim())
  );

  const middleSectionOrder = resolvedConfig.section_order.filter(
    (id) => id !== 'announcement' && id !== 'hero' && id !== 'footer'
  );

  const renderShowcaseMediaCard = (wide = false) => {
    if (resolvedConfig.hero_cover_image_url.trim()) {
      return (
        <div
          className={`rounded-3xl border ${theme.softBorder} bg-white shadow-xl overflow-hidden group ${
            wide ? 'max-w-4xl mx-auto' : ''
          }`}
        >
          <div className={`relative ${wide ? 'aspect-[16/7]' : 'aspect-[4/3]'} bg-slate-900 overflow-hidden`}>
            <img
              src={resolvedConfig.hero_cover_image_url}
              alt={resolvedConfig.hero_title}
              className="w-full h-full object-cover transition duration-700 group-hover:scale-[1.03]"
            />
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/85 via-slate-950/35 to-transparent p-5 text-white">
              <div className="text-[10px] font-extrabold uppercase tracking-wider text-white/80">
                {resolvedConfig.hero_fallback_eyebrow}
              </div>
              <div className="text-base sm:text-lg font-extrabold leading-snug mt-0.5">
                {resolvedConfig.hero_fallback_title}
              </div>
            </div>
          </div>
        </div>
      );
    }

    if (activeSlide) {
      return (
        <div
          className={`bg-white rounded-3xl border ${theme.softBorder} shadow-xl overflow-hidden group ${
            wide ? 'max-w-4xl mx-auto' : ''
          }`}
        >
          <div
            className={`relative ${wide ? 'aspect-[16/8]' : 'aspect-[4/3]'} bg-slate-900 overflow-hidden`}
          >
            {isPdfMedia(activeSlide.poster_url) ? (
              <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 gap-2">
                <FileText className="w-12 h-12 text-emerald-400" />
                <span className="text-xs font-bold">{activeSlide.title}</span>
              </div>
            ) : (
              <img
                src={activeSlide.poster_url}
                alt={activeSlide.title}
                onClick={(e) => {
                  if (isPreview) return;
                  e.stopPropagation();
                  setLightboxPost(activeSlide);
                }}
                className="w-full h-full object-cover cursor-zoom-in transition duration-500 group-hover:scale-[1.03]"
              />
            )}
            <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent p-5 text-white">
              {activeSlide.subtitle && (
                <span className="inline-block px-2.5 py-0.5 rounded-full bg-white/20 backdrop-blur-xs text-[10px] font-extrabold uppercase mb-1">
                  {activeSlide.subtitle}
                </span>
              )}
              <h3 className="text-base font-extrabold leading-snug">{activeSlide.title}</h3>
            </div>

            {carouselPosts.length > 1 && (
              <div
                className="absolute top-3 right-3 flex items-center gap-1.5"
                onClick={(e) => e.stopPropagation()}
              >
                <button
                  type="button"
                  onClick={() =>
                    setSlideIdx(
                      (prev) => (prev - 1 + carouselPosts.length) % carouselPosts.length
                    )
                  }
                  className="w-8 h-8 rounded-full bg-slate-950/65 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Previous featured slide"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setSlideIdx((prev) => (prev + 1) % carouselPosts.length)}
                  className="w-8 h-8 rounded-full bg-slate-950/65 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Next featured slide"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
            )}
          </div>
          <div className="px-5 py-3.5 bg-white flex items-center justify-between gap-2 text-xs">
            <button
              type="button"
              onClick={(e) => {
                if (isPreview) return;
                e.stopPropagation();
                setLightboxPost(activeSlide);
              }}
              className={`inline-flex items-center gap-1.5 font-bold ${theme.accentText} hover:underline cursor-pointer`}
            >
              <Maximize2 className="w-3.5 h-3.5" />
              <span>Inspect Poster</span>
            </button>
            {carouselPosts.length > 1 && (
              <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                {carouselPosts.map((c, idx) => (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => setSlideIdx(idx)}
                    className={`h-1.5 rounded-full transition cursor-pointer ${
                      idx === slideIdx ? `w-5 ${theme.primaryBtn.split(' ')[0]}` : 'w-1.5 bg-slate-300'
                    }`}
                    aria-label={`Slide ${idx + 1}`}
                  />
                ))}
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div
        className={`${theme.fallbackGradient} text-white rounded-3xl p-8 shadow-xl border border-white/15 space-y-5 relative overflow-hidden ${
          wide ? 'max-w-4xl mx-auto text-left' : ''
        }`}
      >
        <div className="absolute -right-10 -top-10 w-44 h-44 rounded-full bg-white/10 blur-2xl pointer-events-none" />
        <div className="w-12 h-12 rounded-2xl bg-white/15 backdrop-blur-xs flex items-center justify-center">
          <Ticket className="w-6 h-6 text-white" />
        </div>
        <div className="space-y-2 relative">
          <div className="text-[11px] font-extrabold uppercase tracking-wider text-white/80">
            {resolvedConfig.hero_fallback_eyebrow}
          </div>
          <h3 className="text-2xl font-extrabold leading-tight">
            {resolvedConfig.hero_fallback_title}
          </h3>
          <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
            {resolvedConfig.hero_fallback_desc}
          </p>
        </div>
        <div className="pt-2 flex flex-wrap items-center gap-3 text-xs font-bold text-white/90">
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Instant Registration</span>
          </span>
          <span>·</span>
          <span className="inline-flex items-center gap-1">
            <CheckCircle2 className="w-3.5 h-3.5" />
            <span>Digital QR Pass</span>
          </span>
        </div>
      </div>
    );
  };

  const renderMiddleSection = (sectionId: LandingSectionId, idxInMiddle: number) => {
    const canMoveUp = idxInMiddle > 0;
    const canMoveDown = idxInMiddle < middleSectionOrder.length - 1;

    switch (sectionId) {
      case 'metrics': {
        const items = resolvedConfig.metrics_items;
        const visible = resolvedConfig.show_metrics_section && items.length > 0;
        return (
          <EditableSectionWrapper
            key="metrics"
            sectionId="metrics"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_metrics_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            {visible && (
              <section id="metrics" className="max-w-7xl w-full mx-auto px-4 sm:px-6 pt-10 pb-4">
                <div
                  className={`grid grid-cols-1 ${
                    items.length === 2
                      ? 'sm:grid-cols-2'
                      : items.length >= 4
                      ? 'sm:grid-cols-2 lg:grid-cols-4'
                      : 'sm:grid-cols-3'
                  } gap-4`}
                >
                  {items.map((item, idx) => (
                    <Reveal key={item.id} animationLevel={animLevel} delayMs={idx * 70}>
                      <div
                        className={`${cardSurface} rounded-2xl p-5 flex items-center gap-4 hover:-translate-y-0.5 transition duration-300`}
                      >
                        <div
                          className={`w-12 h-12 rounded-2xl ${theme.iconBg} flex items-center justify-center shrink-0`}
                        >
                          <FeatureIcon name={item.icon || 'Sparkles'} className="w-5 h-5" />
                        </div>
                        <div className="min-w-0">
                          <div className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                            <AnimatedMetricValue value={item.value} animationLevel={animLevel} />
                          </div>
                          <div className="text-xs font-extrabold text-slate-800 truncate">
                            {item.label}
                          </div>
                          {item.sublabel && (
                            <div className="text-[11px] text-slate-500 truncate mt-0.5">
                              {item.sublabel}
                            </div>
                          )}
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              </section>
            )}
          </EditableSectionWrapper>
        );
      }

      case 'about': {
        const feats = resolvedConfig.about_features;
        return (
          <EditableSectionWrapper
            key="about"
            sectionId="about"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_about_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            <section id="about-club" className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 space-y-8">
              <Reveal animationLevel={animLevel}>
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-center">
                  <div className={`${resolvedConfig.about_image_url ? 'lg:col-span-7' : 'lg:col-span-9'} space-y-2.5`}>
                    {resolvedConfig.about_eyebrow && (
                      <span
                        className={`inline-block text-[11px] font-extrabold uppercase tracking-wider ${theme.accentText}`}
                      >
                        {resolvedConfig.about_eyebrow}
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                      {resolvedConfig.about_title}
                    </h2>
                    <p className="text-sm sm:text-base text-slate-600 leading-relaxed max-w-3xl">
                      {resolvedConfig.about_description}
                    </p>
                  </div>
                  {resolvedConfig.about_image_url && (
                    <div className="lg:col-span-5">
                      <div className={`rounded-3xl overflow-hidden border ${theme.softBorder} shadow-md aspect-[16/10] bg-slate-100`}>
                        <img
                          src={resolvedConfig.about_image_url}
                          alt={resolvedConfig.about_title}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    </div>
                  )}
                </div>
              </Reveal>

              {feats.length > 0 && (
                <div
                  className={`grid grid-cols-1 ${
                    feats.length === 2
                      ? 'md:grid-cols-2'
                      : feats.length === 4
                      ? 'md:grid-cols-2 lg:grid-cols-4'
                      : 'md:grid-cols-3'
                  } gap-5`}
                >
                  {feats.map((feat, idx) => (
                    <Reveal key={feat.id} animationLevel={animLevel} delayMs={idx * 80}>
                      <div
                        className={`${cardSurface} ${theme.hoverBorder} rounded-3xl p-6 h-full flex flex-col justify-between space-y-4 hover:-translate-y-1 hover:shadow-lg transition duration-300`}
                      >
                        <div className="space-y-3">
                          <div className="flex items-center justify-between gap-2">
                            <div
                              className={`w-11 h-11 rounded-2xl ${theme.iconBg} flex items-center justify-center`}
                            >
                              <FeatureIcon name={feat.icon} className="w-5 h-5" />
                            </div>
                            {feat.badge && (
                              <span
                                className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border ${theme.badgeBg} ${theme.badgeText}`}
                              >
                                {feat.badge}
                              </span>
                            )}
                          </div>
                          <h3 className="text-base font-extrabold text-slate-900">{feat.title}</h3>
                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {feat.description}
                          </p>
                        </div>
                      </div>
                    </Reveal>
                  ))}
                </div>
              )}
            </section>
          </EditableSectionWrapper>
        );
      }

      case 'events':
        return (
          <EditableSectionWrapper
            key="events"
            sectionId="events"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_events_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            <section id="events" className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
              <Reveal animationLevel={animLevel}>
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div>
                    {resolvedConfig.events_eyebrow && (
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.accentText}`}
                      >
                        {resolvedConfig.events_eyebrow}
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                      {resolvedConfig.events_title}
                    </h2>
                  </div>
                  {resolvedConfig.events_subtitle && (
                    <span className="text-xs font-semibold text-slate-500">
                      {resolvedConfig.events_subtitle}
                    </span>
                  )}
                </div>
              </Reveal>

              {loadingPublic ? (
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {[1, 2, 3].map((n) => (
                    <div
                      key={n}
                      className="h-64 rounded-3xl bg-white border border-slate-200 animate-pulse"
                    />
                  ))}
                </div>
              ) : openEvents.length === 0 ? (
                <Reveal animationLevel={animLevel}>
                  <div
                    className={`${cardSurface} rounded-3xl p-8 sm:p-10 text-center space-y-3`}
                  >
                    <div
                      className={`w-12 h-12 rounded-2xl ${theme.softBg} ${theme.accentText} flex items-center justify-center mx-auto`}
                    >
                      <Calendar className="w-6 h-6" />
                    </div>
                    <h3 className="text-base font-extrabold text-slate-900">
                      {resolvedConfig.events_empty_title}
                    </h3>
                    <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                      {resolvedConfig.events_empty_desc}
                    </p>
                    <div className="pt-1">
                      <button
                        type="button"
                        onClick={() => openAuth('login')}
                        className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${theme.primaryBtn} text-xs font-bold cursor-pointer transition`}
                      >
                        <LogIn className="w-3.5 h-3.5" />
                        <span>Member Sign In</span>
                      </button>
                    </div>
                  </div>
                </Reveal>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {openEvents.map((ev, idx) => {
                    const cap = Number(ev.guest_capacity || 0);
                    const spotsLeft =
                      cap > 0 ? Math.max(0, cap - ev.guest_registered_count) : null;
                    const isFull = spotsLeft !== null && spotsLeft <= 0;
                    const fillPct =
                      cap > 0
                        ? Math.min(100, Math.round((ev.guest_registered_count / cap) * 100))
                        : 0;
                    const dateChip = parseDateChip(ev.event_date);

                    return (
                      <Reveal key={ev.id} animationLevel={animLevel} delayMs={idx * 70}>
                        <div
                          className={`${cardSurface} ${theme.hoverBorder} rounded-3xl p-6 h-full flex flex-col justify-between space-y-5 hover:-translate-y-1 hover:shadow-xl transition duration-300 group`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-start justify-between gap-2">
                              <div className="flex flex-wrap items-center gap-1.5">
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold border ${theme.badgeBg} ${theme.badgeText}`}
                                >
                                  {ev.category}
                                </span>
                                <span
                                  className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                                    ev.effective_fee <= 0
                                      ? 'bg-teal-50 text-teal-800 border border-teal-200'
                                      : 'bg-amber-50 text-amber-900 border border-amber-200'
                                  }`}
                                >
                                  {ev.effective_fee <= 0
                                    ? 'Free'
                                    : `RM ${ev.effective_fee.toFixed(2)}`}
                                </span>
                              </div>
                              {dateChip && (
                                <div
                                  className={`px-2.5 py-1 rounded-xl border ${theme.softBorder} ${theme.softBg} text-center shrink-0 leading-tight`}
                                >
                                  <div className={`text-[9px] font-extrabold ${theme.accentText}`}>
                                    {dateChip.month}
                                  </div>
                                  <div className="text-sm font-extrabold text-slate-900">
                                    {dateChip.day}
                                  </div>
                                </div>
                              )}
                            </div>

                            <div>
                              <h3 className="text-lg font-extrabold text-slate-900 leading-snug">
                                {ev.event_name}
                              </h3>
                              <p className="text-xs text-slate-600 mt-1.5 line-clamp-2 leading-relaxed">
                                {ev.description}
                              </p>
                            </div>

                            <div className="space-y-1.5 pt-1 text-xs text-slate-600">
                              <div className="flex items-center gap-2">
                                <Calendar className={`w-3.5 h-3.5 ${theme.accentText} shrink-0`} />
                                <span>{ev.event_date}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <Clock className={`w-3.5 h-3.5 ${theme.accentText} shrink-0`} />
                                <span>{ev.event_time}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <MapPin className={`w-3.5 h-3.5 ${theme.accentText} shrink-0`} />
                                <span>{ev.location}</span>
                              </div>
                            </div>

                            {cap > 0 && (
                              <div className="pt-1 space-y-1">
                                <div className="flex items-center justify-between text-[11px] font-bold text-slate-500">
                                  <span>Guest Capacity</span>
                                  <span>
                                    {ev.guest_registered_count}/{cap} filled
                                  </span>
                                </div>
                                <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                                  <div
                                    style={{ width: `${fillPct}%` }}
                                    className={`h-full rounded-full transition-all duration-500 ${
                                      isFull ? 'bg-rose-500' : theme.progressBar
                                    }`}
                                  />
                                </div>
                              </div>
                            )}
                          </div>

                          <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                            <span
                              className={`text-[11px] font-bold ${
                                isFull ? 'text-rose-600' : 'text-slate-500'
                              }`}
                            >
                              {spotsLeft === null
                                ? 'Open Spots'
                                : isFull
                                ? 'Full Capacity'
                                : `${spotsLeft} spots left`}
                            </span>

                            {isPreview ? (
                              <span
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${theme.primaryBtn} text-xs font-extrabold`}
                              >
                                <span>Register as Guest</span>
                                <ArrowRight className="w-3.5 h-3.5" />
                              </span>
                            ) : (
                              <Link
                                href={`/e/${ev.public_slug}`}
                                className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${theme.primaryBtn} text-xs font-extrabold transition`}
                              >
                                <span>Register as Guest</span>
                                <ArrowRight className="w-3.5 h-3.5 transition-transform group-hover:translate-x-0.5" />
                              </Link>
                            )}
                          </div>
                        </div>
                      </Reveal>
                    );
                  })}
                </div>
              )}
            </section>
          </EditableSectionWrapper>
        );

      case 'highlights': {
        const hasPosts = highlightPosts.length > 0;
        const shouldRenderOnLive = resolvedConfig.show_highlights_section && hasPosts;
        const shouldShowInPreview = resolvedConfig.show_highlights_section && isPreview;
        if (!shouldRenderOnLive && !shouldShowInPreview && !showHiddenSections && selectedSectionId !== 'highlights') {
          return null;
        }
        return (
          <EditableSectionWrapper
            key="highlights"
            sectionId="highlights"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_highlights_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            <section
              id="highlights"
              className="bg-slate-50/85 border-y border-slate-200/70 py-12"
            >
              <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
                <Reveal animationLevel={animLevel}>
                  <div>
                    {resolvedConfig.highlights_eyebrow && (
                      <span
                        className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.accentText} inline-flex items-center gap-1`}
                      >
                        <Pin className="w-3 h-3" />
                        <span>{resolvedConfig.highlights_eyebrow}</span>
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900 mt-0.5">
                      {resolvedConfig.highlights_title}
                    </h2>
                  </div>
                </Reveal>

                {hasPosts ? (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
                    {highlightPosts.map((post, idx) => (
                      <Reveal key={post.id} animationLevel={animLevel} delayMs={idx * 70}>
                        <div
                          onClick={(e) => {
                            if (isPreview) return;
                            e.stopPropagation();
                            setLightboxPost(post);
                          }}
                          className={`${cardSurface} rounded-3xl overflow-hidden hover:shadow-xl hover:-translate-y-1 transition duration-300 cursor-pointer flex flex-col justify-between group h-full`}
                        >
                          <div>
                            {post.poster_url && !isPdfMedia(post.poster_url) ? (
                              <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                                <img
                                  src={post.poster_url}
                                  alt={post.title}
                                  className="w-full h-full object-cover group-hover:scale-105 transition duration-500"
                                />
                              </div>
                            ) : post.poster_url ? (
                              <div className="aspect-[4/3] bg-slate-900 text-white flex flex-col items-center justify-center p-4 gap-1.5">
                                <FileText className="w-8 h-8 text-emerald-400" />
                                <span className="text-[11px] font-bold">PDF Poster</span>
                              </div>
                            ) : null}
                            <div className="p-4 space-y-1.5">
                              {post.subtitle && (
                                <span
                                  className={`text-[10px] font-extrabold uppercase ${theme.accentText}`}
                                >
                                  {post.subtitle}
                                </span>
                              )}
                              <h3 className="text-sm font-extrabold text-slate-900 line-clamp-2">
                                {post.title}
                              </h3>
                              {post.content && (
                                <p className="text-xs text-slate-600 line-clamp-2">{post.content}</p>
                              )}
                            </div>
                          </div>
                          <div
                            className={`px-4 pb-3 pt-1 flex items-center justify-between text-[11px] font-bold ${theme.accentText}`}
                          >
                            <span>Click to view</span>
                            <Maximize2 className="w-3.5 h-3.5" />
                          </div>
                        </div>
                      </Reveal>
                    ))}
                  </div>
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-300 bg-white/80 p-6 text-center text-xs text-slate-500">
                    Pin announcements under Club Activities to showcase poster highlights here.
                  </div>
                )}
              </div>
            </section>
          </EditableSectionWrapper>
        );
      }

      case 'faq': {
        const items = resolvedConfig.faq_items;
        return (
          <EditableSectionWrapper
            key="faq"
            sectionId="faq"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_faq_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            <section id="faq" className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
              <Reveal animationLevel={animLevel}>
                <div className="text-center space-y-1.5">
                  {resolvedConfig.faq_eyebrow && (
                    <span
                      className={`text-[11px] font-extrabold uppercase tracking-wider ${theme.accentText}`}
                    >
                      {resolvedConfig.faq_eyebrow}
                    </span>
                  )}
                  <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-slate-900">
                    {resolvedConfig.faq_title}
                  </h2>
                  {resolvedConfig.faq_subtitle && (
                    <p className="text-xs sm:text-sm text-slate-500 max-w-xl mx-auto">
                      {resolvedConfig.faq_subtitle}
                    </p>
                  )}
                </div>
              </Reveal>

              <div className="space-y-3">
                {items.map((item) => {
                  const isOpenFaq = openFaqIds.includes(item.id);
                  return (
                    <div
                      key={item.id}
                      className={`${cardSurface} rounded-2xl overflow-hidden transition ${
                        isOpenFaq ? `${theme.softBorder} shadow-sm` : ''
                      }`}
                    >
                      <button
                        type="button"
                        onClick={(e) => {
                          if (isPreview) e.stopPropagation();
                          toggleFaq(item.id);
                        }}
                        className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 cursor-pointer"
                      >
                        <span className="text-sm font-extrabold text-slate-900">
                          {item.question}
                        </span>
                        <ChevronDown
                          className={`w-4 h-4 shrink-0 text-slate-500 transition-transform duration-300 ${
                            isOpenFaq ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                      <div
                        className={`grid transition-[grid-template-rows] duration-300 ease-out ${
                          isOpenFaq ? 'grid-rows-[1fr]' : 'grid-rows-[0fr]'
                        }`}
                      >
                        <div className="overflow-hidden">
                          <p className="px-5 pb-4 text-xs sm:text-sm text-slate-600 leading-relaxed">
                            {item.answer}
                          </p>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>
          </EditableSectionWrapper>
        );
      }

      case 'cta': {
        const ctaHref = normalizeExternalHref(resolvedConfig.cta_primary_url, 'link');
        const isActionLink =
          resolvedConfig.cta_primary_action === 'events' ||
          resolvedConfig.cta_primary_action === 'custom';

        return (
          <EditableSectionWrapper
            key="cta"
            sectionId="cta"
            isPreview={isPreview}
            isVisible={resolvedConfig.show_cta_section}
            showHiddenSections={showHiddenSections}
            selectedSectionId={selectedSectionId}
            hoveredSectionId={hoveredSectionId}
            themeRingClass={theme.ringSelected}
            themePillClass={theme.pillSelected}
            canMoveUp={canMoveUp}
            canMoveDown={canMoveDown}
            hasToggle
            onSelectSection={onSelectSection}
            onHoverSection={onHoverSection}
            onQuickMoveSection={onQuickMoveSection}
            onQuickToggleSection={onQuickToggleSection}
          >
            <section className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-10">
              <Reveal animationLevel={animLevel}>
                <div
                  className={`${theme.ctaBannerBg} text-white rounded-3xl p-8 sm:p-12 shadow-xl relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-6`}
                >
                  <div className="absolute -right-16 -top-16 w-64 h-64 rounded-full bg-white/10 blur-3xl pointer-events-none" />
                  <div className="absolute left-1/3 -bottom-24 w-64 h-64 rounded-full bg-black/20 blur-3xl pointer-events-none" />

                  <div className="relative space-y-2.5 max-w-2xl">
                    {resolvedConfig.cta_badge && (
                      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/15 backdrop-blur-xs text-[11px] font-extrabold uppercase tracking-wide">
                        <Sparkles className="w-3 h-3" />
                        <span>{resolvedConfig.cta_badge}</span>
                      </span>
                    )}
                    <h2 className="text-2xl sm:text-3xl font-extrabold tracking-tight leading-tight">
                      {resolvedConfig.cta_title}
                    </h2>
                    <p className="text-xs sm:text-sm text-white/85 leading-relaxed">
                      {resolvedConfig.cta_subtitle}
                    </p>
                  </div>

                  <div className="relative flex flex-wrap items-center gap-3 shrink-0">
                    {isActionLink && !isPreview ? (
                      <a
                        href={
                          resolvedConfig.cta_primary_action === 'events'
                            ? '#events'
                            : ctaHref || '#events'
                        }
                        onClick={(e) =>
                          handleAnchorClick(
                            e,
                            resolvedConfig.cta_primary_action === 'events'
                              ? '#events'
                              : ctaHref || '#events'
                          )
                        }
                        target={
                          resolvedConfig.cta_primary_action === 'custom' &&
                          /^https?:\/\//i.test(ctaHref)
                            ? '_blank'
                            : undefined
                        }
                        rel={
                          resolvedConfig.cta_primary_action === 'custom' &&
                          /^https?:\/\//i.test(ctaHref)
                            ? 'noopener noreferrer'
                            : undefined
                        }
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 text-sm font-extrabold shadow-lg transition"
                      >
                        <span>{resolvedConfig.cta_primary_label}</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    ) : (
                      <button
                        type="button"
                        onClick={() =>
                          openAuth(
                            resolvedConfig.cta_primary_action === 'login' ? 'login' : 'signup'
                          )
                        }
                        className="inline-flex items-center gap-2 px-6 py-3.5 rounded-2xl bg-white text-slate-900 hover:bg-slate-100 text-sm font-extrabold shadow-lg transition cursor-pointer"
                      >
                        <span>{resolvedConfig.cta_primary_label}</span>
                        <ArrowRight className="w-4 h-4" />
                      </button>
                    )}

                    <button
                      type="button"
                      onClick={() => openAuth('login')}
                      className="inline-flex items-center gap-1.5 px-4 py-3.5 rounded-2xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold backdrop-blur-xs transition cursor-pointer"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      <span>Member Sign In</span>
                    </button>
                  </div>
                </div>
              </Reveal>
            </section>
          </EditableSectionWrapper>
        );
      }

      default:
        return null;
    }
  };

  return (
    <div className={`min-h-screen flex flex-col ${theme.pageBg} text-slate-900 relative`}>
      <style>{`
        @keyframes plFloatSlow {
          0%, 100% { transform: translateY(0px) translateX(0px); }
          50% { transform: translateY(-10px) translateX(6px); }
        }
        @keyframes plPulseRing {
          0% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.35); }
          70% { box-shadow: 0 0 0 8px rgba(16, 185, 129, 0); }
          100% { box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
        }
        .pl-float-slow { animation: plFloatSlow 8s ease-in-out infinite; }
        .pl-float-slow-delay { animation: plFloatSlow 10s ease-in-out 1.5s infinite; }
        .pl-pulse-ring { animation: plPulseRing 1.8s ease-out 1; }
      `}</style>

      {/* Top Announcement Ribbon */}
      <EditableSectionWrapper
        sectionId="announcement"
        isPreview={isPreview}
        isVisible={resolvedConfig.show_announcement_bar}
        showHiddenSections={showHiddenSections}
        selectedSectionId={selectedSectionId}
        hoveredSectionId={hoveredSectionId}
        themeRingClass={theme.ringSelected}
        themePillClass={theme.pillSelected}
        hasToggle
        onSelectSection={onSelectSection}
        onHoverSection={onHoverSection}
        onQuickToggleSection={onQuickToggleSection}
      >
        {resolvedConfig.show_announcement_bar && (
          <div className={`${theme.announcementBg} px-4 py-2 text-center text-xs font-semibold`}>
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-center gap-2">
              <Megaphone className="w-3.5 h-3.5 shrink-0 opacity-90" />
              <span>{resolvedConfig.announcement_text}</span>
              {resolvedConfig.announcement_link_label && resolvedConfig.announcement_link_url && (
                <a
                  href={normalizeExternalHref(resolvedConfig.announcement_link_url, 'link')}
                  onClick={(e) =>
                    handleAnchorClick(
                      e,
                      normalizeExternalHref(resolvedConfig.announcement_link_url, 'link')
                    )
                  }
                  className="inline-flex items-center gap-1 underline underline-offset-2 font-extrabold hover:opacity-85"
                >
                  <span>{resolvedConfig.announcement_link_label}</span>
                  <ArrowRight className="w-3 h-3" />
                </a>
              )}
            </div>
          </div>
        )}
      </EditableSectionWrapper>

      {/* Sticky Public Navbar */}
      <header
        className={`${
          isPreview ? 'relative' : 'sticky top-0 z-30'
        } bg-white/85 backdrop-blur-xl border-b ${theme.navBorder}`}
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={scrollToTop}
            title="Return to main homepage"
            className="flex items-center gap-3 min-w-0 text-left cursor-pointer group"
          >
            {logoUrl && !isPdfMedia(logoUrl) ? (
              <img
                src={logoUrl}
                alt={clubName}
                className={`w-10 h-10 rounded-xl object-cover border ${theme.softBorder} bg-white shadow-2xs shrink-0 transition group-hover:scale-105`}
              />
            ) : (
              <div
                className={`w-10 h-10 rounded-xl ${theme.primaryBtn} flex items-center justify-center shadow-2xs shrink-0 transition group-hover:scale-105`}
              >
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={`font-extrabold text-sm sm:text-base text-slate-900 ${theme.accentTextHover} transition truncate`}
                >
                  {clubName}
                </span>
                <span
                  className={`hidden sm:inline-flex px-2 py-0.5 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-[10px] font-extrabold shrink-0`}
                >
                  Batch {currentBatch}
                </span>
              </div>
              {resolvedConfig.nav_subtitle && (
                <p className="text-[11px] text-slate-500 hidden md:block truncate">
                  {resolvedConfig.nav_subtitle}
                </p>
              )}
            </div>
          </button>

          <nav className="hidden lg:flex items-center gap-5 text-xs font-bold text-slate-600">
            {resolvedConfig.show_about_section && (
              <a
                href="#about-club"
                onClick={(e) => handleAnchorClick(e, '#about-club')}
                className={`${theme.accentTextHover} transition`}
              >
                About
              </a>
            )}
            {resolvedConfig.show_events_section && (
              <a
                href="#events"
                onClick={(e) => handleAnchorClick(e, '#events')}
                className={`${theme.accentTextHover} transition`}
              >
                Open Events
              </a>
            )}
            {resolvedConfig.show_highlights_section && highlightPosts.length > 0 && (
              <a
                href="#highlights"
                onClick={(e) => handleAnchorClick(e, '#highlights')}
                className={`${theme.accentTextHover} transition`}
              >
                Highlights
              </a>
            )}
            {resolvedConfig.show_faq_section && resolvedConfig.faq_items.length > 0 && (
              <a
                href="#faq"
                onClick={(e) => handleAnchorClick(e, '#faq')}
                className={`${theme.accentTextHover} transition`}
              >
                FAQ
              </a>
            )}
            <a
              href="#about"
              onClick={(e) => handleAnchorClick(e, '#about')}
              className={`${theme.accentTextHover} transition`}
            >
              Connect
            </a>
          </nav>

          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={() => openAuth('signup')}
              className="inline-flex items-center gap-1 px-2.5 py-2 rounded-xl text-xs font-medium text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer"
            >
              <UserPlus className="w-3.5 h-3.5 opacity-75" />
              <span>Sign Up</span>
            </button>
            <button
              type="button"
              onClick={() => openAuth('login')}
              className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold ${theme.primaryBtn} shadow-sm ${theme.primaryBtnShadow} transition cursor-pointer`}
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Member Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <EditableSectionWrapper
        sectionId="hero"
        isPreview={isPreview}
        isVisible
        selectedSectionId={selectedSectionId}
        hoveredSectionId={hoveredSectionId}
        themeRingClass={theme.ringSelected}
        themePillClass={theme.pillSelected}
        onSelectSection={onSelectSection}
        onHoverSection={onHoverSection}
      >
        <section className={`relative overflow-hidden border-b ${theme.navBorder}`}>
          {/* Dot Grid + Mesh Gradient Orbs */}
          <div
            className="absolute inset-0 opacity-[0.35] pointer-events-none"
            style={{
              backgroundImage: 'radial-gradient(rgba(15, 23, 42, 0.14) 1px, transparent 1px)',
              backgroundSize: '24px 24px',
            }}
          />
          <div
            className={`absolute -top-24 -left-24 w-96 h-96 rounded-full ${theme.orbA} blur-3xl pointer-events-none ${
              animLevel === 'vivid' ? 'pl-float-slow' : ''
            }`}
          />
          <div
            className={`absolute top-12 -right-24 w-96 h-96 rounded-full ${theme.orbB} blur-3xl pointer-events-none ${
              animLevel === 'vivid' ? 'pl-float-slow-delay' : ''
            }`}
          />

          {resolvedConfig.hero_layout === 'banner' ? (
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-10 sm:py-14">
              <div className="relative rounded-[2rem] overflow-hidden bg-slate-950 text-white shadow-2xl border border-white/10 min-h-[420px] flex items-center">
                {(resolvedConfig.hero_cover_image_url || activeSlide?.poster_url) &&
                !isPdfMedia(resolvedConfig.hero_cover_image_url || activeSlide?.poster_url) ? (
                  <img
                    src={resolvedConfig.hero_cover_image_url || activeSlide?.poster_url}
                    alt={resolvedConfig.hero_title}
                    className="absolute inset-0 w-full h-full object-cover opacity-45"
                  />
                ) : null}
                <div className="absolute inset-0 bg-gradient-to-r from-slate-950/95 via-slate-950/80 to-slate-900/50" />

                <div className="relative z-10 p-8 sm:p-14 max-w-3xl space-y-6">
                  {resolvedConfig.hero_badge && (
                    <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-white text-xs font-extrabold">
                      <Sparkles className="w-3.5 h-3.5 text-emerald-300" />
                      <span>{resolvedConfig.hero_badge}</span>
                    </div>
                  )}

                  <div className="space-y-3">
                    <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight leading-[1.1]">
                      {resolvedConfig.hero_title}{' '}
                      {resolvedConfig.hero_highlight_text && (
                        <span className="text-emerald-300">{resolvedConfig.hero_highlight_text}</span>
                      )}
                    </h1>
                    <p className="text-sm sm:text-lg text-slate-200 leading-relaxed max-w-2xl">
                      {resolvedConfig.hero_subtitle}
                    </p>
                  </div>

                  {resolvedConfig.hero_show_stats && (
                    <div className="flex flex-wrap items-center gap-2.5">
                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs">
                        <Ticket className="w-4 h-4 text-emerald-300" />
                        <span className="font-extrabold">
                          {openEvents.length || stats.open_events_count}
                        </span>
                        <span className="text-slate-300">Open Events</span>
                      </div>
                      <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white/10 backdrop-blur-md border border-white/15 text-xs">
                        <Calendar className="w-4 h-4 text-emerald-300" />
                        <span className="text-slate-300">Active Batch:</span>
                        <span className="font-extrabold">{currentBatch}</span>
                      </div>
                    </div>
                  )}

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="button"
                      onClick={() => openAuth('login')}
                      className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl ${theme.primaryBtn} text-sm font-extrabold shadow-lg transition cursor-pointer`}
                    >
                      <LogIn className="w-4 h-4" />
                      <span>Member Sign In</span>
                    </button>
                    {resolvedConfig.show_events_section && (
                      <a
                        href="#events"
                        onClick={(e) => handleAnchorClick(e, '#events')}
                        className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white/15 hover:bg-white/25 backdrop-blur-md text-white border border-white/20 text-sm font-bold transition"
                      >
                        <span>{resolvedConfig.hero_primary_cta}</span>
                        <ArrowRight className="w-4 h-4" />
                      </a>
                    )}
                    {resolvedConfig.hero_secondary_cta_label && (
                      <a
                        href={normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'}
                        onClick={(e) =>
                          handleAnchorClick(
                            e,
                            normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'
                          )
                        }
                        className="inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl text-xs font-bold text-white/90 hover:text-white underline underline-offset-4"
                      >
                        <span>{resolvedConfig.hero_secondary_cta_label}</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() => openAuth('signup')}
                      className="text-xs font-medium text-slate-300 hover:text-white underline underline-offset-4 px-2 py-1 cursor-pointer"
                    >
                      Register as member
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ) : resolvedConfig.hero_layout === 'centered' ? (
            <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-12 sm:py-16 text-center space-y-10">
              <div className="max-w-3xl mx-auto space-y-6">
                {resolvedConfig.hero_badge && (
                  <div
                    className={`inline-flex items-center gap-2 px-3.5 py-1 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-xs font-extrabold`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${theme.accentText}`} />
                    <span>{resolvedConfig.hero_badge}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold tracking-tight text-slate-900 leading-[1.08]">
                    {resolvedConfig.hero_title}{' '}
                    {resolvedConfig.hero_highlight_text && (
                      <span className={theme.gradientText}>{resolvedConfig.hero_highlight_text}</span>
                    )}
                  </h1>
                  <p className="text-sm sm:text-lg text-slate-600 leading-relaxed max-w-2xl mx-auto">
                    {resolvedConfig.hero_subtitle}
                  </p>
                </div>

                {resolvedConfig.hero_show_stats && (
                  <div className="flex flex-wrap items-center justify-center gap-2.5">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                      <Ticket className={`w-4 h-4 ${theme.accentText}`} />
                      <span className="font-extrabold text-slate-900">
                        {openEvents.length || stats.open_events_count}
                      </span>
                      <span className="text-slate-500 font-medium">Open Events</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                      <Calendar className={`w-4 h-4 ${theme.accentText}`} />
                      <span className="text-slate-500 font-medium">Active Batch:</span>
                      <span className="font-extrabold text-slate-900">{currentBatch}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl ${theme.primaryBtn} text-sm font-extrabold shadow-md ${theme.primaryBtnShadow} transition cursor-pointer`}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Member Sign In</span>
                  </button>
                  {resolvedConfig.show_events_section && (
                    <a
                      href="#events"
                      onClick={(e) => handleAnchorClick(e, '#events')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-bold shadow-2xs transition"
                    >
                      <span>{resolvedConfig.hero_primary_cta}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                  {resolvedConfig.hero_secondary_cta_label && (
                    <a
                      href={normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'}
                      onClick={(e) =>
                        handleAnchorClick(
                          e,
                          normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/80 hover:bg-white border border-slate-200 text-xs font-bold ${theme.accentText} transition`}
                    >
                      <span>{resolvedConfig.hero_secondary_cta_label}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-4 px-2 py-1 cursor-pointer"
                  >
                    Register as member
                  </button>
                </div>
              </div>

              <div>{renderShowcaseMediaCard(true)}</div>
            </div>
          ) : (
            <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
              <div className="lg:col-span-7 space-y-6">
                {resolvedConfig.hero_badge && (
                  <div
                    className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border ${theme.badgeBg} ${theme.badgeText} text-xs font-extrabold`}
                  >
                    <Sparkles className={`w-3.5 h-3.5 ${theme.accentText}`} />
                    <span>{resolvedConfig.hero_badge}</span>
                  </div>
                )}

                <div className="space-y-3">
                  <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                    {resolvedConfig.hero_title}{' '}
                    {resolvedConfig.hero_highlight_text && (
                      <span className={theme.gradientText}>{resolvedConfig.hero_highlight_text}</span>
                    )}
                  </h1>
                  <p className="text-sm sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                    {resolvedConfig.hero_subtitle}
                  </p>
                </div>

                {resolvedConfig.hero_show_stats && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                      <Ticket className={`w-4 h-4 ${theme.accentText}`} />
                      <span className="font-extrabold text-slate-900">
                        {openEvents.length || stats.open_events_count}
                      </span>
                      <span className="text-slate-500 font-medium">Open Events</span>
                    </div>
                    <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                      <Calendar className={`w-4 h-4 ${theme.accentText}`} />
                      <span className="text-slate-500 font-medium">Active Batch:</span>
                      <span className="font-extrabold text-slate-900">{currentBatch}</span>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={() => openAuth('login')}
                    className={`inline-flex items-center gap-2 px-6 py-3 rounded-2xl ${theme.primaryBtn} text-sm font-extrabold shadow-md ${theme.primaryBtnShadow} transition cursor-pointer`}
                  >
                    <LogIn className="w-4 h-4" />
                    <span>Member Sign In</span>
                  </button>
                  {resolvedConfig.show_events_section && (
                    <a
                      href="#events"
                      onClick={(e) => handleAnchorClick(e, '#events')}
                      className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl bg-white hover:bg-slate-50 text-slate-800 border border-slate-200 text-sm font-bold shadow-2xs transition"
                    >
                      <span>{resolvedConfig.hero_primary_cta}</span>
                      <ArrowRight className="w-4 h-4" />
                    </a>
                  )}
                  {resolvedConfig.hero_secondary_cta_label && (
                    <a
                      href={normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'}
                      onClick={(e) =>
                        handleAnchorClick(
                          e,
                          normalizeExternalHref(resolvedConfig.hero_secondary_cta_url, 'link') || '#about-club'
                        )
                      }
                      className={`inline-flex items-center gap-1.5 px-4 py-3 rounded-2xl bg-white/70 hover:bg-white border border-slate-200 text-xs font-bold ${theme.accentText} transition`}
                    >
                      <span>{resolvedConfig.hero_secondary_cta_label}</span>
                    </a>
                  )}
                  <button
                    type="button"
                    onClick={() => openAuth('signup')}
                    className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-4 px-2 py-1 cursor-pointer"
                  >
                    Register as member
                  </button>
                </div>
              </div>

              <div className="lg:col-span-5">{renderShowcaseMediaCard(false)}</div>
            </div>
          )}
        </section>
      </EditableSectionWrapper>

      {/* Reorderable Middle Sections */}
      {middleSectionOrder.map((secId, idx) => renderMiddleSection(secId, idx))}

      {/* Multi-Column Dark Footer (#about) */}
      <EditableSectionWrapper
        sectionId="footer"
        isPreview={isPreview}
        isVisible
        selectedSectionId={selectedSectionId}
        hoveredSectionId={hoveredSectionId}
        themeRingClass={theme.ringSelected}
        themePillClass={theme.pillSelected}
        onSelectSection={onSelectSection}
        onHoverSection={onHoverSection}
      >
        <footer id="about" className="mt-auto bg-slate-950 text-slate-300 border-t border-slate-800">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 py-12 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
            <div className="lg:col-span-4 space-y-3.5">
              <button
                type="button"
                onClick={scrollToTop}
                className="flex items-center gap-2.5 text-left cursor-pointer group"
                title="Back to top"
              >
                {logoUrl && !isPdfMedia(logoUrl) ? (
                  <img
                    src={logoUrl}
                    alt={clubName}
                    className="w-9 h-9 rounded-xl object-cover bg-white"
                  />
                ) : (
                  <div
                    className={`w-9 h-9 rounded-xl ${theme.primaryBtn} flex items-center justify-center`}
                  >
                    <Layers className="w-5 h-5" />
                  </div>
                )}
                <span className="text-base font-extrabold text-white group-hover:text-emerald-300 transition">
                  {clubName}
                </span>
                <span className="px-2 py-0.5 rounded-full bg-white/10 text-emerald-300 text-[10px] font-bold">
                  Batch {currentBatch}
                </span>
              </button>

              <p className="text-xs text-slate-400 leading-relaxed max-w-md whitespace-pre-line">
                {resolvedConfig.footer_about}
              </p>

              <div className="pt-1 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${theme.primaryBtn} text-xs font-extrabold cursor-pointer transition`}
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Member Sign In</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAuth('signup')}
                  className="text-xs font-medium text-slate-400 hover:text-slate-200 underline-offset-4 hover:underline cursor-pointer"
                >
                  Sign up as member
                </button>
              </div>
            </div>

            <div
              className={`lg:col-span-8 grid grid-cols-1 sm:grid-cols-2 ${
                visibleColumns.length >= 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'
              } gap-6`}
            >
              {visibleColumns.map((col) => {
                const validLinks = col.links.filter(
                  (l) => l.label.trim() && l.url.trim()
                );
                return (
                  <div key={col.id} className="space-y-2.5 text-xs">
                    <div className="font-extrabold text-white uppercase tracking-wider text-[11px]">
                      {col.title || 'Links'}
                    </div>
                    {validLinks.length === 0 ? (
                      <p className="text-[11px] text-slate-500 italic">No links added yet.</p>
                    ) : (
                      <ul className="space-y-2">
                        {validLinks.map((lnk) => {
                          const href = normalizeExternalHref(lnk.url, lnk.platform);
                          const isAnchor = href.startsWith('#');
                          const isExternal = /^https?:\/\//i.test(href);
                          return (
                            <li key={lnk.id}>
                              <a
                                href={href}
                                onClick={
                                  isAnchor ? (e) => handleAnchorClick(e, href) : undefined
                                }
                                target={isExternal ? '_blank' : undefined}
                                rel={isExternal ? 'noopener noreferrer' : undefined}
                                className="inline-flex items-center gap-2 text-slate-300 hover:text-white transition font-medium"
                              >
                                <FooterPlatformIcon platform={lnk.platform} />
                                <span>{lnk.label}</span>
                                {isExternal && (
                                  <ExternalLink className="w-3 h-3 opacity-60 shrink-0" />
                                )}
                              </a>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {resolvedConfig.footer_copyright && (
            <div className="border-t border-slate-900 bg-slate-950/90 px-4 sm:px-6 py-4">
              <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                <span>{resolvedConfig.footer_copyright}</span>
                <span>Student Club Operations &amp; Guest Event Portal</span>
              </div>
            </div>
          )}
        </footer>
      </EditableSectionWrapper>

      {/* Poster Lightbox Modal */}
      {lightboxPost && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/90 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setLightboxPost(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-3xl w-full overflow-hidden shadow-2xl my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
              <div>
                {lightboxPost.subtitle && (
                  <span
                    className={`text-[10px] font-extrabold uppercase ${theme.accentText} block`}
                  >
                    {lightboxPost.subtitle}
                  </span>
                )}
                <h3 className="text-sm font-extrabold text-slate-900">{lightboxPost.title}</h3>
              </div>
              <button
                type="button"
                onClick={() => setLightboxPost(null)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 flex items-center justify-center cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            {lightboxPost.poster_url && (
              <div className="bg-slate-950 flex items-center justify-center p-4 max-h-[65vh]">
                {isPdfMedia(lightboxPost.poster_url) ? (
                  <a
                    href={lightboxPost.poster_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`px-4 py-2 rounded-xl ${theme.primaryBtn} text-xs font-bold`}
                  >
                    Open PDF Poster <ExternalLink className="w-3.5 h-3.5 inline ml-1" />
                  </a>
                ) : (
                  <img
                    src={lightboxPost.poster_url}
                    alt={lightboxPost.title}
                    className="max-h-[60vh] w-auto object-contain rounded-xl"
                  />
                )}
              </div>
            )}
            <div className="p-5 space-y-3 text-xs text-slate-700">
              {lightboxPost.content && (
                <p className="whitespace-pre-line leading-relaxed">{lightboxPost.content}</p>
              )}
              {lightboxPost.external_link && (
                <a
                  href={lightboxPost.external_link}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl ${theme.primaryBtn} font-bold`}
                >
                  <span>{lightboxPost.link_label || 'More Info'}</span>
                  <ExternalLink className="w-3.5 h-3.5" />
                </a>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Centered Member Auth Modal */}
      {authModalOpen && !isPreview && (
        <div
          className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setAuthModalOpen(false)}
        >
          <div
            className={`relative max-w-md w-full bg-white text-slate-900 rounded-3xl shadow-2xl border ${theme.softBorder} overflow-hidden my-8`}
            onClick={(e) => e.stopPropagation()}
          >
            <button
              type="button"
              onClick={() => setAuthModalOpen(false)}
              className="absolute top-4 right-4 z-10 w-8 h-8 rounded-full bg-white/80 hover:bg-white text-slate-600 flex items-center justify-center shadow-2xs cursor-pointer"
              aria-label="Close sign in modal"
            >
              <X className="w-4 h-4" />
            </button>

            <div className={`bg-gradient-to-b from-slate-100/80 via-white to-white p-6 text-center text-slate-900 border-b ${theme.navBorder}`}>
              {logoUrl && !isPdfMedia(logoUrl) ? (
                <img
                  src={logoUrl}
                  alt={clubName}
                  className={`w-14 h-14 rounded-2xl object-cover mx-auto mb-2 bg-white shadow-sm border ${theme.softBorder}`}
                />
              ) : (
                <div
                  className={`w-13 h-13 rounded-2xl ${theme.primaryBtn} flex items-center justify-center mx-auto mb-2 shadow-sm`}
                >
                  <Layers className="w-7 h-7" />
                </div>
              )}
              <h2 className="text-lg font-extrabold text-slate-900">{clubName}</h2>
              <p className="text-xs text-slate-500 mt-0.5">Member Portal Access</p>
            </div>

            <div className="grid grid-cols-2 bg-slate-100 p-1 m-5 mb-2 rounded-2xl">
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode('login');
                }}
                className={`py-2 text-xs rounded-xl transition cursor-pointer ${
                  authMode === 'login'
                    ? `${theme.primaryBtn} font-extrabold shadow-xs`
                    : 'text-slate-600 font-semibold hover:text-slate-900'
                }`}
              >
                Member Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setAuthError(null);
                  setAuthMode('signup');
                }}
                className={`py-2 text-xs rounded-xl transition cursor-pointer ${
                  authMode === 'signup'
                    ? 'bg-slate-800 text-white font-bold shadow-xs'
                    : 'text-slate-500 font-medium hover:text-slate-800'
                }`}
              >
                Sign Up
              </button>
            </div>

            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setAuthError(null);
                setSubmittingAuth(true);
                try {
                  const res =
                    authMode === 'signup'
                      ? await supabase.auth.signUp({
                          email: email.trim(),
                          password,
                          options: {
                            data: {
                              full_name: fullName.trim(),
                              matric_no: matricNo.trim().toUpperCase(),
                              phone_number: phoneNumber.trim(),
                              role: 'member',
                            },
                          },
                        })
                      : await supabase.auth.signInWithPassword({
                          email: email.trim(),
                          password,
                        });
                  if (res.error) setAuthError(res.error.message);
                } finally {
                  setSubmittingAuth(false);
                }
              }}
              className="p-6 pt-2 space-y-3 text-xs"
            >
              {authMode === 'signup' && (
                <>
                  <input
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Full Name *"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
                    required
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={matricNo}
                      onChange={(e) => setMatricNo(e.target.value)}
                      placeholder="Matric No *"
                      className="rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 font-mono"
                      required
                    />
                    <input
                      type="tel"
                      value={phoneNumber}
                      onChange={(e) => setPhoneNumber(e.target.value)}
                      placeholder="Phone *"
                      className="rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 font-mono"
                      required
                    />
                  </div>
                </>
              )}
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
                required
              />
              <input
                type="password"
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password *"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
                required
              />
              {authError && <div className="text-rose-600 font-semibold">{authError}</div>}
              <button
                type="submit"
                disabled={submittingAuth}
                className={`w-full py-2.5 rounded-xl font-bold text-sm shadow-sm cursor-pointer disabled:opacity-60 ${
                  authMode === 'login'
                    ? theme.primaryBtn
                    : 'bg-slate-800 hover:bg-slate-700 text-white'
                }`}
              >
                {submittingAuth
                  ? 'Please wait...'
                  : authMode === 'login'
                  ? 'Sign In'
                  : 'Create Member Account'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
