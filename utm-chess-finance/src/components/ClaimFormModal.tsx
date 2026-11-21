'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  Budget,
  Claim,
  UserProfile,
  DEFAULT_DEPARTMENTS,
  MAX_FILE_SIZE_BYTES,
  logActivity,
} from '@/lib/supabase';
import ReceiptDropzone, { ScannedReceiptData } from './ReceiptDropzone';
import {
  ClaimReceiptLineItem,
  DuplicateClaimMatch,
  findDuplicateClaims,
  formatItemizedBreakdownTag,
  parseItemizedBreakdownFromDescription,
} from '@/lib/duplicateClaimDetector';
import {
  X,
  CheckCircle2,
  AlertCircle,
  Loader2,
  Sparkles,
  Landmark,
  Eye,
  EyeOff,
  PlusCircle,
  Trash2,
  AlertTriangle,
  Receipt,
  GitCompare,
  ArrowLeft,
  ArrowRight,
} from 'lucide-react';

interface ClaimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Budget[];
  departments?: string[];
  existingClaims?: Claim[];
  profile: UserProfile;
  onSuccess: (message: string) => void;
}

function extractErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'object' && err !== null && 'message' in err) {
    const msg = String((err as { message: unknown }).message || '').trim();
    const details =
      'details' in err && (err as { details: unknown }).details
        ? ` (${String((err as { details: unknown }).details)})`
        : '';
    if (msg) return `${msg}${details}`;
  }
  return 'Submission failed. Please check your details and try again.';
}

export default function ClaimFormModal({
  isOpen,
  onClose,
  budgets,
  departments = DEFAULT_DEPARTMENTS,
  existingClaims = [],
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
  const [lineItems, setLineItems] = useState<ClaimReceiptLineItem[]>([
    { id: 'row-1', shop: '', amount: '' },
  ]);
  const [extraFileNames, setExtraFileNames] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [includePaymentDetails, setIncludePaymentDetails] = useState(true);
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [claimantQrUrl, setClaimantQrUrl] = useState('');
  const [claimantQrFile, setClaimantQrFile] = useState<File | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [localFilePreviewUrl, setLocalFilePreviewUrl] = useState<string | null>(null);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false);
  const [compareMatch, setCompareMatch] = useState<DuplicateClaimMatch | null>(null);
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!file || file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')) {
      setLocalFilePreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(file);
    setLocalFilePreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [file]);

  useEffect(() => {
    setConfirmNotDuplicate(false);
  }, [amount, expenseDate, merchantName, file]);

  useEffect(() => {
    if (!isOpen) {
      setUploadedReceiptUrl(null);
      setCompareMatch(null);
      setConfirmNotDuplicate(false);
      setStep(1);
      return;
    }
    setErrorMsg(null);
    if (budgets.length > 0 && !budgets.some((b) => b.id === selectedEventOption) && !customEventName) {
      setSelectedEventOption(budgets[0].id);
    }
    setBankName(profile.bank_name || '');
    setBankAccountNo(profile.bank_account_no || '');
    setBankAccountHolder(profile.bank_account_holder || profile.full_name || '');
    setClaimantQrUrl(profile.bank_qr_url || '');
    setClaimantQrFile(null);
  }, [isOpen, profile, budgets, selectedEventOption, customEventName]);

  if (!isOpen) return null;

  const syncFromLineItems = (nextItems: ClaimReceiptLineItem[]) => {
    setLineItems(nextItems);
    const total = nextItems.reduce((sum, item) => {
      const n = parseFloat(item.amount);
      return sum + (!isNaN(n) && n > 0 ? n : 0);
    }, 0);
    if (nextItems.length > 1 || nextItems.some((item) => item.amount.trim() !== '')) {
      setAmount(total > 0 ? total.toFixed(2) : '');
    }
    const shops = Array.from(
      new Set(nextItems.map((item) => item.shop.trim()).filter(Boolean))
    );
    if (nextItems.length > 1 || shops.length > 0) {
      setMerchantName(shops.join(', '));
    }
  };

  const handleAddLineItem = () => {
    const next = [
      ...lineItems,
      { id: `row-${Date.now()}-${lineItems.length + 1}`, shop: '', amount: '' },
    ];
    setLineItems(next);
  };

  const handleUpdateLineItem = (
    rowId: string,
    field: 'shop' | 'amount',
    value: string
  ) => {
    const next = lineItems.map((item) =>
      item.id === rowId ? { ...item, [field]: value } : item
    );
    syncFromLineItems(next);
  };

  const handleRemoveLineItem = (rowId: string) => {
    if (lineItems.length <= 1) {
      syncFromLineItems([{ id: 'row-1', shop: '', amount: '' }]);
      return;
    }
    syncFromLineItems(lineItems.filter((item) => item.id !== rowId));
  };

  const handleScanComplete = (data: ScannedReceiptData) => {
    setScannedData(data);
    setExtraFileNames(data.fileNames || []);
    if (data.items && data.items.length > 0) {
      const scannedRows: ClaimReceiptLineItem[] = data.items.map((it, idx) => ({
        id: `scan-${Date.now()}-${idx}`,
        shop: it.merchant || '',
        amount: it.amount !== null ? it.amount.toFixed(2) : '',
        date: it.date || undefined,
        fileName: it.fileName,
        rawText: it.rawText,
      }));
      syncFromLineItems(scannedRows);
    } else {
      if (data.amount !== null) setAmount(data.amount.toFixed(2));
      if (data.merchant) setMerchantName(data.merchant);
    }
    if (data.amount !== null && (!data.items || data.items.length === 0)) {
      setAmount(data.amount.toFixed(2));
    }
    if (data.date) setExpenseDate(data.date);
    if (data.suggestedCategory && departments.includes(data.suggestedCategory)) {
      setCategory(data.suggestedCategory);
    }
    if (!title) {
      setTitle(
        data.items && data.items.length > 1
          ? `${data.items.length} Receipts Reimbursement${data.merchant ? ` (${data.merchant})` : ''}`
          : data.merchant
          ? `${data.merchant} Purchase`
          : `Receipt Claim (${data.date || expenseDate})`
      );
    }
  };

  const duplicateMatches = findDuplicateClaims(
    {
      amount: parseFloat(amount) || 0,
      expenseDate,
      merchantName,
      receiptFileName: file?.name,
      extraFileNames,
      rawOcrText: scannedData?.rawText,
      lineItems: lineItems.map((item) => ({
        shop: item.shop,
        amount: parseFloat(item.amount) || 0,
        date: item.date,
        fileName: item.fileName,
        rawText: item.rawText,
      })),
    },
    existingClaims
  );

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!file) {
      setStep(1);
      setErrorMsg('Attach or scan a receipt before submitting.');
      return;
    }
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setStep(1);
      setErrorMsg('File size must be under 50 MB.');
      return;
    }
    if (!title.trim()) {
      setStep(2);
      setErrorMsg('Enter an expense title.');
      return;
    }

    const numericAmount = parseFloat(amount);
    if (isNaN(numericAmount) || numericAmount <= 0) {
      setStep(2);
      setErrorMsg('Enter a valid amount (RM).');
      return;
    }

    if (duplicateMatches.length > 0 && !confirmNotDuplicate) {
      setStep(2);
      setErrorMsg('Compare the similar claim and tick confirmation.');
      return;
    }

    setSubmitting(true);
    try {
      let finalClaimantQr = includePaymentDetails ? claimantQrUrl.trim() : '';
      if (includePaymentDetails && claimantQrFile && claimantQrFile.size <= MAX_FILE_SIZE_BYTES) {
        const qrExt = claimantQrFile.name.split('.').pop() || 'png';
        const qrPath = `member-qr/${profile.id}-${Date.now()}.${qrExt}`;
        const { error: qrErr } = await supabase.storage.from('receipts').upload(qrPath, claimantQrFile);
        if (!qrErr) {
          finalClaimantQr = supabase.storage.from('receipts').getPublicUrl(qrPath).data.publicUrl;
        }
      }

      const paymentSummary =
        includePaymentDetails && bankAccountNo.trim()
          ? `${bankName.trim() || 'Bank/DuitNow'} • ${bankAccountNo.trim()} (${bankAccountHolder.trim() || profile.full_name})`
          : '';

      if (includePaymentDetails && (bankAccountNo.trim() || finalClaimantQr)) {
        void supabase
          .from('users')
          .update({
            bank_name: bankName.trim(),
            bank_account_no: bankAccountNo.trim(),
            bank_account_holder: bankAccountHolder.trim() || profile.full_name,
            bank_qr_url: finalClaimantQr,
          })
          .eq('id', profile.id);
      }

      let receiptUrl = uploadedReceiptUrl || '';
      if (!receiptUrl) {
        const fileExt = file.name.split('.').pop() || 'jpg';
        const safePath = `claims/${profile.id}/${Date.now()}.${fileExt}`;

        const { error: uploadErr } = await supabase.storage
          .from('receipts')
          .upload(safePath, file, { upsert: false });
        if (!uploadErr) {
          const { data: urlData } = supabase.storage
            .from('receipts')
            .getPublicUrl(safePath);
          receiptUrl = urlData.publicUrl;
        } else {
          receiptUrl = await new Promise<string>((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(String(reader.result || ''));
            reader.onerror = () => reject(uploadErr);
            reader.readAsDataURL(file);
          });
        }
      }

      const isOther = selectedEventOption === 'OTHER';
      const chosenBudget = budgets.find((b) => b.id === selectedEventOption);
      const eventLabel = isOther
        ? customEventName.trim() || 'General Club Expense'
        : chosenBudget?.event_name || 'General Club Expense';

      const itemsTag = formatItemizedBreakdownTag(lineItems, false);
      const baseDescription = `[Event: ${eventLabel}] ${description.trim()}${
        paymentSummary ? ` | Reimburse To: ${paymentSummary}` : ''
      }${itemsTag ? ` ${itemsTag}` : ''}`;

      const cleanMerchant = merchantName.trim() || 'Merchant';
      const scannedSummary = scannedData
        ? `Scanned (${scannedData.confidence}%): RM ${scannedData.amount?.toFixed(2) ?? '-'} | ${scannedData.merchant || '-'} | ${scannedData.date || '-'}`
        : `Receipt attached (${file.name})`;

      const corePayload = {
        user_id: profile.id,
        claimant_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: profile.phone_number || '',
        budget_id: isOther ? null : selectedEventOption,
        title: title.trim(),
        category,
        amount: numericAmount,
        expense_date: expenseDate,
        merchant_name: cleanMerchant,
        description: baseDescription,
        receipt_url: receiptUrl,
        receipt_file_name: file.name,
        status: 'Pending',
      };

      const candidates: Record<string, unknown>[] = [
        // Tier 1: Full modern schema
        {
          ...corePayload,
          ai_extracted_amount: scannedData?.amount ?? null,
          ai_extracted_merchant: scannedData?.merchant || null,
          ai_extracted_date: scannedData?.date ?? null,
          ai_confidence: scannedData?.confidence ?? null,
          payment_info: paymentSummary,
          claimant_qr_url: finalClaimantQr,
        },
        // Tier 2: Original claims schema
        {
          ...corePayload,
          custom_event_name: isOther ? eventLabel : '',
          ai_ocr_summary: scannedSummary,
        },
        // Tier 3: Minimal universal schema
        corePayload,
      ];

      let lastErr: unknown = null;
      let saved = false;

      for (const payload of candidates) {
        const { error: insErr } = await supabase.from('claims').insert(payload);
        if (!insErr) {
          saved = true;
          break;
        }
        lastErr = insErr;
      }

      if (!saved) {
        throw lastErr || new Error('Could not save claim to the database.');
      }

      void logActivity(
        profile,
        'Claims',
        'Claim submitted',
        `${profile.full_name} (${profile.matric_no}) submitted claim "${title.trim()}" for RM ${numericAmount.toFixed(2)} (${eventLabel})`
      );

      const submittedTitle = title.trim();
      setTitle('');
      setCustomEventName('');
      setMerchantName('');
      setAmount('');
      setLineItems([{ id: 'row-1', shop: '', amount: '' }]);
      setExtraFileNames([]);
      setDescription('');
      setFile(null);
      setUploadedReceiptUrl(null);
      setScannedData(null);
      setConfirmNotDuplicate(false);
      setCompareMatch(null);
      setStep(1);

      onSuccess(`✓ Claim "${submittedTitle}" (RM ${numericAmount.toFixed(2)}) submitted!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const goToStep = (target: 1 | 2 | 3) => {
    setErrorMsg(null);
    setStep(target);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">Submit Claim</h2>
            <p className="text-xs text-emerald-200">
              {profile.full_name} ({profile.matric_no})
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

        {/* Clean 3-Stage Stepper */}
        <div className="grid grid-cols-3 gap-2 px-6 py-3 bg-emerald-50/70 border-b border-emerald-100 text-xs">
          {[
            { id: 1 as const, label: '1. Receipt', done: Boolean(file) },
            { id: 2 as const, label: '2. Details', done: Boolean(title.trim() && parseFloat(amount) > 0) },
            { id: 3 as const, label: '3. Bank / QR', done: Boolean(bankAccountNo.trim() || claimantQrUrl || claimantQrFile) },
          ].map((s) => {
            const active = step === s.id;
            return (
              <button
                key={s.id}
                type="button"
                onClick={() => goToStep(s.id)}
                className={`py-2 px-3 rounded-xl font-bold flex items-center justify-center gap-1.5 transition cursor-pointer ${
                  active
                    ? 'bg-emerald-600 text-white shadow-2xs'
                    : s.done
                    ? 'bg-emerald-100 text-emerald-900'
                    : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}
              >
                {s.done && !active && <CheckCircle2 className="w-3.5 h-3.5 text-emerald-700" />}
                <span>{s.label}</span>
              </button>
            );
          })}
        </div>

        <form
          onSubmit={handleSubmit}
          noValidate
          className="p-6 space-y-4 max-h-[76vh] overflow-y-auto"
        >
          {errorMsg && (
            <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl border border-red-200 font-semibold">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-3">
              <ReceiptDropzone
                selectedFile={file}
                userId={profile.id}
                onFileSelect={(f) => {
                  setFile(f);
                  if (!f) {
                    setScannedData(null);
                    setUploadedReceiptUrl(null);
                    setExtraFileNames([]);
                  }
                }}
                onUploadedUrl={setUploadedReceiptUrl}
                onScanComplete={handleScanComplete}
              />

              {scannedData && (
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2 flex flex-wrap items-center justify-between gap-2 text-xs text-emerald-900">
                  <span className="font-bold flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-emerald-700" />
                    <span>
                      {scannedData.amount !== null ? `RM ${scannedData.amount.toFixed(2)}` : 'Scanned'}
                      {scannedData.merchant ? ` · ${scannedData.merchant}` : ''}
                      {scannedData.date ? ` · ${scannedData.date}` : ''}
                    </span>
                  </span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <span>Next: Details</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="space-y-3.5">
              {duplicateMatches.length > 0 && (
                <div className="bg-amber-50 border-2 border-amber-300 rounded-2xl p-3 space-y-2 text-xs text-amber-950">
                  {duplicateMatches.map((match) => (
                    <div
                      key={match.claim.id}
                      className="flex flex-wrap items-center justify-between gap-2 bg-white/85 border border-amber-200 rounded-xl px-2.5 py-2"
                    >
                      <div className="min-w-0 flex-1 space-y-0.5">
                        <div className="font-extrabold text-amber-950 leading-snug">
                          {match.headline}
                        </div>
                        <div className="text-[11px] text-amber-800">
                          <span className="font-bold">{match.claim.status}</span> · {match.reasons.join(' • ')}
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => setCompareMatch(match)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-amber-600 hover:bg-amber-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                      >
                        <GitCompare className="w-3.5 h-3.5" />
                        <span>Compare</span>
                      </button>
                    </div>
                  ))}
                  <label className="flex items-center gap-2 pt-0.5 cursor-pointer select-none font-bold text-amber-950">
                    <input
                      type="checkbox"
                      checked={confirmNotDuplicate}
                      onChange={(e) => setConfirmNotDuplicate(e.target.checked)}
                      className="w-4 h-4 accent-amber-600 rounded"
                    />
                    <span>Separate purchase — continue</span>
                  </label>
                </div>
              )}

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Activity *
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
                    <option value="OTHER">Other</option>
                  </select>
                </div>

                {selectedEventOption === 'OTHER' && (
                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Event Name
                    </label>
                    <input
                      type="text"
                      value={customEventName}
                      onChange={(e) => setCustomEventName(e.target.value)}
                      placeholder="e.g., Committee Meeting"
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    />
                  </div>
                )}

                <div className="sm:col-span-2">
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Title *
                  </label>
                  <input
                    type="text"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    placeholder="e.g., Tournament Mineral Water"
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Date *
                  </label>
                  <input
                    type="date"
                    value={expenseDate}
                    onChange={(e) => setExpenseDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    required
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Department *
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

                {/* Receipts / Shops & Amounts */}
                <div className="sm:col-span-2 p-3.5 rounded-2xl bg-slate-50 border border-emerald-200 space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                      <Receipt className="w-4 h-4 text-emerald-700" />
                      <span>Receipts (Shop &amp; RM)</span>
                    </span>
                    <button
                      type="button"
                      onClick={handleAddLineItem}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-[11px] font-bold cursor-pointer"
                    >
                      <PlusCircle className="w-3.5 h-3.5" />
                      <span>Add Row</span>
                    </button>
                  </div>

                  <div className="space-y-2">
                    {lineItems.map((row, idx) => (
                      <div key={row.id} className="grid grid-cols-12 gap-2 items-center text-xs">
                        <span className="col-span-1 text-[11px] font-bold text-slate-400 text-center">
                          #{idx + 1}
                        </span>
                        <input
                          type="text"
                          value={row.shop}
                          onChange={(e) => handleUpdateLineItem(row.id, 'shop', e.target.value)}
                          placeholder="Shop"
                          className="col-span-6 rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
                        />
                        <div className="col-span-4 relative">
                          <span className="absolute left-2.5 top-1/2 -translate-y-1/2 text-[11px] font-bold text-slate-400">
                            RM
                          </span>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={row.amount}
                            onChange={(e) => handleUpdateLineItem(row.id, 'amount', e.target.value)}
                            placeholder="0.00"
                            className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-2.5 py-1.5 font-bold"
                          />
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLineItem(row.id)}
                          className="col-span-1 p-1.5 text-slate-400 hover:text-rose-600 cursor-pointer flex items-center justify-center"
                          title="Remove row"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end pt-2 border-t border-slate-200 text-xs">
                    <span className="font-extrabold text-emerald-900">
                      Total: RM {(parseFloat(amount) || 0).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between gap-2 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
                </button>
                <button
                  type="button"
                  onClick={() => goToStep(3)}
                  className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <span>Next: Bank / QR</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-3.5">
              <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold text-slate-800 truncate">{title || 'Claim'}</span>
                <span className="font-extrabold text-emerald-900">
                  RM {(parseFloat(amount) || 0).toFixed(2)} · {expenseDate}
                </span>
              </div>

              <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-emerald-700" />
                    <span>Bank / DuitNow</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setIncludePaymentDetails(!includePaymentDetails)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                      includePaymentDetails ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                    }`}
                  >
                    {includePaymentDetails ? <Eye className="w-3 h-3" /> : <EyeOff className="w-3 h-3" />}
                    <span>{includePaymentDetails ? 'Include' : 'Skip'}</span>
                  </button>
                </div>
                {includePaymentDetails && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
                      <input
                        type="text"
                        value={bankName}
                        onChange={(e) => setBankName(e.target.value)}
                        placeholder="Bank / eWallet"
                        className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                      />
                      <input
                        type="text"
                        value={bankAccountNo}
                        onChange={(e) => setBankAccountNo(e.target.value)}
                        placeholder="Account / Phone"
                        className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-mono font-bold"
                      />
                      <input
                        type="text"
                        value={bankAccountHolder}
                        onChange={(e) => setBankAccountHolder(e.target.value)}
                        placeholder="Holder Name"
                        className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-semibold"
                      />
                    </div>
                    <div className="pt-1 text-xs space-y-1">
                      <label className="block font-bold text-emerald-900">
                        DuitNow QR (Optional)
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setClaimantQrFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                      />
                      {claimantQrUrl && !claimantQrFile && (
                        <div className="flex items-center justify-between bg-white px-3 py-1.5 rounded-xl border text-[11px]">
                          <span className="text-emerald-800 font-bold">✓ Profile QR attached</span>
                          <button type="button" onClick={() => setClaimantQrUrl('')} className="text-rose-600 font-bold cursor-pointer">
                            Remove
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>

              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Notes (Optional)
                </label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>

              <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-emerald-100">
                <button
                  type="button"
                  onClick={() => goToStep(2)}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>Back</span>
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
                  <span>{submitting ? 'Submitting...' : 'Submit Claim'}</span>
                </button>
              </div>
            </div>
          )}
        </form>
      </div>

      {compareMatch && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto"
          onClick={() => setCompareMatch(null)}
        >
          <div
            className="bg-white rounded-3xl shadow-2xl border-2 border-amber-300 max-w-4xl w-full overflow-hidden my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="bg-amber-600 text-white px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5" />
                <div>
                  <h3 className="text-sm font-extrabold">
                    Compare Potential Duplicate — Claim #{compareMatch.claimNumber}
                  </h3>
                  <p className="text-[11px] text-amber-100">{compareMatch.reasons.join(' • ')}</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setCompareMatch(null)}
                className="p-1 rounded-lg hover:bg-amber-500 cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5 text-xs max-h-[80vh] overflow-y-auto">
              <div className="rounded-2xl border border-emerald-200 bg-emerald-50/40 p-4 space-y-3">
                <div className="font-extrabold text-emerald-950 text-sm">Your New Draft Claim</div>
                <div className="space-y-1 text-slate-700">
                  <div>
                    <span className="text-slate-500">Title:</span> <strong>{title || '(Untitled)'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Amount:</span>{' '}
                    <strong className="text-emerald-900">RM {(parseFloat(amount) || 0).toFixed(2)}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Date:</span> <strong>{expenseDate}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">Merchant:</span> <strong>{merchantName || 'Merchant'}</strong>
                  </div>
                  <div>
                    <span className="text-slate-500">File:</span>{' '}
                    <span className="font-mono">{file?.name || '-'}</span>
                  </div>
                </div>
                {(localFilePreviewUrl || uploadedReceiptUrl) && (
                  <img
                    src={localFilePreviewUrl || uploadedReceiptUrl || ''}
                    alt="Draft receipt"
                    className="max-h-72 w-full object-contain rounded-xl border bg-white p-1"
                  />
                )}
              </div>

              <div className="rounded-2xl border border-amber-300 bg-amber-50/50 p-4 space-y-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-amber-950 text-sm">
                    Existing Claim #{compareMatch.claimNumber}
                  </span>
                  <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-200 text-amber-950">
                    {compareMatch.claim.status}
                  </span>
                </div>
                <div className="space-y-1 text-slate-700">
                  <div>
                    <span className="text-slate-500">Title:</span>{' '}
                    <strong>{compareMatch.claim.title}</strong>
                  </div>
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
                  {(() => {
                    const parsed = parseItemizedBreakdownFromDescription(compareMatch.claim.description);
                    if (parsed.items.length === 0) return null;
                    return (
                      <div className="pt-1 text-[11px] text-amber-900 font-semibold">
                        Itemized: {parsed.items.map((it) => `${it.shop} (RM ${it.amount.toFixed(2)})`).join(' • ')}
                      </div>
                    );
                  })()}
                </div>
                {compareMatch.claim.receipt_url && (
                  <img
                    src={compareMatch.claim.receipt_url}
                    alt={compareMatch.claim.title}
                    className="max-h-72 w-full object-contain rounded-xl border bg-white p-1"
                  />
                )}
              </div>
            </div>
            <div className="px-6 py-3 bg-slate-50 border-t flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => {
                  setConfirmNotDuplicate(true);
                  setCompareMatch(null);
                }}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-500 text-white text-xs font-bold cursor-pointer"
              >
                Verified Separate Receipt (Tick Confirmation)
              </button>
              <button
                type="button"
                onClick={() => setCompareMatch(null)}
                className="px-4 py-2 rounded-xl bg-slate-200 hover:bg-slate-300 text-slate-800 text-xs font-bold cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}