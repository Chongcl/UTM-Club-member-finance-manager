'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import {
  supabase,
  isSupabaseConfigured,
  MAX_FILE_SIZE_BYTES,
  downloadFileFromUrl,
} from '@/lib/supabase';
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
} from 'lucide-react';

interface PublicEventPayload {
  found: boolean;
  id?: string;
  event_name?: string;
  category?: string;
  event_date?: string;
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
}

interface GuestPassStatusResult {
  found: boolean;
  id?: string;
  guest_name?: string;
  institution_or_matric?: string;
  lookup_code?: string;
  payment_status?: 'Free' | 'Pending' | 'Verified' | 'Rejected';
  pass_approved?: boolean;
  qr_checked_in?: boolean;
  qr_checked_in_at?: string | null;
  amount_paid?: number;
  event_id?: string;
  event_name?: string;
  event_date?: string;
  event_time?: string;
  location?: string;
  qr_payload?: string | null;
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
  const [eventData, setEventData] = useState<PublicEventPayload | null>(null);
  const [activeTab, setActiveTab] = useState<'register' | 'check'>('register');

  // Registration form
  const [guestName, setGuestName] = useState('');
  const [institution, setInstitution] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [amountPaid, setAmountPaid] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<GuestSubmissionResult | null>(null);
  const [copiedCode, setCopiedCode] = useState(false);
  const [copiedBank, setCopiedBank] = useState(false);

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
    try {
      const { data, error } = await supabase.rpc('get_public_event_by_slug', {
        p_slug: slug,
      });
      if (error || !data) {
        setEventData({ found: false });
      } else {
        const payload = data as PublicEventPayload;
        setEventData(payload);
        const effFee = Number(payload.effective_fee ?? payload.guest_fee ?? payload.registration_fee ?? 0);
        setAmountPaid(effFee > 0 ? effFee.toFixed(2) : '0');
      }
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    void loadEvent();
  }, [loadEvent]);

  const handleCopy = async (text: string, which: 'code' | 'bank') => {
    try {
      await navigator.clipboard.writeText(text);
      if (which === 'code') {
        setCopiedCode(true);
        setTimeout(() => setCopiedCode(false), 2000);
      } else {
        setCopiedBank(true);
        setTimeout(() => setCopiedBank(false), 2000);
      }
    } catch {
      /* ignore clipboard error */
    }
  };

  const handleSubmitRegistration = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eventData?.found || !eventData.id) return;
    setFormError(null);

    if (!guestName.trim() || !email.trim() || !phone.trim()) {
      setFormError('Please enter your full name, email address, and WhatsApp phone number.');
      return;
    }

    const effFee = Number(eventData.effective_fee ?? 0);
    const isPaid = effFee > 0;
    const numAmt = isPaid ? parseFloat(amountPaid) || effFee : 0;

    if (isPaid && !receiptFile) {
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
      if (isPaid && receiptFile) {
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

      const { data, error: rpcErr } = await supabase.rpc('submit_guest_registration', {
        p_slug: slug,
        p_name: guestName.trim(),
        p_institution: institution.trim(),
        p_email: email.trim(),
        p_phone: phone.trim(),
        p_amount: numAmt,
        p_receipt_url: receiptUrl,
        p_receipt_name: receiptName,
      });

      if (rpcErr) {
        throw new Error(rpcErr.message || 'Registration failed.');
      }

      const res = data as GuestSubmissionResult;
      if (!res?.ok) {
        setFormError(res?.error || 'Could not complete registration.');
        return;
      }

      setSubmissionResult(res);
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
    const clean = queryText.trim();
    if (!clean) return;
    setCheckingPass(true);
    setPassSearchAttempted(true);
    try {
      const { data, error } = await supabase.rpc('check_guest_registration_status', {
        p_slug: slug,
        p_lookup_or_email: clean,
      });
      if (error || !data) {
        setPassResult({ found: false });
      } else {
        setPassResult(data as GuestPassStatusResult);
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

  if (!eventData?.found) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-emerald-50 via-white to-slate-100 p-4">
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
            className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Club Portal</span>
          </Link>
        </div>
      </div>
    );
  }

  const clubName = eventData.club_name || 'ClubSync';
  const logoUrl = eventData.logo_url || '';
  const effFee = Number(eventData.effective_fee ?? 0);
  const isPaid = effFee > 0;
  const cap = Number(eventData.guest_capacity || 0);
  const regCount = Number(eventData.guest_registered_count || 0);
  const spotsLeft = cap > 0 ? Math.max(0, cap - regCount) : null;
  const isFull = spotsLeft !== null && spotsLeft <= 0;
  const isClosed = eventData.status === 'Closed' || eventData.is_open === false;
  const progressPct = cap > 0 ? Math.min(100, Math.round((regCount / cap) * 100)) : 0;

  return (
    <div className="min-h-screen bg-gradient-to-b from-emerald-50/80 via-white to-slate-50 text-slate-900">
      {/* Top Branding Bar */}
      <header className="bg-white/90 backdrop-blur-xl border-b border-emerald-100 sticky top-0 z-20">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            {logoUrl && !isPdfUrl(logoUrl) ? (
              <img
                src={logoUrl}
                alt={clubName}
                className="w-9 h-9 rounded-xl object-cover border border-emerald-200 bg-white shrink-0"
              />
            ) : (
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                <Layers className="w-5 h-5" />
              </div>
            )}
            <div className="min-w-0">
              <div className="font-extrabold text-sm text-slate-900 truncate">{clubName}</div>
              <div className="text-[11px] text-slate-500 truncate">Public Guest Event Portal</div>
            </div>
          </div>

          <Link
            href="/"
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-bold shrink-0 transition"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Back to Club Portal</span>
          </Link>
        </div>
      </header>

      {/* Main 2-Column Calm Layout */}
      <main className="max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-10 grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left/Top Column: Event Info */}
        <section className="lg:col-span-5 bg-white rounded-3xl border border-emerald-100 shadow-sm p-6 space-y-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-extrabold">
              {eventData.category}
            </span>
            <span
              className={`px-3 py-1 rounded-full text-xs font-extrabold ${
                isPaid
                  ? 'bg-amber-50 text-amber-900 border border-amber-200'
                  : 'bg-teal-50 text-teal-800 border border-teal-200'
              }`}
            >
              {isPaid ? `Guest Fee: RM ${effFee.toFixed(2)}` : 'Free Admission'}
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
              <span className="font-semibold">{eventData.event_date}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{eventData.event_time}</span>
            </div>
            <div className="flex items-center gap-2.5">
              <MapPin className="w-4 h-4 text-emerald-600 shrink-0" />
              <span className="font-semibold">{eventData.location}</span>
            </div>
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
              Check My Pass
            </button>
          </div>

          <div className="p-6">
            {activeTab === 'register' ? (
              submissionResult?.ok ? (
                <div className="space-y-5 text-center">
                  <div className="w-14 h-14 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center mx-auto">
                    <CheckCircle2 className="w-8 h-8" />
                  </div>
                  <div className="space-y-1">
                    <h2 className="text-xl font-extrabold text-slate-900">
                      Registration Received!
                    </h2>
                    <p className="text-xs text-slate-600">
                      Save your lookup code below to check your pass anytime.
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

                  {submissionResult.pass_approved && submissionResult.qr_payload ? (
                    <div className="p-6 rounded-3xl bg-gradient-to-b from-slate-900 to-emerald-950 text-white max-w-sm mx-auto space-y-4 shadow-xl">
                      <span className="px-3 py-0.5 rounded-full bg-emerald-500 text-slate-950 text-[10px] font-extrabold uppercase">
                        Guest Entry Pass QR
                      </span>
                      <div className="p-3 bg-white rounded-2xl inline-block">
                        <img
                          src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
                            submissionResult.qr_payload
                          )}`}
                          alt="Guest Entry Pass QR"
                          className="w-48 h-48 object-contain"
                        />
                      </div>
                      <div className="text-xs">
                        <div className="font-extrabold">{guestName}</div>
                        <div className="font-mono text-emerald-300">
                          {submissionResult.lookup_code}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          void downloadFileFromUrl(
                            `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=15&data=${encodeURIComponent(
                              submissionResult.qr_payload || ''
                            )}`,
                            `Guest_Pass_${submissionResult.lookup_code || 'QR'}.png`
                          )
                        }
                        className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 text-xs font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Download className="w-4 h-4" />
                        <span>Download Entry Pass QR</span>
                      </button>
                    </div>
                  ) : (
                    <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-950 text-xs space-y-3 text-left">
                      <div className="flex items-start gap-2.5">
                        <Lock className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" />
                        <p className="font-semibold leading-relaxed">
                          Receipt submitted — check back anytime under{' '}
                          <strong>&ldquo;Check My Pass&rdquo;</strong> with code{' '}
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
                        Go to Check My Pass →
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
                      ? 'This event is no longer accepting new guest sign-ups.'
                      : 'All guest registration spots for this event have been filled.'}
                  </p>
                  <button
                    type="button"
                    onClick={() => setActiveTab('check')}
                    className="px-4 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                  >
                    Already registered? Check My Pass →
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmitRegistration} className="space-y-4 text-xs">
                  <div>
                    <h2 className="text-base font-extrabold text-slate-900">
                      Guest Registration Form
                    </h2>
                    <p className="text-[11px] text-slate-500 mt-0.5">
                      No club account needed. Your digital pass QR will be tied to your lookup code.
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

                  {isPaid && (
                    <div className="p-4 rounded-2xl bg-slate-50 border border-emerald-200 space-y-3.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-emerald-950 text-sm">
                          Fee Payment (RM {effFee.toFixed(2)})
                        </span>
                        <span className="text-[11px] font-semibold text-emerald-800">
                          Upload receipt to submit
                        </span>
                      </div>

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
                          min="0.01"
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
                    Check Your Entry Pass Status
                  </h2>
                  <p className="text-[11px] text-slate-500 mt-0.5">
                    Enter your Lookup Code (e.g., <span className="font-mono">GST-XXXXXX</span>) or registration Email.
                  </p>
                </div>

                <form onSubmit={handleCheckPass} className="flex gap-2">
                  <div className="relative flex-1">
                    <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={lookupInput}
                      onChange={(e) => setLookupInput(e.target.value)}
                      placeholder="GST-XXXXXX or email@example.com"
                      className="w-full rounded-xl border border-slate-300 pl-9 pr-3 py-2.5 text-sm font-medium"
                      required
                    />
                  </div>
                  <button
                    type="submit"
                    disabled={checkingPass}
                    className="px-5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer shrink-0 inline-flex items-center gap-1.5"
                  >
                    {checkingPass && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                    <span>Check</span>
                  </button>
                </form>

                {passSearchAttempted && !checkingPass && !passResult?.found && (
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center text-slate-500">
                    No guest registration matched that Lookup Code or Email for this event.
                  </div>
                )}

                {passResult?.found && (
                  <div className="p-5 rounded-3xl border border-emerald-200 bg-slate-50/70 space-y-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div>
                        <div className="text-base font-extrabold text-slate-900">
                          {passResult.guest_name}
                        </div>
                        <div className="font-mono text-[11px] text-slate-500">
                          {passResult.lookup_code}
                          {passResult.institution_or_matric
                            ? ` · ${passResult.institution_or_matric}`
                            : ''}
                        </div>
                      </div>
                      <span
                        className={`px-3 py-1 rounded-full font-extrabold text-[11px] ${
                          passResult.payment_status === 'Verified' ||
                          passResult.payment_status === 'Free'
                            ? 'bg-emerald-100 text-emerald-800'
                            : passResult.payment_status === 'Rejected'
                            ? 'bg-rose-100 text-rose-700'
                            : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        {passResult.payment_status === 'Verified'
                          ? 'Verified ✓'
                          : passResult.payment_status}
                      </span>
                    </div>

                    {passResult.pass_approved && passResult.qr_payload ? (
                      <div className="p-5 rounded-3xl bg-gradient-to-b from-slate-900 to-emerald-950 text-white text-center space-y-3">
                        <div className="flex items-center justify-center gap-1.5 text-emerald-300 text-xs font-extrabold">
                          <ShieldCheck className="w-4 h-4" />
                          <span>
                            {passResult.qr_checked_in ? 'CHECKED IN ✓' : 'ENTRY PASS UNLOCKED'}
                          </span>
                        </div>
                        <div className="p-3 bg-white rounded-2xl inline-block">
                          <img
                            src={`https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(
                              passResult.qr_payload
                            )}`}
                            alt="Guest Entry Pass QR"
                            className="w-48 h-48 object-contain"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() =>
                            void downloadFileFromUrl(
                              `https://api.qrserver.com/v1/create-qr-code/?size=500x500&margin=15&data=${encodeURIComponent(
                                passResult.qr_payload || ''
                              )}`,
                              `Guest_Pass_${passResult.lookup_code || 'QR'}.png`
                            )
                          }
                          className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold inline-flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <Download className="w-4 h-4" />
                          <span>Download Entry Pass QR</span>
                        </button>
                      </div>
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
                          Payment verification is still pending. Once the treasurer verifies your receipt, your Guest Entry Pass QR will appear right here!
                        </span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </section>
      </main>
    </div>
  );
}
