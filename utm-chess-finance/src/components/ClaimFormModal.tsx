'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  Budget,
  UserProfile,
  DEFAULT_DEPARTMENTS,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/supabase';
import ReceiptDropzone, { ScannedReceiptData } from './ReceiptDropzone';
import { X, CheckCircle2, AlertCircle, Loader2, Sparkles, Landmark } from 'lucide-react';

interface ClaimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Budget[];
  departments?: string[];
  profile: UserProfile;
  onSuccess: (message: string) => void;
}

export default function ClaimFormModal({
  isOpen,
  onClose,
  budgets,
  departments = DEFAULT_DEPARTMENTS,
  profile,
  onSuccess,
}: ClaimFormModalProps) {
  const [selectedEventOption, setSelectedEventOption] = useState<string>(
    budgets[0]?.id || 'OTHER'
  );
  const [customEventName, setCustomEventName] = useState('');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [merchantName, setMerchantName] = useState('');
  const [description, setDescription] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    let savedBank = {
      bank_name: profile.bank_name || '',
      bank_account_no: profile.bank_account_no || '',
      bank_account_holder: profile.bank_account_holder || profile.full_name || '',
    };
    if (typeof window !== 'undefined') {
      const raw = localStorage.getItem(`clubsync_bank_${profile.id}`);
      if (raw) {
        try {
          const parsed = JSON.parse(raw);
          savedBank = {
            bank_name: profile.bank_name || parsed.bank_name || '',
            bank_account_no: profile.bank_account_no || parsed.bank_account_no || '',
            bank_account_holder:
              profile.bank_account_holder || parsed.bank_account_holder || profile.full_name || '',
          };
        } catch {
          /* ignore */
        }
      }
    }
    setBankName(savedBank.bank_name);
    setBankAccountNo(savedBank.bank_account_no);
    setBankAccountHolder(savedBank.bank_account_holder);
  }, [isOpen, profile]);

  if (!isOpen) return null;

  const handleScanComplete = (data: ScannedReceiptData) => {
    setScannedData(data);
    setAmount(data.amount.toFixed(2));
    setMerchantName(data.merchant);
    setExpenseDate(data.date);
    setCategory(data.suggestedCategory);
    if (!title) setTitle(`${data.merchant} Purchase`);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!file) {
      setErrorMsg('Please attach your receipt or PDF invoice.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMsg('File size must be under 50 MB.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setSubmitting(true);
    try {
      const paymentSummary = bankAccountNo.trim()
        ? `${bankName.trim() || 'Bank/DuitNow'} • ${bankAccountNo.trim()} (${bankAccountHolder.trim() || profile.full_name})`
        : '';

      if (typeof window !== 'undefined' && bankAccountNo.trim()) {
        localStorage.setItem(
          `clubsync_bank_${profile.id}`,
          JSON.stringify({
            bank_name: bankName.trim(),
            bank_account_no: bankAccountNo.trim(),
            bank_account_holder: bankAccountHolder.trim() || profile.full_name,
          })
        );
      }

      const fileExt = file.name.split('.').pop() || 'pdf';
      const safePath = `claims/${profile.id}/${Date.now()}.${fileExt}`;

      const { error: uploadErr } = await supabase.storage
        .from('receipts')
        .upload(safePath, file, { upsert: false });
      if (uploadErr) throw uploadErr;

      const { data: urlData } = supabase.storage
        .from('receipts')
        .getPublicUrl(safePath);

      const isOther = selectedEventOption === 'OTHER';
      const chosenBudget = budgets.find((b) => b.id === selectedEventOption);
      const eventLabel = isOther
        ? customEventName.trim() || 'General Club Expense'
        : chosenBudget?.event_name || '';

      const baseDescription = `[Event: ${eventLabel}] ${description.trim()}${
        paymentSummary ? ` | Reimburse To: ${paymentSummary}` : ''
      }`;

      const corePayload = {
        user_id: profile.id,
        claimant_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: profile.phone_number,
        budget_id: isOther ? null : selectedEventOption,
        title: title.trim(),
        category,
        amount: numericAmount,
        expense_date: expenseDate,
        merchant_name: merchantName.trim(),
        description: baseDescription,
        receipt_url: urlData.publicUrl,
        receipt_file_name: file.name,
        ai_extracted_amount: scannedData?.amount ?? null,
        ai_extracted_merchant: scannedData?.merchant ?? null,
        ai_extracted_date: scannedData?.date ?? null,
        ai_confidence: scannedData?.confidence ?? null,
        status: 'Pending',
      };

      const { error: insertErr } = await supabase.from('claims').insert({
        ...corePayload,
        payment_info: paymentSummary,
      });
      if (insertErr) {
        const { error: fallbackErr } = await supabase.from('claims').insert(corePayload);
        if (fallbackErr) throw fallbackErr;
      }

      onSuccess('Claim submitted!');
      onClose();
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Submission failed.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-2xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Submit Reimbursement Claim</h2>
            <p className="text-xs text-emerald-200">
              {profile.full_name} ({profile.matric_no}) • Max 50MB
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-emerald-200 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form
          onSubmit={handleSubmit}
          className="p-6 space-y-4 max-h-[82vh] overflow-y-auto"
        >
          <ReceiptDropzone
            onFileSelect={(f) => {
              setFile(f);
              if (!f) setScannedData(null);
            }}
            onScanComplete={handleScanComplete}
          />

          {scannedData && (
            <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between text-xs text-emerald-900">
              <span className="font-semibold flex items-center gap-1.5">
                <Sparkles className="w-4 h-4 text-emerald-700" />
                Auto-filled from receipt ({scannedData.confidence}% match)
              </span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Activity / Event *
              </label>
              <select
                value={selectedEventOption}
                onChange={(e) => setSelectedEventOption(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-900"
              >
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event_name} ({b.event_date})
                  </option>
                ))}
                <option value="OTHER">Other (Type Custom Event Below)</option>
              </select>
            </div>

            {selectedEventOption === 'OTHER' && (
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Custom Event / Purpose Name *
                </label>
                <input
                  type="text"
                  value={customEventName}
                  onChange={(e) => setCustomEventName(e.target.value)}
                  placeholder="e.g., Committee Meeting Refreshments / Equipment Repair"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
            )}

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Expense Title *
              </label>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g., Mineral Water & Bread"
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Department / Unit *
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm"
              >
                {departments.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Amount (RM) *
              </label>
              <input
                type="number"
                step="0.01"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Shop / Merchant *
              </label>
              <input
                type="text"
                value={merchantName}
                onChange={(e) => setMerchantName(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Receipt Date *
              </label>
              <input
                type="date"
                value={expenseDate}
                onChange={(e) => setExpenseDate(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                required
              />
            </div>

            <div className="sm:col-span-2 p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-emerald-700" />
                  <span>Reimbursement Bank / DuitNow / TNG Details (Auto-Filled)</span>
                </span>
                <span className="text-[10px] font-bold text-emerald-700">Saved to Profile</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 text-xs">
                <input
                  type="text"
                  value={bankName}
                  onChange={(e) => setBankName(e.target.value)}
                  placeholder="Bank / eWallet (e.g., Maybank, TNG) *"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                  required
                />
                <input
                  type="text"
                  value={bankAccountNo}
                  onChange={(e) => setBankAccountNo(e.target.value)}
                  placeholder="Account No / DuitNow Phone *"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-mono font-bold"
                  required
                />
                <input
                  type="text"
                  value={bankAccountHolder}
                  onChange={(e) => setBankAccountHolder(e.target.value)}
                  placeholder="Account Holder Name *"
                  className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                  required
                />
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-emerald-900 mb-1">
                Notes
              </label>
              <textarea
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
              />
            </div>
          </div>

          {errorMsg && (
            <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl border border-red-200">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          <div className="flex items-center justify-end gap-2.5 pt-2 border-t border-emerald-100">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              {submitting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{submitting ? 'Uploading...' : 'Submit'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}