'use client';

import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { supabase, EquipmentItem, EquipmentLoan, UserProfile, logActivity } from '@/lib/supabase';
import {
  localDateStr,
  addDaysStr,
  approvalOf,
  loanOccupiesDay,
  unitsInUseOnDay,
  availableForRange,
  submitLoanRequest,
  syncAvailabilityToday,
  equipmentQrPayload,
  qrImageUrl,
  MIGRATION_HINT,
} from '@/lib/equipment';
import { formatWhatsAppPhone } from '@/lib/whatsapp';
import {
  Package,
  PlusCircle,
  CheckCircle2,
  Clock,
  Trash2,
  X,
  Loader2,
  ArrowUpRight,
  RotateCcw,
  AlertTriangle,
  MessageCircle,
  Edit3,
  Search,
  MapPin,
  QrCode,
  Printer,
  CalendarDays,
  CalendarPlus,
  ChevronLeft,
  ChevronRight,
  ShieldCheck,
  Zap,
  Ban,
} from 'lucide-react';

interface EquipmentSectionProps {
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  profile: UserProfile;
  isAdmin: boolean;
  onRefresh: (msg: string) => void;
}

type LoanView = 'Pending' | 'Rejected' | 'Cancelled' | 'Reserved' | 'Borrowed' | 'Late' | 'Returned';

function diffDaysBetween(startStr: string, endStr: string): number {
  const s = new Date(`${startStr}T00:00:00`).getTime();
  const e = new Date(`${endStr}T00:00:00`).getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.round((e - s) / 86400000);
}

const MONTH_NAMES = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];

export default function EquipmentSection({
  items,
  loans,
  profile,
  isAdmin,
  onRefresh,
}: EquipmentSectionProps) {
  const todayStr = localDateStr();

  const [view, setView] = useState<'inventory' | 'calendar'>('inventory');

  // ---- Admin add / edit item ----
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Sports / Chess Sets');
  const [totalQty, setTotalQty] = useState('10');
  const [location, setLocation] = useState('Club Storage Room');
  const [notes, setNotes] = useState('');
  const [requiresApproval, setRequiresApproval] = useState(false);
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  // ---- Borrow / reserve ----
  const [borrowTarget, setBorrowTarget] = useState<EquipmentItem | null>(null);
  const [borrowQty, setBorrowQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [startDate, setStartDate] = useState(todayStr);
  const [returnDate, setReturnDate] = useState(addDaysStr(todayStr, 7));
  const [borrowing, setBorrowing] = useState(false);
  const [borrowError, setBorrowError] = useState<string | null>(null);

  // ---- Loans table ----
  const [loanFilter, setLoanFilter] = useState<'ALL' | 'PENDING' | 'ACTIVE' | 'OVERDUE' | 'CLOSED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  // ---- Calendar ----
  const [calMonth, setCalMonth] = useState(() => {
    const d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1);
  });
  const [calItemId, setCalItemId] = useState<string>('ALL');
  const [selectedDay, setSelectedDay] = useState<string | null>(null);

  // ---- QR stickers ----
  const [stickerItems, setStickerItems] = useState<EquipmentItem[] | null>(null);
  const [stickerPerUnit, setStickerPerUnit] = useState(true);

  const getLoanView = (loan: EquipmentLoan): LoanView => {
    if (loan.status === 'Returned') return 'Returned';
    const a = approvalOf(loan);
    if (a === 'Pending') return 'Pending';
    if (a === 'Rejected') return 'Rejected';
    if (a === 'Cancelled') return 'Cancelled';
    if (loan.borrow_date > todayStr) return 'Reserved';
    if (loan.status === 'Overdue' || (loan.return_date && loan.return_date < todayStr)) return 'Late';
    return 'Borrowed';
  };

  const getDurationDetails = (loan: EquipmentLoan) => {
    const v = getLoanView(loan);
    if (v === 'Returned') {
      const endDay = loan.returned_at ? localDateStr(loan.returned_at) : todayStr;
      const heldDays = Math.max(1, diffDaysBetween(loan.borrow_date, endDay) + 1);
      return { heldLabel: `${heldDays}d total`, dueLabel: `Returned ${endDay}`, isLate: false };
    }
    if (v === 'Pending') return { heldLabel: 'Awaiting approval', dueLabel: `Wants ${loan.borrow_date}`, isLate: false };
    if (v === 'Rejected') return { heldLabel: 'Not approved', dueLabel: '—', isLate: false };
    if (v === 'Cancelled') return { heldLabel: 'Cancelled', dueLabel: '—', isLate: false };
    if (v === 'Reserved') {
      const startsIn = diffDaysBetween(todayStr, loan.borrow_date);
      return { heldLabel: `Starts in ${startsIn}d`, dueLabel: `Pickup ${loan.borrow_date}`, isLate: false };
    }
    const heldDays = Math.max(1, diffDaysBetween(loan.borrow_date, todayStr) + 1);
    const daysLeft = diffDaysBetween(todayStr, loan.return_date);
    if (daysLeft < 0) return { heldLabel: `${heldDays}d borrowed`, dueLabel: `${Math.abs(daysLeft)}d late`, isLate: true };
    if (daysLeft === 0) return { heldLabel: `${heldDays}d borrowed`, dueLabel: 'Due today', isLate: false };
    return { heldLabel: `${heldDays}d borrowed`, dueLabel: `${daysLeft}d left`, isLate: false };
  };

  const baseLoans = isAdmin ? loans : loans.filter((l) => l.user_id === profile.id);
  const pendingCount = baseLoans.filter((l) => getLoanView(l) === 'Pending').length;
  const overdueLoansCount = baseLoans.filter((l) => getLoanView(l) === 'Late').length;
  const activeLoansCount = baseLoans.filter((l) => ['Borrowed', 'Late', 'Reserved'].includes(getLoanView(l))).length;

  const filteredLoans = baseLoans.filter((loan) => {
    const v = getLoanView(loan);
    if (loanFilter === 'PENDING' && v !== 'Pending') return false;
    if (loanFilter === 'ACTIVE' && !['Borrowed', 'Late', 'Reserved', 'Pending'].includes(v)) return false;
    if (loanFilter === 'OVERDUE' && v !== 'Late') return false;
    if (loanFilter === 'CLOSED' && !['Returned', 'Rejected', 'Cancelled'].includes(v)) return false;
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return (
        loan.item_name?.toLowerCase().includes(q) ||
        loan.borrower_name?.toLowerCase().includes(q) ||
        loan.matric_no?.toLowerCase().includes(q) ||
        loan.purpose?.toLowerCase().includes(q)
      );
    }
    return true;
  });

  // ------------------------------------------------------------------ admin item CRUD
  const openAddModal = () => {
    if (!isAdmin) return;
    setEditingItem(null);
    setItemName('');
    setCategory('Sports / Chess Sets');
    setTotalQty('10');
    setLocation('Club Storage Room');
    setNotes('');
    setRequiresApproval(false);
    setItemError(null);
    setShowItemModal(true);
  };

  const openEditModal = (item: EquipmentItem) => {
    if (!isAdmin) return;
    setEditingItem(item);
    setItemName(item.item_name || '');
    setCategory(item.category || 'General');
    setTotalQty(String(item.total_quantity ?? 1));
    setLocation(item.location || 'Club Storage Room');
    setNotes(item.notes || '');
    setRequiresApproval(Boolean(item.requires_approval));
    setItemError(null);
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!isAdmin) return;
    setItemError(null);
    const qty = Math.max(1, parseInt(totalQty) || 1);
    setSavingItem(true);

    try {
      const inUseNow = editingItem ? unitsInUseOnDay(loans, editingItem.id, todayStr, todayStr) : 0;
      const base = {
        item_name: itemName.trim(),
        category: category.trim() || 'General',
        total_quantity: qty,
        available_quantity: Math.max(0, qty - inUseNow),
        location: location.trim() || 'Club Storage Room',
        notes: notes.trim(),
      };

      const write = async (payload: Record<string, unknown>) =>
        editingItem
          ? supabase.from('equipment_items').update(payload).eq('id', editingItem.id)
          : supabase.from('equipment_items').insert(payload);

      let { error } = await write({ ...base, requires_approval: requiresApproval });
      let approvalSaved = true;
      if (error) {
        approvalSaved = false;
        ({ error } = await write(base));
        if (error) {
          ({ error } = await write({
            item_name: base.item_name,
            category: base.category,
            total_quantity: base.total_quantity,
            available_quantity: base.available_quantity,
            location: base.location,
          }));
          if (error) throw error;
        }
      }

      void logActivity(
        profile,
        'Equipment',
        editingItem ? 'Equipment edited' : 'Equipment added',
        `${profile.full_name} ${editingItem ? 'updated' : 'added'} "${base.item_name}" (qty ${qty}, ${
          requiresApproval ? 'approval required' : 'instant borrow'
        })`
      );

      setShowItemModal(false);
      setEditingItem(null);
      if (!approvalSaved && requiresApproval) {
        onRefresh(`Saved "${base.item_name}", but the approval setting needs the SQL migration to take effect.`);
      } else {
        onRefresh(editingItem ? `Updated "${base.item_name}"!` : `Added "${base.item_name}"!`);
      }
    } catch (err: unknown) {
      setItemError(err instanceof Error ? err.message : 'Failed to save equipment.');
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: EquipmentItem) => {
    if (!isAdmin) return;
    await supabase.from('equipment_items').delete().eq('id', item.id);
    void logActivity(profile, 'Equipment', 'Equipment removed', `${profile.full_name} removed "${item.item_name}" from inventory`);
    onRefresh(`Removed "${item.item_name}".`);
  };

  // ------------------------------------------------------------------ borrow / reserve
  const openBorrow = (item: EquipmentItem, mode: 'now' | 'later', presetStart?: string) => {
    const start = presetStart || (mode === 'now' ? todayStr : addDaysStr(todayStr, 1));
    setBorrowTarget(item);
    setStartDate(start);
    setReturnDate(addDaysStr(start, mode === 'now' ? 7 : 1));
    setBorrowQty('1');
    setPurpose('');
    setBorrowError(null);
  };

  const rangeAvail = borrowTarget
    ? availableForRange(borrowTarget, loans, startDate, returnDate >= startDate ? returnDate : startDate, todayStr)
    : 0;

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowTarget) return;
    setBorrowError(null);
    const qty = Math.max(1, parseInt(borrowQty) || 1);
    setBorrowing(true);
    try {
      const res = await submitLoanRequest({
        item: borrowTarget,
        loans,
        profile,
        quantity: qty,
        startDate,
        endDate: returnDate,
        purpose,
      });
      if (!res.ok) {
        setBorrowError(res.error || 'Could not save.');
        return;
      }
      const name = borrowTarget.item_name;
      setBorrowTarget(null);
      setPurpose('');
      onRefresh(
        res.approval === 'Pending'
          ? `Request sent for ${res.quantity}x ${name} — waiting for admin approval.`
          : res.isFuture
          ? `Reserved ${res.quantity}x ${name} from ${startDate}!`
          : `Borrowed ${res.quantity}x ${name}!`
      );
    } finally {
      setBorrowing(false);
    }
  };

  const loansWithout = (loanId: string, patch: Partial<EquipmentLoan>) =>
    loans.map((l) => (l.id === loanId ? { ...l, ...patch } : l));

  const handleReturnLoan = async (loan: EquipmentLoan) => {
    await supabase
      .from('equipment_loans')
      .update({ status: 'Returned', returned_at: new Date().toISOString() })
      .eq('id', loan.id);
    const item = items.find((i) => i.id === loan.item_id);
    if (item) {
      await syncAvailabilityToday(item, loansWithout(loan.id, { status: 'Returned', returned_at: new Date().toISOString() }));
    }
    void logActivity(
      profile,
      'Equipment',
      'Equipment returned',
      `${loan.quantity}x ${loan.item_name} returned by ${loan.borrower_name} (${loan.matric_no})` +
        (loan.user_id !== profile.id ? ` — marked by ${profile.full_name}` : '')
    );
    onRefresh(`Returned ${loan.quantity}x ${loan.item_name}!`);
  };

  const handleDecideRequest = async (loan: EquipmentLoan, decision: 'Approved' | 'Rejected') => {
    const { error } = await supabase
      .from('equipment_loans')
      .update({
        approval_status: decision,
        approved_by: `${profile.full_name} (${profile.matric_no})`,
        approved_at: new Date().toISOString(),
      })
      .eq('id', loan.id);
    if (error) {
      onRefresh(MIGRATION_HINT);
      return;
    }
    const item = items.find((i) => i.id === loan.item_id);
    if (item) await syncAvailabilityToday(item, loansWithout(loan.id, { approval_status: decision }));
    void logActivity(
      profile,
      'Equipment',
      decision === 'Approved' ? 'Equipment request approved' : 'Equipment request rejected',
      `${profile.full_name} ${decision === 'Approved' ? 'approved' : 'rejected'} ${loan.quantity}x ${loan.item_name} for ${
        loan.borrower_name
      } (${loan.matric_no}), ${loan.borrow_date} → ${loan.return_date}`
    );
    onRefresh(
      decision === 'Approved'
        ? `Approved ${loan.borrower_name}'s request — ready for pickup.`
        : `Rejected ${loan.borrower_name}'s request.`
    );
  };

  const handleCancelBooking = async (loan: EquipmentLoan) => {
    const { error } = await supabase.from('equipment_loans').update({ approval_status: 'Cancelled' }).eq('id', loan.id);
    if (error) {
      onRefresh(MIGRATION_HINT);
      return;
    }
    const item = items.find((i) => i.id === loan.item_id);
    if (item) await syncAvailabilityToday(item, loansWithout(loan.id, { approval_status: 'Cancelled' }));
    void logActivity(
      profile,
      'Equipment',
      'Booking cancelled',
      `${profile.full_name} cancelled ${loan.quantity}x ${loan.item_name} booking (${loan.borrow_date} → ${loan.return_date}) of ${loan.borrower_name}`
    );
    onRefresh(`Cancelled booking for ${loan.item_name}.`);
  };

  // ------------------------------------------------------------------ calendar helpers
  const calYear = calMonth.getFullYear();
  const calMonthIdx = calMonth.getMonth();
  const daysInMonth = new Date(calYear, calMonthIdx + 1, 0).getDate();
  const firstWeekday = (new Date(calYear, calMonthIdx, 1).getDay() + 6) % 7; // Monday-first
  const calCells: (string | null)[] = [
    ...Array.from({ length: firstWeekday }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => localDateStr(new Date(calYear, calMonthIdx, i + 1))),
  ];
  while (calCells.length % 7 !== 0) calCells.push(null);

  const calItem = calItemId === 'ALL' ? null : items.find((i) => i.id === calItemId) || null;
  const calLoans = loans.filter((l) => calItemId === 'ALL' || l.item_id === calItemId);

  const dayBookings = (day: string) => calLoans.filter((l) => loanOccupiesDay(l, day, todayStr));

  const selectedDayBookings = selectedDay ? dayBookings(selectedDay) : [];

  const loanBadge = (v: LoanView) => {
    const map: Record<LoanView, string> = {
      Pending: 'bg-amber-100 text-amber-900',
      Rejected: 'bg-rose-100 text-rose-700',
      Cancelled: 'bg-slate-200 text-slate-600',
      Reserved: 'bg-sky-100 text-sky-800',
      Borrowed: 'bg-amber-100 text-amber-900',
      Late: 'bg-rose-600 text-white',
      Returned: 'bg-emerald-100 text-emerald-800',
    };
    return map[v];
  };

  const canSeeWho = (l: EquipmentLoan) => isAdmin || l.user_id === profile.id;

  // ------------------------------------------------------------------ stickers
  const openStickers = (list: EquipmentItem[]) => {
    setStickerItems(list);
    setStickerPerUnit(true);
  };

  const buildStickers = (list: EquipmentItem[]) => {
    const out: { key: string; item: EquipmentItem; unit: number; total: number }[] = [];
    list.forEach((it) => {
      const total = Math.max(1, Number(it.total_quantity) || 1);
      if (stickerPerUnit) {
        for (let u = 1; u <= Math.min(total, 200); u++) out.push({ key: `${it.id}-${u}`, item: it, unit: u, total });
      } else {
        out.push({ key: `${it.id}-0`, item: it, unit: 0, total });
      }
    });
    return out;
  };

  const stickerCards = stickerItems ? buildStickers(stickerItems) : [];

  const renderSticker = (s: { key: string; item: EquipmentItem; unit: number; total: number }) => (
    <div key={s.key} className="eq-sticker">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={qrImageUrl(equipmentQrPayload(s.item.id, s.unit || undefined), 260)} alt="" width={120} height={120} />
      <div className="eq-sticker-name">{s.item.item_name}</div>
      <div className="eq-sticker-meta">
        {s.unit ? `Unit ${s.unit} of ${s.total}` : `Qty ${s.total}`} • {s.item.location || 'Club Storage'}
      </div>
      <div className="eq-sticker-hint">Scan to BORROW / RETURN</div>
    </div>
  );

  // ====================================================================== render
  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-xl px-5 py-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Club Equipment Borrowing</h2>
            <p className="text-[11px] text-slate-500">
              {isAdmin
                ? 'Manage inventory, approve requests, print QR stickers and see who has booked what.'
                : 'Borrow now, book for a future date, and scan an item\u2019s QR sticker to borrow or return on the spot.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
            {isAdmin ? `Active Loans: ${activeLoansCount}` : `My Active Loans: ${activeLoansCount}`}
          </span>
          {isAdmin && pendingCount > 0 && (
            <button
              type="button"
              onClick={() => {
                setView('inventory');
                setLoanFilter('PENDING');
              }}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-amber-100 text-amber-900 font-extrabold border border-amber-300 cursor-pointer"
            >
              <Clock className="w-3.5 h-3.5" />
              <span>{pendingCount} Awaiting Approval</span>
            </button>
          )}
          {overdueLoansCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-extrabold border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{overdueLoansCount} Overdue</span>
            </span>
          )}
          {isAdmin && (
            <>
              <button
                type="button"
                onClick={() => openStickers(items)}
                disabled={items.length === 0}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold bg-slate-900 hover:bg-slate-800 disabled:opacity-40 text-white cursor-pointer"
              >
                <QrCode className="w-3.5 h-3.5" />
                <span>QR Stickers</span>
              </button>
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                <PlusCircle className="w-3.5 h-3.5" />
                <span>+ Add Equipment</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* View switch */}
      <div className="inline-flex bg-white/90 backdrop-blur-xl p-1 rounded-2xl border border-emerald-200/80 text-xs font-bold">
        <button
          type="button"
          onClick={() => setView('inventory')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer ${
            view === 'inventory' ? 'bg-emerald-600 text-white' : 'text-slate-600'
          }`}
        >
          <Package className="w-3.5 h-3.5" />
          <span>Inventory &amp; Loans</span>
        </button>
        <button
          type="button"
          onClick={() => setView('calendar')}
          className={`inline-flex items-center gap-1.5 px-4 py-2 rounded-xl cursor-pointer ${
            view === 'calendar' ? 'bg-emerald-600 text-white' : 'text-slate-600'
          }`}
        >
          <CalendarDays className="w-3.5 h-3.5" />
          <span>Reservation Calendar</span>
        </button>
      </div>

      {view === 'inventory' && (
        <>
          {/* Inventory grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {items.length === 0 ? (
              <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl p-6 text-center border border-emerald-100 text-xs text-slate-400">
                No equipment registered yet.
              </div>
            ) : (
              items.map((item) => {
                const inUseToday = unitsInUseOnDay(loans, item.id, todayStr, todayStr);
                const availUnits = Math.max(0, item.total_quantity - inUseToday);
                const upcoming = loans.filter(
                  (l) =>
                    l.item_id === item.id &&
                    l.borrow_date > todayStr &&
                    l.status !== 'Returned' &&
                    ['Pending', 'Approved'].includes(approvalOf(l))
                ).length;
                const needsApproval = Boolean(item.requires_approval);
                return (
                  <div
                    key={item.id}
                    className="bg-white rounded-2xl p-4 border border-emerald-200/80 shadow-2xs flex flex-col justify-between space-y-3"
                  >
                    <div className="space-y-1.5">
                      <div className="flex items-center justify-between gap-2">
                        <span className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200/60">
                          {item.category || 'Equipment'}
                        </span>
                        {isAdmin && (
                          <div className="flex items-center gap-1">
                            <button
                              type="button"
                              onClick={() => openStickers([item])}
                              className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                              title="Print QR stickers"
                            >
                              <QrCode className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => openEditModal(item)}
                              className="px-2 py-1 rounded-lg text-[11px] font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 cursor-pointer"
                              title="Edit Equipment Info"
                            >
                              <Edit3 className="w-3 h-3" />
                              <span>Edit</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteItem(item)}
                              className="p-1 text-slate-400 hover:text-rose-600 cursor-pointer"
                              title="Delete Equipment"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        )}
                      </div>

                      <h3 className="text-sm font-extrabold text-slate-900">{item.item_name}</h3>

                      <div className="flex flex-wrap items-center gap-1.5">
                        {needsApproval ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-indigo-50 text-indigo-800 border border-indigo-200">
                            <ShieldCheck className="w-3 h-3" /> Admin approval required
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-50 text-emerald-800 border border-emerald-200">
                            <Zap className="w-3 h-3" /> Instant borrow
                          </span>
                        )}
                        {upcoming > 0 && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-sky-50 text-sky-800 border border-sky-200">
                            <CalendarDays className="w-3 h-3" /> {upcoming} upcoming
                          </span>
                        )}
                      </div>

                      <div className="flex items-center gap-1 text-[11px] text-slate-500">
                        <MapPin className="w-3 h-3 text-emerald-600 shrink-0" />
                        <span>{item.location || 'Club Storage Room'}</span>
                      </div>

                      {item.notes && (
                        <p className="text-[11px] text-slate-600 bg-slate-50 px-2.5 py-1.5 rounded-lg border border-slate-100">
                          <span className="font-bold text-slate-700">Remarks:</span> {item.notes}
                        </p>
                      )}
                    </div>

                    <div className="pt-2.5 border-t border-slate-100 space-y-2">
                      <div className="text-xs">
                        <span className="text-[10px] text-slate-400 block">Free today</span>
                        <span className="font-extrabold text-emerald-700 text-sm">
                          {availUnits}{' '}
                          <span className="text-xs font-normal text-slate-400">/ {item.total_quantity}</span>
                        </span>
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          disabled={availUnits <= 0}
                          onClick={() => openBorrow(item, 'now')}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white cursor-pointer"
                        >
                          <ArrowUpRight className="w-3.5 h-3.5" />
                          <span>{availUnits <= 0 ? 'Out of Stock' : needsApproval ? 'Request' : 'Borrow'}</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => openBorrow(item, 'later')}
                          className="inline-flex items-center justify-center gap-1 px-3 py-1.5 rounded-xl text-xs font-bold bg-sky-50 hover:bg-sky-100 text-sky-900 border border-sky-200 cursor-pointer"
                        >
                          <CalendarPlus className="w-3.5 h-3.5" />
                          <span>Book Ahead</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          {/* Loans table */}
          <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-2xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <div>
                <h3 className="text-sm font-extrabold text-slate-900">
                  {isAdmin ? `All Borrower Records (${filteredLoans.length})` : `My Borrowed Equipment (${filteredLoans.length})`}
                </h3>
                <p className="text-[11px] text-slate-500">
                  {isAdmin
                    ? 'Approve requests, see who has what, and who is overdue.'
                    : 'Track your loans, reservations and return dates.'}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-2 text-xs">
                {isAdmin && (
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      placeholder="Search member or item..."
                      className="pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 text-xs w-44"
                    />
                  </div>
                )}
                <div className="flex bg-slate-100 p-1 rounded-xl">
                  {(['ALL', 'PENDING', 'ACTIVE', 'OVERDUE', 'CLOSED'] as const).map((f) => (
                    <button
                      type="button"
                      key={f}
                      onClick={() => setLoanFilter(f)}
                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                        loanFilter === f ? 'bg-emerald-600 text-white' : 'text-slate-600'
                      }`}
                    >
                      {f === 'ALL' ? 'All' : f === 'PENDING' ? 'Pending' : f === 'ACTIVE' ? 'Active' : f === 'OVERDUE' ? 'Late' : 'Closed'}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-100">
                    <th className="py-2.5 px-4">Equipment &amp; Qty</th>
                    {isAdmin && <th className="py-2.5 px-4">Borrower</th>}
                    <th className="py-2.5 px-4">Purpose</th>
                    <th className="py-2.5 px-4">Start &amp; Return Date</th>
                    <th className="py-2.5 px-4">Duration</th>
                    <th className="py-2.5 px-4">Status</th>
                    <th className="py-2.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredLoans.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 7 : 6} className="py-6 text-center text-slate-400">
                        {isAdmin ? 'No borrowing records match this filter.' : 'You have not borrowed any club equipment yet.'}
                      </td>
                    </tr>
                  ) : (
                    filteredLoans.map((loan) => {
                      const v = getLoanView(loan);
                      const dur = getDurationDetails(loan);
                      const waPhone = formatWhatsAppPhone(loan.phone_number);
                      const isMine = loan.user_id === profile.id;
                      const canCancel = (v === 'Pending' || v === 'Reserved') && (isAdmin || isMine);
                      const canReturn = (v === 'Borrowed' || v === 'Late') && (isAdmin || isMine);
                      return (
                        <tr
                          key={loan.id}
                          className={v === 'Late' ? 'bg-rose-50/70 hover:bg-rose-50' : v === 'Pending' ? 'bg-amber-50/50' : 'hover:bg-slate-50/80'}
                        >
                          <td className="py-2.5 px-4 font-bold text-slate-900">
                            {loan.item_name} <span className="text-emerald-700 font-extrabold">x{loan.quantity}</span>
                          </td>

                          {isAdmin && (
                            <td className="py-2.5 px-4">
                              <div className="font-bold text-slate-800">{loan.borrower_name}</div>
                              <div className="text-[11px] text-slate-500 font-mono">
                                {loan.matric_no} • {loan.phone_number}
                              </div>
                            </td>
                          )}

                          <td className="py-2.5 px-4 text-slate-600">{loan.purpose || '-'}</td>

                          <td className="py-2.5 px-4 font-mono text-[11px]">
                            <div>Start: {loan.borrow_date}</div>
                            <div className={v === 'Late' ? 'text-rose-700 font-extrabold' : 'text-slate-500'}>
                              Return Due: {loan.return_date}
                            </div>
                          </td>

                          <td className="py-2.5 px-4">
                            <div className="font-bold text-slate-800">{dur.heldLabel}</div>
                            <div className={`text-[11px] font-semibold ${dur.isLate ? 'text-rose-600 font-extrabold' : 'text-slate-500'}`}>
                              {dur.dueLabel}
                            </div>
                          </td>

                          <td className="py-2.5 px-4">
                            <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-bold text-[11px] ${loanBadge(v)}`}>
                              {v === 'Returned' ? <CheckCircle2 className="w-3 h-3" /> : v === 'Late' ? <AlertTriangle className="w-3 h-3" /> : v === 'Rejected' || v === 'Cancelled' ? <Ban className="w-3 h-3" /> : <Clock className="w-3 h-3" />}
                              {v === 'Pending' ? 'Awaiting Approval' : v}
                            </span>
                          </td>

                          <td className="py-2.5 px-4 text-right">
                            <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                              {isAdmin && v === 'Pending' && (
                                <>
                                  <button
                                    type="button"
                                    onClick={() => handleDecideRequest(loan, 'Approved')}
                                    className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDecideRequest(loan, 'Rejected')}
                                    className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] cursor-pointer"
                                  >
                                    Reject
                                  </button>
                                </>
                              )}
                              {isAdmin && waPhone && (v === 'Borrowed' || v === 'Late' || v === 'Pending' || v === 'Reserved') && (
                                <a
                                  href={`https://wa.me/${waPhone}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold text-[11px] bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                  title="Open WhatsApp Chat"
                                >
                                  <MessageCircle className="w-3 h-3" />
                                  <span>WhatsApp</span>
                                </a>
                              )}
                              {canCancel && (
                                <button
                                  type="button"
                                  onClick={() => handleCancelBooking(loan)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-[11px] cursor-pointer"
                                >
                                  <X className="w-3 h-3" />
                                  <span>Cancel</span>
                                </button>
                              )}
                              {canReturn && (
                                <button
                                  type="button"
                                  onClick={() => handleReturnLoan(loan)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold text-[11px] cursor-pointer"
                                >
                                  <RotateCcw className="w-3 h-3" />
                                  <span>Return</span>
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
        </>
      )}

      {view === 'calendar' && (
        <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-2xs overflow-hidden">
          <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-extrabold text-slate-900 flex items-center gap-1.5">
                <CalendarDays className="w-4 h-4 text-emerald-700" /> Equipment Reservation Calendar
              </h3>
              <p className="text-[11px] text-slate-500">
                Pick an item to see exactly how many units are free each day. Tap a day to see the bookings or reserve it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <select
                value={calItemId}
                onChange={(e) => {
                  setCalItemId(e.target.value);
                  setSelectedDay(null);
                }}
                className="rounded-xl border border-emerald-300 bg-white px-3 py-2 font-bold text-slate-900"
              >
                <option value="ALL">All equipment</option>
                {items.map((i) => (
                  <option key={i.id} value={i.id}>
                    {i.item_name} ({i.total_quantity})
                  </option>
                ))}
              </select>
              <div className="inline-flex items-center bg-slate-100 rounded-xl p-1">
                <button
                  type="button"
                  onClick={() => setCalMonth(new Date(calYear, calMonthIdx - 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-white cursor-pointer"
                  aria-label="Previous month"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <span className="px-3 font-extrabold text-slate-800 min-w-[130px] text-center">
                  {MONTH_NAMES[calMonthIdx]} {calYear}
                </span>
                <button
                  type="button"
                  onClick={() => setCalMonth(new Date(calYear, calMonthIdx + 1, 1))}
                  className="p-1.5 rounded-lg hover:bg-white cursor-pointer"
                  aria-label="Next month"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>
              <button
                type="button"
                onClick={() => {
                  const d = new Date();
                  setCalMonth(new Date(d.getFullYear(), d.getMonth(), 1));
                  setSelectedDay(todayStr);
                }}
                className="px-3 py-2 rounded-xl bg-emerald-50 text-emerald-900 border border-emerald-200 font-bold cursor-pointer"
              >
                Today
              </button>
            </div>
          </div>

          <div className="p-4 space-y-4">
            <div className="flex flex-wrap gap-3 text-[11px] text-slate-600">
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-emerald-100 border border-emerald-300" /> Free</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-amber-100 border border-amber-300" /> Partly booked</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-rose-100 border border-rose-300" /> Fully booked</span>
              <span className="inline-flex items-center gap-1"><span className="w-3 h-3 rounded bg-slate-50 border border-slate-200" /> Past</span>
            </div>

            <div className="grid grid-cols-7 gap-1.5 text-center text-[10px] font-extrabold uppercase text-slate-500">
              {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((d) => (
                <div key={d}>{d}</div>
              ))}
            </div>

            <div className="grid grid-cols-7 gap-1.5">
              {calCells.map((day, idx) => {
                if (!day) return <div key={`e-${idx}`} className="min-h-[58px]" />;
                const bookings = dayBookings(day);
                const used = calItem ? unitsInUseOnDay(calLoans, calItem.id, day, todayStr) : bookings.length;
                const total = calItem ? Number(calItem.total_quantity) : 0;
                const isPast = day < todayStr;
                const isToday = day === todayStr;
                const isSelected = day === selectedDay;
                let tone = 'bg-emerald-50 border-emerald-200 text-emerald-900';
                if (isPast) tone = 'bg-slate-50 border-slate-200 text-slate-400';
                else if (calItem) {
                  if (used >= total) tone = 'bg-rose-100 border-rose-300 text-rose-900';
                  else if (used > 0) tone = 'bg-amber-100 border-amber-300 text-amber-900';
                } else if (bookings.length > 0) {
                  tone = 'bg-amber-100 border-amber-300 text-amber-900';
                }
                return (
                  <button
                    type="button"
                    key={day}
                    onClick={() => setSelectedDay(day)}
                    className={`min-h-[58px] rounded-xl border p-1.5 text-left cursor-pointer transition hover:shadow-sm ${tone} ${
                      isSelected ? 'ring-2 ring-emerald-600' : ''
                    } ${isToday ? 'outline outline-2 outline-sky-500' : ''}`}
                  >
                    <div className="text-[11px] font-extrabold">{Number(day.slice(8))}</div>
                    <div className="text-[10px] font-semibold leading-tight mt-0.5">
                      {calItem
                        ? used > 0
                          ? `${Math.max(0, total - used)} free`
                          : isPast
                          ? ''
                          : `${total} free`
                        : bookings.length > 0
                        ? `${bookings.length} booking${bookings.length > 1 ? 's' : ''}`
                        : ''}
                    </div>
                  </button>
                );
              })}
            </div>

            {selectedDay && (
              <div className="rounded-2xl border border-slate-200 bg-slate-50/60 p-4 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900">
                    {new Date(`${selectedDay}T00:00:00`).toLocaleDateString(undefined, {
                      weekday: 'long',
                      day: 'numeric',
                      month: 'long',
                      year: 'numeric',
                    })}
                  </h4>
                  {calItem && selectedDay >= todayStr && (
                    <button
                      type="button"
                      onClick={() => openBorrow(calItem, 'later', selectedDay)}
                      className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                    >
                      <CalendarPlus className="w-3.5 h-3.5" />
                      <span>
                        {selectedDay === todayStr ? 'Borrow' : 'Reserve'} {calItem.item_name} from this day
                      </span>
                    </button>
                  )}
                </div>
                {!calItem && (
                  <p className="text-slate-500">Choose a specific item above to reserve it from this day.</p>
                )}
                {selectedDayBookings.length === 0 ? (
                  <p className="text-slate-500">No bookings on this day — everything is free.</p>
                ) : (
                  <ul className="space-y-2">
                    {selectedDayBookings.map((l) => {
                      const v = getLoanView(l);
                      return (
                        <li key={l.id} className="flex flex-wrap items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                          <div>
                            <div className="font-bold text-slate-900">
                              {l.item_name} <span className="text-emerald-700">x{l.quantity}</span>
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {canSeeWho(l) ? `${l.borrower_name}${l.purpose ? ` • ${l.purpose}` : ''}` : 'Reserved by another member'} •{' '}
                              {l.borrow_date} → {l.return_date}
                            </div>
                          </div>
                          <span className={`px-2 py-0.5 rounded-full font-bold text-[11px] ${loanBadge(v)}`}>
                            {v === 'Pending' ? 'Awaiting Approval' : v}
                          </span>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Borrow / Reserve modal */}
      {borrowTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">
                {startDate > todayStr ? 'Reserve' : borrowTarget.requires_approval ? 'Request' : 'Borrow'} — {borrowTarget.item_name}
              </h3>
              <button
                type="button"
                onClick={() => setBorrowTarget(null)}
                className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleBorrowSubmit} className="p-5 space-y-3 text-xs">
              {borrowTarget.requires_approval && (
                <div className="p-2.5 rounded-xl bg-indigo-50 border border-indigo-200 text-indigo-900 font-semibold flex items-start gap-1.5">
                  <ShieldCheck className="w-4 h-4 shrink-0" />
                  <span>This item needs admin approval. Your request holds the stock while you wait; pick it up once approved.</span>
                </div>
              )}
              {borrowTarget.notes && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                  <span className="font-bold text-slate-800">Item Remarks:</span> {borrowTarget.notes}
                </div>
              )}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Pickup / Start Date *</label>
                  <input
                    type="date"
                    min={todayStr}
                    value={startDate}
                    onChange={(e) => {
                      const v = e.target.value;
                      setStartDate(v);
                      if (returnDate < v) setReturnDate(v);
                    }}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Return Date *</label>
                  <input
                    type="date"
                    min={startDate}
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                    required
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Quantity *</label>
                <input
                  type="number"
                  min="1"
                  max={Math.max(1, rangeAvail)}
                  value={borrowQty}
                  onChange={(e) => setBorrowQty(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold"
                  required
                />
                <p className={`mt-1 font-semibold ${rangeAvail > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>
                  {rangeAvail > 0
                    ? `${rangeAvail} of ${borrowTarget.total_quantity} free for the whole period`
                    : 'Fully booked on at least one of these days — pick different dates.'}
                </p>
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Purpose / Activity *</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Weekly Training / Tournament Setup"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              {borrowError && (
                <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold flex items-start gap-1.5">
                  <AlertTriangle className="w-4 h-4 shrink-0" />
                  <span>{borrowError}</span>
                </div>
              )}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setBorrowTarget(null)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={borrowing || rangeAvail <= 0}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white cursor-pointer"
                >
                  {borrowing && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>
                    {borrowing
                      ? 'Saving...'
                      : borrowTarget.requires_approval
                      ? 'Send Request'
                      : startDate > todayStr
                      ? 'Confirm Reservation'
                      : 'Confirm Borrow'}
                  </span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Admin Add / Edit Equipment Modal */}
      {showItemModal && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <h3 className="text-sm font-bold">
                {editingItem ? `Edit Equipment — ${editingItem.item_name}` : 'Add Club Equipment'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                }}
                className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-5 space-y-3 text-xs max-h-[80vh] overflow-y-auto">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Item Name *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., DGT Chess Clocks / Chess Boards"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Total Quantity *</label>
                  <input
                    type="number"
                    min="1"
                    value={totalQty}
                    onChange={(e) => setTotalQty(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    placeholder="e.g., Chess Sets / Clocks"
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  />
                </div>
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Club Storage Room"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Handle with care, batteries included..."
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>

              <div>
                <label className="block font-bold text-emerald-900 mb-1">Borrowing Mode</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setRequiresApproval(false)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      !requiresApproval ? 'border-emerald-600 bg-emerald-50 ring-2 ring-emerald-500/20' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-extrabold flex items-center gap-1 text-slate-900">
                      <Zap className="w-3.5 h-3.5 text-emerald-600" /> Instant
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">Members borrow straight away, no approval needed.</div>
                  </button>
                  <button
                    type="button"
                    onClick={() => setRequiresApproval(true)}
                    className={`p-3 rounded-xl border text-left cursor-pointer transition ${
                      requiresApproval ? 'border-indigo-600 bg-indigo-50 ring-2 ring-indigo-500/20' : 'border-slate-200 bg-white'
                    }`}
                  >
                    <div className="font-extrabold flex items-center gap-1 text-slate-900">
                      <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" /> Needs approval
                    </div>
                    <div className="text-[11px] text-slate-500 mt-0.5">An admin must approve each request before pickup.</div>
                  </button>
                </div>
              </div>

              {itemError && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-semibold">{itemError}</div>}
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowItemModal(false);
                    setEditingItem(null);
                  }}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {savingItem && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>{editingItem ? 'Save Changes' : 'Add Equipment'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* QR sticker modal */}
      {stickerItems && isAdmin && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-950/70 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl max-w-4xl w-full overflow-hidden shadow-2xl border border-slate-200 my-8">
            <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <QrCode className="w-5 h-5 text-emerald-400 shrink-0" />
                <div className="min-w-0">
                  <h3 className="text-sm font-bold truncate">
                    QR Stickers — {stickerItems.length === 1 ? stickerItems[0].item_name : `All equipment (${stickerItems.length} items)`}
                  </h3>
                  <p className="text-[11px] text-slate-400">Stick one on every box / clock. Members scan it with the Scan QR button to borrow or return.</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setStickerItems(null)}
                className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 flex items-center justify-center cursor-pointer"
                aria-label="Close"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-5 space-y-4 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex bg-slate-100 p-1 rounded-xl font-bold">
                  <button
                    type="button"
                    onClick={() => setStickerPerUnit(true)}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${stickerPerUnit ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                  >
                    One per unit
                  </button>
                  <button
                    type="button"
                    onClick={() => setStickerPerUnit(false)}
                    className={`px-3 py-1.5 rounded-lg cursor-pointer ${!stickerPerUnit ? 'bg-emerald-600 text-white' : 'text-slate-600'}`}
                  >
                    One per item
                  </button>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-slate-500 font-semibold">{stickerCards.length} sticker(s)</span>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                  >
                    <Printer className="w-4 h-4" />
                    <span>Print Stickers</span>
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 max-h-[55vh] overflow-y-auto p-1">
                {stickerCards.map((s) => (
                  <div key={s.key} className="border border-dashed border-slate-300 rounded-xl p-3 text-center bg-white">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={qrImageUrl(equipmentQrPayload(s.item.id, s.unit || undefined), 260)}
                      alt={`QR for ${s.item.item_name}`}
                      width={110}
                      height={110}
                      className="mx-auto"
                    />
                    <div className="font-extrabold text-slate-900 mt-1.5 leading-tight">{s.item.item_name}</div>
                    <div className="text-[10px] text-slate-500">
                      {s.unit ? `Unit ${s.unit} of ${s.total}` : `Qty ${s.total}`}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Print-only sheet (portal to <body> so it prints on its own) */}
      {stickerItems &&
        typeof document !== 'undefined' &&
        createPortal(
          <div id="eq-sticker-print-wrapper">
            <style>{`
              #eq-sticker-print-wrapper { display: none; }
              @media print {
                @page { margin: 8mm; }
                body > *:not(#eq-sticker-print-wrapper) { display: none !important; }
                #eq-sticker-print-wrapper { display: block !important; background: #fff; }
                #eq-sticker-print-wrapper .eq-sheet { display: flex; flex-wrap: wrap; gap: 3mm; }
                #eq-sticker-print-wrapper .eq-sticker {
                  width: 62mm; height: 50mm; box-sizing: border-box; border: 0.3mm dashed #888;
                  border-radius: 2mm; padding: 2.5mm; text-align: center; break-inside: avoid;
                  font-family: Arial, Helvetica, sans-serif; color: #000;
                }
                #eq-sticker-print-wrapper .eq-sticker img { width: 28mm; height: 28mm; }
                #eq-sticker-print-wrapper .eq-sticker-name { font-weight: 800; font-size: 10pt; line-height: 1.1; margin-top: 1mm; }
                #eq-sticker-print-wrapper .eq-sticker-meta { font-size: 7pt; color: #333; }
                #eq-sticker-print-wrapper .eq-sticker-hint { font-size: 6.5pt; font-weight: 700; letter-spacing: 0.4px; margin-top: 0.8mm; }
              }
            `}</style>
            <div className="eq-sheet">{stickerCards.map(renderSticker)}</div>
          </div>,
          document.body
        )}
    </div>
  );
}
