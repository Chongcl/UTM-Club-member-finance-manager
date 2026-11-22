import { unstable_noStore as noStore } from 'next/cache';
import ClubSyncApp from '@/components/ClubSyncApp';
import { Budget, isSupabaseConfigured, supabase } from '@/lib/supabase';
import type { PublicLandingConfig, PublicLandingSnapshot } from '@/lib/publicLanding';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

async function fetchInitialPublicSnapshot(): Promise<PublicLandingSnapshot | null> {
  noStore();
  if (!isSupabaseConfigured) return null;

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

    if (settingsRes.error || !settingsRes.data) {
      return null;
    }

    const s = settingsRes.data as Record<string, unknown>;
    const rawEvents = (budgetsRes.data || []) as Budget[];
    const validSlugEvents = rawEvents.filter((b) => Boolean(b.public_slug?.trim()));
    const enrichedEvents = await Promise.all(
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
        } as Record<string, unknown>;
      })
    );

    const anns = (annRes.data || []) as Array<Record<string, unknown>>;
    const st =
      statsRes.data && typeof statsRes.data === 'object'
        ? (statsRes.data as { open_events_count?: unknown; total_events_count?: unknown })
        : null;

    return {
      clubName: s.club_name ? String(s.club_name) : 'ClubSync',
      logoUrl: s.logo_url ? String(s.logo_url) : '',
      currentBatch: s.current_batch ? String(s.current_batch) : '2026/2027',
      tagline: s.club_tagline
        ? String(s.club_tagline)
        : 'Campus activities, events, and student community — all in one portal.',
      clubAbout: s.club_about ? String(s.club_about) : '',
      instagramUrl: s.instagram_url ? String(s.instagram_url) : '',
      contactEmail: s.contact_email ? String(s.contact_email) : '',
      config:
        s.public_landing_config && typeof s.public_landing_config === 'object'
          ? (s.public_landing_config as PublicLandingConfig)
          : null,
      stats: st
        ? {
            open_events_count: Number(st.open_events_count || 0),
            total_events_count: Number(st.total_events_count || 0),
          }
        : undefined,
      openEvents: enrichedEvents,
      carouselPosts: anns.filter((a) => Boolean(a.show_in_carousel)),
      highlightPosts: anns.filter((a) => Boolean(a.is_pinned)).slice(0, 4),
    };
  } catch {
    return null;
  }
}

export default async function Page() {
  const initialPublicSnapshot = await fetchInitialPublicSnapshot();
  return <ClubSyncApp initialPublicSnapshot={initialPublicSnapshot} />;
}
