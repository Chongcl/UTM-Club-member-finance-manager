'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  supabase,
  UserProfile,
  logActivity,
  MAX_FILE_SIZE_BYTES,
  MAX_FILE_SIZE_LABEL,
} from '@/lib/supabase';
import {
  PublicLandingConfig,
  ResolvedPublicLandingConfig,
  PublicFooterColumn,
  PublicFooterLink,
  FooterLinkPlatform,
  LandingSectionId,
  LandingThemePreset,
  HeroLayoutMode,
  CardSurfaceStyle,
  AnimationLevel,
  FeatureIconName,
  PublicMetricItem,
  PublicFeatureItem,
  PublicFaqItem,
  FEATURE_ICON_NAMES,
  LANDING_THEME_STYLES,
  LANDING_SECTION_META,
  PUBLIC_LANDING_TEMPLATES,
  moveArrayItem,
  duplicateArrayItem,
  normalizeSectionOrder,
  normalizeExternalHref,
  resolvePublicLandingConfig,
  writeCachedPublicSnapshot,
} from '@/lib/publicLanding';
import PublicLandingPage, {
  FeatureIcon,
  FooterPlatformIcon,
} from '@/components/PublicLandingPage';
import {
  X,
  Globe,
  Eye,
  EyeOff,
  Edit3,
  Plus,
  Trash2,
  Loader2,
  CheckCircle2,
  RotateCcw,
  AlertCircle,
  Undo2,
  Redo2,
  Sparkles,
  Monitor,
  Tablet,
  Smartphone,
  Maximize2,
  Minimize2,
  GripVertical,
  ArrowUp,
  ArrowDown,
  ArrowLeft,
  Copy,
  Upload,
  ExternalLink,
  Layout,
  Palette,
  ChevronDown,
  ChevronRight,
  Megaphone,
  Layers,
  BarChart3,
  Calendar,
  Pin,
  HelpCircle,
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

function SectionNavIcon({ id }: { id: LandingSectionId }) {
  switch (id) {
    case 'announcement':
      return <Megaphone className="w-4 h-4" />;
    case 'hero':
      return <Sparkles className="w-4 h-4" />;
    case 'metrics':
      return <BarChart3 className="w-4 h-4" />;
    case 'about':
      return <Layers className="w-4 h-4" />;
    case 'events':
      return <Calendar className="w-4 h-4" />;
    case 'highlights':
      return <Pin className="w-4 h-4" />;
    case 'faq':
      return <HelpCircle className="w-4 h-4" />;
    case 'cta':
      return <CheckCircle2 className="w-4 h-4" />;
    default:
      return <Globe className="w-4 h-4" />;
  }
}

function LandingImageUploader({
  label,
  value,
  onChange,
  helper,
}: {
  label: string;
  value: string;
  onChange: (nextUrl: string) => void;
  helper?: string;
}) {
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadErr(null);

    if (file.size > MAX_FILE_SIZE_BYTES) {
      setUploadErr(`File exceeds ${MAX_FILE_SIZE_LABEL} limit.`);
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'png';
      const path = `public-landing/${Date.now()}-${Math.random().toString(36).slice(2, 6)}.${ext}`;
      const { error } = await supabase.storage.from('receipts').upload(path, file);
      if (error) throw error;
      const { data } = supabase.storage.from('receipts').getPublicUrl(path);
      if (data?.publicUrl) {
        onChange(data.publicUrl);
      }
    } catch (err: unknown) {
      setUploadErr(err instanceof Error ? err.message : 'Image upload failed.');
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = '';
    }
  };

  return (
    <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="font-bold text-slate-800">{label}</span>
        <div className="flex items-center gap-1.5">
          {value && (
            <button
              type="button"
              onClick={() => onChange('')}
              className="px-2 py-1 rounded-lg text-[10px] font-bold text-rose-600 hover:bg-rose-50 cursor-pointer"
            >
              Remove
            </button>
          )}
          <button
            type="button"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-slate-300 hover:border-emerald-400 text-slate-800 text-[10px] font-bold cursor-pointer disabled:opacity-50"
          >
            {uploading ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <Upload className="w-3 h-3" />
            )}
            <span>{uploading ? 'Uploading...' : 'Upload Photo'}</span>
          </button>
        </div>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileChange}
      />

      {value && (
        <div className="relative rounded-xl overflow-hidden border border-slate-200 bg-slate-900 aspect-[16/8]">
          <img src={value} alt={label} className="w-full h-full object-cover" />
        </div>
      )}

      <input
        type="url"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Or paste an image URL (https://...)"
        className="w-full rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-mono"
      />
      {helper && <p className="text-[10px] text-slate-500">{helper}</p>}
      {uploadErr && <p className="text-[10px] font-bold text-rose-600">{uploadErr}</p>}
    </div>
  );
}

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
  const buildBaseline = () =>
    resolvePublicLandingConfig(initialConfig, {
      clubName,
      tagline: legacyTagline,
      about: legacyAbout,
      instagramUrl: legacyInstagramUrl,
      contactEmail: legacyContactEmail,
    });

  const router = useRouter();
  const [baseline, setBaseline] = useState<ResolvedPublicLandingConfig>(buildBaseline);
  const [draft, setDraft] = useState<ResolvedPublicLandingConfig>(buildBaseline);

  const [historyPast, setHistoryPast] = useState<ResolvedPublicLandingConfig[]>([]);
  const [historyFuture, setHistoryFuture] = useState<ResolvedPublicLandingConfig[]>([]);
  const lastHistoryPushRef = useRef<number>(0);

  const [leftMode, setLeftMode] = useState<'sections' | 'design'>('sections');
  const [activeSectionId, setActiveSectionId] = useState<LandingSectionId | null>(null);
  const [hoveredSectionId, setHoveredSectionId] = useState<LandingSectionId | null>(null);
  const [mobilePane, setMobilePane] = useState<'edit' | 'preview'>('edit');
  const [viewport, setViewport] = useState<'desktop' | 'tablet' | 'mobile'>('desktop');
  const [fullPreview, setFullPreview] = useState(false);
  const [showHiddenSections, setShowHiddenSections] = useState(true);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [draggedSectionId, setDraggedSectionId] = useState<LandingSectionId | null>(null);
  const [draggedItemKey, setDraggedItemKey] = useState<string | null>(null);

  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const previewScrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      const fresh = buildBaseline();
      setBaseline(fresh);
      setDraft(fresh);
      setHistoryPast([]);
      setHistoryFuture([]);
      setLeftMode('sections');
      setActiveSectionId(null);
      setHoveredSectionId(null);
      setFullPreview(false);
      setTemplatesOpen(false);
      setErrorMsg(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    isOpen,
    initialConfig,
    clubName,
    legacyTagline,
    legacyAbout,
    legacyInstagramUrl,
    legacyContactEmail,
  ]);

  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(draft) !== JSON.stringify(baseline),
    [draft, baseline]
  );

  const applyDraftChange = (
    updater: (prev: ResolvedPublicLandingConfig) => ResolvedPublicLandingConfig,
    forceHistory = false
  ) => {
    setDraft((prev) => {
      const next = updater(prev);
      if (JSON.stringify(next) === JSON.stringify(prev)) return prev;
      const now = Date.now();
      if (forceHistory || now - lastHistoryPushRef.current > 650) {
        setHistoryPast((p) => [...p.slice(-39), prev]);
        lastHistoryPushRef.current = now;
      }
      setHistoryFuture([]);
      return next;
    });
  };

  const handleUndo = () => {
    setHistoryPast((past) => {
      if (past.length === 0) return past;
      const previous = past[past.length - 1];
      setHistoryFuture((f) => [draft, ...f.slice(0, 39)]);
      setDraft(previous);
      return past.slice(0, -1);
    });
  };

  const handleRedo = () => {
    setHistoryFuture((future) => {
      if (future.length === 0) return future;
      const next = future[0];
      setHistoryPast((p) => [...p.slice(-39), draft]);
      setDraft(next);
      return future.slice(1);
    });
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isTextField =
        target?.tagName === 'INPUT' ||
        target?.tagName === 'TEXTAREA' ||
        target?.isContentEditable;
      if ((e.metaKey || e.ctrlKey) && !isTextField) {
        if (e.key.toLowerCase() === 'z' && e.shiftKey) {
          e.preventDefault();
          handleRedo();
        } else if (e.key.toLowerCase() === 'z') {
          e.preventDefault();
          handleUndo();
        } else if (e.key.toLowerCase() === 'y') {
          e.preventDefault();
          handleRedo();
        }
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  });

  if (!isOpen) return null;

  const updateField = <K extends keyof ResolvedPublicLandingConfig>(
    key: K,
    value: ResolvedPublicLandingConfig[K],
    forceHistory = false
  ) => {
    applyDraftChange((prev) => ({ ...prev, [key]: value }), forceHistory);
  };

  const scrollPreviewToSection = (sectionId: LandingSectionId) => {
    const container = previewScrollRef.current;
    if (!container) return;
    requestAnimationFrame(() => {
      const target = container.querySelector(`[data-editor-section="${sectionId}"]`);
      if (target) {
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    });
  };

  const handleSelectSection = (sectionId: LandingSectionId, scrollPreview = true) => {
    setLeftMode('sections');
    setActiveSectionId(sectionId);
    if (scrollPreview) {
      scrollPreviewToSection(sectionId);
    } else {
      setMobilePane('edit');
    }
  };

  const isSectionVisible = (id: LandingSectionId): boolean => {
    const key = LANDING_SECTION_META[id].toggleKey;
    if (!key) return true;
    return draft[key] === true;
  };

  const toggleSectionVisibility = (id: LandingSectionId) => {
    const key = LANDING_SECTION_META[id].toggleKey;
    if (!key) return;
    updateField(key, !draft[key], true);
  };

  const reorderMiddleSections = (fromId: LandingSectionId, toId: LandingSectionId) => {
    if (fromId === toId) return;
    const middle = draft.section_order.filter(
      (id) => LANDING_SECTION_META[id].reorderable
    );
    const fromIdx = middle.indexOf(fromId);
    const toIdx = middle.indexOf(toId);
    if (fromIdx === -1 || toIdx === -1) return;
    const moved = moveArrayItem(middle, fromIdx, toIdx);
    updateField('section_order', normalizeSectionOrder(moved), true);
  };

  const handleQuickMoveSection = (id: LandingSectionId, dir: 'up' | 'down') => {
    const middle = draft.section_order.filter(
      (s) => LANDING_SECTION_META[s].reorderable
    );
    const idx = middle.indexOf(id);
    if (idx === -1) return;
    const targetIdx = dir === 'up' ? idx - 1 : idx + 1;
    if (targetIdx < 0 || targetIdx >= middle.length) return;
    updateField('section_order', normalizeSectionOrder(moveArrayItem(middle, idx, targetIdx)), true);
  };

  const getSectionSummary = (id: LandingSectionId): string => {
    switch (id) {
      case 'announcement':
        return draft.show_announcement_bar ? 'Visible bar' : 'Hidden';
      case 'hero':
        return `${draft.hero_layout} layout`;
      case 'metrics':
        return `${draft.metrics_items.length} card${draft.metrics_items.length === 1 ? '' : 's'}`;
      case 'about':
        return `${draft.about_features.length} feature card${draft.about_features.length === 1 ? '' : 's'}`;
      case 'events':
        return draft.show_events_section ? 'Live feed enabled' : 'Hidden';
      case 'highlights':
        return draft.show_highlights_section ? 'Pinned posters' : 'Hidden';
      case 'faq':
        return `${draft.faq_items.length} Q&A item${draft.faq_items.length === 1 ? '' : 's'}`;
      case 'cta':
        return draft.cta_primary_label || 'CTA banner';
      case 'footer': {
        const totalLinks = draft.footer_columns.reduce((sum, c) => sum + c.links.length, 0);
        return `${draft.footer_columns.length} col${draft.footer_columns.length === 1 ? '' : 's'} · ${totalLinks} link${totalLinks === 1 ? '' : 's'}`;
      }
    }
  };

  const handleResetSection = (id: LandingSectionId) => {
    const defaults = resolvePublicLandingConfig(null, {
      clubName,
      tagline: legacyTagline,
      about: legacyAbout,
      instagramUrl: legacyInstagramUrl,
      contactEmail: legacyContactEmail,
    });
    applyDraftChange((prev) => {
      switch (id) {
        case 'announcement':
          return {
            ...prev,
            show_announcement_bar: defaults.show_announcement_bar,
            announcement_text: defaults.announcement_text,
            announcement_link_label: defaults.announcement_link_label,
            announcement_link_url: defaults.announcement_link_url,
          };
        case 'hero':
          return {
            ...prev,
            nav_subtitle: defaults.nav_subtitle,
            hero_badge: defaults.hero_badge,
            hero_title: defaults.hero_title,
            hero_highlight_text: defaults.hero_highlight_text,
            hero_subtitle: defaults.hero_subtitle,
            hero_primary_cta: defaults.hero_primary_cta,
            hero_secondary_cta_label: defaults.hero_secondary_cta_label,
            hero_secondary_cta_url: defaults.hero_secondary_cta_url,
            hero_cover_image_url: defaults.hero_cover_image_url,
            hero_show_stats: defaults.hero_show_stats,
            hero_fallback_eyebrow: defaults.hero_fallback_eyebrow,
            hero_fallback_title: defaults.hero_fallback_title,
            hero_fallback_desc: defaults.hero_fallback_desc,
          };
        case 'metrics':
          return {
            ...prev,
            show_metrics_section: defaults.show_metrics_section,
            metrics_items: defaults.metrics_items,
          };
        case 'about':
          return {
            ...prev,
            show_about_section: defaults.show_about_section,
            about_eyebrow: defaults.about_eyebrow,
            about_title: defaults.about_title,
            about_description: defaults.about_description,
            about_image_url: defaults.about_image_url,
            about_features: defaults.about_features,
          };
        case 'events':
          return {
            ...prev,
            show_events_section: defaults.show_events_section,
            events_eyebrow: defaults.events_eyebrow,
            events_title: defaults.events_title,
            events_subtitle: defaults.events_subtitle,
            events_empty_title: defaults.events_empty_title,
            events_empty_desc: defaults.events_empty_desc,
          };
        case 'highlights':
          return {
            ...prev,
            show_highlights_section: defaults.show_highlights_section,
            highlights_eyebrow: defaults.highlights_eyebrow,
            highlights_title: defaults.highlights_title,
          };
        case 'faq':
          return {
            ...prev,
            show_faq_section: defaults.show_faq_section,
            faq_eyebrow: defaults.faq_eyebrow,
            faq_title: defaults.faq_title,
            faq_subtitle: defaults.faq_subtitle,
            faq_items: defaults.faq_items,
          };
        case 'cta':
          return {
            ...prev,
            show_cta_section: defaults.show_cta_section,
            cta_badge: defaults.cta_badge,
            cta_title: defaults.cta_title,
            cta_subtitle: defaults.cta_subtitle,
            cta_primary_label: defaults.cta_primary_label,
            cta_primary_action: defaults.cta_primary_action,
            cta_primary_url: defaults.cta_primary_url,
          };
        case 'footer':
          return {
            ...prev,
            footer_about: defaults.footer_about,
            footer_columns: defaults.footer_columns,
            footer_copyright: defaults.footer_copyright,
          };
      }
    }, true);
  };

  const applyTemplate = (tplId: string) => {
    const tpl = PUBLIC_LANDING_TEMPLATES.find((t) => t.id === tplId);
    if (!tpl) return;
    applyDraftChange(
      (prev) => ({
        ...prev,
        theme_preset: tpl.theme_preset,
        hero_layout: tpl.hero_layout,
        card_style: tpl.card_style,
        animation_level: tpl.animation_level,
      }),
      true
    );
    setTemplatesOpen(false);
  };

  const handleCloseSafe = () => {
    if (hasUnsavedChanges) {
      if (!window.confirm('You have unsaved changes. Discard and close the studio?')) {
        return;
      }
    }
    onClose();
  };

  const toggleItemExpanded = (itemKey: string) => {
    setExpandedItemIds((prev) => ({ ...prev, [itemKey]: !prev[itemKey] }));
  };

  // --- Footer Column & Link Helpers ---
  const handleAddColumn = () => {
    const newCol: PublicFooterColumn = {
      id: `col-${Date.now()}`,
      title: 'New Column',
      links: [],
    };
    updateField('footer_columns', [...draft.footer_columns, newCol], true);
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
      ),
      true
    );
  };

  const handleMoveLinkToColumn = (
    fromColId: string,
    linkId: string,
    toColId: string
  ) => {
    if (fromColId === toColId) return;
    const sourceCol = draft.footer_columns.find((c) => c.id === fromColId);
    const linkObj = sourceCol?.links.find((l) => l.id === linkId);
    if (!linkObj) return;
    updateField(
      'footer_columns',
      draft.footer_columns.map((c) => {
        if (c.id === fromColId) {
          return { ...c, links: c.links.filter((l) => l.id !== linkId) };
        }
        if (c.id === toColId) {
          return { ...c, links: [...c.links, linkObj] };
        }
        return c;
      }),
      true
    );
  };

  const handleSave = async () => {
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

      if (
        rpcErr ||
        (rpcRes && typeof rpcRes === 'object' && (rpcRes as { ok?: boolean }).ok === false)
      ) {
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
        `${profile.full_name} (${profile.matric_no}) redesigned Public Landing Page in Visual Studio`
      );

      onSaved(
        finalConfig,
        {
          tagline: draft.hero_subtitle,
          about: draft.footer_about,
          instagram: firstIg,
          email: firstEmail,
        },
        'Public Landing Page published live!'
      );
      writeCachedPublicSnapshot({
        clubName,
        logoUrl,
        currentBatch,
        tagline: draft.hero_subtitle,
        clubAbout: draft.footer_about,
        instagramUrl: firstIg,
        contactEmail: firstEmail,
        config: finalConfig,
      });
      router.refresh();
      onClose();
    } catch (err: unknown) {
      setErrorMsg(
        err instanceof Error ? err.message : 'Failed to save public landing page settings.'
      );
    } finally {
      setSaving(false);
    }
  };

  const renderSectionInspector = (id: LandingSectionId) => {
    const meta = LANDING_SECTION_META[id];
    const toggleKey = meta.toggleKey;

    return (
      <div className="space-y-4">
        {/* Inspector Breadcrumb Header */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-200">
          <button
            type="button"
            onClick={() => setActiveSectionId(null)}
            className="inline-flex items-center gap-1.5 text-xs font-extrabold text-slate-600 hover:text-slate-900 cursor-pointer"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>All Sections</span>
          </button>
          <div className="flex items-center gap-1.5">
            {toggleKey && (
              <button
                type="button"
                onClick={() => toggleSectionVisibility(id)}
                className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[10px] font-bold border cursor-pointer ${
                  draft[toggleKey]
                    ? 'bg-emerald-50 border-emerald-200 text-emerald-800'
                    : 'bg-slate-100 border-slate-300 text-slate-600'
                }`}
              >
                {draft[toggleKey] ? (
                  <Eye className="w-3 h-3" />
                ) : (
                  <EyeOff className="w-3 h-3" />
                )}
                <span>{draft[toggleKey] ? 'Visible' : 'Hidden'}</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => handleResetSection(id)}
              title="Reset this section to defaults"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-bold text-slate-500 hover:text-slate-800 hover:bg-slate-100 cursor-pointer"
            >
              <RotateCcw className="w-3 h-3" />
              <span>Reset</span>
            </button>
          </div>
        </div>

        <div>
          <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-2">
            <SectionNavIcon id={id} />
            <span>{meta.label}</span>
          </h3>
          <p className="text-[11px] text-slate-500 mt-0.5">{meta.description}</p>
        </div>

        {id === 'announcement' && (
          <div className="space-y-3">
            <label className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-800 cursor-pointer">
              <span>Show Top Announcement Bar</span>
              <input
                type="checkbox"
                checked={draft.show_announcement_bar}
                onChange={(e) => updateField('show_announcement_bar', e.target.checked, true)}
              />
            </label>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Banner Message</label>
              <textarea
                rows={2}
                value={draft.announcement_text}
                onChange={(e) => updateField('announcement_text', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Link Label</label>
                <input
                  type="text"
                  value={draft.announcement_link_label}
                  onChange={(e) => updateField('announcement_link_label', e.target.value)}
                  placeholder="View Events"
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Link URL / Anchor</label>
                <input
                  type="text"
                  value={draft.announcement_link_url}
                  onChange={(e) => updateField('announcement_link_url', e.target.value)}
                  placeholder="#events"
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 font-mono text-[11px]"
                />
              </div>
            </div>
          </div>
        )}

        {id === 'hero' && (
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Navbar Subtitle</label>
              <input
                type="text"
                value={draft.nav_subtitle}
                onChange={(e) => updateField('nav_subtitle', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hero Pill Badge</label>
              <input
                type="text"
                value={draft.hero_badge}
                onChange={(e) => updateField('hero_badge', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Main Headline</label>
              <input
                type="text"
                value={draft.hero_title}
                onChange={(e) => updateField('hero_title', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">
                Accent Gradient Highlight Phrase <span className="text-slate-400 font-normal">(optional)</span>
              </label>
              <input
                type="text"
                value={draft.hero_highlight_text}
                onChange={(e) => updateField('hero_highlight_text', e.target.value)}
                placeholder="e.g., Campus Chess Hub"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Hero Tagline / Subtitle</label>
              <textarea
                rows={3}
                value={draft.hero_subtitle}
                onChange={(e) => updateField('hero_subtitle', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <label className="flex items-center justify-between p-2.5 rounded-xl bg-slate-50 border border-slate-200 font-bold text-slate-700 cursor-pointer">
              <span>Show Open Events &amp; Batch Chips</span>
              <input
                type="checkbox"
                checked={draft.hero_show_stats}
                onChange={(e) => updateField('hero_show_stats', e.target.checked, true)}
              />
            </label>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Events CTA Label</label>
                <input
                  type="text"
                  value={draft.hero_primary_cta}
                  onChange={(e) => updateField('hero_primary_cta', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 font-semibold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Secondary Link Label</label>
                <input
                  type="text"
                  value={draft.hero_secondary_cta_label}
                  onChange={(e) => updateField('hero_secondary_cta_label', e.target.value)}
                  placeholder="Optional (e.g., Learn More)"
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2"
                />
              </div>
            </div>
            {draft.hero_secondary_cta_label.trim() && (
              <div>
                <label className="block font-bold text-slate-700 mb-1">Secondary Link URL</label>
                <input
                  type="text"
                  value={draft.hero_secondary_cta_url}
                  onChange={(e) => updateField('hero_secondary_cta_url', e.target.value)}
                  placeholder="#about-club"
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[11px]"
                />
              </div>
            )}

            <LandingImageUploader
              label="Hero Cover Image"
              value={draft.hero_cover_image_url}
              onChange={(url) => updateField('hero_cover_image_url', url, true)}
              helper="Overrides default fallback card & enriches Cinematic Banner mode."
            />

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800">Fallback Showcase Card Copy</div>
              <input
                type="text"
                value={draft.hero_fallback_eyebrow}
                onChange={(e) => updateField('hero_fallback_eyebrow', e.target.value)}
                placeholder="Eyebrow"
                className="w-full rounded-lg border bg-white px-2.5 py-1.5"
              />
              <input
                type="text"
                value={draft.hero_fallback_title}
                onChange={(e) => updateField('hero_fallback_title', e.target.value)}
                placeholder="Title"
                className="w-full rounded-lg border bg-white px-2.5 py-1.5 font-semibold"
              />
              <textarea
                rows={2}
                value={draft.hero_fallback_desc}
                onChange={(e) => updateField('hero_fallback_desc', e.target.value)}
                placeholder="Description"
                className="w-full rounded-lg border bg-white px-2.5 py-1.5"
              />
            </div>
          </div>
        )}

        {id === 'metrics' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="font-bold text-slate-700">Metric Cards ({draft.metrics_items.length})</span>
              <button
                type="button"
                onClick={() => {
                  const item: PublicMetricItem = {
                    id: `metric-${Date.now()}`,
                    value: '50+',
                    label: 'New Highlight',
                    sublabel: 'Short supporting note',
                    icon: 'Sparkles',
                  };
                  updateField('metrics_items', [...draft.metrics_items, item], true);
                  setExpandedItemIds((prev) => ({ ...prev, [item.id]: true }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Metric</span>
              </button>
            </div>

            <div className="space-y-2">
              {draft.metrics_items.map((item, idx) => {
                const isOpenItem = expandedItemIds[item.id] ?? idx === 0;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedItemKey(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedItemKey || draggedItemKey === item.id) return;
                      const fromIdx = draft.metrics_items.findIndex((m) => m.id === draggedItemKey);
                      if (fromIdx !== -1) {
                        updateField(
                          'metrics_items',
                          moveArrayItem(draft.metrics_items, fromIdx, idx),
                          true
                        );
                      }
                      setDraggedItemKey(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  >
                    <div className="px-2.5 py-2 flex items-center justify-between gap-1 bg-white border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(item.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                        <span className="font-extrabold text-slate-900 truncate">
                          {item.value || '0'} — {item.label || 'Untitled'}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            updateField(
                              'metrics_items',
                              moveArrayItem(draft.metrics_items, idx, idx - 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move up"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.metrics_items.length - 1}
                          onClick={() =>
                            updateField(
                              'metrics_items',
                              moveArrayItem(draft.metrics_items, idx, idx + 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move down"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'metrics_items',
                              duplicateArrayItem(draft.metrics_items, idx, 'metric'),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                          title="Duplicate"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'metrics_items',
                              draft.metrics_items.filter((m) => m.id !== item.id),
                              true
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          title="Delete"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isOpenItem && (
                      <div className="p-2.5 space-y-2">
                        <div className="grid grid-cols-2 gap-2">
                          <input
                            type="text"
                            value={item.value}
                            onChange={(e) =>
                              updateField(
                                'metrics_items',
                                draft.metrics_items.map((m) =>
                                  m.id === item.id ? { ...m, value: e.target.value } : m
                                )
                              )
                            }
                            placeholder="Value (e.g. 12+)"
                            className="rounded-lg border bg-white px-2.5 py-1.5 font-extrabold"
                          />
                          <input
                            type="text"
                            value={item.label}
                            onChange={(e) =>
                              updateField(
                                'metrics_items',
                                draft.metrics_items.map((m) =>
                                  m.id === item.id ? { ...m, label: e.target.value } : m
                                )
                              )
                            }
                            placeholder="Label"
                            className="rounded-lg border bg-white px-2.5 py-1.5 font-semibold"
                          />
                        </div>
                        <input
                          type="text"
                          value={item.sublabel || ''}
                          onChange={(e) =>
                            updateField(
                              'metrics_items',
                              draft.metrics_items.map((m) =>
                                m.id === item.id ? { ...m, sublabel: e.target.value } : m
                              )
                            )
                          }
                          placeholder="Sublabel (optional)"
                          className="w-full rounded-lg border bg-white px-2.5 py-1.5"
                        />
                        <div className="flex flex-wrap gap-1">
                          {FEATURE_ICON_NAMES.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() =>
                                updateField(
                                  'metrics_items',
                                  draft.metrics_items.map((m) =>
                                    m.id === item.id ? { ...m, icon: ic } : m
                                  ),
                                  true
                                )
                              }
                              className={`p-1.5 rounded-lg border cursor-pointer ${
                                (item.icon || 'Sparkles') === ic
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}
                              title={ic}
                            >
                              <FeatureIcon name={ic} className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {id === 'about' && (
          <div className="space-y-3">
            <input
              type="text"
              value={draft.about_eyebrow}
              onChange={(e) => updateField('about_eyebrow', e.target.value)}
              placeholder="Eyebrow (e.g., Who We Are)"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <input
              type="text"
              value={draft.about_title}
              onChange={(e) => updateField('about_title', e.target.value)}
              placeholder="Section Headline"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
            />
            <textarea
              rows={3}
              value={draft.about_description}
              onChange={(e) => updateField('about_description', e.target.value)}
              placeholder="Club narrative paragraph..."
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />

            <LandingImageUploader
              label="Club Feature Photo (Optional)"
              value={draft.about_image_url}
              onChange={(url) => updateField('about_image_url', url, true)}
            />

            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-700">
                Bento Feature Cards ({draft.about_features.length})
              </span>
              <button
                type="button"
                onClick={() => {
                  const feat: PublicFeatureItem = {
                    id: `feat-${Date.now()}`,
                    title: 'New Pillar',
                    description: 'Describe what members and guests experience here.',
                    icon: 'Sparkles',
                    badge: '',
                  };
                  updateField('about_features', [...draft.about_features, feat], true);
                  setExpandedItemIds((prev) => ({ ...prev, [feat.id]: true }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Card</span>
              </button>
            </div>

            <div className="space-y-2">
              {draft.about_features.map((feat, idx) => {
                const isOpenItem = expandedItemIds[feat.id] ?? idx === 0;
                return (
                  <div
                    key={feat.id}
                    draggable
                    onDragStart={() => setDraggedItemKey(feat.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedItemKey || draggedItemKey === feat.id) return;
                      const fromIdx = draft.about_features.findIndex((f) => f.id === draggedItemKey);
                      if (fromIdx !== -1) {
                        updateField(
                          'about_features',
                          moveArrayItem(draft.about_features, fromIdx, idx),
                          true
                        );
                      }
                      setDraggedItemKey(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  >
                    <div className="px-2.5 py-2 flex items-center justify-between gap-1 bg-white border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(feat.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                        <FeatureIcon name={feat.icon} className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span className="font-bold text-slate-900 truncate">
                          {feat.title || 'Untitled Feature'}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            updateField(
                              'about_features',
                              moveArrayItem(draft.about_features, idx, idx - 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.about_features.length - 1}
                          onClick={() =>
                            updateField(
                              'about_features',
                              moveArrayItem(draft.about_features, idx, idx + 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'about_features',
                              duplicateArrayItem(draft.about_features, idx, 'feat'),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'about_features',
                              draft.about_features.filter((f) => f.id !== feat.id),
                              true
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isOpenItem && (
                      <div className="p-2.5 space-y-2">
                        <div className="grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={feat.title}
                            onChange={(e) =>
                              updateField(
                                'about_features',
                                draft.about_features.map((f) =>
                                  f.id === feat.id ? { ...f, title: e.target.value } : f
                                )
                              )
                            }
                            placeholder="Title"
                            className="col-span-2 rounded-lg border bg-white px-2.5 py-1.5 font-bold"
                          />
                          <input
                            type="text"
                            value={feat.badge || ''}
                            onChange={(e) =>
                              updateField(
                                'about_features',
                                draft.about_features.map((f) =>
                                  f.id === feat.id ? { ...f, badge: e.target.value } : f
                                )
                              )
                            }
                            placeholder="Badge"
                            className="rounded-lg border bg-white px-2 py-1.5"
                          />
                        </div>
                        <textarea
                          rows={2}
                          value={feat.description}
                          onChange={(e) =>
                            updateField(
                              'about_features',
                              draft.about_features.map((f) =>
                                f.id === feat.id ? { ...f, description: e.target.value } : f
                              )
                            )
                          }
                          placeholder="Feature description..."
                          className="w-full rounded-lg border bg-white px-2.5 py-1.5"
                        />
                        <div className="grid grid-cols-6 gap-1">
                          {FEATURE_ICON_NAMES.map((ic) => (
                            <button
                              key={ic}
                              type="button"
                              onClick={() =>
                                updateField(
                                  'about_features',
                                  draft.about_features.map((f) =>
                                    f.id === feat.id ? { ...f, icon: ic } : f
                                  ),
                                  true
                                )
                              }
                              className={`p-1.5 rounded-lg border flex items-center justify-center cursor-pointer ${
                                feat.icon === ic
                                  ? 'bg-emerald-600 text-white border-emerald-600'
                                  : 'bg-white text-slate-600 border-slate-200 hover:border-slate-400'
                              }`}
                              title={ic}
                            >
                              <FeatureIcon name={ic} className="w-3.5 h-3.5" />
                            </button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {id === 'events' && (
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Eyebrow</label>
              <input
                type="text"
                value={draft.events_eyebrow}
                onChange={(e) => updateField('events_eyebrow', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Section Title</label>
              <input
                type="text"
                value={draft.events_title}
                onChange={(e) => updateField('events_title', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Subtitle</label>
              <input
                type="text"
                value={draft.events_subtitle}
                onChange={(e) => updateField('events_subtitle', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
              <div className="font-bold text-slate-800">Empty State Copy (When no events open)</div>
              <input
                type="text"
                value={draft.events_empty_title}
                onChange={(e) => updateField('events_empty_title', e.target.value)}
                className="w-full rounded-lg border bg-white px-2.5 py-1.5 font-semibold"
              />
              <textarea
                rows={2}
                value={draft.events_empty_desc}
                onChange={(e) => updateField('events_empty_desc', e.target.value)}
                className="w-full rounded-lg border bg-white px-2.5 py-1.5"
              />
            </div>
          </div>
        )}

        {id === 'highlights' && (
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Eyebrow</label>
              <input
                type="text"
                value={draft.highlights_eyebrow}
                onChange={(e) => updateField('highlights_eyebrow', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Section Title</label>
              <input
                type="text"
                value={draft.highlights_title}
                onChange={(e) => updateField('highlights_title', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
              />
            </div>
            <p className="text-[11px] text-slate-500 p-2.5 rounded-xl bg-slate-50 border border-slate-200">
              Pinned announcements created in the Club Activities tab automatically populate this gallery.
            </p>
          </div>
        )}

        {id === 'faq' && (
          <div className="space-y-3">
            <input
              type="text"
              value={draft.faq_eyebrow}
              onChange={(e) => updateField('faq_eyebrow', e.target.value)}
              placeholder="Eyebrow"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <input
              type="text"
              value={draft.faq_title}
              onChange={(e) => updateField('faq_title', e.target.value)}
              placeholder="FAQ Title"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
            />
            <input
              type="text"
              value={draft.faq_subtitle}
              onChange={(e) => updateField('faq_subtitle', e.target.value)}
              placeholder="FAQ Subtitle"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />

            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-700">Questions ({draft.faq_items.length})</span>
              <button
                type="button"
                onClick={() => {
                  const q: PublicFaqItem = {
                    id: `faq-${Date.now()}`,
                    question: 'New question for visitors?',
                    answer: 'Clear and friendly answer here.',
                  };
                  updateField('faq_items', [...draft.faq_items, q], true);
                  setExpandedItemIds((prev) => ({ ...prev, [q.id]: true }));
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Q&amp;A</span>
              </button>
            </div>

            <div className="space-y-2">
              {draft.faq_items.map((item, idx) => {
                const isOpenItem = expandedItemIds[item.id] ?? idx === 0;
                return (
                  <div
                    key={item.id}
                    draggable
                    onDragStart={() => setDraggedItemKey(item.id)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedItemKey || draggedItemKey === item.id) return;
                      const fromIdx = draft.faq_items.findIndex((q) => q.id === draggedItemKey);
                      if (fromIdx !== -1) {
                        updateField(
                          'faq_items',
                          moveArrayItem(draft.faq_items, fromIdx, idx),
                          true
                        );
                      }
                      setDraggedItemKey(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  >
                    <div className="px-2.5 py-2 flex items-center justify-between gap-1 bg-white border-b border-slate-100">
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(item.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                        <span className="font-bold text-slate-900 truncate">
                          {item.question || 'Untitled Question'}
                        </span>
                      </button>
                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() =>
                            updateField(
                              'faq_items',
                              moveArrayItem(draft.faq_items, idx, idx - 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={idx === draft.faq_items.length - 1}
                          onClick={() =>
                            updateField(
                              'faq_items',
                              moveArrayItem(draft.faq_items, idx, idx + 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'faq_items',
                              duplicateArrayItem(draft.faq_items, idx, 'faq'),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'faq_items',
                              draft.faq_items.filter((q) => q.id !== item.id),
                              true
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>
                    {isOpenItem && (
                      <div className="p-2.5 space-y-2">
                        <input
                          type="text"
                          value={item.question}
                          onChange={(e) =>
                            updateField(
                              'faq_items',
                              draft.faq_items.map((q) =>
                                q.id === item.id ? { ...q, question: e.target.value } : q
                              )
                            )
                          }
                          placeholder="Question"
                          className="w-full rounded-lg border bg-white px-2.5 py-1.5 font-semibold"
                        />
                        <textarea
                          rows={3}
                          value={item.answer}
                          onChange={(e) =>
                            updateField(
                              'faq_items',
                              draft.faq_items.map((q) =>
                                q.id === item.id ? { ...q, answer: e.target.value } : q
                              )
                            )
                          }
                          placeholder="Answer"
                          className="w-full rounded-lg border bg-white px-2.5 py-1.5"
                        />
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {id === 'cta' && (
          <div className="space-y-3">
            <input
              type="text"
              value={draft.cta_badge}
              onChange={(e) => updateField('cta_badge', e.target.value)}
              placeholder="CTA Badge"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <input
              type="text"
              value={draft.cta_title}
              onChange={(e) => updateField('cta_title', e.target.value)}
              placeholder="CTA Headline"
              className="w-full rounded-xl border border-slate-200 px-3 py-2 font-bold"
            />
            <textarea
              rows={2}
              value={draft.cta_subtitle}
              onChange={(e) => updateField('cta_subtitle', e.target.value)}
              placeholder="CTA Subtitle"
              className="w-full rounded-xl border border-slate-200 px-3 py-2"
            />
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Button Label</label>
                <input
                  type="text"
                  value={draft.cta_primary_label}
                  onChange={(e) => updateField('cta_primary_label', e.target.value)}
                  className="w-full rounded-xl border border-slate-200 px-2.5 py-2 font-bold"
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Button Action</label>
                <select
                  value={draft.cta_primary_action}
                  onChange={(e) =>
                    updateField(
                      'cta_primary_action',
                      e.target.value as 'signup' | 'login' | 'events' | 'custom',
                      true
                    )
                  }
                  className="w-full rounded-xl border border-slate-200 bg-white px-2.5 py-2 font-semibold"
                >
                  <option value="signup">Open Sign Up Modal</option>
                  <option value="login">Open Sign In Modal</option>
                  <option value="events">Scroll to Events</option>
                  <option value="custom">Custom URL / Anchor</option>
                </select>
              </div>
            </div>
            {draft.cta_primary_action === 'custom' && (
              <input
                type="text"
                value={draft.cta_primary_url}
                onChange={(e) => updateField('cta_primary_url', e.target.value)}
                placeholder="https://... or #anchor"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 font-mono text-[11px]"
              />
            )}
          </div>
        )}

        {id === 'footer' && (
          <div className="space-y-3">
            <div>
              <label className="block font-bold text-slate-700 mb-1">Footer Club Description</label>
              <textarea
                rows={2}
                value={draft.footer_about}
                onChange={(e) => updateField('footer_about', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Bottom Copyright Line</label>
              <input
                type="text"
                value={draft.footer_copyright}
                onChange={(e) => updateField('footer_copyright', e.target.value)}
                className="w-full rounded-xl border border-slate-200 px-3 py-2"
              />
            </div>

            <div className="flex items-center justify-between pt-1">
              <span className="font-bold text-slate-700">
                Columns ({draft.footer_columns.length})
              </span>
              <button
                type="button"
                onClick={handleAddColumn}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
              >
                <Plus className="w-3 h-3" />
                <span>Add Column</span>
              </button>
            </div>

            <div className="space-y-3">
              {draft.footer_columns.map((col, colIdx) => {
                const isOpenCol = expandedItemIds[col.id] ?? colIdx === 0;
                return (
                  <div
                    key={col.id}
                    draggable
                    onDragStart={() => setDraggedItemKey(`col:${col.id}`)}
                    onDragOver={(e) => e.preventDefault()}
                    onDrop={() => {
                      if (!draggedItemKey?.startsWith('col:')) return;
                      const fromId = draggedItemKey.replace('col:', '');
                      const fromIdx = draft.footer_columns.findIndex((c) => c.id === fromId);
                      if (fromIdx !== -1 && fromIdx !== colIdx) {
                        updateField(
                          'footer_columns',
                          moveArrayItem(draft.footer_columns, fromIdx, colIdx),
                          true
                        );
                      }
                      setDraggedItemKey(null);
                    }}
                    className="rounded-xl border border-slate-200 bg-slate-50 overflow-hidden"
                  >
                    <div className="px-2.5 py-2 flex items-center justify-between gap-1 bg-white border-b border-slate-200">
                      <button
                        type="button"
                        onClick={() => toggleItemExpanded(col.id)}
                        className="flex items-center gap-1.5 min-w-0 flex-1 text-left cursor-pointer"
                      >
                        <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                        {isOpenCol ? (
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        ) : (
                          <ChevronRight className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        )}
                        <span className="font-extrabold text-slate-900 truncate">
                          {col.title || `Column #${colIdx + 1}`}
                        </span>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          ({col.links.length})
                        </span>
                      </button>

                      <div className="flex items-center gap-0.5 shrink-0">
                        <button
                          type="button"
                          disabled={colIdx === 0}
                          onClick={() =>
                            updateField(
                              'footer_columns',
                              moveArrayItem(draft.footer_columns, colIdx, colIdx - 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move column left"
                        >
                          <ArrowUp className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          disabled={colIdx === draft.footer_columns.length - 1}
                          onClick={() =>
                            updateField(
                              'footer_columns',
                              moveArrayItem(draft.footer_columns, colIdx, colIdx + 1),
                              true
                            )
                          }
                          className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                          title="Move column right"
                        >
                          <ArrowDown className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            const clonedCol: PublicFooterColumn = {
                              ...col,
                              id: `col-${Date.now()}`,
                              title: `${col.title} Copy`,
                              links: col.links.map((l) => ({
                                ...l,
                                id: `lnk-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
                              })),
                            };
                            const next = [...draft.footer_columns];
                            next.splice(colIdx + 1, 0, clonedCol);
                            updateField('footer_columns', next, true);
                          }}
                          className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                          title="Duplicate column"
                        >
                          <Copy className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            updateField(
                              'footer_columns',
                              draft.footer_columns.filter((c) => c.id !== col.id),
                              true
                            )
                          }
                          className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                          title="Delete column"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    </div>

                    {isOpenCol && (
                      <div className="p-2.5 space-y-2.5">
                        <input
                          type="text"
                          value={col.title}
                          onChange={(e) =>
                            updateField(
                              'footer_columns',
                              draft.footer_columns.map((c) =>
                                c.id === col.id ? { ...c, title: e.target.value } : c
                              )
                            )
                          }
                          placeholder="Column Heading (e.g., Connect With Us)"
                          className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 font-extrabold text-slate-900"
                        />

                        {/* Quick-Add Social Chips */}
                        <div className="flex flex-wrap gap-1">
                          {(
                            [
                              { p: 'facebook', lbl: 'Facebook' },
                              { p: 'instagram', lbl: 'Instagram' },
                              { p: 'linkedin', lbl: 'LinkedIn' },
                              { p: 'youtube', lbl: 'YouTube' },
                              { p: 'tiktok', lbl: 'TikTok' },
                              { p: 'whatsapp', lbl: 'WhatsApp' },
                              { p: 'email', lbl: 'Email' },
                              { p: 'website', lbl: 'Website' },
                              { p: 'link', lbl: 'Page Link' },
                            ] as { p: FooterLinkPlatform; lbl: string }[]
                          ).map((chip) => (
                            <button
                              key={chip.p}
                              type="button"
                              onClick={() =>
                                handleAddLink(
                                  col.id,
                                  chip.p,
                                  chip.lbl === 'Page Link' ? '' : chip.lbl
                                )
                              }
                              className="px-2 py-0.5 rounded-md bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-800 border border-slate-200 text-[10px] font-bold cursor-pointer"
                            >
                              + {chip.lbl}
                            </button>
                          ))}
                        </div>

                        {/* Link Rows */}
                        <div className="space-y-2">
                          {col.links.map((lnk, lnkIdx) => {
                            const platMeta =
                              PLATFORM_OPTIONS.find((o) => o.value === (lnk.platform || 'link')) ||
                              PLATFORM_OPTIONS[PLATFORM_OPTIONS.length - 1];
                            const testHref = normalizeExternalHref(lnk.url, lnk.platform);
                            return (
                              <div
                                key={lnk.id}
                                draggable
                                onDragStart={(e) => {
                                  e.stopPropagation();
                                  setDraggedItemKey(`lnk:${col.id}:${lnk.id}`);
                                }}
                                onDragOver={(e) => e.preventDefault()}
                                onDrop={(e) => {
                                  e.stopPropagation();
                                  if (!draggedItemKey?.startsWith(`lnk:${col.id}:`)) return;
                                  const fromId = draggedItemKey.split(':')[2];
                                  const fromIdx = col.links.findIndex((l) => l.id === fromId);
                                  if (fromIdx !== -1 && fromIdx !== lnkIdx) {
                                    updateField(
                                      'footer_columns',
                                      draft.footer_columns.map((c) =>
                                        c.id === col.id
                                          ? { ...c, links: moveArrayItem(c.links, fromIdx, lnkIdx) }
                                          : c
                                      ),
                                      true
                                    );
                                  }
                                  setDraggedItemKey(null);
                                }}
                                className="p-2 rounded-lg bg-white border border-slate-200 space-y-1.5"
                              >
                                <div className="flex items-center justify-between gap-1">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <GripVertical className="w-3.5 h-3.5 text-slate-400 shrink-0 cursor-grab" />
                                    <span className="p-1 rounded bg-slate-100 text-slate-700">
                                      <FooterPlatformIcon platform={lnk.platform} />
                                    </span>
                                    <span className="font-bold text-slate-800 truncate">
                                      {lnk.label || 'New Link'}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-0.5 shrink-0">
                                    <button
                                      type="button"
                                      disabled={lnkIdx === 0}
                                      onClick={() =>
                                        updateField(
                                          'footer_columns',
                                          draft.footer_columns.map((c) =>
                                            c.id === col.id
                                              ? {
                                                  ...c,
                                                  links: moveArrayItem(c.links, lnkIdx, lnkIdx - 1),
                                                }
                                              : c
                                          ),
                                          true
                                        )
                                      }
                                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                      title="Move link up"
                                    >
                                      <ArrowUp className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      disabled={lnkIdx === col.links.length - 1}
                                      onClick={() =>
                                        updateField(
                                          'footer_columns',
                                          draft.footer_columns.map((c) =>
                                            c.id === col.id
                                              ? {
                                                  ...c,
                                                  links: moveArrayItem(c.links, lnkIdx, lnkIdx + 1),
                                                }
                                              : c
                                          ),
                                          true
                                        )
                                      }
                                      className="p-1 text-slate-500 hover:text-slate-900 disabled:opacity-30 cursor-pointer"
                                      title="Move link down"
                                    >
                                      <ArrowDown className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateField(
                                          'footer_columns',
                                          draft.footer_columns.map((c) =>
                                            c.id === col.id
                                              ? {
                                                  ...c,
                                                  links: duplicateArrayItem(c.links, lnkIdx, 'lnk'),
                                                }
                                              : c
                                          ),
                                          true
                                        )
                                      }
                                      className="p-1 text-slate-500 hover:text-emerald-600 cursor-pointer"
                                      title="Duplicate link"
                                    >
                                      <Copy className="w-3 h-3" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        updateField(
                                          'footer_columns',
                                          draft.footer_columns.map((c) =>
                                            c.id === col.id
                                              ? {
                                                  ...c,
                                                  links: c.links.filter((l) => l.id !== lnk.id),
                                                }
                                              : c
                                          ),
                                          true
                                        )
                                      }
                                      className="p-1 text-rose-500 hover:bg-rose-50 rounded cursor-pointer"
                                      title="Remove link"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  </div>
                                </div>

                                <div className="grid grid-cols-2 gap-1.5">
                                  <select
                                    value={lnk.platform || 'link'}
                                    onChange={(e) =>
                                      updateField(
                                        'footer_columns',
                                        draft.footer_columns.map((c) =>
                                          c.id === col.id
                                            ? {
                                                ...c,
                                                links: c.links.map((l) =>
                                                  l.id === lnk.id
                                                    ? {
                                                        ...l,
                                                        platform: e.target
                                                          .value as FooterLinkPlatform,
                                                      }
                                                    : l
                                                ),
                                              }
                                            : c
                                        ),
                                        true
                                      )
                                    }
                                    className="rounded-md border bg-slate-50 px-2 py-1 font-semibold"
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
                                      updateField(
                                        'footer_columns',
                                        draft.footer_columns.map((c) =>
                                          c.id === col.id
                                            ? {
                                                ...c,
                                                links: c.links.map((l) =>
                                                  l.id === lnk.id
                                                    ? { ...l, label: e.target.value }
                                                    : l
                                                ),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    placeholder="Label"
                                    className="rounded-md border bg-white px-2 py-1 font-semibold"
                                  />
                                </div>

                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="text"
                                    value={lnk.url}
                                    onChange={(e) =>
                                      updateField(
                                        'footer_columns',
                                        draft.footer_columns.map((c) =>
                                          c.id === col.id
                                            ? {
                                                ...c,
                                                links: c.links.map((l) =>
                                                  l.id === lnk.id
                                                    ? { ...l, url: e.target.value }
                                                    : l
                                                ),
                                              }
                                            : c
                                        )
                                      )
                                    }
                                    placeholder={platMeta.placeholder}
                                    className="flex-1 rounded-md border bg-white px-2 py-1 font-mono text-[10px]"
                                  />
                                  {testHref && (
                                    <a
                                      href={testHref}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      title={`Test open: ${testHref}`}
                                      className="p-1.5 rounded-md border border-slate-200 hover:border-emerald-400 text-slate-600 hover:text-emerald-700"
                                    >
                                      <ExternalLink className="w-3 h-3" />
                                    </a>
                                  )}
                                </div>

                                {draft.footer_columns.length >= 2 && (
                                  <div className="flex items-center justify-between gap-2 pt-0.5 text-[10px] text-slate-500">
                                    <span>Move to column:</span>
                                    <select
                                      value={col.id}
                                      onChange={(e) =>
                                        handleMoveLinkToColumn(col.id, lnk.id, e.target.value)
                                      }
                                      className="rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-semibold text-slate-700"
                                    >
                                      {draft.footer_columns.map((targetCol, tcIdx) => (
                                        <option key={targetCol.id} value={targetCol.id}>
                                          {targetCol.title || `Column #${tcIdx + 1}`}
                                        </option>
                                      ))}
                                    </select>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-xs p-2 sm:p-4">
      <div className="bg-slate-100 text-slate-900 rounded-3xl shadow-2xl border border-slate-700/40 max-w-[96vw] w-[1440px] h-[92vh] overflow-hidden flex flex-col">
        {/* Top Studio Toolbar */}
        <div className="bg-slate-950 text-white px-4 sm:px-5 py-3 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center shrink-0">
              <Globe className="w-4 h-4 text-white" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h2 className="text-sm sm:text-base font-extrabold truncate">
                  Public Landing Studio
                </h2>
                {hasUnsavedChanges && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-500/20 text-amber-300 text-[10px] font-bold">
                    <span className="w-1.5 h-1.5 rounded-full bg-amber-400" />
                    <span>Unsaved changes</span>
                  </span>
                )}
              </div>
              <p className="text-[11px] text-slate-400 hidden sm:block truncate">
                Click any section in the preview to inspect &amp; edit, or drag rows to reorder
              </p>
            </div>
          </div>

          {/* Center Controls: Undo/Redo + Templates + Responsive Switch */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              <button
                type="button"
                disabled={historyPast.length === 0}
                onClick={handleUndo}
                title="Undo (Ctrl+Z)"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <Undo2 className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                disabled={historyFuture.length === 0}
                onClick={handleRedo}
                title="Redo (Ctrl+Shift+Z)"
                className="p-1.5 rounded-lg text-slate-300 hover:text-white hover:bg-slate-800 disabled:opacity-30 cursor-pointer"
              >
                <Redo2 className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="relative">
              <button
                type="button"
                onClick={() => setTemplatesOpen((v) => !v)}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 text-xs font-bold text-slate-200 cursor-pointer"
              >
                <Sparkles className="w-3.5 h-3.5 text-emerald-400" />
                <span>Templates</span>
              </button>
              {templatesOpen && (
                <div className="absolute right-0 mt-2 w-72 rounded-2xl bg-white text-slate-900 shadow-2xl border border-slate-200 p-2 z-50 space-y-1">
                  <div className="px-2 py-1 text-[10px] font-extrabold uppercase text-slate-400">
                    Apply Visual Preset (Keeps Copy)
                  </div>
                  {PUBLIC_LANDING_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.id}
                      type="button"
                      onClick={() => applyTemplate(tpl.id)}
                      className="w-full text-left p-2 rounded-xl hover:bg-slate-100 flex items-start gap-2.5 cursor-pointer"
                    >
                      <span
                        className={`w-4 h-4 rounded-full mt-0.5 shrink-0 ${
                          LANDING_THEME_STYLES[tpl.theme_preset].swatchClass
                        }`}
                      />
                      <div>
                        <div className="text-xs font-extrabold text-slate-900">{tpl.name}</div>
                        <div className="text-[10px] text-slate-500 leading-snug">
                          {tpl.description}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div className="hidden md:inline-flex items-center bg-slate-900 border border-slate-800 rounded-xl p-0.5">
              {(
                [
                  { id: 'desktop', icon: Monitor, lbl: 'Desktop' },
                  { id: 'tablet', icon: Tablet, lbl: 'Tablet' },
                  { id: 'mobile', icon: Smartphone, lbl: 'Mobile' },
                ] as const
              ).map((vp) => {
                const IconComp = vp.icon;
                return (
                  <button
                    key={vp.id}
                    type="button"
                    onClick={() => setViewport(vp.id)}
                    title={`${vp.lbl} Preview`}
                    className={`p-1.5 rounded-lg cursor-pointer ${
                      viewport === vp.id
                        ? 'bg-emerald-600 text-white'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <IconComp className="w-3.5 h-3.5" />
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setShowHiddenSections((v) => !v)}
              title="Toggle hidden section placeholders in preview"
              className={`hidden sm:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl border text-[11px] font-bold cursor-pointer ${
                showHiddenSections
                  ? 'bg-slate-800 border-slate-700 text-white'
                  : 'bg-slate-900 border-slate-800 text-slate-400'
              }`}
            >
              {showHiddenSections ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              <span className="hidden xl:inline">Hidden Strips</span>
            </button>

            <button
              type="button"
              onClick={() => setFullPreview((v) => !v)}
              title={fullPreview ? 'Show Inspector' : 'Expand Full Preview'}
              className="hidden lg:inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 hover:border-slate-600 text-[11px] font-bold text-slate-200 cursor-pointer"
            >
              {fullPreview ? (
                <Minimize2 className="w-3.5 h-3.5" />
              ) : (
                <Maximize2 className="w-3.5 h-3.5" />
              )}
              <span>{fullPreview ? 'Split View' : 'Full Preview'}</span>
            </button>
          </div>

          {/* Right Save / Cancel */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleCloseSafe}
              className="px-3 py-1.5 rounded-xl text-xs font-bold text-slate-300 hover:text-white hover:bg-slate-800 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold shadow-md cursor-pointer disabled:opacity-60"
            >
              {saving ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <CheckCircle2 className="w-3.5 h-3.5" />
              )}
              <span>{saving ? 'Publishing...' : 'Save & Publish'}</span>
            </button>
            <button
              type="button"
              onClick={handleCloseSafe}
              className="p-1.5 rounded-full hover:bg-white/10 text-slate-400 hover:text-white cursor-pointer"
              aria-label="Close studio"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Mobile Inspector / Preview Switcher (< lg) */}
        <div className="lg:hidden bg-white border-b border-slate-200 px-4 py-2 grid grid-cols-2 gap-2 shrink-0">
          <button
            type="button"
            onClick={() => setMobilePane('edit')}
            className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              mobilePane === 'edit' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Edit3 className="w-3.5 h-3.5" />
            <span>Inspector</span>
          </button>
          <button
            type="button"
            onClick={() => setMobilePane('preview')}
            className={`py-1.5 rounded-xl text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer ${
              mobilePane === 'preview' ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-600'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Live Preview</span>
          </button>
        </div>

        {/* Studio Error Banner */}
        {errorMsg && (
          <div className="bg-rose-50 border-b border-rose-200 px-5 py-2.5 flex items-center gap-2 text-xs text-rose-700 font-bold shrink-0">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Split-Screen Workspace */}
        <div className="flex-1 min-h-0 flex overflow-hidden">
          {/* LEFT PANEL: Navigator & Focused Inspector */}
          {!fullPreview && (
            <aside
              className={`${
                mobilePane === 'edit' ? 'flex' : 'hidden lg:flex'
              } w-full lg:w-[410px] shrink-0 bg-white border-r border-slate-200 flex-col min-h-0 text-xs`}
            >
              {/* Left Mode Tabs */}
              <div className="p-3 border-b border-slate-200 grid grid-cols-2 gap-1.5 bg-slate-50 shrink-0">
                <button
                  type="button"
                  onClick={() => setLeftMode('sections')}
                  className={`py-2 rounded-xl font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    leftMode === 'sections'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Layout className="w-3.5 h-3.5" />
                  <span>Page Sections</span>
                </button>
                <button
                  type="button"
                  onClick={() => setLeftMode('design')}
                  className={`py-2 rounded-xl font-extrabold flex items-center justify-center gap-1.5 cursor-pointer transition ${
                    leftMode === 'design'
                      ? 'bg-white text-slate-900 shadow-xs border border-slate-200'
                      : 'text-slate-500 hover:text-slate-800'
                  }`}
                >
                  <Palette className="w-3.5 h-3.5" />
                  <span>Design &amp; Theme</span>
                </button>
              </div>

              {/* Left Scroll Area */}
              <div className="flex-1 overflow-y-auto p-4">
                {leftMode === 'sections' ? (
                  activeSectionId ? (
                    renderSectionInspector(activeSectionId)
                  ) : (
                    <div className="space-y-2">
                      <div className="flex items-center justify-between pb-1">
                        <span className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                          Section Outline (Drag or ↑/↓)
                        </span>
                      </div>

                      {draft.section_order.map((secId) => {
                        const meta = LANDING_SECTION_META[secId];
                        const visible = isSectionVisible(secId);
                        const middleOnly = draft.section_order.filter(
                          (id) => LANDING_SECTION_META[id].reorderable
                        );
                        const middleIdx = middleOnly.indexOf(secId);

                        return (
                          <div
                            key={secId}
                            draggable={meta.reorderable}
                            onDragStart={() => meta.reorderable && setDraggedSectionId(secId)}
                            onDragOver={(e) => meta.reorderable && e.preventDefault()}
                            onDrop={() => {
                              if (meta.reorderable && draggedSectionId) {
                                reorderMiddleSections(draggedSectionId, secId);
                              }
                              setDraggedSectionId(null);
                            }}
                            onMouseEnter={() => setHoveredSectionId(secId)}
                            onMouseLeave={() => setHoveredSectionId(null)}
                            className={`rounded-2xl border transition flex items-center justify-between gap-2 p-2.5 ${
                              hoveredSectionId === secId
                                ? 'border-emerald-400 bg-emerald-50/40'
                                : 'border-slate-200 bg-white hover:border-slate-300'
                            } ${!visible ? 'opacity-65' : ''}`}
                          >
                            <div
                              onClick={() => handleSelectSection(secId, true)}
                              className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                            >
                              {meta.reorderable ? (
                                <GripVertical className="w-4 h-4 text-slate-400 shrink-0 cursor-grab" />
                              ) : (
                                <div className="w-4 shrink-0" />
                              )}
                              <div className="w-8 h-8 rounded-xl bg-slate-100 text-slate-700 flex items-center justify-center shrink-0">
                                <SectionNavIcon id={secId} />
                              </div>
                              <div className="min-w-0">
                                <div className="font-extrabold text-slate-900 truncate">
                                  {meta.label}
                                </div>
                                <div className="text-[10px] text-slate-500 truncate">
                                  {getSectionSummary(secId)}
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-0.5 shrink-0">
                              {meta.reorderable && (
                                <>
                                  <button
                                    type="button"
                                    disabled={middleIdx <= 0}
                                    onClick={() => handleQuickMoveSection(secId, 'up')}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                                    title="Move section up"
                                  >
                                    <ArrowUp className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    disabled={middleIdx === middleOnly.length - 1}
                                    onClick={() => handleQuickMoveSection(secId, 'down')}
                                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-900 hover:bg-slate-100 disabled:opacity-25 cursor-pointer"
                                    title="Move section down"
                                  >
                                    <ArrowDown className="w-3.5 h-3.5" />
                                  </button>
                                </>
                              )}
                              {meta.toggleKey && (
                                <button
                                  type="button"
                                  onClick={() => toggleSectionVisibility(secId)}
                                  className={`p-1.5 rounded-lg cursor-pointer ${
                                    visible
                                      ? 'text-emerald-600 hover:bg-emerald-50'
                                      : 'text-slate-400 hover:bg-slate-100'
                                  }`}
                                  title={visible ? 'Hide section' : 'Show section'}
                                >
                                  {visible ? (
                                    <Eye className="w-3.5 h-3.5" />
                                  ) : (
                                    <EyeOff className="w-3.5 h-3.5" />
                                  )}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )
                ) : (
                  <div className="space-y-5">
                    {/* Starter Templates */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Starter Style Presets
                      </div>
                      <div className="grid grid-cols-1 gap-2">
                        {PUBLIC_LANDING_TEMPLATES.map((tpl) => {
                          const isCurrent =
                            draft.theme_preset === tpl.theme_preset &&
                            draft.hero_layout === tpl.hero_layout &&
                            draft.card_style === tpl.card_style;
                          return (
                            <button
                              key={tpl.id}
                              type="button"
                              onClick={() => applyTemplate(tpl.id)}
                              className={`p-3 rounded-2xl border text-left flex items-start gap-3 cursor-pointer transition ${
                                isCurrent
                                  ? 'border-emerald-500 bg-emerald-50/50'
                                  : 'border-slate-200 hover:border-slate-300 bg-white'
                              }`}
                            >
                              <span
                                className={`w-5 h-5 rounded-full mt-0.5 shrink-0 ${
                                  LANDING_THEME_STYLES[tpl.theme_preset].swatchClass
                                }`}
                              />
                              <div>
                                <div className="font-extrabold text-slate-900">{tpl.name}</div>
                                <div className="text-[11px] text-slate-500 mt-0.5">
                                  {tpl.description}
                                </div>
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Color Themes */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Color Accent Theme
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(Object.keys(LANDING_THEME_STYLES) as LandingThemePreset[]).map((key) => {
                          const t = LANDING_THEME_STYLES[key];
                          const active = draft.theme_preset === key;
                          return (
                            <button
                              key={key}
                              type="button"
                              onClick={() => updateField('theme_preset', key, true)}
                              className={`p-2.5 rounded-xl border text-center space-y-1.5 cursor-pointer ${
                                active
                                  ? 'border-slate-900 bg-slate-900 text-white'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-700'
                              }`}
                            >
                              <div className={`w-5 h-5 rounded-full mx-auto ${t.swatchClass}`} />
                              <div className="text-[10px] font-bold truncate">{t.name}</div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Hero Layout */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Hero Layout
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'split', label: 'Split' },
                            { id: 'centered', label: 'Centered' },
                            { id: 'banner', label: 'Banner' },
                          ] as { id: HeroLayoutMode; label: string }[]
                        ).map((hl) => {
                          const active = draft.hero_layout === hl.id;
                          return (
                            <button
                              key={hl.id}
                              type="button"
                              onClick={() => updateField('hero_layout', hl.id, true)}
                              className={`p-2.5 rounded-xl border space-y-2 cursor-pointer ${
                                active
                                  ? 'border-emerald-600 bg-emerald-50 text-emerald-950'
                                  : 'border-slate-200 bg-white hover:border-slate-300 text-slate-600'
                              }`}
                            >
                              {hl.id === 'split' ? (
                                <div className="h-7 flex gap-1 items-center">
                                  <div className="flex-1 space-y-1">
                                    <div className="h-1.5 bg-current opacity-40 rounded" />
                                    <div className="h-1 bg-current opacity-25 rounded w-3/4" />
                                  </div>
                                  <div className="w-6 h-6 bg-current opacity-20 rounded" />
                                </div>
                              ) : hl.id === 'centered' ? (
                                <div className="h-7 flex flex-col items-center justify-center gap-1">
                                  <div className="h-1.5 w-3/4 bg-current opacity-40 rounded" />
                                  <div className="h-3 w-full bg-current opacity-20 rounded" />
                                </div>
                              ) : (
                                <div className="h-7 bg-current opacity-25 rounded flex items-center px-1.5">
                                  <div className="h-1.5 w-1/2 bg-white rounded" />
                                </div>
                              )}
                              <div className="text-[11px] font-extrabold text-center">
                                {hl.label}
                              </div>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* Card Surface */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Card Surface Style
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'glass', label: 'Glass' },
                            { id: 'crisp', label: 'Crisp' },
                            { id: 'elevated', label: 'Elevated' },
                          ] as { id: CardSurfaceStyle; label: string }[]
                        ).map((cs) => (
                          <button
                            key={cs.id}
                            type="button"
                            onClick={() => updateField('card_style', cs.id, true)}
                            className={`py-2 px-3 rounded-xl border font-extrabold text-[11px] cursor-pointer ${
                              draft.card_style === cs.id
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {cs.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    {/* Animation Level */}
                    <div className="space-y-2">
                      <div className="text-[11px] font-extrabold uppercase tracking-wider text-slate-400">
                        Motion &amp; Scroll Reveal
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { id: 'vivid', label: 'Vivid' },
                            { id: 'smooth', label: 'Smooth' },
                            { id: 'off', label: 'Off' },
                          ] as { id: AnimationLevel; label: string }[]
                        ).map((al) => (
                          <button
                            key={al.id}
                            type="button"
                            onClick={() => updateField('animation_level', al.id, true)}
                            className={`py-2 px-3 rounded-xl border font-extrabold text-[11px] cursor-pointer ${
                              draft.animation_level === al.id
                                ? 'border-slate-900 bg-slate-900 text-white'
                                : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                            }`}
                          >
                            {al.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </aside>
          )}

          {/* RIGHT PANEL: Interactive Live Preview Canvas */}
          <main
            ref={previewScrollRef}
            className={`${
              mobilePane === 'preview' || fullPreview ? 'flex' : 'hidden lg:flex'
            } flex-1 min-w-0 min-h-0 overflow-y-auto overflow-x-hidden bg-slate-200/80 p-3 sm:p-5 flex-col items-center`}
          >
            {viewport !== 'desktop' && (
              <div className="mb-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900/90 text-white text-[11px] font-bold shadow-sm shrink-0">
                {viewport === 'tablet' ? (
                  <>
                    <Tablet className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Tablet Preview · 768px</span>
                  </>
                ) : (
                  <>
                    <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
                    <span>Mobile Preview · 390px</span>
                  </>
                )}
              </div>
            )}
            <div
              className={`w-full transition-all duration-300 rounded-2xl overflow-hidden shadow-2xl border border-slate-300 bg-white shrink-0 ${
                viewport === 'mobile'
                  ? 'max-w-[390px]'
                  : viewport === 'tablet'
                  ? 'max-w-[768px]'
                  : 'max-w-full'
              }`}
            >
              <PublicLandingPage
                initialClubName={clubName}
                initialLogoUrl={logoUrl}
                initialBatch={currentBatch}
                previewConfig={draft}
                isPreview
                previewViewport={viewport}
                selectedSectionId={activeSectionId}
                hoveredSectionId={hoveredSectionId}
                showHiddenSections={showHiddenSections}
                onSelectSection={(id) => handleSelectSection(id, false)}
                onHoverSection={setHoveredSectionId}
                onQuickMoveSection={handleQuickMoveSection}
                onQuickToggleSection={toggleSectionVisibility}
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
          </main>
        </div>
      </div>
    </div>
  );
}
