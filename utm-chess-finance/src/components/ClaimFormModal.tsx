'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  supabase,
  Budget,
  Claim,
  PreClaim,
  UserProfile,
  DEFAULT_DEPARTMENTS,
  MAX_FILE_SIZE_BYTES,
  logActivity,
} from '@/lib/supabase';
import { emitClubNotification } from '@/lib/notifications';
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
  FileText,
  GitCompare,
  ArrowLeft,
  ArrowRight,
  Wallet,
  CalendarClock,
  UploadCloud,
} from 'lucide-react';

interface ClaimFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  budgets: Budget[];
  departments?: string[];
  existingClaims?: Claim[];
  preClaims?: PreClaim[];
  initialMode?: 'receipt' | 'preclaim';
  initialPreClaimId?: string | null;
  adminRecipientIds?: string[];
  profile: UserProfile;
  onSuccess: (message: string) => void;
}

function localTodayYmd(): string {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
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
  preClaims = [],
  initialMode = 'receipt',
  initialPreClaimId = null,
  adminRecipientIds = [],
  profile,
  onSuccess,
}: ClaimFormModalProps) {
  const [mode, setMode] = useState<'receipt' | 'preclaim'>(initialMode);
  const [eventManuallyPicked, setEventManuallyPicked] = useState(false);

  // Classify events into Past/Recent vs Upcoming/Future
  const { pastOrRecentEvents, upcomingEvents } = useMemo(() => {
    const today = localTodayYmd();
    const past: Budget[] = [];
    const upcoming: Budget[] = [];
    for (const b of budgets) {
      const evDate = b.event_date || '';
      if (b.status === 'Active' && evDate > today) {
        upcoming.push(b);
      } else {
        past.push(b);
      }
    }
    past.sort((a, b) => (b.event_date || '').localeCompare(a.event_date || ''));
    upcoming.sort((a, b) => (a.event_date || '').localeCompare(b.event_date || ''));
    return { pastOrRecentEvents: past, upcomingEvents: upcoming };
  }, [budgets]);

  const defaultEventForMode = (targetMode: 'receipt' | 'preclaim'): string => {
    if (targetMode === 'receipt') {
      return pastOrRecentEvents[0]?.id || upcomingEvents[0]?.id || 'OTHER';
    }
    return upcomingEvents[0]?.id || pastOrRecentEvents[0]?.id || 'OTHER';
  };

  // Shared event / department / payment state
  const [selectedEventOption, setSelectedEventOption] = useState<string>('OTHER');
  const [customEventName, setCustomEventName] = useState('');
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [bankName, setBankName] = useState('');
  const [bankAccountNo, setBankAccountNo] = useState('');
  const [bankAccountHolder, setBankAccountHolder] = useState('');
  const [claimantQrUrl, setClaimantQrUrl] = useState('');
  const [claimantQrFile, setClaimantQrFile] = useState<File | null>(null);
  const [localQrPreviewUrl, setLocalQrPreviewUrl] = useState<string | null>(null);

  // Receipt Claim (Primary 3-step flow) state
  const [step, setStep] = useState<1 | 2 | 3>(1);
  const [title, setTitle] = useState('');
  const [amount, setAmount] = useState('');
  const [expenseDate, setExpenseDate] = useState(localTodayYmd());
  const [merchantName, setMerchantName] = useState('');
  const [lineItems, setLineItems] = useState<ClaimReceiptLineItem[]>([
    { id: 'row-1', shop: '', amount: '' },
  ]);
  const [extraFileNames, setExtraFileNames] = useState<string[]>([]);
  const [description, setDescription] = useState('');
  const [includePaymentDetails, setIncludePaymentDetails] = useState(true);
  const [file, setFile] = useState<File | null>(null);
  const [localFilePreviewUrl, setLocalFilePreviewUrl] = useState<string | null>(null);
  const [uploadedReceiptUrl, setUploadedReceiptUrl] = useState<string | null>(null);
  const [scannedData, setScannedData] = useState<ScannedReceiptData | null>(null);
  const [confirmNotDuplicate, setConfirmNotDuplicate] = useState(false);
  const [compareMatch, setCompareMatch] = useState<DuplicateClaimMatch | null>(null);
  const [linkedPreClaimId, setLinkedPreClaimId] = useState<string | null>(null);
  const [returnSlipFile, setReturnSlipFile] = useState<File | null>(null);

  // Pre-Claim (Secondary 2-step flow) state
  const [preStep, setPreStep] = useState<1 | 2>(1);
  const [preTitle, setPreTitle] = useState('');
  const [preEstimatedAmount, setPreEstimatedAmount] = useState('');
  const [preNeededDate, setPreNeededDate] = useState(localTodayYmd());
  const [preReason, setPreReason] = useState('');
  const [preQuoteUrl, setPreQuoteUrl] = useState('');
  const [preQuoteFile, setPreQuoteFile] = useState<File | null>(null);
  const [needsCashAdvance, setNeedsCashAdvance] = useState(false);
  const [advanceAmount, setAdvanceAmount] = useState('');

  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const wasOpenRef = useRef(false);

  const actionablePreClaims = useMemo(
    () =>
      preClaims.filter(
        (pc) =>
          pc.user_id === profile.id &&
          !pc.deleted_at &&
          (pc.status === 'Pre-Approved' || pc.status === 'Advance Disbursed')
      ),
    [preClaims, profile.id]
  );

  const linkedPreClaim = useMemo(
    () =>
      linkedPreClaimId
        ? preClaims.find((pc) => pc.id === linkedPreClaimId && !pc.deleted_at) || null
        : null,
    [linkedPreClaimId, preClaims]
  );

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
    if (
      !claimantQrFile ||
      claimantQrFile.type === 'application/pdf' ||
      claimantQrFile.name.toLowerCase().endsWith('.pdf')
    ) {
      setLocalQrPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(claimantQrFile);
    setLocalQrPreviewUrl(url);
    return () => {
      URL.revokeObjectURL(url);
    };
  }, [claimantQrFile]);

  useEffect(() => {
    setConfirmNotDuplicate(false);
  }, [amount, expenseDate, merchantName, file]);

  const applyLinkedPreClaim = (pc: PreClaim) => {
    setLinkedPreClaimId(pc.id);
    if (pc.budget_id) {
      setSelectedEventOption(pc.budget_id);
      setCustomEventName('');
    } else {
      setSelectedEventOption('OTHER');
      setCustomEventName(pc.custom_event_name || '');
    }
    setEventManuallyPicked(true);
    setTitle(pc.title || '');
    if (pc.category && departments.includes(pc.category)) {
      setCategory(pc.category);
    } else if (pc.category) {
      setCategory(pc.category);
    }
  };

  useEffect(() => {
    if (isOpen && !wasOpenRef.current) {
      const startMode = initialMode || 'receipt';
      setMode(startMode);
      setErrorMsg(null);
      setStep(1);
      setPreStep(1);
      setEventManuallyPicked(false);
      setSelectedEventOption(defaultEventForMode(startMode));
      setIncludePaymentDetails(true);
      setNeedsCashAdvance(false);
      setBankName(profile.bank_name || '');
      setBankAccountNo(profile.bank_account_no || '');
      setBankAccountHolder(profile.bank_account_holder || profile.full_name || '');
      setClaimantQrUrl(profile.bank_qr_url || '');
      setClaimantQrFile(null);
      setReturnSlipFile(null);

      if (initialPreClaimId) {
        const found = preClaims.find((pc) => pc.id === initialPreClaimId);
        if (found) {
          setMode('receipt');
          setLinkedPreClaimId(found.id);
          if (found.budget_id) {
            setSelectedEventOption(found.budget_id);
            setCustomEventName('');
          } else {
            setSelectedEventOption('OTHER');
            setCustomEventName(found.custom_event_name || '');
          }
          setEventManuallyPicked(true);
          setTitle(found.title || '');
          if (found.category) setCategory(found.category);
        }
      }
    } else if (!isOpen && wasOpenRef.current) {
      setMode('receipt');
      setStep(1);
      setPreStep(1);
      setErrorMsg(null);
      setEventManuallyPicked(false);
      setSelectedEventOption('OTHER');
      setCustomEventName('');
      setTitle('');
      setAmount('');
      setMerchantName('');
      setDescription('');
      setLineItems([{ id: 'row-1', shop: '', amount: '' }]);
      setExtraFileNames([]);
      setFile(null);
      setUploadedReceiptUrl(null);
      setScannedData(null);
      setConfirmNotDuplicate(false);
      setCompareMatch(null);
      setLinkedPreClaimId(null);
      setReturnSlipFile(null);
      setIncludePaymentDetails(true);
      setBankName('');
      setBankAccountNo('');
      setBankAccountHolder('');
      setClaimantQrUrl('');
      setClaimantQrFile(null);
      setPreTitle('');
      setPreEstimatedAmount('');
      setPreNeededDate(localTodayYmd());
      setPreReason('');
      setPreQuoteUrl('');
      setPreQuoteFile(null);
      setNeedsCashAdvance(false);
      setAdvanceAmount('');
    }
    wasOpenRef.current = isOpen;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, initialMode, initialPreClaimId, profile]);

  if (!isOpen) return null;

  const handleSwitchMode = (targetMode: 'receipt' | 'preclaim') => {
    setErrorMsg(null);
    setMode(targetMode);
    if (!eventManuallyPicked) {
      setSelectedEventOption(defaultEventForMode(targetMode));
    }
    if (targetMode === 'receipt') {
      setStep(1);
    } else {
      setPreStep(1);
    }
  };

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

  const handleReceiptSubmit = async (e: React.FormEvent) => {
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

    if (returnSlipFile && returnSlipFile.size > MAX_FILE_SIZE_BYTES) {
      setStep(2);
      setErrorMsg('Return transfer slip file must be under 50 MB.');
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
        // Tier 1: Full modern schema with pre_claim_id link
        {
          ...corePayload,
          ...(linkedPreClaim ? { pre_claim_id: linkedPreClaim.id } : {}),
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
      let insertedClaimId: string | null = null;
      let saved = false;

      for (const payload of candidates) {
        const { data: insRow, error: insErr } = await supabase
          .from('claims')
          .insert(payload)
          .select('id')
          .maybeSingle();
        if (!insErr) {
          saved = true;
          if (insRow && typeof insRow === 'object' && 'id' in insRow) {
            insertedClaimId = String((insRow as { id: unknown }).id);
          }
          break;
        }
        lastErr = insErr;
      }

      if (!saved) {
        throw lastErr || new Error('Could not save claim to the database.');
      }

      if (linkedPreClaim) {
        const advDisbursed = Number(linkedPreClaim.advance_disbursed_amount || 0);
        const returnBalance =
          advDisbursed > 0 && numericAmount < advDisbursed
            ? Number((advDisbursed - numericAmount).toFixed(2))
            : 0;

        let returnProofUrl = linkedPreClaim.return_proof_url || '';
        if (returnSlipFile) {
          const ext = returnSlipFile.name.split('.').pop() || 'jpg';
          const retPath = `preclaim-returns/${linkedPreClaim.id}-${Date.now()}.${ext}`;
          const { error: retErr } = await supabase.storage
            .from('receipts')
            .upload(retPath, returnSlipFile);
          if (!retErr) {
            returnProofUrl = supabase.storage.from('receipts').getPublicUrl(retPath).data.publicUrl;
          }
        }

        await supabase
          .from('pre_claims')
          .update({
            status: 'Receipt Submitted',
            ...(insertedClaimId ? { linked_claim_id: insertedClaimId } : {}),
            return_balance_amount: returnBalance,
            ...(returnProofUrl ? { return_proof_url: returnProofUrl } : {}),
          })
          .eq('id', linkedPreClaim.id);
      }

      void logActivity(
        profile,
        'Claims',
        'Claim submitted',
        `${profile.full_name} (${profile.matric_no}) submitted claim "${title.trim()}" for RM ${numericAmount.toFixed(2)} (${eventLabel})${
          linkedPreClaim ? ` [Linked Pre-Claim: ${linkedPreClaim.title}]` : ''
        }`
      );

      const submittedTitle = title.trim();
      onSuccess(`✓ Claim "${submittedTitle}" (RM ${numericAmount.toFixed(2)}) submitted!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const handlePreClaimSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!preTitle.trim()) {
      setPreStep(1);
      setErrorMsg('Enter an item title for your pre-claim request.');
      return;
    }

    const estNum = parseFloat(preEstimatedAmount);
    if (isNaN(estNum) || estNum <= 0) {
      setPreStep(1);
      setErrorMsg('Enter a valid estimated amount (RM).');
      return;
    }

    if (preQuoteFile && preQuoteFile.size > MAX_FILE_SIZE_BYTES) {
      setPreStep(1);
      setErrorMsg('Quotation file must be under 50 MB.');
      return;
    }

    const advNum = needsCashAdvance ? parseFloat(advanceAmount || preEstimatedAmount) : 0;
    if (needsCashAdvance && (isNaN(advNum) || advNum <= 0)) {
      setPreStep(2);
      setErrorMsg('Enter a valid cash advance amount (RM).');
      return;
    }

    if (needsCashAdvance && claimantQrFile && claimantQrFile.size > MAX_FILE_SIZE_BYTES) {
      setPreStep(2);
      setErrorMsg('DuitNow QR file must be under 50 MB.');
      return;
    }

    setSubmitting(true);
    try {
      let finalQuoteUrl = preQuoteUrl.trim();
      if (preQuoteFile) {
        const qExt = preQuoteFile.name.split('.').pop() || 'jpg';
        const qPath = `preclaims/${profile.id}-${Date.now()}.${qExt}`;
        const { error: qErr } = await supabase.storage.from('receipts').upload(qPath, preQuoteFile);
        if (!qErr) {
          finalQuoteUrl = supabase.storage.from('receipts').getPublicUrl(qPath).data.publicUrl;
        }
      }

      let finalClaimantQr = needsCashAdvance ? claimantQrUrl.trim() : '';
      if (needsCashAdvance && claimantQrFile) {
        const qrExt = claimantQrFile.name.split('.').pop() || 'png';
        const qrPath = `member-qr/${profile.id}-${Date.now()}.${qrExt}`;
        const { error: qrErr } = await supabase.storage.from('receipts').upload(qrPath, claimantQrFile);
        if (!qrErr) {
          finalClaimantQr = supabase.storage.from('receipts').getPublicUrl(qrPath).data.publicUrl;
        }
      }

      const paymentSummary =
        needsCashAdvance && bankAccountNo.trim()
          ? `${bankName.trim() || 'Bank/DuitNow'} • ${bankAccountNo.trim()} (${bankAccountHolder.trim() || profile.full_name})`
          : '';

      const isOther = selectedEventOption === 'OTHER';
      const chosenBudget = budgets.find((b) => b.id === selectedEventOption);
      const eventLabel = isOther
        ? customEventName.trim() || 'General Club Expense'
        : chosenBudget?.event_name || 'General Club Expense';

      const { error: insErr } = await supabase.from('pre_claims').insert({
        user_id: profile.id,
        requester_name: profile.full_name,
        matric_no: profile.matric_no || '',
        phone_number: profile.phone_number || '',
        budget_id: isOther ? null : selectedEventOption,
        custom_event_name: isOther ? customEventName.trim() || 'General Club Expense' : '',
        title: preTitle.trim(),
        category,
        estimated_amount: Number(estNum.toFixed(2)),
        needed_date: preNeededDate || localTodayYmd(),
        reason: preReason.trim(),
        quote_url: finalQuoteUrl,
        needs_cash_advance: needsCashAdvance,
        advance_amount: needsCashAdvance ? Number(advNum.toFixed(2)) : 0,
        payment_info: paymentSummary,
        claimant_qr_url: finalClaimantQr,
        status: 'Pending',
      });

      if (insErr) throw insErr;

      void logActivity(
        profile,
        'Claims',
        'Pre-Claim submitted',
        `${profile.full_name} (${profile.matric_no}) submitted pre-claim "${preTitle.trim()}" for RM ${estNum.toFixed(2)} (${eventLabel})${
          needsCashAdvance ? ` + requested RM ${advNum.toFixed(2)} cash advance` : ''
        }`
      );

      const recipients = Array.from(
        new Set(adminRecipientIds.filter((uid) => uid && uid !== profile.id))
      );
      for (const uid of recipients) {
        void emitClubNotification({
          targetUserId: uid,
          type: 'claim',
          title: `New Pre-Claim: ${preTitle.trim()}`,
          body: `${profile.full_name} requested RM ${estNum.toFixed(2)}${
            needsCashAdvance ? ` (Cash Advance: RM ${advNum.toFixed(2)})` : ''
          } for ${eventLabel}`,
          targetTab: 'claims',
          actorName: profile.full_name,
        });
      }

      onSuccess(`✓ Pre-Claim "${preTitle.trim()}" (RM ${estNum.toFixed(2)}) submitted!`);
      onClose();
    } catch (err: unknown) {
      setErrorMsg(extractErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  };

  const renderEventDropdown = (prioritizeUpcoming: boolean) => {
    const firstGroupLabel = prioritizeUpcoming ? 'Upcoming / Future Events' : 'Past & Recent Events';
    const secondGroupLabel = prioritizeUpcoming ? 'Past & Recent Events' : 'Upcoming / Future Events';
    const firstGroup = prioritizeUpcoming ? upcomingEvents : pastOrRecentEvents;
    const secondGroup = prioritizeUpcoming ? pastOrRecentEvents : upcomingEvents;

    return (
      <>
        <div className="sm:col-span-2">
          <label className="block text-xs font-bold text-emerald-900 mb-1">
            Activity *
          </label>
          <select
            value={selectedEventOption}
            onChange={(e) => {
              setSelectedEventOption(e.target.value);
              setEventManuallyPicked(true);
            }}
            className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm text-slate-900 font-medium"
          >
            {firstGroup.length > 0 && (
              <optgroup label={firstGroupLabel}>
                {firstGroup.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event_name} ({b.event_date})
                  </option>
                ))}
              </optgroup>
            )}
            {secondGroup.length > 0 && (
              <optgroup label={secondGroupLabel}>
                {secondGroup.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event_name} ({b.event_date})
                  </option>
                ))}
              </optgroup>
            )}
            <option value="OTHER">Other / General Club Expense</option>
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
      </>
    );
  };

  const renderBankQrInputs = (customHintText: string) => {
    const profileBankName = (profile.bank_name || '').trim();
    const profileBankAccountNo = (profile.bank_account_no || '').trim();
    const profileBankHolder = (profile.bank_account_holder || profile.full_name || '').trim();
    const profileBankQrUrl = (profile.bank_qr_url || '').trim();
    const hasProfilePayment = Boolean(profileBankName || profileBankAccountNo || profileBankQrUrl);
    const isUsingCustomPayment =
      bankName.trim() !== profileBankName ||
      bankAccountNo.trim() !== profileBankAccountNo ||
      bankAccountHolder.trim() !== profileBankHolder ||
      Boolean(claimantQrFile) ||
      claimantQrUrl.trim() !== profileBankQrUrl;

    const activeQrIsPdf = claimantQrFile
      ? claimantQrFile.type === 'application/pdf' ||
        claimantQrFile.name.toLowerCase().endsWith('.pdf')
      : claimantQrUrl.toLowerCase().split('?')[0].endsWith('.pdf');
    const activeQrImageSrc = claimantQrFile ? localQrPreviewUrl : claimantQrUrl || null;
    const hasActiveQr = Boolean(claimantQrFile || claimantQrUrl);

    return (
      <>
        {(isUsingCustomPayment || hasProfilePayment) && (
          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
            <span className={isUsingCustomPayment ? 'text-amber-800 font-semibold' : 'text-emerald-800 font-medium'}>
              {isUsingCustomPayment ? customHintText : 'Auto-filled from your Profile'}
            </span>
            {isUsingCustomPayment && (
              <button
                type="button"
                onClick={() => {
                  setBankName(profile.bank_name || '');
                  setBankAccountNo(profile.bank_account_no || '');
                  setBankAccountHolder(profile.bank_account_holder || profile.full_name || '');
                  setClaimantQrUrl(profile.bank_qr_url || '');
                  setClaimantQrFile(null);
                }}
                className="text-emerald-700 hover:underline font-bold cursor-pointer"
              >
                Reset to Profile
              </button>
            )}
          </div>
        )}
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
        <div className="pt-1 text-xs space-y-2">
          <label className="block font-bold text-emerald-900">
            DuitNow QR (Optional)
          </label>
          <input
            type="file"
            accept="image/*,application/pdf"
            onChange={(e) => setClaimantQrFile(e.target.files?.[0] || null)}
            className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
          />
          {hasActiveQr && (
            <div className="flex items-center justify-between gap-3 bg-white px-3 py-2 rounded-xl border border-emerald-200 text-[11px]">
              <div className="flex items-center gap-2.5 min-w-0">
                {activeQrIsPdf ? (
                  <div className="w-14 h-14 rounded-lg border bg-emerald-50 flex flex-col items-center justify-center text-emerald-800 shrink-0">
                    <FileText className="w-5 h-5" />
                    <span className="text-[9px] font-extrabold">PDF</span>
                  </div>
                ) : activeQrImageSrc ? (
                  <img
                    src={activeQrImageSrc}
                    alt="Active DuitNow QR"
                    className="w-14 h-14 object-contain rounded-lg border bg-white shrink-0"
                  />
                ) : null}
                <span className="text-emerald-900 font-bold truncate">
                  {claimantQrFile ? claimantQrFile.name : '✓ Profile QR attached'}
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setClaimantQrFile(null);
                  setClaimantQrUrl('');
                }}
                className="text-rose-600 hover:underline font-bold shrink-0 cursor-pointer"
              >
                Remove
              </button>
            </div>
          )}
        </div>
      </>
    );
  };

  const goToStep = (target: 1 | 2 | 3) => {
    setErrorMsg(null);
    setStep(target);
  };

  const goToPreStep = (target: 1 | 2) => {
    setErrorMsg(null);
    if (target === 2 && needsCashAdvance && !advanceAmount && preEstimatedAmount) {
      setAdvanceAmount(preEstimatedAmount);
    }
    setPreStep(target);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-xl w-full overflow-hidden my-8">
        <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">
              {mode === 'receipt' ? 'Submit Claim' : 'Pre-Claim Request'}
            </h2>
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

        {/* Subtle Side Switcher Bar */}
        <div className="px-6 py-2 bg-slate-50 border-b border-slate-200/80 flex items-center justify-between gap-2 text-xs">
          {mode === 'receipt' ? (
            <>
              <span className="text-slate-500 font-medium">Claiming a past purchase</span>
              <button
                type="button"
                onClick={() => handleSwitchMode('preclaim')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-emerald-800 border border-slate-200 hover:border-emerald-300 font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                <span>Buying soon? Pre-Claim →</span>
              </button>
            </>
          ) : (
            <>
              <span className="text-emerald-900 font-semibold flex items-center gap-1.5">
                <CalendarClock className="w-3.5 h-3.5 text-emerald-600" />
                <span>Pre-Claim / Request Before Buying</span>
              </span>
              <button
                type="button"
                onClick={() => handleSwitchMode('receipt')}
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white hover:bg-emerald-50 text-slate-700 hover:text-emerald-900 border border-slate-200 font-bold text-[11px] transition cursor-pointer shrink-0"
              >
                <span>← Back to Claim Receipt</span>
              </button>
            </>
          )}
        </div>

        {/* Mode-Specific Stepper */}
        {mode === 'receipt' ? (
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
        ) : (
          <div className="grid grid-cols-2 gap-2 px-6 py-3 bg-emerald-50/70 border-b border-emerald-100 text-xs">
            {[
              {
                id: 1 as const,
                label: '1. Request Details',
                done: Boolean(preTitle.trim() && parseFloat(preEstimatedAmount) > 0),
              },
              {
                id: 2 as const,
                label: '2. Cash Advance (Optional)',
                done: !needsCashAdvance || Boolean(parseFloat(advanceAmount || preEstimatedAmount) > 0),
              },
            ].map((s) => {
              const active = preStep === s.id;
              return (
                <button
                  key={s.id}
                  type="button"
                  onClick={() => goToPreStep(s.id)}
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
        )}

        {/* Quick Complete Strip for Receipt Mode when member has Pre-Approved / Advance Disbursed Pre-Claims */}
        {mode === 'receipt' && actionablePreClaims.length > 0 && (
          <div className="px-6 py-2.5 bg-emerald-50 border-b border-emerald-200/80 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-bold text-emerald-900 text-[11px]">
              Upload receipt for approved Pre-Claim:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {actionablePreClaims.map((pc) => {
                const selected = linkedPreClaimId === pc.id;
                const capVal = Number(pc.approved_cap ?? pc.estimated_amount);
                return (
                  <button
                    key={pc.id}
                    type="button"
                    onClick={() => {
                      if (selected) {
                        setLinkedPreClaimId(null);
                      } else {
                        applyLinkedPreClaim(pc);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold transition cursor-pointer border ${
                      selected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                        : 'bg-white text-emerald-900 border-emerald-300 hover:bg-emerald-100'
                    }`}
                  >
                    <span>
                      {selected ? '✓ ' : ''}
                      {pc.title} · Est. RM {capVal.toFixed(0)}
                    </span>
                    {Number(pc.advance_disbursed_amount || 0) > 0 && (
                      <span
                        className={`px-1.5 py-0.2 rounded-full text-[9px] font-extrabold ${
                          selected ? 'bg-emerald-800 text-emerald-100' : 'bg-amber-100 text-amber-900'
                        }`}
                      >
                        Adv RM {Number(pc.advance_disbursed_amount).toFixed(0)}
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {mode === 'receipt' ? (
          <form
            onSubmit={handleReceiptSubmit}
            noValidate
            className="p-6 space-y-4 max-h-[72vh] overflow-y-auto"
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
                {linkedPreClaim && (() => {
                  const capVal = Number(linkedPreClaim.approved_cap ?? linkedPreClaim.estimated_amount);
                  const actualVal = parseFloat(amount) || 0;
                  const advGiven = Number(linkedPreClaim.advance_disbursed_amount || 0);
                  const withinCap = actualVal <= capVal;
                  const exceedDiff = Math.max(0, actualVal - capVal);
                  const advDiff = actualVal - advGiven;

                  return (
                    <div className="rounded-2xl border border-emerald-200 bg-emerald-50/70 p-3 space-y-2 text-xs">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-emerald-950">
                          Linked Pre-Claim: {linkedPreClaim.title}
                        </span>
                        {actualVal > 0 ? (
                          withinCap ? (
                            <span className="px-2.5 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[11px]">
                              ✓ Within Pre-Approved Cap (RM {actualVal.toFixed(2)} / RM {capVal.toFixed(2)})
                            </span>
                          ) : (
                            <span className="px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-950 border border-amber-300 font-bold text-[11px]">
                              ⚠ Exceeds Cap by RM {exceedDiff.toFixed(2)}
                            </span>
                          )
                        ) : (
                          <span className="px-2.5 py-0.5 rounded-full bg-white text-emerald-900 border border-emerald-200 font-bold text-[11px]">
                            Approved Cap: RM {capVal.toFixed(2)}
                          </span>
                        )}
                      </div>

                      {advGiven > 0 && (
                        <div className="rounded-xl bg-white border border-emerald-200 p-2.5 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2 text-[11px]">
                            <span className="text-slate-600">
                              Advance Given: <strong className="text-slate-900">RM {advGiven.toFixed(2)}</strong>
                              {' '}vs Receipt Total: <strong className="text-slate-900">RM {actualVal.toFixed(2)}</strong>
                            </span>
                            {Math.abs(advDiff) < 0.005 ? (
                              <span className="font-extrabold text-emerald-700">Exact Match (RM 0.00)</span>
                            ) : advDiff < 0 ? (
                              <span className="font-extrabold text-amber-800">
                                Balance to Return to Club: RM {Math.abs(advDiff).toFixed(2)}
                              </span>
                            ) : (
                              <span className="font-extrabold text-emerald-800">
                                Remaining Top-Up Owed: RM {advDiff.toFixed(2)}
                              </span>
                            )}
                          </div>

                          {advDiff < -0.005 && (
                            <div className="pt-1 border-t border-slate-100 flex flex-wrap items-center justify-between gap-2">
                              <span className="text-[11px] font-semibold text-slate-600">
                                Return Transfer Slip (Optional):
                              </span>
                              <label className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 font-bold text-[11px] cursor-pointer">
                                <UploadCloud className="w-3.5 h-3.5" />
                                <span>{returnSlipFile ? returnSlipFile.name : 'Upload Return Slip'}</span>
                                <input
                                  type="file"
                                  accept="image/*,application/pdf"
                                  onChange={(e) => setReturnSlipFile(e.target.files?.[0] || null)}
                                  className="hidden"
                                />
                              </label>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}

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
                  {renderEventDropdown(false)}

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
                  {includePaymentDetails &&
                    renderBankQrInputs("Custom for this claim only — your Profile won't be changed")}
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
        ) : (
          <form
            onSubmit={handlePreClaimSubmit}
            noValidate
            className="p-6 space-y-4 max-h-[72vh] overflow-y-auto"
          >
            {errorMsg && (
              <div className="flex items-center gap-2 text-xs bg-red-50 text-red-700 px-3.5 py-2.5 rounded-xl border border-red-200 font-semibold">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{errorMsg}</span>
              </div>
            )}

            {preStep === 1 && (
              <div className="space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {renderEventDropdown(true)}

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Item Title *
                    </label>
                    <input
                      type="text"
                      value={preTitle}
                      onChange={(e) => setPreTitle(e.target.value)}
                      placeholder="e.g., Tournament Chess Sets & Trophies"
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

                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Estimated Amount (RM) *
                    </label>
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                        RM
                      </span>
                      <input
                        type="number"
                        step="0.01"
                        min="0.01"
                        value={preEstimatedAmount}
                        onChange={(e) => setPreEstimatedAmount(e.target.value)}
                        placeholder="0.00"
                        className="w-full rounded-xl border border-emerald-300 pl-10 pr-3 py-2 text-sm font-bold"
                        required
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Needed-By Date *
                    </label>
                    <input
                      type="date"
                      value={preNeededDate}
                      onChange={(e) => setPreNeededDate(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Quotation Link (Optional)
                    </label>
                    <input
                      type="url"
                      value={preQuoteUrl}
                      onChange={(e) => setPreQuoteUrl(e.target.value)}
                      placeholder="https://..."
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Short Reason / Purpose
                    </label>
                    <textarea
                      rows={2}
                      value={preReason}
                      onChange={(e) => setPreReason(e.target.value)}
                      placeholder="Why is this budget needed before purchasing?"
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    />
                  </div>

                  <div className="sm:col-span-2">
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Upload Quotation Image / PDF (Optional)
                    </label>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => setPreQuoteFile(e.target.files?.[0] || null)}
                      className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                  </div>
                </div>

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
                    onClick={() => goToPreStep(2)}
                    className="inline-flex items-center gap-1.5 px-5 py-2.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                  >
                    <span>Next: Cash Advance</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </div>
            )}

            {preStep === 2 && (
              <div className="space-y-4">
                <div className="rounded-xl bg-emerald-50 border border-emerald-200 px-3.5 py-2.5 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="min-w-0">
                    <span className="font-bold text-slate-900 block truncate">
                      {preTitle || 'Pre-Claim Request'}
                    </span>
                    <span className="text-[11px] text-slate-600">
                      {selectedEventOption === 'OTHER'
                        ? customEventName.trim() || 'General Club Expense'
                        : budgets.find((b) => b.id === selectedEventOption)?.event_name || 'Activity'}
                      {' · Needed by '}
                      {preNeededDate}
                    </span>
                  </div>
                  <span className="font-extrabold text-emerald-900 text-sm">
                    Est. RM {(parseFloat(preEstimatedAmount) || 0).toFixed(2)}
                  </span>
                </div>

                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-3">
                  <div className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
                    <Wallet className="w-4 h-4 text-emerald-600" />
                    <span>Need upfront cash advance before buying?</span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
                    <button
                      type="button"
                      onClick={() => setNeedsCashAdvance(false)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        !needsCashAdvance
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold">No — I&apos;ll pay first &amp; claim later</div>
                      <div className={`text-[11px] mt-0.5 ${!needsCashAdvance ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Get budget approval cap before spending
                      </div>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setNeedsCashAdvance(true);
                        if (!advanceAmount && preEstimatedAmount) {
                          setAdvanceAmount(preEstimatedAmount);
                        }
                      }}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                        needsCashAdvance
                          ? 'bg-emerald-600 text-white border-emerald-600 shadow-2xs'
                          : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      <div className="font-bold">Yes — Request Cash Advance</div>
                      <div className={`text-[11px] mt-0.5 ${needsCashAdvance ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Receive upfront funds before the purchase
                      </div>
                    </button>
                  </div>
                </div>

                {needsCashAdvance && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-3">
                    <div>
                      <label className="block text-xs font-bold text-emerald-900 mb-1">
                        Advance Amount Needed (RM) *
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">
                          RM
                        </span>
                        <input
                          type="number"
                          step="0.01"
                          min="0.01"
                          value={advanceAmount}
                          onChange={(e) => setAdvanceAmount(e.target.value)}
                          placeholder={preEstimatedAmount || '0.00'}
                          className="w-full rounded-xl border border-emerald-300 bg-white pl-10 pr-3 py-2 text-sm font-bold"
                          required
                        />
                      </div>
                    </div>

                    <div className="space-y-2 pt-1 border-t border-emerald-200/70">
                      <span className="text-xs font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <Landmark className="w-4 h-4 text-emerald-700" />
                        <span>Bank / DuitNow for Advance Transfer</span>
                      </span>
                      {renderBankQrInputs("Custom for this request only — your Profile won't be changed")}
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between gap-2.5 pt-3 border-t border-emerald-100">
                  <button
                    type="button"
                    onClick={() => goToPreStep(1)}
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
                    <span>{submitting ? 'Submitting...' : 'Submit Pre-Claim'}</span>
                  </button>
                </div>
              </div>
            )}
          </form>
        )}
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
