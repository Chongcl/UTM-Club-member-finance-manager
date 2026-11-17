'use client';

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  supabase,
  UserProfile,
  Budget,
  EventRsvp,
  Claim,
  ActivityFeePayment,
  ActivityLogEntry,
  MAX_FILE_SIZE_BYTES,
  exportMultiSheetExcel,
  logActivity,
} from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { parseItemizedBreakdownFromDescription } from '@/lib/duplicateClaimDetector';
import { waLink } from '@/lib/whatsapp';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import {
  Wallet,
  TrendingUp,
  TrendingDown,
  PlusCircle,
  Download,
  ExternalLink,
  X,
  CheckCircle2,
  Loader2,
  Edit3,
  Trash2,
  RefreshCw,
  FileSpreadsheet,
  History,
  Search,
  MessageCircle,
  Check,
  Copy,
} from 'lucide-react';

export interface LedgerEntryItem {
  id: string;
  entry_type: 'IN' | 'OUT';
  title: string;
  category: string;
  event_name?: string;
  amount: number;
  entry_date: string;
  person_in_charge: string;
  notes: string;
  attachment_url?: string;
  attachment_name?: string;
  created_at: string;
}

interface LedgerSectionProps {
  entries: LedgerEntryItem[];
  events?: { id: string; event_name: string }[];
  budgets?: Budget[];
  rsvps?: EventRsvp[];
  claims: Claim[];
  feePayments?: ActivityFeePayment[];
  logs?: ActivityLogEntry[];
  profile: UserProfile;
  canEdit?: boolean;
  externalOpenModal?: boolean;
  onCloseExternalModal?: () => void;
  onSelectClaim?: (claim: Claim) => void;
  onRefresh: (msg: string) => void;
}

type FinanceTabView = 'master' | 'activity_pnl' | 'tracker' | 'receivables' | 'planner';
type UnifiedSource = 'LEDGER' | 'CLAIM' | 'FEE';
type SortKey = 'date_desc' | 'date_asc' | 'amount_desc' | 'amount_asc' | 'activity_asc';

interface UnifiedFinanceRow {
  uid: string;
  recordId: string;
  source: UnifiedSource;
  date: string;
  createdAt: string;
  entryType: 'IN' | 'OUT';
  eventName: string;
  budgetId: string | null;
  category: string;
  title: string;
  person: string;
  matric: string;
  notes: string;
  amount: number;
  runningBalance: number;
  attachmentUrl?: string;
  rawLedger?: LedgerEntryItem;
  rawClaim?: Claim;
  rawFee?: ActivityFeePayment;
}

interface PlannerRow {
  id: string;
  budgetId: string; // 'ALL' or budget.id
  entryType: 'IN' | 'OUT';
  item: string;
  category: string;
  plannedAmount: string;
  notes: string;
}

interface ParsedPasteRow {
  entry_date: string;
  entry_type: 'IN' | 'OUT';
  event_name: string;
  category: string;
  title: string;
  amount: number;
  notes: string;
}

const IN_CATEGORIES = [
  'Carry-Forward / Opening Balance',
  'Club Savings / Reserve Adjustment',
  'University Grant / Allocation',
  'Sponsorship / Donation',
  'Activity / Tournament Income',
  'Other Income',
];

const OUT_CATEGORIES = [
  'Event / Activity Expense',
  'Equipment & Logistics',
  'Food & Refreshments',
  'Prizes & Certificates',
  'Transport / Carpool Allowance',
  'Club Savings / Reserve Adjustment',
  'Other Expense',
];

const ALL_CATEGORIES = Array.from(new Set([...IN_CATEGORIES, ...OUT_CATEGORIES]));

const PHYSICAL_CASH_STORAGE_KEY = 'clubsync_physical_cash_v1';
const PLANNER_STORAGE_KEY = 'clubsync_budget_planner_v1';

const ACTIVITY_PALETTE = [
  'bg-emerald-100 text-emerald-900 border-emerald-200',
  'bg-sky-100 text-sky-900 border-sky-200',
  'bg-indigo-100 text-indigo-900 border-indigo-200',
  'bg-amber-100 text-amber-950 border-amber-200',
  'bg-purple-100 text-purple-900 border-purple-200',
  'bg-teal-100 text-teal-900 border-teal-200',
  'bg-rose-100 text-rose-900 border-rose-200',
  'bg-cyan-100 text-cyan-900 border-cyan-200',
];

function isGeneralEventName(name?: string): boolean {
  const clean = (name || '').trim().toLowerCase();
  return (
    !clean ||
    clean === 'general' ||
    clean.includes('general club fund') ||
    clean.includes('carry-forward')
  );
}

function normalizeScopeName(name?: string): string {
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

function normalizePasteDate(raw: string): string {
  const s = raw.trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s;
  const dmy = /^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{2,4})$/.exec(s);
  if (dmy) {
    let y = parseInt(dmy[3], 10);
    if (y < 100) y += 2000;
    const m = String(parseInt(dmy[2], 10)).padStart(2, '0');
    const d = String(parseInt(dmy[1], 10)).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return new Date().toISOString().split('T')[0];
}

function parseSpreadsheetPaste(text: string): ParsedPasteRow[] {
  const lines = text
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const today = new Date().toISOString().split('T')[0];
  const parsed: ParsedPasteRow[] = [];

  for (const line of lines) {
    // Skip header row if user copied column headers from Excel/Sheets
    if (/^(date|tarikh)[\t,|]/i.test(line) && /amount|rm|title/i.test(line)) continue;

    const cols = line.includes('\t')
      ? line.split('\t').map((c) => c.trim())
      : line.includes('|')
      ? line.split('|').map((c) => c.trim())
      : line.split(',').map((c) => c.trim());

    if (cols.length < 2) continue;

    const parseAmt = (raw: string) => {
      const cleaned = raw.replace(/RM/gi, '').replace(/,/g, '').replace(/\s+/g, '');
      const val = parseFloat(cleaned);
      return isNaN(val) ? null : val;
    };

    if (cols.length >= 6) {
      const amt = parseAmt(cols[5]);
      if (amt === null || amt === 0) continue;
      const typeRaw = cols[1].toUpperCase();
      const entryType: 'IN' | 'OUT' =
        typeRaw.includes('OUT') || typeRaw.includes('EXP') || amt < 0 ? 'OUT' : 'IN';
      parsed.push({
        entry_date: normalizePasteDate(cols[0]),
        entry_type: entryType,
        event_name: cols[2] || 'General Club Fund',
        category: cols[3] || (entryType === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0]),
        title: cols[4] || 'Imported Row',
        amount: Math.abs(amt),
        notes: cols.slice(6).join(' '),
      });
    } else if (cols.length === 5) {
      const amt = parseAmt(cols[4]);
      if (amt === null || amt === 0) continue;
      const typeRaw = cols[1].toUpperCase();
      const entryType: 'IN' | 'OUT' =
        typeRaw.includes('OUT') || typeRaw.includes('EXP') || amt < 0 ? 'OUT' : 'IN';
      parsed.push({
        entry_date: normalizePasteDate(cols[0]),
        entry_type: entryType,
        event_name: 'General Club Fund',
        category: cols[3] || (entryType === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0]),
        title: cols[2] || 'Imported Row',
        amount: Math.abs(amt),
        notes: '',
      });
    } else if (cols.length === 3 || cols.length === 4) {
      const amt = parseAmt(cols[cols.length - 1]);
      if (amt === null || amt === 0) continue;
      const hasDate = /^\d{4}-\d{2}-\d{2}$|^\d{1,2}[\/\-]\d{1,2}[\/\-]\d{2,4}$/.test(cols[0]);
      const entryType: 'IN' | 'OUT' = amt < 0 ? 'OUT' : 'IN';
      parsed.push({
        entry_date: hasDate ? normalizePasteDate(cols[0]) : today,
        entry_type: entryType,
        event_name: cols.length === 4 ? cols[2] || 'General Club Fund' : 'General Club Fund',
        category: entryType === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0],
        title: hasDate ? cols[1] : cols[0],
        amount: Math.abs(amt),
        notes: '',
      });
    } else {
      const amt = parseAmt(cols[1]);
      if (amt === null || amt === 0) continue;
      const entryType: 'IN' | 'OUT' = amt < 0 ? 'OUT' : 'IN';
      parsed.push({
        entry_date: today,
        entry_type: entryType,
        event_name: 'General Club Fund',
        category: entryType === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0],
        title: cols[0],
        amount: Math.abs(amt),
        notes: '',
      });
    }
  }

  return parsed;
}

export default function LedgerSection({
  entries,
  events = [],
  budgets = [],
  rsvps = [],
  claims,
  feePayments = [],
  logs = [],
  profile,
  canEdit = true,
  externalOpenModal = false,
  onCloseExternalModal,
  onSelectClaim,
  onRefresh,
}: LedgerSectionProps) {
  const [activeView, setActiveView] = useState<FinanceTabView>('master');
  const [spreadsheetMode, setSpreadsheetMode] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  // Physical cash split (bank balance = currentSavingsBalance - physicalCash)
  const [physicalCash, setPhysicalCash] = useState<number>(0);
  const [physicalCashInput, setPhysicalCashInput] = useState<string>('0.00');

  // Master spreadsheet filters & sort
  const [filterEvent, setFilterEvent] = useState<string>('ALL');
  const [filterSource, setFilterSource] = useState<'ALL' | UnifiedSource>('ALL');
  const [filterType, setFilterType] = useState<'ALL' | 'IN' | 'OUT'>('ALL');
  const [dateFrom, setDateFrom] = useState<string>('');
  const [dateTo, setDateTo] = useState<string>('');
  const [sortBy, setSortBy] = useState<SortKey>('date_desc');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Quick-add row in Spreadsheet Mode
  const quickAddTitleRef = useRef<HTMLInputElement | null>(null);
  const [qaDate, setQaDate] = useState(new Date().toISOString().split('T')[0]);
  const [qaType, setQaType] = useState<'IN' | 'OUT'>('OUT');
  const [qaEvent, setQaEvent] = useState<string>('General Club Fund');
  const [qaCategory, setQaCategory] = useState<string>(OUT_CATEGORIES[0]);
  const [qaTitle, setQaTitle] = useState<string>('');
  const [qaAmount, setQaAmount] = useState<string>('');
  const [qaNotes, setQaNotes] = useState<string>('');
  const [qaSaving, setQaSaving] = useState(false);

  // Inline cell editing busy ID
  const [inlineSavingId, setInlineSavingId] = useState<string | null>(null);

  // Bulk Paste modal
  const [showPasteModal, setShowPasteModal] = useState(false);
  const [pasteText, setPasteText] = useState('');
  const [pasteSaving, setPasteSaving] = useState(false);

  // Activity P&L expansion state
  const [expandedActivityKey, setExpandedActivityKey] = useState<string | null>(null);

  // Unpaid fees state
  const [unpaidEventFilter, setUnpaidEventFilter] = useState<string>('ALL');
  const [markingPaidKey, setMarkingPaidKey] = useState<string | null>(null);

  // Budget Planner state
  const [plannerBudgetId, setPlannerBudgetId] = useState<string>(budgets[0]?.id || 'ALL');
  const [plannerRows, setPlannerRows] = useState<PlannerRow[]>([]);
  const [newPlanType, setNewPlanType] = useState<'IN' | 'OUT'>('OUT');
  const [newPlanItem, setNewPlanItem] = useState('');
  const [newPlanCategory, setNewPlanCategory] = useState(OUT_CATEGORIES[0]);
  const [newPlanAmount, setNewPlanAmount] = useState('');
  const [newPlanNotes, setNewPlanNotes] = useState('');

  // Tracker scope filter + fee edit modal
  const [trackerEventId, setTrackerEventId] = useState<string>('ALL');
  const [editingFeeItem, setEditingFeeItem] = useState<ActivityFeePayment | null>(null);
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editFeeStatus, setEditFeeStatus] = useState<'Verified' | 'Pending' | 'Rejected'>('Verified');
  const [savingFeeEdit, setSavingFeeEdit] = useState(false);

  // Standard Add / Edit / Set Savings modal
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'IN' | 'OUT' | 'SET_SAVINGS'>('IN');
  const [editingEntry, setEditingEntry] = useState<LedgerEntryItem | null>(null);
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('IN');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(IN_CATEGORIES[0]);
  const [selectedEventOption, setSelectedEventOption] = useState<string>('GENERAL');
  const [customEventName, setCustomEventName] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const savedCash = parseFloat(localStorage.getItem(PHYSICAL_CASH_STORAGE_KEY) || '0');
    if (!isNaN(savedCash) && savedCash >= 0) {
      setPhysicalCash(savedCash);
      setPhysicalCashInput(savedCash.toFixed(2));
    }
    const rawPlanner = localStorage.getItem(PLANNER_STORAGE_KEY);
    if (rawPlanner) {
      try {
        const parsed = JSON.parse(rawPlanner);
        if (Array.isArray(parsed)) setPlannerRows(parsed as PlannerRow[]);
      } catch {
        /* ignore */
      }
    }
  }, []);

  const persistPlannerRows = (next: PlannerRow[]) => {
    setPlannerRows(next);
    if (typeof window !== 'undefined') {
      localStorage.setItem(PLANNER_STORAGE_KEY, JSON.stringify(next));
    }
  };

  // --- Exact Unified KPI Totals (matches Master Spreadsheet rows 1:1) ---
  const verifiedFeesList = useMemo(
    () => feePayments.filter((f) => f.status === 'Verified'),
    [feePayments]
  );
  const pendingFeesTotal = useMemo(
    () =>
      feePayments
        .filter((f) => f.status === 'Pending')
        .reduce((s, f) => s + Number(f.amount_paid), 0),
    [feePayments]
  );
  const approvedClaimsList = useMemo(
    () => claims.filter((c) => c.status === 'Approved'),
    [claims]
  );

  const manualIn = useMemo(
    () => entries.filter((e) => e.entry_type === 'IN').reduce((s, e) => s + Number(e.amount), 0),
    [entries]
  );
  const verifiedFeesIn = useMemo(
    () => verifiedFeesList.reduce((s, f) => s + Number(f.amount_paid), 0),
    [verifiedFeesList]
  );
  const totalIn = manualIn + verifiedFeesIn;

  const manualOut = useMemo(
    () => entries.filter((e) => e.entry_type === 'OUT').reduce((s, e) => s + Number(e.amount), 0),
    [entries]
  );
  const approvedClaimsOut = useMemo(
    () => approvedClaimsList.reduce((s, c) => s + Number(c.amount), 0),
    [approvedClaimsList]
  );
  const totalOut = manualOut + approvedClaimsOut;
  const currentSavingsBalance = totalIn - totalOut;
  const bankBalance = currentSavingsBalance - physicalCash;

  // --- Build Unified Master Rows + Running Balance (Baki) ---
  const unifiedRows = useMemo<UnifiedFinanceRow[]>(() => {
    const raw: Omit<UnifiedFinanceRow, 'runningBalance'>[] = [];

    for (const e of entries) {
      const evName = normalizeScopeName(e.event_name);
      const matchedBudget = budgets.find((b) => b.event_name === evName);
      raw.push({
        uid: `ledger-${e.id}`,
        recordId: e.id,
        source: 'LEDGER',
        date: e.entry_date || e.created_at?.split('T')[0] || '',
        createdAt: e.created_at || e.entry_date || '',
        entryType: e.entry_type,
        eventName: evName,
        budgetId: matchedBudget?.id || null,
        category: e.category || 'General',
        title: e.title,
        person: e.person_in_charge || '-',
        matric: '',
        notes: e.notes || '',
        amount: Number(e.amount) || 0,
        attachmentUrl: e.attachment_url,
        rawLedger: e,
      });
    }

    for (const c of approvedClaimsList) {
      const matchedBudget = budgets.find((b) => b.id === c.budget_id);
      const evName = normalizeScopeName(matchedBudget?.event_name || c.custom_event_name);
      const parsedDesc = parseItemizedBreakdownFromDescription(c.description);
      const itemSummary =
        parsedDesc.items.length > 0
          ? parsedDesc.items.map((it) => `${it.shop} (RM ${it.amount.toFixed(2)})`).join(', ')
          : c.merchant_name;
      raw.push({
        uid: `claim-${c.id}`,
        recordId: c.id,
        source: 'CLAIM',
        date: c.expense_date || c.created_at?.split('T')[0] || '',
        createdAt: c.created_at || c.expense_date || '',
        entryType: 'OUT',
        eventName: evName,
        budgetId: c.budget_id,
        category: c.category || 'Claim',
        title: c.title,
        person: c.claimant_name,
        matric: c.matric_no,
        notes: itemSummary || '',
        amount: Number(c.amount) || 0,
        attachmentUrl: c.payout_proof_url || c.receipt_url,
        rawClaim: c,
      });
    }

    for (const f of verifiedFeesList) {
      const matchedBudget = budgets.find((b) => b.id === f.budget_id);
      const evName = normalizeScopeName(matchedBudget?.event_name || 'Activity Fee');
      raw.push({
        uid: `fee-${f.id}`,
        recordId: f.id,
        source: 'FEE',
        date: f.created_at?.split('T')[0] || '',
        createdAt: f.created_at || '',
        entryType: 'IN',
        eventName: evName,
        budgetId: f.budget_id,
        category: 'Activity Fee',
        title: `Activity Fee — ${f.student_name}`,
        person: f.student_name,
        matric: f.matric_no,
        notes: matchedBudget?.event_name || '',
        amount: Number(f.amount_paid) || 0,
        attachmentUrl: f.receipt_url,
        rawFee: f,
      });
    }

    // Chronological oldest -> newest so running balance (Baki) matches true sequence
    raw.sort((a, b) => {
      const dc = (a.date || '').localeCompare(b.date || '');
      if (dc !== 0) return dc;
      return (a.createdAt || '').localeCompare(b.createdAt || '');
    });

    let running = 0;
    return raw.map((row) => {
      running += row.entryType === 'IN' ? row.amount : -row.amount;
      return { ...row, runningBalance: running };
    });
  }, [entries, approvedClaimsList, verifiedFeesList, budgets]);

  // Distinct activity options present across budgets + unifiedRows
  const activityOptions = useMemo(() => {
    const names = new Set<string>(['General Club Fund']);
    budgets.forEach((b) => names.add(b.event_name));
    unifiedRows.forEach((r) => names.add(r.eventName));
    return Array.from(names);
  }, [budgets, unifiedRows]);

  // Filtered + sorted rows for Master Spreadsheet
  const displayedRows = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const list = unifiedRows.filter((row) => {
      if (filterEvent === 'GENERAL' && !isGeneralEventName(row.eventName)) return false;
      if (filterEvent !== 'ALL' && filterEvent !== 'GENERAL' && row.eventName !== filterEvent) {
        return false;
      }
      if (filterSource !== 'ALL' && row.source !== filterSource) return false;
      if (filterType !== 'ALL' && row.entryType !== filterType) return false;
      if (dateFrom && row.date < dateFrom) return false;
      if (dateTo && row.date > dateTo) return false;
      if (q) {
        const hay = `${row.title} ${row.person} ${row.matric} ${row.category} ${row.eventName} ${row.notes}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });

    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'date_asc': {
          const d = a.date.localeCompare(b.date);
          return d !== 0 ? d : a.createdAt.localeCompare(b.createdAt);
        }
        case 'amount_desc':
          return b.amount - a.amount;
        case 'amount_asc':
          return a.amount - b.amount;
        case 'activity_asc': {
          const ac = a.eventName.localeCompare(b.eventName);
          return ac !== 0 ? ac : b.date.localeCompare(a.date);
        }
        case 'date_desc':
        default: {
          const d = b.date.localeCompare(a.date);
          return d !== 0 ? d : b.createdAt.localeCompare(a.createdAt);
        }
      }
    });
    return sorted;
  }, [unifiedRows, filterEvent, filterSource, filterType, dateFrom, dateTo, sortBy, searchQuery]);

  const filteredSummary = useMemo(() => {
    let fIn = 0;
    let fOut = 0;
    for (const r of displayedRows) {
      if (r.entryType === 'IN') fIn += r.amount;
      else fOut += r.amount;
    }
    return { inTotal: fIn, outTotal: fOut, net: fIn - fOut };
  }, [displayedRows]);

  // --- Unpaid Fees (Receivables) cross-reference ---
  const unpaidReceivables = useMemo(() => {
    const out: {
      key: string;
      budget: Budget;
      rsvp: EventRsvp;
      feeDue: number;
    }[] = [];

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
          out.push({
            key: `${b.id}:${r.user_id || r.matric_no}`,
            budget: b,
            rsvp: r,
            feeDue: regFee,
          });
        }
      }
    }
    return out;
  }, [budgets, rsvps, feePayments, unpaidEventFilter]);

  useEffect(() => {
    if (externalOpenModal && canEdit) {
      openAddModal('IN');
      if (onCloseExternalModal) onCloseExternalModal();
    }
  }, [externalOpenModal, canEdit, onCloseExternalModal]);

  const openAddModal = (mode: 'IN' | 'OUT' | 'SET_SAVINGS' = 'IN') => {
    setEditingEntry(null);
    setModalMode(mode);
    if (mode === 'SET_SAVINGS') {
      setEntryType('IN');
      setTitle('Carry-Forward / Current Savings Balance Update');
      setCategory('Carry-Forward / Opening Balance');
      setSelectedEventOption('GENERAL');
      setCustomEventName('');
      setAmount(currentSavingsBalance.toFixed(2));
      setPhysicalCashInput(physicalCash.toFixed(2));
      setNotes('Carry-forward club savings across batches');
    } else if (mode === 'OUT') {
      setEntryType('OUT');
      setTitle('');
      setCategory(OUT_CATEGORIES[0]);
      setSelectedEventOption('GENERAL');
      setCustomEventName('');
      setAmount('');
      setNotes('');
    } else {
      setEntryType('IN');
      setTitle('');
      setCategory(IN_CATEGORIES[0]);
      setSelectedEventOption('GENERAL');
      setCustomEventName('');
      setAmount('');
      setNotes('');
    }
    setEntryDate(new Date().toISOString().split('T')[0]);
    setAttachmentFile(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (entry: LedgerEntryItem) => {
    setEditingEntry(entry);
    setModalMode(entry.entry_type);
    setEntryType(entry.entry_type);
    setTitle(entry.title);
    setCategory(entry.category);
    const matchingEv = events.find((ev) => ev.event_name === entry.event_name);
    if (isGeneralEventName(entry.event_name)) {
      setSelectedEventOption('GENERAL');
      setCustomEventName('');
    } else if (matchingEv) {
      setSelectedEventOption(matchingEv.event_name);
      setCustomEventName('');
    } else {
      setSelectedEventOption('OTHER');
      setCustomEventName(entry.event_name || 'General Club Fund');
    }
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
    const corePayload = {
      entry_type: fullPayload.entry_type,
      title: fullPayload.title,
      category: fullPayload.category,
      amount: fullPayload.amount,
      entry_date: fullPayload.entry_date,
      person_in_charge: fullPayload.person_in_charge,
      notes: fullPayload.notes,
    };
    if (editId) {
      const { error } = await supabase.from('ledger_entries').update(fullPayload).eq('id', editId);
      if (error) {
        const { error: fallbackErr } = await supabase
          .from('ledger_entries')
          .update(corePayload)
          .eq('id', editId);
        if (fallbackErr) throw fallbackErr;
      }
    } else {
      const { error } = await supabase.from('ledger_entries').insert(fullPayload);
      if (error) {
        const { error: fallbackErr } = await supabase.from('ledger_entries').insert(corePayload);
        if (fallbackErr) throw fallbackErr;
      }
    }
  };

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg(null);
    const num = parseFloat(amount);
    if (isNaN(num) || (modalMode !== 'SET_SAVINGS' && num <= 0)) {
      setErrorMsg('Please enter a valid amount.');
      return;
    }

    setSaving(true);
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

      if (modalMode === 'SET_SAVINGS' && !editingEntry) {
        const nextCash = Math.max(0, parseFloat(physicalCashInput) || 0);
        setPhysicalCash(nextCash);
        if (typeof window !== 'undefined') {
          localStorage.setItem(PHYSICAL_CASH_STORAGE_KEY, nextCash.toFixed(2));
        }

        const diff = Number((num - currentSavingsBalance).toFixed(2));
        if (Math.abs(diff) < 0.01) {
          setShowModal(false);
          onRefresh(`Saved Cash/Bank split (Total Savings: RM ${num.toFixed(2)}).`);
          return;
        }
        const adjType: 'IN' | 'OUT' = diff > 0 ? 'IN' : 'OUT';
        const adjAmount = Math.abs(diff);
        const payload = {
          entry_type: adjType,
          title: title.trim() || `Carry-Forward Savings Update (Target RM ${num.toFixed(2)})`,
          category: 'Carry-Forward / Opening Balance',
          event_name: 'General Club Fund',
          amount: adjAmount,
          entry_date: entryDate,
          person_in_charge: `${profile.full_name} (${profile.matric_no})`,
          notes:
            notes.trim() ||
            `Adjusted savings from RM ${currentSavingsBalance.toFixed(2)} to RM ${num.toFixed(2)}`,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
        await saveLedgerPayloadWithFallback(payload);
        void logActivity(
          profile,
          'Finance',
          'Updated Club Savings',
          `${profile.full_name} (${profile.matric_no}) updated Club Savings from RM ${currentSavingsBalance.toFixed(2)} to RM ${num.toFixed(2)}`
        );
        setShowModal(false);
        onRefresh(`Updated Current Club Savings to RM ${num.toFixed(2)}!`);
        return;
      }

      if (!title.trim()) {
        setErrorMsg('Please enter a title.');
        return;
      }

      const finalEventName =
        selectedEventOption === 'GENERAL'
          ? 'General Club Fund'
          : selectedEventOption === 'OTHER'
          ? customEventName.trim() || 'Other Event'
          : selectedEventOption;

      const payload = {
        entry_type: entryType,
        title: title.trim(),
        category,
        event_name: finalEventName,
        amount: num,
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
          { field: 'Category', before: editingEntry.category, after: payload.category },
          { field: 'Event / Scope', before: editingEntry.event_name || '', after: payload.event_name },
          { field: 'Amount (RM)', before: Number(editingEntry.amount).toFixed(2), after: num.toFixed(2) },
          { field: 'Date', before: editingEntry.entry_date, after: payload.entry_date },
          { field: 'Notes', before: editingEntry.notes || '', after: payload.notes },
        ]);
        void recordEditHistory({
          actor: profile,
          category: 'Finance',
          table: 'ledger_entries',
          recordId: editingEntry.id,
          recordTitle: payload.title,
          changes,
        });
        onRefresh(`Updated "${title.trim()}"!`);
      } else {
        await saveLedgerPayloadWithFallback(payload);
        void logActivity(
          profile,
          'Finance',
          entryType === 'IN' ? 'Added Money In' : 'Recorded Expense Out',
          `${profile.full_name} (${profile.matric_no}) recorded ${
            entryType === 'IN' ? 'Money In' : 'Expense Out'
          } "${title.trim()}" of RM ${num.toFixed(2)} (${finalEventName})`
        );
        onRefresh(
          `${entryType === 'IN' ? 'Added Money In' : 'Recorded Expense Out'}: RM ${num.toFixed(2)}!`
        );
      }
      setShowModal(false);
    } catch (err: unknown) {
      setErrorMsg(err instanceof Error ? err.message : 'Failed to save.');
    } finally {
      setSaving(false);
    }
  };

  // --- Quick-Add Inline Row Save ---
  const handleQuickAddSave = async () => {
    if (!canEdit || qaSaving) return;
    const num = parseFloat(qaAmount);
    if (!qaTitle.trim() || isNaN(num) || num <= 0) return;
    setQaSaving(true);
    try {
      const payload = {
        entry_type: qaType,
        title: qaTitle.trim(),
        category: qaCategory,
        event_name: qaEvent || 'General Club Fund',
        amount: num,
        entry_date: qaDate || new Date().toISOString().split('T')[0],
        person_in_charge: `${profile.full_name} (${profile.matric_no})`,
        notes: qaNotes.trim(),
      };
      await saveLedgerPayloadWithFallback(payload);
      void logActivity(
        profile,
        'Finance',
        qaType === 'IN' ? 'Quick-added Money In' : 'Quick-added Expense Out',
        `${profile.full_name} (${profile.matric_no}) added "${payload.title}" (${qaType} RM ${num.toFixed(2)} · ${payload.event_name})`
      );
      setQaTitle('');
      setQaAmount('');
      setQaNotes('');
      onRefresh(`Added "${payload.title}" (RM ${num.toFixed(2)})`);
    } finally {
      setQaSaving(false);
    }
  };

  // --- Inline Cell Patch in Spreadsheet Mode ---
  const handleInlineLedgerPatch = async (
    entry: LedgerEntryItem,
    patch: Partial<{
      entry_date: string;
      entry_type: 'IN' | 'OUT';
      event_name: string;
      category: string;
      title: string;
      amount: number;
      notes: string;
    }>
  ) => {
    if (!canEdit) return;
    const next = {
      entry_date: patch.entry_date ?? entry.entry_date,
      entry_type: patch.entry_type ?? entry.entry_type,
      event_name: patch.event_name ?? normalizeScopeName(entry.event_name),
      category: patch.category ?? entry.category,
      title: (patch.title ?? entry.title).trim() || entry.title,
      amount: patch.amount ?? Number(entry.amount),
      notes: patch.notes ?? entry.notes ?? '',
    };

    const changes = computeFieldChanges([
      { field: 'Date', before: entry.entry_date, after: next.entry_date },
      { field: 'Type', before: entry.entry_type, after: next.entry_type },
      { field: 'Activity', before: normalizeScopeName(entry.event_name), after: next.event_name },
      { field: 'Category', before: entry.category, after: next.category },
      { field: 'Title', before: entry.title, after: next.title },
      { field: 'Amount (RM)', before: Number(entry.amount).toFixed(2), after: Number(next.amount).toFixed(2) },
      { field: 'Notes', before: entry.notes || '', after: next.notes },
    ]);
    if (changes.length === 0) return;

    setInlineSavingId(entry.id);
    try {
      await saveLedgerPayloadWithFallback(
        {
          ...next,
          person_in_charge: entry.person_in_charge || `${profile.full_name} (${profile.matric_no})`,
        },
        entry.id
      );
      void recordEditHistory({
        actor: profile,
        category: 'Finance',
        table: 'ledger_entries',
        recordId: entry.id,
        recordTitle: next.title,
        changes,
      });
      onRefresh(`Saved cell edit on "${next.title}"`);
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleInlineFeePatch = async (fee: ActivityFeePayment, nextAmount: number) => {
    if (!canEdit || isNaN(nextAmount) || nextAmount <= 0) return;
    if (Math.abs(nextAmount - Number(fee.amount_paid)) < 0.005) return;
    setInlineSavingId(fee.id);
    try {
      await supabase
        .from('activity_fee_payments')
        .update({ amount_paid: nextAmount })
        .eq('id', fee.id);
      void recordEditHistory({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: fee.id,
        recordTitle: `${fee.student_name} fee`,
        changes: computeFieldChanges([
          {
            field: 'Amount Paid (RM)',
            before: Number(fee.amount_paid).toFixed(2),
            after: nextAmount.toFixed(2),
          },
        ]),
      });
      onRefresh(`Updated fee amount for ${fee.student_name}`);
    } finally {
      setInlineSavingId(null);
    }
  };

  const handleBulkPasteImport = async () => {
    if (!canEdit) return;
    const rowsToImport = parseSpreadsheetPaste(pasteText);
    if (rowsToImport.length === 0) return;
    setPasteSaving(true);
    try {
      const pic = `${profile.full_name} (${profile.matric_no})`;
      for (const r of rowsToImport) {
        await saveLedgerPayloadWithFallback({
          entry_type: r.entry_type,
          title: r.title,
          category: r.category,
          event_name: r.event_name,
          amount: r.amount,
          entry_date: r.entry_date,
          person_in_charge: pic,
          notes: r.notes,
        });
      }
      void logActivity(
        profile,
        'Finance',
        'Bulk imported ledger rows',
        `${profile.full_name} (${profile.matric_no}) pasted ${rowsToImport.length} rows into the Club Finance Spreadsheet.`
      );
      setPasteText('');
      setShowPasteModal(false);
      onRefresh(`Imported ${rowsToImport.length} rows from Excel / Google Sheets!`);
    } finally {
      setPasteSaving(false);
    }
  };

  const handleDeleteRow = async (row: UnifiedFinanceRow) => {
    if (!canEdit) return;
    if (row.source === 'LEDGER') {
      await softDeleteRecord({
        actor: profile,
        category: 'Finance',
        table: 'ledger_entries',
        recordId: row.recordId,
        recordTitle: row.title,
        extraSummary: `${row.entryType} RM ${row.amount.toFixed(2)}`,
      });
      onRefresh(`Removed "${row.title}" from web view (kept in Supabase).`);
    } else if (row.source === 'FEE') {
      await softDeleteRecord({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: row.recordId,
        recordTitle: row.title,
        extraSummary: `RM ${row.amount.toFixed(2)}`,
      });
      onRefresh(`Removed fee record from web view (kept in Supabase).`);
    } else if (row.source === 'CLAIM') {
      await softDeleteRecord({
        actor: profile,
        category: 'Claims',
        table: 'claims',
        recordId: row.recordId,
        recordTitle: row.title,
        extraSummary: `RM ${row.amount.toFixed(2)}`,
      });
      onRefresh(`Removed claim from web view (kept in Supabase).`);
    }
  };

  const handleSaveFeeQuickEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFeeItem || !canEdit) return;
    const nextAmt = parseFloat(editFeeAmount);
    if (isNaN(nextAmt) || nextAmt <= 0) return;
    setSavingFeeEdit(true);
    try {
      await supabase
        .from('activity_fee_payments')
        .update({ amount_paid: nextAmt, status: editFeeStatus })
        .eq('id', editingFeeItem.id);
      const changes = computeFieldChanges([
        { field: 'Amount Paid (RM)', before: Number(editingFeeItem.amount_paid).toFixed(2), after: nextAmt.toFixed(2) },
        { field: 'Status', before: editingFeeItem.status, after: editFeeStatus },
      ]);
      void recordEditHistory({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: editingFeeItem.id,
        recordTitle: `${editingFeeItem.student_name} fee`,
        changes,
      });
      setEditingFeeItem(null);
      onRefresh(`Updated fee record for ${editingFeeItem.student_name}!`);
    } finally {
      setSavingFeeEdit(false);
    }
  };

  const handleMarkUnpaidAsPaid = async (item: { budget: Budget; rsvp: EventRsvp; feeDue: number }) => {
    if (!canEdit) return;
    const key = `${item.budget.id}:${item.rsvp.user_id || item.rsvp.matric_no}`;
    setMarkingPaidKey(key);
    try {
      const payload = {
        budget_id: item.budget.id,
        user_id: item.rsvp.user_id,
        student_name: item.rsvp.student_name,
        matric_no: item.rsvp.matric_no,
        phone_number: item.rsvp.phone_number || '',
        amount_paid: item.feeDue,
        receipt_url: '',
        receipt_file_name: 'Marked Paid (Finance Desk)',
        status: 'Verified',
      };
      const { error } = await supabase.from('activity_fee_payments').insert(payload);
      if (error) throw error;
      void logActivity(
        profile,
        'Fees',
        'Fee marked paid',
        `${profile.full_name} (${profile.matric_no}) marked RM ${item.feeDue.toFixed(2)} paid for ${item.rsvp.student_name} (${item.rsvp.matric_no}) in ${item.budget.event_name}`
      );
      onRefresh(`Marked ${item.rsvp.student_name} as Paid (RM ${item.feeDue.toFixed(2)})!`);
    } catch (err: unknown) {
      onRefresh(err instanceof Error ? err.message : 'Failed to mark fee as paid.');
    } finally {
      setMarkingPaidKey(null);
    }
  };

  // --- Filtered Tracker Lists ---
  const selectedBudget = budgets.find((b) => b.id === trackerEventId);
  const filteredFeePayments =
    trackerEventId === 'ALL'
      ? feePayments
      : feePayments.filter((f) => f.budget_id === trackerEventId);
  const filteredClaims =
    trackerEventId === 'ALL' ? claims : claims.filter((c) => c.budget_id === trackerEventId);
  const filteredRsvps =
    trackerEventId === 'ALL' ? rsvps : rsvps.filter((r) => r.budget_id === trackerEventId);
  const filteredLedger =
    trackerEventId === 'ALL'
      ? entries
      : entries.filter((e) => e.event_name === selectedBudget?.event_name);

  // --- Export Current Filtered View (.csv) ---
  const handleExportFilteredCsv = () => {
    const headers = [
      'Date',
      'Source',
      'Type',
      'Activity',
      'Category',
      'Title',
      'Person / Claimant',
      'Notes',
      'Money In (RM)',
      'Money Out (RM)',
      'Running Balance (RM)',
    ];
    const rows = displayedRows.map((r) => [
      r.date,
      r.source,
      r.entryType,
      r.eventName,
      r.category,
      r.title,
      r.matric ? `${r.person} (${r.matric})` : r.person,
      r.notes,
      r.entryType === 'IN' ? r.amount.toFixed(2) : '',
      r.entryType === 'OUT' ? r.amount.toFixed(2) : '',
      r.runningBalance.toFixed(2),
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((val) => `"${String(val ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = `ClubSync_Finance_Filtered_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    onRefresh(`Exported ${displayedRows.length} rows to CSV.`);
  };

  // --- Export 6-Sheet Multi-Sheet Excel (.xlsx) ---
  const exportWorkbookForScope = async (scopeBudget?: Budget | null) => {
    const scopeTitle = scopeBudget ? scopeBudget.event_name : 'All_Club_Activities';
    const scFees = scopeBudget
      ? feePayments.filter((f) => f.budget_id === scopeBudget.id)
      : filteredFeePayments;
    const scClaims = scopeBudget ? claims.filter((c) => c.budget_id === scopeBudget.id) : filteredClaims;
    const scRsvps = scopeBudget ? rsvps.filter((r) => r.budget_id === scopeBudget.id) : filteredRsvps;
    const scLedger = scopeBudget
      ? entries.filter((e) => e.event_name === scopeBudget.event_name)
      : filteredLedger;

    const feesTotal = scFees
      .filter((f) => f.status === 'Verified')
      .reduce((s, f) => s + Number(f.amount_paid), 0);
    const approvedClaims = scClaims.filter((c) => c.status === 'Approved');
    const reimbursedTotal = approvedClaims.reduce((s, c) => s + Number(c.amount), 0);

    await exportMultiSheetExcel(`${scopeTitle}_Finance_Report`, [
      {
        name: '1_Summary',
        headers: ['Metric', 'Value'],
        rows: [
          ['Report Scope', scopeBudget ? scopeBudget.event_name : 'All Club Activities (Carry-Forward)'],
          [
            'Event Date & Location',
            scopeBudget ? `${scopeBudget.event_date} @ ${scopeBudget.location}` : 'All Batches',
          ],
          ['Verified Fee Payments Received (RM)', feesTotal.toFixed(2)],
          ['Approved Reimbursements Paid (RM)', reimbursedTotal.toFixed(2)],
          ['Pending Claims Count', scClaims.filter((c) => c.status === 'Pending').length],
          ['Current Club Savings Balance (RM)', currentSavingsBalance.toFixed(2)],
          ['Total Attending RSVPs', scRsvps.filter((r) => r.attendance === 'Attending').length],
        ],
      },
      {
        name: '2_Fee_Received',
        headers: ['Date', 'Activity', 'Student Name', 'Matric No', 'Phone', 'Amount Paid (RM)', 'Status', 'Receipt URL'],
        rows: scFees.map((f) => [
          f.created_at?.split('T')[0] || '',
          budgets.find((b) => b.id === f.budget_id)?.event_name || 'Activity',
          f.student_name,
          f.matric_no,
          f.phone_number,
          Number(f.amount_paid).toFixed(2),
          f.status,
          f.receipt_url,
        ]),
      },
      {
        name: '3_Reimbursements_Paid',
        headers: ['Expense Date', 'Activity', 'Claimant', 'Matric No', 'Phone', 'Title', 'Amount (RM)', 'Bank / DuitNow Details', 'Reviewed By', 'Claim Receipt URL', 'Proof of Paid URL'],
        rows: approvedClaims.map((c) => [
          c.expense_date,
          budgets.find((b) => b.id === c.budget_id)?.event_name || 'General Club Fund',
          c.claimant_name,
          c.matric_no,
          c.phone_number,
          c.title,
          Number(c.amount).toFixed(2),
          c.payment_info || (c.description?.includes('Reimburse To:') ? c.description.split('Reimburse To:')[1]?.trim() : '-'),
          c.reviewed_by || '-',
          c.receipt_url,
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '4_All_Claims',
        headers: ['Expense Date', 'Activity', 'Claimant', 'Matric No', 'Title', 'Category', 'Merchant', 'Amount (RM)', 'Status', 'Bank / DuitNow Info', 'Claim Receipt URL', 'Proof of Paid URL'],
        rows: scClaims.map((c) => [
          c.expense_date,
          budgets.find((b) => b.id === c.budget_id)?.event_name || 'General Club Fund',
          c.claimant_name,
          c.matric_no,
          c.title,
          c.category,
          c.merchant_name,
          Number(c.amount).toFixed(2),
          c.status,
          c.payment_info || '-',
          c.receipt_url,
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '5_Ledger_Records',
        headers: ['Date', 'Type', 'Scope / Event', 'Title', 'Category', 'Amount (RM)', 'Recorded By', 'Notes', 'Proof URL'],
        rows: scLedger.map((e) => [
          e.entry_date,
          e.entry_type === 'IN' ? 'MONEY IN' : 'EXPENSE OUT',
          e.event_name || 'General Club Fund',
          e.title,
          e.category,
          Number(e.amount).toFixed(2),
          e.person_in_charge,
          e.notes || '-',
          e.attachment_url || '-',
        ]),
      },
      {
        name: '6_Attendance_Carpool',
        headers: ['Activity', 'Student Name', 'Matric No', 'Phone', 'RSVP', 'QR Checked-In', 'Transport', 'Dorm', 'Assigned Driver'],
        rows: scRsvps.map((r) => [
          budgets.find((b) => b.id === r.budget_id)?.event_name || 'Activity',
          r.student_name,
          r.matric_no,
          r.phone_number,
          r.attendance,
          r.qr_checked_in ? 'Yes' : 'No',
          r.is_driver ? `Driver (${r.car_details})` : r.transport_type,
          r.dormitory || '-',
          r.assigned_driver_name || '-',
        ]),
      },
    ]);
    onRefresh(`Generated 6-Sheet Excel Report for ${scopeBudget ? scopeBudget.event_name : 'All Activities'}!`);
  };

  // --- By Activity (Event P&L) Breakdown ---
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
      const feesIn = rows.filter((r) => r.source === 'FEE').reduce((s, r) => s + r.amount, 0);
      const manIn = rows
        .filter((r) => r.source === 'LEDGER' && r.entryType === 'IN')
        .reduce((s, r) => s + r.amount, 0);
      const claimsOut = rows.filter((r) => r.source === 'CLAIM').reduce((s, r) => s + r.amount, 0);
      const manOut = rows
        .filter((r) => r.source === 'LEDGER' && r.entryType === 'OUT')
        .reduce((s, r) => s + r.amount, 0);
      const pendingClaimsAmt = claims
        .filter((c) => c.status === 'Pending' && (budget ? c.budget_id === budget.id : !c.budget_id))
        .reduce((s, c) => s + Number(c.amount), 0);

      return {
        key,
        title: titleLabel,
        subtitle: subLabel,
        budget,
        feesIn,
        manualIn: manIn,
        claimsOut,
        manualOut: manOut,
        pendingClaimsAmt,
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
        computeCard(`CUSTOM_${customName}`, customName, 'Custom Activity / Scope', undefined, (r) => r.eventName === customName)
      );
    }
    cards.push(
      computeCard('GENERAL_FUND', 'General Club Fund', 'Carry-forward reserves & non-event expenses')
    );
    return cards;
  }, [budgets, unifiedRows, claims]);

  // --- Budget Planner filtered lines & actuals comparison ---
  const scopedPlannerRows = useMemo(
    () => plannerRows.filter((p) => plannerBudgetId === 'ALL' || p.budgetId === plannerBudgetId),
    [plannerRows, plannerBudgetId]
  );

  const plannerTotals = useMemo(() => {
    const plannedIn = scopedPlannerRows
      .filter((r) => r.entryType === 'IN')
      .reduce((s, r) => s + (parseFloat(r.plannedAmount) || 0), 0);
    const plannedOut = scopedPlannerRows
      .filter((r) => r.entryType === 'OUT')
      .reduce((s, r) => s + (parseFloat(r.plannedAmount) || 0), 0);

    const actualRows = unifiedRows.filter((r) =>
      plannerBudgetId === 'ALL' ? true : r.budgetId === plannerBudgetId || (plannerBudgetId === 'GENERAL' && isGeneralEventName(r.eventName))
    );
    const actualIn = actualRows.filter((r) => r.entryType === 'IN').reduce((s, r) => s + r.amount, 0);
    const actualOut = actualRows.filter((r) => r.entryType === 'OUT').reduce((s, r) => s + r.amount, 0);
    return { plannedIn, plannedOut, actualIn, actualOut };
  }, [scopedPlannerRows, unifiedRows, plannerBudgetId]);

  const parsedPastePreview = useMemo(() => parseSpreadsheetPaste(pasteText), [pasteText]);
  const activeCategoryList = entryType === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES;

  return (
    <div className="space-y-4">
      {/* 1. Clean & Compact Top KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-800 text-white rounded-3xl p-5 shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-emerald-200">
              Current Club Savings
            </span>
            <Wallet className="w-5 h-5 text-emerald-300" />
          </div>
          <p className="text-2xl font-extrabold mt-2">RM {currentSavingsBalance.toFixed(2)}</p>
          <p className="text-[11px] text-emerald-100 mt-1.5 font-medium">
            Bank / DuitNow: <strong>RM {bankBalance.toFixed(2)}</strong> • Cash:{' '}
            <strong>RM {physicalCash.toFixed(2)}</strong>
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Total Money In</span>
            <TrendingUp className="w-5 h-5 text-emerald-700" />
          </div>
          <p className="text-2xl font-extrabold text-emerald-700 mt-2">+ RM {totalIn.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Ledger: <strong>RM {manualIn.toFixed(2)}</strong> • Verified Fees:{' '}
            <strong>RM {verifiedFeesIn.toFixed(2)}</strong>
            {pendingFeesTotal > 0 ? ` (+RM ${pendingFeesTotal.toFixed(0)} pending)` : ''}
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold uppercase text-slate-500">Total Money Out</span>
            <TrendingDown className="w-5 h-5 text-rose-600" />
          </div>
          <p className="text-2xl font-extrabold text-rose-600 mt-2">- RM {totalOut.toFixed(2)}</p>
          <p className="text-[11px] text-slate-500 mt-1.5">
            Ledger: <strong>RM {manualOut.toFixed(2)}</strong> • Approved Claims:{' '}
            <strong>RM {approvedClaimsOut.toFixed(2)}</strong>
          </p>
        </div>
      </div>

      {/* 2. Unified Finance Action Toolbar */}
      <div className="bg-white rounded-3xl border border-emerald-200 p-3 shadow-xs flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {(
            [
              { id: 'master', label: `Master Sheet (${unifiedRows.length})` },
              { id: 'activity_pnl', label: 'By Activity (P&L)' },
              { id: 'tracker', label: 'Claims & Fees' },
              {
                id: 'receivables',
                label: 'Unpaid Fees',
                badge: unpaidReceivables.length,
              },
              { id: 'planner', label: 'Budget Planner' },
            ] as { id: FinanceTabView; label: string; badge?: number }[]
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveView(tab.id)}
              className={`px-3.5 py-2 rounded-2xl font-bold transition cursor-pointer inline-flex items-center gap-1.5 ${
                activeView === tab.id
                  ? 'bg-emerald-700 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-900'
              }`}
            >
              <span>{tab.label}</span>
              {typeof tab.badge === 'number' && tab.badge > 0 && (
                <span
                  className={`px-1.5 py-0.2 rounded-full text-[10px] font-extrabold ${
                    activeView === tab.id ? 'bg-amber-400 text-slate-950' : 'bg-rose-600 text-white'
                  }`}
                >
                  {tab.badge}
                </span>
              )}
            </button>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          {canEdit && (
            <>
              <button
                type="button"
                onClick={() => {
                  setActiveView('master');
                  setSpreadsheetMode((v) => !v);
                }}
                className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl font-bold border cursor-pointer transition ${
                  spreadsheetMode
                    ? 'bg-amber-500 border-amber-600 text-slate-950 shadow-2xs'
                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Spreadsheet Mode: {spreadsheetMode ? 'ON' : 'OFF'}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  if (spreadsheetMode && activeView === 'master') {
                    quickAddTitleRef.current?.focus();
                  } else {
                    openAddModal('OUT');
                  }
                }}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>Add Row</span>
              </button>
              <button
                type="button"
                onClick={() => setShowPasteModal(true)}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
                title="Paste rows from Excel or Google Sheets"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Paste Excel</span>
              </button>
              <button
                type="button"
                onClick={() => openAddModal('SET_SAVINGS')}
                className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 text-white cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Set Savings</span>
              </button>
            </>
          )}
          <button
            type="button"
            onClick={handleExportFilteredCsv}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-200 cursor-pointer"
          >
            <Download className="w-3.5 h-3.5" />
            <span>CSV</span>
          </button>
          <button
            type="button"
            onClick={() => void exportWorkbookForScope(selectedBudget)}
            className="inline-flex items-center gap-1 px-3 py-2 rounded-xl font-bold bg-emerald-800 hover:bg-emerald-700 text-white cursor-pointer"
          >
            <FileSpreadsheet className="w-3.5 h-3.5" />
            <span>Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* ===================== VIEW 1: MASTER SPREADSHEET ===================== */}
      {activeView === 'master' && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
          {/* Filter, Sort & Search Ribbon */}
          <div className="p-4 bg-emerald-50/50 border-b border-emerald-100 flex flex-wrap items-center gap-2 text-xs">
            <div className="relative flex-1 min-w-[180px]">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search title, member, matric, notes..."
                className="w-full rounded-xl border border-emerald-200 bg-white pl-8 pr-3 py-1.5 text-xs"
              />
            </div>

            <select
              value={filterEvent}
              onChange={(e) => setFilterEvent(e.target.value)}
              className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 font-semibold"
            >
              <option value="ALL">All Activities</option>
              <option value="GENERAL">General Club Fund</option>
              {budgets.map((b) => (
                <option key={b.id} value={b.event_name}>
                  {b.event_name}
                </option>
              ))}
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value as 'ALL' | UnifiedSource)}
              className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 font-semibold"
            >
              <option value="ALL">All Sources</option>
              <option value="LEDGER">Manual Ledger</option>
              <option value="CLAIM">Approved Claims</option>
              <option value="FEE">Verified Fees</option>
            </select>

            <select
              value={filterType}
              onChange={(e) => setFilterType(e.target.value as 'ALL' | 'IN' | 'OUT')}
              className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 font-semibold"
            >
              <option value="ALL">In &amp; Out</option>
              <option value="IN">Money In (+)</option>
              <option value="OUT">Money Out (-)</option>
            </select>

            <input
              type="date"
              value={dateFrom}
              onChange={(e) => setDateFrom(e.target.value)}
              className="rounded-xl border border-emerald-200 bg-white px-2 py-1.5 font-mono"
              title="From date"
            />
            <span className="text-slate-400">to</span>
            <input
              type="date"
              value={dateTo}
              onChange={(e) => setDateTo(e.target.value)}
              className="rounded-xl border border-emerald-200 bg-white px-2 py-1.5 font-mono"
              title="To date"
            />

            <button
              type="button"
              onClick={() => {
                const now = new Date();
                const start = new Date(now.getFullYear(), now.getMonth(), 1).toISOString().split('T')[0];
                const end = new Date(now.getFullYear(), now.getMonth() + 1, 0).toISOString().split('T')[0];
                setDateFrom(start);
                setDateTo(end);
              }}
              className="px-2.5 py-1.5 rounded-xl bg-white border border-emerald-200 hover:bg-emerald-100 font-bold cursor-pointer"
            >
              This Month
            </button>

            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="rounded-xl border border-emerald-200 bg-white px-2.5 py-1.5 font-semibold"
            >
              <option value="date_desc">Sort: Newest</option>
              <option value="date_asc">Sort: Oldest</option>
              <option value="amount_desc">Sort: Highest RM</option>
              <option value="amount_asc">Sort: Lowest RM</option>
              <option value="activity_asc">Sort: Activity</option>
            </select>

            {(filterEvent !== 'ALL' ||
              filterSource !== 'ALL' ||
              filterType !== 'ALL' ||
              dateFrom ||
              dateTo ||
              searchQuery) && (
              <button
                type="button"
                onClick={() => {
                  setFilterEvent('ALL');
                  setFilterSource('ALL');
                  setFilterType('ALL');
                  setDateFrom('');
                  setDateTo('');
                  setSearchQuery('');
                }}
                className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold cursor-pointer"
              >
                Clear
              </button>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-emerald-50 text-[11px] font-extrabold uppercase text-emerald-950 border-b border-emerald-200">
                  <th className="py-2.5 px-3">Date</th>
                  <th className="py-2.5 px-3">Source / Type</th>
                  <th className="py-2.5 px-3">Activity</th>
                  <th className="py-2.5 px-3">Item &amp; Category</th>
                  <th className="py-2.5 px-3">Notes</th>
                  <th className="py-2.5 px-3 text-right">Amount (RM)</th>
                  <th className="py-2.5 px-3 text-right">Balance (Baki)</th>
                  <th className="py-2.5 px-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-emerald-100">
                {/* Inline Quick-Add Row in Spreadsheet Mode */}
                {spreadsheetMode && canEdit && (
                  <tr className="bg-amber-50/70 border-b-2 border-amber-200">
                    <td className="p-2">
                      <input
                        type="date"
                        value={qaDate}
                        onChange={(e) => setQaDate(e.target.value)}
                        className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1 font-mono text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <select
                        value={qaType}
                        onChange={(e) => {
                          const nextT = e.target.value as 'IN' | 'OUT';
                          setQaType(nextT);
                          setQaCategory(nextT === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0]);
                        }}
                        className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold text-[11px]"
                      >
                        <option value="IN">+ Money In</option>
                        <option value="OUT">- Money Out</option>
                      </select>
                    </td>
                    <td className="p-2">
                      <select
                        value={qaEvent}
                        onChange={(e) => setQaEvent(e.target.value)}
                        className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1 font-semibold text-[11px]"
                      >
                        {activityOptions.map((name) => (
                          <option key={name} value={name}>
                            {name}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2 space-y-1">
                      <input
                        ref={quickAddTitleRef}
                        type="text"
                        value={qaTitle}
                        onChange={(e) => setQaTitle(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleQuickAddSave();
                        }}
                        placeholder="Quick-add title (Enter to save)..."
                        className="w-full rounded-lg border border-amber-300 bg-white px-2 py-1 font-bold text-[11px]"
                      />
                      <select
                        value={qaCategory}
                        onChange={(e) => setQaCategory(e.target.value)}
                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-0.5 text-[10px]"
                      >
                        {(qaType === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES).map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        value={qaNotes}
                        onChange={(e) => setQaNotes(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleQuickAddSave();
                        }}
                        placeholder="Optional note..."
                        className="w-full rounded-lg border border-amber-200 bg-white px-2 py-1 text-[11px]"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        step="0.01"
                        value={qaAmount}
                        onChange={(e) => setQaAmount(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === 'Enter') void handleQuickAddSave();
                        }}
                        placeholder="0.00"
                        className="w-24 ml-auto block rounded-lg border border-amber-300 bg-white px-2 py-1 text-right font-extrabold text-[11px]"
                      />
                    </td>
                    <td className="p-2 text-right text-[10px] font-bold text-amber-800">
                      Quick Add
                    </td>
                    <td className="p-2 text-right">
                      <button
                        type="button"
                        disabled={qaSaving || !qaTitle.trim() || !(parseFloat(qaAmount) > 0)}
                        onClick={() => void handleQuickAddSave()}
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold text-[11px] cursor-pointer"
                      >
                        {qaSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        <span>Save</span>
                      </button>
                    </td>
                  </tr>
                )}

                {displayedRows.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-10 text-center text-slate-400">
                      No financial transactions match your current filter.
                    </td>
                  </tr>
                ) : (
                  displayedRows.map((row) => {
                    const isInlineLedger = spreadsheetMode && canEdit && row.source === 'LEDGER' && row.rawLedger;
                    const isInlineFee = spreadsheetMode && canEdit && row.source === 'FEE' && row.rawFee;
                    const busy = inlineSavingId === row.recordId;

                    return (
                      <tr
                        key={row.uid}
                        className={`hover:bg-emerald-50/40 ${busy ? 'opacity-60' : ''}`}
                      >
                        <td className="py-2.5 px-3 font-mono whitespace-nowrap">
                          {isInlineLedger && row.rawLedger ? (
                            <input
                              type="date"
                              defaultValue={row.date}
                              onBlur={(e) => {
                                if (e.target.value && e.target.value !== row.date) {
                                  void handleInlineLedgerPatch(row.rawLedger!, { entry_date: e.target.value });
                                }
                              }}
                              className="rounded-lg border border-slate-200 bg-white px-1.5 py-1 text-[11px]"
                            />
                          ) : (
                            row.date
                          )}
                        </td>

                        <td className="py-2.5 px-3 whitespace-nowrap">
                          <div className="flex items-center gap-1">
                            <span
                              className={`px-1.5 py-0.5 rounded text-[10px] font-extrabold border ${
                                row.source === 'CLAIM'
                                  ? 'bg-indigo-50 text-indigo-800 border-indigo-200'
                                  : row.source === 'FEE'
                                  ? 'bg-teal-50 text-teal-800 border-teal-200'
                                  : 'bg-slate-100 text-slate-700 border-slate-200'
                              }`}
                            >
                              {row.source}
                            </span>
                            {isInlineLedger && row.rawLedger ? (
                              <select
                                defaultValue={row.entryType}
                                onChange={(e) =>
                                  void handleInlineLedgerPatch(row.rawLedger!, {
                                    entry_type: e.target.value as 'IN' | 'OUT',
                                  })
                                }
                                className="rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[11px] font-bold"
                              >
                                <option value="IN">IN (+)</option>
                                <option value="OUT">OUT (-)</option>
                              </select>
                            ) : (
                              <span
                                className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                  row.entryType === 'IN'
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : 'bg-rose-100 text-rose-700'
                                }`}
                              >
                                {row.entryType}
                              </span>
                            )}
                          </div>
                        </td>

                        <td className="py-2.5 px-3">
                          {isInlineLedger && row.rawLedger ? (
                            <select
                              defaultValue={row.eventName}
                              onChange={(e) =>
                                void handleInlineLedgerPatch(row.rawLedger!, { event_name: e.target.value })
                              }
                              className="max-w-[160px] rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold"
                            >
                              {activityOptions.map((name) => (
                                <option key={name} value={name}>
                                  {name}
                                </option>
                              ))}
                            </select>
                          ) : (
                            <span
                              className={`inline-block px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getActivityBadgeStyle(
                                row.eventName
                              )}`}
                            >
                              {row.eventName}
                            </span>
                          )}
                        </td>

                        <td className="py-2.5 px-3 min-w-[200px]">
                          {isInlineLedger && row.rawLedger ? (
                            <div className="space-y-1">
                              <input
                                type="text"
                                defaultValue={row.title}
                                onBlur={(e) => {
                                  const v = e.target.value.trim();
                                  if (v && v !== row.title) {
                                    void handleInlineLedgerPatch(row.rawLedger!, { title: v });
                                  }
                                }}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                                }}
                                className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 font-bold text-slate-900"
                              />
                              <select
                                defaultValue={row.category}
                                onChange={(e) =>
                                  void handleInlineLedgerPatch(row.rawLedger!, { category: e.target.value })
                                }
                                className="w-full rounded-lg border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-600"
                              >
                                {ALL_CATEGORIES.map((cat) => (
                                  <option key={cat} value={cat}>
                                    {cat}
                                  </option>
                                ))}
                              </select>
                            </div>
                          ) : (
                            <div>
                              {row.source === 'CLAIM' && row.rawClaim && onSelectClaim ? (
                                <button
                                  type="button"
                                  onClick={() => onSelectClaim(row.rawClaim!)}
                                  className="font-bold text-emerald-900 hover:text-emerald-600 hover:underline text-left cursor-pointer"
                                >
                                  {row.title}
                                </button>
                              ) : (
                                <div className="font-bold text-slate-900">{row.title}</div>
                              )}
                              <div className="text-[11px] text-slate-500">
                                {row.category}
                                {row.person && row.person !== '-' ? ` · ${row.person}` : ''}
                              </div>
                            </div>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-slate-600 max-w-[190px]">
                          {isInlineLedger && row.rawLedger ? (
                            <input
                              type="text"
                              defaultValue={row.notes}
                              onBlur={(e) => {
                                if (e.target.value !== row.notes) {
                                  void handleInlineLedgerPatch(row.rawLedger!, { notes: e.target.value });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              placeholder="Notes..."
                              className="w-full rounded-lg border border-slate-200 bg-white px-2 py-1 text-[11px]"
                            />
                          ) : (
                            <span className="line-clamp-2">{row.notes || '-'}</span>
                          )}
                        </td>

                        <td
                          className={`py-2.5 px-3 text-right font-extrabold whitespace-nowrap ${
                            row.entryType === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                          }`}
                        >
                          {isInlineLedger && row.rawLedger ? (
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={row.amount.toFixed(2)}
                              onBlur={(e) => {
                                const n = parseFloat(e.target.value);
                                if (!isNaN(n) && n > 0 && Math.abs(n - row.amount) > 0.001) {
                                  void handleInlineLedgerPatch(row.rawLedger!, { amount: n });
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-24 ml-auto block rounded-lg border border-slate-200 bg-white px-2 py-1 text-right font-extrabold"
                            />
                          ) : isInlineFee && row.rawFee ? (
                            <input
                              type="number"
                              step="0.01"
                              defaultValue={row.amount.toFixed(2)}
                              onBlur={(e) => {
                                const n = parseFloat(e.target.value);
                                if (!isNaN(n) && n > 0) {
                                  void handleInlineFeePatch(row.rawFee!, n);
                                }
                              }}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') (e.target as HTMLInputElement).blur();
                              }}
                              className="w-24 ml-auto block rounded-lg border border-teal-200 bg-white px-2 py-1 text-right font-extrabold"
                            />
                          ) : (
                            <>
                              {row.entryType === 'IN' ? '+' : '-'} RM {row.amount.toFixed(2)}
                            </>
                          )}
                        </td>

                        <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-800 whitespace-nowrap">
                          RM {row.runningBalance.toFixed(2)}
                        </td>

                        <td className="py-2.5 px-3 text-right whitespace-nowrap">
                          <div className="inline-flex items-center gap-1">
                            {row.attachmentUrl && (
                              <a
                                href={row.attachmentUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                                title="View Receipt / File"
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
                                      : 'ledger_entries',
                                  recordId: row.recordId,
                                  title: row.title,
                                })
                              }
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
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
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 cursor-pointer"
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
                                    }}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 cursor-pointer"
                                    title="Edit Fee"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                {row.source === 'CLAIM' && row.rawClaim && onSelectClaim && (
                                  <button
                                    type="button"
                                    onClick={() => onSelectClaim(row.rawClaim!)}
                                    className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 cursor-pointer"
                                    title="Review / Edit Claim"
                                  >
                                    <Edit3 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteRow(row)}
                                  className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                  title="Remove from Web (Kept in Supabase)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </>
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

          {/* Sticky Bottom Calculation Bar */}
          <div className="sticky bottom-0 bg-emerald-950 text-white px-5 py-3 flex flex-wrap items-center justify-between gap-3 text-xs border-t border-emerald-800">
            <span className="font-bold text-emerald-200">
              Showing {displayedRows.length} of {unifiedRows.length} rows
            </span>
            <div className="flex flex-wrap items-center gap-4 font-extrabold">
              <span className="text-emerald-300">
                Filtered IN: +RM {filteredSummary.inTotal.toFixed(2)}
              </span>
              <span className="text-rose-300">
                Filtered OUT: -RM {filteredSummary.outTotal.toFixed(2)}
              </span>
              <span className="px-2.5 py-1 rounded-lg bg-white/10 text-white">
                Net Filtered: RM {filteredSummary.net.toFixed(2)}
              </span>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 2: BY ACTIVITY (EVENT P&L) ===================== */}
      {activeView === 'activity_pnl' && (
        <div className="space-y-3">
          {activityPnlCards.map((card) => {
            const expanded = expandedActivityKey === card.key;
            return (
              <div
                key={card.key}
                className="bg-white rounded-3xl border border-emerald-200 overflow-hidden shadow-xs"
              >
                <div className="p-5 flex flex-wrap items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => setExpandedActivityKey(expanded ? null : card.key)}
                    className="text-left space-y-1 flex-1 min-w-[200px] cursor-pointer"
                  >
                    <div className="flex items-center gap-2">
                      <span
                        className={`px-2.5 py-0.5 rounded-lg border text-xs font-extrabold ${getActivityBadgeStyle(
                          card.title
                        )}`}
                      >
                        {card.title}
                      </span>
                      <span className="text-xs text-slate-500">{card.subtitle}</span>
                    </div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs pt-1 text-slate-600">
                      <span>
                        Fees: <strong className="text-emerald-700">+RM {card.feesIn.toFixed(2)}</strong>
                      </span>
                      <span>
                        Manual In:{' '}
                        <strong className="text-emerald-700">+RM {card.manualIn.toFixed(2)}</strong>
                      </span>
                      <span>
                        Claims:{' '}
                        <strong className="text-rose-600">-RM {card.claimsOut.toFixed(2)}</strong>
                      </span>
                      <span>
                        Manual Out:{' '}
                        <strong className="text-rose-600">-RM {card.manualOut.toFixed(2)}</strong>
                      </span>
                      {card.pendingClaimsAmt > 0 && (
                        <span className="text-amber-700 font-bold">
                          Pending Claims: RM {card.pendingClaimsAmt.toFixed(2)}
                        </span>
                      )}
                    </div>
                  </button>

                  <div className="flex items-center gap-3 shrink-0">
                    <div className="text-right">
                      <span className="block text-[10px] font-bold uppercase text-slate-400">
                        Net Activity Balance
                      </span>
                      <span
                        className={`text-base font-extrabold ${
                          card.net >= 0 ? 'text-emerald-700' : 'text-rose-600'
                        }`}
                      >
                        {card.net >= 0 ? '+' : '-'} RM {Math.abs(card.net).toFixed(2)}
                      </span>
                    </div>
                    {card.budget && (
                      <button
                        type="button"
                        onClick={() => void exportWorkbookForScope(card.budget)}
                        className="inline-flex items-center gap-1 px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                      >
                        <FileSpreadsheet className="w-3.5 h-3.5" />
                        <span>Export (.xlsx)</span>
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setExpandedActivityKey(expanded ? null : card.key)}
                      className="px-3 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-bold cursor-pointer"
                    >
                      {expanded ? 'Hide Rows' : `Rows (${card.rows.length})`}
                    </button>
                  </div>
                </div>

                {expanded && (
                  <div className="border-t border-emerald-100 bg-slate-50/50 overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-emerald-50/70 border-b text-[11px] font-bold text-emerald-950">
                          <th className="py-2 px-4">Date</th>
                          <th className="py-2 px-4">Source</th>
                          <th className="py-2 px-4">Title</th>
                          <th className="py-2 px-4">Person</th>
                          <th className="py-2 px-4 text-right">Amount</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {card.rows.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-5 text-center text-slate-400">
                              No transactions recorded under this activity yet.
                            </td>
                          </tr>
                        ) : (
                          card.rows.map((r) => (
                            <tr key={r.uid} className="hover:bg-white">
                              <td className="py-2 px-4 font-mono">{r.date}</td>
                              <td className="py-2 px-4 font-bold">{r.source}</td>
                              <td className="py-2 px-4 font-semibold">{r.title}</td>
                              <td className="py-2 px-4 text-slate-600">{r.person}</td>
                              <td
                                className={`py-2 px-4 text-right font-extrabold ${
                                  r.entryType === 'IN' ? 'text-emerald-700' : 'text-rose-600'
                                }`}
                              >
                                {r.entryType === 'IN' ? '+' : '-'} RM {r.amount.toFixed(2)}
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

      {/* ===================== VIEW 3: CLAIMS & FEE TRACKER ===================== */}
      {activeView === 'tracker' && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-base font-extrabold text-emerald-950">
              Activity Fee &amp; Claim Reimbursement Tracker
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={trackerEventId}
                onChange={(e) => setTrackerEventId(e.target.value)}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold text-slate-900"
              >
                <option value="ALL">All Club Activities ({budgets.length})</option>
                {budgets.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.event_name} ({b.event_date})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={() => void exportWorkbookForScope(selectedBudget)}
                className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>Export 6-Sheet Excel (.xlsx)</span>
              </button>
            </div>
          </div>

          <div className="p-5 grid grid-cols-1 lg:grid-cols-2 gap-5 text-xs">
            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-emerald-950">
                  Fee Payments ({filteredFeePayments.length})
                </h3>
                <span className="font-extrabold text-emerald-700">
                  Verified: RM{' '}
                  {filteredFeePayments
                    .filter((f) => f.status === 'Verified')
                    .reduce((s, f) => s + Number(f.amount_paid), 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="border rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-2 px-3">Student</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Status</th>
                      <th className="py-2 px-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredFeePayments.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No fee payments for this selection.
                        </td>
                      </tr>
                    ) : (
                      filteredFeePayments.map((f) => (
                        <tr key={f.id}>
                          <td className="py-2 px-3">
                            <div className="font-bold">{f.student_name}</div>
                            <div className="text-[10px] text-slate-400 font-mono">{f.matric_no}</div>
                          </td>
                          <td className="py-2 px-3 font-extrabold text-emerald-700">
                            RM {Number(f.amount_paid).toFixed(2)}
                          </td>
                          <td className="py-2 px-3 font-bold">{f.status}</td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              {f.receipt_url && (
                                <a
                                  href={f.receipt_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="p-1 rounded bg-slate-100 text-emerald-700"
                                  title="Receipt"
                                >
                                  <ExternalLink className="w-3.5 h-3.5 inline" />
                                </a>
                              )}
                              <button
                                type="button"
                                onClick={() =>
                                  setHistoryTarget({
                                    table: 'activity_fee_payments',
                                    recordId: f.id,
                                    title: `${f.student_name} Fee`,
                                  })
                                }
                                className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                                title="History"
                              >
                                <History className="w-3.5 h-3.5 inline" />
                              </button>
                              {canEdit && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setEditingFeeItem(f);
                                      setEditFeeAmount(String(f.amount_paid));
                                      setEditFeeStatus(f.status);
                                    }}
                                    className="p-1 rounded bg-slate-100 text-slate-800 hover:bg-emerald-50 cursor-pointer"
                                    title="Edit Fee"
                                  >
                                    <Edit3 className="w-3.5 h-3.5 inline" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await softDeleteRecord({
                                        actor: profile,
                                        category: 'Fees',
                                        table: 'activity_fee_payments',
                                        recordId: f.id,
                                        recordTitle: `${f.student_name} — RM ${Number(f.amount_paid).toFixed(2)}`,
                                      });
                                      onRefresh('Removed fee record from web (kept in Supabase).');
                                    }}
                                    className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                    title="Remove from Web"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 inline" />
                                  </button>
                                </>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <h3 className="font-extrabold text-emerald-950">
                  Claims &amp; Proof ({filteredClaims.length})
                </h3>
                <span className="font-extrabold text-rose-600">
                  Approved: RM{' '}
                  {filteredClaims
                    .filter((c) => c.status === 'Approved')
                    .reduce((s, c) => s + Number(c.amount), 0)
                    .toFixed(2)}
                </span>
              </div>
              <div className="border rounded-2xl overflow-hidden max-h-[340px] overflow-y-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-2 px-3">Claim</th>
                      <th className="py-2 px-3">Amount</th>
                      <th className="py-2 px-3">Proof</th>
                      <th className="py-2 px-3 text-right">Manage</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {filteredClaims.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="py-6 text-center text-slate-400">
                          No claims for this selection.
                        </td>
                      </tr>
                    ) : (
                      filteredClaims.map((c) => (
                        <tr key={c.id}>
                          <td className="py-2 px-3">
                            <div className="font-bold">{c.title}</div>
                            <div className="text-[10px] text-slate-500">
                              {c.claimant_name} ({c.status})
                            </div>
                          </td>
                          <td className="py-2 px-3 font-extrabold">RM {Number(c.amount).toFixed(2)}</td>
                          <td className="py-2 px-3">
                            {c.payout_proof_url ? (
                              <a
                                href={c.payout_proof_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]"
                              >
                                <span>✓ Paid</span>
                                <ExternalLink className="w-2.5 h-2.5" />
                              </a>
                            ) : (
                              <span className="text-[10px] text-slate-400">None</span>
                            )}
                          </td>
                          <td className="py-2 px-3 text-right">
                            <div className="inline-flex items-center gap-1 justify-end">
                              <button
                                type="button"
                                onClick={() =>
                                  setHistoryTarget({ table: 'claims', recordId: c.id, title: c.title })
                                }
                                className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                                title="History"
                              >
                                <History className="w-3.5 h-3.5" />
                              </button>
                              {onSelectClaim && (
                                <button
                                  type="button"
                                  onClick={() => onSelectClaim(c)}
                                  className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] cursor-pointer"
                                >
                                  Review
                                </button>
                              )}
                              {canEdit && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    await softDeleteRecord({
                                      actor: profile,
                                      category: 'Claims',
                                      table: 'claims',
                                      recordId: c.id,
                                      recordTitle: c.title,
                                      extraSummary: `RM ${Number(c.amount).toFixed(2)}`,
                                    });
                                    onRefresh('Removed claim from web (kept in Supabase).');
                                  }}
                                  className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                  title="Remove from Web"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== VIEW 4: UNPAID FEES (RECEIVABLES) ===================== */}
      {activeView === 'receivables' && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-emerald-950">
                Unpaid Activity Fees ({unpaidReceivables.length})
              </h2>
              <p className="text-xs text-slate-500">
                Attending members on paid activities with no fee payment recorded yet. Total Receivable:{' '}
                <strong className="text-amber-800">
                  RM {unpaidReceivables.reduce((s, r) => s + r.feeDue, 0).toFixed(2)}
                </strong>
              </p>
            </div>
            <select
              value={unpaidEventFilter}
              onChange={(e) => setUnpaidEventFilter(e.target.value)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold"
            >
              <option value="ALL">All Paid Activities</option>
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
                <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                  <th className="py-3 px-4">Student</th>
                  <th className="py-3 px-4">Activity</th>
                  <th className="py-3 px-4 text-right">Fee Due</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {unpaidReceivables.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="py-10 text-center text-slate-400">
                      All attending members have paid their fees!
                    </td>
                  </tr>
                ) : (
                  unpaidReceivables.map((item) => {
                    const waMsg = `Hi ${item.rsvp.student_name}, gentle reminder to pay RM ${item.feeDue.toFixed(
                      2
                    )} registration fee for ${item.budget.event_name}. Thank you!`;
                    return (
                      <tr key={item.key} className="hover:bg-amber-50/40">
                        <td className="py-3 px-4">
                          <div className="font-bold text-slate-900">{item.rsvp.student_name}</div>
                          <div className="text-[11px] font-mono text-slate-500">
                            {item.rsvp.matric_no} {item.rsvp.phone_number ? `· ${item.rsvp.phone_number}` : ''}
                          </div>
                        </td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2 py-0.5 rounded-lg border text-[11px] font-bold ${getActivityBadgeStyle(
                              item.budget.event_name
                            )}`}
                          >
                            {item.budget.event_name}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right font-extrabold text-amber-800">
                          RM {item.feeDue.toFixed(2)}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="inline-flex items-center gap-1.5 justify-end">
                            <a
                              href={waLink(item.rsvp.phone_number, waMsg)}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 text-emerald-800 font-bold"
                            >
                              <MessageCircle className="w-3.5 h-3.5" />
                              <span>WhatsApp</span>
                            </a>
                            {canEdit && (
                              <button
                                type="button"
                                disabled={markingPaidKey === item.key}
                                onClick={() => void handleMarkUnpaidAsPaid(item)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-60"
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

      {/* ===================== VIEW 5: BUDGET PLANNER (EST. VS ACTUAL) ===================== */}
      {activeView === 'planner' && (
        <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
          <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-extrabold text-emerald-950">
                Budget Planner (Estimated vs Actual)
              </h2>
              <p className="text-xs text-slate-500">
                Draft expected income/expenses per activity and compare live against actual club records.
              </p>
            </div>
            <select
              value={plannerBudgetId}
              onChange={(e) => setPlannerBudgetId(e.target.value)}
              className="rounded-xl border border-emerald-300 bg-white px-3 py-2 text-xs font-bold"
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

          <div className="p-5 space-y-4">
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200">
                <div className="text-emerald-800 font-bold">Planned Income</div>
                <div className="text-lg font-extrabold text-emerald-950">
                  RM {plannerTotals.plannedIn.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-emerald-200">
                <div className="text-slate-500 font-bold">Actual Income</div>
                <div className="text-lg font-extrabold text-emerald-700">
                  RM {plannerTotals.actualIn.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-rose-50 border border-rose-200">
                <div className="text-rose-800 font-bold">Planned Expense</div>
                <div className="text-lg font-extrabold text-rose-950">
                  RM {plannerTotals.plannedOut.toFixed(2)}
                </div>
              </div>
              <div className="p-3 rounded-2xl bg-white border border-rose-200">
                <div className="text-slate-500 font-bold">Actual Expense</div>
                <div className="text-lg font-extrabold text-rose-600">
                  RM {plannerTotals.actualOut.toFixed(2)}
                </div>
              </div>
            </div>

            {canEdit && (
              <div className="p-3 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-2 items-center text-xs">
                <select
                  value={newPlanType}
                  onChange={(e) => {
                    const t = e.target.value as 'IN' | 'OUT';
                    setNewPlanType(t);
                    setNewPlanCategory(t === 'IN' ? IN_CATEGORIES[4] : OUT_CATEGORIES[0]);
                  }}
                  className="md:col-span-2 rounded-xl border bg-white px-2.5 py-2 font-bold"
                >
                  <option value="OUT">Est. Expense</option>
                  <option value="IN">Est. Income</option>
                </select>
                <input
                  type="text"
                  value={newPlanItem}
                  onChange={(e) => setNewPlanItem(e.target.value)}
                  placeholder="Budget item (e.g., Arbiter Fee)"
                  className="md:col-span-3 rounded-xl border bg-white px-2.5 py-2 font-semibold"
                />
                <select
                  value={newPlanCategory}
                  onChange={(e) => setNewPlanCategory(e.target.value)}
                  className="md:col-span-3 rounded-xl border bg-white px-2.5 py-2"
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
                  className="md:col-span-2 rounded-xl border bg-white px-2.5 py-2 font-bold"
                />
                <button
                  type="button"
                  onClick={() => {
                    const n = parseFloat(newPlanAmount);
                    if (!newPlanItem.trim() || isNaN(n) || n <= 0) return;
                    persistPlannerRows([
                      ...plannerRows,
                      {
                        id: `plan-${Date.now()}`,
                        budgetId: plannerBudgetId,
                        entryType: newPlanType,
                        item: newPlanItem.trim(),
                        category: newPlanCategory,
                        plannedAmount: n.toFixed(2),
                        notes: newPlanNotes.trim(),
                      },
                    ]);
                    setNewPlanItem('');
                    setNewPlanAmount('');
                    setNewPlanNotes('');
                  }}
                  className="md:col-span-2 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                >
                  + Add Line
                </button>
              </div>
            )}

            <div className="border rounded-2xl overflow-hidden">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                    <th className="py-2.5 px-4">Type</th>
                    <th className="py-2.5 px-4">Item</th>
                    <th className="py-2.5 px-4">Category</th>
                    <th className="py-2.5 px-4 text-right">Planned (RM)</th>
                    <th className="py-2.5 px-4 text-right">Actual Category (RM)</th>
                    <th className="py-2.5 px-4 text-right">Variance</th>
                    {canEdit && <th className="py-2.5 px-4 text-right">Remove</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {scopedPlannerRows.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="py-8 text-center text-slate-400">
                        No planned budget lines yet. Add expected items above to forecast event P&amp;L.
                      </td>
                    </tr>
                  ) : (
                    scopedPlannerRows.map((p) => {
                      const plannedVal = parseFloat(p.plannedAmount) || 0;
                      const actualCat = unifiedRows
                        .filter(
                          (r) =>
                            r.entryType === p.entryType &&
                            (p.budgetId === 'ALL'
                              ? true
                              : p.budgetId === 'GENERAL'
                              ? isGeneralEventName(r.eventName)
                              : r.budgetId === p.budgetId) &&
                            r.category.toLowerCase() === p.category.toLowerCase()
                        )
                        .reduce((s, r) => s + r.amount, 0);
                      const diff = p.entryType === 'IN' ? actualCat - plannedVal : plannedVal - actualCat;

                      return (
                        <tr key={p.id}>
                          <td className="py-2.5 px-4">
                            <span
                              className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                p.entryType === 'IN'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : 'bg-rose-100 text-rose-700'
                              }`}
                            >
                              {p.entryType === 'IN' ? 'Income' : 'Expense'}
                            </span>
                          </td>
                          <td className="py-2.5 px-4 font-bold">
                            {canEdit ? (
                              <input
                                type="text"
                                value={p.item}
                                onChange={(e) =>
                                  persistPlannerRows(
                                    plannerRows.map((x) =>
                                      x.id === p.id ? { ...x, item: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-full rounded-lg border border-slate-200 px-2 py-1 font-bold"
                              />
                            ) : (
                              p.item
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-slate-600">{p.category}</td>
                          <td className="py-2.5 px-4 text-right font-extrabold">
                            {canEdit ? (
                              <input
                                type="number"
                                step="0.01"
                                value={p.plannedAmount}
                                onChange={(e) =>
                                  persistPlannerRows(
                                    plannerRows.map((x) =>
                                      x.id === p.id ? { ...x, plannedAmount: e.target.value } : x
                                    )
                                  )
                                }
                                className="w-24 ml-auto block rounded-lg border border-slate-200 px-2 py-1 text-right font-extrabold"
                              />
                            ) : (
                              `RM ${plannedVal.toFixed(2)}`
                            )}
                          </td>
                          <td className="py-2.5 px-4 text-right font-bold text-slate-700">
                            RM {actualCat.toFixed(2)}
                          </td>
                          <td
                            className={`py-2.5 px-4 text-right font-extrabold ${
                              diff >= 0 ? 'text-emerald-700' : 'text-rose-600'
                            }`}
                          >
                            {diff >= 0 ? '+' : '-'} RM {Math.abs(diff).toFixed(2)}
                          </td>
                          {canEdit && (
                            <td className="py-2.5 px-4 text-right">
                              <button
                                type="button"
                                onClick={() =>
                                  persistPlannerRows(plannerRows.filter((x) => x.id !== p.id))
                                }
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
        </div>
      )}

      {/* ===================== BULK PASTE FROM EXCEL / SHEETS MODAL ===================== */}
      {showPasteModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-2xl w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">Paste from Excel / Google Sheets</h3>
              <button type="button" onClick={() => setShowPasteModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 space-y-4 text-xs">
              <div className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-emerald-950 space-y-1">
                <div className="font-bold">Copy rows directly from Excel / Sheets &amp; paste below:</div>
                <div className="font-mono text-[11px] text-emerald-800">
                  Date | Type (IN/OUT) | Activity | Category | Title | Amount (RM) | Notes
                </div>
                <div className="text-[11px] text-slate-600">
                  Or quick format: <span className="font-mono">2026-11-17 | Mineral Water | -24.50</span>
                </div>
              </div>

              <textarea
                rows={6}
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
                placeholder={'2026-11-17\tOUT\tChess Open\tFood & Refreshments\tMineral Water\t24.50\tReceipt #1'}
                className="w-full rounded-2xl border border-emerald-300 p-3 font-mono text-[11px]"
              />

              {parsedPastePreview.length > 0 && (
                <div className="border rounded-2xl overflow-hidden max-h-48 overflow-y-auto">
                  <table className="w-full text-left border-collapse text-[11px]">
                    <thead>
                      <tr className="bg-slate-50 border-b font-bold">
                        <th className="py-1.5 px-2.5">Date</th>
                        <th className="py-1.5 px-2.5">Type</th>
                        <th className="py-1.5 px-2.5">Activity</th>
                        <th className="py-1.5 px-2.5">Title</th>
                        <th className="py-1.5 px-2.5 text-right">Amount</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {parsedPastePreview.map((r, i) => (
                        <tr key={i}>
                          <td className="py-1.5 px-2.5 font-mono">{r.entry_date}</td>
                          <td className="py-1.5 px-2.5 font-bold">{r.entry_type}</td>
                          <td className="py-1.5 px-2.5">{r.event_name}</td>
                          <td className="py-1.5 px-2.5 font-semibold">{r.title}</td>
                          <td className="py-1.5 px-2.5 text-right font-extrabold">
                            RM {r.amount.toFixed(2)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setShowPasteModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={pasteSaving || parsedPastePreview.length === 0}
                  onClick={() => void handleBulkPasteImport()}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 text-white font-bold cursor-pointer"
                >
                  {pasteSaving && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Import {parsedPastePreview.length} Row(s)</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ===================== ADD / EDIT / SET SAVINGS MODAL ===================== */}
      {showModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-md w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingEntry
                  ? 'Edit Finance Record'
                  : modalMode === 'SET_SAVINGS'
                  ? 'Set Club Savings & Cash Split'
                  : 'Add Finance Record'}
              </h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEntry} className="p-6 space-y-3.5">
              {!editingEntry && (
                <div className="grid grid-cols-3 gap-1.5 bg-emerald-50 p-1 rounded-xl border border-emerald-200">
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('SET_SAVINGS');
                      setEntryType('IN');
                      setTitle('Carry-Forward / Current Savings Balance Update');
                      setCategory('Carry-Forward / Opening Balance');
                      setAmount(currentSavingsBalance.toFixed(2));
                      setPhysicalCashInput(physicalCash.toFixed(2));
                    }}
                    className={`py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                      modalMode === 'SET_SAVINGS' ? 'bg-emerald-800 text-white' : 'text-emerald-900'
                    }`}
                  >
                    Set Savings
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('IN');
                      setEntryType('IN');
                      setTitle('');
                      setCategory(IN_CATEGORIES[0]);
                      setAmount('');
                    }}
                    className={`py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                      modalMode === 'IN' ? 'bg-emerald-600 text-white' : 'text-emerald-900'
                    }`}
                  >
                    + Money In
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setModalMode('OUT');
                      setEntryType('OUT');
                      setTitle('');
                      setCategory(OUT_CATEGORIES[0]);
                      setAmount('');
                    }}
                    className={`py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                      modalMode === 'OUT' ? 'bg-rose-600 text-white' : 'text-slate-700'
                    }`}
                  >
                    - Money Out
                  </button>
                </div>
              )}

              {modalMode === 'SET_SAVINGS' && !editingEntry ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-semibold">Current Calculated Total:</span>
                    <span className="font-mono font-extrabold text-emerald-900">
                      RM {currentSavingsBalance.toFixed(2)}
                    </span>
                  </div>
                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">
                      Physical Cash Held (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={physicalCashInput}
                      onChange={(e) => setPhysicalCashInput(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold"
                    />
                    <div className="text-[11px] text-emerald-800 mt-1">
                      Bank / DuitNow = Total RM {((parseFloat(amount) || 0) - (parseFloat(physicalCashInput) || 0)).toFixed(2)}
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">Category</label>
                    <select
                      value={category}
                      onChange={(e) => setCategory(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-semibold"
                    >
                      {activeCategoryList.map((cat) => (
                        <option key={cat} value={cat}>
                          {cat}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">Activity / Scope</label>
                    <select
                      value={selectedEventOption}
                      onChange={(e) => setSelectedEventOption(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="GENERAL">General Club Fund</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.event_name}>
                          {ev.event_name}
                        </option>
                      ))}
                      <option value="OTHER">Other (Custom)</option>
                    </select>
                  </div>
                  {selectedEventOption === 'OTHER' && (
                    <input
                      type="text"
                      value={customEventName}
                      onChange={(e) => setCustomEventName(e.target.value)}
                      placeholder="Custom event name..."
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                      required
                    />
                  )}
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">Title *</label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={entryType === 'IN' ? 'e.g., Sponsorship / Grant' : 'e.g., Tournament Supplies'}
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    {modalMode === 'SET_SAVINGS' && !editingEntry ? 'Total Savings (RM) *' : 'Amount (RM) *'}
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
                  <label className="block text-xs font-bold text-emerald-900 mb-1">Date *</label>
                  <input
                    type="date"
                    value={entryDate}
                    onChange={(e) => setEntryDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Attachment (Optional)</label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setAttachmentFile(e.target.files?.[0] || null)}
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">Notes</label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              {errorMsg && <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">{errorMsg}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{modalMode === 'SET_SAVINGS' && !editingEntry ? 'Save Balance' : 'Save'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===================== FEE QUICK EDIT MODAL ===================== */}
      {editingFeeItem && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit Fee — {editingFeeItem.student_name}</h3>
              <button type="button" onClick={() => setEditingFeeItem(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveFeeQuickEdit} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Amount Paid (RM) *</label>
                <input
                  type="number"
                  step="0.01"
                  value={editFeeAmount}
                  onChange={(e) => setEditFeeAmount(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Status</label>
                <select
                  value={editFeeStatus}
                  onChange={(e) =>
                    setEditFeeStatus(e.target.value as 'Verified' | 'Pending' | 'Rejected')
                  }
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold"
                >
                  <option value="Verified">Verified</option>
                  <option value="Pending">Pending</option>
                  <option value="Rejected">Rejected</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingFeeItem(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingFeeEdit}
                  className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  {savingFeeEdit ? 'Saving...' : 'Save Fee'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <RecordHistoryModal
        target={historyTarget}
        logs={logs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}
