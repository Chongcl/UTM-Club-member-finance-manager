'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  PreClaim,
  Budget,
  Claim,
  UserProfile,
  AccountType,
  MAX_FILE_SIZE_BYTES,
  downloadFileFromUrl,
  logActivity,
} from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import type { MemberLookupHint } from '@/lib/memberLookup';
import ModalShell from './ui/ModalShell';
import {
  X,
  CheckCircle2,
  XCircle,
  Clock,
  ShieldCheck,
  User,
  Hash,
  Phone,
  Landmark,
  Copy,
  Download,
  ZoomIn,
  ExternalLink,
  UploadCloud,
  Wallet,
  CalendarClock,
  Loader2,
  AlertTriangle,
  FileText,
  Banknote,
  Trash2,
  Receipt,
} from 'lucide-react';

interface PreClaimReviewModalProps {
  preClaim: PreClaim | null;
  budget?: Budget;
  allClaims?: Claim[];
  requesterProfile?: UserProfile;
  profile: UserProfile;
  isOwner?: boolean;
  canManageClaims?: boolean;
  ownerUserId?: string | null;
  isRequesterOwner?: boolean;
  approvalThreshold?: number;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onUploadReceipt?: (preClaim: PreClaim) => void;
  onSelectClaim?: (claim: Claim) => void;
  onOpenMemberProfile?: (hint: MemberLookupHint) => void;
}

export default function PreClaimReviewModal({
  preClaim,
  budget,
  allClaims = [],
  requesterProfile,
  profile,
  isOwner = false,
  canManageClaims = false,
  ownerUserId = null,
  isRequesterOwner = false,
  approvalThreshold = 200,
  onClose,
  onUpdated,
  onUploadReceipt,
  onSelectClaim,
  onOpenMemberProfile,
}: PreClaimReviewModalProps) {
  const [approvedCapInput, setApprovedCapInput] = useState('');
  const [remarks, setRemarks] = useState('');
  const [disburseAmountInput, setDisburseAmountInput] = useState('');
  const [disburseAccount, setDisburseAccount] = useState<AccountType>('Bank');
  const [disburseProofFile, setDisburseProofFile] = useState<File | null>(null);
  const [fullQrOpen, setFullQrOpen] = useState(false);
  const [fullQuoteOpen, setFullQuoteOpen] = useState(false);
  const [processing, setProcessing] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  useEffect(() => {
    if (preClaim) {
      setApprovedCapInput(
        String(Number(preClaim.approved_cap ?? preClaim.estimated_amount ?? 0).toFixed(2))
      );
      setRemarks(preClaim.review_remarks || '');
      const advDefault = Number(
        preClaim.advance_amount && preClaim.advance_amount > 0
          ? preClaim.advance_amount
          : preClaim.approved_cap ?? preClaim.estimated_amount ?? 0
      );
      setDisburseAmountInput(advDefault > 0 ? advDefault.toFixed(2) : '');
      setDisburseAccount(preClaim.advance_account_type === 'Cash' ? 'Cash' : 'Bank');
      setDisburseProofFile(null);
      setFullQrOpen(false);
      setFullQuoteOpen(false);
      setErrorMsg(null);
      setConfirmDelete(false);
    }
  }, [preClaim]);

  if (!preClaim) return null;

  const isOwnRequest = preClaim.user_id === profile.id;
  const myLabel = `${profile.full_name} (${profile.matric_no})`;
  const verifiedBy = preClaim.treasurer_verified_by || '';
  const stage1Done = Boolean(verifiedBy);
  const reqIsOwner = Boolean(
    isRequesterOwner || (isOwnRequest && (isOwner || profile.role === 'owner'))
  );
  const needsTwoStage = Number(preClaim.estimated_amount) > approvalThreshold && !reqIsOwner;

  const eventLabel =
    budget?.event_name || preClaim.custom_event_name || 'General Club Expense';
  const eventSpent = budget
    ? allClaims
        .filter((c) => c.budget_id === budget.id && c.status === 'Approved' && !c.deleted_at)
        .reduce((s, c) => s + Number(c.amount || 0), 0)
    : 0;

  const profileBankFallback = requesterProfile?.bank_account_no
    ? `${requesterProfile.bank_name || 'Bank/DuitNow'} • ${requesterProfile.bank_account_no} (${
        requesterProfile.bank_account_holder || requesterProfile.full_name
      })`
    : '';
  const resolvedBankInfo = preClaim.payment_info || profileBankFallback;
  const resolvedQrUrl = preClaim.claimant_qr_url || requesterProfile?.bank_qr_url || '';
  const isQrPdf =
    resolvedQrUrl.toLowerCase().split('?')[0].endsWith('.pdf') ||
    resolvedQrUrl.startsWith('data:application/pdf');

  const quoteUrl = preClaim.quote_url || '';
  const isQuotePdf =
    quoteUrl.toLowerCase().split('?')[0].endsWith('.pdf') ||
    quoteUrl.startsWith('data:application/pdf');
  const isQuoteImage =
    Boolean(quoteUrl) &&
    !isQuotePdf &&
    (/\.(jpg|jpeg|png|webp|gif)(\?|$)/i.test(quoteUrl) ||
      quoteUrl.startsWith('data:image/') ||
      quoteUrl.includes('/storage/v1/object/public/receipts/'));

  const linkedClaim = preClaim.linked_claim_id
    ? allClaims.find((c) => c.id === preClaim.linked_claim_id) || null
    : null;

  const handleStage1Verify = async () => {
    setErrorMsg(null);
    const parsedCap = parseFloat(approvedCapInput);
    const capVal = !isNaN(parsedCap) && parsedCap > 0 ? parsedCap : Number(preClaim.estimated_amount);
    setProcessing('verify');
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('pre_claims')
        .update({
          approved_cap: Number(capVal.toFixed(2)),
          treasurer_verified_by: myLabel,
          treasurer_verified_at: nowIso,
          review_remarks:
            remarks.trim() || 'Verified by Treasurer — awaiting Owner approval',
        })
        .eq('id', preClaim.id);
      if (error) throw error;

      void logActivity(
        profile,
        'Claims',
        'Pre-Claim verified (Stage 1)',
        `${myLabel} verified pre-claim "${preClaim.title}" (Cap RM ${capVal.toFixed(2)}) by ${preClaim.requester_name}.`
      );
      if (ownerUserId && ownerUserId !== preClaim.user_id && ownerUserId !== profile.id) {
        void emitClubNotification({
          targetUserId: ownerUserId,
          type: 'claim',
          title: `Pre-Claim Owner Approval Needed: ${preClaim.title}`,
          body: `${preClaim.requester_name} · Cap RM ${capVal.toFixed(2)} passed Treasurer check.`,
          targetTab: 'claims',
          targetId: preClaim.id,
          actorName: profile.full_name,
        });
      }
      onUpdated('Stage 1 verified — sent to Owner for final Pre-Approval.');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Verification failed.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDecision = async (decision: 'Pre-Approved' | 'Rejected') => {
    setErrorMsg(null);
    const parsedCap = parseFloat(approvedCapInput);
    const capVal =
      !isNaN(parsedCap) && parsedCap > 0 ? parsedCap : Number(preClaim.estimated_amount);
    setProcessing(decision);
    try {
      const nowIso = new Date().toISOString();
      const remarkText =
        remarks.trim() || (decision === 'Pre-Approved' ? 'Pre-Approved' : 'Rejected');
      const { error } = await supabase
        .from('pre_claims')
        .update({
          status: decision,
          ...(decision === 'Pre-Approved'
            ? {
                approved_cap: Number(capVal.toFixed(2)),
                treasurer_verified_by: preClaim.treasurer_verified_by || myLabel,
                treasurer_verified_at: preClaim.treasurer_verified_at || nowIso,
              }
            : {}),
          reviewed_by: myLabel,
          review_remarks: remarkText,
          reviewed_at: nowIso,
        })
        .eq('id', preClaim.id);
      if (error) throw error;

      void logActivity(
        profile,
        'Claims',
        decision === 'Pre-Approved' ? 'Pre-Claim approved' : 'Pre-Claim rejected',
        `${myLabel} ${decision === 'Pre-Approved' ? `pre-approved (Cap RM ${capVal.toFixed(2)})` : 'rejected'} pre-claim "${preClaim.title}" by ${preClaim.requester_name}`
      );
      void recordEditHistory({
        actor: profile,
        category: 'Claims',
        table: 'pre_claims',
        recordId: preClaim.id,
        recordTitle: preClaim.title,
        changes: computeFieldChanges([
          { field: 'Status', before: preClaim.status, after: decision },
          ...(decision === 'Pre-Approved'
            ? [{ field: 'Approved Cap (RM)', before: preClaim.approved_cap ?? '-', after: capVal.toFixed(2) }]
            : []),
        ]),
      });
      if (preClaim.user_id) {
        void emitClubNotification({
          targetUserId: preClaim.user_id,
          type: 'claim',
          title: `Pre-Claim ${decision === 'Pre-Approved' ? 'Approved' : 'Rejected'}: ${preClaim.title}`,
          body:
            decision === 'Pre-Approved'
              ? `Approved Cap: RM ${capVal.toFixed(2)}.${preClaim.needs_cash_advance ? ' Cash advance ready for disbursement.' : ' You may proceed and upload receipt afterward.'}`
              : remarkText,
          targetTab: 'claims',
          targetId: preClaim.id,
          actorName: profile.full_name,
        });
      }
      onUpdated(
        decision === 'Pre-Approved'
          ? `✓ Pre-Claim "${preClaim.title}" approved (Cap RM ${capVal.toFixed(2)})!`
          : `Pre-Claim "${preClaim.title}" rejected.`
      );
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Action failed.');
    } finally {
      setProcessing(null);
    }
  };

  const handleDisburseAdvance = async () => {
    setErrorMsg(null);
    const advAmt = parseFloat(disburseAmountInput);
    if (isNaN(advAmt) || advAmt <= 0) {
      setErrorMsg('Enter a valid Cash Advance amount (RM).');
      return;
    }
    if (disburseProofFile && disburseProofFile.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('Proof of transfer file must be under 50 MB.');
      return;
    }
    setProcessing('disburse');
    try {
      let proofUrl = '';
      if (disburseProofFile) {
        const ext = disburseProofFile.name.split('.').pop() || 'pdf';
        const path = `preclaim-advances/${preClaim.id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(path, disburseProofFile);
        if (upErr) throw upErr;
        proofUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      }

      const nowIso = new Date().toISOString();
      const todayDate = nowIso.split('T')[0];

      const { error: updErr } = await supabase
        .from('pre_claims')
        .update({
          status: 'Advance Disbursed',
          advance_disbursed_amount: Number(advAmt.toFixed(2)),
          advance_disbursed_at: nowIso,
          advance_proof_url: proofUrl,
          advance_account_type: disburseAccount,
        })
        .eq('id', preClaim.id);
      if (updErr) throw updErr;

      const ledgerPayload = {
        entry_type: 'OUT',
        title: `Cash Advance — ${preClaim.title}`,
        category: 'Cash Advance',
        event_name: eventLabel,
        amount: Number(advAmt.toFixed(2)),
        account_type: disburseAccount,
        entry_date: todayDate,
        person_in_charge: `${preClaim.requester_name} (${preClaim.matric_no})`,
        notes: `Pre-Claim Advance (${preClaim.id}) disbursed by ${myLabel}`,
        attachment_url: proofUrl,
        attachment_name: disburseProofFile?.name || '',
      };

      const { error: ledErr } = await supabase.from('ledger_entries').insert(ledgerPayload);
      if (ledErr) {
        // Fallback without optional account_type / event_name if minimal schema
        await supabase.from('ledger_entries').insert({
          entry_type: 'OUT',
          title: ledgerPayload.title,
          category: ledgerPayload.category,
          amount: ledgerPayload.amount,
          entry_date: todayDate,
          person_in_charge: ledgerPayload.person_in_charge,
          notes: ledgerPayload.notes,
        });
      }

      void logActivity(
        profile,
        'Finance',
        'Cash Advance disbursed',
        `${myLabel} disbursed RM ${advAmt.toFixed(2)} (${disburseAccount}) cash advance for "${preClaim.title}" to ${preClaim.requester_name}`
      );
      if (preClaim.user_id) {
        void emitClubNotification({
          targetUserId: preClaim.user_id,
          type: 'claim',
          title: `Cash Advance Sent: ${preClaim.title}`,
          body: `RM ${advAmt.toFixed(2)} (${disburseAccount}) has been disbursed. Upload your final receipt once purchased.`,
          targetTab: 'claims',
          targetId: preClaim.id,
          actorName: profile.full_name,
        });
      }

      onUpdated(`✓ Cash Advance RM ${advAmt.toFixed(2)} disbursed & logged in Finance Sheet!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not disburse advance.');
    } finally {
      setProcessing(null);
    }
  };

  const handleCancelOwn = async () => {
    setProcessing('cancel');
    try {
      const { error } = await supabase
        .from('pre_claims')
        .update({ status: 'Cancelled' })
        .eq('id', preClaim.id);
      if (error) throw error;
      onUpdated(`Cancelled Pre-Claim "${preClaim.title}".`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not cancel request.');
    } finally {
      setProcessing(null);
    }
  };

  const handleSoftDelete = async () => {
    setProcessing('delete');
    try {
      await softDeleteRecord({
        actor: profile,
        category: 'Claims',
        table: 'pre_claims',
        recordId: preClaim.id,
        recordTitle: preClaim.title,
        extraSummary: `Est. RM ${Number(preClaim.estimated_amount).toFixed(2)} by ${preClaim.requester_name}`,
      });
      onUpdated(`Removed pre-claim "${preClaim.title}" from web view (kept in Supabase).`);
      onClose();
    } finally {
      setProcessing(null);
    }
  };

  const canUploadReceiptNow =
    isOwnRequest &&
    (preClaim.status === 'Pre-Approved' || preClaim.status === 'Advance Disbursed') &&
    Boolean(onUploadReceipt);

  return (
    <ModalShell
      open={Boolean(preClaim)}
      onClose={onClose}
      zIndexClass="z-[60]"
      align="sheet"
      maxWidthClass="max-w-2xl"
      ariaLabel={preClaim.title}
    >
      <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-t-2xl sm:rounded-2xl shadow-2xl border border-slate-200 dark:border-white/10 w-full overflow-hidden">
        <div className="bg-slate-900 dark:bg-slate-950 text-white px-6 py-4 flex items-center justify-between gap-3 border-b border-white/10">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold flex items-center gap-1.5">
              <CalendarClock className="w-3.5 h-3.5" />
              <span>Pre-Claim &amp; Cash Advance Review</span>
            </span>
            <h2 className="text-base font-bold mt-0.5 truncate">{preClaim.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {(canManageClaims || (isOwnRequest && preClaim.status === 'Pending')) && (
              <button
                type="button"
                onClick={() => setConfirmDelete((v) => !v)}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                title="Remove from web (kept in Supabase)"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            )}
            <button
              type="button"
              onClick={onClose}
              className="text-emerald-200 hover:text-white cursor-pointer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {confirmDelete && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <span className="text-rose-900 font-semibold">
              Remove &ldquo;{preClaim.title}&rdquo; from web view? (Row remains in Supabase.)
            </span>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDelete(false)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={processing !== null}
                onClick={handleSoftDelete}
                className="px-3 py-1 rounded-lg bg-rose-600 text-white font-bold cursor-pointer"
              >
                Confirm Remove
              </button>
            </div>
          </div>
        )}

        <div className="p-6 space-y-4 max-h-[80vh] overflow-y-auto text-xs">
          {/* Requester + Status Row */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div className="bg-emerald-50/70 rounded-2xl p-3.5 border border-emerald-200 space-y-1">
              <div className="flex items-center gap-2 text-slate-800">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                {onOpenMemberProfile ? (
                  <button
                    type="button"
                    onClick={() =>
                      onOpenMemberProfile({
                        userId: preClaim.user_id,
                        matricNo: preClaim.matric_no,
                        name: preClaim.requester_name,
                      })
                    }
                    className="font-bold hover:text-emerald-700 hover:underline cursor-pointer text-left"
                  >
                    {preClaim.requester_name}
                  </button>
                ) : (
                  <span className="font-bold">{preClaim.requester_name}</span>
                )}
              </div>
              <div className="flex items-center gap-2 text-slate-700">
                <Hash className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-mono font-semibold">{preClaim.matric_no}</span>
              </div>
              {preClaim.phone_number && (
                <div className="flex items-center gap-2 text-slate-700">
                  <Phone className="w-3.5 h-3.5 text-emerald-700" />
                  <span className="font-mono">{preClaim.phone_number}</span>
                </div>
              )}
            </div>

            <div className="rounded-2xl p-3.5 border border-slate-200 bg-slate-50/80 space-y-1.5">
              <div className="flex items-center justify-between">
                <span className="text-slate-500 font-semibold">Status:</span>
                <span
                  className={`px-2.5 py-0.5 rounded-full font-extrabold text-[11px] ${
                    preClaim.status === 'Pre-Approved' || preClaim.status === 'Settled'
                      ? 'bg-emerald-100 text-emerald-800'
                      : preClaim.status === 'Advance Disbursed'
                      ? 'bg-sky-100 text-sky-900'
                      : preClaim.status === 'Receipt Submitted'
                      ? 'bg-indigo-100 text-indigo-900'
                      : preClaim.status === 'Rejected' || preClaim.status === 'Cancelled'
                      ? 'bg-rose-100 text-rose-700'
                      : 'bg-amber-100 text-amber-900'
                  }`}
                >
                  {preClaim.status === 'Pending' && needsTwoStage
                    ? stage1Done
                      ? 'Stage 2/2: Awaiting Owner'
                      : 'Stage 1/2: Awaiting Treasurer'
                    : preClaim.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Estimated Amount:</span>
                <span className="font-extrabold text-slate-900 text-sm">
                  RM {Number(preClaim.estimated_amount).toFixed(2)}
                </span>
              </div>
              {preClaim.approved_cap !== null && preClaim.approved_cap !== undefined && (
                <div className="flex items-center justify-between">
                  <span className="text-slate-500">Approved Cap:</span>
                  <span className="font-extrabold text-emerald-800">
                    RM {Number(preClaim.approved_cap).toFixed(2)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Needed By:</span>
                <span className="font-mono font-bold text-slate-800">{preClaim.needed_date}</span>
              </div>
            </div>
          </div>

          {/* Linked Activity + 1-Line Spent Context + Reason */}
          <div className="rounded-2xl border border-emerald-200 p-4 space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <span className="text-slate-500">Activity: </span>
                <strong className="text-slate-900">{eventLabel}</strong>
                <span className="text-slate-400"> · </span>
                <span className="font-bold text-emerald-800">{preClaim.category}</span>
              </div>
              {budget && (
                <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  Current event claims spent: RM {eventSpent.toFixed(2)}
                </span>
              )}
            </div>
            {preClaim.reason && (
              <p className="text-slate-600 pt-1 border-t border-slate-100">{preClaim.reason}</p>
            )}
            {preClaim.review_remarks && (
              <p className="text-[11px] text-emerald-900 bg-emerald-50 rounded-xl px-3 py-1.5 font-medium">
                Review Note: {preClaim.review_remarks}
                {preClaim.reviewed_by ? ` — ${preClaim.reviewed_by}` : ''}
              </p>
            )}
          </div>

          {/* Quotation Link / Image */}
          {quoteUrl && (
            <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-slate-800 flex items-center gap-1.5">
                  <FileText className="w-4 h-4 text-emerald-700" />
                  <span>Attached Quotation / Reference</span>
                </span>
                <div className="flex items-center gap-2">
                  {isQuoteImage && (
                    <button
                      type="button"
                      onClick={() => setFullQuoteOpen(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border font-bold text-[11px] cursor-pointer"
                    >
                      <ZoomIn className="w-3.5 h-3.5 text-emerald-700" />
                      <span>Zoom</span>
                    </button>
                  )}
                  <a
                    href={quoteUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]"
                  >
                    <span>Open Quote</span>
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              </div>
              {isQuoteImage && (
                <img
                  src={quoteUrl}
                  alt="Quotation"
                  onClick={() => setFullQuoteOpen(true)}
                  className="max-h-48 w-auto mx-auto rounded-xl border bg-white object-contain cursor-zoom-in"
                />
              )}
            </div>
          )}

          {/* Two-Stage Info when pending & > threshold */}
          {preClaim.status === 'Pending' && needsTwoStage && (
            <div className="rounded-2xl border border-indigo-200 bg-indigo-50/70 p-3.5 space-y-1.5">
              <div className="font-extrabold text-indigo-950 flex items-center gap-1.5">
                <ShieldCheck className="w-4 h-4 text-indigo-700" />
                <span>2-Stage Pre-Approval (Above RM {approvalThreshold.toFixed(0)})</span>
              </div>
              <div className="text-[11px] text-indigo-900">
                {stage1Done
                  ? `✓ Stage 1 verified by ${verifiedBy} — awaiting Owner approval.`
                  : '1. Treasurer verifies cap first -> 2. Owner gives final Pre-Approval.'}
              </div>
            </div>
          )}

          {/* Linked Final Receipt Claim Card */}
          {linkedClaim && (
            <div className="p-3.5 rounded-2xl bg-indigo-50 border border-indigo-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="text-[10px] font-extrabold uppercase text-indigo-700">
                  Linked Receipt Claim
                </div>
                <div className="font-bold text-slate-900">
                  {linkedClaim.title} · RM {Number(linkedClaim.amount).toFixed(2)} ({linkedClaim.status})
                </div>
              </div>
              {onSelectClaim && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onSelectClaim(linkedClaim);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                >
                  Open Receipt Claim →
                </button>
              )}
            </div>
          )}

          {errorMsg && (
            <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {/* Review Controls for Pending Pre-Claim */}
          {canManageClaims && preClaim.status === 'Pending' && (
            <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">
                    Approved Cap (RM)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={approvedCapInput}
                    onChange={(e) => setApprovedCapInput(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-extrabold text-emerald-950"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Review Remarks
                  </label>
                  <input
                    type="text"
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    placeholder="Optional notes or conditions..."
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2"
                  />
                </div>
              </div>

              {(() => {
                if (isOwnRequest) {
                  if (stage1Done && verifiedBy !== myLabel) {
                    return (
                      <div className="space-y-2">
                        <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 font-semibold flex items-center gap-1.5">
                          <CheckCircle2 className="w-4 h-4 shrink-0" />
                          <span>Verified by {verifiedBy}. Click below to finalize your Pre-Approval.</span>
                        </div>
                        <button
                          type="button"
                          disabled={processing !== null}
                          onClick={() => handleDecision('Pre-Approved')}
                          className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer inline-flex items-center justify-center gap-1.5"
                        >
                          {processing === 'Pre-Approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                          <span>Finalize Pre-Approval</span>
                        </button>
                      </div>
                    );
                  }
                  return (
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>You cannot approve your own Pre-Claim. Another Admin/Treasurer must review it.</span>
                    </div>
                  );
                }

                const rejectBtn = (
                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={() => handleDecision('Rejected')}
                    className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer"
                  >
                    <XCircle className="w-4 h-4" />
                    <span>Reject</span>
                  </button>
                );

                if (!needsTwoStage) {
                  return (
                    <div className="grid grid-cols-2 gap-2.5">
                      {rejectBtn}
                      <button
                        type="button"
                        disabled={processing !== null}
                        onClick={() => handleDecision('Pre-Approved')}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {processing === 'Pre-Approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Pre-Approve Cap</span>
                      </button>
                    </div>
                  );
                }

                if (!stage1Done) {
                  if (isOwner) {
                    return (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div className="col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-1.5">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>Waiting for Treasurer to verify Stage 1 first before Owner Pre-Approval.</span>
                        </div>
                        <div className="col-span-2 grid grid-cols-1">{rejectBtn}</div>
                      </div>
                    );
                  }
                  return (
                    <div className="grid grid-cols-2 gap-2.5">
                      {rejectBtn}
                      <button
                        type="button"
                        disabled={processing !== null}
                        onClick={handleStage1Verify}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white font-bold cursor-pointer"
                      >
                        {processing === 'verify' ? <Loader2 className="w-4 h-4 animate-spin" /> : <ShieldCheck className="w-4 h-4" />}
                        <span>Verify (Stage 1)</span>
                      </button>
                    </div>
                  );
                }

                if (isOwner && verifiedBy !== myLabel) {
                  return (
                    <div className="grid grid-cols-2 gap-2.5">
                      {rejectBtn}
                      <button
                        type="button"
                        disabled={processing !== null}
                        onClick={() => handleDecision('Pre-Approved')}
                        className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        {processing === 'Pre-Approved' ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                        <span>Final Pre-Approve</span>
                      </button>
                    </div>
                  );
                }

                return (
                  <div className="space-y-2">
                    <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold flex items-center gap-1.5">
                      <Clock className="w-4 h-4 shrink-0" />
                      <span>Verified by Treasurer. Waiting for Club Owner to give final Pre-Approval.</span>
                    </div>
                    <div className="grid grid-cols-1">{rejectBtn}</div>
                  </div>
                );
              })()}
            </div>
          )}

          {/* Cash Advance Disbursement Panel (When Pre-Approved & Needs Advance) */}
          {preClaim.needs_cash_advance && preClaim.status === 'Pre-Approved' && (
            <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-amber-950 flex items-center gap-1.5">
                  <Wallet className="w-4 h-4 text-amber-700" />
                  <span>Cash Advance Ready to Disburse</span>
                </span>
                <span className="font-extrabold text-amber-900">
                  Requested: RM {Number(preClaim.advance_amount || preClaim.estimated_amount).toFixed(2)}
                </span>
              </div>

              <div className="flex items-center justify-between gap-2 bg-white rounded-xl border border-amber-200 p-2.5">
                <div className="min-w-0">
                  <div className="font-bold text-slate-500 text-[10px] uppercase">Send Advance To</div>
                  <div className="font-mono font-bold text-slate-900 break-all">
                    {resolvedBankInfo || 'No bank text provided'}
                  </div>
                </div>
                {resolvedBankInfo && (
                  <button
                    type="button"
                    onClick={() => navigator.clipboard.writeText(resolvedBankInfo)}
                    className="px-2.5 py-1 rounded-lg bg-amber-100 hover:bg-amber-200 text-amber-950 font-bold text-[11px] shrink-0 cursor-pointer"
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    Copy
                  </button>
                )}
              </div>

              {resolvedQrUrl && (
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  {!isQrPdf ? (
                    <button
                      type="button"
                      onClick={() => setFullQrOpen(true)}
                      className="p-1.5 bg-white rounded-xl border border-amber-200 shrink-0 cursor-zoom-in"
                      title="Zoom DuitNow QR"
                    >
                      <img
                        src={resolvedQrUrl}
                        alt="Claimant QR"
                        className="w-24 h-24 object-contain rounded-lg"
                      />
                    </button>
                  ) : (
                    <a
                      href={resolvedQrUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-white border border-amber-200 font-bold text-amber-950"
                    >
                      Open PDF QR <ExternalLink className="w-3 h-3 inline ml-0.5" />
                    </a>
                  )}
                  <div className="flex flex-wrap gap-2">
                    {!isQrPdf && (
                      <button
                        type="button"
                        onClick={() => setFullQrOpen(true)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-[11px] cursor-pointer"
                      >
                        <ZoomIn className="w-3.5 h-3.5" />
                        <span>Zoom QR</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        void downloadFileFromUrl(
                          resolvedQrUrl,
                          `${preClaim.requester_name}_Advance_QR.${isQrPdf ? 'pdf' : 'jpg'}`
                        )
                      }
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5" />
                      <span>Download QR</span>
                    </button>
                  </div>
                </div>
              )}

              {canManageClaims && (
                <div className="pt-2 border-t border-amber-200/80 space-y-3">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block font-bold text-amber-950 mb-1">
                        Advance Amount Disbursed (RM)
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={disburseAmountInput}
                        onChange={(e) => setDisburseAmountInput(e.target.value)}
                        className="w-full rounded-xl border border-amber-300 bg-white px-3 py-2 font-extrabold text-slate-900"
                      />
                    </div>
                    <div>
                      <label className="block font-bold text-amber-950 mb-1">
                        Account Source
                      </label>
                      <div className="grid grid-cols-2 gap-1 bg-white border border-amber-300 p-1 rounded-xl">
                        {(['Bank', 'Cash'] as AccountType[]).map((acct) => (
                          <button
                            key={acct}
                            type="button"
                            onClick={() => setDisburseAccount(acct)}
                            className={`py-1.5 rounded-lg font-bold inline-flex items-center justify-center gap-1 cursor-pointer ${
                              disburseAccount === acct
                                ? 'bg-emerald-600 text-white'
                                : 'text-slate-600 hover:bg-slate-100'
                            }`}
                          >
                            {acct === 'Cash' ? <Banknote className="w-3.5 h-3.5" /> : <Landmark className="w-3.5 h-3.5" />}
                            <span>{acct}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>

                  <label className="flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl border border-dashed border-emerald-400 bg-white hover:bg-emerald-50/50 cursor-pointer">
                    <span className="flex items-center gap-2 font-bold text-emerald-950 truncate">
                      <UploadCloud className="w-4 h-4 text-emerald-600 shrink-0" />
                      <span className="truncate">
                        {disburseProofFile ? disburseProofFile.name : 'Upload Proof of Transfer (Optional)'}
                      </span>
                    </span>
                    <span className="px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] shrink-0">
                      Choose
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setDisburseProofFile(e.target.files?.[0] || null)}
                      className="hidden"
                    />
                  </label>

                  <button
                    type="button"
                    disabled={processing !== null}
                    onClick={handleDisburseAdvance}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold inline-flex items-center justify-center gap-2 cursor-pointer"
                  >
                    {processing === 'disburse' ? (
                      <Loader2 className="w-4 h-4 animate-spin" />
                    ) : (
                      <Wallet className="w-4 h-4" />
                    )}
                    <span>Disburse Cash Advance &amp; Log Ledger Out</span>
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Disbursed Summary Banner */}
          {Number(preClaim.advance_disbursed_amount || 0) > 0 && (
            <div className="p-3.5 rounded-2xl bg-sky-50 border border-sky-200 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="font-extrabold text-sky-950">
                  Cash Advance Disbursed: RM {Number(preClaim.advance_disbursed_amount).toFixed(2)} ({preClaim.advance_account_type || 'Bank'})
                </div>
                {Number(preClaim.return_balance_amount || 0) > 0 && (
                  <div className="text-[11px] font-semibold text-amber-800">
                    Unused Balance to Return: RM {Number(preClaim.return_balance_amount).toFixed(2)}
                  </div>
                )}
              </div>
              {preClaim.advance_proof_url && (
                <a
                  href={preClaim.advance_proof_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white border border-sky-200 text-sky-900 font-bold text-[11px]"
                >
                  <span>Advance Proof</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              )}
            </div>
          )}

          {/* Bottom Member Actions */}
          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100">
            <div>
              {isOwnRequest && preClaim.status === 'Pending' && (
                <button
                  type="button"
                  disabled={processing !== null}
                  onClick={handleCancelOwn}
                  className="px-3.5 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                >
                  Cancel Request
                </button>
              )}
            </div>
            <div className="flex items-center gap-2">
              {canUploadReceiptNow && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onUploadReceipt?.(preClaim);
                  }}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  <Receipt className="w-4 h-4" />
                  <span>Upload Receipt →</span>
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      </div>

      <ModalShell
        open={Boolean(fullQrOpen && resolvedQrUrl && !isQrPdf)}
        onClose={() => setFullQrOpen(false)}
        zIndexClass="z-[75]"
        maxWidthClass="max-w-md"
        backdropClassName="bg-slate-950/90 backdrop-blur-xs"
        ariaLabel="DuitNow QR Preview"
      >
        {resolvedQrUrl && (
          <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl p-5 flex flex-col items-center gap-4 shadow-2xl border border-slate-200 dark:border-white/10">
            <div className="w-full flex items-center justify-between">
              <div className="text-sm font-extrabold">
                {preClaim.requester_name} — DuitNow QR
              </div>
              <button
                type="button"
                onClick={() => setFullQrOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 dark:bg-white/10 hover:bg-slate-200 dark:hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Close full QR"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={resolvedQrUrl}
              alt="QR"
              className="w-72 h-72 object-contain rounded-2xl border p-2 bg-white"
            />
            <button
              type="button"
              onClick={() =>
                void downloadFileFromUrl(resolvedQrUrl, `${preClaim.requester_name}_DuitNow_QR.jpg`)
              }
              className="w-full py-2.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4 inline mr-1" />
              Download QR
            </button>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(fullQuoteOpen && isQuoteImage)}
        onClose={() => setFullQuoteOpen(false)}
        zIndexClass="z-[75]"
        maxWidthClass="max-w-3xl"
        backdropClassName="bg-slate-950/90 backdrop-blur-xs"
        ariaLabel="Quotation Preview"
      >
        <div className="w-full bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl overflow-hidden shadow-2xl border border-slate-200 dark:border-white/10">
          <div className="px-5 py-3 border-b border-slate-200 dark:border-white/10 flex items-center justify-between">
            <span className="font-extrabold text-sm">Quotation Preview</span>
            <button type="button" onClick={() => setFullQuoteOpen(false)} className="cursor-pointer p-1 rounded-lg hover:bg-slate-100 dark:hover:bg-white/10">
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="bg-slate-950 p-4 flex justify-center max-h-[80vh]">
            <img src={quoteUrl} alt="Quotation Full" className="max-h-[72vh] object-contain rounded-xl bg-white" />
          </div>
        </div>
      </ModalShell>
    </ModalShell>
  );
}
