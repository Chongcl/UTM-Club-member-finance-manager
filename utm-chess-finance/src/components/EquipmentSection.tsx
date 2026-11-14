'use client';

import React, { useState } from 'react';
import { supabase, EquipmentItem, EquipmentLoan, UserProfile } from '@/lib/supabase';
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
} from 'lucide-react';

interface EquipmentSectionProps {
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  profile: UserProfile;
  isAdmin: boolean;
  onRefresh: (msg: string) => void;
}

function formatWhatsAppPhone(raw: string): string {
  const digits = (raw || '').replace(/\D/g, '');
  if (!digits) return '';
  if (digits.startsWith('0')) return `60${digits.slice(1)}`;
  if (digits.startsWith('60')) return digits;
  return `60${digits}`;
}

function diffDaysBetween(startStr: string, endStr: string): number {
  const s = new Date(`${startStr}T00:00:00`).getTime();
  const e = new Date(`${endStr}T00:00:00`).getTime();
  if (isNaN(s) || isNaN(e)) return 0;
  return Math.round((e - s) / 86400000);
}

export default function EquipmentSection({
  items,
  loans,
  profile,
  isAdmin,
  onRefresh,
}: EquipmentSectionProps) {
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Sports / Chess Sets');
  const [totalQty, setTotalQty] = useState('10');
  const [location, setLocation] = useState('Club Storage Room');
  const [notes, setNotes] = useState('');
  const [savingItem, setSavingItem] = useState(false);
  const [itemError, setItemError] = useState<string | null>(null);

  const [borrowTarget, setBorrowTarget] = useState<EquipmentItem | null>(null);
  const [borrowQty, setBorrowQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [returnDate, setReturnDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [borrowing, setBorrowing] = useState(false);

  const [loanFilter, setLoanFilter] = useState<'ALL' | 'ACTIVE' | 'OVERDUE' | 'RETURNED'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');

  const todayStr = new Date().toISOString().split('T')[0];

  const isLoanOverdue = (loan: EquipmentLoan) => {
    if (loan.status === 'Returned') return false;
    if (loan.status === 'Overdue') return true;
    return Boolean(loan.return_date && loan.return_date < todayStr);
  };

  const getBorrowedUnitsForItem = (itemId: string) =>
    loans
      .filter((l) => l.item_id === itemId && l.status !== 'Returned')
      .reduce((sum, l) => sum + Number(l.quantity || 0), 0);

  const getDurationDetails = (loan: EquipmentLoan) => {
    const endDay =
      loan.status === 'Returned' && loan.returned_at
        ? loan.returned_at.split('T')[0]
        : todayStr;
    const heldDays = Math.max(1, diffDaysBetween(loan.borrow_date, endDay) + 1);

    if (loan.status === 'Returned') {
      return {
        heldLabel: `${heldDays}d total`,
        dueLabel: loan.returned_at ? `Returned ${loan.returned_at.split('T')[0]}` : 'Returned',
        isLate: false,
      };
    }

    const daysLeft = diffDaysBetween(todayStr, loan.return_date);
    if (daysLeft < 0) {
      const lateDays = Math.abs(daysLeft);
      return {
        heldLabel: `${heldDays}d borrowed`,
        dueLabel: `${lateDays}d late`,
        isLate: true,
      };
    }
    if (daysLeft === 0) {
      return {
        heldLabel: `${heldDays}d borrowed`,
        dueLabel: 'Due today',
        isLate: false,
      };
    }
    return {
      heldLabel: `${heldDays}d borrowed`,
      dueLabel: `${daysLeft}d left`,
      isLate: false,
    };
  };

  const baseLoans = isAdmin ? loans : loans.filter((l) => l.user_id === profile.id);
  const overdueLoansCount = baseLoans.filter(isLoanOverdue).length;
  const activeLoansCount = baseLoans.filter((l) => l.status !== 'Returned').length;

  const filteredLoans = baseLoans.filter((loan) => {
    const overdue = isLoanOverdue(loan);
    if (loanFilter === 'ACTIVE' && loan.status === 'Returned') return false;
    if (loanFilter === 'OVERDUE' && !overdue) return false;
    if (loanFilter === 'RETURNED' && loan.status !== 'Returned') return false;
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

  const openAddModal = () => {
    if (!isAdmin) return;
    setEditingItem(null);
    setItemName('');
    setCategory('Sports / Chess Sets');
    setTotalQty('10');
    setLocation('Club Storage Room');
    setNotes('');
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
      if (editingItem) {
        const borrowedNow = getBorrowedUnitsForItem(editingItem.id);
        const nextAvailable = Math.max(0, qty - borrowedNow);

        const fullPayload = {
          item_name: itemName.trim(),
          category: category.trim() || 'General',
          total_quantity: qty,
          available_quantity: nextAvailable,
          location: location.trim() || 'Club Storage Room',
          notes: notes.trim(),
        };

        const { error } = await supabase
          .from('equipment_items')
          .update(fullPayload)
          .eq('id', editingItem.id);

        if (error) {
          const { error: fallbackErr } = await supabase
            .from('equipment_items')
            .update({
              item_name: itemName.trim(),
              total_quantity: qty,
              available_quantity: nextAvailable,
            })
            .eq('id', editingItem.id);
          if (fallbackErr) throw fallbackErr;
        }

        setShowItemModal(false);
        setEditingItem(null);
        onRefresh(`Updated "${itemName.trim()}"!`);
      } else {
        const fullPayload = {
          item_name: itemName.trim(),
          category: category.trim() || 'General',
          total_quantity: qty,
          available_quantity: qty,
          location: location.trim() || 'Club Storage Room',
          notes: notes.trim(),
        };

        const { error } = await supabase.from('equipment_items').insert(fullPayload);
        if (error) {
          const { error: fallbackErr } = await supabase.from('equipment_items').insert({
            item_name: itemName.trim(),
            category: category.trim() || 'General',
            total_quantity: qty,
            available_quantity: qty,
            location: location.trim() || 'Club Storage Room',
          });
          if (fallbackErr) throw fallbackErr;
        }

        setShowItemModal(false);
        onRefresh(`Added "${itemName.trim()}"!`);
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
    onRefresh(`Removed "${item.item_name}".`);
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowTarget) return;
    const borrowedNow = getBorrowedUnitsForItem(borrowTarget.id);
    const realAvailable = Math.max(0, borrowTarget.total_quantity - borrowedNow);
    const qty = Math.min(realAvailable || borrowTarget.available_quantity, Math.max(1, parseInt(borrowQty) || 1));

    setBorrowing(true);
    try {
      await supabase.from('equipment_loans').insert({
        item_id: borrowTarget.id,
        item_name: borrowTarget.item_name,
        user_id: profile.id,
        borrower_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: profile.phone_number,
        quantity: qty,
        purpose: purpose.trim() || 'Club Activity',
        borrow_date: todayStr,
        return_date: returnDate,
        status: 'Borrowed',
      });
      await supabase
        .from('equipment_items')
        .update({ available_quantity: Math.max(0, realAvailable - qty) })
        .eq('id', borrowTarget.id);

      setBorrowTarget(null);
      setPurpose('');
      onRefresh(`Borrowed ${qty}x ${borrowTarget.item_name}!`);
    } finally {
      setBorrowing(false);
    }
  };

  const handleReturnLoan = async (loan: EquipmentLoan) => {
    await supabase
      .from('equipment_loans')
      .update({ status: 'Returned', returned_at: new Date().toISOString() })
      .eq('id', loan.id);

    const item = items.find((i) => i.id === loan.item_id);
    if (item) {
      const otherActiveBorrowed = loans
        .filter((l) => l.item_id === item.id && l.id !== loan.id && l.status !== 'Returned')
        .reduce((s, l) => s + Number(l.quantity || 0), 0);
      const updatedAvail = Math.min(
        item.total_quantity,
        Math.max(0, item.total_quantity - otherActiveBorrowed)
      );
      await supabase
        .from('equipment_items')
        .update({ available_quantity: updatedAvail })
        .eq('id', item.id);
    }
    onRefresh(`Returned ${loan.quantity}x ${loan.item_name}!`);
  };

  return (
    <div className="space-y-5">
      {/* Standard, Clean Header */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white/90 backdrop-blur-xl px-5 py-3.5 rounded-2xl border border-emerald-200/80 shadow-2xs">
        <div className="flex items-center gap-2.5">
          <Package className="w-4 h-4 text-emerald-700 shrink-0" />
          <div>
            <h2 className="text-sm font-extrabold text-slate-900">Club Equipment Borrowing</h2>
            <p className="text-[11px] text-slate-500">
              {isAdmin
                ? 'Manage equipment inventory, monitor borrower return dates, and track overdue items.'
                : 'Browse available club equipment and keep track of your borrowed items and return dates.'}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <span className="px-2.5 py-1 rounded-lg bg-slate-100 text-slate-700 font-bold">
            {isAdmin ? `Active Loans: ${activeLoansCount}` : `My Active Loans: ${activeLoansCount}`}
          </span>
          {overdueLoansCount > 0 && (
            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-100 text-rose-800 font-extrabold border border-rose-200">
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              <span>{overdueLoansCount} Overdue</span>
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={openAddModal}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Equipment</span>
            </button>
          )}
        </div>
      </div>

      {/* Compact Equipment Inventory Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="sm:col-span-2 lg:col-span-3 bg-white rounded-2xl p-6 text-center border border-emerald-100 text-xs text-slate-400">
            No equipment registered yet.
          </div>
        ) : (
          items.map((item) => {
            const borrowedUnits = getBorrowedUnitsForItem(item.id);
            const availUnits = Math.max(0, item.total_quantity - borrowedUnits);
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

                <div className="pt-2.5 border-t border-slate-100 flex items-center justify-between gap-2">
                  <div className="text-xs">
                    <span className="text-[10px] text-slate-400 block">Availability</span>
                    <span className="font-extrabold text-emerald-700 text-sm">
                      {availUnits}{' '}
                      <span className="text-xs font-normal text-slate-400">
                        / {item.total_quantity} left
                      </span>
                    </span>
                  </div>
                  <button
                    type="button"
                    disabled={availUnits <= 0}
                    onClick={() => {
                      setBorrowTarget({ ...item, available_quantity: availUnits });
                      setBorrowQty('1');
                    }}
                    className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 text-white cursor-pointer"
                  >
                    <ArrowUpRight className="w-3.5 h-3.5" />
                    <span>{availUnits > 0 ? 'Borrow' : 'Out of Stock'}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Borrowing Records Section (Member sees only own; Admin sees all + duration + late status) */}
      <div className="bg-white rounded-2xl border border-emerald-200/80 shadow-2xs overflow-hidden">
        <div className="p-4 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h3 className="text-sm font-extrabold text-slate-900">
              {isAdmin
                ? `All Borrower Records (${filteredLoans.length})`
                : `My Borrowed Equipment (${filteredLoans.length})`}
            </h3>
            <p className="text-[11px] text-slate-500">
              {isAdmin
                ? 'View everyone who borrowed equipment, how long they have held it, and who is overdue.'
                : 'Track the equipment you borrowed and your scheduled return dates.'}
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
              {(['ALL', 'ACTIVE', 'OVERDUE', 'RETURNED'] as const).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setLoanFilter(f)}
                  className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer ${
                    loanFilter === f ? 'bg-emerald-600 text-white' : 'text-slate-600'
                  }`}
                >
                  {f === 'ALL'
                    ? 'All'
                    : f === 'ACTIVE'
                    ? 'Active'
                    : f === 'OVERDUE'
                    ? 'Late'
                    : 'Returned'}
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
                <th className="py-2.5 px-4">Borrow &amp; Return Date</th>
                <th className="py-2.5 px-4">Duration</th>
                <th className="py-2.5 px-4">Status</th>
                <th className="py-2.5 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLoans.length === 0 ? (
                <tr>
                  <td colSpan={isAdmin ? 7 : 6} className="py-6 text-center text-slate-400">
                    {isAdmin
                      ? 'No borrowing records match this filter.'
                      : 'You have not borrowed any club equipment yet.'}
                  </td>
                </tr>
              ) : (
                filteredLoans.map((loan) => {
                  const overdue = isLoanOverdue(loan);
                  const dur = getDurationDetails(loan);
                  const waPhone = formatWhatsAppPhone(loan.phone_number);
                  return (
                    <tr
                      key={loan.id}
                      className={
                        overdue ? 'bg-rose-50/70 hover:bg-rose-50' : 'hover:bg-slate-50/80'
                      }
                    >
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        {loan.item_name}{' '}
                        <span className="text-emerald-700 font-extrabold">x{loan.quantity}</span>
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
                        <div>Borrowed: {loan.borrow_date}</div>
                        <div className={overdue ? 'text-rose-700 font-extrabold' : 'text-slate-500'}>
                          Return Due: {loan.return_date}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        <div className="font-bold text-slate-800">{dur.heldLabel}</div>
                        <div
                          className={`text-[11px] font-semibold ${
                            dur.isLate ? 'text-rose-600 font-extrabold' : 'text-slate-500'
                          }`}
                        >
                          {dur.dueLabel}
                        </div>
                      </td>

                      <td className="py-2.5 px-4">
                        {loan.status === 'Returned' ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                            <CheckCircle2 className="w-3 h-3" /> Returned
                          </span>
                        ) : overdue ? (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-rose-600 text-white font-extrabold text-[11px]">
                            <AlertTriangle className="w-3 h-3" /> Late
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold text-[11px]">
                            <Clock className="w-3 h-3" /> Borrowed
                          </span>
                        )}
                      </td>

                      <td className="py-2.5 px-4 text-right">
                        <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                          {loan.status !== 'Returned' && isAdmin && waPhone && (
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
                          {loan.status !== 'Returned' && (isAdmin || loan.user_id === profile.id) && (
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

      {/* Borrow Equipment Modal */}
      {borrowTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Borrow — {borrowTarget.item_name}</h3>
              <button
                type="button"
                onClick={() => setBorrowTarget(null)}
                className="cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBorrowSubmit} className="p-5 space-y-3 text-xs">
              {borrowTarget.notes && (
                <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-slate-600">
                  <span className="font-bold text-slate-800">Item Remarks:</span> {borrowTarget.notes}
                </div>
              )}
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Quantity (Max {borrowTarget.available_quantity}) *
                </label>
                <input
                  type="number"
                  min="1"
                  max={borrowTarget.available_quantity}
                  value={borrowQty}
                  onChange={(e) => setBorrowQty(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Return Date *
                </label>
                <input
                  type="date"
                  min={todayStr}
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Purpose / Activity *
                </label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Weekly Training / Tournament Setup"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
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
                  disabled={borrowing}
                  className="px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  {borrowing ? 'Saving...' : 'Confirm Borrow'}
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
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingItem ? `Edit Equipment — ${editingItem.item_name}` : 'Add Club Equipment'}
              </h3>
              <button
                type="button"
                onClick={() => {
                  setShowItemModal(false);
                  setEditingItem(null);
                }}
                className="cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveItem} className="p-5 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Item Name *
                </label>
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
                  <label className="block font-bold text-emerald-900 mb-1">
                    Total Quantity *
                  </label>
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
                  <label className="block font-bold text-emerald-900 mb-1">
                    Category
                  </label>
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
                <label className="block font-bold text-emerald-900 mb-1">
                  Storage Location
                </label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  placeholder="e.g., Club Storage Room"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">
                  Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="e.g., Handle with care, batteries included..."
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              {itemError && (
                <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-semibold">
                  {itemError}
                </div>
              )}
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
    </div>
  );
}