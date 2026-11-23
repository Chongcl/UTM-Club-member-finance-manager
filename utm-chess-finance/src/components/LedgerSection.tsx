'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  supabase,
  UserProfile,
  Budget,
  BudgetPlanItem,
  EventRsvp,
  Claim,
  PreClaim,
  PublicGuestRegistration,
  ActivityFeePayment,
  ActivityLogEntry,
  AccountType,
  ExcelCellValue,
  MAX_FILE_SIZE_BYTES,
  ensureSheetJsLoaded,
  exportMultiSheetExcel,
  logActivity,
} from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { waLink } from '@/lib/whatsapp';
import type { MemberLookupHint } from '@/lib/memberLookup';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import { LedgerSkeleton } from './LoadingSkeletons';
import {
  Search,
  Plus,
  Minus,
  Upload,
  FileSpreadsheet,
  ExternalLink,
  History,
  Trash2,
  Edit3,
  X,
  CheckCircle2,
  Loader2,
  MessageCircle,
  Landmark,
  Banknote,
  CornerDownLeft,
  ChevronDown,
  ChevronRight,
} from 'lucide-react';

export interface LedgerEntryItem {
  id: string;
  entry_type: 'IN' | 'OUT';
  title: string;
  category: string;
  event_name?: string;
  amount: number;
  account_type?: AccountType;
  entry_date: string;
  person_in_charge: string;
  notes: string;
  attachment_url?: string;
  attachment_name?: string;
  deleted_at?: string | null;
  deleted_by?: string | null;
  created_at: string;
}

interface LedgerSectionProps {
  entries: LedgerEntryItem[];
  events?: { id: string; event_name: string }[];
  budgets?: Budget[];
  budgetPlanItems?: BudgetPlanItem[];
  rsvps?: EventRsvp[];
  claims: Claim[];
  preClaims?: PreClaim[];
  feePayments?: ActivityFeePayment[];
  guestRegistrations?: PublicGuestRegistration[];
  logs?: ActivityLogEntry[];
  profile: UserProfile;
  canEdit?: boolean;
  openingBank?: number;
  openingCash?: number;
  openingDate?: string;
  onSaveOpeningBalance?: (next: { bank: number; cash: number; date: string }) => Promise<void>;
  externalOpenModal?: boolean;
  onCloseExternalModal?: () => void;
  onSelectClaim?: (claim: Claim) => void;
  onRefresh: (msg: string) => void;
  onOpenMemberProfile?: (hint: MemberLookupHint) => void;
  loading?: boolean;
}

type FinanceTabView = 'sheet' | 'activity' | 'unpaid' | 'plan';
type SheetFilterPill = 'ALL' | 'IN' | 'OUT' | 'CLAIMS_FEES';
type EditableCellField = 'date' | 'title' | 'event' | 'in' | 'out';

interface UnifiedFinanceRow {
  uid: string;
  recordId: string;
  source: 'LEDGER' | 'CLAIM' | 'FEE' | 'GUEST_FEE';
  date: string;
  createdAt: string;
  entryType: 'IN' | 'OUT';
  eventName: string;
  budgetId: string | null;
  category: string;
  title: string;
  personShort: string;
  accountType: AccountType;
  amount: number;
  runningBalance: number;
  attachmentUrl?: string;
  rawLedger?: LedgerEntryItem;
  rawClaim?: Claim;
  rawFee?: ActivityFeePayment;
  rawGuest?: PublicGuestRegistration;
}

interface ParsedImportRow {
  entry_date: string;
  entry_type: 'IN' | 'OUT';
  event_name: string;
  category: string;
  title: string;
  amount: number;
  account_type: AccountType;
  notes: string;
}

const IN_CATEGORIES = [
  'Activity / Tournament Income',
  'University Grant / Allocation',
  'Sponsorship / Donation',
  'Carry-Forward / Opening Balance',
  'Other Income',
];

const OUT_CATEGORIES = [
  'Event / Activity Expense',
  'Food & Refreshments',
  'Equipment & Logistics',
  'Prizes & Certificates',
  'Transport / Carpool Allowance',
  'Other Expense',
];

const ACTIVITY_PALETTE = [
  'bg-emerald-50 text-emerald-800 border-emerald-200',
  'bg-sky-50 text-sky-800 border-sky-200',
  'bg-indigo-50 text-indigo-800 border-indigo-200',
  'bg-amber-50 text-amber-800 border-amber-200',
  'bg-purple-50 text-purple-800 border-purple-200',
  'bg-teal-50 text-teal-800 border-teal-200',
  'bg-rose-50 text-rose-800 border-rose-200',
];

function todayIso(): string {
  return new Date().toISOString().split('T')[0];
}

function formatRM(value: number): string {
  return Math.abs(value).toLocaleString('en-MY', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

function accountOf(val?: string | null): AccountType {
  return val === 'Cash' ? 'Cash' : 'Bank';
}

function shortPersonName(raw?: string | null): string {
  const s = (raw || '').trim();
  if (!s) return 'Club';
  return s.split('(')[0].trim() || s;
}

function isGeneralEventName(name?: string | null): boolean {
  const clean = (name || '').trim().toLowerCase();
  return (
    !clean ||
    clean === 'general' ||
    clean === 'general club fund' ||
    clean.includes('general club') ||
    clean.includes('carry-forward')
  );
}

function normalizeScopeName(name?: string | null): string {
  return isGeneralEventName(name) ? 'General Club Fund' : String(name || '').trim();
}

function getActivityBadgeStyle(eventName: string): string {
  if (isGeneralEventName(eventName)) {
    return 'bg-slate-100 text-slate-700 border-slate-200';
  }
  let hash = 0;
  for (let i = 0; i < eventName.length; i++) {
    hash = (hash * 31 + eventName.charCodeAt(i)) >>> 0;
  }
  return ACTIVITY_PALETTE[hash % ACTIVITY_PALETTE.length];
}

function normalizeImportDate(raw: unknown): string {
  if (typeof raw === 'number' && !isNaN(raw) && raw > 25000 && raw < 80000) {
    const utcDays = Math.floor(raw - 25569);
    const d = new Date(utcDays * 86400 * 1000);
    if (!isNaN(d.getTime())) return d.toISOString().split('T')[0];
  }
  const s = String(raw ?? '').trim();
  if (!s) return todayIso();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const isoPrefix = /^(\d{4}-\d{2}-\d{2})T/.exec(s);
  if (isoPrefix) return isoPrefix[1];
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const m = String(parseInt(dmy[2], 10)).padStart(2, '0');
    const d = String(parseInt(dmy[1], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  const parsed = new Date(s);
  if (!isNaN(parsed.getTime())) return parsed.toISOString().split('T')[0];
  return todayIso();
}

function parseAmountCell(raw: unknown): number | null {
  if (typeof raw === 'number') return isNaN(raw) ? null : raw;
  const s = String(raw ?? '')
    .replace(/RM/gi, '')
    .replace(/,/g, '')
    .replace(/\s+/g, '')
    .trim();
  if (!s || s === '-' || s === '—') return null;
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function parseTabularImportRows(grid: unknown[][]): ParsedImportRow[] {
  const cleanGrid = grid
    .map((row) => (Array.isArray(row) ? row : []))
    .filter((row) => row.some((c) => String(c ?? '').trim() !== ''));
  if (cleanGrid.length === 0) return [];

  const firstRowStrs = cleanGrid[0].map((c) => String(c ?? '').trim().toLowerCase());
  const looksLikeHeader = firstRowStrs.some((h) =>
    /^(date|tarikh|desc|description|title|item|perkara|activity|event|money in|money out|in|out|amount|rm)/.test(
      h
    )
  );

  let startIndex = 0;
  let colMap = {
    date: -1,
    title: -1,
    activity: -1,
    moneyIn: -1,
    moneyOut: -1,
    amount: -1,
    type: -1,
    account: -1,
    category: -1,
    notes: -1,
  };

  if (looksLikeHeader) {
    startIndex = 1;
    firstRowStrs.forEach((h, idx) => {
      if (colMap.date === -1 && /(date|tarikh)/.test(h)) colMap.date = idx;
      else if (colMap.title === -1 && /(desc|title|item|perkara|particular)/.test(h)) colMap.title = idx;
      else if (colMap.activity === -1 && /(activity|event|program|scope)/.test(h)) colMap.activity = idx;
      else if (colMap.moneyIn === -1 && /(money\s*in|^in\s*\(?|credit|masuk)/.test(h)) colMap.moneyIn = idx;
      else if (colMap.moneyOut === -1 && /(money\s*out|^out\s*\(?|debit|keluar)/.test(h)) colMap.moneyOut = idx;
      else if (colMap.amount === -1 && /(amount|rm|total|value)/.test(h)) colMap.amount = idx;
      else if (colMap.type === -1 && /(type|jenis)/.test(h)) colMap.type = idx;
      else if (colMap.account === -1 && /(account|bank|cash|method)/.test(h)) colMap.account = idx;
      else if (colMap.category === -1 && /(category|kategori)/.test(h)) colMap.category = idx;
      else if (colMap.notes === -1 && /(note|remark|catatan)/.test(h)) colMap.notes = idx;
    });
  }

  const out: ParsedImportRow[] = [];
  for (let r = startIndex; r < cleanGrid.length; r++) {
    const row = cleanGrid[r];
    if (looksLikeHeader) {
      const title = String(colMap.title >= 0 ? row[colMap.title] ?? '' : '').trim();
      if (!title || /starting club savings|opening balance|total/i.test(title)) continue;
      const dateStr = colMap.date >= 0 ? normalizeImportDate(row[colMap.date]) : todayIso();
      const evName = normalizeScopeName(colMap.activity >= 0 ? String(row[colMap.activity] ?? '') : '');
      const acctRaw = colMap.account >= 0 ? String(row[colMap.account] ?? '').toLowerCase() : '';
      const accountType: AccountType = acctRaw.includes('cash') ? 'Cash' : 'Bank';
      const notes = colMap.notes >= 0 ? String(row[colMap.notes] ?? '').trim() : '';

      const inVal = colMap.moneyIn >= 0 ? parseAmountCell(row[colMap.moneyIn]) : null;
      const outVal = colMap.moneyOut >= 0 ? parseAmountCell(row[colMap.moneyOut]) : null;

      let entryType: 'IN' | 'OUT' = 'OUT';
      let amt = 0;

      if (inVal !== null && Math.abs(inVal) > 0) {
        entryType = 'IN';
        amt = Math.abs(inVal);
      } else if (outVal !== null && Math.abs(outVal) > 0) {
        entryType = 'OUT';
        amt = Math.abs(outVal);
      } else if (colMap.amount >= 0) {
        const rawAmt = parseAmountCell(row[colMap.amount]);
        if (rawAmt === null || rawAmt === 0) continue;
        const typeStr = colMap.type >= 0 ? String(row[colMap.type] ?? '').toUpperCase() : '';
        entryType = typeStr.includes('IN') || (!typeStr.includes('OUT') && rawAmt > 0) ? 'IN' : 'OUT';
        amt = Math.abs(rawAmt);
      } else {
        continue;
      }

      const cat =
        (colMap.category >= 0 ? String(row[colMap.category] ?? '').trim() : '') ||
        (entryType === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0]);

      out.push({
        entry_date: dateStr,
        entry_type: entryType,
        event_name: evName,
        category: cat,
        title,
        amount: amt,
        account_type: accountType,
        notes,
      });
    } else {
      const cols = row.map((c) => String(c ?? '').trim());
      if (cols.length < 2) continue;
      if (cols.length >= 5) {
        const inAmt = parseAmountCell(cols[3]);
        const outAmt = parseAmountCell(cols[4]);
        if ((inAmt && inAmt > 0) || (outAmt && outAmt > 0)) {
          const entryType: 'IN' | 'OUT' = inAmt && inAmt > 0 ? 'IN' : 'OUT';
          const amt = entryType === 'IN' ? Math.abs(inAmt!) : Math.abs(outAmt!);
          const title = cols[1] || 'Imported Row';
          if (/starting club savings|total/i.test(title)) continue;
          out.push({
            entry_date: normalizeImportDate(cols[0]),
            entry_type: entryType,
            event_name: normalizeScopeName(cols[2]),
            category: entryType === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0],
            title,
            amount: amt,
            account_type: String(cols[5] || '').toLowerCase().includes('cash') ? 'Cash' : 'Bank',
            notes: '',
          });
          continue;
        }
      }

      if (cols.length >= 4) {
        const typeCol = cols[1].toUpperCase();
        const amt = parseAmountCell(cols[cols.length - 1]);
        if (amt !== null && amt !== 0) {
          const isTypeCol = typeCol === 'IN' || typeCol === 'OUT' || typeCol === 'EXPENSE' || typeCol === 'INCOME';
          const entryType: 'IN' | 'OUT' = isTypeCol
            ? typeCol.includes('OUT') || typeCol.includes('EXP')
              ? 'OUT'
              : 'IN'
            : amt < 0
            ? 'OUT'
            : 'IN';
          out.push({
            entry_date: normalizeImportDate(cols[0]),
            entry_type: entryType,
            event_name: normalizeScopeName(isTypeCol && cols.length >= 5 ? cols[2] : cols.length === 4 && !isTypeCol ? cols[2] : ''),
            category: entryType === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0],
            title: isTypeCol ? cols[cols.length >= 5 ? 3 : 2] || 'Imported Row' : cols[1] || 'Imported Row',
            amount: Math.abs(amt),
            account_type: 'Bank',
            notes: '',
          });
          continue;
        }
      }

      const lastAmt = parseAmountCell(cols[cols.length - 1]);
      if (lastAmt === null || lastAmt === 0) continue;
      const hasDate = cols.length >= 3 && /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cols[0]);
      const entryType: 'IN' | 'OUT' = lastAmt < 0 ? 'OUT' : 'IN';
      out.push({
        entry_date: hasDate ? normalizeImportDate(cols[0]) : todayIso(),
        entry_type: entryType,
        event_name: 'General Club Fund',
        category: entryType === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0],
        title: hasDate ? cols[1] || 'Imported Row' : cols[0] || 'Imported Row',
        amount: Math.abs(lastAmt),
        account_type: 'Bank',
        notes: '',
      });
    }
  }
  return out;
}

function parseDelimitedText(text: string): unknown[][] {
  return text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean)
    .map((line) => {
      if (line.includes('\t')) return line.split('\t').map((c) => c.trim());
      if (line.includes('|')) return line.split('|').map((c) => c.trim());
      return line.split(',').map((c) => c.trim().replace(/^"(.*)"$/, '$1'));
    });
}

export default function LedgerSection({
  entries,
  events = [],
  budgets = [],
  budgetPlanItems = [],
  rsvps = [],
  claims,
  preClaims = [],
  feePayments = [],
  guestRegistrations = [],
  logs = [],
  profile,
  canEdit = true,
  openingBank = 0,
  openingCash = 0,
  openingDate = todayIso(),
  onSaveOpeningBalance,
  externalOpenModal = false,
  onCloseExternalModal,
  onSelectClaim,
  onRefresh,
  onOpenMemberProfile,
  loading = false,
}: LedgerSectionProps) {
  const [activeView, setActiveView] = useState<FinanceTabView>('sheet');
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  const openProfileForLedgerRow = (row: UnifiedFinanceRow) => {
    if (!onOpenMemberProfile || row.source === 'GUEST_FEE') return;
    if (row.rawClaim) {
      onOpenMemberProfile({
        userId: row.rawClaim.user_id,
        matricNo: row.rawClaim.matric_no,
        name: row.rawClaim.claimant_name,
      });
      return;
    }
    if (row.rawFee) {
      onOpenMemberProfile({
        userId: row.rawFee.user_id,
        matricNo: row.rawFee.matric_no,
        name: row.rawFee.student_name,
      });
      return;
    }
    if (row.personShort && row.personShort !== 'Club') {
      onOpenMemberProfile({ name: row.personShort });
    }
  };

  // Sheet filters
  const [searchQuery, setSearchQuery] = useState('');
  const [filterPill, setFilterPill] = useState<SheetFilterPill>('ALL');
  const [filterEvent, setFilterEvent] = useState<string>('ALL');

  // Direct inline cell editing (manual ledger_entries rows)
  const [editingCell, setEditingCell] = useState<{
    id: string;
    field: EditableCellField;
  } | null>(null);
  const [cellDraft, setCellDraft] = useState<string>('');
  const [busyRowId, setBusyRowId] = useState<string | null>(null);

  // Bottom + Add Row (always-ready Excel-style row)
  const quickDescRef = useRef<HTMLInputElement | null>(null);
  const [qaDate, setQaDate] = useState(todayIso());
  const [qaTitle, setQaTitle] = useState('');
  const [qaEvent, setQaEvent] = useState('General Club Fund');
  const [qaIn, setQaIn] = useState('');
  const [qaOut, setQaOut] = useState('');
  const [qaAccount, setQaAccount] = useState<AccountType>('Bank');
  const [qaSaving, setQaSaving] = useState(false);

  // Opening Savings Modal
  const [showOpeningModal, setShowOpeningModal] = useState(false);
  const [openBankInput, setOpenBankInput] = useState(openingBank.toFixed(2));
  const [openCashInput, setOpenCashInput] = useState(openingCash.toFixed(2));
  const [openDateInput, setOpenDateInput] = useState(openingDate || todayIso());
  const [savingOpening, setSavingOpening] = useState(false);

  // Add / Edit Income & Expense Modal
  const [showModal, setShowModal] = useState(false);
  const [editingEntry, setEditingEntry] = useState<LedgerEntryItem | null>(null);
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('IN');
  const [entryAccount, setEntryAccount] = useState<AccountType>('Bank');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(IN_CATEGORIES[0]);
  const [activityInput, setActivityInput] = useState('General Club Fund');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(todayIso());
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [savingEntry, setSavingEntry] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Import Excel / Paste Modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTab, setImportTab] = useState<'file' | 'paste'>('file');
  const [importFileName, setImportFileName] = useState('');
  const [importPreviewRows, setImportPreviewRows] = useState<ParsedImportRow[]>([]);
  const [pasteText, setPasteText] = useState('');
  const [importing, setImporting] = useState(false);

  // Fee quick edit modal
  const [editingFeeItem, setEditingFeeItem] = useState<ActivityFeePayment | null>(null);
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editFeeStatus, setEditFeeStatus] = useState<'Verified' | 'Pending' | 'Rejected'>('Verified');
  const [editFeeAccount, setEditFeeAccount] = useState<AccountType>('Bank');
  const [savingFeeEdit, setSavingFeeEdit] = useState(false);

  // By Activity expansion
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);

  // Unpaid fees state
  const [unpaidEventFilter, setUnpaidEventFilter] = useState('ALL');
  const [markingPaidKey, setMarkingPaidKey] = useState<string | null>(null);

  // Budget Plan state
  const [plannerBudgetId, setPlannerBudgetId] = useState<string>(budgets[0]?.id || 'ALL');
  const [newPlanType, setNewPlanType] = useState<'IN' | 'OUT'>('OUT');
  const [newPlanItem, setNewPlanItem] = useState('');
  const [newPlanCategory, setNewPlanCategory] = useState(OUT_CATEGORIES[0]);
  const [newPlanAmount, setNewPlanAmount] = useState('');
  const [savingPlanItem, setSavingPlanItem] = useState(false);

  // --- Exact Math (Opening Bank + Opening Cash + Transactions) ---
  const verifiedFeesList = useMemo(
    () => feePayments.filter((f) => f.status === 'Verified'),
    [feePayments]
  );
  const verifiedGuestFeesList = useMemo(
    () =>
      guestRegistrations.filter(
        (g) => !g.deleted_at && g.payment_status === 'Verified' && Number(g.amount_paid) > 0
      ),
    [guestRegistrations]
  );
  const pendingFeesTotal = useMemo(
    () =>
      feePayments
        .filter((f) => f.status === 'Pending')
        .reduce((s, f) => s + Number(f.amount_paid), 0) +
      guestRegistrations
        .filter((g) => !g.deleted_at && g.payment_status === 'Pending')
        .reduce((s, g) => s + Number(g.amount_paid), 0),
    [feePayments, guestRegistrations]
  );
  const approvedClaimsList = useMemo(
    () => claims.filter((c) => c.status === 'Approved'),
    [claims]
  );

  // Reserved balance from Pre-Approved pre-claims whose cash advance hasn't been disbursed yet
  const reservedPreClaimsTotal = useMemo(
    () =>
      preClaims
        .filter(
          (pc) =>
            !pc.deleted_at &&
            pc.status === 'Pre-Approved' &&
            Number(pc.advance_disbursed_amount || 0) <= 0
        )
        .reduce((s, pc) => s + Number(pc.approved_cap ?? pc.estimated_amount ?? 0), 0),
    [preClaims]
  );

  const resolveClaimNetDeduction = (c: Claim): { netAmt: number; advGiven: number } => {
    const linkedPc =
      (c.pre_claim_id ? preClaims.find((pc) => pc.id === c.pre_claim_id) : undefined) ||
      preClaims.find((pc) => pc.linked_claim_id === c.id);
    const advGiven = linkedPc ? Number(linkedPc.advance_disbursed_amount || 0) : 0;
    const rawAmt = Number(c.amount) || 0;
    const netAmt = advGiven > 0 ? Math.max(0, rawAmt - advGiven) : rawAmt;
    return { netAmt, advGiven };
  };

  const openingTotal = Number(openingBank) + Number(openingCash);

  const mathSummary = useMemo(() => {
    let manualIn = 0;
    let manualOut = 0;
    let verifiedFeesIn = 0;
    let approvedClaimsOut = 0;
    let bankIn = 0;
    let bankOut = 0;
    let cashIn = 0;
    let cashOut = 0;

    for (const e of entries) {
      const amt = Number(e.amount) || 0;
      const acct = accountOf(e.account_type);
      if (e.entry_type === 'IN') {
        manualIn += amt;
        if (acct === 'Cash') cashIn += amt;
        else bankIn += amt;
      } else {
        manualOut += amt;
        if (acct === 'Cash') cashOut += amt;
        else bankOut += amt;
      }
    }

    for (const f of verifiedFeesList) {
      const amt = Number(f.amount_paid) || 0;
      const acct = accountOf(f.account_type);
      verifiedFeesIn += amt;
      if (acct === 'Cash') cashIn += amt;
      else bankIn += amt;
    }

    for (const g of verifiedGuestFeesList) {
      const amt = Number(g.amount_paid) || 0;
      const acct = accountOf(g.account_type);
      verifiedFeesIn += amt;
      if (acct === 'Cash') cashIn += amt;
      else bankIn += amt;
    }

    for (const c of approvedClaimsList) {
      const { netAmt } = resolveClaimNetDeduction(c);
      if (netAmt <= 0) continue;
      const acct = accountOf(c.account_type);
      approvedClaimsOut += netAmt;
      if (acct === 'Cash') cashOut += netAmt;
      else bankOut += netAmt;
    }

    const totalIn = manualIn + verifiedFeesIn;
    const totalOut = manualOut + approvedClaimsOut;
    const currentBank = Number(openingBank) + bankIn - bankOut;
    const currentCash = Number(openingCash) + cashIn - cashOut;
    const totalSavings = currentBank + currentCash;

    return { totalIn, totalOut, currentBank, currentCash, totalSavings };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, verifiedFeesList, verifiedGuestFeesList, approvedClaimsList, preClaims, openingBank, openingCash]);

  // Unified chronological rows (oldest -> newest) starting from openingTotal
  const unifiedRows = useMemo<UnifiedFinanceRow[]>(() => {
    const raw: Omit<UnifiedFinanceRow, 'runningBalance'>[] = [];

    for (const e of entries) {
      const matchedBudget = budgets.find(
        (b) => b.event_name.trim().toLowerCase() === (e.event_name || '').trim().toLowerCase()
      );
      raw.push({
        uid: `ledger-${e.id}`,
        recordId: e.id,
        source: 'LEDGER',
        date: e.entry_date || e.created_at?.split('T')[0] || '',
        createdAt: e.created_at || e.entry_date || '',
        entryType: e.entry_type,
        eventName: normalizeScopeName(e.event_name),
        budgetId: matchedBudget?.id || null,
        category: e.category || (e.entry_type === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0]),
        title: e.title,
        personShort: shortPersonName(e.person_in_charge),
        accountType: accountOf(e.account_type),
        amount: Number(e.amount) || 0,
        attachmentUrl: e.attachment_url,
        rawLedger: e,
      });
    }

    for (const c of approvedClaimsList) {
      const { netAmt, advGiven } = resolveClaimNetDeduction(c);
      if (advGiven > 0 && netAmt <= 0) continue;
      const matchedBudget = budgets.find((b) => b.id === c.budget_id);
      raw.push({
        uid: `claim-${c.id}`,
        recordId: c.id,
        source: 'CLAIM',
        date: c.expense_date || c.created_at?.split('T')[0] || '',
        createdAt: c.created_at || c.expense_date || '',
        entryType: 'OUT',
        eventName: normalizeScopeName(matchedBudget?.event_name || c.custom_event_name),
        budgetId: c.budget_id,
        category: c.category || 'Claim',
        title: advGiven > 0 ? `${c.title} (Net Top-Up after Advance)` : c.title,
        personShort: shortPersonName(c.claimant_name),
        accountType: accountOf(c.account_type),
        amount: netAmt,
        attachmentUrl: c.payout_proof_url || c.receipt_url,
        rawClaim: c,
      });
    }

    for (const f of verifiedFeesList) {
      const matchedBudget = budgets.find((b) => b.id === f.budget_id);
      raw.push({
        uid: `fee-${f.id}`,
        recordId: f.id,
        source: 'FEE',
        date: f.created_at?.split('T')[0] || '',
        createdAt: f.created_at || '',
        entryType: 'IN',
        eventName: normalizeScopeName(matchedBudget?.event_name || 'Activity Fee'),
        budgetId: f.budget_id,
        category: 'Activity Fee',
        title: `Activity Fee — ${f.student_name}`,
        personShort: shortPersonName(f.student_name),
        accountType: accountOf(f.account_type),
        amount: Number(f.amount_paid) || 0,
        attachmentUrl: f.receipt_url,
        rawFee: f,
      });
    }

    for (const g of verifiedGuestFeesList) {
      const matchedBudget = budgets.find((b) => b.id === g.budget_id);
      raw.push({
        uid: `guest-${g.id}`,
        recordId: g.id,
        source: 'GUEST_FEE',
        date: g.created_at?.split('T')[0] || '',
        createdAt: g.created_at || '',
        entryType: 'IN',
        eventName: normalizeScopeName(matchedBudget?.event_name || 'Activity Fee'),
        budgetId: g.budget_id,
        category: 'Guest Fee',
        title: `Guest Fee — ${g.guest_name}`,
        personShort: shortPersonName(g.guest_name),
        accountType: accountOf(g.account_type),
        amount: Number(g.amount_paid) || 0,
        attachmentUrl: g.receipt_url,
        rawGuest: g,
      });
    }

    raw.sort((a, b) => {
      const dc = (a.date || '').localeCompare(b.date || '');
      if (dc !== 0) return dc;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let running = openingTotal;
    return raw.map((row) => {
      running += row.entryType === 'IN' ? row.amount : -row.amount;
      return { ...row, runningBalance: running };
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entries, approvedClaimsList, verifiedFeesList, verifiedGuestFeesList, preClaims, budgets, openingTotal]);

  const activityOptions = useMemo(() => {
    const names = new Set<string>(['General Club Fund']);
    events.forEach((ev) => {
      if (ev.event_name?.trim()) names.add(ev.event_name.trim());
    });
    budgets.forEach((b) => {
      if (b.event_name?.trim()) names.add(b.event_name.trim());
    });
    unifiedRows.forEach((r) => {
      if (r.eventName?.trim()) names.add(r.eventName.trim());
    });
    return Array.from(names);
  }, [events, budgets, unifiedRows]);

  const hasSheetFilters =
    Boolean(searchQuery.trim()) || filterPill !== 'ALL' || filterEvent !== 'ALL';

  const displayedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return unifiedRows.filter((row) => {
      if (filterEvent === 'GENERAL' && !isGeneralEventName(row.eventName)) return false;
      if (filterEvent !== 'ALL' && filterEvent !== 'GENERAL' && row.eventName !== filterEvent) {
        return false;
      }
      if (filterPill === 'IN' && row.entryType !== 'IN') return false;
      if (filterPill === 'OUT' && row.entryType !== 'OUT') return false;
      if (filterPill === 'CLAIMS_FEES' && row.source === 'LEDGER') return false;
      if (q) {
        const hay = `${row.title} ${row.personShort} ${row.eventName} ${row.accountType}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [unifiedRows, filterEvent, filterPill, searchQuery]);

  const sheetFooterTotals = useMemo(() => {
    let fIn = 0;
    let fOut = 0;
    for (const r of displayedRows) {
      if (r.entryType === 'IN') fIn += r.amount;
      else fOut += r.amount;
    }
    const closing = hasSheetFilters
      ? openingTotal + fIn - fOut
      : mathSummary.totalSavings;
    return { inTotal: fIn, outTotal: fOut, closing };
  }, [displayedRows, hasSheetFilters, openingTotal, mathSummary.totalSavings]);

  // --- Unpaid Fees ---
  const unpaidReceivables = useMemo(() => {
    const out: { key: string; budget: Budget; rsvp: EventRsvp; feeDue: number }[] = [];
    for (const b of budgets) {
      const regFee = Number(b.registration_fee || 0);
      if (regFee <= 0) continue;
      if (unpaidEventFilter !== 'ALL' && b.id !== unpaidEventFilter) continue;
      const attending = rsvps.filter((r) => r.budget_id === b.id && r.attendance === 'Attending');
      for (const r of attending) {
        const hasPaid = feePayments.some(
          (fp) =>
            fp.budget_id === b.id &&
            fp.status !== 'Rejected' &&
            ((fp.user_id && fp.user_id === r.user_id) ||
              (fp.matric_no &&
                r.matric_no &&
                fp.matric_no.trim().toLowerCase() === r.matric_no.trim().toLowerCase()))
        );
        if (!hasPaid) {
          out.push({ key: `${b.id}:${r.user_id || r.matric_no}`, budget: b, rsvp: r, feeDue: regFee });
        }
      }
    }
    return out;
  }, [budgets, rsvps, feePayments, unpaidEventFilter]);

  // --- By Activity P&L ---
  const activityPnlCards = useMemo(() => {
    const computeCard = (
      key: string,
      titleLabel: string,
      subLabel: string,
      budget?: Budget,
      customMatcher?: (r: UnifiedFinanceRow) => boolean
    ) => {
      const matchName = budget ? budget.event_name : titleLabel;
      const rows = unifiedRows.filter((r) =>
        customMatcher
          ? customMatcher(r)
          : budget
          ? r.budgetId === budget.id || r.eventName === matchName
          : isGeneralEventName(r.eventName)
      );
      const feesIn = rows
        .filter((r) => r.source === 'FEE' || r.source === 'GUEST_FEE')
        .reduce((s, r) => s + r.amount, 0);
      const manIn = rows
        .filter((r) => r.source === 'LEDGER' && r.entryType === 'IN')
        .reduce((s, r) => s + r.amount, 0);
      const claimsOut = rows.filter((r) => r.source === 'CLAIM').reduce((s, r) => s + r.amount, 0);
      const manOut = rows
        .filter((r) => r.source === 'LEDGER' && r.entryType === 'OUT')
        .reduce((s, r) => s + r.amount, 0);
      return {
        key,
        title: titleLabel,
        subtitle: subLabel,
        budget,
        feesIn,
        manualIn: manIn,
        claimsOut,
        manualOut: manOut,
        net: feesIn + manIn - claimsOut - manOut,
        rows,
      };
    };
    const cards = budgets.map((b) =>
      computeCard(b.id, b.event_name, `${b.event_date} · ${b.category}`, b)
    );
    const matchedBudgetNames = new Set(budgets.map((b) => b.event_name));
    const customNames = Array.from(
      new Set(
        unifiedRows
          .map((r) => r.eventName)
          .filter((name) => !isGeneralEventName(name) && !matchedBudgetNames.has(name))
      )
    );
    for (const customName of customNames) {
      cards.push(
        computeCard(
          `CUSTOM_${customName}`,
          customName,
          'Custom Activity',
          undefined,
          (r) => r.eventName === customName
        )
      );
    }
    cards.push(computeCard('GENERAL_FUND', 'General Club Fund', 'Non-event club income & expenses'));
    return cards;
  }, [budgets, unifiedRows]);

  // --- Budget Plan ---
  const scopedPlannerRows = useMemo(
    () =>
      budgetPlanItems.filter(
        (p) => !p.deleted_at && (plannerBudgetId === 'ALL' || p.budget_id === plannerBudgetId)
      ),
    [budgetPlanItems, plannerBudgetId]
  );

  const plannerTotals = useMemo(() => {
    const plannedIn = scopedPlannerRows
      .filter((r) => r.entry_type === 'IN')
      .reduce((s, r) => s + (Number(r.planned_amount) || 0), 0);
    const plannedOut = scopedPlannerRows
      .filter((r) => r.entry_type === 'OUT')
      .reduce((s, r) => s + (Number(r.planned_amount) || 0), 0);
    const actualRows = unifiedRows.filter((r) =>
      plannerBudgetId === 'ALL'
        ? true
        : r.budgetId === plannerBudgetId ||
          (plannerBudgetId === 'GENERAL' && isGeneralEventName(r.eventName))
    );
    const actualIn = actualRows.filter((r) => r.entryType === 'IN').reduce((s, r) => s + r.amount, 0);
    const actualOut = actualRows.filter((r) => r.entryType === 'OUT').reduce((s, r) => s + r.amount, 0);
    return { plannedIn, plannedOut, actualIn, actualOut };
  }, [scopedPlannerRows, unifiedRows, plannerBudgetId]);

  useEffect(() => {
    if (externalOpenModal && canEdit) {
      openAddModal('IN');
      onCloseExternalModal?.();
    }
  }, [externalOpenModal, canEdit, onCloseExternalModal]);

  const openOpeningSavingsModal = () => {
    setOpenBankInput(Number(openingBank).toFixed(2));
    setOpenCashInput(Number(openingCash).toFixed(2));
    setOpenDateInput(openingDate || todayIso());
    setShowOpeningModal(true);
  };

  const handleOpeningBalanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || !onSaveOpeningBalance) return;
    const bVal = Math.max(0, parseFloat(openBankInput) || 0);
    const cVal = Math.max(0, parseFloat(openCashInput) || 0);
    setSavingOpening(true);
    try {
      await onSaveOpeningBalance({
        bank: bVal,
        cash: cVal,
        date: openDateInput || todayIso(),
      });
      setShowOpeningModal(false);
    } finally {
      setSavingOpening(false);
    }
  };

  const openAddModal = (mode: 'IN' | 'OUT') => {
    setEditingEntry(null);
    setEntryType(mode);
    setEntryAccount('Bank');
    setTitle('');
    setCategory(mode === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0]);
    setActivityInput('General Club Fund');
    setAmount('');
    setEntryDate(todayIso());
    setNotes('');
    setAttachmentFile(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (entry: LedgerEntryItem) => {
    setEditingEntry(entry);
    setEntryType(entry.entry_type);
    setEntryAccount(accountOf(entry.account_type));
    setTitle(entry.title);
    setCategory(entry.category);
    setActivityInput(normalizeScopeName(entry.event_name));
    setAmount(String(entry.amount));
    setEntryDate(entry.entry_date);
    setNotes(entry.notes || '');
    setAttachmentFile(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const saveLedgerPayloadWithFallback = async (
    fullPayload: Record<string, unknown>,
    editId?: string
  ) => {
    const noAccountPayload = { ...fullPayload };
    delete noAccountPayload.account_type;
    const corePayload = {
      entry_type: fullPayload.entry_type,
      title: fullPayload.title,
      category: fullPayload.category,
      amount: fullPayload.amount,
      entry_date: fullPayload.entry_date,
      person_in_charge: fullPayload.person_in_charge,
      notes: fullPayload.notes,
    };
    const candidates = [fullPayload, noAccountPayload, corePayload];
    let lastErr: unknown = null;
    for (const payload of candidates) {
      const { error } = editId
        ? await supabase.from('ledger_entries').update(payload).eq('id', editId)
        : await supabase.from('ledger_entries').insert(payload);
      if (!error) return;
      lastErr = error;
    }
    throw lastErr;
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg(null);
    const num = parseFloat(amount);
    if (isNaN(num) || num <= 0) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    if (!title.trim()) {
      setErrorMsg('Please enter a description.');
      return;
    }
    setSavingEntry(true);
    try {
      let attachmentUrl = editingEntry?.attachment_url || '';
      let attachmentName = editingEntry?.attachment_name || '';
      if (attachmentFile) {
        if (attachmentFile.size > MAX_FILE_SIZE_BYTES) {
          throw new Error('File exceeds 50 MB limit.');
        }
        const ext = attachmentFile.name.split('.').pop() || 'pdf';
        const safePath = `ledger/${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(safePath, attachmentFile);
        if (!upErr) {
          attachmentUrl = supabase.storage.from('receipts').getPublicUrl(safePath).data.publicUrl;
          attachmentName = attachmentFile.name;
        }
      }
      const finalEventName = normalizeScopeName(activityInput);

      const payload = {
        entry_type: entryType,
        title: title.trim(),
        category,
        event_name: finalEventName,
        amount: num,
        account_type: entryAccount,
        entry_date: entryDate,
        person_in_charge: `${profile.full_name} (${profile.matric_no})`,
        notes: notes.trim(),
        attachment_url: attachmentUrl,
        attachment_name: attachmentName,
      };

      if (editingEntry) {
        await saveLedgerPayloadWithFallback(payload, editingEntry.id);
        const changes = computeFieldChanges([
          { field: 'Title', before: editingEntry.title, after: payload.title },
          { field: 'Type', before: editingEntry.entry_type, after: payload.entry_type },
          { field: 'Account', before: accountOf(editingEntry.account_type), after: payload.account_type },
          { field: 'Activity', before: editingEntry.event_name || '', after: payload.event_name },
          { field: 'Amount (RM)', before: Number(editingEntry.amount).toFixed(2), after: num.toFixed(2) },
          { field: 'Date', before: editingEntry.entry_date, after: payload.entry_date },
        ]);
        void recordEditHistory({
          actor: profile,
          category: 'Finance',
          table: 'ledger_entries',
          recordId: editingEntry.id,
          recordTitle: payload.title,
          changes,
        });
        onRefresh(`Updated "${payload.title}"`);
      } else {
        await saveLedgerPayloadWithFallback(payload);
        void logActivity(
          profile,
          'Finance',
          entryType === 'IN' ? 'Added Income' : 'Added Expense',
          `${profile.full_name} (${profile.matric_no}) recorded ${entryType} "${payload.title}" of RM ${num.toFixed(2)} (${entryAccount})`
        );
        onRefresh(`${entryType === 'IN' ? 'Added Income' : 'Added Expense'}: RM ${formatRM(num)}`);
      }
      setShowModal(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save record.');
    } finally {
      setSavingEntry(false);
    }
  };

  // --- Direct Click-to-Edit Cell Commit ---
  const commitCellEdit = async (row: UnifiedFinanceRow, field: EditableCellField, rawValue: string) => {
    setEditingCell(null);
    if (!canEdit || row.source !== 'LEDGER' || !row.rawLedger) return;
    const entry = row.rawLedger;
    const patch: Partial<LedgerEntryItem> = {};
    const pairs: { field: string; before: unknown; after: unknown }[] = [];

    if (field === 'date') {
      const nextDate = rawValue.trim();
      if (!nextDate || nextDate === entry.entry_date) return;
      patch.entry_date = nextDate;
      pairs.push({ field: 'Date', before: entry.entry_date, after: nextDate });
    } else if (field === 'title') {
      const nextTitle = rawValue.trim();
      if (!nextTitle || nextTitle === entry.title) return;
      patch.title = nextTitle;
      pairs.push({ field: 'Description', before: entry.title, after: nextTitle });
    } else if (field === 'event') {
      const nextEv = normalizeScopeName(rawValue);
      if (nextEv === normalizeScopeName(entry.event_name)) return;
      patch.event_name = nextEv;
      pairs.push({ field: 'Activity', before: normalizeScopeName(entry.event_name), after: nextEv });
    } else if (field === 'in' || field === 'out') {
      const num = parseFloat(rawValue);
      if (isNaN(num) || num <= 0) return;
      const nextType: 'IN' | 'OUT' = field === 'in' ? 'IN' : 'OUT';
      if (entry.entry_type === nextType && Math.abs(num - Number(entry.amount)) < 0.005) return;
      patch.entry_type = nextType;
      patch.amount = num;
      pairs.push(
        { field: 'Type', before: entry.entry_type, after: nextType },
        { field: 'Amount (RM)', before: Number(entry.amount).toFixed(2), after: num.toFixed(2) }
      );
    }

    const nextFull = {
      entry_type: patch.entry_type ?? entry.entry_type,
      title: patch.title ?? entry.title,
      category: patch.category ?? entry.category,
      event_name: patch.event_name ?? normalizeScopeName(entry.event_name),
      amount: patch.amount ?? entry.amount,
      account_type: accountOf(entry.account_type),
      entry_date: patch.entry_date ?? entry.entry_date,
      person_in_charge: entry.person_in_charge || `${profile.full_name} (${profile.matric_no})`,
      notes: entry.notes || '',
    };

    setBusyRowId(row.uid);
    try {
      await saveLedgerPayloadWithFallback(nextFull, entry.id);
      void recordEditHistory({
        actor: profile,
        category: 'Finance',
        table: 'ledger_entries',
        recordId: entry.id,
        recordTitle: nextFull.title,
        changes: computeFieldChanges(pairs),
      });
      onRefresh(`Saved "${nextFull.title}"`);
    } finally {
      setBusyRowId(null);
    }
  };

  // --- Toggle Bank <-> Cash directly on any row ---
  const handleToggleAccountType = async (row: UnifiedFinanceRow) => {
    if (!canEdit) return;
    const nextAcct: AccountType = row.accountType === 'Bank' ? 'Cash' : 'Bank';
    setBusyRowId(row.uid);
    try {
      const table =
        row.source === 'CLAIM'
          ? 'claims'
          : row.source === 'FEE'
          ? 'activity_fee_payments'
          : row.source === 'GUEST_FEE'
          ? 'public_guest_registrations'
          : 'ledger_entries';
      const { error } = await supabase
        .from(table)
        .update({ account_type: nextAcct })
        .eq('id', row.recordId);
      if (error) {
        onRefresh('Run the Simple Finance SQL migration in Supabase to save Bank/Cash tag.');
        return;
      }
      void recordEditHistory({
        actor: profile,
        category:
          row.source === 'CLAIM'
            ? 'Claims'
            : row.source === 'FEE' || row.source === 'GUEST_FEE'
            ? 'Fees'
            : 'Finance',
        table,
        recordId: row.recordId,
        recordTitle: row.title,
        changes: computeFieldChanges([{ field: 'Account', before: row.accountType, after: nextAcct }]),
      });
      onRefresh(`Switched "${row.title}" to ${nextAcct}`);
    } finally {
      setBusyRowId(null);
    }
  };

  // --- Bottom + Add Row Save ---
  const handleQuickAddSubmit = async () => {
    if (!canEdit || qaSaving) return;
    const inVal = parseFloat(qaIn);
    const outVal = parseFloat(qaOut);
    const hasIn = !isNaN(inVal) && inVal > 0;
    const hasOut = !isNaN(outVal) && outVal > 0;
    if (!qaTitle.trim() || (!hasIn && !hasOut)) return;

    const entryTypeNext: 'IN' | 'OUT' = hasIn ? 'IN' : 'OUT';
    const amtNext = hasIn ? inVal : outVal;

    setQaSaving(true);
    try {
      const payload = {
        entry_type: entryTypeNext,
        title: qaTitle.trim(),
        category: entryTypeNext === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0],
        event_name: normalizeScopeName(qaEvent),
        amount: amtNext,
        account_type: qaAccount,
        entry_date: qaDate || todayIso(),
        person_in_charge: `${profile.full_name} (${profile.matric_no})`,
        notes: '',
      };
      await saveLedgerPayloadWithFallback(payload);
      void logActivity(
        profile,
        'Finance',
        entryTypeNext === 'IN' ? 'Added Income' : 'Added Expense',
        `${profile.full_name} (${profile.matric_no}) added "${payload.title}" (${entryTypeNext} RM ${amtNext.toFixed(2)} · ${qaAccount})`
      );
      setQaTitle('');
      setQaIn('');
      setQaOut('');
      onRefresh(`Added "${payload.title}" (RM ${formatRM(amtNext)})`);
      setTimeout(() => quickDescRef.current?.focus(), 60);
    } finally {
      setQaSaving(false);
    }
  };

  // --- Soft Delete Row ---
  const handleDeleteRow = async (row: UnifiedFinanceRow) => {
    if (!canEdit) return;
    if (!window.confirm(`Remove "${row.title}" from the sheet? (Preserved in Supabase)`)) return;
    const table =
      row.source === 'CLAIM'
        ? 'claims'
        : row.source === 'FEE'
        ? 'activity_fee_payments'
        : row.source === 'GUEST_FEE'
        ? 'public_guest_registrations'
        : 'ledger_entries';
    await softDeleteRecord({
      actor: profile,
      category:
        row.source === 'CLAIM'
          ? 'Claims'
          : row.source === 'FEE' || row.source === 'GUEST_FEE'
          ? 'Fees'
          : 'Finance',
      table,
      recordId: row.recordId,
      recordTitle: row.title,
      extraSummary: `${row.entryType} RM ${row.amount.toFixed(2)}`,
    });
    onRefresh(`Removed "${row.title}" from web view`);
  };

  // --- Import .xlsx / .csv File ---
  const handleImportFileChange = async (file: File | null) => {
    if (!file) return;
    setImportFileName(file.name);
    const lower = file.name.toLowerCase();
    if (lower.endsWith('.csv') || file.type.includes('csv')) {
      const text = await file.text();
      setImportPreviewRows(parseTabularImportRows(parseDelimitedText(text)));
      return;
    }
    const loaded = await ensureSheetJsLoaded();
    if (!loaded || !window.XLSX) {
      onRefresh('Could not load Excel parser. Try saving as .csv or use Paste from Excel.');
      return;
    }
    const buf = await file.arrayBuffer();
    const wb = window.XLSX.read(buf, { type: 'array' });
    const firstName = wb.SheetNames[0];
    if (!firstName) {
      setImportPreviewRows([]);
      return;
    }
    const ws = wb.Sheets[firstName];
    const grid = window.XLSX.utils.sheet_to_json<unknown[]>(ws, {
      header: 1,
      defval: '',
      raw: true,
    });
    setImportPreviewRows(parseTabularImportRows(grid));
  };

  const handleConfirmImport = async () => {
    if (!canEdit || importing || importPreviewRows.length === 0) return;
    setImporting(true);
    try {
      const pic = `${profile.full_name} (${profile.matric_no})`;
      for (const r of importPreviewRows) {
        await saveLedgerPayloadWithFallback({
          entry_type: r.entry_type,
          title: r.title,
          category: r.category,
          event_name: r.event_name,
          amount: r.amount,
          account_type: r.account_type,
          entry_date: r.entry_date,
          person_in_charge: pic,
          notes: r.notes,
        });
      }
      void logActivity(
        profile,
        'Finance',
        'Imported spreadsheet rows',
        `${profile.full_name} (${profile.matric_no}) imported ${importPreviewRows.length} rows into Finance Sheet`
      );
      const count = importPreviewRows.length;
      setImportPreviewRows([]);
      setImportFileName('');
      setPasteText('');
      setShowImportModal(false);
      onRefresh(`Imported ${count} row(s) cleanly!`);
    } finally {
      setImporting(false);
    }
  };

  // --- Export Cashbook + Reports (.xlsx with live =SUM & running balance formulas) ---
  const handleExportWorkbook = async (scopeBudget?: Budget | null) => {
    const scopeTitle = scopeBudget ? scopeBudget.event_name : 'ClubSync_Finance_Sheet';
    const scRows = scopeBudget
      ? unifiedRows.filter((r) => r.budgetId === scopeBudget.id || r.eventName === scopeBudget.event_name)
      : unifiedRows;
    const scFees = scopeBudget ? feePayments.filter((f) => f.budget_id === scopeBudget.id) : feePayments;
    const scGuests = scopeBudget
      ? guestRegistrations.filter((g) => !g.deleted_at && g.budget_id === scopeBudget.id && Number(g.amount_paid) > 0)
      : guestRegistrations.filter((g) => !g.deleted_at && Number(g.amount_paid) > 0);
    const scClaims = scopeBudget ? claims.filter((c) => c.budget_id === scopeBudget.id) : claims;
    const scRsvps = scopeBudget ? rsvps.filter((r) => r.budget_id === scopeBudget.id) : rsvps;

    const approvedClaims = scClaims.filter((c) => c.status === 'Approved');
    const row2Opening = scopeBudget ? 0 : openingTotal;

    const cashbookRows: ExcelCellValue[][] = [
      [
        scopeBudget ? scopeBudget.event_date : openingDate,
        scopeBudget ? `${scopeBudget.event_name} — Start` : 'Starting Club Savings',
        scopeBudget ? scopeBudget.event_name : 'Opening Balance',
        null,
        null,
        row2Opening,
        'Bank + Cash',
      ],
    ];

    let running = row2Opening;
    scRows.forEach((r, idx) => {
      const excelRow = 3 + idx;
      running += r.entryType === 'IN' ? r.amount : -r.amount;
      cashbookRows.push([
        r.date,
        r.title,
        r.eventName,
        r.entryType === 'IN' ? r.amount : null,
        r.entryType === 'OUT' ? r.amount : null,
        { f: `F${excelRow - 1}+D${excelRow}-E${excelRow}`, v: running, z: '#,##0.00' },
        r.accountType,
      ]);
    });

    const lastTxRow = 2 + scRows.length;
    const totalExcelRow = lastTxRow + 1;
    const totalInVal = scRows.filter((r) => r.entryType === 'IN').reduce((s, r) => s + r.amount, 0);
    const totalOutVal = scRows.filter((r) => r.entryType === 'OUT').reduce((s, r) => s + r.amount, 0);

    cashbookRows.push([
      '',
      'TOTAL',
      `${scRows.length} transactions`,
      scRows.length > 0 ? { f: `SUM(D3:D${lastTxRow})`, v: totalInVal, z: '#,##0.00' } : 0,
      scRows.length > 0 ? { f: `SUM(E3:E${lastTxRow})`, v: totalOutVal, z: '#,##0.00' } : 0,
      scRows.length > 0
        ? { f: `F2+D${totalExcelRow}-E${totalExcelRow}`, v: running, z: '#,##0.00' }
        : { f: 'F2', v: row2Opening, z: '#,##0.00' },
      '',
    ]);

    await exportMultiSheetExcel(scopeTitle, [
      {
        name: '1_Finance_Cashbook',
        headers: ['Date', 'Description', 'Activity', 'Money In (RM)', 'Money Out (RM)', 'Balance (RM)', 'Account'],
        rows: cashbookRows,
      },
      {
        name: '2_Summary',
        headers: ['Metric', 'Value (RM)'],
        rows: [
          ['Current Club Savings', mathSummary.totalSavings],
          ['Bank / DuitNow Balance', mathSummary.currentBank],
          ['Physical Cash Balance', mathSummary.currentCash],
          ['Starting Club Savings', openingTotal],
          ['Total Money In', mathSummary.totalIn],
          ['Total Money Out', mathSummary.totalOut],
          ['Pending Fee Verification', pendingFeesTotal],
        ],
      },
      {
        name: '3_Fee_Payments',
        headers: ['Date', 'Activity', 'Participant Name', 'Matric / Lookup', 'Amount (RM)', 'Account', 'Status', 'Receipt URL'],
        rows: [
          ...scFees.map((f) => [
            f.created_at?.split('T')[0] || '',
            budgets.find((b) => b.id === f.budget_id)?.event_name || 'Activity',
            f.student_name,
            f.matric_no,
            Number(f.amount_paid),
            accountOf(f.account_type),
            f.status,
            f.receipt_url,
          ]),
          ...scGuests.map((g) => [
            g.created_at?.split('T')[0] || '',
            budgets.find((b) => b.id === g.budget_id)?.event_name || 'Activity',
            `${g.guest_name} (Guest Fee)`,
            g.lookup_code,
            Number(g.amount_paid),
            accountOf(g.account_type),
            g.payment_status,
            g.receipt_url,
          ]),
        ],
      },
      {
        name: '4_Claims',
        headers: ['Date', 'Activity', 'Claimant', 'Matric No', 'Title', 'Amount (RM)', 'Account', 'Status', 'Receipt URL', 'Proof URL'],
        rows: scClaims.map((c) => [
          c.expense_date,
          budgets.find((b) => b.id === c.budget_id)?.event_name || 'General Club Fund',
          c.claimant_name,
          c.matric_no,
          c.title,
          Number(c.amount),
          accountOf(c.account_type),
          c.status,
          c.receipt_url,
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '5_Approved_Reimbursements',
        headers: ['Date', 'Activity', 'Claimant', 'Title', 'Amount (RM)', 'Bank Details', 'Proof URL'],
        rows: approvedClaims.map((c) => [
          c.expense_date,
          budgets.find((b) => b.id === c.budget_id)?.event_name || 'General Club Fund',
          c.claimant_name,
          c.title,
          Number(c.amount),
          c.payment_info || '-',
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '6_Attendance',
        headers: ['Activity', 'Student', 'Matric No', 'RSVP', 'Checked-In'],
        rows: scRsvps.map((r) => [
          budgets.find((b) => b.id === r.budget_id)?.event_name || 'Activity',
          r.student_name,
          r.matric_no,
          r.attendance,
          r.qr_checked_in ? 'Yes' : 'No',
        ]),
      },
    ]);
    onRefresh(`Exported ${scopeTitle}.xlsx`);
  };

  // --- Fee & Budget Plan handlers ---
  const handleSaveFeeQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeeItem || !canEdit) return;
    const nextAmt = parseFloat(editFeeAmount);
    if (isNaN(nextAmt) || nextAmt <= 0) return;
    setSavingFeeEdit(true);
    try {
      await supabase
        .from('activity_fee_payments')
        .update({ amount_paid: nextAmt, status: editFeeStatus, account_type: editFeeAccount })
        .eq('id', editingFeeItem.id);
      void recordEditHistory({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: editingFeeItem.id,
        recordTitle: `${editingFeeItem.student_name} fee`,
        changes: computeFieldChanges([
          { field: 'Amount (RM)', before: Number(editingFeeItem.amount_paid).toFixed(2), after: nextAmt.toFixed(2) },
          { field: 'Status', before: editingFeeItem.status, after: editFeeStatus },
          { field: 'Account', before: accountOf(editingFeeItem.account_type), after: editFeeAccount },
        ]),
      });
      setEditingFeeItem(null);
      onRefresh(`Updated fee record for ${editingFeeItem.student_name}`);
    } finally {
      setSavingFeeEdit(false);
    }
  };

  const handleMarkUnpaidAsPaid = async (item: { budget: Budget; rsvp: EventRsvp; feeDue: number }) => {
    if (!canEdit) return;
    const key = `${item.budget.id}:${item.rsvp.user_id || item.rsvp.matric_no}`;
    setMarkingPaidKey(key);
    try {
      const { error } = await supabase.from('activity_fee_payments').insert({
        budget_id: item.budget.id,
        user_id: item.rsvp.user_id,
        student_name: item.rsvp.student_name,
        matric_no: item.rsvp.matric_no,
        phone_number: item.rsvp.phone_number || '',
        amount_paid: item.feeDue,
        account_type: 'Bank',
        receipt_url: '',
        receipt_file_name: 'Marked Paid (Finance Sheet)',
        status: 'Verified',
      });
      if (error) throw error;
      void logActivity(
        profile,
        'Fees',
        'Fee marked paid',
        `${profile.full_name} (${profile.matric_no}) marked RM ${item.feeDue.toFixed(2)} paid for ${item.rsvp.student_name} in ${item.budget.event_name}`
      );
      onRefresh(`Marked ${item.rsvp.student_name} as Paid (RM ${formatRM(item.feeDue)})`);
    } catch (err: unknown) {
      onRefresh(err instanceof Error ? err.message : 'Could not mark paid.');
    } finally {
      setMarkingPaidKey(null);
    }
  };

  const handleAddPlanItem = async () => {
    if (!canEdit || savingPlanItem) return;
    const n = parseFloat(newPlanAmount);
    if (!newPlanItem.trim() || isNaN(n) || n <= 0) return;
    setSavingPlanItem(true);
    try {
      const { error } = await supabase.from('budget_plan_items').insert({
        budget_id: plannerBudgetId,
        entry_type: newPlanType,
        item: newPlanItem.trim(),
        category: newPlanCategory,
        planned_amount: n,
        notes: '',
        created_by: profile.id,
      });
      if (error) {
        onRefresh(error.message || 'Could not add line.');
        return;
      }
      setNewPlanItem('');
      setNewPlanAmount('');
      onRefresh('Added line to Budget Plan');
    } finally {
      setSavingPlanItem(false);
    }
  };

  const handleUpdatePlanItem = async (
    row: BudgetPlanItem,
    patch: { item?: string; planned_amount?: number }
  ) => {
    if (!canEdit) return;
    await supabase.from('budget_plan_items').update(patch).eq('id', row.id);
    onRefresh('Updated Budget Plan line');
  };

  const handleDeletePlanItem = async (row: BudgetPlanItem) => {
    if (!canEdit) return;
    if (!window.confirm(`Remove "${row.item}" from Budget Plan?`)) return;
    await supabase
      .from('budget_plan_items')
      .update({
        deleted_at: new Date().toISOString(),
        deleted_by: `${profile.full_name} (${profile.matric_no})`,
      })
      .eq('id', row.id);
    onRefresh('Removed Budget Plan line');
  };

  if (loading) {
    return <LedgerSkeleton />;
  }

  return (
    <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-slate-900">
      {/* ===================== TOP SUMMARY STRIP (4 CALM BLOCKS) ===================== */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 divide-y sm:divide-y-0 sm:divide-x divide-slate-200 border-b border-slate-200 bg-white">
        {/* 1. Current Club Savings */}
        <div className="p-5 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Current Club Savings
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900">
            {mathSummary.totalSavings < 0 ? '-' : ''}RM {formatRM(mathSummary.totalSavings)}
          </div>
          <div className="text-xs text-slate-500 font-medium">
            Bank RM {formatRM(mathSummary.currentBank)} · Cash RM {formatRM(mathSummary.currentCash)}
          </div>
          {reservedPreClaimsTotal > 0 && (
            <div className="text-[11px] text-amber-700 font-semibold pt-0.5">
              Reserved (Pre-Claims): RM {formatRM(reservedPreClaimsTotal)} · Safe-to-Spend:{' '}
              {mathSummary.totalSavings - reservedPreClaimsTotal < 0 ? '-' : ''}RM{' '}
              {formatRM(mathSummary.totalSavings - reservedPreClaimsTotal)}
            </div>
          )}
        </div>

        {/* 2. Starting Savings (Initial Balance) */}
        <div className="p-5 flex items-start justify-between gap-3">
          <div className="space-y-1">
            <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
              Starting Savings
            </div>
            <div className="text-xl font-extrabold font-mono text-slate-800">
              RM {formatRM(openingTotal)}
            </div>
            <div className="text-[11px] text-slate-500">
              {openingTotal > 0 ? `Since ${openingDate}` : 'Not set yet'}
            </div>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={openOpeningSavingsModal}
              className={
                openingTotal === 0
                  ? 'px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shrink-0 cursor-pointer'
                  : 'px-2.5 py-1 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 text-xs font-semibold shrink-0 cursor-pointer'
              }
            >
              {openingTotal === 0 ? '+ Set Initial Savings' : 'Edit'}
            </button>
          )}
        </div>

        {/* 3. Total Money In */}
        <div className="p-5 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Money In
          </div>
          <div className="text-xl font-extrabold font-mono text-emerald-700">
            +RM {formatRM(mathSummary.totalIn)}
          </div>
          {pendingFeesTotal > 0 && (
            <div className="text-[11px] font-semibold text-amber-700">
              Pending check: RM {formatRM(pendingFeesTotal)}
            </div>
          )}
        </div>

        {/* 4. Total Money Out */}
        <div className="p-5 space-y-1">
          <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
            Total Money Out
          </div>
          <div className="text-xl font-extrabold font-mono text-rose-600">
            -RM {formatRM(mathSummary.totalOut)}
          </div>
        </div>
      </div>

      {/* ===================== UNDERLINED TAB BAR INSIDE WHITE CARD ===================== */}
      <div className="px-5 border-b border-slate-200 bg-slate-50/50 flex flex-wrap items-center gap-2 text-sm">
        {(
          [
            { id: 'sheet', label: 'Finance Sheet' },
            { id: 'activity', label: 'By Activity' },
            { id: 'unpaid', label: 'Unpaid Fees', badge: unpaidReceivables.length },
            { id: 'plan', label: 'Budget Plan' },
          ] as { id: FinanceTabView; label: string; badge?: number }[]
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveView(tab.id)}
            className={`px-3.5 py-3 -mb-px border-b-2 text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 cursor-pointer transition ${
              activeView === tab.id
                ? 'border-emerald-600 text-emerald-800'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            <span>{tab.label}</span>
            {typeof tab.badge === 'number' && tab.badge > 0 && (
              <span className="px-1.5 py-0.5 rounded-full text-[10px] font-extrabold bg-rose-600 text-white leading-none">
                {tab.badge}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ===================== VIEW 1: FINANCE SHEET ===================== */}
      {activeView === 'sheet' && (
        <div>
          {/* Simple 1-Row Toolbar */}
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <div className="flex flex-wrap items-center gap-2 flex-1 min-w-[260px]">
              <div className="relative w-48 sm:w-56">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search description..."
                  className="w-full rounded-lg border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                />
              </div>

              <div className="flex items-center p-0.5 rounded-lg bg-slate-100 border border-slate-200">
                {(
                  [
                    { key: 'ALL', label: 'All' },
                    { key: 'IN', label: 'Income' },
                    { key: 'OUT', label: 'Expense' },
                    { key: 'CLAIMS_FEES', label: 'Claims & Fees' },
                  ] as { key: SheetFilterPill; label: string }[]
                ).map((p) => (
                  <button
                    key={p.key}
                    type="button"
                    onClick={() => setFilterPill(p.key)}
                    className={`px-2.5 py-1 rounded-md font-semibold cursor-pointer transition ${
                      filterPill === p.key
                        ? 'bg-white text-slate-900 shadow-2xs'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {p.label}
                  </button>
                ))}
              </div>

              <select
                value={filterEvent}
                onChange={(e) => setFilterEvent(e.target.value)}
                className="rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 max-w-[180px]"
              >
                <option value="ALL">All Activities</option>
                <option value="GENERAL">General Club Fund</option>
                {activityOptions
                  .filter((name) => !isGeneralEventName(name))
                  .map((name) => (
                    <option key={name} value={name}>
                      {name}
                    </option>
                  ))}
              </select>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {canEdit && (
                <>
                  <button
                    type="button"
                    onClick={() => openAddModal('IN')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    <span>Income</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => openAddModal('OUT')}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-500 text-white font-bold cursor-pointer"
                  >
                    <Minus className="w-3.5 h-3.5" />
                    <span>Expense</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setImportPreviewRows([]);
                      setImportFileName('');
                      setPasteText('');
                      setShowImportModal(true);
                    }}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold cursor-pointer"
                  >
                    <Upload className="w-3.5 h-3.5" />
                    <span>Import Excel</span>
                  </button>
                </>
              )}
              <button
                type="button"
                onClick={() => void handleExportWorkbook(null)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-800 font-semibold cursor-pointer"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Mobile Stacked Transaction Cards (< 768px) */}
          <div className="md:hidden divide-y divide-slate-200">
            {/* Pinned Starting Savings Card */}
            <div className="p-4 bg-emerald-50/70 space-y-2">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[11px] font-mono text-slate-500">{openingDate}</div>
                  <div className="font-extrabold text-sm text-slate-900">Starting Club Savings</div>
                  <div className="text-[11px] text-slate-600 mt-0.5">
                    Bank RM {formatRM(openingBank)} · Cash RM {formatRM(openingCash)}
                  </div>
                </div>
                <div className="text-right shrink-0">
                  <span className="inline-block px-2 py-0.5 rounded-md border border-emerald-200 bg-white text-[10px] font-bold text-emerald-800">
                    Opening Balance
                  </span>
                  <div className="font-mono font-extrabold text-sm text-slate-900 mt-1">
                    RM {formatRM(openingTotal)}
                  </div>
                </div>
              </div>
              {canEdit && (
                <div className="flex justify-end">
                  <button
                    type="button"
                    onClick={openOpeningSavingsModal}
                    className="px-3 py-1.5 rounded-lg border border-emerald-300 bg-white hover:bg-emerald-100/70 text-emerald-800 font-bold text-xs cursor-pointer"
                  >
                    Edit Initial Savings
                  </button>
                </div>
              )}
            </div>

            {displayedRows.length === 0 ? (
              <div className="py-8 px-4 text-center text-xs text-slate-400">
                No matching transactions yet. Tap + Income or + Expense above to add one.
              </div>
            ) : (
              displayedRows.map((row) => (
                <div key={`mob-${row.uid}`} className="p-4 space-y-2.5 bg-white">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1 flex-1">
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
                        <span className="font-mono text-slate-500">{row.date}</span>
                        <span
                          className={`inline-block px-2 py-0.5 rounded-md border text-[10px] font-bold ${getActivityBadgeStyle(
                            row.eventName
                          )}`}
                        >
                          {row.eventName}
                        </span>
                        {row.source === 'CLAIM' && (
                          <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                            Claim
                          </span>
                        )}
                        {row.source === 'FEE' && (
                          <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
                            Fee
                          </span>
                        )}
                        {row.source === 'GUEST_FEE' && (
                          <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                            Guest Fee
                          </span>
                        )}
                      </div>
                      <div className="font-bold text-sm text-slate-900 break-words">
                        {row.title}
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-slate-500">
                        <span>{row.personShort}</span>
                        <span>·</span>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() => void handleToggleAccountType(row)}
                            className={`inline-flex items-center gap-0.5 px-2 py-0.5 rounded font-semibold text-[10px] border cursor-pointer ${
                              row.accountType === 'Cash'
                                ? 'bg-amber-50 text-amber-800 border-amber-200'
                                : 'bg-slate-100 text-slate-700 border-slate-200'
                            }`}
                          >
                            {row.accountType === 'Cash' ? (
                              <Banknote className="w-2.5 h-2.5" />
                            ) : (
                              <Landmark className="w-2.5 h-2.5" />
                            )}
                            <span>{row.accountType}</span>
                          </button>
                        ) : (
                          <span className="font-semibold text-slate-600">{row.accountType}</span>
                        )}
                      </div>
                    </div>

                    <div className="text-right shrink-0 space-y-0.5">
                      <div
                        className={`font-mono font-extrabold text-sm ${
                          row.entryType === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {row.entryType === 'IN' ? '+' : '-'}RM {formatRM(row.amount)}
                      </div>
                      <div className="text-[11px] font-mono font-bold text-slate-500">
                        Bal: {row.runningBalance < 0 ? '-' : ''}RM {formatRM(row.runningBalance)}
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-end gap-1.5 pt-1 border-t border-slate-100">
                    {row.attachmentUrl && (
                      <a
                        href={row.attachmentUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-emerald-50 text-emerald-700 text-[11px] font-bold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        <span>Receipt</span>
                      </a>
                    )}
                    <button
                      type="button"
                      onClick={() =>
                        setHistoryTarget({
                          table:
                            row.source === 'CLAIM'
                              ? 'claims'
                              : row.source === 'FEE'
                              ? 'activity_fee_payments'
                              : row.source === 'GUEST_FEE'
                              ? 'public_guest_registrations'
                              : 'ledger_entries',
                          recordId: row.recordId,
                          title: row.title,
                        })
                      }
                      className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-600 text-[11px] font-bold cursor-pointer"
                    >
                      <History className="w-3.5 h-3.5" />
                      <span>History</span>
                    </button>
                    {canEdit && row.source === 'LEDGER' && row.rawLedger && (
                      <button
                        type="button"
                        onClick={() => openEditModal(row.rawLedger!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canEdit && row.source === 'FEE' && row.rawFee && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingFeeItem(row.rawFee!);
                          setEditFeeAmount(String(row.rawFee!.amount_paid));
                          setEditFeeStatus(row.rawFee!.status);
                          setEditFeeAccount(accountOf(row.rawFee!.account_type));
                        }}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Edit</span>
                      </button>
                    )}
                    {canEdit && row.source === 'CLAIM' && row.rawClaim && onSelectClaim && (
                      <button
                        type="button"
                        onClick={() => onSelectClaim(row.rawClaim!)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-slate-100 text-slate-700 text-[11px] font-bold cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        <span>Review</span>
                      </button>
                    )}
                    {canEdit && (
                      <button
                        type="button"
                        onClick={() => void handleDeleteRow(row)}
                        className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-rose-50 text-rose-600 text-[11px] font-bold cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Delete</span>
                      </button>
                    )}
                  </div>
                </div>
              ))
            )}

            <div className="p-4 bg-slate-50 border-t border-slate-200 space-y-1.5 text-xs">
              <div className="flex items-center justify-between font-semibold text-slate-600">
                <span>
                  {displayedRows.length} transaction{displayedRows.length === 1 ? '' : 's'}
                  {hasSheetFilters ? ' (filtered)' : ''}
                </span>
                <span className="font-mono font-extrabold text-slate-900">
                  Closing: {sheetFooterTotals.closing < 0 ? '-' : ''}RM {formatRM(sheetFooterTotals.closing)}
                </span>
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono font-bold">
                <span className="text-emerald-700">+RM {formatRM(sheetFooterTotals.inTotal)} IN</span>
                <span className="text-rose-600">-RM {formatRM(sheetFooterTotals.outTotal)} OUT</span>
              </div>
            </div>
          </div>

          {/* 7-Column Crisp Spreadsheet Table (Desktop) */}
          <div className="hidden md:block overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase tracking-wider text-slate-600">
                  <th className="py-2.5 px-3 border-r border-slate-200 w-32">Date</th>
                  <th className="py-2.5 px-3 border-r border-slate-200">Description</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 w-44">Activity</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-32">Money In (+)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-32">Money Out (-)</th>
                  <th className="py-2.5 px-3 border-r border-slate-200 text-right w-36">Balance</th>
                  <th className="py-2.5 px-3 text-right w-28">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {/* Pinned Row 0: Starting Club Savings */}
                <tr className="bg-emerald-50/70">
                  <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                    {openingDate}
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <div className="font-bold text-slate-900">Starting Club Savings</div>
                    <div className="text-[11px] text-slate-600">
                      Bank RM {formatRM(openingBank)} · Cash RM {formatRM(openingCash)}
                    </div>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200">
                    <span className="inline-block px-2 py-0.5 rounded-md border border-emerald-200 bg-white text-[11px] font-semibold text-emerald-800">
                      Opening Balance
                    </span>
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-400">
                    —
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono text-slate-400">
                    —
                  </td>
                  <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                    RM {formatRM(openingTotal)}
                  </td>
                  <td className="py-2.5 px-3 text-right">
                    {canEdit && (
                      <button
                        type="button"
                        onClick={openOpeningSavingsModal}
                        className="px-2.5 py-1 rounded-md border border-emerald-300 bg-white hover:bg-emerald-100/70 text-emerald-800 font-semibold text-[11px] cursor-pointer"
                      >
                        Edit
                      </button>
                    )}
                  </td>
                </tr>

                {/* Unified Transaction Rows */}
                {displayedRows.map((row) => {
                  const isLedgerEditable = canEdit && row.source === 'LEDGER' && Boolean(row.rawLedger);
                  const isBusy = busyRowId === row.uid;
                  const isEditingThis = (field: EditableCellField) =>
                    editingCell?.id === row.uid && editingCell.field === field;

                  return (
                    <tr
                      key={row.uid}
                      className={`hover:bg-slate-50/80 transition ${isBusy ? 'opacity-60' : ''}`}
                    >
                      {/* Col 1: Date */}
                      <td className="py-2.5 px-3 border-r border-slate-200 font-mono text-slate-700 whitespace-nowrap">
                        {isLedgerEditable && isEditingThis('date') ? (
                          <input
                            type="date"
                            autoFocus
                            value={cellDraft}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onBlur={() => void commitCellEdit(row, 'date', cellDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitCellEdit(row, 'date', cellDraft);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full rounded border border-emerald-500 ring-2 ring-emerald-500/20 px-1.5 py-0.5 text-[11px] bg-white focus:outline-none"
                          />
                        ) : isLedgerEditable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell({ id: row.uid, field: 'date' });
                              setCellDraft(row.date);
                            }}
                            className="w-full text-left hover:text-emerald-700 cursor-text"
                            title="Click to edit date"
                          >
                            {row.date}
                          </button>
                        ) : (
                          row.date
                        )}
                      </td>

                      {/* Col 2: Clean Description (Title + 1 short line: Person · Bank/Cash pill) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 min-w-[220px]">
                        {isLedgerEditable && isEditingThis('title') ? (
                          <input
                            type="text"
                            autoFocus
                            value={cellDraft}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onBlur={() => void commitCellEdit(row, 'title', cellDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitCellEdit(row, 'title', cellDraft);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-full rounded border border-emerald-500 ring-2 ring-emerald-500/20 px-2 py-1 font-semibold bg-white focus:outline-none"
                          />
                        ) : (
                          <div className="space-y-0.5">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              {row.source === 'CLAIM' && (
                                <span className="px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-700 border border-indigo-200 text-[10px] font-bold">
                                  Claim
                                </span>
                              )}
                              {row.source === 'FEE' && (
                                <span className="px-1.5 py-0.5 rounded bg-teal-50 text-teal-700 border border-teal-200 text-[10px] font-bold">
                                  Fee
                                </span>
                              )}
                              {row.source === 'GUEST_FEE' && (
                                <span className="px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-200 text-[10px] font-bold">
                                  Guest Fee
                                </span>
                              )}
                              {isLedgerEditable ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingCell({ id: row.uid, field: 'title' });
                                    setCellDraft(row.title);
                                  }}
                                  className="font-semibold text-slate-900 hover:text-emerald-700 text-left cursor-text"
                                  title="Click to edit description"
                                >
                                  {row.title}
                                </button>
                              ) : row.source === 'CLAIM' && row.rawClaim && onSelectClaim ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectClaim(row.rawClaim!)}
                                  className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left cursor-pointer"
                                >
                                  {row.title}
                                </button>
                              ) : row.source === 'FEE' && row.rawFee && canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFeeItem(row.rawFee!);
                                    setEditFeeAmount(String(row.rawFee!.amount_paid));
                                    setEditFeeStatus(row.rawFee!.status);
                                    setEditFeeAccount(accountOf(row.rawFee!.account_type));
                                  }}
                                  className="font-semibold text-slate-900 hover:text-emerald-700 hover:underline text-left cursor-pointer"
                                >
                                  {row.title}
                                </button>
                              ) : (
                                <span className="font-semibold text-slate-900">{row.title}</span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                              {onOpenMemberProfile && row.personShort && row.personShort !== 'Club' ? (
                                <button
                                  type="button"
                                  onClick={() => openProfileForLedgerRow(row)}
                                  className="hover:text-emerald-700 hover:underline cursor-pointer text-left font-medium"
                                  title="View member profile"
                                >
                                  {row.personShort}
                                </button>
                              ) : (
                                <span>{row.personShort}</span>
                              )}
                              <span>·</span>
                              {canEdit ? (
                                <button
                                  type="button"
                                  onClick={() => void handleToggleAccountType(row)}
                                  className={`inline-flex items-center gap-0.5 px-1.5 py-0.2 rounded font-semibold text-[10px] border cursor-pointer transition ${
                                    row.accountType === 'Cash'
                                      ? 'bg-amber-50 text-amber-800 border-amber-200 hover:bg-amber-100'
                                      : 'bg-slate-100 text-slate-700 border-slate-200 hover:bg-slate-200'
                                  }`}
                                  title="Click to switch between Bank and Cash"
                                >
                                  {row.accountType === 'Cash' ? (
                                    <Banknote className="w-2.5 h-2.5" />
                                  ) : (
                                    <Landmark className="w-2.5 h-2.5" />
                                  )}
                                  <span>{row.accountType}</span>
                                </button>
                              ) : (
                                <span className="font-semibold text-slate-600">{row.accountType}</span>
                              )}
                            </div>
                          </div>
                        )}
                      </td>

                      {/* Col 3: Activity */}
                      <td className="py-2.5 px-3 border-r border-slate-200">
                        {isLedgerEditable && isEditingThis('event') ? (
                          <input
                            type="text"
                            list="ledger-activity-options"
                            autoFocus
                            value={cellDraft}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onBlur={() => void commitCellEdit(row, 'event', cellDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitCellEdit(row, 'event', cellDraft);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            placeholder="Select or type activity..."
                            className="w-full rounded border border-emerald-500 ring-2 ring-emerald-500/20 px-2 py-1 text-[11px] font-semibold bg-white focus:outline-none"
                          />
                        ) : isLedgerEditable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell({ id: row.uid, field: 'event' });
                              setCellDraft(row.eventName);
                            }}
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold text-left cursor-pointer hover:opacity-85 ${getActivityBadgeStyle(
                              row.eventName
                            )}`}
                            title="Click to change activity"
                          >
                            {row.eventName}
                          </button>
                        ) : (
                          <span
                            className={`inline-block px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getActivityBadgeStyle(
                              row.eventName
                            )}`}
                          >
                            {row.eventName}
                          </span>
                        )}
                      </td>

                      {/* Col 4: Money In (+) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono whitespace-nowrap">
                        {isLedgerEditable && isEditingThis('in') ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            autoFocus
                            value={cellDraft}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onBlur={() => void commitCellEdit(row, 'in', cellDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitCellEdit(row, 'in', cellDraft);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-24 ml-auto block rounded border border-emerald-500 ring-2 ring-emerald-500/20 px-2 py-0.5 text-right font-bold bg-white focus:outline-none"
                          />
                        ) : row.entryType === 'IN' ? (
                          isLedgerEditable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCell({ id: row.uid, field: 'in' });
                                setCellDraft(row.amount.toFixed(2));
                              }}
                              className="w-full text-right font-bold text-emerald-700 hover:underline cursor-text"
                              title="Click to edit income amount"
                            >
                              +RM {formatRM(row.amount)}
                            </button>
                          ) : (
                            <span className="font-bold text-emerald-700">+RM {formatRM(row.amount)}</span>
                          )
                        ) : isLedgerEditable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell({ id: row.uid, field: 'in' });
                              setCellDraft(row.amount.toFixed(2));
                            }}
                            className="w-full text-right text-slate-300 hover:text-emerald-600 cursor-text"
                            title="Click to switch to Money In"
                          >
                            —
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Col 5: Money Out (-) */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono whitespace-nowrap">
                        {isLedgerEditable && isEditingThis('out') ? (
                          <input
                            type="number"
                            step="0.01"
                            min="0.01"
                            autoFocus
                            value={cellDraft}
                            onChange={(e) => setCellDraft(e.target.value)}
                            onBlur={() => void commitCellEdit(row, 'out', cellDraft)}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') void commitCellEdit(row, 'out', cellDraft);
                              if (e.key === 'Escape') setEditingCell(null);
                            }}
                            className="w-24 ml-auto block rounded border border-emerald-500 ring-2 ring-emerald-500/20 px-2 py-0.5 text-right font-bold bg-white focus:outline-none"
                          />
                        ) : row.entryType === 'OUT' ? (
                          isLedgerEditable ? (
                            <button
                              type="button"
                              onClick={() => {
                                setEditingCell({ id: row.uid, field: 'out' });
                                setCellDraft(row.amount.toFixed(2));
                              }}
                              className="w-full text-right font-bold text-rose-600 hover:underline cursor-text"
                              title="Click to edit expense amount"
                            >
                              -RM {formatRM(row.amount)}
                            </button>
                          ) : (
                            <span className="font-bold text-rose-600">-RM {formatRM(row.amount)}</span>
                          )
                        ) : isLedgerEditable ? (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingCell({ id: row.uid, field: 'out' });
                              setCellDraft(row.amount.toFixed(2));
                            }}
                            className="w-full text-right text-slate-300 hover:text-rose-500 cursor-text"
                            title="Click to switch to Money Out"
                          >
                            —
                          </button>
                        ) : (
                          <span className="text-slate-300">—</span>
                        )}
                      </td>

                      {/* Col 6: Running Balance */}
                      <td className="py-2.5 px-3 border-r border-slate-200 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                        {row.runningBalance < 0 ? '-' : ''}RM {formatRM(row.runningBalance)}
                      </td>

                      {/* Col 7: Actions */}
                      <td className="py-2.5 px-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1">
                          {row.attachmentUrl && (
                            <a
                              href={row.attachmentUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="p-1.5 rounded hover:bg-slate-100 text-emerald-700"
                              title="View Receipt"
                            >
                              <ExternalLink className="w-3.5 h-3.5" />
                            </a>
                          )}
                          <button
                            type="button"
                            onClick={() =>
                              setHistoryTarget({
                                table:
                                  row.source === 'CLAIM'
                                    ? 'claims'
                                    : row.source === 'FEE'
                                    ? 'activity_fee_payments'
                                    : row.source === 'GUEST_FEE'
                                    ? 'public_guest_registrations'
                                    : 'ledger_entries',
                                recordId: row.recordId,
                                title: row.title,
                              })
                            }
                            className="p-1.5 rounded hover:bg-slate-100 text-slate-500 cursor-pointer"
                            title="History"
                          >
                            <History className="w-3.5 h-3.5" />
                          </button>
                          {canEdit && (
                            <>
                              {row.source === 'LEDGER' && row.rawLedger && (
                                <button
                                  type="button"
                                  onClick={() => openEditModal(row.rawLedger!)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  title="Edit Record"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {row.source === 'FEE' && row.rawFee && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEditingFeeItem(row.rawFee!);
                                    setEditFeeAmount(String(row.rawFee!.amount_paid));
                                    setEditFeeStatus(row.rawFee!.status);
                                    setEditFeeAccount(accountOf(row.rawFee!.account_type));
                                  }}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  title="Edit Fee"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              {row.source === 'CLAIM' && row.rawClaim && onSelectClaim && (
                                <button
                                  type="button"
                                  onClick={() => onSelectClaim(row.rawClaim!)}
                                  className="p-1.5 rounded hover:bg-slate-100 text-slate-600 cursor-pointer"
                                  title="Open Claim"
                                >
                                  <Edit3 className="w-3.5 h-3.5" />
                                </button>
                              )}
                              <button
                                type="button"
                                onClick={() => void handleDeleteRow(row)}
                                className="p-1.5 rounded hover:bg-rose-50 text-rose-600 cursor-pointer"
                                title="Delete"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {displayedRows.length === 0 && (
                  <tr>
                    <td colSpan={7} className="py-8 text-center text-slate-400">
                      No matching transactions yet. Type into the + Add Row below or import an Excel sheet.
                    </td>
                  </tr>
                )}

                {/* Always-Ready Bottom + Add Row (Excel-Style) */}
                {canEdit && (
                  <tr className="bg-slate-50/70">
                    <td className="py-2 px-2 border-r border-slate-200">
                      <input
                        type="date"
                        value={qaDate}
                        onChange={(e) => setQaDate(e.target.value)}
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-mono focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200">
                      <input
                        ref={quickDescRef}
                        type="text"
                        value={qaTitle}
                        onChange={(e) => setQaTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleQuickAddSubmit();
                          }
                        }}
                        placeholder="+ Add row: Type description..."
                        className="w-full rounded-md border border-slate-200 bg-white px-2.5 py-1 text-xs font-medium focus:outline-none focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20"
                      />
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200">
                      <input
                        type="text"
                        list="ledger-activity-options"
                        value={qaEvent}
                        onChange={(e) => setQaEvent(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleQuickAddSubmit();
                          }
                        }}
                        placeholder="Select or type activity..."
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={qaIn}
                        onChange={(e) => {
                          setQaIn(e.target.value);
                          if (e.target.value) setQaOut('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleQuickAddSubmit();
                          }
                        }}
                        placeholder="In (RM)"
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-emerald-700 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={qaOut}
                        onChange={(e) => {
                          setQaOut(e.target.value);
                          if (e.target.value) setQaIn('');
                        }}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            void handleQuickAddSubmit();
                          }
                        }}
                        placeholder="Out (RM)"
                        className="w-full rounded-md border border-slate-200 bg-white px-2 py-1 text-right font-mono text-xs text-rose-600 font-bold focus:outline-none focus:border-emerald-500"
                      />
                    </td>
                    <td className="py-2 px-2 border-r border-slate-200 text-right">
                      <button
                        type="button"
                        onClick={() => setQaAccount((a) => (a === 'Bank' ? 'Cash' : 'Bank'))}
                        className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-md border text-[11px] font-semibold cursor-pointer ${
                          qaAccount === 'Cash'
                            ? 'bg-amber-50 border-amber-300 text-amber-800'
                            : 'bg-white border-slate-300 text-slate-700'
                        }`}
                        title="Toggle Bank or Cash"
                      >
                        {qaAccount === 'Cash' ? (
                          <Banknote className="w-3 h-3" />
                        ) : (
                          <Landmark className="w-3 h-3" />
                        )}
                        <span>{qaAccount}</span>
                      </button>
                    </td>
                    <td className="py-2 px-2 text-right">
                      <button
                        type="button"
                        disabled={qaSaving || !qaTitle.trim() || (!qaIn && !qaOut)}
                        onClick={() => void handleQuickAddSubmit()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white text-[11px] font-bold cursor-pointer"
                      >
                        {qaSaving ? (
                          <Loader2 className="w-3 h-3 animate-spin" />
                        ) : (
                          <CornerDownLeft className="w-3 h-3" />
                        )}
                        <span>Add</span>
                      </button>
                    </td>
                  </tr>
                )}
              </tbody>

              {/* Clean Light Totals Footer Aligned Under Numbers */}
              <tfoot>
                <tr className="bg-slate-50 border-t-2 border-slate-200 text-xs">
                  <td colSpan={3} className="py-3 px-3 border-r border-slate-200 font-semibold text-slate-600">
                    {displayedRows.length} transaction{displayedRows.length === 1 ? '' : 's'}
                    {hasSheetFilters ? ' (filtered)' : ''}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-emerald-700 whitespace-nowrap">
                    +RM {formatRM(sheetFooterTotals.inTotal)}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-rose-600 whitespace-nowrap">
                    -RM {formatRM(sheetFooterTotals.outTotal)}
                  </td>
                  <td className="py-3 px-3 border-r border-slate-200 text-right font-mono font-extrabold text-slate-900 whitespace-nowrap">
                    {sheetFooterTotals.closing < 0 ? '-' : ''}RM {formatRM(sheetFooterTotals.closing)}
                  </td>
                  <td className="py-3 px-3" />
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: BY ACTIVITY (INSIDE SAME WHITE CARD) ===================== */}
      {activeView === 'activity' && (
        <div className="divide-y divide-slate-200">
          {activityPnlCards.map((card) => {
            const expanded = expandedActivityKey === card.key;
            return (
              <div key={card.key}>
                <div className="p-4 sm:p-5 flex flex-wrap items-center justify-between gap-4 hover:bg-slate-50/50">
                  <button
                    type="button"
                    onClick={() => setExpandedActivityKey(expanded ? null : card.key)}
                    className="text-left space-y-1 flex-1 min-w-[220px] cursor-pointer"
                  >
                    <div className="flex items-center gap-2 flex-wrap">
                      {expanded ? (
                        <ChevronDown className="w-4 h-4 text-slate-500 shrink-0" />
                      ) : (
                        <ChevronRight className="w-4 h-4 text-slate-400 shrink-0" />
                      )}
                      <span
                        className={`px-2.5 py-0.5 rounded-md border text-xs font-bold ${getActivityBadgeStyle(
                          card.title
                        )}`}
                      >
                        {card.title}
                      </span>
                      <span className="text-xs text-slate-500">{card.subtitle}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1 pl-6 text-slate-600">
                      <span>
                        Fees: <strong className="font-mono text-emerald-700">+RM {formatRM(card.feesIn)}</strong>
                      </span>
                      <span>
                        Manual In:{' '}
                        <strong className="font-mono text-emerald-700">+RM {formatRM(card.manualIn)}</strong>
                      </span>
                      <span>
                        Claims:{' '}
                        <strong className="font-mono text-rose-600">-RM {formatRM(card.claimsOut)}</strong>
                      </span>
                      <span>
                        Manual Out:{' '}
                        <strong className="font-mono text-rose-600">-RM {formatRM(card.manualOut)}</strong>
                      </span>
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">Net</span>
                      <span
                        className={`text-sm font-mono font-extrabold ${
                          card.net >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {card.net >= 0 ? '+' : '-'}RM {formatRM(card.net)}
                      </span>
                    </div>
                    {card.budget && (
                      <button
                        type="button"
                        onClick={() => void handleExportWorkbook(card.budget)}
                        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-emerald-300 hover:bg-emerald-50 text-emerald-800 text-xs font-semibold cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Export Excel</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedActivityKey(expanded ? null : card.key)}
                      className="px-2.5 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700 text-xs font-semibold cursor-pointer"
                    >
                      {expanded ? 'Hide' : `${card.rows.length} rows`}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-slate-200 bg-slate-50/70 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="border-b border-slate-200 text-[11px] font-bold text-slate-500">
                          <th className="py-2 px-4">Date</th>
                          <th className="py-2 px-4">Description</th>
                          <th className="py-2 px-4">Person</th>
                          <th className="py-2 px-4">Account</th>
                          <th className="py-2 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-200">
                        {card.rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-4 text-center text-slate-400">
                              No transactions recorded under this activity yet.
                            </td>
                          </tr>
                        ) : (
                          card.rows.map((r) => (
                            <tr key={r.uid} className="hover:bg-white">
                              <td className="py-2 px-4 font-mono">{r.date}</td>
                              <td className="py-2 px-4 font-semibold">{r.title}</td>
                              <td className="py-2 px-4 text-slate-600">
                                {onOpenMemberProfile && r.personShort && r.personShort !== 'Club' ? (
                                  <button
                                    type="button"
                                    onClick={() => openProfileForLedgerRow(r)}
                                    className="hover:text-emerald-700 hover:underline cursor-pointer text-left font-medium"
                                    title="View member profile"
                                  >
                                    {r.personShort}
                                  </button>
                                ) : (
                                  r.personShort
                                )}
                              </td>
                              <td className="py-2 px-4 text-slate-600">{r.accountType}</td>
                              <td
                                className={`py-2 px-4 text-right font-mono font-bold ${
                                  r.entryType === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {r.entryType === 'IN' ? '+' : '-'}RM {formatRM(r.amount)}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* ===================== VIEW 3: UNPAID FEES (INSIDE SAME WHITE CARD) ===================== */}
      {activeView === 'unpaid' && (
        <div>
          <div className="p-4 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3 text-xs">
            <span className="font-bold text-slate-700">
              Unpaid Event Registration Fees ({unpaidReceivables.length})
            </span>
            <select
              value={unpaidEventFilter}
              onChange={(e) => setUnpaidEventFilter(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold"
            >
              <option value="ALL">All Paid Events</option>
              {budgets
                .filter((b) => Number(b.registration_fee || 0) > 0)
                .map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event_name} (RM {Number(b.registration_fee).toFixed(2)})
                  </option>
                ))}
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-2.5 px-4 border-r border-slate-200">Student</th>
                  <th className="py-2.5 px-4 border-r border-slate-200">Activity</th>
                  <th className="py-2.5 px-4 border-r border-slate-200 text-right">Fee Due</th>
                  <th className="py-2.5 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {unpaidReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      All attending members have paid their fees.
                    </td>
                  </tr>
                ) : (
                  unpaidReceivables.map((item) => {
                    const waMsg = `Hi ${item.rsvp.student_name}, gentle reminder to pay RM ${item.feeDue.toFixed(
                      2
                    )} registration fee for ${item.budget.event_name}. Thank you!`;
                    return (
                      <tr key={item.key} className="hover:bg-slate-50">
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          {onOpenMemberProfile ? (
                            <button
                              type="button"
                              onClick={() =>
                                onOpenMemberProfile({
                                  userId: item.rsvp.user_id,
                                  matricNo: item.rsvp.matric_no,
                                  name: item.rsvp.student_name,
                                })
                              }
                              className="font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer text-left"
                              title="View student profile"
                            >
                              {item.rsvp.student_name}
                            </button>
                          ) : (
                            <div className="font-bold text-slate-900">{item.rsvp.student_name}</div>
                          )}
                          <div className="text-[11px] font-mono text-slate-500">{item.rsvp.matric_no}</div>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded-md border text-[11px] font-semibold ${getActivityBadgeStyle(
                              item.budget.event_name
                            )}`}
                          >
                            {item.budget.event_name}
                          </span>
                        </td>
                        <td className="py-2.5 px-4 border-r border-slate-200 text-right font-mono font-bold text-amber-700">
                          RM {formatRM(item.feeDue)}
                        </td>
                        <td className="py-2.5 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <a
                              href={waLink(item.rsvp.phone_number, waMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg border border-emerald-200 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 font-semibold"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                            {canEdit && (
                              <button
                                type="button"
                                disabled={markingPaidKey === item.key}
                                onClick={() => void handleMarkUnpaidAsPaid(item)}
                                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-60"
                              >
                                {markingPaidKey === item.key ? (
                                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                                ) : (
                                  <CheckCircle2 className="w-3.5 h-3.5" />
                                )}
                                <span>Mark Paid</span>
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== VIEW 4: BUDGET PLAN (INSIDE SAME WHITE CARD) ===================== */}
      {activeView === 'plan' && (
        <div className="p-5 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-extrabold text-slate-900">
              Budget Plan (Estimated vs Actual)
            </h2>
            <select
              value={plannerBudgetId}
              onChange={(e) => setPlannerBudgetId(e.target.value)}
              className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold"
            >
              <option value="ALL">All Activities Combined</option>
              <option value="GENERAL">General Club Fund</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.id}>
                  {b.event_name}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200">
              <div className="text-emerald-800 font-bold">Planned Income</div>
              <div className="text-base font-mono font-extrabold text-emerald-950">
                RM {formatRM(plannerTotals.plannedIn)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500 font-bold">Actual Income</div>
              <div className="text-base font-mono font-extrabold text-emerald-700">
                RM {formatRM(plannerTotals.actualIn)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-rose-50/70 border border-rose-200">
              <div className="text-rose-800 font-bold">Planned Expense</div>
              <div className="text-base font-mono font-extrabold text-rose-950">
                RM {formatRM(plannerTotals.plannedOut)}
              </div>
            </div>
            <div className="p-3 rounded-xl bg-white border border-slate-200">
              <div className="text-slate-500 font-bold">Actual Expense</div>
              <div className="text-base font-mono font-extrabold text-rose-600">
                RM {formatRM(plannerTotals.actualOut)}
              </div>
            </div>
          </div>

          {canEdit && (
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs">
              <select
                value={newPlanType}
                onChange={(e) => {
                  const t = e.target.value as 'IN' | 'OUT';
                  setNewPlanType(t);
                  setNewPlanCategory(t === 'IN' ? IN_CATEGORIES[0] : OUT_CATEGORIES[0]);
                }}
                className="md:col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-semibold"
              >
                <option value="OUT">Est. Expense</option>
                <option value="IN">Est. Income</option>
              </select>
              <input
                type="text"
                value={newPlanItem}
                onChange={(e) => setNewPlanItem(e.target.value)}
                placeholder="Budget item (e.g., Arbiter Fee)"
                className="md:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-medium"
              />
              <select
                value={newPlanCategory}
                onChange={(e) => setNewPlanCategory(e.target.value)}
                className="md:col-span-3 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5"
              >
                {(newPlanType === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <input
                type="number"
                step="0.01"
                value={newPlanAmount}
                onChange={(e) => setNewPlanAmount(e.target.value)}
                placeholder="Planned RM"
                className="md:col-span-2 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 font-mono font-bold"
              />
              <button
                type="button"
                disabled={savingPlanItem}
                onClick={() => void handleAddPlanItem()}
                className="md:col-span-2 py-1.5 px-3 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-60"
              >
                {savingPlanItem ? 'Saving...' : '+ Add Line'}
              </button>
            </div>
          )}

          <div className="border border-slate-200 rounded-xl overflow-hidden">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 border-b border-slate-200 text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-2.5 px-4 border-r border-slate-200">Type</th>
                  <th className="py-2.5 px-4 border-r border-slate-200">Item</th>
                  <th className="py-2.5 px-4 border-r border-slate-200">Category</th>
                  <th className="py-2.5 px-4 border-r border-slate-200 text-right">Planned (RM)</th>
                  <th className="py-2.5 px-4 border-r border-slate-200 text-right">Actual (RM)</th>
                  <th className="py-2.5 px-4 text-right">Variance</th>
                  {canEdit && <th className="py-2.5 px-4 text-right">Remove</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {scopedPlannerRows.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-slate-400">
                      No planned budget lines yet.
                    </td>
                  </tr>
                ) : (
                  scopedPlannerRows.map((p) => {
                    const plannedVal = Number(p.planned_amount) || 0;
                    const actualCat = unifiedRows
                      .filter(
                        (r) =>
                          r.entryType === p.entry_type &&
                          (p.budget_id === 'ALL'
                            ? true
                            : p.budget_id === 'GENERAL'
                            ? isGeneralEventName(r.eventName)
                            : r.budgetId === p.budget_id) &&
                          r.category.toLowerCase() === p.category.toLowerCase()
                      )
                      .reduce((s, r) => s + r.amount, 0);
                    const diff = p.entry_type === 'IN' ? actualCat - plannedVal : plannedVal - actualCat;
                    return (
                      <tr key={p.id}>
                        <td className="py-2 px-4 border-r border-slate-200">
                          <span
                            className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              p.entry_type === 'IN'
                                ? 'bg-emerald-50 text-emerald-700'
                                : 'bg-rose-50 text-rose-700'
                            }`}
                          >
                            {p.entry_type === 'IN' ? 'Income' : 'Expense'}
                          </span>
                        </td>
                        <td className="py-2 px-4 border-r border-slate-200 font-semibold">
                          {canEdit ? (
                            <input
                              type="text"
                              defaultValue={p.item}
                              onBlur={(e) => {
                                const v = e.target.value.trim();
                                if (v && v !== p.item) void handleUpdatePlanItem(p, { item: v });
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-full rounded border border-slate-200 px-2 py-1 font-semibold"
                            />
                          ) : (
                            p.item
                          )}
                        </td>
                        <td className="py-2 px-4 border-r border-slate-200 text-slate-600">{p.category}</td>
                        <td className="py-2 px-4 border-r border-slate-200 text-right font-mono font-bold">
                          {canEdit ? (
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={plannedVal.toFixed(2)}
                              onBlur={(e) => {
                                const v = parseFloat(e.target.value);
                                if (!isNaN(v) && v >= 0 && Math.abs(v - plannedVal) > 0.001) {
                                  void handleUpdatePlanItem(p, { planned_amount: v });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-24 ml-auto block rounded border border-slate-200 px-2 py-1 text-right font-mono font-bold"
                            />
                          ) : (
                            `RM ${formatRM(plannedVal)}`
                          )}
                        </td>
                        <td className="py-2 px-4 border-r border-slate-200 text-right font-mono font-semibold text-slate-700">
                          RM {formatRM(actualCat)}
                        </td>
                        <td
                          className={`py-2 px-4 text-right font-mono font-bold ${
                            diff >= 0 ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {diff >= 0 ? '+' : '-'}RM {formatRM(diff)}
                        </td>
                        {canEdit && (
                          <td className="py-2 px-4 text-right">
                            <button
                              type="button"
                              onClick={() => void handleDeletePlanItem(p)}
                              className="p-1 text-rose-600 hover:bg-rose-50 rounded cursor-pointer"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        )}
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ===================== STARTING SAVINGS MODAL ===================== */}
      {showOpeningModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-sm w-full overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Starting Club Savings</h3>
              <button
                type="button"
                onClick={() => setShowOpeningModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleOpeningBalanceSubmit} className="p-5 space-y-3.5 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Starting Bank (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openBankInput}
                  onChange={(e) => setOpenBankInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Starting Cash (RM)</label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={openCashInput}
                  onChange={(e) => setOpenCashInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-slate-700 mb-1">Start Date</label>
                <input
                  type="date"
                  value={openDateInput}
                  onChange={(e) => setOpenDateInput(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                  required
                />
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200 flex items-center justify-between">
                <span className="font-semibold text-emerald-900">Total Starting Savings =</span>
                <span className="font-mono font-extrabold text-emerald-800 text-sm">
                  RM {formatRM((parseFloat(openBankInput) || 0) + (parseFloat(openCashInput) || 0))}
                </span>
              </div>
              <div className="flex justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowOpeningModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingOpening}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {savingOpening && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Starting Savings</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== ADD / EDIT INCOME OR EXPENSE MODAL ===================== */}
      {showModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-md w-full overflow-hidden my-8">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">
                {editingEntry
                  ? 'Edit Finance Record'
                  : entryType === 'IN'
                  ? '+ Add Income'
                  : '- Add Expense'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-5 space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-1.5 bg-slate-100 p-1 rounded-xl">
                <button
                  type="button"
                  onClick={() => {
                    setEntryType('IN');
                    setCategory(IN_CATEGORIES[0]);
                  }}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer ${
                    entryType === 'IN' ? 'bg-emerald-600 text-white' : 'text-slate-600'
                  }`}
                >
                  + Money In
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEntryType('OUT');
                    setCategory(OUT_CATEGORIES[0]);
                  }}
                  className={`py-1.5 rounded-lg font-bold cursor-pointer ${
                    entryType === 'OUT' ? 'bg-rose-600 text-white' : 'text-slate-600'
                  }`}
                >
                  - Money Out
                </button>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Description *</label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder={entryType === 'IN' ? 'e.g., University Grant' : 'e.g., Refreshments'}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  required
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Amount (RM) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.01"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono text-sm"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account</label>
                  <div className="grid grid-cols-2 gap-1 bg-slate-100 p-1 rounded-lg">
                    {(['Bank', 'Cash'] as AccountType[]).map((acct) => (
                      <button
                        key={acct}
                        type="button"
                        onClick={() => setEntryAccount(acct)}
                        className={`py-1.5 rounded font-bold cursor-pointer ${
                          entryAccount === acct ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-500'
                        }`}
                      >
                        {acct}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Activity</label>
                  <input
                    type="text"
                    list="ledger-activity-options"
                    value={activityInput}
                    onChange={(e) => setActivityInput(e.target.value)}
                    placeholder="Select or type activity..."
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 text-xs font-semibold"
                  />
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Receipt / Attachment (Optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-slate-800 file:text-white cursor-pointer"
                />
              </div>

              {errorMsg && <div className="text-xs text-rose-700 bg-rose-50 p-2 rounded-lg">{errorMsg}</div>}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingEntry}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {savingEntry && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== SIMPLE IMPORT MODAL (.XLSX / .CSV OR PASTE) ===================== */}
      {showImportModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden my-8">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Import Transactions</h3>
              <button
                type="button"
                onClick={() => setShowImportModal(false)}
                className="text-slate-400 hover:text-slate-700 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="p-5 space-y-4 text-xs">
              <div className="inline-flex p-1 rounded-lg bg-slate-100 border border-slate-200 gap-1">
                <button
                  type="button"
                  onClick={() => {
                    setImportTab('file');
                    setImportPreviewRows([]);
                  }}
                  className={`px-3 py-1.5 rounded-md font-bold cursor-pointer ${
                    importTab === 'file' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Upload .xlsx / .csv File
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setImportTab('paste');
                    setImportPreviewRows(parseTabularImportRows(parseDelimitedText(pasteText)));
                  }}
                  className={`px-3 py-1.5 rounded-md font-bold cursor-pointer ${
                    importTab === 'paste' ? 'bg-white text-slate-900 shadow-2xs' : 'text-slate-600'
                  }`}
                >
                  Paste from Excel / Sheets
                </button>
              </div>

              {importTab === 'file' ? (
                <label className="flex flex-col items-center justify-center gap-2 p-6 rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 hover:bg-slate-100/70 cursor-pointer text-center">
                  <Upload className="w-6 h-6 text-emerald-700" />
                  <div className="font-bold text-slate-800">
                    {importFileName || 'Choose an .xlsx or .csv file'}
                  </div>
                  <div className="text-[11px] text-slate-500">
                    Columns detected automatically: Date, Description, Activity, Money In, Money Out, Account
                  </div>
                  <input
                    type="file"
                    accept=".xlsx,.xls,.csv"
                    onChange={(e) => void handleImportFileChange(e.target.files?.[0] || null)}
                    className="hidden"
                  />
                </label>
              ) : (
                <div className="space-y-2">
                  <div className="text-[11px] text-slate-500">
                    Paste rows from Excel or Google Sheets (e.g.,{' '}
                    <span className="font-mono">Date | Description | Activity | In | Out</span>):
                  </div>
                  <textarea
                    rows={5}
                    value={pasteText}
                    onChange={(e) => {
                      const val = e.target.value;
                      setPasteText(val);
                      setImportPreviewRows(parseTabularImportRows(parseDelimitedText(val)));
                    }}
                    placeholder={'2026-11-20\tMineral Water\tChess Open\t\t24.50'}
                    className="w-full rounded-xl border border-slate-300 p-3 font-mono text-[11px]"
                  />
                </div>
              )}

              {importPreviewRows.length > 0 && (
                <div className="border border-slate-200 rounded-xl overflow-hidden max-h-52 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b border-slate-200 font-bold text-slate-600">
                        <th className="py-1.5 px-2.5">Date</th>
                        <th className="py-1.5 px-2.5">Description</th>
                        <th className="py-1.5 px-2.5">Activity</th>
                        <th className="py-1.5 px-2.5">Account</th>
                        <th className="py-1.5 px-2.5 text-right">In</th>
                        <th className="py-1.5 px-2.5 text-right">Out</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200">
                      {importPreviewRows.map((r, idx) => (
                        <tr key={idx}>
                          <td className="py-1.5 px-2.5 font-mono">{r.entry_date}</td>
                          <td className="py-1.5 px-2.5 font-semibold">{r.title}</td>
                          <td className="py-1.5 px-2.5 text-slate-600">{r.event_name}</td>
                          <td className="py-1.5 px-2.5">{r.account_type}</td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-emerald-700 font-bold">
                            {r.entry_type === 'IN' ? formatRM(r.amount) : '—'}
                          </td>
                          <td className="py-1.5 px-2.5 text-right font-mono text-rose-600 font-bold">
                            {r.entry_type === 'OUT' ? formatRM(r.amount) : '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowImportModal(false)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 hover:bg-slate-100 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={importing || importPreviewRows.length === 0}
                  onClick={() => void handleConfirmImport()}
                  className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-40 text-white font-bold cursor-pointer"
                >
                  {importing && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Import {importPreviewRows.length} Row(s)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== FEE QUICK EDIT MODAL ===================== */}
      {editingFeeItem && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-2xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200">
            <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-extrabold text-slate-900">Edit Fee — {editingFeeItem.student_name}</h3>
              <button type="button" onClick={() => setEditingFeeItem(null)} className="text-slate-400 cursor-pointer">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveFeeQuickEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">Amount Paid (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFeeAmount}
                  onChange={(e) => setEditFeeAmount(e.target.value)}
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 font-mono font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={editFeeStatus}
                    onChange={(e) => setEditFeeStatus(e.target.value as 'Verified' | 'Pending' | 'Rejected')}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-semibold"
                  >
                    <option value="Verified">Verified</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Account</label>
                  <select
                    value={editFeeAccount}
                    onChange={(e) => setEditFeeAccount(e.target.value as AccountType)}
                    className="w-full rounded-lg border border-slate-300 bg-white px-2.5 py-2 font-semibold"
                  >
                    <option value="Bank">Bank</option>
                    <option value="Cash">Cash</option>
                  </select>
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setEditingFeeItem(null)}
                  className="px-4 py-2 rounded-lg font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFeeEdit}
                  className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  {savingFeeEdit ? 'Saving...' : 'Save Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <datalist id="ledger-activity-options">
        {activityOptions.map((opt) => (
          <option key={opt} value={opt} />
        ))}
      </datalist>

      <RecordHistoryModal
        target={historyTarget}
        logs={logs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
