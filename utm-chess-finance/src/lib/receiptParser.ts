export interface ParsedReceipt {
  amount: number | null;
  merchant: string;
  merchantKnown: boolean;
  date: string | null;
  confidence: number;
  suggestedCategory: string;
  anomalyFlags: string[];
}

interface KnownMerchant {
  name: string;
  category: string;
  patterns: RegExp[];
}

/** Common Malaysian merchants / payment apps seen on student receipts. */
const KNOWN_MERCHANTS: KnownMerchant[] = [
  { name: 'Shopee', category: 'Equipment & Logistics', patterns: [/shopee/i, /shopeepay/i, /spx\s*express/i] },
  { name: '99 Speedmart', category: 'Food & Refreshments', patterns: [/99\s*speed\s*mart/i, /99\s*sm\b/i, /speedmart/i] },
  { name: 'Mr. DIY', category: 'Equipment & Logistics', patterns: [/mr\.?\s*d\.?i\.?y/i, /mrdiy/i] },
  { name: 'Touch n Go eWallet', category: 'Transport / Carpool Allowance', patterns: [/touch\s*['’`n]*\s*go/i, /\btng\b/i, /tng\s*digital/i] },
  { name: 'Maybank MAE', category: 'Event / Activity Expense', patterns: [/\bmae\b/i, /maybank2u/i, /maybank/i, /malayan\s*banking/i] },
  { name: 'Lazada', category: 'Equipment & Logistics', patterns: [/lazada/i] },
  { name: 'Grab', category: 'Transport / Carpool Allowance', patterns: [/\bgrab(pay|food|car|mart)?\b/i] },
  { name: 'Lotus’s', category: 'Food & Refreshments', patterns: [/lotus'?s?\b/i] },
  { name: 'AEON', category: 'Food & Refreshments', patterns: [/\baeon\b/i] },
  { name: 'Giant', category: 'Food & Refreshments', patterns: [/\bgiant\b/i] },
  { name: 'Econsave', category: 'Food & Refreshments', patterns: [/econsave/i] },
  { name: 'KK Mart', category: 'Food & Refreshments', patterns: [/kk\s*super\s*mart/i, /\bkk\s*mart/i] },
  { name: '7-Eleven', category: 'Food & Refreshments', patterns: [/7[\s-]*eleven/i] },
  { name: 'FamilyMart', category: 'Food & Refreshments', patterns: [/family\s*mart/i] },
  { name: 'Watsons', category: 'Event / Activity Expense', patterns: [/watsons/i] },
  { name: 'Guardian', category: 'Event / Activity Expense', patterns: [/\bguardian\b/i] },
  { name: 'Popular Bookstore', category: 'Equipment & Logistics', patterns: [/popular\s*book/i] },
  { name: 'Petronas', category: 'Transport / Carpool Allowance', patterns: [/petronas/i] },
  { name: 'Shell', category: 'Transport / Carpool Allowance', patterns: [/\bshell\b/i] },
  { name: 'McDonald’s', category: 'Food & Refreshments', patterns: [/mcdonald/i] },
  { name: 'KFC', category: 'Food & Refreshments', patterns: [/\bkfc\b/i] },
  { name: 'Starbucks', category: 'Food & Refreshments', patterns: [/starbucks/i] },
  { name: 'ZUS Coffee', category: 'Food & Refreshments', patterns: [/zus\s*coffee/i] },
  { name: 'Tealive', category: 'Food & Refreshments', patterns: [/tealive/i] },
  { name: 'Pos Malaysia', category: 'Equipment & Logistics', patterns: [/pos\s*malaysia/i, /poslaju/i] },
  { name: 'J&T Express', category: 'Equipment & Logistics', patterns: [/j\s*&\s*t\s*express/i, /\bj&t\b/i] },
];

const MONTHS: Record<string, number> = {
  jan: 1, january: 1, januari: 1,
  feb: 2, february: 2, februari: 2,
  mar: 3, march: 3, mac: 3,
  apr: 4, april: 4,
  may: 5, mei: 5,
  jun: 6, june: 6,
  jul: 7, july: 7, julai: 7,
  aug: 8, august: 8, ogos: 8, ogo: 8,
  sep: 9, sept: 9, september: 9,
  oct: 10, october: 10, okt: 10, oktober: 10,
  nov: 11, november: 11,
  dec: 12, december: 12, dis: 12, disember: 12,
};

// Lines that hold amounts we must NOT treat as the payable total.
const EXCLUDE_LINE = /(change|baki|tender|cash\s*(?:given|received)?|tunai|rounding|pembundaran|discount|diskaun|voucher|saving|sst|gst|tax|cukai|subtotal|sub\s*total|points?|balance|baki\s*akaun|deposit|service\s*charge|delivery\s*fee|shipping)/i;

// Highest → lowest confidence of "this is the amount paid".
const TOTAL_KEYWORDS: { re: RegExp; weight: number }[] = [
  { re: /(grand\s*total|jumlah\s*besar)/i, weight: 100 },
  { re: /(total\s*(?:amount\s*)?(?:paid|payable|due|bayar)|amount\s*(?:paid|payable|due)|jumlah\s*(?:bayaran|perlu\s*dibayar)|net\s*total|total\s*payment|payment\s*amount|bayaran)/i, weight: 95 },
  { re: /(total\s*\(?rm\)?|total\s*amount|total\s*sales|total\b|jumlah\b)/i, weight: 80 },
  { re: /(amount|transfer\s*amount|pay\s*amount|you\s*paid|paid|debit)/i, weight: 60 },
];

function toNumber(raw: string): number | null {
  const cleaned = raw.replace(/,/g, '').replace(/\s+/g, '');
  const n = parseFloat(cleaned);
  return isNaN(n) ? null : n;
}

/** Fix the common OCR slips: "12 .50", "12,50", "RM12.5O". */
function normaliseOcr(text: string): string {
  return text
    .replace(/\r/g, '')
    .replace(/(\d)\s+([.,])\s*(\d{2})\b/g, '$1$2$3')
    .replace(/(\d)[oO](?=\d|\b)/g, '$10')
    .replace(/\b(RM|MYR)\s*[:\-]?\s*/gi, 'RM ');
}

const AMOUNT_RE = /(?:RM|MYR)?\s*((?:\d{1,3}(?:,\d{3})+|\d+)[.,]\d{2})(?!\d)/gi;

function amountsInLine(rawLine: string): number[] {
  const out: number[] = [];
  // Dates ("15.11.26") and times ("19:30") must not be mistaken for money.
  const line = rawLine
    .replace(/\b\d{1,2}[-/.]\d{1,2}[-/.]\d{2,4}\b/g, ' ')
    .replace(/\b\d{1,2}:\d{2}(?::\d{2})?\b/g, ' ');
  let m: RegExpExecArray | null;
  const re = new RegExp(AMOUNT_RE.source, 'gi');
  while ((m = re.exec(line)) !== null) {
    const v = toNumber(m[1].replace(/,(\d{2})$/, '.$1'));
    if (v !== null && v > 0 && v < 100000) out.push(v);
  }
  return out;
}

function findAmount(lines: string[]): { value: number | null; keywordHit: boolean } {
  let bestValue: number | null = null;
  let bestWeight = -1;
  let bestIdx = -1;

  for (let idx = 0; idx < lines.length; idx++) {
    const line = lines[idx];
    if (EXCLUDE_LINE.test(line) && !/(grand\s*total|total\s*paid|amount\s*paid)/i.test(line)) continue;
    const kw = TOTAL_KEYWORDS.find((k) => k.re.test(line));
    if (!kw) continue;
    let nums = amountsInLine(line);
    // Value sometimes sits on the next line ("TOTAL" \n "RM 15.00")
    if (nums.length === 0 && lines[idx + 1] && !EXCLUDE_LINE.test(lines[idx + 1])) {
      nums = amountsInLine(lines[idx + 1]);
    }
    if (nums.length === 0) continue;
    const value = nums[nums.length - 1];
    if (kw.weight > bestWeight || (kw.weight === bestWeight && idx > bestIdx)) {
      bestValue = value;
      bestWeight = kw.weight;
      bestIdx = idx;
    }
  }

  if (bestValue !== null) return { value: bestValue, keywordHit: true };

  // Fallback (e.g. e-wallet screenshots with a big "RM 15.00"): largest sane amount.
  const all = lines
    .filter((l) => !EXCLUDE_LINE.test(l))
    .flatMap((l) => amountsInLine(l));
  if (all.length === 0) return { value: null, keywordHit: false };
  return { value: Math.max(...all), keywordHit: false };
}

function inspectDate(
  y: number,
  m: number,
  d: number
): { iso: string | null; isFuture: boolean } {
  if (y < 100) y += 2000;
  if (y < 2015 || m < 1 || m > 12 || d < 1 || d > 31) {
    return { iso: null, isFuture: false };
  }
  const dt = new Date(y, m - 1, d);
  if (dt.getFullYear() !== y || dt.getMonth() !== m - 1 || dt.getDate() !== d) {
    return { iso: null, isFuture: false };
  }
  // A receipt cannot be from the future (allow 1 day for timezone drift).
  if (dt.getTime() > Date.now() + 86400000) {
    return { iso: null, isFuture: true };
  }
  return {
    iso: `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`,
    isFuture: false,
  };
}

function findDate(text: string): { date: string | null; hasFutureDate: boolean } {
  const patterns: { re: RegExp; build: (m: RegExpExecArray) => { iso: string | null; isFuture: boolean } }[] = [
    // 2026-11-15 / 2026/11/15
    { re: /\b(20\d{2})[-/.](\d{1,2})[-/.](\d{1,2})\b/g, build: (m) => inspectDate(+m[1], +m[2], +m[3]) },
    // 15/11/2026, 15-11-26, 15.11.2026  (Malaysia = day first)
    { re: /\b(\d{1,2})[-/.](\d{1,2})[-/.](\d{4}|\d{2})\b/g, build: (m) => inspectDate(+m[3], +m[2], +m[1]) },
    // 15 Nov 2026 / 15-Nov-26 / 15 Disember 2026
    {
      re: /\b(\d{1,2})[\s\-/.]*([A-Za-z]{3,9})[\s\-/.,]*(\d{4}|\d{2})\b/g,
      build: (m) => {
        const mon = MONTHS[m[2].toLowerCase()];
        return mon ? inspectDate(+m[3], mon, +m[1]) : { iso: null, isFuture: false };
      },
    },
    // Nov 15, 2026
    {
      re: /\b([A-Za-z]{3,9})\s+(\d{1,2}),?\s+(\d{4})\b/g,
      build: (m) => {
        const mon = MONTHS[m[1].toLowerCase()];
        return mon ? inspectDate(+m[3], mon, +m[2]) : { iso: null, isFuture: false };
      },
    },
  ];

  let futureSeen = false;
  for (const { re, build } of patterns) {
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const checked = build(m);
      if (checked.isFuture) futureSeen = true;
      if (checked.iso) return { date: checked.iso, hasFutureDate: futureSeen };
    }
  }
  return { date: null, hasFutureDate: futureSeen };
}

function findMerchant(text: string, lines: string[]): { name: string; known: boolean; categoryHint: string } {
  for (const km of KNOWN_MERCHANTS) {
    if (km.patterns.some((p) => p.test(text))) {
      return { name: km.name, known: true, categoryHint: km.category };
    }
  }
  // Fallback: first "name-like" line near the top of the receipt.
  const candidate = lines.slice(0, 8).find((l) => {
    const letters = (l.match(/[A-Za-z]/g) || []).length;
    return (
      letters >= 4 &&
      letters / Math.max(l.length, 1) > 0.55 &&
      !/(receipt|invoice|tax|official|welcome|thank|tel|phone|www|http|gst|sst|reg|date|time|cashier|no\.)/i.test(l)
    );
  });
  return {
    name: candidate ? candidate.replace(/[^A-Za-z0-9&'’.\- ]/g, '').trim().slice(0, 60) : '',
    known: false,
    categoryHint: '',
  };
}

function suggestExpenseCategory(merchantCategoryHint: string, rawText: string): string {
  if (merchantCategoryHint) return merchantCategoryHint;
  if (/(mineral|drink|makan|food|nasi|meal|bento|tea|coffee|snack|catering|cafe|restoran|restaurant)/i.test(rawText)) {
    return 'Food & Refreshments';
  }
  if (/(petrol|fuel|diesel|toll|plus\b|parking|carpool|grab|fare|taxi)/i.test(rawText)) {
    return 'Transport / Carpool Allowance';
  }
  if (/(print|photostat|banner|stationery|paper|medal|trophy|cert|certificate|hardware|chess|board|clock|equipment)/i.test(rawText)) {
    return 'Equipment & Logistics';
  }
  return '';
}

export function parseMalaysianReceipt(rawText: string, ocrConfidence = 70): ParsedReceipt {
  const text = normaliseOcr(rawText || '');
  const lines = text
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const amount = findAmount(lines);
  const merchant = findMerchant(text, lines);
  const dateResult = findDate(text);

  let score = 0;
  if (amount.value !== null) score += amount.keywordHit ? 45 : 25;
  if (merchant.name) score += merchant.known ? 25 : 10;
  if (dateResult.date) score += 20;
  const confidence = Math.max(
    25,
    Math.min(99, Math.round(score * 0.8 + Math.min(100, Math.max(0, ocrConfidence)) * 0.2))
  );

  const suggestedCategory = suggestExpenseCategory(merchant.categoryHint, text);
  const anomalyFlags: string[] = [];
  if (amount.value === null) {
    anomalyFlags.push('Could not extract total RM amount cleanly — verify payable amount.');
  }
  if (dateResult.hasFutureDate) {
    anomalyFlags.push('Receipt text appears to contain a future date — please double-check the expense date.');
  } else if (!dateResult.date) {
    anomalyFlags.push('Receipt date not detected automatically — confirm expense date.');
  }
  if (confidence < 55) {
    anomalyFlags.push(`Low OCR clarity (${confidence}%) — double-check merchant, date & total.`);
  }

  return {
    amount: amount.value,
    merchant: merchant.name,
    merchantKnown: merchant.known,
    date: dateResult.date,
    confidence,
    suggestedCategory,
    anomalyFlags,
  };
}
