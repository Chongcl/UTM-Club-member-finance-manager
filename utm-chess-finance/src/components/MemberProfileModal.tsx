'use client';

import React, { useEffect, useMemo, useState } from 'react';
import {
  ActivityFeePayment,
  Budget,
  ChatDirectoryMember,
  Claim,
  EquipmentLoan,
  EventRsvp,
  UserProfile,
  supabase,
} from '@/lib/supabase';
import {
  BadgeCheck,
  Building2,
  Calendar,
  Check,
  Copy,
  CreditCard,
  Download,
  ExternalLink,
  Eye,
  EyeOff,
  GraduationCap,
  Home,
  IdCard,
  Loader2,
  Lock,
  Mail,
  MapPin,
  MessageCircle,
  Package,
  Phone,
  QrCode,
  Receipt,
  Shield,
  ShieldAlert,
  User,
  Wallet,
  X,
} from 'lucide-react';
import ModalShell from './ui/ModalShell';

interface MemberProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
  member: ChatDirectoryMember | UserProfile | null;
  viewerProfile: UserProfile;
  canViewSensitiveProfiles: boolean;
  isViewerAdmin?: boolean;
  claims?: Claim[];
  equipmentLoans?: EquipmentLoan[];
  feePayments?: ActivityFeePayment[];
  eventRsvps?: EventRsvp[];
  budgets?: Budget[];
  onMessageInChat?: (memberId: string) => void;
}

function getInitials(name?: string | null): string {
  const parts = (name || 'U').trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'U';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

function maskIcNumber(ic?: string | null): string {
  const clean = (ic || '').trim();
  if (!clean) return 'Not provided';
  if (clean.length <= 4) return '••••';
  const tail = clean.slice(-4);
  return `${'•'.repeat(Math.max(6, clean.length - 4))}${tail}`;
}

function formatRoleLabel(role?: string | null): string {
  if (role === 'owner') return 'Club Owner';
  if (role === 'treasurer') return 'High-Com / Admin';
  return 'Member';
}

function formatDateDisplay(value?: string | null): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-MY', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

export default function MemberProfileModal({
  isOpen,
  onClose,
  member,
  viewerProfile,
  canViewSensitiveProfiles,
  isViewerAdmin = false,
  claims = [],
  equipmentLoans = [],
  feePayments = [],
  eventRsvps = [],
  budgets = [],
  onMessageInChat,
}: MemberProfileModalProps) {
  const [fullDetails, setFullDetails] = useState<Partial<UserProfile> | null>(null);
  const [loadingFull, setLoadingFull] = useState(false);
  const [icRevealed, setIcRevealed] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [loadingWa, setLoadingWa] = useState(false);
  const [waError, setWaError] = useState('');
  const [qrExpanded, setQrExpanded] = useState(false);

  const isSelf = Boolean(member && member.id === viewerProfile.id);
  const showSensitive = Boolean(canViewSensitiveProfiles || isSelf);

  useEffect(() => {
    if (!isOpen || !member) {
      setFullDetails(null);
      setIcRevealed(false);
      setCopiedKey(null);
      setWaError('');
      setQrExpanded(false);
      return;
    }

    setIcRevealed(false);
    setWaError('');
    setQrExpanded(false);

    if (!showSensitive) {
      setFullDetails(null);
      setLoadingFull(false);
      return;
    }

    const existing = member as Partial<UserProfile>;
    if (isSelf) {
      setFullDetails(viewerProfile);
      setLoadingFull(false);
      return;
    }

    // If full profile came from `users` table directly, keep immediately while refreshing via RPC if missing
    if (
      existing.email !== undefined ||
      existing.ic_no !== undefined ||
      existing.phone_number !== undefined
    ) {
      setFullDetails(existing);
    }

    let cancelled = false;
    setLoadingFull(true);
    supabase
      .rpc('get_member_full_profile', { target_user_id: member.id })
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (!error && data) {
          setFullDetails(data as Partial<UserProfile>);
        }
        setLoadingFull(false);
      });

    return () => {
      cancelled = true;
    };
  }, [isOpen, member, showSensitive, isSelf, viewerProfile]);

  const activitySnapshot = useMemo(() => {
    if (!member || !showSensitive) return null;

    const memberMatric = (member.matric_no || '').trim().toUpperCase();
    const matchesMember = (uid?: string | null, matric?: string | null) =>
      Boolean(
        (uid && uid === member.id) ||
          (memberMatric && matric && matric.trim().toUpperCase() === memberMatric),
      );

    const memberClaims = claims.filter(
      (c) => !c.deleted_at && matchesMember(c.user_id, c.matric_no),
    );
    const approvedClaimsTotal = memberClaims
      .filter((c) => c.status === 'Approved')
      .reduce((sum, c) => sum + Number(c.amount || 0), 0);
    const pendingClaimsCount = memberClaims.filter((c) => c.status === 'Pending').length;

    const memberLoans = equipmentLoans.filter(
      (l) => !l.deleted_at && matchesMember(l.user_id, l.matric_no),
    );
    const activeLoans = memberLoans.filter(
      (l) => l.status === 'Borrowed' || l.status === 'Overdue',
    );
    const overdueLoansCount = activeLoans.filter((l) => l.status === 'Overdue').length;

    const attendingRsvps = eventRsvps.filter(
      (r) =>
        !r.deleted_at &&
        r.attendance === 'Attending' &&
        matchesMember(r.user_id, r.matric_no),
    );
    const checkedInCount = attendingRsvps.filter((r) => Boolean(r.qr_checked_in)).length;

    const activeBudgetMap = new Map(
      budgets.filter((b) => !b.deleted_at).map((b) => [b.id, b]),
    );
    let unpaidFeesCount = 0;
    let unpaidFeesTotal = 0;
    attendingRsvps.forEach((rsvp) => {
      const budget = activeBudgetMap.get(rsvp.budget_id);
      if (!budget || Number(budget.registration_fee || 0) <= 0) return;
      const paid = feePayments.some(
        (f) =>
          !f.deleted_at &&
          f.budget_id === budget.id &&
          (f.status === 'Verified' || f.status === 'Pending') &&
          matchesMember(f.user_id, f.matric_no),
      );
      if (!paid) {
        unpaidFeesCount += 1;
        unpaidFeesTotal += Number(budget.registration_fee || 0);
      }
    });

    return {
      claimsCount: memberClaims.length,
      approvedClaimsTotal,
      pendingClaimsCount,
      activeLoansCount: activeLoans.length,
      totalLoansCount: memberLoans.length,
      overdueLoansCount,
      attendingCount: attendingRsvps.length,
      checkedInCount,
      unpaidFeesCount,
      unpaidFeesTotal,
    };
  }, [member, showSensitive, claims, equipmentLoans, feePayments, eventRsvps, budgets]);

  if (!isOpen || !member) return null;

  const sensitiveData: Partial<UserProfile> | null = showSensitive
    ? fullDetails || (member as Partial<UserProfile>)
    : null;

  const handleCopy = async (key: string, value?: string | null) => {
    if (!value) return;
    try {
      await navigator.clipboard.writeText(value);
      setCopiedKey(key);
      setTimeout(() => {
        setCopiedKey((prev) => (prev === key ? null : prev));
      }, 1800);
    } catch {
      // Ignore clipboard failures
    }
  };

  const handleOpenWhatsApp = async () => {
    if (!member.allow_whatsapp_chat) return;
    setLoadingWa(true);
    setWaError('');
    try {
      const { data, error } = await supabase.rpc('get_whatsapp_chat_phone', {
        target_user_id: member.id,
      });
      if (error || !data) {
        setWaError('WhatsApp number unavailable or member opted out.');
        return;
      }
      const digits = String(data).replace(/[^0-9]/g, '');
      const normalized = digits.startsWith('0') ? `6${digits}` : digits;
      if (!normalized) {
        setWaError('Invalid WhatsApp number configured by member.');
        return;
      }
      window.open(`https://wa.me/${normalized}`, '_blank', 'noopener,noreferrer');
    } finally {
      setLoadingWa(false);
    }
  };

  const roleBadgeClass =
    member.role === 'owner'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : member.role === 'treasurer'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  const avatarClass =
    member.role === 'owner'
      ? 'bg-amber-100 text-amber-800 border-amber-200'
      : member.role === 'treasurer'
        ? 'bg-emerald-100 text-emerald-800 border-emerald-200'
        : 'bg-slate-100 text-slate-700 border-slate-200';

  return (
    <ModalShell
      open={Boolean(isOpen && member)}
      onClose={onClose}
      zIndexClass="z-[70]"
      maxWidthClass="max-w-2xl"
      ariaLabel={member.full_name}
    >
      <div className="relative w-full max-h-[88vh] overflow-y-auto rounded-2xl bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 border border-slate-200 dark:border-white/10 shadow-2xl">
        {/* Top Profile Banner */}
        <div className="sticky top-0 z-10 flex items-start justify-between gap-3 px-5 py-4 bg-white/95 dark:bg-slate-900/95 backdrop-blur border-b border-slate-200 dark:border-white/10">
          <div className="flex items-center gap-3.5 min-w-0">
            <div
              className={`w-12 h-12 rounded-2xl border flex items-center justify-center font-bold text-base shrink-0 ${avatarClass}`}
            >
              {getInitials(member.full_name)}
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold text-slate-900 truncate">
                  {member.full_name}
                </h2>
                {isSelf && (
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200">
                    You
                  </span>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-1.5 mt-1">
                <span
                  className={`text-[11px] font-semibold px-2 py-0.5 rounded-full border ${roleBadgeClass}`}
                >
                  {formatRoleLabel(member.role)}
                </span>
                {member.matric_no && (
                  <span className="text-[11px] font-mono font-medium px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 border border-slate-200">
                    {member.matric_no}
                  </span>
                )}
                {member.member_type && (
                  <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-teal-50 text-teal-800 border border-teal-200">
                    {member.member_type}
                  </span>
                )}
                <span
                  className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded-full border ${
                    showSensitive
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : 'bg-slate-50 text-slate-600 border-slate-200'
                  }`}
                >
                  {showSensitive ? (
                    <>
                      <Shield className="w-3 h-3" /> Full Access
                    </>
                  ) : (
                    <>
                      <Lock className="w-3 h-3" /> Basic Profile
                    </>
                  )}
                </span>
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors shrink-0"
            aria-label="Close member profile"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Quick Actions */}
          {!isSelf && (onMessageInChat || member.allow_whatsapp_chat) && (
            <div className="flex flex-wrap items-center gap-2.5">
              {onMessageInChat && (
                <button
                  type="button"
                  onClick={() => {
                    onMessageInChat(member.id);
                    onClose();
                  }}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs sm:text-sm font-semibold shadow-xs transition-colors"
                >
                  <MessageCircle className="w-4 h-4" />
                  Message in Club Chat
                </button>
              )}
              {member.allow_whatsapp_chat && (
                <button
                  type="button"
                  onClick={handleOpenWhatsApp}
                  disabled={loadingWa}
                  className="inline-flex items-center gap-2 px-3.5 py-2 rounded-xl bg-white hover:bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs sm:text-sm font-semibold transition-colors disabled:opacity-60"
                >
                  {loadingWa ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <ExternalLink className="w-4 h-4" />
                  )}
                  Continue on WhatsApp
                </button>
              )}
              {waError && (
                <span className="text-xs text-rose-600">{waError}</span>
              )}
            </div>
          )}

          {/* Basic Non-Sensitive Info (Always visible to club members) */}
          <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4">
            <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
              <User className="w-3.5 h-3.5 text-slate-400" />
              Club &amp; Academic Details
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
              <div className="bg-white rounded-lg border border-slate-200/80 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">Department / Portfolio</p>
                <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-teal-600 shrink-0" />
                  {member.member_type || 'General Member'}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200/80 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">Batch Year &amp; Status</p>
                <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <BadgeCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                  <span>{member.batch_year || '—'}</span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-medium text-slate-600">
                    {member.member_status || 'Active'}
                  </span>
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200/80 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">Faculty / Course</p>
                <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <GraduationCap className="w-3.5 h-3.5 text-indigo-600 shrink-0" />
                  {(sensitiveData?.course || member.course || '').trim() || 'Not set'}
                </p>
              </div>
              <div className="bg-white rounded-lg border border-slate-200/80 px-3 py-2">
                <p className="text-[11px] font-medium text-slate-500">Year of Study &amp; Joined</p>
                <p className="font-semibold text-slate-800 mt-0.5 flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                  <span>
                    {(sensitiveData?.year_of_study || member.year_of_study || '').trim() ||
                      'Year —'}
                  </span>
                  <span className="text-slate-300">•</span>
                  <span className="text-xs font-normal text-slate-500">
                    Joined {formatDateDisplay(sensitiveData?.created_at || member.created_at)}
                  </span>
                </p>
              </div>
            </div>
          </div>

          {/* Admin Restricted Notice */}
          {!showSensitive && isViewerAdmin && !isSelf && (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/80 px-3.5 py-3 text-xs text-amber-900">
              <ShieldAlert className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">Confidential details are hidden for your current view.</p>
                <p className="text-amber-800/90 mt-0.5">
                  Ask the Club Owner to enable <strong>8. View Confidential Member Profiles</strong> in{' '}
                  <span className="font-medium">Members → Permissions</span> (or switch back to Admin Mode if already granted).
                </p>
              </div>
            </div>
          )}

          {/* Confidential Personal & Financial Info (Authorized Owner / Admin / Self ONLY) */}
          {showSensitive && (
            <>
              <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-emerald-800 flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-emerald-600" />
                    Confidential Personal &amp; Contact Details
                  </h3>
                  {loadingFull && (
                    <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700">
                      <Loader2 className="w-3 h-3 animate-spin" /> Syncing…
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm">
                  {/* Email */}
                  <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">Email Address</p>
                      <p className="font-medium text-slate-800 truncate flex items-center gap-1.5 mt-0.5">
                        <Mail className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span className="truncate">{sensitiveData?.email || 'Not set'}</span>
                      </p>
                    </div>
                    {sensitiveData?.email && (
                      <button
                        type="button"
                        onClick={() => handleCopy('email', sensitiveData.email)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                        title="Copy email"
                      >
                        {copiedKey === 'email' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Phone */}
                  <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">Phone / WhatsApp</p>
                      <p className="font-medium text-slate-800 truncate flex items-center gap-1.5 mt-0.5">
                        <Phone className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sensitiveData?.phone_number || 'Not set'}</span>
                      </p>
                    </div>
                    {sensitiveData?.phone_number && (
                      <button
                        type="button"
                        onClick={() => handleCopy('phone', sensitiveData.phone_number)}
                        className="p-1.5 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 shrink-0"
                        title="Copy phone number"
                      >
                        {copiedKey === 'phone' ? (
                          <Check className="w-3.5 h-3.5 text-emerald-600" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                    )}
                  </div>

                  {/* Masked IC */}
                  <div className="bg-white rounded-lg border border-slate-200 px-3 py-2 flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-[11px] font-medium text-slate-500">IC / Identity No</p>
                      <p className="font-mono font-medium text-slate-800 truncate flex items-center gap-1.5 mt-0.5">
                        <IdCard className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>
                          {sensitiveData?.ic_no
                            ? icRevealed
                              ? sensitiveData.ic_no
                              : maskIcNumber(sensitiveData.ic_no)
                            : 'Not set'}
                        </span>
                      </p>
                    </div>
                    {sensitiveData?.ic_no && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => setIcRevealed((prev) => !prev)}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700"
                          title={icRevealed ? 'Hide IC' : 'Reveal IC'}
                        >
                          {icRevealed ? (
                            <>
                              <EyeOff className="w-3 h-3" /> Hide
                            </>
                          ) : (
                            <>
                              <Eye className="w-3 h-3" /> Reveal
                            </>
                          )}
                        </button>
                        {icRevealed && (
                          <button
                            type="button"
                            onClick={() => handleCopy('ic', sensitiveData.ic_no)}
                            className="p-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100"
                            title="Copy IC"
                          >
                            {copiedKey === 'ic' ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                          </button>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Dormitory & Hometown */}
                  <div className="bg-white rounded-lg border border-slate-200 px-3 py-2">
                    <p className="text-[11px] font-medium text-slate-500">Dormitory &amp; Hometown</p>
                    <div className="mt-0.5 space-y-0.5 text-xs text-slate-800">
                      <p className="font-medium flex items-center gap-1.5">
                        <Home className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sensitiveData?.dormitory || 'Dorm not set'}</span>
                      </p>
                      <p className="text-slate-600 flex items-center gap-1.5">
                        <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        <span>{sensitiveData?.hometown || 'Hometown not set'}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Saved Payout Bank & DuitNow QR */}
                <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                  <div className="min-w-0 space-y-1">
                    <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <CreditCard className="w-3.5 h-3.5 text-emerald-600" />
                      Saved Bank &amp; DuitNow Payout Info
                    </p>
                    {sensitiveData?.bank_name || sensitiveData?.bank_account_no ? (
                      <div className="text-xs text-slate-700 space-y-0.5">
                        <p className="font-semibold text-slate-900">
                          {sensitiveData.bank_name || 'Bank not set'}
                        </p>
                        <div className="flex items-center gap-2">
                          <span className="font-mono text-slate-800">
                            {sensitiveData.bank_account_no || 'No account no'}
                          </span>
                          {sensitiveData.bank_account_no && (
                            <button
                              type="button"
                              onClick={() => handleCopy('bank_acc', sensitiveData.bank_account_no)}
                              className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 hover:bg-slate-200 text-[10px] font-semibold text-slate-700"
                            >
                              {copiedKey === 'bank_acc' ? (
                                <>
                                  <Check className="w-3 h-3 text-emerald-600" /> Copied
                                </>
                              ) : (
                                <>
                                  <Copy className="w-3 h-3" /> Copy
                                </>
                              )}
                            </button>
                          )}
                        </div>
                        {sensitiveData.bank_account_holder && (
                          <p className="text-slate-500">
                            Holder: {sensitiveData.bank_account_holder}
                          </p>
                        )}
                      </div>
                    ) : (
                      <p className="text-xs text-slate-500">No default bank details saved yet.</p>
                    )}
                  </div>

                  {sensitiveData?.bank_qr_url ? (
                    <div className="flex items-center gap-2.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => setQrExpanded((prev) => !prev)}
                        className="group relative w-16 h-16 rounded-lg border border-slate-200 overflow-hidden bg-slate-50 hover:border-emerald-400 transition-colors"
                        title="Toggle QR preview"
                      >
                        <img
                          src={sensitiveData.bank_qr_url}
                          alt="Member DuitNow QR"
                          className="w-full h-full object-contain"
                        />
                      </button>
                      <div className="flex flex-col gap-1">
                        <button
                          type="button"
                          onClick={() => setQrExpanded((prev) => !prev)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-700 hover:underline"
                        >
                          <QrCode className="w-3.5 h-3.5" />
                          {qrExpanded ? 'Hide QR' : 'Expand QR'}
                        </button>
                        <a
                          href={sensitiveData.bank_qr_url}
                          target="_blank"
                          rel="noopener noreferrer"
                          download
                          className="inline-flex items-center gap-1 text-[11px] font-medium text-slate-600 hover:text-slate-900 hover:underline"
                        >
                          <Download className="w-3.5 h-3.5" /> Open / Save
                        </a>
                      </div>
                    </div>
                  ) : (
                    <span className="text-xs text-slate-400 italic shrink-0">No DuitNow QR uploaded</span>
                  )}
                </div>

                {qrExpanded && sensitiveData?.bank_qr_url && (
                  <div className="bg-white rounded-xl border border-slate-200 p-3 flex flex-col items-center gap-2">
                    <img
                      src={sensitiveData.bank_qr_url}
                      alt="Expanded Member DuitNow QR"
                      className="max-h-64 w-auto object-contain rounded-lg"
                    />
                  </div>
                )}
              </div>

              {/* Club Activity Snapshot */}
              {activitySnapshot && (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-3 flex items-center gap-1.5">
                    <Wallet className="w-3.5 h-3.5 text-slate-400" />
                    Club Activity Snapshot
                  </h3>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-slate-500 flex items-center gap-1 font-medium">
                        <Receipt className="w-3.5 h-3.5 text-indigo-500" /> Claims
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        {activitySnapshot.claimsCount}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        RM {activitySnapshot.approvedClaimsTotal.toFixed(2)} approved
                        {activitySnapshot.pendingClaimsCount > 0
                          ? ` • ${activitySnapshot.pendingClaimsCount} pending`
                          : ''}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-slate-500 flex items-center gap-1 font-medium">
                        <Package className="w-3.5 h-3.5 text-amber-500" /> Loans
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        {activitySnapshot.activeLoansCount} active
                      </p>
                      <p
                        className={`text-[11px] mt-0.5 ${
                          activitySnapshot.overdueLoansCount > 0
                            ? 'text-rose-600 font-semibold'
                            : 'text-slate-500'
                        }`}
                      >
                        {activitySnapshot.overdueLoansCount > 0
                          ? `${activitySnapshot.overdueLoansCount} overdue`
                          : `${activitySnapshot.totalLoansCount} total loans`}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-slate-500 flex items-center gap-1 font-medium">
                        <Wallet className="w-3.5 h-3.5 text-rose-500" /> Unpaid Fees
                      </p>
                      <p
                        className={`text-sm font-bold mt-1 ${
                          activitySnapshot.unpaidFeesCount > 0
                            ? 'text-rose-600'
                            : 'text-emerald-700'
                        }`}
                      >
                        {activitySnapshot.unpaidFeesCount > 0
                          ? `RM ${activitySnapshot.unpaidFeesTotal.toFixed(2)}`
                          : 'All Clear'}
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activitySnapshot.unpaidFeesCount > 0
                          ? `${activitySnapshot.unpaidFeesCount} unpaid activit${
                              activitySnapshot.unpaidFeesCount === 1 ? 'y' : 'ies'
                            }`
                          : 'No pending activity fees'}
                      </p>
                    </div>

                    <div className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <p className="text-slate-500 flex items-center gap-1 font-medium">
                        <Calendar className="w-3.5 h-3.5 text-emerald-600" /> Attendance
                      </p>
                      <p className="text-sm font-bold text-slate-900 mt-1">
                        {activitySnapshot.attendingCount} RSVPs
                      </p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {activitySnapshot.checkedInCount} QR checked in
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </ModalShell>
  );
}
