'use client';

import React, { useState } from 'react';
import { supabase, Claim, Budget, UserProfile } from '@/lib/supabase';
import { X, CheckCircle2, XCircle, ExternalLink, ShieldCheck, Loader2, Phone, Clock } from 'lucide-react';

export interface AuditReviewModalProps {
  claim: Claim | null;
  budget?: Budget;
  profile: UserProfile;
  onClose: () => void;
  onUpdated: (message: string) => void;
}

export default function AuditReviewModal({ claim, budget, profile, onClose, onUpdated }: AuditReviewModalProps) {
  const [remarks, setRemarks] = useState(claim?.treasurer_remarks || '');
  const [processing, setProcessing] = useState(false);

  if (!claim) return null;

  const isAdmin = profile.role === 'treasurer';
  const cleanDigits = claim.phone_number.replace(/[^0-9]/g, '');
  const waLink = `https://wa.me/${cleanDigits.startsWith('0') ? '6' + cleanDigits : cleanDigits}`;

  const handleDecision = async (newStatus: 'Approved' | 'Rejected') => {
    setProcessing(true);
    try {
      const defaultMsg = newStatus === 'Approved' ? 'Approved & Reimbursed by Admin' : 'Rejected by Admin';
      const { error } = await supabase
        .from('claims')
        .update({
          status: newStatus,
          treasurer_remarks: remarks.trim() || defaultMsg,
          reviewed_by: `${profile.full_name} (${profile.matric_no})`,
          reviewed_at: new Date().toISOString(),
        })
        .eq('id', claim.id);

      if (error) throw error;
      onUpdated(`Claim "${claim.title}" marked as ${newStatus}.`);
      onClose();
    } finally {
      setProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-2xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-5 h-5 text-emerald-300" />
            <h2 className="text-base font-bold">Reimbursement Track Record &amp; Receipt Review</h2>
          </div>
          <button type="button" onClick={onClose} className="text-emerald-200 hover:text-white cursor-pointer">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold text-emerald-900">Receipt Proof</span>
              <a href={claim.receipt_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-emerald-700 font-semibold hover:underline">
                <span>Open Full File</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            </div>
            <div className="rounded-2xl border border-emerald-200 bg-slate-50 p-2 flex items-center justify-center min-h-[220px]">
              <img src={claim.receipt_url} alt={claim.title} className="max-h-[260px] w-auto rounded-xl object-contain" />
            </div>
          </div>

          <div className="space-y-3">
            <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-4 space-y-2 text-xs">
              <div className="flex justify-between items-center">
                <span className="text-slate-500">Reimbursement Amount</span>
                <span className="text-xl font-extrabold text-emerald-800">RM {Number(claim.amount).toFixed(2)}</span>
              </div>
              <div className="font-bold text-sm text-slate-900">{claim.title}</div>
              <p><strong>Activity:</strong> {budget?.event_name || 'Club Activity'}</p>
              <p><strong>Unit / Category:</strong> {claim.category}</p>
              <p><strong>Claimant:</strong> {claim.claimant_name} ({claim.matric_no})</p>
              <p><strong>Expense Date:</strong> {claim.expense_date}</p>
              <div className="flex items-center justify-between pt-1">
                <span className="font-mono font-bold">{claim.phone_number}</span>
                <a href={waLink} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-semibold">
                  <Phone className="w-3 h-3" />
                  <span>WhatsApp</span>
                </a>
              </div>
              {claim.description && <p><strong>Note:</strong> {claim.description}</p>}
            </div>

            <div className="rounded-2xl border border-emerald-200 p-3 text-xs space-y-1 bg-white">
              <div className="font-bold text-emerald-950 flex items-center gap-1.5">
                <Clock className="w-3.5 h-3.5 text-emerald-700" />
                <span>Reimbursement Audit Trail:</span>
              </div>
              <p><strong>Status:</strong> <span className="font-bold">{claim.status}</span></p>
              {claim.reviewed_by && <p><strong>Reviewed By:</strong> {claim.reviewed_by}</p>}
              {claim.reviewed_at && <p><strong>Reviewed On:</strong> {new Date(claim.reviewed_at).toLocaleString()}</p>}
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">Reimbursement Remarks / Payment Ref</label>
              <textarea
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
                disabled={!isAdmin}
                placeholder="e.g., Reimbursed via DuitNow Ref #88219..."
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-xs disabled:bg-slate-100"
              />
            </div>

            {isAdmin && (
              <div className="flex gap-2 pt-1">
                <button type="button" disabled={processing} onClick={() => handleDecision('Rejected')} className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold bg-red-50 text-red-700 border border-red-200 cursor-pointer">
                  <XCircle className="w-4 h-4" />
                  <span>Reject</span>
                </button>
                <button type="button" disabled={processing} onClick={() => handleDecision('Approved')} className="flex-1 inline-flex items-center justify-center gap-1 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer">
                  {processing ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>Approve &amp; Reimburse</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}