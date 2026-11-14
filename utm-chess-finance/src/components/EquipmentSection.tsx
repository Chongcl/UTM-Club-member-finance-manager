'use client';

import React, { useState } from 'react';
import { supabase, EquipmentItem, EquipmentLoan, UserProfile } from '@/lib/supabase';
import { Package, PlusCircle, CheckCircle2, Clock, Trash2, X, Loader2, ArrowUpRight, RotateCcw, AlertTriangle, MessageCircle } from 'lucide-react';

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

export default function EquipmentSection({ items, loans, profile, isAdmin, onRefresh }: EquipmentSectionProps) {
  const [showAddModal, setShowAddModal] = useState(false);
  const [itemName, setItemName] = useState('');
  const [category, setCategory] = useState('Sports / Chess Sets');
  const [totalQty, setTotalQty] = useState('10');
  const [location, setLocation] = useState('Club Storage Room');
  const [notes, setNotes] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  const [borrowTarget, setBorrowTarget] = useState<EquipmentItem | null>(null);
  const [borrowQty, setBorrowQty] = useState('1');
  const [purpose, setPurpose] = useState('');
  const [returnDate, setReturnDate] = useState(
    new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  );
  const [borrowing, setBorrowing] = useState(false);

  const todayStr = new Date().toISOString().split('T')[0];

  const isLoanOverdue = (loan: EquipmentLoan) => {
    if (loan.status === 'Returned') return false;
    if (loan.status === 'Overdue') return true;
    return Boolean(loan.return_date && loan.return_date < todayStr);
  };

  const overdueCount = loans.filter(isLoanOverdue).length;

  const buildWhatsAppReminderUrl = (loan: EquipmentLoan, overdue: boolean) => {
    const phone = formatWhatsAppPhone(loan.phone_number);
    const msg = overdue
      ? `Hi ${loan.borrower_name} (${loan.matric_no}), friendly reminder from ClubSync that the club equipment you borrowed (${loan.quantity}x ${loan.item_name}) was due for return on ${loan.return_date}. Please return it to the club storage room as soon as possible. Thank you!`
      : `Hi ${loan.borrower_name} (${loan.matric_no}), reminder from ClubSync regarding the club equipment you borrowed (${loan.quantity}x ${loan.item_name}, due date: ${loan.return_date}). Please let us know once returned. Thank you!`;
    return `https://wa.me/${phone}?text=${encodeURIComponent(msg)}`;
  };

  const handleAddItem = async (e: React.FormEvent) => {
    e.preventDefault();
    const qty = Math.max(1, parseInt(totalQty) || 1);
    setSavingItem(true);
    try {
      const { error } = await supabase.from('equipment_items').insert({
        item_name: itemName.trim(),
        category: category.trim(),
        total_quantity: qty,
        available_quantity: qty,
        location: location.trim(),
        notes: notes.trim(),
      });
      if (!error) {
        setItemName('');
        setNotes('');
        setShowAddModal(false);
        onRefresh(`Added "${itemName.trim()}" to inventory!`);
      }
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (item: EquipmentItem) => {
    await supabase.from('equipment_items').delete().eq('id', item.id);
    onRefresh(`Removed "${item.item_name}".`);
  };

  const handleBorrowSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!borrowTarget) return;
    const qty = Math.min(borrowTarget.available_quantity, Math.max(1, parseInt(borrowQty) || 1));
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
        borrow_date: new Date().toISOString().split('T')[0],
        return_date: returnDate,
        status: 'Borrowed',
      });
      await supabase
        .from('equipment_items')
        .update({ available_quantity: Math.max(0, borrowTarget.available_quantity - qty) })
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
      await supabase
        .from('equipment_items')
        .update({
          available_quantity: Math.min(item.total_quantity, item.available_quantity + loan.quantity),
        })
        .eq('id', item.id);
    }
    onRefresh(`Returned ${loan.quantity}x ${loan.item_name}!`);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-5 rounded-3xl border border-emerald-200 shadow-xs">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-emerald-700 text-white flex items-center justify-center">
            <Package className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base font-extrabold text-emerald-950">Club Equipment &amp; Borrowing</h2>
            <p className="text-xs text-slate-500">Borrow club assets and track who holds each item</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {overdueCount > 0 && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-extrabold bg-rose-100 text-rose-800 border border-rose-300">
              <AlertTriangle className="w-4 h-4 text-rose-600" />
              <span>{overdueCount} Overdue Return{overdueCount > 1 ? 's' : ''}</span>
            </span>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => setShowAddModal(true)}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>+ Add Equipment</span>
            </button>
          )}
        </div>
      </div>

      {/* Equipment Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.length === 0 ? (
          <div className="md:col-span-3 bg-white rounded-3xl p-8 text-center border border-emerald-200 text-sm text-slate-400">
            No equipment registered yet.
          </div>
        ) : (
          items.map((item) => (
            <div key={item.id} className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs flex flex-col justify-between space-y-4">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800">
                    {item.category}
                  </span>
                  {isAdmin && (
                    <button
                      type="button"
                      onClick={() => handleDeleteItem(item)}
                      className="text-slate-400 hover:text-rose-600 cursor-pointer"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
                <h3 className="text-base font-extrabold text-slate-900 mt-2">{item.item_name}</h3>
                <p className="text-xs text-slate-500 mt-0.5">Location: {item.location}</p>
                {item.notes && <p className="text-xs text-slate-400 mt-1">{item.notes}</p>}
              </div>

              <div className="pt-3 border-t border-emerald-100 flex items-center justify-between">
                <div>
                  <span className="text-[11px] text-slate-400 block">Available</span>
                  <span className="text-lg font-extrabold text-emerald-700">
                    {item.available_quantity} <span className="text-xs text-slate-400">/ {item.total_quantity}</span>
                  </span>
                </div>
                <button
                  type="button"
                  disabled={item.available_quantity <= 0}
                  onClick={() => {
                    setBorrowTarget(item);
                    setBorrowQty('1');
                  }}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white cursor-pointer"
                >
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  <span>{item.available_quantity > 0 ? 'Borrow' : 'Out of Stock'}</span>
                </button>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Borrowing Log */}
      <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-extrabold text-emerald-950">Equipment Borrowing Log ({loans.length})</h3>
            <p className="text-xs text-slate-500">Overdue items are highlighted in red with 1-Click WhatsApp Reminder</p>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-50/70 text-[11px] font-bold uppercase text-emerald-900 border-b border-emerald-100">
                <th className="py-3 px-4">Item &amp; Qty</th>
                <th className="py-3 px-4">Borrower</th>
                <th className="py-3 px-4">Purpose</th>
                <th className="py-3 px-4">Dates</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action / Reminder</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {loans.map((loan) => {
                const overdue = isLoanOverdue(loan);
                return (
                  <tr
                    key={loan.id}
                    className={
                      overdue
                        ? 'bg-rose-50/90 hover:bg-rose-100/70 transition'
                        : 'hover:bg-emerald-50/30 transition'
                    }
                  >
                    <td className="py-3 px-4 font-bold text-slate-900">
                      {loan.item_name} <span className="text-emerald-700">x{loan.quantity}</span>
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-semibold text-slate-800">{loan.borrower_name}</div>
                      <div className="text-[11px] text-slate-500 font-mono">
                        {loan.matric_no} • {loan.phone_number}
                      </div>
                    </td>
                    <td className="py-3 px-4 text-slate-600">{loan.purpose}</td>
                    <td className="py-3 px-4 font-mono text-[11px]">
                      <div>Out: {loan.borrow_date}</div>
                      <div className={overdue ? 'text-rose-700 font-extrabold' : 'text-slate-500'}>
                        Due: {loan.return_date}
                      </div>
                    </td>
                    <td className="py-3 px-4">
                      {loan.status === 'Returned' ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold">
                          <CheckCircle2 className="w-3 h-3" /> Returned
                        </span>
                      ) : overdue ? (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-rose-600 text-white font-extrabold animate-pulse">
                          <AlertTriangle className="w-3 h-3" /> OVERDUE
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-900 font-bold">
                          <Clock className="w-3 h-3" /> Borrowed
                        </span>
                      )}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                        {loan.status !== 'Returned' && isAdmin && loan.phone_number && (
                          <a
                            href={buildWhatsAppReminderUrl(loan, overdue)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={`inline-flex items-center gap-1 px-2.5 py-1.5 rounded-xl font-bold text-[11px] shadow-2xs cursor-pointer ${
                              overdue
                                ? 'bg-rose-600 hover:bg-rose-500 text-white'
                                : 'bg-emerald-600 hover:bg-emerald-500 text-white'
                            }`}
                            title="Send 1-Click WhatsApp Return Reminder"
                          >
                            <MessageCircle className="w-3.5 h-3.5" />
                            <span>{overdue ? 'WhatsApp Overdue' : 'WhatsApp Ping'}</span>
                          </a>
                        )}
                        {loan.status !== 'Returned' && (isAdmin || loan.user_id === profile.id) && (
                          <button
                            type="button"
                            onClick={() => handleReturnLoan(loan)}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                          >
                            <RotateCcw className="w-3 h-3" /> Mark Returned
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Borrow Modal */}
      {borrowTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Borrow — {borrowTarget.item_name}</h3>
              <button type="button" onClick={() => setBorrowTarget(null)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleBorrowSubmit} className="p-6 space-y-3 text-xs">
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
                <label className="block font-bold text-emerald-900 mb-1">Expected Return Date *</label>
                <input
                  type="date"
                  value={returnDate}
                  onChange={(e) => setReturnDate(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Purpose / Event *</label>
                <input
                  type="text"
                  value={purpose}
                  onChange={(e) => setPurpose(e.target.value)}
                  placeholder="e.g., Weekly Training / Booth Setup"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setBorrowTarget(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600">
                  Cancel
                </button>
                <button type="submit" disabled={borrowing} className="px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                  {borrowing ? 'Saving...' : 'Confirm Borrow'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Add Item Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">Add Club Equipment</h3>
              <button type="button" onClick={() => setShowAddModal(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleAddItem} className="p-6 space-y-3 text-xs">
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Equipment Name *</label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., DGT Chess Clocks / Walkie-Talkie"
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Category</label>
                  <input
                    type="text"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  />
                </div>
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
              </div>
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Storage Location</label>
                <input
                  type="text"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setShowAddModal(false)} className="px-4 py-2 rounded-xl font-semibold text-slate-600">
                  Cancel
                </button>
                <button type="submit" disabled={savingItem} className="px-5 py-2 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">
                  {savingItem ? <Loader2 className="w-4 h-4 animate-spin" /> : 'Save Item'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}