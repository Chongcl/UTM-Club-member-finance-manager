'use client';

import React, { useEffect, useState } from 'react';
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
} from 'lucide-react';

interface PublicLandingPageProps {
  initialClubName?: string;
  initialLogoUrl?: string;
  initialBatch?: string;
  initialConfig?: PublicLandingConfig | null;
  previewConfig?: PublicLandingConfig | null;
  isPreview?: boolean;
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

function FooterPlatformIcon({ platform }: { platform?: FooterLinkPlatform }) {
  switch (platform) {
    case 'facebook':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M13.5 22v-8h2.7l.4-3h-3.1V9.1c0-.9.3-1.5 1.6-1.5h1.7V4.9c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3V11H7.5v3h2.6v8h3.4z" />
        </svg>
      );
    case 'linkedin':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M6.94 8.5H3.56V19.5H6.94V8.5ZM5.25 3.5C4.14 3.5 3.25 4.39 3.25 5.5C3.25 6.6 4.14 7.5 5.25 7.5C6.35 7.5 7.25 6.6 7.25 5.5C7.25 4.39 6.35 3.5 5.25 3.5ZM20.44 13.02C20.44 9.88 18.76 8.22 16.16 8.22C14.37 8.22 13.48 9.2 13.02 9.93V8.5H9.65C9.7 9.48 9.65 19.5 9.65 19.5H13.02V13.36C13.02 13.02 13.05 12.69 13.15 12.45C13.42 11.78 14.03 11.09 15.07 11.09C16.41 11.09 17.06 12.11 17.06 13.6V19.5H20.44V13.02Z" />
        </svg>
      );
    case 'youtube':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M21.58 7.19C21.35 6.33 20.67 5.65 19.81 5.42C18.25 5 12 5 12 5C12 5 5.75 5 4.19 5.42C3.33 5.65 2.65 6.33 2.42 7.19C2 8.75 2 12 2 12C2 12 2 15.25 2.42 16.81C2.65 17.67 3.33 18.35 4.19 18.58C5.75 19 12 19 12 19C12 19 18.25 19 19.81 18.58C20.67 18.35 21.35 17.67 21.58 16.81C22 15.25 22 12 22 12C22 12 22 8.75 21.58 7.19ZM10 15V9L15.2 12L10 15Z" />
        </svg>
      );
    case 'tiktok':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M16.6 5.82C15.9 5.02 15.5 3.99 15.5 2.9H12.4V15.4C12.38 16.71 11.31 17.76 10 17.76C8.67 17.76 7.6 16.68 7.6 15.36C7.6 14.04 8.67 12.96 10 12.96C10.24 12.96 10.48 13 10.7 13.07V9.91C10.47 9.88 10.24 9.86 10 9.86C6.96 9.86 4.5 12.33 4.5 15.36C4.5 18.39 6.96 20.86 10 20.86C13.04 20.86 15.5 18.39 15.5 15.36V9.01C16.75 9.91 18.28 10.43 19.9 10.43V7.34C18.61 7.34 17.44 6.76 16.6 5.82Z" />
        </svg>
      );
    case 'twitter':
      return (
        <svg className="w-3.5 h-3.5 shrink-0" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
          <path d="M18.244 2.25H21.552L14.325 10.51L22.827 21.75H16.17L10.956 14.933L4.99 21.75H1.68L9.41 12.915L1.254 2.25H8.08L12.793 8.481L18.244 2.25ZM17.083 19.77H18.916L7.084 4.126H5.117L17.083 19.77Z" />
        </svg>
      );
    case 'instagram':
      return <Instagram className="w-3.5 h-3.5 shrink-0" />;
    case 'whatsapp':
      return <MessageCircle className="w-3.5 h-3.5 shrink-0" />;
    case 'email':
      return <Mail className="w-3.5 h-3.5 shrink-0" />;
    case 'website':
      return <Globe className="w-3.5 h-3.5 shrink-0" />;
    default:
      return <Link2 className="w-3.5 h-3.5 shrink-0" />;
  }
}

export default function PublicLandingPage({
  initialClubName = 'ClubSync',
  initialLogoUrl = '',
  initialBatch = '2026/2027',
  initialConfig = null,
  previewConfig = null,
  isPreview = false,
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
    }, 5000);
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
    if (!href.startsWith('#')) return;
    e.preventDefault();
    const target = document.querySelector(href);
    if (target) target.scrollIntoView({ behavior: 'smooth' });
  };

  const activeSlide = carouselPosts[slideIdx] || carouselPosts[0] || null;
  const visibleColumns = resolvedConfig.footer_columns.filter(
    (col) => col.title.trim() || col.links.some((l) => l.label.trim() && l.url.trim())
  );

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-b from-emerald-50/70 via-white to-slate-50 text-slate-900">
      {/* Sticky Public Navbar */}
      <header
        className={`${
          isPreview ? 'relative' : 'sticky top-0 z-30'
        } bg-white/85 backdrop-blur-xl border-b border-emerald-100/80`}
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
                className="w-10 h-10 rounded-xl object-cover border border-emerald-200 bg-white shadow-2xs shrink-0 transition group-hover:scale-105"
              />
            ) : (
              <div className="w-10 h-10 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-2xs shrink-0 transition group-hover:scale-105">
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-extrabold text-sm sm:text-base text-slate-900 group-hover:text-emerald-700 transition truncate">
                  {clubName}
                </span>
                <span className="hidden sm:inline-flex px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-extrabold shrink-0">
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

          <nav className="hidden md:flex items-center gap-6 text-xs font-bold text-slate-600">
            {resolvedConfig.show_events_section && (
              <a
                href="#events"
                onClick={(e) => handleAnchorClick(e, '#events')}
                className="hover:text-emerald-700 transition"
              >
                Open Events
              </a>
            )}
            {resolvedConfig.show_highlights_section && (
              <a
                href="#highlights"
                onClick={(e) => handleAnchorClick(e, '#highlights')}
                className="hover:text-emerald-700 transition"
              >
                Highlights
              </a>
            )}
            <a
              href="#about"
              onClick={(e) => handleAnchorClick(e, '#about')}
              className="hover:text-emerald-700 transition"
            >
              Connect &amp; About
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
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-extrabold bg-emerald-600 hover:bg-emerald-500 text-white shadow-sm shadow-emerald-600/20 transition cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5" />
              <span>Member Sign In</span>
            </button>
          </div>
        </div>
      </header>

      {/* Hero Showcase */}
      <section className="relative overflow-hidden border-b border-emerald-100/70">
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-200/35 blur-3xl pointer-events-none" />
        <div className="absolute top-12 -right-24 w-96 h-96 rounded-full bg-teal-200/35 blur-3xl pointer-events-none" />

        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-12 sm:py-16 grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-6">
            {resolvedConfig.hero_badge && (
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-emerald-100/80 border border-emerald-200 text-emerald-900 text-xs font-extrabold">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600" />
                <span>{resolvedConfig.hero_badge}</span>
              </div>
            )}

            <div className="space-y-3">
              <h1 className="text-3xl sm:text-5xl font-extrabold tracking-tight text-slate-900 leading-[1.12]">
                {resolvedConfig.hero_title}
              </h1>
              <p className="text-sm sm:text-lg text-slate-600 max-w-2xl leading-relaxed">
                {resolvedConfig.hero_subtitle}
              </p>
            </div>

            {/* Public Non-Member Stats Only */}
            {resolvedConfig.hero_show_stats && (
              <div className="flex flex-wrap items-center gap-2.5">
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                  <Ticket className="w-4 h-4 text-teal-600" />
                  <span className="font-extrabold text-slate-900">
                    {openEvents.length || stats.open_events_count}
                  </span>
                  <span className="text-slate-500 font-medium">Open Events</span>
                </div>
                <div className="inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl bg-white border border-slate-200 shadow-2xs text-xs">
                  <Calendar className="w-4 h-4 text-emerald-700" />
                  <span className="text-slate-500 font-medium">Active Batch:</span>
                  <span className="font-extrabold text-slate-900">{currentBatch}</span>
                </div>
              </div>
            )}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                onClick={() => openAuth('login')}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-extrabold shadow-md shadow-emerald-600/20 transition cursor-pointer"
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
              <button
                type="button"
                onClick={() => openAuth('signup')}
                className="text-xs font-medium text-slate-500 hover:text-slate-800 underline underline-offset-4 px-2 py-1 cursor-pointer"
              >
                Register as member
              </button>
            </div>
          </div>

          {/* Featured Auto-Rotating Poster Card */}
          <div className="lg:col-span-5">
            {activeSlide ? (
              <div className="bg-white rounded-3xl border border-emerald-100 shadow-xl overflow-hidden group">
                <div className="relative aspect-[4/3] bg-slate-900 overflow-hidden">
                  {isPdfMedia(activeSlide.poster_url) ? (
                    <div className="w-full h-full flex flex-col items-center justify-center text-white p-6 gap-2">
                      <FileText className="w-12 h-12 text-emerald-400" />
                      <span className="text-xs font-bold">{activeSlide.title}</span>
                    </div>
                  ) : (
                    <img
                      src={activeSlide.poster_url}
                      alt={activeSlide.title}
                      onClick={() => setLightboxPost(activeSlide)}
                      className="w-full h-full object-cover cursor-zoom-in transition duration-500 group-hover:scale-[1.02]"
                    />
                  )}
                  <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-slate-950/90 via-slate-950/45 to-transparent p-5 text-white">
                    {activeSlide.subtitle && (
                      <span className="inline-block px-2 py-0.5 rounded-full bg-emerald-500/90 text-[10px] font-extrabold uppercase mb-1">
                        {activeSlide.subtitle}
                      </span>
                    )}
                    <h3 className="text-base font-extrabold leading-snug">{activeSlide.title}</h3>
                  </div>

                  {carouselPosts.length > 1 && (
                    <div className="absolute top-3 right-3 flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() =>
                          setSlideIdx(
                            (prev) => (prev - 1 + carouselPosts.length) % carouselPosts.length
                          )
                        }
                        className="w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer"
                        aria-label="Previous featured slide"
                      >
                        <ChevronLeft className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => setSlideIdx((prev) => (prev + 1) % carouselPosts.length)}
                        className="w-8 h-8 rounded-full bg-slate-950/60 hover:bg-slate-950 text-white flex items-center justify-center cursor-pointer"
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
                    onClick={() => setLightboxPost(activeSlide)}
                    className="inline-flex items-center gap-1.5 font-bold text-emerald-700 hover:underline cursor-pointer"
                  >
                    <Maximize2 className="w-3.5 h-3.5" />
                    <span>Inspect Poster</span>
                  </button>
                  {carouselPosts.length > 1 && (
                    <div className="flex items-center gap-1">
                      {carouselPosts.map((c, idx) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => setSlideIdx(idx)}
                          className={`h-1.5 rounded-full transition cursor-pointer ${
                            idx === slideIdx ? 'w-5 bg-emerald-600' : 'w-1.5 bg-slate-300'
                          }`}
                          aria-label={`Slide ${idx + 1}`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="bg-gradient-to-br from-emerald-700 via-teal-700 to-slate-900 text-white rounded-3xl p-8 shadow-xl border border-emerald-500/30 space-y-5">
                <div className="w-12 h-12 rounded-2xl bg-white/15 flex items-center justify-center">
                  <Ticket className="w-6 h-6 text-emerald-300" />
                </div>
                <div className="space-y-2">
                  <div className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-300">
                    {resolvedConfig.hero_fallback_eyebrow}
                  </div>
                  <h3 className="text-2xl font-extrabold leading-tight">
                    {resolvedConfig.hero_fallback_title}
                  </h3>
                  <p className="text-xs text-emerald-100 leading-relaxed">
                    {resolvedConfig.hero_fallback_desc}
                  </p>
                </div>
                <div className="pt-2 flex items-center gap-3 text-xs font-bold text-emerald-200">
                  <span>✓ Instant Registration</span>
                  <span>·</span>
                  <span>✓ Digital QR Pass</span>
                </div>
              </div>
            )}
          </div>
        </div>
      </section>

      {/* Open Public Events Grid (#events) */}
      {resolvedConfig.show_events_section && (
        <section id="events" className="max-w-7xl w-full mx-auto px-4 sm:px-6 py-12 space-y-6">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              {resolvedConfig.events_eyebrow && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700">
                  {resolvedConfig.events_eyebrow}
                </span>
              )}
              <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {resolvedConfig.events_title}
              </h2>
            </div>
            {resolvedConfig.events_subtitle && (
              <span className="text-xs font-semibold text-slate-500">
                {resolvedConfig.events_subtitle}
              </span>
            )}
          </div>

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
            <div className="bg-white rounded-3xl border border-emerald-100 p-8 sm:p-10 text-center space-y-3 shadow-2xs">
              <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto">
                <Calendar className="w-6 h-6" />
              </div>
              <h3 className="text-base font-extrabold text-slate-900">
                No public guest events open at the moment
              </h3>
              <p className="text-xs text-slate-500 max-w-md mx-auto leading-relaxed">
                Check back soon for upcoming tournaments, workshops, and open sessions. Already a club member? Sign in to view internal club activities.
              </p>
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => openAuth('login')}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <LogIn className="w-3.5 h-3.5" />
                  <span>Member Sign In</span>
                </button>
              </div>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
              {openEvents.map((ev) => {
                const cap = Number(ev.guest_capacity || 0);
                const spotsLeft = cap > 0 ? Math.max(0, cap - ev.guest_registered_count) : null;
                const isFull = spotsLeft !== null && spotsLeft <= 0;

                return (
                  <div
                    key={ev.id}
                    className="bg-white rounded-3xl border border-slate-200/90 hover:border-emerald-300 p-6 flex flex-col justify-between space-y-5 shadow-2xs hover:shadow-lg transition"
                  >
                    <div className="space-y-3">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                          {ev.category}
                        </span>
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-extrabold ${
                            ev.effective_fee <= 0
                              ? 'bg-teal-50 text-teal-800 border border-teal-200'
                              : 'bg-amber-50 text-amber-900 border border-amber-200'
                          }`}
                        >
                          {ev.effective_fee <= 0 ? 'Free' : `RM ${ev.effective_fee.toFixed(2)}`}
                        </span>
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
                          <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{ev.event_date}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{ev.event_time}</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{ev.location}</span>
                        </div>
                      </div>
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
                          : `${spotsLeft} of ${cap} spots left`}
                      </span>

                      {isPreview ? (
                        <span className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-extrabold">
                          Register as Guest →
                        </span>
                      ) : (
                        <Link
                          href={`/e/${ev.public_slug}`}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition"
                        >
                          <span>Register as Guest →</span>
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </section>
      )}

      {/* Club Highlights (#highlights) */}
      {resolvedConfig.show_highlights_section && highlightPosts.length > 0 && (
        <section
          id="highlights"
          className="bg-slate-50/80 border-y border-slate-200/70 py-12"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 space-y-6">
            <div>
              {resolvedConfig.highlights_eyebrow && (
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-emerald-700 inline-flex items-center gap-1">
                  <Pin className="w-3 h-3" />
                  <span>{resolvedConfig.highlights_eyebrow}</span>
                </span>
              )}
              <h2 className="text-2xl font-extrabold text-slate-900 mt-0.5">
                {resolvedConfig.highlights_title}
              </h2>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {highlightPosts.map((post) => (
                <div
                  key={post.id}
                  onClick={() => setLightboxPost(post)}
                  className="bg-white rounded-3xl border border-slate-200 overflow-hidden shadow-2xs hover:shadow-md transition cursor-pointer flex flex-col justify-between group"
                >
                  <div>
                    {post.poster_url && !isPdfMedia(post.poster_url) ? (
                      <div className="aspect-[4/3] bg-slate-100 overflow-hidden">
                        <img
                          src={post.poster_url}
                          alt={post.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                        />
                      </div>
                    ) : post.poster_url ? (
                      <div className="aspect-[4/3] bg-emerald-950 text-white flex flex-col items-center justify-center p-4 gap-1.5">
                        <FileText className="w-8 h-8 text-emerald-400" />
                        <span className="text-[11px] font-bold">PDF Poster</span>
                      </div>
                    ) : null}
                    <div className="p-4 space-y-1.5">
                      {post.subtitle && (
                        <span className="text-[10px] font-extrabold uppercase text-emerald-700">
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
                  <div className="px-4 pb-3 pt-1 flex items-center justify-between text-[11px] font-bold text-emerald-700">
                    <span>Click to view</span>
                    <Maximize2 className="w-3.5 h-3.5" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* Multi-Column Dark Footer (#about) */}
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
                <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                  <Layers className="w-5 h-5" />
                </div>
              )}
              <span className="text-base font-extrabold text-white group-hover:text-emerald-300 transition">
                {clubName}
              </span>
              <span className="px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
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
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer transition"
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
                              className="inline-flex items-center gap-2 text-slate-300 hover:text-emerald-300 transition font-medium"
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
      </footer>

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
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
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
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white text-xs font-bold"
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
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold"
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
            className="relative max-w-md w-full bg-white text-slate-900 rounded-3xl shadow-2xl border border-emerald-100 overflow-hidden my-8"
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

            <div className="bg-gradient-to-b from-emerald-100/80 via-teal-50/50 to-white p-6 text-center text-slate-900 border-b border-emerald-100">
              {logoUrl && !isPdfMedia(logoUrl) ? (
                <img
                  src={logoUrl}
                  alt={clubName}
                  className="w-14 h-14 rounded-2xl object-cover mx-auto mb-2 bg-white shadow-sm border border-emerald-200"
                />
              ) : (
                <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                  <Layers className="w-7 h-7" />
                </div>
              )}
              <h2 className="text-lg font-extrabold text-emerald-950">{clubName}</h2>
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
                    ? 'bg-emerald-600 text-white font-extrabold shadow-xs'
                    : 'text-slate-600 font-semibold hover:text-emerald-800'
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
                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
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
