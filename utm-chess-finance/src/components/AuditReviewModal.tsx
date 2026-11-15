'use client';

import React, { useState, useEffect } from 'react';
import { supabase, Claim, Budget, UserProfile, MAX_FILE_SIZE_BYTES, logActivity } from '@/lib/supabase';
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
} from 'lucide-react';

interface AuditReviewModalProps {
  claim: Claim | null;
  budget: Budget | undefined;
  profile: UserProfile;
  /** True only for the club Owner (President / Advisor) acting in Owner mode. */
  isOwner?: boolean;
  /** Claims above this RM amount need Treasurer verification + Owner approval. */
  approvalThreshold?: number;
  onClose: () => void;
  onUpdated: (message: string) => void;
}

export default function AuditReviewModal({
  claim,
  budget,
  profile,
  isOwner = false,
  approvalThreshold = 200,
  onClose,
  onUpdated,
}: AuditReviewModalProps) {
  const [remarks, setRemarks] = useState('');
  const [payoutFile, setPayoutFile] = useState<File | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [processing, setProcessing] = useState<'Approved' | 'Rejected' | 'ProofOnly' | 'Verified' | null>(
    null
  );

  useEffect(() => {
    if (claim) {
      setRemarks(claim.review_remarks || '');
      setPayoutFile(null);
      setErrorMsg(null);
    }
  }, [claim]);

  if (!claim) return null;

  const isTreasurer = profile.role === 'treasurer' || profile.role === 'owner';
  const myLabel = `${profile.full_name} (${profile.matric_no})`;
  const needsTwoStage = Number(claim.amount) > approvalThreshold;
  const verifiedBy = claim.treasurer_verified_by || '';
  const stage1Done = Boolean(verifiedBy);
  const isOwnClaim = claim.user_id === profile.id;
  const finalBy = claim.final_approved_by || '';
  const isPdf =
    claim.receipt_file_name?.toLowerCase().endsWith('.pdf') ||
    claim.receipt_url?.toLowerCase().endsWith('.pdf');

  // Extract reimbursement bank info from claim.payment_info or description
  const extractedBankInfo =
    claim.payment_info ||
    (claim.description?.includes('Reimburse To:')
      ? claim.description.split('Reimburse To:')[1]?.trim()
      : '');

  const localProofRaw =
    typeof window !== 'undefined'
      ? localStorage.getItem(`clubsync_claim_proof_${claim.id}`)
      : null;
  let localProof: { url: string; name: string; paid_at: string } | null = null;
  if (localProofRaw) {
    try {
      localProof = JSON.parse(localProofRaw);
    } catch {
      /* ignore */
    }
  }

  const proofUrl = claim.payout_proof_url || localProof?.url || '';
  const proofName = claim.payout_proof_name || localProof?.name || 'Reimbursement_Proof';

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
    if (typeof window !== 'undefined') {
      localStorage.setItem(
        `clubsync_claim_proof_${claim.id}`,
        JSON.stringify({
          url: publicUrl,
          name: payoutFile.name,
          paid_at: new Date().toISOString(),
        })
      );
    }
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

      const coreUpdate: Record<string, unknown> = {
        status: decision,
        reviewed_by: myLabel,
        review_remarks:
          remarks.trim() ||
          (decision === 'Approved' ? 'Verified & Reimbursed' : 'Rejected'),
        reviewed_at: nowIso,
      };

      const fullUpdate: Record<string, unknown> = {
        ...coreUpdate,
        ...(decision === 'Approved' && needsTwoStage
          ? { final_approved_by: myLabel, final_approved_at: nowIso }
          : {}),
        ...(uploadedProof
          ? {
              payout_proof_url: uploadedProof.url,
              payout_proof_name: uploadedProof.name,
              paid_at: nowIso,
            }
          : {}),
      };

      const { error } = await supabase
        .from('claims')
        .update(fullUpdate)
        .eq('id', claim.id);
      if (error) {
        const { error: fallbackErr } = await supabase
          .from('claims')
          .update(coreUpdate)
          .eq('id', claim.id);
        if (fallbackErr) throw fallbackErr;
      }

      if (decision === 'Approved' && claim.status !== 'Approved' && budget) {
        const newSpent = Number(budget.spent_amount) + Number(claim.amount);
        await supabase
          .from('budgets')
          .update({ spent_amount: newSpent })
          .eq('id', budget.id);
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
      onUpdated(`Claim ${decision.toLowerCase()}!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Something went wrong. Please try again.');
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-3xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <span className="text-[11px] uppercase tracking-wider text-amber-300 font-bold">
              Claim Details &amp; Reimbursement Proof
            </span>
            <h2 className="text-base font-bold mt-0.5">{claim.title}</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-6 max-h-[82vh] overflow-y-auto">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-emerald-900 uppercase">
                Claimant Receipt / Invoice
              </span>
              <a
                href={claim.receipt_url}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700 hover:underline"
              >
                <span>Open Full File</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
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
                <img
                  src={claim.receipt_url}
                  alt={claim.title}
                  className="max-h-[300px] w-auto object-contain"
                />
              )}
            </div>

            {proofUrl && (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-300 flex items-center justify-between gap-2">
                <div>
                  <span className="text-[10px] font-extrabold uppercase text-emerald-700 block">
                    ✓ Official Proof of Paid / Reimbursement
                  </span>
                  <span className="text-xs font-bold text-slate-900 break-all">
                    {proofName}
                  </span>
                </div>
                <a
                  href={proofUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0"
                >
                  View Proof <ExternalLink className="w-3 h-3 inline ml-0.5" />
                </a>
              </div>
            )}
          </div>

          <div className="space-y-4">
            <div className="bg-emerald-50/70 rounded-2xl p-4 border border-emerald-200 space-y-1.5 text-xs">
              <div className="flex items-center gap-2 text-slate-800">
                <User className="w-3.5 h-3.5 text-emerald-700" />
                <span className="font-bold">{claim.claimant_name}</span>
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

            {needsTwoStage && (
              <div className="rounded-2xl border border-indigo-200 bg-indigo-50/60 p-3.5 space-y-2.5 text-xs">
                <div className="flex items-center gap-1.5 font-extrabold text-indigo-950">
                  <ShieldCheck className="w-4 h-4 text-indigo-700" />
                  <span>High-value claim — 2-stage approval (above RM {approvalThreshold.toFixed(0)})</span>
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
                          : 'Waiting for a Treasurer / Admin to check the receipt'}
                      </div>
                    </div>
                  </li>
                  <li className="flex items-start gap-2">
                    {claim.status === 'Approved' ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                    ) : claim.status === 'Rejected' ? (
                      <XCircle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                    ) : (
                      <Clock className={`w-4 h-4 shrink-0 mt-0.5 ${stage1Done ? 'text-amber-500' : 'text-slate-300'}`} />
                    )}
                    <div>
                      <div className="font-bold text-slate-900">2. President / Advisor approval</div>
                      <div className="text-slate-600">
                        {claim.status === 'Approved'
                          ? `Approved by ${finalBy || claim.reviewed_by || 'Owner'}`
                          : claim.status === 'Rejected'
                          ? `Rejected by ${claim.reviewed_by || 'reviewer'}`
                          : stage1Done
                          ? 'Waiting for the Owner (President / Advisor) to approve'
                          : 'Unlocks after Treasurer verification'}
                      </div>
                    </div>
                  </li>
                </ol>
              </div>
            )}

            {extractedBankInfo && (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 flex items-center justify-between gap-2 text-xs">
                <div>
                  <div className="font-extrabold text-amber-950 flex items-center gap-1">
                    <Landmark className="w-3.5 h-3.5 text-amber-700" />
                    <span>Reimburse To (Bank / DuitNow / TNG):</span>
                  </div>
                  <div className="font-mono font-bold text-slate-900 mt-0.5">
                    {extractedBankInfo}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => navigator.clipboard.writeText(extractedBankInfo)}
                  className="px-2.5 py-1.5 rounded-xl bg-amber-200/80 hover:bg-amber-300 text-amber-950 font-bold text-[11px] shrink-0 cursor-pointer"
                >
                  <Copy className="w-3 h-3 inline mr-1" />
                  Copy
                </button>
              </div>
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
              {claim.description && (
                <p className="text-slate-600 pt-2 border-t border-emerald-100">
                  {claim.description}
                </p>
              )}
            </div>

            {isTreasurer && (
              <div className="space-y-3">
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

                      // ---- Normal claims (at or below threshold): single approval ----
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
                              <span>Approve &amp; Save Proof</span>
                            </button>
                          </div>
                        );
                      }

                      // ---- High-value claims: Stage 1 (Treasurer) then Stage 2 (Owner) ----
                      if (isOwnClaim) {
                        return (
                          <div className="grid grid-cols-2 gap-2.5">
                            {waitingNote('You cannot verify or approve your own claim. Another admin must review it.')}
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
                              <span>Final Approve &amp; Save Proof</span>
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
          </div>
        </div>
      </div>
    </div>
  );
}