import { Claim } from '@/lib/supabase';

export interface ClaimReceiptLineItem {
  id: string;
  shop: string;
  amount: string;
  date?: string;
  fileName?: string;
  rawText?: string;
}

export interface ParsedLineItem {
  shop: string;
  amount: number;
}

export interface DuplicateClaimCandidate {
  excludeClaimId?: string;
  amount: number;
  expenseDate: string;
  merchantName: string;
  receiptFileName?: string;
  extraFileNames?: string[];
  rawOcrText?: string;
  lineItems?: {
    shop: string;
    amount: number;
    date?: string;
    fileName?: string;
    rawText?: string;
  }[];
}

export interface DuplicateClaimMatch {
  claim: Claim;
  claimNumber: number;
  reasons: string[];
  headline: string;
}

const ITEMS_TAG_RE = /\s*\[Items:\s*([^\]]+)\]/i;

const GENERIC_FILENAME_RE =
  /^(receipt|image|photo|img|scan|document|file|stitched-\d+-receipts-\d+|receipt-scan-\d+)(?:[-_\s]\d+)?\.(jpe?g|png|webp|pdf|heic)$/i;

function normalizeText(value: string | undefined | null): string {
  return String(value || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '');
}

function isGenericFilename(name: string | undefined | null): boolean {
  const clean = String(name || '').trim();
  if (!clean) return true;
  if (/^stitched-\d+-receipts-\d+\.jpg$/i.test(clean)) return true;
  if (/^receipt-scan-\d+\.jpg$/i.test(clean)) return true;
  return GENERIC_FILENAME_RE.test(clean);
}

function tokenizeOcr(text: string | undefined | null): Set<string> {
  const stopWords = new Set([
    'event',
    'reimburse',
    'general',
    'club',
    'expense',
    'receipt',
    'attached',
    'merchant',
    'maybank',
    'cimb',
    'duitnow',
    'total',
    'amount',
    'items',
    'malaysia',
    'date',
  ]);
  const tokens = String(text || '')
    .toLowerCase()
    .replace(/\[event:[^\]]*\]/gi, ' ')
    .replace(/reimburse to:[^|[\]]*/gi, ' ')
    .replace(/\[items:[^\]]*\]/gi, ' ')
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 4 && !stopWords.has(t));
  return new Set(tokens);
}

function jaccardSimilarity(a: Set<string>, b: Set<string>): { ratio: number; commonCount: number } {
  if (a.size === 0 || b.size === 0) return { ratio: 0, commonCount: 0 };
  let commonCount = 0;
  a.forEach((tok) => {
    if (b.has(tok)) commonCount += 1;
  });
  const unionSize = a.size + b.size - commonCount;
  return {
    ratio: unionSize > 0 ? commonCount / unionSize : 0,
    commonCount,
  };
}

export function formatShortDate(isoDate: string | undefined | null): string {
  const raw = String(isoDate || '').trim();
  if (!raw) return 'unknown date';
  const parsed = new Date(raw.includes('T') ? raw : `${raw}T00:00:00`);
  if (isNaN(parsed.getTime())) return raw;
  return parsed.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

export function formatItemizedBreakdownTag(
  items: ClaimReceiptLineItem[],
  forceInclude = false
): string {
  const valid = items
    .map((item) => ({
      shop: item.shop.replace(/[\[\]|]/g, ' ').trim(),
      amount: parseFloat(item.amount),
    }))
    .filter((item) => item.shop.length > 0 || (!isNaN(item.amount) && item.amount > 0));

  if (valid.length === 0) return '';
  if (valid.length === 1 && !forceInclude) return '';

  const formatted = valid
    .map((item, idx) => {
      const shopLabel = item.shop || `Receipt ${idx + 1}`;
      const amtLabel = !isNaN(item.amount) && item.amount > 0 ? item.amount.toFixed(2) : '0.00';
      return `#${idx + 1} ${shopLabel} (RM ${amtLabel})`;
    })
    .join(' | ');

  return `[Items: ${formatted}]`;
}

export function parseItemizedBreakdownFromDescription(description?: string): {
  cleanDescription: string;
  items: ParsedLineItem[];
} {
  const raw = String(description || '');
  const match = ITEMS_TAG_RE.exec(raw);
  if (!match) {
    return { cleanDescription: raw.trim(), items: [] };
  }

  const cleanDescription = raw.replace(ITEMS_TAG_RE, '').trim();
  const segments = match[1]
    .split('|')
    .map((s) => s.trim())
    .filter(Boolean);

  const items: ParsedLineItem[] = [];
  for (const seg of segments) {
    const parsed = /^(?:#\d+\s+)?(.+?)\s*\(\s*RM\s*([\d,.]+)\s*\)$/i.exec(seg);
    if (parsed) {
      const amt = parseFloat(parsed[2].replace(/,/g, ''));
      items.push({
        shop: parsed[1].trim(),
        amount: isNaN(amt) ? 0 : amt,
      });
    } else {
      items.push({ shop: seg, amount: 0 });
    }
  }

  return { cleanDescription, items };
}

export function findDuplicateClaims(
  candidate: DuplicateClaimCandidate,
  existingClaims: Claim[]
): DuplicateClaimMatch[] {
  if (!existingClaims || existingClaims.length === 0) return [];

  const chronological = [...existingClaims].sort((a, b) => {
    const ta = new Date(a.created_at || a.expense_date || 0).getTime() || 0;
    const tb = new Date(b.created_at || b.expense_date || 0).getTime() || 0;
    return ta - tb;
  });

  const candidateAmounts: { amount: number; date: string; merchant: string }[] = [];
  if (candidate.amount > 0) {
    candidateAmounts.push({
      amount: candidate.amount,
      date: candidate.expenseDate,
      merchant: candidate.merchantName,
    });
  }
  for (const li of candidate.lineItems || []) {
    if (li.amount > 0) {
      candidateAmounts.push({
        amount: li.amount,
        date: li.date || candidate.expenseDate,
        merchant: li.shop || candidate.merchantName,
      });
    }
  }

  const candidateFileNames = new Set<string>();
  const addFileName = (name?: string) => {
    if (name && !isGenericFilename(name)) {
      candidateFileNames.add(name.trim().toLowerCase());
    }
  };
  addFileName(candidate.receiptFileName);
  (candidate.extraFileNames || []).forEach(addFileName);
  (candidate.lineItems || []).forEach((li) => addFileName(li.fileName));

  const combinedOcr = [
    candidate.rawOcrText || '',
    ...(candidate.lineItems || []).map((li) => li.rawText || ''),
  ]
    .join('\n')
    .trim();
  const candidateTokens = tokenizeOcr(combinedOcr);

  const matches: DuplicateClaimMatch[] = [];

  chronological.forEach((existing, index) => {
    if (candidate.excludeClaimId && existing.id === candidate.excludeClaimId) return;

    const claimNumber = index + 1;
    const reasons: string[] = [];

    const existingParsed = parseItemizedBreakdownFromDescription(existing.description);
    const existingAmounts = new Set<number>();
    if (Number(existing.amount) > 0) existingAmounts.add(Number(existing.amount));
    if (existing.ai_extracted_amount && Number(existing.ai_extracted_amount) > 0) {
      existingAmounts.add(Number(existing.ai_extracted_amount));
    }
    existingParsed.items.forEach((item) => {
      if (item.amount > 0) existingAmounts.add(item.amount);
    });

    const existingMerchants = new Set<string>();
    const addMerchant = (m?: string) => {
      const norm = normalizeText(m);
      if (norm && norm !== 'merchant') existingMerchants.add(norm);
    };
    addMerchant(existing.merchant_name);
    addMerchant(existing.ai_extracted_merchant || '');
    existingParsed.items.forEach((item) => addMerchant(item.shop));

    // 1. Same Amount + Same Date
    const sameAmtDateHit = candidateAmounts.some(
      (ca) =>
        Boolean(ca.date && existing.expense_date && ca.date === existing.expense_date) &&
        Array.from(existingAmounts).some((ea) => Math.abs(ea - ca.amount) < 0.005)
    );
    if (sameAmtDateHit) {
      reasons.push(`Same RM amount on ${formatShortDate(existing.expense_date)}`);
    }

    // 2. Same receipt filename (ignoring camera auto filenames like receipt-scan-123.jpg)
    const existingFile = existing.receipt_file_name?.trim().toLowerCase() || '';
    if (existingFile && !isGenericFilename(existingFile) && candidateFileNames.has(existingFile)) {
      reasons.push(`Same receipt filename (${existing.receipt_file_name})`);
    }

    // 3. Same Amount + Same Merchant (even if date wasn't read identically)
    const sameAmtMerchantHit = candidateAmounts.some((ca) => {
      const caMerch = normalizeText(ca.merchant);
      if (!caMerch || caMerch === 'merchant') return false;
      const merchMatch = Array.from(existingMerchants).some(
        (em) => em === caMerch || (em.length >= 5 && caMerch.includes(em)) || (caMerch.length >= 5 && em.includes(caMerch))
      );
      return merchMatch && Array.from(existingAmounts).some((ea) => Math.abs(ea - ca.amount) < 0.005);
    });
    if (sameAmtMerchantHit && !sameAmtDateHit) {
      reasons.push(`Same RM amount & merchant (${existing.merchant_name || 'Merchant'})`);
    }

    // 4. Similar OCR / receipt text
    if (candidateTokens.size >= 5) {
      const existingTokens = tokenizeOcr(
        `${existing.title || ''} ${existing.ai_extracted_merchant || ''} ${existing.ai_ocr_summary || ''} ${existingParsed.cleanDescription}`
      );
      const { ratio, commonCount } = jaccardSimilarity(candidateTokens, existingTokens);
      if (commonCount >= 5 && ratio >= 0.6) {
        reasons.push(`Similar scanned receipt text (${Math.round(ratio * 100)}% overlap)`);
      }
    }

    if (reasons.length > 0) {
      const merchantDisplay =
        existing.merchant_name && normalizeText(existing.merchant_name) !== 'merchant'
          ? ` at ${existing.merchant_name}`
          : '';
      const headline = `⚠️ Heads up: Claim #${claimNumber} by ${existing.claimant_name} on ${formatShortDate(
        existing.expense_date
      )} also claimed RM ${Number(existing.amount).toFixed(2)}${merchantDisplay}.`;
      matches.push({
        claim: existing,
        claimNumber,
        reasons,
        headline,
      });
    }
  });

  return matches.sort((a, b) => {
    if (b.reasons.length !== a.reasons.length) return b.reasons.length - a.reasons.length;
    return b.claimNumber - a.claimNumber;
  });
}
