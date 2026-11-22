'use client';

import React, { useEffect, useState } from 'react';
import {
  supabase,
  UserProfile,
  logActivity,
} from '@/lib/supabase';
import {
  PublicLandingConfig,
  ResolvedPublicLandingConfig,
  PublicFooterColumn,
  PublicFooterLink,
  FooterLinkPlatform,
  resolvePublicLandingConfig,
} from '@/lib/publicLanding';
import PublicLandingPage from '@/components/PublicLandingPage';
import {
  X,
  Globe,
  Eye,
  Edit3,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
} from 'lucide-react';

interface PublicLandingEditorModalProps {
  isOpen: boolean;
  onClose: () => void;
  profile: UserProfile;
  clubName: string;
  logoUrl?: string;
  currentBatch?: string;
  initialConfig?: PublicLandingConfig | null;
  legacyTagline?: string;
  legacyAbout?: string;
  legacyInstagramUrl?: string;
  legacyContactEmail?: string;
  onSaved: (
    nextConfig: PublicLandingConfig,
    legacyUpdates: { tagline: string; about: string; instagram: string; email: string },
    message: string
  ) => void;
}

const PLATFORM_OPTIONS: { value: FooterLinkPlatform; label: string; placeholder: string }[] = [
  { value: 'facebook', label: 'Facebook', placeholder: 'https://facebook.com/yourclub' },
  { value: 'instagram', label: 'Instagram', placeholder: 'https://instagram.com/yourclub' },
  { value: 'linkedin', label: 'LinkedIn', placeholder: 'https://linkedin.com/company/yourclub' },
  { value: 'youtube', label: 'YouTube', placeholder: 'https://youtube.com/@yourclub' },
  { value: 'tiktok', label: 'TikTok', placeholder: 'https://tiktok.com/@yourclub' },
  { value: 'twitter', label: 'X / Twitter', placeholder: 'https://x.com/yourclub' },
  { value: 'whatsapp', label: 'WhatsApp', placeholder: 'https://wa.me/60123456789' },
  { value: 'email', label: 'Email', placeholder: 'club@utm.my' },
  { value: 'website', label: 'Website', placeholder: 'https://yourclub.com' },
  { value: 'link', label: 'Anchor / Page Link', placeholder: '#events or /e/slug' },
];

export default function PublicLandingEditorModal({
  isOpen,
  onClose,
  profile,
  clubName,
  logoUrl = '',
  currentBatch = '2026/2027',
  initialConfig = null,
  legacyTagline = '',
  legacyAbout = '',
  legacyInstagramUrl = '',
  legacyContactEmail = '',
  onSaved,
}: PublicLandingEditorModalProps) {
  const [tab, setTab] = useState<'edit' | 'preview'>('edit');
  const [draft, setDraft] = useState<ResolvedPublicLandingConfig>(() =>
    resolvePublicLandingConfig(initialConfig, {
      clubName,
      tagline: legacyTagline,
      about: legacyAbout,
      instagramUrl: legacyInstagramUrl,
      contactEmail: legacyContactEmail,
    })
  );
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setTab('edit');
      setErrorMsg(null);
      setDraft(
        resolvePublicLandingConfig(initialConfig, {
          clubName,
          tagline: legacyTagline,
          about: legacyAbout,
          instagramUrl: legacyInstagramUrl,
          contactEmail: legacyContactEmail,
        })
      );
    }
  }, [
    isOpen,
    initialConfig,
    clubName,
    legacyTagline,
    legacyAbout,
    legacyInstagramUrl,
    legacyContactEmail,
  ]);

  if (!isOpen) return null;

  const updateField = <K extends keyof ResolvedPublicLandingConfig>(
    key: K,
    value: ResolvedPublicLandingConfig[K]
  ) => {
    setDraft((prev) => ({ ...prev, [key]: value }));
  };

  const handleAddColumn = () => {
    const newCol: PublicFooterColumn = {
      id: `col-${Date.now()}`,
      title: 'New Column',
      links: [],
    };
    updateField('footer_columns', [...draft.footer_columns, newCol]);
  };

  const handleUpdateColumnTitle = (colId: string, title: string) => {
    updateField(
      'footer_columns',
      draft.footer_columns.map((c) => (c.id === colId ? { ...c, title } : c))
    );
  };

  const handleRemoveColumn = (colId: string) => {
    updateField(
      'footer_columns',
      draft.footer_columns.filter((c) => c.id !== colId)
    );
  };

  const handleAddLink = (
    colId: string,
    platform: FooterLinkPlatform = 'link',
    defaultLabel = ''
  ) => {
    const newLink: PublicFooterLink = {
      id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      label: defaultLabel,
      url: '',
      platform,
    };
    updateField(
      'footer_columns',
      draft.footer_columns.map((c) =>
        c.id === colId ? { ...c, links: [...c.links, newLink] } : c
      )
    );
  };

  const handleUpdateLink = (
    colId: string,
    linkId: string,
    patch: Partial<PublicFooterLink>
  ) => {
    updateField(
      'footer_columns',
      draft.footer_columns.map((c) =>
        c.id === colId
          ? {
              ...c,
              links: c.links.map((l) => (l.id === linkId ? { ...l, ...patch } : l)),
            }
          : c
      )
    );
  };

  const handleRemoveLink = (colId: string, linkId: string) => {
    updateField(
      'footer_columns',
      draft.footer_columns.map((c) =>
        c.id === colId
          ? { ...c, links: c.links.filter((l) => l.id !== linkId) }
          : c
      )
    );
  };

  const handleResetDefaults = () => {
    setDraft(
      resolvePublicLandingConfig(null, {
        clubName,
        tagline: legacyTagline,
        about: legacyAbout,
        instagramUrl: legacyInstagramUrl,
        contactEmail: legacyContactEmail,
      })
    );
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setSaving(true);
    try {
      const cleanedColumns: PublicFooterColumn[] = draft.footer_columns.map((col) => ({
        ...col,
        title: col.title.trim(),
        links: col.links
          .map((l) => ({
            ...l,
            label: l.label.trim(),
            url: l.url.trim(),
          }))
          .filter((l) => l.label || l.url),
      }));

      const finalConfig: PublicLandingConfig = {
        ...draft,
        footer_columns: cleanedColumns,
      };

      const allLinks = cleanedColumns.flatMap((c) => c.links);
      const firstIg =
        allLinks.find((l) => l.platform === 'instagram' && l.url)?.url || legacyInstagramUrl;
      const firstEmail =
        allLinks.find((l) => l.platform === 'email' && l.url)?.url || legacyContactEmail;

      const { data: rpcRes, error: rpcErr } = await supabase.rpc(
        'save_public_landing_config',
        {
          p_config: finalConfig,
          p_tagline: draft.hero_subtitle,
          p_about: draft.footer_about,
          p_instagram: firstIg,
          p_email: firstEmail,
        }
      );

      if (rpcErr || (rpcRes && typeof rpcRes === 'object' && (rpcRes as { ok?: boolean }).ok === false)) {
        const { error: directErr } = await supabase
          .from('club_settings')
          .update({
            public_landing_config: finalConfig,
            club_tagline: draft.hero_subtitle,
            club_about: draft.footer_about,
            instagram_url: firstIg,
            contact_email: firstEmail,
          })
          .eq('id', 1);
        if (directErr) {
          throw new Error(
            directErr.message ||
              (rpcRes as { error?: string })?.error ||
              'Could not save public landing page configuration.'
          );
        }
      }

      void logActivity(
        profile,
        'Settings',
        'Updated Public Landing Page',
        `${profile.full_name} (${profile.matric_no}) customized Public Landing Page layout & footer columns`
      );

      onSaved(
        finalConfig,
        {
          tagline: draft.hero_subtitle,
          about: draft.footer_about,
          instagram: firstIg,
          email: firstEmail,
        },
        'Public Landing Page saved & live!'
      );
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save public landing page settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-3 sm:p-5 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-emerald-200 max-w-5xl w-full overflow-hidden my-4 flex flex-col max-h-[92vh]">
        {/* Top Modal Header */}
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2.5">
            <Globe className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-extrabold">Public Landing Page Editor</h2>
              <p className="text-[11px] text-slate-400">
                Customize hero copy, section visibility, and bottom footer social/info columns
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <div className="inline-flex bg-slate-800 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setTab('edit')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  tab === 'edit' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Content</span>
              </button>
              <button
                type="button"
                onClick={() => setTab('preview')}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  tab === 'preview' ? 'bg-emerald-600 text-white' : 'text-slate-300 hover:text-white'
                }`}
              >
                <Eye className="w-3.5 h-3.5" />
                <span>Live Preview</span>
              </button>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-300 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {tab === 'preview' ? (
          <div className="flex-1 overflow-y-auto bg-slate-100 p-4">
            <div className="rounded-2xl overflow-hidden border border-slate-300 shadow-lg bg-white">
              <PublicLandingPage
                initialClubName={clubName}
                initialLogoUrl={logoUrl}
                initialBatch={currentBatch}
                previewConfig={draft}
                isPreview
                authMode="login"
                setAuthMode={() => {}}
                email=""
                setEmail={() => {}}
                password=""
                setPassword={() => {}}
                fullName=""
                setFullName={() => {}}
                matricNo=""
                setMatricNo={() => {}}
                phoneNumber=""
                setPhoneNumber={() => {}}
                authError={null}
                setAuthError={() => {}}
              />
            </div>
          </div>
        ) : (
          <form onSubmit={handleSave} className="flex-1 overflow-y-auto p-6 space-y-6 text-xs">
            {errorMsg && (
              <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* 1. Hero & Header Section */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-extrabold text-slate-900">1. Hero &amp; Header</h3>
                <label className="flex items-center gap-2 font-bold text-slate-700 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={draft.hero_show_stats}
                    onChange={(e) => updateField('hero_show_stats', e.target.checked)}
                  />
                  <span>Show Event &amp; Batch Pills</span>
                </label>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Portal Subtitle</label>
                  <input
                    type="text"
                    value={draft.nav_subtitle}
                    onChange={(e) => updateField('nav_subtitle', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hero Badge</label>
                  <input
                    type="text"
                    value={draft.hero_badge}
                    onChange={(e) => updateField('hero_badge', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Hero Headline</label>
                  <input
                    type="text"
                    value={draft.hero_title}
                    onChange={(e) => updateField('hero_title', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 font-bold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Events Button Label</label>
                  <input
                    type="text"
                    value={draft.hero_primary_cta}
                    onChange={(e) => updateField('hero_primary_cta', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2 font-bold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Hero Tagline / Description</label>
                  <textarea
                    rows={2}
                    value={draft.hero_subtitle}
                    onChange={(e) => updateField('hero_subtitle', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-2"
                  />
                </div>
              </div>

              <div className="pt-2 border-t border-slate-200 grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Featured Fallback Card Eyebrow (When no carousel posters)
                  </label>
                  <input
                    type="text"
                    value={draft.hero_fallback_eyebrow}
                    onChange={(e) => updateField('hero_fallback_eyebrow', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-1.5"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Featured Fallback Card Title
                  </label>
                  <input
                    type="text"
                    value={draft.hero_fallback_title}
                    onChange={(e) => updateField('hero_fallback_title', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-1.5 font-semibold"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Featured Fallback Card Description
                  </label>
                  <input
                    type="text"
                    value={draft.hero_fallback_desc}
                    onChange={(e) => updateField('hero_fallback_desc', e.target.value)}
                    className="w-full rounded-xl border bg-white px-3 py-1.5"
                  />
                </div>
              </div>
            </div>

            {/* 2. Events & Highlights Section Visibility & Headings */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <h3 className="text-sm font-extrabold text-slate-900">2. Sections &amp; Headings</h3>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                <label className="flex items-center justify-between font-bold text-slate-800 cursor-pointer">
                  <span>Show Open Public Events Section</span>
                  <input
                    type="checkbox"
                    checked={draft.show_events_section}
                    onChange={(e) => updateField('show_events_section', e.target.checked)}
                  />
                </label>
                {draft.show_events_section && (
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Eyebrow</label>
                      <input
                        type="text"
                        value={draft.events_eyebrow}
                        onChange={(e) => updateField('events_eyebrow', e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={draft.events_title}
                        onChange={(e) => updateField('events_title', e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5 font-bold"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Subtitle</label>
                      <input
                        type="text"
                        value={draft.events_subtitle}
                        onChange={(e) => updateField('events_subtitle', e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-2.5">
                <label className="flex items-center justify-between font-bold text-slate-800 cursor-pointer">
                  <span>Show Club Highlights Section</span>
                  <input
                    type="checkbox"
                    checked={draft.show_highlights_section}
                    onChange={(e) => updateField('show_highlights_section', e.target.checked)}
                  />
                </label>
                {draft.show_highlights_section && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-2 border-t border-slate-100">
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Eyebrow</label>
                      <input
                        type="text"
                        value={draft.highlights_eyebrow}
                        onChange={(e) => updateField('highlights_eyebrow', e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5"
                      />
                    </div>
                    <div>
                      <label className="block font-semibold text-slate-600 mb-1">Title</label>
                      <input
                        type="text"
                        value={draft.highlights_title}
                        onChange={(e) => updateField('highlights_title', e.target.value)}
                        className="w-full rounded-lg border px-2.5 py-1.5 font-bold"
                      />
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* 3. Dark Footer & Dynamic Connect Columns */}
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className="text-sm font-extrabold text-slate-900">
                    3. Bottom Dark Footer Columns &amp; Social Links
                  </h3>
                  <p className="text-[11px] text-slate-500">
                    Add columns like &ldquo;Connect With Us&rdquo;, &ldquo;Quick Links&rdquo;, or custom sections with direct clickable links.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={handleAddColumn}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                >
                  <Plus className="w-3.5 h-3.5" />
                  <span>Add Column</span>
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Club About Snippet (Footer Left)
                </label>
                <textarea
                  rows={2}
                  value={draft.footer_about}
                  onChange={(e) => updateField('footer_about', e.target.value)}
                  placeholder="Short description shown under logo in the bottom dark footer..."
                  className="w-full rounded-xl border bg-white px-3 py-2"
                />
              </div>

              <div className="space-y-3">
                {draft.footer_columns.map((col, colIdx) => (
                  <div
                    key={col.id}
                    className="p-3.5 rounded-2xl bg-white border border-slate-200 space-y-3"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 flex-1">
                        <span className="text-[11px] font-extrabold text-slate-400">
                          Col #{colIdx + 1}
                        </span>
                        <input
                          type="text"
                          value={col.title}
                          onChange={(e) => handleUpdateColumnTitle(col.id, e.target.value)}
                          placeholder="Column Heading (e.g., Connect With Us)"
                          className="flex-1 rounded-xl border border-slate-300 px-3 py-1.5 font-extrabold text-slate-900"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={() => handleRemoveColumn(col.id)}
                        className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50 cursor-pointer"
                        title="Remove Column"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {/* Quick-Add Social Pills */}
                    <div className="flex flex-wrap items-center gap-1.5">
                      <span className="text-[10px] font-bold text-slate-400 uppercase mr-1">
                        Quick add:
                      </span>
                      {(
                        [
                          { p: 'facebook', lbl: 'Facebook' },
                          { p: 'instagram', lbl: 'Instagram' },
                          { p: 'linkedin', lbl: 'LinkedIn' },
                          { p: 'youtube', lbl: 'YouTube' },
                          { p: 'tiktok', lbl: 'TikTok' },
                          { p: 'email', lbl: 'Email' },
                          { p: 'website', lbl: 'Website' },
                          { p: 'link', lbl: 'Custom Link' },
                        ] as { p: FooterLinkPlatform; lbl: string }[]
                      ).map((chip) => (
                        <button
                          key={chip.p}
                          type="button"
                          onClick={() =>
                            handleAddLink(
                              col.id,
                              chip.p,
                              chip.lbl === 'Custom Link' ? '' : chip.lbl
                            )
                          }
                          className="px-2 py-0.5 rounded-lg bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-[10px] font-bold cursor-pointer"
                        >
                          + {chip.lbl}
                        </button>
                      ))}
                    </div>

                    {/* Link Rows */}
                    {col.links.length === 0 ? (
                      <p className="text-[11px] text-slate-400 italic">
                        Click a quick-add button above to add social or custom links to this column.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {col.links.map((lnk) => {
                          const platMeta =
                            PLATFORM_OPTIONS.find((o) => o.value === (lnk.platform || 'link')) ||
                            PLATFORM_OPTIONS[PLATFORM_OPTIONS.length - 1];
                          return (
                            <div
                              key={lnk.id}
                              className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-slate-50 p-2 rounded-xl border border-slate-200/80"
                            >
                              <select
                                value={lnk.platform || 'link'}
                                onChange={(e) =>
                                  handleUpdateLink(col.id, lnk.id, {
                                    platform: e.target.value as FooterLinkPlatform,
                                  })
                                }
                                className="sm:col-span-3 rounded-lg border bg-white px-2 py-1.5 font-semibold"
                              >
                                {PLATFORM_OPTIONS.map((opt) => (
                                  <option key={opt.value} value={opt.value}>
                                    {opt.label}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={lnk.label}
                                onChange={(e) =>
                                  handleUpdateLink(col.id, lnk.id, { label: e.target.value })
                                }
                                placeholder="Label (e.g., Facebook)"
                                className="sm:col-span-3 rounded-lg border bg-white px-2.5 py-1.5 font-semibold"
                              />
                              <input
                                type="text"
                                value={lnk.url}
                                onChange={(e) =>
                                  handleUpdateLink(col.id, lnk.id, { url: e.target.value })
                                }
                                placeholder={platMeta.placeholder}
                                className="sm:col-span-5 rounded-lg border bg-white px-2.5 py-1.5 font-mono text-[11px]"
                              />
                              <button
                                type="button"
                                onClick={() => handleRemoveLink(col.id, lnk.id)}
                                className="sm:col-span-1 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg flex items-center justify-center cursor-pointer"
                                title="Remove Link"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-200">
              <button
                type="button"
                onClick={handleResetDefaults}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reset Defaults</span>
              </button>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-slate-600 font-semibold cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-60"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{saving ? 'Saving...' : 'Save Public Page'}</span>
                </button>
              </div>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
