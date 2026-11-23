'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  Claim,
  PreClaim,
  Budget,
  UserProfile,
  ActivityLogEntry,
  DEFAULT_DEPARTMENTS,
  MAX_FILE_SIZE_BYTES,
  downloadFileFromUrl,
  logActivity,
} from '@/lib/supabase';
import {
  computeFieldChanges,
  recordEditHistory,
  softDeleteRecord,
  getRecordHistory,
} from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import {
  DuplicateClaimMatch,
  findDuplicateClaims,
  parseItemizedBreakdownFromDescription,
} from '@/lib/duplicateClaimDetector';
import {
  X,
  CheckCircle2,
  XCircle,
  ExternalLink,
  User,
  Phone,
  Hash,
  Loader2,
  FileText,
  Landmark,
  Copy,
  UploadCloud,
  ShieldCheck,
  Clock,
  AlertTriangle,
  Download,
  ZoomIn,
  Sparkles,
  Edit3,
  Trash2,
  History,
  ArrowRight,
  GitCompare,
} from 'lucide-react';
import type { MemberLookupHint } from '@/lib/memberLookup';

interface AuditReviewModalProps {
  claim: Claim | null;
  linkedPreClaim?: PreClaim | null;
  budget: Budget | undefined;
  budgets?: Budget[];
  departments?: string[];
  logs?: ActivityLogEntry[];
  allClaims?: Claim[];
  claimantProfile?: UserProfile;
  onSelectClaim?: (claim: Claim) => void;
  profile: UserProfile;
  /** True only for the club Owner (President / Advisor) acting in Owner mode. */
  isOwner?: boolean;
  /** Database UUID of club Owner so Stage 1 verification can notify them. */
  ownerUserId?: string | null;
  /** True when the claimant who submitted this claim is the club Owner. */
  isClaimantOwner?: boolean;
  /** Claims above this RM amount need Treasurer verification + Owner approval. */
  approvalThreshold?: number;
  onClose: () => void;
  onUpdated: (message: string) => void;
  onOpenMemberProfile?: (hint: MemberLookupHint) => void;
}

export default function AuditReviewModal({
  claim,
  linkedPreClaim = null,
  budget,
  budgets = [],
  departments = DEFAULT_DEPARTMENTS,
  logs = [],
  allClaims = [],
  claimantProfile,
  onSelectClaim,
  profile,
  isOwner = false,
  ownerUserId = null,
  isClaimantOwner = false,
  approvalThreshold = 200,
  onClose,
  onUpdated,
  onOpenMemberProfile,
}: AuditReviewModalProps) {
  const [remarks, setRemarks] = useState('');
  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [fullImageOpen, setFullImageOpen] = useState(false);
  const [fullQrOpen, setFullQrOpen] = useState(false);
  const [rightTab, setRightTab] = useState<'overview' | 'payout' | 'history'>('overview');
  const [processing, setProcessing] = useState<'Approved' | 'Rejected' | 'ProofOnly' | 'Verified' | null>(
    null
  );

  // Edit & soft-delete state
  const [isEditingClaim, setIsEditingClaim] = useState(false);
  const [editTitle, setEditTitle] = useState('');
  const [editCategory, setEditCategory] = useState('');
  const [editAmount, setEditAmount] = useState('');
  const [editExpenseDate, setEditExpenseDate] = useState('');
  const [editMerchant, setEditMerchant] = useState('');
  const [editBudgetId, setEditBudgetId] = useState<string>('GENERAL');
  const [editPaymentInfo, setEditPaymentInfo] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editStatus, setEditStatus] = useState<'Pending' | 'Approved' | 'Rejected'>('Pending');
  const [editReceiptFile, setEditReceiptFile] = useState<File | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [confirmDeleteClaim, setConfirmDeleteClaim] = useState(false);
  const [deletingClaim, setDeletingClaim] = useState(false);
  const [compareMatch, setCompareMatch] = useState<DuplicateClaimMatch | null>(null);
  const [copiedDeepLink, setCopiedDeepLink] = useState(false);
  const [auditCheckLoading, setAuditCheckLoading] = useState(false);
  const [auditCheckResult, setAuditCheckResult] = useState<string | null>(null);
  const [auditCheckSource, setAuditCheckSource] = useState<'gemini' | 'local' | null>(null);
  const [auditCheckErr, setAuditCheckErr] = useState<string | null>(null);

  useEffect(() => {
    if (claim) {
      setRemarks(
        claim.review_remarks ||
          (claim as unknown as { treasurer_remarks?: string }).treasurer_remarks ||
          ''
      );
      setPayoutFile(null);
      setErrorMsg(null);
      setFullImageOpen(false);
      setFullQrOpen(false);
      setRightTab('overview');
      setIsEditingClaim(false);
      setConfirmDeleteClaim(false);
      setCompareMatch(null);
      setAuditCheckLoading(false);
      setAuditCheckResult(null);
      setAuditCheckSource(null);
      setAuditCheckErr(null);
      setEditTitle(claim.title || '');
      setEditCategory(claim.category || departments[0] || 'Member');
      setEditAmount(String(claim.amount ?? ''));
      setEditExpenseDate(claim.expense_date || '');
      setEditMerchant(claim.merchant_name || '');
      setEditBudgetId(claim.budget_id || 'GENERAL');
      setEditPaymentInfo(claim.payment_info || '');
      setEditDescription(claim.description || '');
      setEditStatus(claim.status || 'Pending');
      setEditReceiptFile(null);
    }
  }, [claim, departments]);

  if (!claim) return null;

  const parsedClaimDesc = parseItemizedBreakdownFromDescription(claim.description);
  const duplicateMatches = findDuplicateClaims(
    {
      excludeClaimId: claim.id,
      amount: Number(claim.amount),
      expenseDate: claim.expense_date,
      merchantName: claim.merchant_name,
      receiptFileName: claim.receipt_file_name,
      rawOcrText: claim.ai_ocr_summary || claim.description,
      lineItems: parsedClaimDesc.items.map((it) => ({
        shop: it.shop,
        amount: it.amount,
      })),
    },
    allClaims
  );

  const isTreasurer = profile.role === 'treasurer' || profile.role === 'owner';
  const myLabel = `${profile.full_name} (${profile.matric_no})`;
  const verifiedBy = claim.treasurer_verified_by || '';
  const stage1Done = Boolean(verifiedBy);
  const isOwnClaim = claim.user_id === profile.id;
  const canEditOrDelete = isTreasurer || isOwnClaim;
  const claimHistory = getRecordHistory('claims', claim.id, logs);
  const isOwnerClaim = Boolean(
    isClaimantOwner || (isOwnClaim && (isOwner || profile.role === 'owner'))
  );
  // Owner claims bypass Stage 2 Owner sign-off so Treasurer approval completes them in 1 step.
  const needsTwoStage = Number(claim.amount) > approvalThreshold && !isOwnerClaim;
  const finalBy = claim.final_approved_by || '';
  const isPdf =
    claim.receipt_file_name?.toLowerCase().endsWith('.pdf') ||
    claim.receipt_url?.toLowerCase().split('?')[0].endsWith('.pdf') ||
    claim.receipt_url?.startsWith('data:application/pdf');

  // Extract reimbursement bank info & DuitNow QR from claim or claimant profile fallback
  const rawDescBank = claim.description?.includes('Reimburse To:')
    ? claim.description.split('Reimburse To:')[1]?.split('[Items:')[0]?.trim() || ''
    : '';
  const profileBankFallback = claimantProfile?.bank_account_no
    ? `${claimantProfile.bank_name || 'Bank/DuitNow'} • ${claimantProfile.bank_account_no} (${
        claimantProfile.bank_account_holder || claimantProfile.full_name
      })`
    : '';
  const extractedBankInfo = claim.payment_info || rawDescBank || profileBankFallback;

  const resolvedClaimantQrUrl = claim.claimant_qr_url || claimantProfile?.bank_qr_url || '';
  const isClaimantQrPdf =
    resolvedClaimantQrUrl.toLowerCase().split('?')[0].endsWith('.pdf') ||
    resolvedClaimantQrUrl.startsWith('data:application/pdf');

  const proofUrl = claim.payout_proof_url || '';
  const proofName = claim.payout_proof_name || 'Reimbursement_Proof';

  const renderPreClaimSettlementBox = () => {
    if (!linkedPreClaim) return null;
    const capVal = Number(linkedPreClaim.approved_cap ?? linkedPreClaim.estimated_amount ?? 0);
    const claimAmt = Number(claim.amount || 0);
    const withinCap = claimAmt <= capVal;
    const advGiven = Number(linkedPreClaim.advance_disbursed_amount || 0);
    const netTopUp = advGiven > 0 ? Math.max(0, claimAmt - advGiven) : claimAmt;
    const balanceReturned = advGiven > 0 ? Math.max(0, advGiven - claimAmt) : 0;

    return (
      <div className="rounded-2xl border border-sky-200 bg-sky-50/75 p-3.5 space-y-2 text-xs">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="font-extrabold text-sky-950">
            Pre-Claim: {linkedPreClaim.title}
          </span>
          <span
            className={`px-2 py-0.5 rounded-full text-[10px] font-extrabold ${
              withinCap
                ? 'bg-emerald-100 text-emerald-800'
                : 'bg-amber-100 text-amber-950 border border-amber-300'
            }`}
          >
            {withinCap
              ? `✓ Within Cap (RM ${claimAmt.toFixed(2)} / RM ${capVal.toFixed(2)})`
              : `⚠ Exceeds Cap by RM ${(claimAmt - capVal).toFixed(2)}`}
          </span>
        </div>
        {advGiven > 0 && (
          <div className="pt-1.5 border-t border-sky-200/80 flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className="text-slate-700">
              Advance Given: <strong className="text-slate-900">RM {advGiven.toFixed(2)}</strong>
              {' · '}
              {balanceReturned > 0.004 ? (
                <strong className="text-amber-800">
                  Balance Returned by Member: RM {balanceReturned.toFixed(2)}
                </strong>
              ) : netTopUp > 0.004 ? (
                <strong className="text-emerald-800">
                  Net Top-Up to Pay: RM {netTopUp.toFixed(2)}
                </strong>
              ) : (
                <strong className="text-emerald-700">Exact Match (RM 0.00 due)</strong>
              )}
            </span>
            {linkedPreClaim.return_proof_url && (
              <a
                href={linkedPreClaim.return_proof_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg bg-white border border-sky-200 font-bold text-sky-800 hover:underline"
              >
                <span>Return Slip</span>
                <ExternalLink className="w-3 h-3" />
              </a>
            )}
          </div>
        )}
      </div>
    );
  };

  const uploadProofFileIfPresent = async (): Promise<{ url: string; name: string } | null> => {
    if (!payoutFile) return null;
    if (payoutFile.size > MAX_FILE_SIZE_BYTES) {
      throw new Error('Proof file must be under 50 MB.');
    }
    const ext = payoutFile.name.split('.').pop() || 'pdf';
    const path = `reimbursements/${claim.id}-${Date.now()}.${ext}`;
    const { error } = await supabase.storage.from('receipts').upload(path, payoutFile);
    if (error) throw error;
    const publicUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
    return { url: publicUrl, name: payoutFile.name };
  };

  const handleVerifyStage1 = async () => {
    setErrorMsg(null);
    setProcessing('Verified');
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('claims')
        .update({
          treasurer_verified_by: myLabel,
          treasurer_verified_at: nowIso,
          review_remarks: remarks.trim() || 'Verified by Treasurer — awaiting President/Advisor approval',
        })
        .eq('id', claim.id);
      if (error) {
        setErrorMsg(
          'Could not save the verification. The database needs the latest update — ask the owner to run the new SQL migration in Supabase.'
        );
        return;
      }
      void logActivity(
        profile,
        'Claims',
        'Claim verified (Stage 1)',
        `${myLabel} verified claim "${claim.title}" of RM ${Number(claim.amount).toFixed(2)} by ${claim.claimant_name}. Awaiting President/Advisor approval.`
      );
      void recordEditHistory({
        actor: profile,
        category: 'Claims',
        table: 'claims',
        recordId: claim.id,
        recordTitle: claim.title,
        changes: computeFieldChanges([
          { field: 'Stage 1 Verification', before: claim.treasurer_verified_by || '(pending)', after: myLabel },
        ]),
      });
      if (claim.user_id) {
        void emitClubNotification({
          targetUserId: claim.user_id,
          type: 'claim',
          title: `Claim Stage 1 Verified: ${claim.title}`,
          body: `RM ${Number(claim.amount).toFixed(2)} verified by Treasurer — awaiting Owner approval.`,
          targetTab: 'claims',
          targetId: claim.id,
          actorName: profile.full_name,
        });
      }
      if (ownerUserId && ownerUserId !== claim.user_id && ownerUserId !== profile.id) {
        void emitClubNotification({
          targetUserId: ownerUserId,
          type: 'claim',
          title: `Owner Approval Needed: ${claim.title}`,
          body: `${claim.claimant_name} • RM ${Number(claim.amount).toFixed(2)} passed Treasurer check.`,
          targetTab: 'claims',
          targetId: claim.id,
          actorName: profile.full_name,
        });
      }
      onUpdated('Stage 1 done — sent to President / Advisor for final approval.');
      onClose();
    } finally {
      setProcessing(null);
    }
  };

  const handleDecision = async (decision: 'Approved' | 'Rejected') => {
    setErrorMsg(null);
    setProcessing(decision);
    try {
      const uploadedProof = await uploadProofFileIfPresent();
      const nowIso = new Date().toISOString();

      const remarkText =
        remarks.trim() || (decision === 'Approved' ? 'Verified & Reimbursed' : 'Rejected');

      const coreUpdate: Record<string, unknown> = {
        status: decision,
        reviewed_by: myLabel,
        review_remarks: remarkText,
        reviewed_at: nowIso,
      };

      const fullUpdate: Record<string, unknown> = {
        ...coreUpdate,
        ...(decision === 'Approved' &&
        (needsTwoStage || isOwnerClaim || Number(claim.amount) > approvalThreshold)
          ? {
              treasurer_verified_by: claim.treasurer_verified_by || myLabel,
              treasurer_verified_at: claim.treasurer_verified_at || nowIso,
              final_approved_by: myLabel,
              final_approved_at: nowIso,
            }
          : {}),
        ...(uploadedProof
          ? {
              payout_proof_url: uploadedProof.url,
              payout_proof_name: uploadedProof.name,
              paid_at: nowIso,
            }
          : {}),
      };

      const updateCandidates: Record<string, unknown>[] = [
        fullUpdate,
        coreUpdate,
        {
          status: decision,
          treasurer_remarks: remarkText,
          reviewed_by: myLabel,
          reviewed_at: nowIso,
        },
        {
          status: decision,
          reviewed_by: myLabel,
          reviewed_at: nowIso,
        },
      ];

      let lastErr: unknown = null;
      let updated = false;
      for (const payload of updateCandidates) {
        const { error } = await supabase.from('claims').update(payload).eq('id', claim.id);
        if (!error) {
          updated = true;
          break;
        }
        lastErr = error;
      }
      if (!updated) throw lastErr;

      if (decision === 'Approved' && claim.status !== 'Approved' && budget) {
        const newSpent = Number(budget.spent_amount) + Number(claim.amount);
        await supabase
          .from('budgets')
          .update({ spent_amount: newSpent })
          .eq('id', budget.id);
      }

      if (decision === 'Approved' && linkedPreClaim) {
        const advDisbursed = Number(linkedPreClaim.advance_disbursed_amount || 0);
        const claimAmt = Number(claim.amount || 0);
        const returnDiff = advDisbursed > 0 && claimAmt < advDisbursed
          ? Number((advDisbursed - claimAmt).toFixed(2))
          : 0;

        if (returnDiff > 0 && linkedPreClaim.status !== 'Settled') {
          const eventScope =
            budget?.event_name || linkedPreClaim.custom_event_name || 'General Club Fund';
          const retAcct = linkedPreClaim.advance_account_type === 'Cash' ? 'Cash' : 'Bank';
          const retPayload = {
            entry_type: 'IN',
            title: `Cash Advance Balance Return — ${claim.title}`,
            category: 'Cash Advance Return',
            event_name: eventScope,
            amount: returnDiff,
            account_type: retAcct,
            entry_date: nowIso.split('T')[0],
            person_in_charge: `${claim.claimant_name} (${claim.matric_no})`,
            notes: `Auto-settled balance returned from Cash Advance RM ${advDisbursed.toFixed(2)} vs Receipt RM ${claimAmt.toFixed(2)}`,
            attachment_url: linkedPreClaim.return_proof_url || '',
            attachment_name: linkedPreClaim.return_proof_url ? 'Return_Transfer_Slip' : '',
          };
          const { error: retLedErr } = await supabase.from('ledger_entries').insert(retPayload);
          if (retLedErr) {
            await supabase.from('ledger_entries').insert({
              entry_type: 'IN',
              title: retPayload.title,
              category: retPayload.category,
              amount: retPayload.amount,
              entry_date: retPayload.entry_date,
              person_in_charge: retPayload.person_in_charge,
              notes: retPayload.notes,
            });
          }
        }

        await supabase
          .from('pre_claims')
          .update({
            status: 'Settled',
            linked_claim_id: claim.id,
            return_balance_amount: returnDiff,
            return_verified_by: myLabel,
            return_verified_at: nowIso,
          })
          .eq('id', linkedPreClaim.id);
      }
      void logActivity(
        profile,
        'Claims',
        decision === 'Approved'
          ? needsTwoStage
            ? 'Claim final-approved (Stage 2)'
            : 'Claim approved'
          : 'Claim rejected',
        `${myLabel} ${decision === 'Approved' ? 'approved' : 'rejected'} claim "${claim.title}" of RM ${Number(
          claim.amount
        ).toFixed(2)} by ${claim.claimant_name} (${claim.matric_no})` +
          (remarks.trim() ? ` — "${remarks.trim()}"` : '')
      );
      void recordEditHistory({
        actor: profile,
        category: 'Claims',
        table: 'claims',
        recordId: claim.id,
        recordTitle: claim.title,
        changes: computeFieldChanges([
          { field: 'Status', before: claim.status, after: decision },
          { field: 'Review Remarks', before: claim.review_remarks || '', after: remarkText },
        ]),
      });
      if (claim.user_id) {
        void emitClubNotification({
          targetUserId: claim.user_id,
          type: 'claim',
          title: `Claim ${decision}: ${claim.title}`,
          body: `RM ${Number(claim.amount).toFixed(2)}${remarks.trim() ? ` — ${remarks.trim()}` : ''}`,
          targetTab: 'claims',
          targetId: claim.id,
          actorName: profile.full_name,
        });
      }
      onUpdated(`Claim ${decision.toLowerCase()}!`);
      onClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error
          ? err.message
          : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as { message: unknown }).message)
          : 'Something went wrong. Please try again.';
      setErrorMsg(msg);
    } finally {
      setProcessing(null);
    }
  };

  const handleUploadProofOnly = async () => {
    if (!payoutFile) return;
    setProcessing('ProofOnly');
    try {
      const uploaded = await uploadProofFileIfPresent();
      if (uploaded) {
        const nowIso = new Date().toISOString();
        await supabase
          .from('claims')
          .update({
            payout_proof_url: uploaded.url,
            payout_proof_name: uploaded.name,
            paid_at: nowIso,
          })
          .eq('id', claim.id);
        onUpdated('Proof of reimbursement uploaded!');
        onClose();
      }
    } finally {
      setProcessing(null);
    }
  };

  const handleSaveClaimEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEditOrDelete) return;
    setErrorMsg(null);
    const nextAmt = parseFloat(editAmount);
    if (!editTitle.trim() || isNaN(nextAmt) || nextAmt <= 0) {
      setErrorMsg('Please provide a valid title and RM amount.');
      return;
    }

    setSavingEdit(true);
    try {
      let nextReceiptUrl = claim.receipt_url;
      let nextReceiptName = claim.receipt_file_name;
      if (editReceiptFile) {
        if (editReceiptFile.size > MAX_FILE_SIZE_BYTES) {
          setErrorMsg('Receipt file must be under 50 MB.');
          return;
        }
        const ext = editReceiptFile.name.split('.').pop() || 'jpg';
        const path = `claims/${claim.user_id}/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, editReceiptFile);
        if (!upErr) {
          nextReceiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
          nextReceiptName = editReceiptFile.name;
        } else {
          nextReceiptUrl = await new Promise<string>((resolve, reject) => {
            const r = new FileReader();
            r.onload = () => resolve(String(r.result || ''));
            r.onerror = () => reject(upErr);
            r.readAsDataURL(editReceiptFile);
          });
          nextReceiptName = editReceiptFile.name;
        }
      }

      const nextBudgetId = editBudgetId === 'GENERAL' ? null : editBudgetId;
      const effectiveStatus = isTreasurer ? editStatus : claim.status;

      const coreUpdate: Record<string, unknown> = {
        title: editTitle.trim(),
        category: editCategory.trim() || claim.category,
        amount: nextAmt,
        expense_date: editExpenseDate || claim.expense_date,
        merchant_name: editMerchant.trim() || claim.merchant_name,
        budget_id: nextBudgetId,
        description: editDescription.trim(),
        receipt_url: nextReceiptUrl,
        receipt_file_name: nextReceiptName,
        status: effectiveStatus,
      };
      const fullUpdate: Record<string, unknown> = {
        ...coreUpdate,
        payment_info: editPaymentInfo.trim(),
      };

      let saved = false;
      let lastErr: unknown = null;
      for (const payload of [fullUpdate, coreUpdate]) {
        const { error } = await supabase.from('claims').update(payload).eq('id', claim.id);
        if (!error) {
          saved = true;
          break;
        }
        lastErr = error;
      }
      if (!saved) throw lastErr;

      // Keep budget spent_amount synchronized if amount or status changed for Approved claims
      if (budget && claim.status === 'Approved' && effectiveStatus === 'Approved' && nextAmt !== Number(claim.amount)) {
        const diff = nextAmt - Number(claim.amount);
        await supabase
          .from('budgets')
          .update({ spent_amount: Math.max(0, Number(budget.spent_amount) + diff) })
          .eq('id', budget.id);
      } else if (budget && claim.status === 'Approved' && effectiveStatus !== 'Approved') {
        await supabase
          .from('budgets')
          .update({ spent_amount: Math.max(0, Number(budget.spent_amount) - Number(claim.amount)) })
          .eq('id', budget.id);
      } else if (budget && claim.status !== 'Approved' && effectiveStatus === 'Approved') {
        await supabase
          .from('budgets')
          .update({ spent_amount: Number(budget.spent_amount) + nextAmt })
          .eq('id', budget.id);
      }

      const oldEventName = budgets.find((b) => b.id === claim.budget_id)?.event_name || claim.custom_event_name || 'General Club Expense';
      const newEventName = budgets.find((b) => b.id === nextBudgetId)?.event_name || 'General Club Expense';

      const changes = computeFieldChanges([
        { field: 'Title', before: claim.title, after: editTitle.trim() },
        { field: 'Department', before: claim.category, after: editCategory.trim() || claim.category },
        { field: 'Amount (RM)', before: Number(claim.amount).toFixed(2), after: nextAmt.toFixed(2) },
        { field: 'Expense Date', before: claim.expense_date, after: editExpenseDate || claim.expense_date },
        { field: 'Merchant', before: claim.merchant_name, after: editMerchant.trim() || claim.merchant_name },
        { field: 'Activity / Event', before: oldEventName, after: newEventName },
        { field: 'Bank / DuitNow', before: claim.payment_info || '', after: editPaymentInfo.trim() },
        { field: 'Description', before: claim.description || '', after: editDescription.trim() },
        { field: 'Status', before: claim.status, after: effectiveStatus },
        ...(editReceiptFile ? [{ field: 'Receipt File', before: claim.receipt_file_name, after: nextReceiptName }] : []),
      ]);

      void recordEditHistory({
        actor: profile,
        category: 'Claims',
        table: 'claims',
        recordId: claim.id,
        recordTitle: editTitle.trim(),
        changes,
      });

      setIsEditingClaim(false);
      onUpdated(`Updated claim "${editTitle.trim()}"!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Could not update claim.');
    } finally {
      setSavingEdit(false);
    }
  };

  const handleSoftDeleteClaim = async () => {
    if (!canEditOrDelete) return;
    setDeletingClaim(true);
    try {
      if (claim.status === 'Approved' && budget) {
        await supabase
          .from('budgets')
          .update({ spent_amount: Math.max(0, Number(budget.spent_amount) - Number(claim.amount)) })
          .eq('id', budget.id);
      }
      await softDeleteRecord({
        actor: profile,
        category: 'Claims',
        table: 'claims',
        recordId: claim.id,
        recordTitle: claim.title,
        extraSummary: `RM ${Number(claim.amount).toFixed(2)} by ${claim.claimant_name}`,
      });
      onUpdated(`Removed claim "${claim.title}" from web view (record kept in Supabase).`);
      onClose();
    } finally {
      setDeletingClaim(false);
    }
  };

  const parsedAiFlags = claim.ai_ocr_summary?.includes('| Flags:')
    ? claim.ai_ocr_summary
        .split('| Flags:')[1]
        ?.split(';')
        .map((s) => s.trim())
        .filter(Boolean) || []
    : [];

  const handleRunAiAuditCheck = async () => {
    if (auditCheckLoading) return;
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setAuditCheckErr('You are offline. Reconnect to run AI Audit Check.');
      return;
    }
    setAuditCheckErr(null);
    setAuditCheckLoading(true);
    try {
      const evAlloc = budget ? Number(budget.allocated_amount || 0) : null;
      const evSpent = budget ? Number(budget.spent_amount || 0) : null;
      const evRemaining =
        evAlloc !== null && evSpent !== null ? Number((evAlloc - evSpent).toFixed(2)) : null;

      const res = await fetch('/api/ai/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message:
            'Run a concise 3-bullet audit check for this claim: (1) Amount & OCR match, (2) Event budget impact, (3) Duplicate or OCR red flags.',
          history: [],
          mode: 'audit',
          role: isOwner ? 'owner' : 'treasurer',
          context: {
            claim_audit: {
              id: claim.id,
              title: claim.title,
              category: claim.category,
              amount: Number(claim.amount),
              expense_date: claim.expense_date,
              merchant_name: claim.merchant_name,
              status: claim.status,
              ai_extracted_amount: claim.ai_extracted_amount,
              ai_extracted_merchant: claim.ai_extracted_merchant,
              ai_extracted_date: claim.ai_extracted_date,
              ai_confidence: claim.ai_confidence,
              ai_ocr_summary: claim.ai_ocr_summary || null,
              anomaly_flags: parsedAiFlags,
              event_name: budget?.event_name || claim.custom_event_name || 'General Club Expense',
              event_allocated_budget: evAlloc,
              event_spent_amount: evSpent,
              event_remaining_budget: evRemaining,
              duplicate_matches_count: duplicateMatches.length,
              approval_threshold: approvalThreshold,
            },
          },
        }),
      });
      if (!res.ok) {
        throw new Error('Could not complete AI audit check.');
      }
      const data = (await res.json()) as { reply?: string; source?: 'gemini' | 'local' };
      setAuditCheckResult(data.reply || 'No audit summary available.');
      setAuditCheckSource(data.source === 'gemini' ? 'gemini' : 'local');
    } catch (err: unknown) {
      setAuditCheckErr(
        err instanceof Error ? err.message : 'Unable to run AI Audit Check right now.'
      );
    } finally {
      setAuditCheckLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-3xl w-full overflow-hidden my-4 sm:my-8">
        <div className="bg-emerald-800 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-2 sm:gap-3">
          <div className="min-w-0">
            <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
              Claim Details &amp; Reimbursement Proof
            </span>
            <h2 className="text-base font-bold mt-0.5 truncate">{claim.title}</h2>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              type="button"
              onClick={async () => {
                if (typeof window === 'undefined') return;
                const url = `${window.location.origin}/?tab=claims&claim=${claim.id}`;
                await navigator.clipboard.writeText(url);
                setCopiedDeepLink(true);
                setTimeout(() => setCopiedDeepLink(false), 1800);
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-white/15 hover:bg-white/25 text-white text-xs font-bold cursor-pointer"
              title="Copy shareable claim link"
            >
              <Copy className="w-3.5 h-3.5" />
              <span>{copiedDeepLink ? 'Copied!' : 'Copy Link'}</span>
            </button>
            {canEditOrDelete && (
              <>
                <button
                  type="button"
                  onClick={() => setIsEditingClaim((v) => !v)}
                  className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl text-xs font-bold cursor-pointer ${
                    isEditingClaim ? 'bg-amber-400 text-slate-950' : 'bg-white/15 hover:bg-white/25 text-white'
                  }`}
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{isEditingClaim ? 'Close Edit' : 'Edit'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setConfirmDeleteClaim((v) => !v)}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-rose-600/90 hover:bg-rose-500 text-white text-xs font-bold cursor-pointer"
                  title="Delete from web (kept in Supabase)"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
              </>
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

        {confirmDeleteClaim && (
          <div className="bg-rose-50 border-b border-rose-200 px-6 py-3 flex flex-wrap items-center justify-between gap-2 text-xs">
            <div className="text-rose-900 font-semibold">
              Remove &ldquo;{claim.title}&rdquo; from web view? (The row remains stored in Supabase unless manually deleted there.)
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteClaim(false)}
                className="px-3 py-1 rounded-lg bg-white border border-slate-200 font-bold text-slate-700 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={deletingClaim}
                onClick={handleSoftDeleteClaim}
                className="px-3 py-1 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
              >
                {deletingClaim ? 'Removing...' : 'Confirm Remove from Web'}
              </button>
            </div>
          </div>
        )}

        {duplicateMatches.length > 0 && (
          <div className="bg-amber-50 border-b-2 border-amber-300 px-6 py-3 space-y-2 text-xs text-amber-950">
            {duplicateMatches.map((match) => (
              <div
                key={match.claim.id}
                className="flex flex-wrap items-center justify-between gap-2 bg-white/85 border border-amber-200 rounded-xl px-3 py-2"
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="font-extrabold text-amber-950">{match.headline}</div>
                  <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-amber-800">
                    <span className="px-1.5 py-0.5 rounded bg-amber-100 font-bold">
                      {match.claim.status}
                    </span>
                    <span>{match.reasons.join(' • ')}</span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setCompareMatch(match)}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  <GitCompare className="w-3.5 h-3.5" />
                  <span>Click to compare</span>
                </button>
              </div>
            ))}
          </div>
        )}

        {isEditingClaim ? (
          <form onSubmit={handleSaveClaimEdit} className="p-6 space-y-3 text-xs max-h-[82vh] overflow-y-auto">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Claim Title *</label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Amount (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editAmount}
                  onChange={(e) => setEditAmount(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 font-bold"
                  required
                />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Expense Date</label>
                <input
                  type="date"
                  value={editExpenseDate}
                  onChange={(e) => setEditExpenseDate(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Merchant</label>
                <input
                  type="text"
                  value={editMerchant}
                  onChange={(e) => setEditMerchant(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Department</label>
                <select
                  value={editCategory}
                  onChange={(e) => setEditCategory(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                >
                  {departments.map((d) => (
                    <option key={d} value={d}>{d}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Related Activity / Event</label>
                <select
                  value={editBudgetId}
                  onChange={(e) => setEditBudgetId(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2"
                >
                  <option value="GENERAL">General Club Expense</option>
                  {budgets.map((b) => (
                    <option key={b.id} value={b.id}>{b.event_name}</option>
                  ))}
                </select>
              </div>
              {isTreasurer && (
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Claim Status</label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value as 'Pending' | 'Approved' | 'Rejected')}
                    className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Approved">Approved</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              )}
            </div>
            <div>
              <label className="block font-bold text-emerald-900 mb-1">Bank / DuitNow / TNG Info</label>
              <input
                type="text"
                value={editPaymentInfo}
                onChange={(e) => setEditPaymentInfo(e.target.value)}
                placeholder="Bank Name • Account No (Holder)"
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 font-mono"
              />
            </div>
            <div>
              <label className="block font-bold text-emerald-900 mb-1">Description / Notes</label>
              <textarea
                rows={2}
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2"
              />
            </div>
            <div>
              <label className="block font-bold text-emerald-900 mb-1">Replace Receipt File (Optional)</label>
              <input
                type="file"
                accept="image/*,application/pdf"
                onChange={(e) => setEditReceiptFile(e.target.files?.[0] || null)}
                className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
              />
            </div>
            {errorMsg && (
              <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {errorMsg}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setIsEditingClaim(false)}
                className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={savingEdit}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                {savingEdit && <Loader2 className="w-4 h-4 animate-spin" />}
                <span>Save Claim Changes</span>
              </button>
            </div>
          </form>
        ) : (
        <div className="p-4 sm:p-6 grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 max-h-[82vh] overflow-y-auto overflow-x-hidden">
          <div className="space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-xs font-bold text-emerald-900 uppercase">
                Claimant Receipt / Invoice
              </span>
              <div className="flex items-center gap-2">
                {!isPdf && claim.receipt_url && (
                  <button
                    type="button"
                    onClick={() => setFullImageOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-xs font-bold text-emerald-800 cursor-pointer"
                  >
                    <ZoomIn className="w-3.5 h-3.5" />
                    <span>Zoom Full</span>
                  </button>
                )}
                {claim.receipt_url && (
                  <button
                    type="button"
                    onClick={() => void downloadFileFromUrl(claim.receipt_url, claim.receipt_file_name || 'receipt.jpg')}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-xs font-bold text-white cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>{isPdf ? 'Download PDF' : 'Download JPG'}</span>
                  </button>
                )}
                {claim.receipt_url && !claim.receipt_url.startsWith('data:') && (
                  <a
                    href={claim.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
                  >
                    <span>Open Full File</span>
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </div>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 overflow-hidden flex items-center justify-center min-h-[260px]">
              {isPdf ? (
                <div className="p-6 text-center space-y-2">
                  <FileText className="w-12 h-12 text-emerald-700 mx-auto" />
                  <p className="text-xs font-bold text-slate-800">
                    {claim.receipt_file_name || 'PDF Document'}
                  </p>
                  <a
                    href={claim.receipt_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-block px-4 py-2 rounded-xl bg-emerald-700 text-white text-xs font-bold"
                  >
                    View PDF Receipt
                  </a>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setFullImageOpen(true)}
                  className="w-full flex items-center justify-center p-2 cursor-zoom-in group relative"
                  title="Click to inspect full resolution receipt photo"
                >
                  <img
                    src={claim.receipt_url}
                    alt={claim.title}
                    className="max-h-[300px] w-auto object-contain rounded-lg"
                  />
                </button>
              )}
            </div>

            {(claim.ai_extracted_amount !== null ||
              claim.ai_extracted_merchant ||
              claim.ai_extracted_date ||
              claim.ai_ocr_summary) && (
              <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 px-3 py-2 text-[11px] text-emerald-950 space-y-1.5">
                <div className="font-extrabold flex items-center gap-1 text-emerald-800">
                  <Sparkles className="w-3.5 h-3.5 shrink-0" />
                  <span>
                    Scanned Receipt Key Info
                    {claim.ai_confidence ? ` (${claim.ai_confidence}% match)` : ''}
                  </span>
                </div>
                {(claim.ai_extracted_amount !== null ||
                  claim.ai_extracted_merchant ||
                  claim.ai_extracted_date) && (
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 text-slate-700">
                    {claim.ai_extracted_amount !== null && (
                      <span>
                        Amount:{' '}
                        <strong className="text-slate-900">
                          RM {Number(claim.ai_extracted_amount).toFixed(2)}
                        </strong>
                      </span>
                    )}
                    {claim.ai_extracted_merchant && (
                      <span>
                        Merchant: <strong className="text-slate-900">{claim.ai_extracted_merchant}</strong>
                      </span>
                    )}
                    {claim.ai_extracted_date && (
                      <span>
                        Date: <strong className="text-slate-900">{claim.ai_extracted_date}</strong>
                      </span>
                    )}
                  </div>
                )}
                {parsedAiFlags.length > 0 && (
                  <div className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1.5 text-amber-950 space-y-0.5">
                    <div className="font-extrabold text-amber-800 flex items-center gap-1">
                      <AlertTriangle className="w-3 h-3 shrink-0" />
                      <span>AI Verification Flags</span>
                    </div>
                    <ul className="list-disc pl-4 space-y-0.5">
                      {parsedAiFlags.map((flag, i) => (
                        <li key={i}>{flag}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {parsedAiFlags.length === 0 && claim.ai_ocr_summary && (
                  <div className="text-[10px] text-slate-500 break-words">
                    {claim.ai_ocr_summary}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-2xl text-xs">
              <button
                type="button"
                onClick={() => setRightTab('overview')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold cursor-pointer transition ${
                  rightTab === 'overview'
                    ? 'bg-white text-emerald-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Overview
              </button>
              {isTreasurer && (
                <button
                  type="button"
                  onClick={() => setRightTab('payout')}
                  className={`flex-1 py-2 px-3 rounded-xl font-bold cursor-pointer transition ${
                    rightTab === 'payout'
                      ? 'bg-emerald-600 text-white shadow-2xs'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Pay &amp; Approve
                </button>
              )}
              <button
                type="button"
                onClick={() => setRightTab('history')}
                className={`flex-1 py-2 px-3 rounded-xl font-bold cursor-pointer transition ${
                  rightTab === 'history'
                    ? 'bg-white text-emerald-950 shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                History ({claimHistory.length})
              </button>
            </div>

            {rightTab === 'overview' && (
              <div className="space-y-4">
                {renderPreClaimSettlementBox()}
                <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 space-y-1.5 text-xs">
                  <div className="flex items-center gap-2 text-slate-800">
                    <User className="w-3.5 h-3.5 text-emerald-700" />
                    {onOpenMemberProfile ? (
                      <button
                        type="button"
                        onClick={() =>
                          onOpenMemberProfile({
                            userId: claim.user_id,
                            matricNo: claim.matric_no,
                            name: claim.claimant_name,
                          })
                        }
                        className="font-bold hover:text-emerald-700 hover:underline cursor-pointer text-left"
                        title="View student profile"
                      >
                        {claim.claimant_name}
                      </button>
                    ) : (
                      <span className="font-bold">{claim.claimant_name}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Hash className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-mono font-semibold">{claim.matric_no}</span>
                  </div>
                  <div className="flex items-center gap-2 text-slate-700">
                    <Phone className="w-3.5 h-3.5 text-emerald-700" />
                    <span className="font-mono">{claim.phone_number}</span>
                  </div>
                </div>

                {isOwnerClaim ? (
                  <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3.5 space-y-1.5 text-xs">
                    <div className="flex items-center gap-1.5 font-extrabold text-emerald-950">
                      <ShieldCheck className="w-4 h-4 text-emerald-700" />
                      <span>Owner&apos;s Claim — Direct Treasurer Approval</span>
                    </div>
                    <p className="text-emerald-800 leading-relaxed">
                      Once a Treasurer (Admin) approves this claim, it is immediately marked as Approved.
                    </p>
                  </div>
                ) : (
                  needsTwoStage && (
                    <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-2.5 text-xs">
                      <div className="flex items-center gap-1.5 font-extrabold text-indigo-950">
                        <ShieldCheck className="w-4 h-4 text-indigo-700" />
                        <span>2-stage approval (above RM {approvalThreshold.toFixed(0)})</span>
                      </div>
                      <ol className="space-y-2">
                        <li className="flex items-start gap-2">
                          {stage1Done ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : claim.status === 'Rejected' ? (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          ) : (
                            <Clock className="w-4 h-4 text-amber-500 shrink-0 mt-0.5" />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">1. Treasurer verification</div>
                            <div className="text-slate-600">
                              {stage1Done
                                ? `Verified by ${verifiedBy}${
                                    claim.treasurer_verified_at
                                      ? ` • ${new Date(claim.treasurer_verified_at).toLocaleString()}`
                                      : ''
                                  }`
                                : 'Waiting for Treasurer to verify receipt'}
                            </div>
                          </div>
                        </li>
                        <li className="flex items-start gap-2">
                          {claim.status === 'Approved' ? (
                            <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                          ) : claim.status === 'Rejected' ? (
                            <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                          ) : (
                            <Clock
                              className={`w-4 h-4 shrink-0 mt-0.5 ${
                                stage1Done ? 'text-amber-500' : 'text-slate-300'
                              }`}
                            />
                          )}
                          <div>
                            <div className="font-bold text-slate-900">2. President / Advisor approval</div>
                            <div className="text-slate-600">
                              {claim.status === 'Approved'
                                ? `Approved by ${finalBy || claim.reviewed_by || 'Owner'}`
                                : claim.status === 'Rejected'
                                ? `Rejected by ${claim.reviewed_by || 'reviewer'}`
                                : stage1Done
                                ? 'Waiting for Owner approval'
                                : 'Unlocks after Treasurer verification'}
                            </div>
                          </div>
                        </li>
                      </ol>
                    </div>
                  )
                )}

                <div className="rounded-2xl border border-emerald-200 p-4 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-500">Event:</span>
                    <span className="font-bold text-slate-900">
                      {budget?.event_name || 'Club Expense'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Department:</span>
                    <span className="font-bold text-emerald-800">{claim.category}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Amount:</span>
                    <span className="text-sm font-extrabold text-emerald-900">
                      RM {Number(claim.amount).toFixed(2)}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Merchant &amp; Date:</span>
                    <span className="font-semibold text-slate-800">
                      {claim.merchant_name} ({claim.expense_date})
                    </span>
                  </div>
                  {parsedClaimDesc.items.length > 0 && (
                    <div className="pt-2 border-t border-emerald-100 space-y-1.5">
                      <div className="text-[11px] font-extrabold text-emerald-900">
                        Itemized Receipt Breakdown ({parsedClaimDesc.items.length} receipts)
                      </div>
                      <div className="rounded-xl bg-emerald-50/70 border border-emerald-200 divide-y divide-emerald-100">
                        {parsedClaimDesc.items.map((item, idx) => (
                          <div
                            key={`itemized-${idx}`}
                            className="flex items-center justify-between px-2.5 py-1.5 text-[11px]"
                          >
                            <span className="font-semibold text-slate-800">
                              #{idx + 1} {item.shop}
                            </span>
                            <span className="font-extrabold text-emerald-900">
                              RM {item.amount.toFixed(2)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                  {parsedClaimDesc.cleanDescription && (
                    <p className="text-slate-600 pt-2 border-t border-emerald-100">
                      {parsedClaimDesc.cleanDescription}
                    </p>
                  )}
                </div>

                {proofUrl && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2 text-xs">
                    <div className="min-w-0">
                      <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                        ✓ Proof of Paid / Reimbursement
                      </span>
                      <span className="font-bold text-slate-900 truncate block">{proofName}</span>
                    </div>
                    <a
                      href={proofUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold shrink-0"
                    >
                      View Proof <ExternalLink className="w-3 h-3 inline ml-0.5" />
                    </a>
                  </div>
                )}

                {isTreasurer && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50/80 p-3.5 space-y-2.5 text-xs">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="font-extrabold text-slate-900 flex items-center gap-1.5">
                        <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                        <span>Reviewer Audit Assistant</span>
                      </span>
                      <button
                        type="button"
                        disabled={auditCheckLoading}
                        onClick={() => void handleRunAiAuditCheck()}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 disabled:opacity-60 text-white font-bold text-[11px] cursor-pointer shrink-0"
                      >
                        {auditCheckLoading ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <Sparkles className="w-3 h-3 text-emerald-300" />
                        )}
                        <span>{auditCheckLoading ? 'Checking...' : 'AI Audit Check'}</span>
                      </button>
                    </div>
                    {auditCheckErr && (
                      <div className="p-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-700 text-[11px] font-semibold">
                        {auditCheckErr}
                      </div>
                    )}
                    {auditCheckResult && (
                      <div className="p-3 rounded-xl bg-white border border-slate-200 space-y-1.5">
                        <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-700 block">
                          {auditCheckSource === 'gemini' ? 'Gemini AI Risk Check' : 'Automated Audit Check'}
                        </span>
                        <div className="text-[11px] text-slate-700 whitespace-pre-line leading-relaxed">
                          {auditCheckResult}
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {isTreasurer && claim.status === 'Pending' && (
                  <button
                    type="button"
                    onClick={() => setRightTab('payout')}
                    className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                  >
                    Proceed to Pay &amp; Approve →
                  </button>
                )}
              </div>
            )}

            {rightTab === 'payout' && isTreasurer && (
              <div className="space-y-4">
                {renderPreClaimSettlementBox()}
                <div className="p-4 rounded-2xl bg-amber-50 border border-amber-200 space-y-3 text-xs">
                  <div className="flex items-center justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-extrabold text-amber-950 flex items-center gap-1.5">
                        <Landmark className="w-3.5 h-3.5 text-amber-700" />
                        <span>Reimburse To</span>
                      </div>
                      <div className="font-mono font-bold text-slate-900 mt-1 break-all">
                        {extractedBankInfo || 'No bank account text provided.'}
                      </div>
                    </div>
                    {extractedBankInfo && (
                      <button
                        type="button"
                        onClick={() => navigator.clipboard.writeText(extractedBankInfo)}
                        className="px-2.5 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        <Copy className="w-3 h-3 inline mr-1" />
                        Copy
                      </button>
                    )}
                  </div>

                  {resolvedClaimantQrUrl ? (
                    <div className="pt-2.5 border-t border-amber-200/80 flex flex-wrap items-center gap-3">
                      {isClaimantQrPdf ? (
                        <div className="flex items-center gap-2">
                          <FileText className="w-5 h-5 text-amber-800" />
                          <span className="font-bold text-amber-950">Claimant DuitNow QR (PDF)</span>
                        </div>
                      ) : (
                        <button
                          type="button"
                          onClick={() => setFullQrOpen(true)}
                          className="p-1.5 bg-white rounded-xl border border-amber-200 shadow-2xs shrink-0 cursor-zoom-in"
                          title="Click to zoom Claimant DuitNow QR"
                        >
                          <img
                            src={resolvedClaimantQrUrl}
                            alt={`${claim.claimant_name} DuitNow QR`}
                            className="w-28 h-28 object-contain rounded-lg"
                          />
                        </button>
                      )}
                      <div className="flex flex-wrap gap-2">
                        {!isClaimantQrPdf ? (
                          <button
                            type="button"
                            onClick={() => setFullQrOpen(true)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-[11px] cursor-pointer"
                          >
                            <ZoomIn className="w-3.5 h-3.5" />
                            <span>View Full QR</span>
                          </button>
                        ) : (
                          <a
                            href={resolvedClaimantQrUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-white hover:bg-amber-100 border border-amber-200 text-amber-950 font-bold text-[11px]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open PDF QR</span>
                          </a>
                        )}
                        <button
                          type="button"
                          onClick={() =>
                            void downloadFileFromUrl(
                              resolvedClaimantQrUrl,
                              `${claim.claimant_name}_DuitNow_QR.${isClaimantQrPdf ? 'pdf' : 'jpg'}`
                            )
                          }
                          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] cursor-pointer"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>Download QR</span>
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="pt-2 border-t border-amber-200/80 text-[11px] text-amber-800">
                      No DuitNow QR uploaded by claimant.
                    </div>
                  )}
                </div>

                <label className="flex flex-col items-center justify-center gap-1.5 p-3.5 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/50 hover:bg-emerald-50 cursor-pointer text-center">
                  <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center">
                    <UploadCloud className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-emerald-950 break-all">
                    {payoutFile
                      ? payoutFile.name
                      : 'Upload Proof of Paid / Bank Transfer Receipt (PDF, JPG, PNG)'}
                  </div>
                  <span className="px-3 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px]">
                    {payoutFile ? 'Change Proof File' : 'Choose Proof File'}
                  </span>
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setPayoutFile(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>

                {claim.status === 'Pending' ? (
                  <>
                    <textarea
                      rows={2}
                      value={remarks}
                      onChange={(e) => setRemarks(e.target.value)}
                      placeholder="Review remarks / payment reference..."
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-xs"
                    />
                    {errorMsg && (
                      <div className="flex items-start gap-1.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 text-xs font-semibold">
                        <AlertTriangle className="w-4 h-4 shrink-0" />
                        <span>{errorMsg}</span>
                      </div>
                    )}
                    {(() => {
                      const rejectBtn = (
                        <button
                          type="button"
                          disabled={processing !== null}
                          onClick={() => handleDecision('Rejected')}
                          className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-rose-50 text-rose-700 border border-rose-200 cursor-pointer"
                        >
                          <XCircle className="w-4 h-4" />
                          <span>Reject</span>
                        </button>
                      );
                      const waitingNote = (text: string) => (
                        <div className="col-span-2 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 text-xs font-semibold flex items-start gap-1.5">
                          <Clock className="w-4 h-4 shrink-0" />
                          <span>{text}</span>
                        </div>
                      );

                      if (isOwnClaim) {
                        if (stage1Done && verifiedBy !== myLabel) {
                          return (
                            <div className="grid grid-cols-2 gap-2.5">
                              {waitingNote(
                                `Already verified by Treasurer (${verifiedBy}). Click below to finalize your claim.`
                              )}
                              <button
                                type="button"
                                disabled={processing !== null}
                                onClick={() => handleDecision('Approved')}
                                className="col-span-2 inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                              >
                                {processing === 'Approved' ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-4 h-4" />
                                )}
                                <span>Finalize Approval (Verified by Treasurer)</span>
                              </button>
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-2 gap-2.5">
                            {waitingNote(
                              'You cannot approve your own claim. A Treasurer (Admin) must review and approve it.'
                            )}
                          </div>
                        );
                      }

                      if (!needsTwoStage) {
                        return (
                          <div className="grid grid-cols-2 gap-2.5">
                            {rejectBtn}
                            <button
                              type="button"
                              disabled={processing !== null}
                              onClick={() => handleDecision('Approved')}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            >
                              {processing === 'Approved' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              <span>Approve &amp; Mark Paid</span>
                            </button>
                          </div>
                        );
                      }

                      if (!stage1Done) {
                        if (isOwner) {
                          return (
                            <div className="grid grid-cols-2 gap-2.5">
                              {waitingNote(
                                'Waiting for a Treasurer / Admin to verify this claim first. You will approve it in Stage 2.'
                              )}
                              {rejectBtn}
                            </div>
                          );
                        }
                        return (
                          <div className="grid grid-cols-2 gap-2.5">
                            {rejectBtn}
                            <button
                              type="button"
                              disabled={processing !== null}
                              onClick={handleVerifyStage1}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-indigo-600 hover:bg-indigo-500 text-white cursor-pointer"
                            >
                              {processing === 'Verified' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <ShieldCheck className="w-4 h-4" />
                              )}
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
                              onClick={() => handleDecision('Approved')}
                              className="inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                            >
                              {processing === 'Approved' ? (
                                <Loader2 className="w-4 h-4 animate-spin" />
                              ) : (
                                <CheckCircle2 className="w-4 h-4" />
                              )}
                              <span>Final Approve &amp; Mark Paid</span>
                            </button>
                          </div>
                        );
                      }
                      return (
                        <div className="grid grid-cols-2 gap-2.5">
                          {waitingNote(
                            verifiedBy === myLabel
                              ? 'You verified this claim. The Owner (President / Advisor) must now give final approval.'
                              : 'Verified. Waiting for the Owner (President / Advisor) to give final approval.'
                          )}
                          {rejectBtn}
                        </div>
                      );
                    })()}
                  </>
                ) : (
                  payoutFile && (
                    <button
                      type="button"
                      disabled={processing !== null}
                      onClick={handleUploadProofOnly}
                      className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                    >
                      {processing === 'ProofOnly'
                        ? 'Uploading Proof...'
                        : 'Save Proof of Paid Receipt'}
                    </button>
                  )
                )}
              </div>
            )}

            {rightTab === 'history' && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-2.5 text-xs">
                <div className="flex items-center justify-between font-extrabold text-slate-800">
                  <span className="flex items-center gap-1.5">
                    <History className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Edit History ({claimHistory.length})</span>
                  </span>
                </div>
                {claimHistory.length === 0 ? (
                  <p className="text-[11px] text-slate-400">No edits recorded yet.</p>
                ) : (
                  <div className="space-y-2 max-h-96 overflow-y-auto">
                    {claimHistory.map((ev) => (
                      <div key={ev.id} className="p-2.5 rounded-xl bg-white border border-slate-200 space-y-1">
                        <div className="flex justify-between gap-2 text-[11px]">
                          <span className="font-bold text-slate-900">
                            {ev.actorName} ({ev.action})
                          </span>
                          <span className="font-mono text-slate-400">
                            {new Date(ev.timestamp).toLocaleString()}
                          </span>
                        </div>
                        {ev.changes.length > 0 ? (
                          <div className="space-y-1">
                            {ev.changes.map((c, idx) => (
                              <div key={idx} className="flex flex-wrap items-center gap-1 text-[10px]">
                                <span className="font-bold text-slate-700">{c.field}:</span>
                                <span className="px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 line-through">{c.before}</span>
                                <ArrowRight className="w-2.5 h-2.5 text-slate-400" />
                                <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-800 font-bold">{c.after}</span>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-600">{ev.summary}</p>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
        )}
      </div>

      {fullQrOpen && resolvedClaimantQrUrl && !isClaimantQrPdf && (
        <div
          className="fixed inset-0 z-[65] bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          onClick={() => setFullQrOpen(false)}
        >
          <div
            className="max-w-md w-full bg-white rounded-3xl p-5 flex flex-col items-center gap-4 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-slate-900">
              <div>
                <div className="text-sm font-extrabold">{claim.claimant_name}</div>
                <div className="text-[11px] font-mono text-slate-500">DuitNow / TNG QR</div>
              </div>
              <button
                type="button"
                onClick={() => setFullQrOpen(false)}
                className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                aria-label="Close full QR"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={resolvedClaimantQrUrl}
              alt={`${claim.claimant_name} DuitNow QR`}
              className="w-72 h-72 object-contain rounded-2xl border border-amber-200 p-2 bg-white"
            />
            <button
              type="button"
              onClick={() =>
                void downloadFileFromUrl(
                  resolvedClaimantQrUrl,
                  `${claim.claimant_name}_DuitNow_QR.jpg`
                )
              }
              className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Download QR Image</span>
            </button>
          </div>
        </div>
      )}

      {fullImageOpen && !isPdf && claim.receipt_url && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          onClick={() => setFullImageOpen(false)}
        >
          <div
            className="max-w-5xl w-full flex flex-col items-center gap-3"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-full flex items-center justify-between text-white px-2">
              <div className="text-xs font-bold truncate">
                {claim.receipt_file_name || claim.title}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => void downloadFileFromUrl(claim.receipt_url, claim.receipt_file_name || 'receipt.jpg')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                >
                  <Download className="w-3.5 h-3.5" />
                  <span>Download JPG</span>
                </button>
                <button
                  type="button"
                  onClick={() => setFullImageOpen(false)}
                  className="w-8 h-8 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center cursor-pointer"
                  aria-label="Close full image"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
            <img
              src={claim.receipt_url}
              alt={claim.title}
              className="max-h-[84vh] w-auto max-w-full object-contain rounded-2xl bg-white shadow-2xl"
            />
          </div>
        </div>
      )}

      {compareMatch && (
        <div
          className="fixed inset-0 z-[60] bg-slate-950/80 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto"
          onClick={() => setCompareMatch(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border-2 border-amber-300 max-w-5xl w-full overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <AlertTriangle className="w-5 h-5 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-extrabold truncate">
                    Side-by-Side Comparison — Current Claim vs Claim #{compareMatch.claimNumber}
                  </h3>
                  <p className="text-[11px] text-amber-100 truncate">
                    {compareMatch.reasons.join(' • ')}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareMatch(null)}
                className="p-1 rounded-lg hover:bg-amber-500 cursor-pointer shrink-0"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-emerald-950 text-sm">
                    Current Claim ({claim.title})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-100 text-emerald-900">
                    {claim.status}
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  <div>
                    <span className="text-slate-500">Claimant:</span>{' '}
                    <strong>
                      {claim.claimant_name} ({claim.matric_no})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount:</span>{' '}
                    <strong className="text-emerald-900">
                      RM {Number(claim.amount).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Date:</span> <strong>{claim.expense_date}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Merchant:</span>{' '}
                    <strong>{claim.merchant_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">File:</span>{' '}
                    <span className="font-mono">{claim.receipt_file_name}</span>
                  </div>
                </div>
                {claim.receipt_url &&
                  (isPdf ? (
                    <a
                      href={claim.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 text-white font-bold"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Current PDF Receipt</span>
                    </a>
                  ) : (
                    <img
                      src={claim.receipt_url}
                      alt={claim.title}
                      className="max-h-80 w-full object-contain rounded-xl border bg-white p-1"
                    />
                  ))}
              </div>

              <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-amber-950 text-sm">
                    Claim #{compareMatch.claimNumber} ({compareMatch.claim.title})
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-950">
                    {compareMatch.claim.status}
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  <div>
                    <span className="text-slate-500">Claimant:</span>{' '}
                    <strong>
                      {compareMatch.claim.claimant_name} ({compareMatch.claim.matric_no})
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount:</span>{' '}
                    <strong className="text-amber-950">
                      RM {Number(compareMatch.claim.amount).toFixed(2)}
                    </strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Date:</span>{' '}
                    <strong>{compareMatch.claim.expense_date}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Merchant:</span>{' '}
                    <strong>{compareMatch.claim.merchant_name}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">File:</span>{' '}
                    <span className="font-mono">{compareMatch.claim.receipt_file_name}</span>
                  </div>
                </div>
                {compareMatch.claim.receipt_url &&
                  (compareMatch.claim.receipt_file_name?.toLowerCase().endsWith('.pdf') ||
                  compareMatch.claim.receipt_url.toLowerCase().split('?')[0].endsWith('.pdf') ? (
                    <a
                      href={compareMatch.claim.receipt_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-amber-600 text-white font-bold"
                    >
                      <FileText className="w-4 h-4" />
                      <span>Open Matched PDF Receipt</span>
                    </a>
                  ) : (
                    <img
                      src={compareMatch.claim.receipt_url}
                      alt={compareMatch.claim.title}
                      className="max-h-80 w-full object-contain rounded-xl border bg-white p-1"
                    />
                  ))}
              </div>
            </div>

            <div className="px-6 py-3 bg-slate-50 border-t flex flex-wrap items-center justify-end gap-2">
              {onSelectClaim && (
                <button
                  type="button"
                  onClick={() => {
                    onSelectClaim(compareMatch.claim);
                    setCompareMatch(null);
                  }}
                  className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
                >
                  Inspect Claim #{compareMatch.claimNumber}
                </button>
              )}
              <button
                type="button"
                onClick={() => setCompareMatch(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Close Comparison
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}