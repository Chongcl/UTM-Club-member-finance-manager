'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  supabase,
  isSupabaseConfigured,
  MAX_FILE_SIZE_BYTES,
  downloadFileFromUrl,
} from '@/lib/supabase';
import {
  ActivityConfig,
  resolveActivityConfig,
  formatActivitySchedule,
  getFormatBadgeMeta,
} from '@/lib/activityConfig';
import NetworkStatusBanner from '@/components/NetworkStatusBanner';
import {
  ArrowLeft,
  Calendar,
  Clock,
  MapPin,
  Ticket,
  UploadCloud,
  CheckCircle2,
  Copy,
  Download,
  Search,
  Loader2,
  AlertCircle,
  Lock,
  Layers,
  ExternalLink,
  FileText,
  ShieldCheck,
  XCircle,
  KeyRound,
  X,
} from 'lucide-react';

interface PublicEventPayload {
  found: boolean;
  id?: string;
  event_name?: string;
  category?: string;
  event_date?: string;
  end_date?: string | null;
  event_time?: string;
  location?: string;
  description?: string;
  status?: 'Active' | 'Closed';
  is_open?: boolean;
  public_slug?: string;
  registration_fee?: number;
  guest_fee?: number | null;
  effective_fee?: number;
  guest_capacity?: number;
  guest_registered_count?: number;
  activity_config?: ActivityConfig | null;
  show_payment_qr?: boolean;
  payment_qr_url?: string;
  payment_bank_info?: string;
  club_name?: string;
  logo_url?: string;
  club_tagline?: string;
  current_batch?: string;
}

interface GuestSubmissionResult {
  ok: boolean;
  error?: string;
  id?: string;
  lookup_code?: string;
  payment_status?: 'Free' | 'Pending' | 'Verified' | 'Rejected';
  pass_approved?: boolean;
  qr_payload?: string | null;
  selected_tier?: string;
  registration_note?: string;
  access_link_url?: string | null;
  access_link_label?: string | null;
  access_code?: string | null;
  access_instructions?: string | null;
}

interface GuestPassStatusResult {
  found: boolean;
  multiple_matches?: boolean;
  match_count?: number;
  id?: string;
  guest_name?: string;
  institution_or_matric?: string;
  masked_email?: string;
  lookup_code?: string;
  selected_tier?: string;
  registration_note?: string;
  payment_status?: 'Free' | 'Pending' | 'Verified' | 'Rejected';
  pass_approved?: boolean;
  qr_checked_in?: boolean;
  qr_checked_in_at?: string | null;
  amount_paid?: number;
  created_at?: string;
  event_id?: string;
  event_name?: string;
  category?: string;
  event_date?: string;
  end_date?: string | null;
  event_time?: string;
  location?: string;
  description?: string;
  club_name?: string;
  activity_config?: ActivityConfig | null;
  qr_payload?: string | null;
  unlock_mode?: string;
  access_link_url?: string | null;
  access_link_label?: string | null;
  access_code?: string | null;
  access_instructions?: string | null;
}

function isPdfUrl(url?: string): boolean {
  if (!url) return false;
  return (
    url.toLowerCase().split('?')[0].endsWith('.pdf') ||
    url.startsWith('data:application/pdf')
  );
}

export default function PublicEventPage() {
  const params = useParams();
  const slugParam = Array.isArray(params?.slug) ? params.slug[0] : params?.slug;
  const slug = String(slugParam || '').trim();

  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [navigatingHome, setNavigatingHome] = useState(false);
  const [eventData, setEventData] = useState<PublicEventPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'register' | 'check'>('register');

  // Registration form
  const [guestName, setGuestName] = useState('');
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [selectedTierName, setSelectedTierName] = useState('');
  const [registrationNote, setRegistrationNote] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<GuestSubmissionResult | null>(null);
  const [confirmationModalOpen, setConfirmationModalOpen] = useState(false);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);
  const [copiedAccess, setCopiedAccess] = useState(false);

  // Check My Pass state
  const [lookupInput, setLookupInput] = useState('');
  const [checkingPass, setCheckingPass] = useState(false);
  const [passResult, setPassResult] = useState<GuestPassStatusResult | null>(null);
  const [passSearchAttempted, setPassSearchAttempted] = useState(false);

  const loadEvent = useCallback(async () => {
    if (!slug || !isSupabaseConfigured) {
      setLoading(false);
      return;
    }
    setLoading(true);
    setLoadError(null);
    try {
      const { data, error } = await supabase.rpc('get_public_event_by_slug', {
        p_slug: slug,
      });
      if (error) {
        setLoadError('Network issue loading event details. Please check your connection and retry.');
        return;
      }
      if (!data) {
        setEventData({ found: false });
      } else {
        const payload = data as PublicEventPayload;
        setEventData(payload);
        const cfg = resolveActivityConfig({
          registration_fee: payload.effective_fee ?? payload.guest_fee ?? payload.registration_fee,
          activity_config: payload.activity_config,
        });
        if (cfg.fee_tiers.length > 0) {
          setSelectedTierName(cfg.fee_tiers[0].name);
          setAmountPaid(cfg.fee_tiers[0].amount.toFixed(2));
        } else {
          const effFee = Number(payload.effective_fee ?? payload.guest_fee ?? payload.registration_fee ?? 0);
          setAmountPaid(effFee > 0 ? effFee.toFixed(2) : '0');
        }
      }
    } catch {
      setLoadError('Network issue loading event details. Please check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (!confirmationModalOpen) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setConfirmationModalOpen(false);
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [confirmationModalOpen]);

  const handleCopy = async (text: string, which: 'code' | 'bank' | 'access') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else if (which === 'bank') {
        setCopiedBank(true);
        setTimeout(() => setCopiedBank(false), 2000);
      } else {
        setCopiedAccess(true);
        setTimeout(() => setCopiedAccess(false), 2000);
      }
    } catch {
      /* ignore clipboard error */
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData?.found || !eventData.id) return;
    setFormError(null);

    const cfg = resolveActivityConfig({
      registration_fee: eventData.effective_fee ?? eventData.guest_fee ?? eventData.registration_fee,
      activity_config: eventData.activity_config,
    });

    if (!guestName.trim() || !email.trim() || !phone.trim()) {
      setFormError('Please enter your full name, email address, and WhatsApp phone number.');
      return;
    }

    if (cfg.registration_prompt && !registrationNote.trim()) {
      setFormError(`Please enter: ${cfg.registration_prompt}`);
      return;
    }

    const effFee = Number(eventData.effective_fee ?? 0);
    const numAmt = parseFloat(amountPaid) || effFee;
    const isPaidSubmission = numAmt > 0 || (effFee > 0 && !cfg.allow_custom_amount);

    if (isPaidSubmission && !receiptFile) {
      setFormError('Please upload your payment receipt image or PDF before submitting.');
      return;
    }
    if (receiptFile && receiptFile.size > MAX_FILE_SIZE_BYTES) {
      setFormError('Receipt file size must be under 50 MB.');
      return;
    }

    setSubmitting(true);
    try {
      let receiptUrl = '';
      let receiptName = '';
      if (receiptFile) {
        const ext = receiptFile.name.split('.').pop() || 'jpg';
        const safePath = `guest-fees/${eventData.id}/${Date.now()}-${Math.random()
          .toString(36)
          .slice(2, 7)}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(safePath, receiptFile, { upsert: false });
        if (upErr) {
          throw new Error(upErr.message || 'Could not upload payment receipt.');
        }
        receiptUrl = supabase.storage.from('receipts').getPublicUrl(safePath).data.publicUrl;
        receiptName = receiptFile.name;
      }

      let res: GuestSubmissionResult | null = null;
      const { data: extData, error: extErr } = await supabase.rpc('submit_guest_registration', {
        p_slug: slug,
        p_name: guestName.trim(),
        p_institution: institution.trim(),
        p_email: email.trim(),
        p_phone: phone.trim(),
        p_amount: numAmt,
        p_receipt_url: receiptUrl,
        p_receipt_name: receiptName,
        p_selected_tier: selectedTierName.trim(),
        p_registration_note: registrationNote.trim(),
      });

      if (extErr) {
        const { data: baseData, error: baseErr } = await supabase.rpc('submit_guest_registration', {
          p_slug: slug,
          p_name: guestName.trim(),
          p_institution: institution.trim(),
          p_email: email.trim(),
          p_phone: phone.trim(),
          p_amount: numAmt,
          p_receipt_url: receiptUrl,
          p_receipt_name: receiptName,
        });
        if (baseErr) {
          throw new Error(baseErr.message || 'Registration failed.');
        }
        res = baseData as GuestSubmissionResult;
      } else {
        res = extData as GuestSubmissionResult;
      }

      if (!res?.ok) {
        setFormError(res?.error || 'Could not complete registration.');
        return;
      }

      setSubmissionResult(res);
      setConfirmationModalOpen(true);
      if (res.lookup_code) {
        setLookupInput(res.lookup_code);
      }
      void loadEvent();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : 'Could not complete registration.');
    } finally {
      setSubmitting(false);
    }
  };

  const runPassLookup = async (queryText: string) => {
    const clean = queryText.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();
    if (!clean) return;
    setCheckingPass(true);
    setPassSearchAttempted(true);
    try {
      const { data, error } = await supabase.rpc('lookup_public_event_registration', {
        p_slug: slug,
        p_query: clean,
      });
      if (!error && data) {
        setPassResult(data as GuestPassStatusResult);
        return;
      }

      const { data: legacyData, error: legacyErr } = await supabase.rpc(
        'check_guest_registration_status',
        {
          p_slug: slug,
          p_lookup_or_email: clean,
        }
      );
      if (legacyErr || !legacyData) {
        setPassResult({ found: false });
      } else {
        setPassResult(legacyData as GuestPassStatusResult);
      }
    } finally {
      setCheckingPass(false);
    }
  };

  const handleCheckPass = async (e: React.FormEvent) => {
    e.preventDefault();
    await runPassLookup(lookupInput);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-teal-50 p-4 gap-3">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
        <span className="text-xs font-bold text-slate-500">Loading public event details...</span>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-slate-100">
        <NetworkStatusBanner
          networkError={loadError}
          onRetry={() => void loadEvent()}
          onReconnected={() => void loadEvent()}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-rose-200 shadow-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-rose-100 text-rose-600 flex items-center justify-center mx-auto">
              <AlertCircle className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Connection Issue</h1>
            <p className="text-xs text-slate-600 leading-relaxed">{loadError}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => void loadEvent()}
                className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold cursor-pointer"
              >
                <span>Retry</span>
              </button>
              <Link
                href="/"
                onClick={() => setNavigatingHome(true)}
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold"
              >
                {navigatingHome ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : (
                  <ArrowLeft className="w-3.5 h-3.5" />
                )}
                <span>{navigatingHome ? 'Returning...' : 'Back to Club Portal'}</span>
              </Link>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (!eventData?.found) {
    return (
      <div className="min-h-screen flex flex-col bg-gradient-to-br from-emerald-50 via-white to-slate-100">
        <NetworkStatusBanner
          networkError={loadError}
          onRetry={() => void loadEvent()}
          onReconnected={() => void loadEvent()}
        />
        <div className="flex-1 flex items-center justify-center p-4">
          <div className="max-w-md w-full bg-white rounded-3xl border border-slate-200 shadow-xl p-8 text-center space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-slate-100 text-slate-500 flex items-center justify-center mx-auto">
              <Ticket className="w-7 h-7" />
            </div>
            <h1 className="text-xl font-extrabold text-slate-900">Event Not Available</h1>
            <p className="text-xs text-slate-500 leading-relaxed">
              This public event link may have closed, moved, or is no longer accepting guest registrations.
            </p>
            <Link
              href="/"
              onClick={() => setNavigatingHome(true)}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition"
            >
              {navigatingHome ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <ArrowLeft className="w-4 h-4" />
              )}
              <span>{navigatingHome ? 'Returning to portal...' : 'Back to Club Portal'}</span>
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const clubName = eventData.club_name || 'ClubSync';
  const logoUrl = eventData.logo_url || '';
  const cfg = resolveActivityConfig({
    event_date: eventData.event_date,
    end_date: eventData.end_date,
    registration_fee: eventData.effective_fee ?? eventData.guest_fee ?? eventData.registration_fee,
    activity_config: eventData.activity_config,
  });
  const formatBadge = getFormatBadgeMeta(cfg.format);
  const scheduleLabel = formatActivitySchedule({ event_date: eventData.event_date }, cfg);
  const effFee = Number(eventData.effective_fee ?? 0);
  const isPaid = effFee > 0 || cfg.fee_tiers.some((t) => t.amount > 0) || cfg.allow_custom_amount;
  const cap = Number(eventData.guest_capacity || 0);
  const regCount = Number(eventData.guest_registered_count || 0);
  const spotsLeft = cap > 0 ? Math.max(0, cap - regCount) : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const isClosed = eventData.status === 'Closed' || eventData.is_open === false;
  const progressPct = cap > 0 ? Math.min(100, Math.round((regCount / cap) * 100)) : 0;

  const renderUnlockedAccessCard = (data: {
    lookup_code?: string;
    qr_payload?: string | null;
    qr_checked_in?: boolean;
    access_link_url?: string | null;
    access_link_label?: string | null;
    access_code?: string | null;
    access_instructions?: string | null;
    name?: string;
  }) => {
    const showQr =
      (cfg.unlock_mode === 'entry_pass_qr' || cfg.unlock_mode === 'both_link_and_qr') &&
      Boolean(data.qr_payload);
    const showLink =
      (cfg.unlock_mode === 'access_link' || cfg.unlock_mode === 'both_link_and_qr') &&
      Boolean(data.access_link_url);

    return (
      <div className="space-y-4">
        {showLink && data.access_link_url && (
          <div className="p-5 rounded-3xl bg-gradient-to-br from-emerald-50 to-teal-50 border-2 border-emerald-200 text-left space-y-3">
            <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase">
              <CheckCircle2 className="w-3 h-3" />
              <span>Access Unlocked</span>
            </div>
            <a
              href={data.access_link_url}
              target="_blank"
              rel="noopener noreferrer"
              className="w-full py-3 px-4 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs inline-flex items-center justify-center gap-2 shadow-sm"
            >
              <span>{data.access_link_label || cfg.access_link_label}</span>
              <ExternalLink className="w-4 h-4" />
            </a>
            {data.access_code && (
              <div className="p-3 rounded-xl bg-white border border-emerald-200 flex items-center justify-between gap-2 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase block">
                    Access Code / PIN
                  </span>
                  <span className="font-mono font-extrabold text-slate-900">{data.access_code}</span>
                </div>
                <button
                  type="button"
                  onClick={() => void handleCopy(data.access_code || '', 'access')}
                  className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 font-bold text-[11px] cursor-pointer"
                >
                  <KeyRound className="w-3 h-3 inline mr-1" />
                  {copiedAccess ? 'Copied!' : 'Copy'}
                </button>
              </div>
            )}
            {data.access_instructions && (
              <p className="text-xs text-slate-700 leading-relaxed whitespace-pre-line bg-white/80 rounded-xl p-3 border border-emerald-100">
                {data.access_instructions}
              </p>
            )}
          </div>
        )}

        {showQr && data.qr_payload && (
          <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-emerald-950 text-white max-w-sm mx-auto space-y-4 shadow-xl text-center">
            <span className="px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase">
              {data.qr_checked_in ? 'CHECKED IN ✓' : 'Guest Entry Pass QR'}
            </span>
            <div className="p-3 bg-white rounded-2xl inline-block">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
                  data.qr_payload
                )}`}
                alt="Guest Entry Pass QR"
                className="w-48 h-48 object-contain"
              />
            </div>
            <div className="text-xs">
              {data.name && <div className="font-extrabold">{data.name}</div>}
              <div className="font-mono text-emerald-300">{data.lookup_code}</div>
            </div>
            <button
              type="button"
              onClick={() =>
                void downloadFileFromUrl(
                  `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=15&data=${encodeURIComponent(
                    data.qr_payload || ''
                  )}`,
                  `Guest_Pass_${data.lookup_code || 'QR'}.png`
                )
              }
              className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download Entry Pass QR</span>
            </button>
          </div>
        )}

        {!showLink && !showQr && (
          <div className="p-6 rounded-3xl bg-emerald-50 border-2 border-emerald-200 text-center space-y-2 max-w-sm mx-auto">
            <CheckCircle2 className="w-10 h-10 text-emerald-600 mx-auto" />
            <div className="text-base font-extrabold text-emerald-950">
              Registration Confirmed &amp; Verified
            </div>
            <p className="text-xs text-emerald-800">
              Your registration reference code is{' '}
              <span className="font-mono font-extrabold">{data.lookup_code}</span>.
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-slate-50 text-slate-900">
      <NetworkStatusBanner
        networkError={loadError}
        onRetry={() => void loadEvent()}
        onReconnected={() => void loadEvent()}
      />
      {navigatingHome && (
        <div className="fixed top-0 inset-x-0 z-50 h-1 bg-emerald-100 overflow-hidden">
          <div className="h-full w-1/2 bg-emerald-600 animate-pulse rounded-r-full" />
        </div>
      )}
      {/* Top Branding Bar */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-emerald-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <Link
            href="/"
            onClick={() => setNavigatingHome(true)}
            title="Return to Main Homepage"
            className="flex items-center gap-3 min-w-0 group"
          >
            {logoUrl && !isPdfUrl(logoUrl) ? (
              <img
                src={logoUrl}
                alt={clubName}
                className="w-9 h-9 rounded-xl object-cover border border-emerald-200 bg-white shrink-0 group-hover:scale-105 transition-transform"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 group-hover:bg-emerald-700 transition-colors">
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-slate-900 group-hover:text-emerald-700 transition-colors truncate flex items-center gap-1.5">
                <span className="truncate">{clubName}</span>
                {navigatingHome && <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600 shrink-0" />}
              </div>
              <div className="text-[11px] text-slate-500 truncate">
                {navigatingHome ? 'Returning to main portal...' : 'Public Guest Event Portal'}
              </div>
            </div>
          </Link>
          <Link
            href="/"
            onClick={() => setNavigatingHome(true)}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold shrink-0 transition"
          >
            {navigatingHome ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-600" />
            ) : (
              <ArrowLeft className="w-3.5 h-3.5" />
            )}
            <span>{navigatingHome ? 'Returning...' : 'Back to Club Portal'}</span>
          </Link>
        </div>
      </header>

      {/* Main 2-Column Calm Layout */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Top Column: Event Info */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
                {eventData.category}
              </span>
              {cfg.format !== 'physical' && (
                <span className={`px-2.5 py-1 rounded-full border text-[11px] font-extrabold ${formatBadge.badgeClass}`}>
                  {formatBadge.label}
                </span>
              )}
            </div>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                isPaid
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-teal-50 text-teal-800 border border-teal-200'
              }`}
            >
              {cfg.fee_tiers.length > 0
                ? `From RM ${Math.min(...cfg.fee_tiers.map((t) => t.amount)).toFixed(2)}`
                : effFee > 0
                ? `Guest Fee: RM ${effFee.toFixed(2)}`
                : cfg.allow_custom_amount
                ? 'Custom RM Amount'
                : 'Free Admission'}
            </span>
          </div>

          <div className="space-y-2">
            <h1 className="text-2xl font-extrabold text-slate-900 leading-tight">
              {eventData.event_name}
            </h1>
            {isClosed && (
              <span className="inline-block px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 text-[11px] font-bold">
                Registration Closed
              </span>
            )}
            <p className="text-xs text-slate-600 leading-relaxed whitespace-pre-line">
              {eventData.description}
            </p>
          </div>

          <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200/80 space-y-2.5 text-xs text-slate-700">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{scheduleLabel}</span>
            </div>
            {eventData.event_time && (
              <div className="flex items-center gap-2.5">
                <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{eventData.event_time}</span>
              </div>
            )}
            {eventData.location && cfg.format !== 'self_paced' && cfg.format !== 'fee_collection' && (
              <div className="flex items-center gap-2.5">
                <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-semibold">{eventData.location}</span>
              </div>
            )}
          </div>

          {cap > 0 && (
            <div className="p-4 rounded-2xl bg-emerald-50/60 border border-emerald-200 space-y-2 text-xs">
              <div className="flex items-center justify-between font-bold">
                <span className="text-emerald-950">Guest Capacity</span>
                <span className={isFull ? 'text-rose-700' : 'text-emerald-800'}>
                  {isFull ? '0 spots left (Full)' : `${spotsLeft} of ${cap} spots remaining`}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-white border border-emerald-200 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isFull ? 'bg-rose-500' : 'bg-emerald-600'
                  }`}
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* Right/Main Card: Register | Check My Pass */}
        <section className="lg:col-span-7 bg-white rounded-3xl border border-emerald-100 shadow-lg overflow-hidden">
          <div className="grid grid-cols-2 bg-slate-100 p-1.5 border-b border-slate-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('register')}
              className={`py-2.5 rounded-2xl font-extrabold transition cursor-pointer ${
                activeTab === 'register'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Register
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('check')}
              className={`py-2.5 rounded-2xl font-extrabold transition cursor-pointer ${
                activeTab === 'check'
                  ? 'bg-emerald-600 text-white shadow-xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              Check My Status / Pass
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'register' ? (
              submissionResult?.ok ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1.5">
                    <span
                      className={`inline-block px-3 py-0.5 rounded-full text-[11px] font-extrabold ${
                        submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                          ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                          : 'bg-amber-100 text-amber-900 border border-amber-200'
                      }`}
                    >
                      {submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                        ? 'Confirmed Registration'
                        : 'Submitted — Pending Payment Verification'}
                    </span>
                    <h2 className="text-xl font-extrabold text-slate-900">
                      {submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                        ? 'Registration Confirmed!'
                        : 'Registration & Receipt Submitted!'}
                    </h2>
                    <p className="text-xs text-slate-600 max-w-md mx-auto">
                      You can check your registration status anytime under{' '}
                      <strong>&ldquo;Check My Status / Pass&rdquo;</strong> using your{' '}
                      <strong>Full Name, Email (Gmail), Matric / ID, or Lookup Code</strong>.
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-between gap-3 max-w-sm mx-auto">
                    <div className="text-left">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                        Your Lookup Code
                      </span>
                      <span className="text-xl font-mono font-extrabold text-emerald-950 tracking-wider">
                        {submissionResult.lookup_code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(submissionResult.lookup_code || '', 'code')
                      }
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>

                  {submissionResult.pass_approved || submissionResult.payment_status === 'Free' ? (
                    renderUnlockedAccessCard({
                      lookup_code: submissionResult.lookup_code,
                      qr_payload: submissionResult.qr_payload,
                      access_link_url: submissionResult.access_link_url,
                      access_link_label: submissionResult.access_link_label,
                      access_code: submissionResult.access_code,
                      access_instructions: submissionResult.access_instructions,
                      name: guestName,
                    })
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3 text-left">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="font-semibold leading-relaxed">
                          Your payment receipt for <strong>{eventData.event_name}</strong> has been
                          submitted. Check back anytime using your <strong>Name, Email, Matric/ID</strong>,
                          or code{' '}
                          <span className="font-mono font-extrabold">
                            {submissionResult.lookup_code}
                          </span>{' '}
                          once verified by our club treasurer!
                        </p>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveTab('check');
                          if (submissionResult.lookup_code) {
                            void runPassLookup(submissionResult.lookup_code);
                          }
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Check My Status →
                      </button>
                    </div>
                  )}
                </div>
              ) : isClosed || isFull ? (
                <div className="py-8 text-center space-y-3 text-xs">
                  <Lock className="w-10 h-10 text-amber-500 mx-auto" />
                  <h3 className="text-base font-extrabold text-slate-900">
                    {isClosed ? 'Registration Closed' : 'Event Capacity Reached'}
                  </h3>
                  <p className="text-slate-500 max-w-sm mx-auto">
                    {isClosed
                      ? 'This activity is no longer accepting new guest sign-ups.'
                      : 'All guest registration spots for this activity have been filled.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('check')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    Already registered? Check Status →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRegistration} className="space-y-4 text-xs">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Guest Registration Form
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      No club account needed. Your status &amp; confirmation will be tied to your lookup code.
                    </p>
                  </div>

                  {formError && (
                    <div className="flex items-center gap-2 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{formError}</span>
                    </div>
                  )}

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Full Name *
                      </label>
                      <input
                        type="text"
                        value={guestName}
                        onChange={(e) => setGuestName(e.target.value)}
                        placeholder="e.g., Aiman Hakim"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Institution / Matric No
                      </label>
                      <input
                        type="text"
                        value={institution}
                        onChange={(e) => setInstitution(e.target.value)}
                        placeholder="e.g., UTM / UTHM / Public"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        Email Address *
                      </label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        WhatsApp Phone *
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="012-3456789"
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono"
                        required
                      />
                    </div>
                  </div>

                  {cfg.registration_prompt && (
                    <div>
                      <label className="block font-bold text-slate-700 mb-1">
                        {cfg.registration_prompt} *
                      </label>
                      <input
                        type="text"
                        value={registrationNote}
                        onChange={(e) => setRegistrationNote(e.target.value)}
                        placeholder={`Enter ${cfg.registration_prompt}`}
                        className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm"
                        required
                      />
                    </div>
                  )}

                  {isPaid && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-emerald-950 text-sm">
                          Fee Payment
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Upload receipt to submit
                        </span>
                      </div>

                      {cfg.fee_tiers.length > 0 && (
                        <div className="space-y-1.5">
                          <label className="block font-bold text-slate-700">
                            Select Option / Tier
                          </label>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            {cfg.fee_tiers.map((t) => {
                              const active = selectedTierName === t.name;
                              return (
                                <button
                                  key={t.id}
                                  type="button"
                                  onClick={() => {
                                    setSelectedTierName(t.name);
                                    if (!cfg.allow_custom_amount) {
                                      setAmountPaid(t.amount.toFixed(2));
                                    }
                                  }}
                                  className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                                    active
                                      ? 'border-emerald-600 bg-emerald-50 ring-1 ring-emerald-500'
                                      : 'border-slate-200 bg-white hover:border-slate-300'
                                  }`}
                                >
                                  <div className="flex items-center justify-between gap-2 font-extrabold text-slate-900">
                                    <span>{t.name}</span>
                                    <span className="text-emerald-700">RM {t.amount.toFixed(2)}</span>
                                  </div>
                                  {t.description && (
                                    <p className="text-[11px] text-slate-500 mt-0.5">{t.description}</p>
                                  )}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {eventData.show_payment_qr &&
                        (eventData.payment_qr_url || eventData.payment_bank_info) && (
                          <div className="p-4 rounded-2xl bg-white border border-emerald-200 space-y-3 text-center">
                            <span className="inline-block px-3 py-0.5 rounded-full bg-emerald-600 text-white text-[10px] font-extrabold uppercase">
                              DuitNow / Bank Transfer Details
                            </span>

                            {eventData.payment_qr_url &&
                              (isPdfUrl(eventData.payment_qr_url) ? (
                                <div className="space-y-2">
                                  <FileText className="w-10 h-10 text-emerald-700 mx-auto" />
                                  <div className="flex justify-center gap-2">
                                    <button
                                      type="button"
                                      onClick={() =>
                                        void downloadFileFromUrl(
                                          eventData.payment_qr_url || '',
                                          `${eventData.event_name || 'Event'}_Payment_QR.pdf`
                                        )
                                      }
                                      className="px-3 py-1.5 rounded-xl bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                                    >
                                      <Download className="w-3.5 h-3.5 inline mr-1" />
                                      Download QR PDF
                                    </button>
                                    <a
                                      href={eventData.payment_qr_url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-3 py-1.5 rounded-xl bg-slate-100 text-slate-800 font-bold text-[11px]"
                                    >
                                      Open <ExternalLink className="w-3 h-3 inline ml-0.5" />
                                    </a>
                                  </div>
                                </div>
                              ) : (
                                <div className="space-y-2">
                                  <img
                                    src={eventData.payment_qr_url}
                                    alt="Payment QR"
                                    className="w-44 h-44 object-contain mx-auto rounded-xl border p-1.5 bg-white"
                                  />
                                  <button
                                    type="button"
                                    onClick={() =>
                                      void downloadFileFromUrl(
                                        eventData.payment_qr_url || '',
                                        `${eventData.event_name || 'Event'}_Payment_QR.png`
                                      )
                                    }
                                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    <Download className="w-3.5 h-3.5" />
                                    <span>Download QR</span>
                                  </button>
                                </div>
                              ))}

                            {eventData.payment_bank_info && (
                              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-left">
                                <span className="font-mono font-bold text-slate-900 break-all">
                                  {eventData.payment_bank_info}
                                </span>
                                <button
                                  type="button"
                                  onClick={() =>
                                    void handleCopy(eventData.payment_bank_info || '', 'bank')
                                  }
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                                >
                                  <Copy className="w-3 h-3 inline mr-0.5" />
                                  {copiedBank ? 'Copied' : 'Copy'}
                                </button>
                              </div>
                            )}
                          </div>
                        )}

                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Amount Paid (RM) *
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={amountPaid}
                          onChange={(e) => setAmountPaid(e.target.value)}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                          required
                        />
                      </div>

                      <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-white hover:bg-emerald-50/50 cursor-pointer text-center transition">
                        <UploadCloud className="w-6 h-6 text-emerald-600" />
                        <div className="font-bold text-slate-800 break-all">
                          {receiptFile
                            ? receiptFile.name
                            : 'Upload Payment Receipt (JPG, PNG, PDF)'}
                        </div>
                        <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
                          {receiptFile ? 'Change File' : 'Choose Receipt'}
                        </span>
                        <input
                          type="file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            setReceiptFile(e.target.files?.[0] || null);
                            setFormError(null);
                          }}
                          className="hidden"
                        />
                      </label>
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={submitting}
                    className="w-full py-3 rounded-2xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-sm inline-flex items-center justify-center gap-2 shadow-sm cursor-pointer disabled:opacity-60"
                  >
                    {submitting ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <CheckCircle2 className="w-4 h-4" />
                    )}
                    <span>
                      {submitting
                        ? 'Submitting Registration...'
                        : isPaid
                        ? 'Submit Registration & Receipt'
                        : 'Complete Free Registration'}
                    </span>
                  </button>
                </form>
              )
            ) : (
              <div className="space-y-5 text-xs">
                <div>
                  <h2 className="text-base font-extrabold text-slate-900">
                    Check My Registration Status / Pass
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enter your <strong>Full Name</strong>, <strong>Email (Gmail)</strong>,{' '}
                    <strong>Matric / ID</strong>, or <strong>Lookup Code</strong> (
                    <span className="font-mono">GST-XXXXXX</span>) to verify your registration and
                    view event details.
                  </p>
                </div>

                <form onSubmit={handleCheckPass} className="flex flex-col sm:flex-row gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      placeholder="Full Name, Email (Gmail), Matric No, or GST-XXXXXX"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 text-sm font-medium"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={checkingPass}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer shrink-0 inline-flex items-center justify-center gap-1.5"
                  >
                    {checkingPass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Check Status</span>
                  </button>
                </form>

                {passSearchAttempted && !checkingPass && passResult?.multiple_matches && (
                  <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 space-y-1.5">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <AlertCircle className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        Multiple registrations ({passResult.match_count || '2+'}) matched that search
                      </span>
                    </div>
                    <p className="text-[11px] leading-relaxed text-amber-900">
                      To protect participant privacy, please refine your search by entering your exact{' '}
                      <strong>Email (Gmail)</strong>, <strong>Matric / ID</strong>, or{' '}
                      <strong>Lookup Code</strong> (<span className="font-mono">GST-XXXXXX</span>).
                    </p>
                  </div>
                )}

                {passSearchAttempted &&
                  !checkingPass &&
                  !passResult?.found &&
                  !passResult?.multiple_matches && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-1 text-slate-600">
                      <div className="font-bold text-slate-800">Registration Not Found</div>
                      <p className="text-[11px] text-slate-500">
                        No registration matched that Name, Email, Matric/ID, or Lookup Code for this
                        event. Check your spelling or register under the Register tab.
                      </p>
                    </div>
                  )}

                {passResult?.found &&
                  (() => {
                    const evCfg = resolveActivityConfig({
                      event_date: passResult.event_date || eventData.event_date,
                      end_date: passResult.end_date ?? eventData.end_date,
                      registration_fee:
                        eventData.effective_fee ?? eventData.guest_fee ?? eventData.registration_fee,
                      activity_config: passResult.activity_config ?? eventData.activity_config,
                    });
                    const evName = passResult.event_name || eventData.event_name || 'Activity';
                    const evSchedule = formatActivitySchedule(
                      { event_date: passResult.event_date || eventData.event_date },
                      evCfg
                    );
                    const evTime = passResult.event_time ?? eventData.event_time;
                    const evLocation = passResult.location ?? eventData.location;
                    const evDesc = passResult.description ?? eventData.description;
                    const evClub = passResult.club_name || clubName;
                    const evFormat = getFormatBadgeMeta(evCfg.format);
                    const isConfirmedOrVerified =
                      passResult.pass_approved ||
                      passResult.payment_status === 'Verified' ||
                      passResult.payment_status === 'Free';
                    const paidNum = Number(passResult.amount_paid || 0);

                    return (
                      <div className="p-5 rounded-3xl border border-emerald-200 bg-slate-50/70 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="space-y-1 min-w-0">
                            <div className="text-base font-extrabold text-slate-900">
                              {passResult.guest_name}
                            </div>
                            <div className="font-mono text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
                              <span>{passResult.lookup_code}</span>
                              {passResult.institution_or_matric && (
                                <span>· {passResult.institution_or_matric}</span>
                              )}
                              {passResult.masked_email && <span>· {passResult.masked_email}</span>}
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 pt-0.5 text-[11px]">
                              <span className="px-2 py-0.5 rounded-md bg-white border border-slate-200 font-bold text-slate-700">
                                {paidNum > 0 ? `Paid RM ${paidNum.toFixed(2)}` : 'Free Admission'}
                              </span>
                              {passResult.selected_tier && (
                                <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 font-bold text-emerald-800">
                                  {passResult.selected_tier}
                                </span>
                              )}
                            </div>
                          </div>

                          <span
                            className={`px-3 py-1 rounded-full font-extrabold text-[11px] shrink-0 ${
                              isConfirmedOrVerified
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : passResult.payment_status === 'Rejected'
                                ? 'bg-rose-100 text-rose-700 border border-rose-200'
                                : 'bg-amber-100 text-amber-900 border border-amber-200'
                            }`}
                          >
                            {passResult.payment_status === 'Verified'
                              ? 'Registered · Verified ✓'
                              : passResult.payment_status === 'Free'
                              ? 'Registered · Confirmed ✓'
                              : passResult.payment_status === 'Rejected'
                              ? 'Rejected'
                              : 'Registered · Pending Verification'}
                          </span>
                        </div>

                        {/* Event Details Synced From Live Event Record */}
                        <div className="p-4 rounded-2xl bg-white border border-slate-200/90 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700">
                              Registered Event Details · {evClub}
                            </span>
                            {evCfg.format !== 'physical' && (
                              <span
                                className={`px-2 py-0.5 rounded-full border text-[10px] font-extrabold ${evFormat.badgeClass}`}
                              >
                                {evFormat.label}
                              </span>
                            )}
                          </div>
                          <div className="text-sm font-extrabold text-slate-900">{evName}</div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-[11px] text-slate-600 pt-0.5">
                            <div className="flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                              <span className="font-semibold">{evSchedule}</span>
                            </div>
                            {evTime && (
                              <div className="flex items-center gap-1.5">
                                <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                <span className="font-semibold">{evTime}</span>
                              </div>
                            )}
                            {evLocation &&
                              evCfg.format !== 'self_paced' &&
                              evCfg.format !== 'fee_collection' && (
                                <div className="flex items-center gap-1.5 sm:col-span-2">
                                  <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                                  <span className="font-semibold">{evLocation}</span>
                                </div>
                              )}
                          </div>
                          {evDesc && (
                            <p className="text-[11px] text-slate-500 leading-relaxed whitespace-pre-line pt-1 border-t border-slate-100">
                              {evDesc}
                            </p>
                          )}
                        </div>

                        {isConfirmedOrVerified ? (
                          renderUnlockedAccessCard({
                            lookup_code: passResult.lookup_code,
                            qr_payload: passResult.qr_payload,
                            qr_checked_in: passResult.qr_checked_in,
                            access_link_url: passResult.access_link_url,
                            access_link_label: passResult.access_link_label,
                            access_code: passResult.access_code,
                            access_instructions: passResult.access_instructions,
                            name: passResult.guest_name,
                          })
                        ) : passResult.payment_status === 'Rejected' ? (
                          <div className="p-3.5 rounded-2xl bg-rose-50 border border-rose-200 text-rose-800 flex items-center gap-2 font-semibold">
                            <XCircle className="w-4 h-4 shrink-0" />
                            <span>
                              Your fee receipt could not be verified. Please contact the club treasurer or register again with a valid slip.
                            </span>
                          </div>
                        ) : (
                          <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 flex items-center gap-2 font-semibold">
                            <Lock className="w-4 h-4 text-amber-600 shrink-0" />
                            <span>
                              Your registration is recorded! Payment verification is still pending — once verified by the treasurer, your pass or access link will unlock right here.
                            </span>
                          </div>
                        )}
                      </div>
                    );
                  })()}
              </div>
            )}
          </div>
        </section>
      </main>

      {/* Post-Registration Pop-Out Confirmation Notice Modal */}
      {confirmationModalOpen &&
        submissionResult?.ok &&
        typeof document !== 'undefined' &&
        createPortal(
          <div
            onClick={() => setConfirmationModalOpen(false)}
            className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
            role="dialog"
            aria-modal="true"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="bg-white text-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200"
            >
              <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-6 py-4 flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-white/15 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-emerald-200" />
                  </div>
                  <div>
                    <h3 className="text-sm font-extrabold">
                      {submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                        ? 'Registration Confirmed!'
                        : 'Registration Submitted!'}
                    </h3>
                    <p className="text-[11px] text-emerald-100">{clubName}</p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setConfirmationModalOpen(false)}
                  className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="p-6 space-y-4 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm text-slate-900">{guestName}</div>
                    <div className="text-[11px] text-slate-500">
                      {email}
                      {institution ? ` · ${institution}` : ''}
                    </div>
                  </div>
                  <span
                    className={`px-2.5 py-1 rounded-full font-extrabold text-[10px] ${
                      submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                        ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                        : 'bg-amber-100 text-amber-900 border border-amber-200'
                    }`}
                  >
                    {submissionResult.pass_approved || submissionResult.payment_status === 'Free'
                      ? 'Confirmed ✓'
                      : 'Pending Payment Verification'}
                  </span>
                </div>

                {submissionResult.lookup_code && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border-2 border-emerald-200 flex items-center justify-between gap-3">
                    <div>
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                        Your Lookup Code
                      </span>
                      <span className="text-lg font-mono font-extrabold text-emerald-950 tracking-wider">
                        {submissionResult.lookup_code}
                      </span>
                    </div>
                    <button
                      type="button"
                      onClick={() =>
                        void handleCopy(submissionResult.lookup_code || '', 'code')
                      }
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5" />
                      <span>{copiedCode ? 'Copied!' : 'Copy'}</span>
                    </button>
                  </div>
                )}

                <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-1.5">
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-slate-400">
                    Event Details
                  </div>
                  <div className="text-sm font-extrabold text-slate-900">
                    {eventData.event_name}
                  </div>
                  <div className="text-[11px] text-slate-600 space-y-1">
                    <div className="flex items-center gap-1.5">
                      <Calendar className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                      <span>{scheduleLabel}</span>
                    </div>
                    {eventData.event_time && (
                      <div className="flex items-center gap-1.5">
                        <Clock className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>{eventData.event_time}</span>
                      </div>
                    )}
                    {eventData.location &&
                      cfg.format !== 'self_paced' &&
                      cfg.format !== 'fee_collection' && (
                        <div className="flex items-center gap-1.5">
                          <MapPin className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                          <span>{eventData.location}</span>
                        </div>
                      )}
                  </div>
                </div>

                <p className="text-[11px] text-slate-600 leading-relaxed bg-emerald-50/50 border border-emerald-100 rounded-xl p-3">
                  You can check your status anytime using your{' '}
                  <strong>Full Name, Email (Gmail), Matric / ID, or Lookup Code</strong> under{' '}
                  <strong>Check My Status / Pass</strong>.
                </p>

                <div className="flex flex-col sm:flex-row gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setConfirmationModalOpen(false);
                      setActiveTab('check');
                      if (submissionResult.lookup_code) {
                        void runPassLookup(submissionResult.lookup_code);
                      }
                    }}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer text-center"
                  >
                    Check My Status Now →
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmationModalOpen(false)}
                    className="px-4 py-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
                  >
                    Close
                  </button>
                </div>
              </div>
            </div>
          </div>,
          document.body
        )}
    </div>
  );
}
