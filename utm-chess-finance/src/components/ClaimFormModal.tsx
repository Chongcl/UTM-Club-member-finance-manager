'use client';

import React, { useState } from 'react';
import { supabase, Budget, UserProfile, DEFAULT_DEPARTMENTS } from '@/lib/supabase';
import ReceiptDropzone, { ExtractedReceiptData } from './ReceiptDropzone';
import { X, Receipt, Loader2, CheckCircle2, Phone } from 'lucide-react';

interface ClaimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Budget[];
  profile: UserProfile;
  departments?: string[];
  onSuccess: (message: string) => void;
}

export default function ClaimFormModal({
  isOpen,
  onClose,
  budgets,
  profile,
  departments = DEFAULT_DEPARTMENTS,
  onSuccess,
}: ClaimFormModalProps) {
  const [selectedEventOption, setSelectedEventOption] = useState<string>(budgets[0]?.id || 'OTHER');
  const [customEventName, setCustomEventName] = useState('');
  const [title, setTitle] = useState('');
  const [merchantName, setMerchantName] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(new Date().toISOString().split('T')[0]);
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number || '012-3456789');
  const [description, setDescription] = useState('');
  const [receiptFile, setReceiptFile] = useState<File | null>(null);
  const [aiOcrSummary, setAiOcrSummary] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!isOpen) return null;

  const isOtherEvent = selectedEventOption === 'OTHER';
  const numericAmount = parseFloat(amount) || 0;

  const handleAiExtracted = (data: ExtractedReceiptData) => {
    if (data.amount) setAmount(data.amount);
    if (data.merchantName) setMerchantName(data.merchantName);
    if (data.date) setExpenseDate(data.date);
    if (data.suggestedTitle && !title) setTitle(data.suggestedTitle);
    setAiOcrSummary(data.rawSummary);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (isOtherEvent && !customEventName.trim()) {
      setError('Please type the name of the event or purpose.');
      return;
    }
    if (!title.trim() || numericAmount <= 0 || !receiptFile) {
      setError('Please fill in all required fields and upload a receipt.');
      return;
    }

    setSubmitting(true);
    try {
      const fileExt = receiptFile.name.split('.').pop() || 'jpg';
      const safeFileName = `${profile.id}/${Date.now()}.${fileExt}`;
      const { error: uploadError } = await supabase.storage.from('receipts').upload(safeFileName, receiptFile);
      if (uploadError) throw new Error(uploadError.message);

      const { data: publicUrlData } = supabase.storage.from('receipts').getPublicUrl(safeFileName);
      const targetBudgetId = isOtherEvent ? budgets[0]?.id || null : selectedEventOption;
      const finalDescription = isOtherEvent ? `[Other Event: ${customEventName.trim()}] ${description.trim()}` : description.trim();

      const payload: Record<string, unknown> = {
        budget_id: isOtherEvent ? null : targetBudgetId,
        custom_event_name: isOtherEvent ? customEventName.trim() : '',
        user_id: profile.id,
        claimant_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: phoneNumber.trim(),
        title: title.trim(),
        merchant_name: merchantName.trim() || 'Vendor',
        expense_date: expenseDate,
        amount: numericAmount,
        category,
        description: finalDescription,
        receipt_url: publicUrlData.publicUrl,
        receipt_file_name: receiptFile.name,
        ai_ocr_summary: aiOcrSummary || `Receipt attached (${receiptFile.name})`,
        status: 'Pending',
      };

      const { error: insertError } = await supabase.from('claims').insert(payload);
      if (insertError) throw new Error(insertError.message);

      setTitle('');
      setCustomEventName('');
      setMerchantName('');
      setAmount('');
      setDescription('');
      setReceiptFile(null);
      onSuccess(`Claim "${title.trim()}" (RM ${numericAmount.toFixed(2)}) submitted!`);
      onClose();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to submit claim.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Receipt className="w-5 h-5 text-emerald-200" />
            <h2 className="text-base font-bold">Submit Claim</h2>
          </div>
          <button type="button" onClick={onClose} className="text-emerald-200 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[82vh] overflow-y-auto">
          <ReceiptDropzone selectedFile={receiptFile} onFileSelect={setReceiptFile} onAiExtracted={handleAiExtracted} />

          <div>
            <label className="block text-xs font-bold text-slate-700 mb-1">Event / Activity *</label>
            <select value={selectedEventOption} onChange={(e) => setSelectedEventOption(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3.5 py-2.5 text-sm" required>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>{b.event_name} ({b.event_date})</option>
              ))}
              <option value="OTHER">Other (Not in activity list)</option>
            </select>
          </div>

          {isOtherEvent && (
            <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200">
              <label className="block text-xs font-bold text-emerald-900 mb-1">Type of Event / Purpose *</label>
              <input type="text" value={customEventName} onChange={(e) => setCustomEventName(e.target.value)} placeholder="e.g., Equipment Repair, Club Meeting" className="w-full rounded-xl border border-emerald-300 bg-white px-3.5 py-2 text-sm" required />
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2">
              <label className="block text-xs font-bold text-slate-700 mb-1">Item / Claim Title *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g., Mineral Water & Printing" className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Amount (RM) *</label>
              <input type="number" step="0.01" min="0.10" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="0.00" className="w-full rounded-xl border border-slate-300 px-3.5 py-2 text-sm font-bold" required />
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Shop / Vendor</label>
              <input type="text" value={merchantName} onChange={(e) => setMerchantName(e.target.value)} placeholder="Optional" className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Date *</label>
              <input type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Department / Unit</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm">
                {departments.map((cat) => (
                  <option key={cat} value={cat}>{cat}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1"><Phone className="w-3.5 h-3.5 inline mr-1" />Phone Number *</label>
              <input type="tel" value={phoneNumber} onChange={(e) => setPhoneNumber(e.target.value)} className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-mono" required />
            </div>
            <div>
              <label className="block text-xs font-bold text-slate-700 mb-1">Remark</label>
              <input type="text" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Short note..." className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm" />
            </div>
          </div>

          {error && <div className="bg-red-50 text-red-700 px-3 py-2 rounded-xl text-xs">{error}</div>}

          <div className="flex justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer">Cancel</button>
            <button type="submit" disabled={submitting} className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer disabled:opacity-50">
              {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
              <span>Submit</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}