'use client';

import React, { useState } from 'react';
import {
  supabase,
  EquipmentItem,
  EquipmentLoan,
  UserProfile,
} from '@/lib/supabase';
import {
  Package,
  PlusCircle,
  Edit3,
  Trash2,
  CheckCircle2,
  Download,
  Phone,
  X,
  Loader2,
  ClipboardList,
} from 'lucide-react';

interface EquipmentSectionProps {
  items: EquipmentItem[];
  loans: EquipmentLoan[];
  profile: UserProfile;
  isAdmin: boolean;
  onRefresh: (msg: string) => void;
}

export default function EquipmentSection({
  items,
  loans,
  profile,
  isAdmin,
  onRefresh,
}: EquipmentSectionProps) {
  // Admin Add/Edit Equipment Inventory Modal
  const [showItemModal, setShowItemModal] = useState(false);
  const [editingItem, setEditingItem] = useState<EquipmentItem | null>(null);
  const [itemName, setItemName] = useState('');
  const [totalQty, setTotalQty] = useState('1');
  const [itemRemarks, setItemRemarks] = useState('');
  const [savingItem, setSavingItem] = useState(false);

  // Member Borrow / Admin Edit Loan Modal
  const [showLoanModal, setShowLoanModal] = useState(false);
  const [editingLoan, setEditingLoan] = useState<EquipmentLoan | null>(null);
  const [selectedEqId, setSelectedEqId] = useState(items[0]?.id || '');
  const [borrowerName, setBorrowerName] = useState(profile.full_name);
  const [matricNo, setMatricNo] = useState(profile.matric_no);
  const [phoneNumber, setPhoneNumber] = useState(profile.phone_number);
  const [loanQty, setLoanQty] = useState('1');
  const [applicationDate, setApplicationDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [borrowDate, setBorrowDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [returnDate, setReturnDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [loanStatus, setLoanStatus] = useState<
    'Pending' | 'Borrowed' | 'Returned' | 'Overdue'
  >('Borrowed');
  const [loanRemarks, setLoanRemarks] = useState('');
  const [savingLoan, setSavingLoan] = useState(false);

  const openAddItem = () => {
    setEditingItem(null);
    setItemName('');
    setTotalQty('5');
    setItemRemarks('');
    setShowItemModal(true);
  };

  const openEditItem = (item: EquipmentItem) => {
    setEditingItem(item);
    setItemName(item.item_name);
    setTotalQty(String(item.total_quantity));
    setItemRemarks(item.remarks || '');
    setShowItemModal(true);
  };

  const handleSaveItem = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingItem(true);
    try {
      const payload = {
        item_name: itemName.trim(),
        total_quantity: Math.max(0, parseInt(totalQty) || 0),
        remarks: itemRemarks.trim(),
      };
      if (editingItem) {
        await supabase
          .from('equipment_items')
          .update(payload)
          .eq('id', editingItem.id);
        onRefresh('Equipment item updated!');
      } else {
        await supabase.from('equipment_items').insert(payload);
        onRefresh('New equipment added to inventory!');
      }
      setShowItemModal(false);
    } finally {
      setSavingItem(false);
    }
  };

  const handleDeleteItem = async (id: string) => {
    await supabase.from('equipment_items').delete().eq('id', id);
    onRefresh('Equipment item removed.');
  };

  const openNewBorrowApplication = (preselectId?: string) => {
    setEditingLoan(null);
    setSelectedEqId(preselectId || items[0]?.id || '');
    setBorrowerName(profile.full_name);
    setMatricNo(profile.matric_no);
    setPhoneNumber(profile.phone_number);
    setLoanQty('1');
    const today = new Date().toISOString().split('T')[0];
    setApplicationDate(today);
    setBorrowDate(today);
    setReturnDate(today);
    setLoanStatus('Borrowed');
    setLoanRemarks('');
    setShowLoanModal(true);
  };

  const openEditLoan = (loan: EquipmentLoan) => {
    setEditingLoan(loan);
    setSelectedEqId(loan.equipment_id);
    setBorrowerName(loan.borrower_name);
    setMatricNo(loan.matric_no);
    setPhoneNumber(loan.phone_number);
    setLoanQty(String(loan.quantity));
    setApplicationDate(loan.application_date);
    setBorrowDate(loan.borrow_date);
    setReturnDate(loan.return_date);
    setLoanStatus(loan.status);
    setLoanRemarks(loan.remarks || '');
    setShowLoanModal(true);
  };

  const handleSaveLoan = async (e: React.FormEvent) => {
    e.preventDefault();
    const eqObj = items.find((i) => i.id === selectedEqId);
    if (!eqObj) return;

    setSavingLoan(true);
    try {
      const payload = {
        equipment_id: eqObj.id,
        equipment_name: eqObj.item_name,
        user_id: editingLoan ? editingLoan.user_id : profile.id,
        borrower_name: borrowerName.trim(),
        matric_no: matricNo.trim().toUpperCase(),
        phone_number: phoneNumber.trim(),
        quantity: Math.max(1, parseInt(loanQty) || 1),
        application_date: applicationDate,
        borrow_date: borrowDate,
        return_date: returnDate,
        status: loanStatus,
        remarks: loanRemarks.trim(),
      };

      if (editingLoan) {
        await supabase
          .from('equipment_loans')
          .update(payload)
          .eq('id', editingLoan.id);
        onRefresh('Borrow record updated!');
      } else {
        await supabase.from('equipment_loans').insert(payload);
        onRefresh(`Borrowed ${payload.quantity}x ${eqObj.item_name}!`);
      }
      setShowLoanModal(false);
    } finally {
      setSavingLoan(false);
    }
  };

  const handleQuickMarkReturned = async (loanId: string) => {
    await supabase
      .from('equipment_loans')
      .update({ status: 'Returned' })
      .eq('id', loanId);
    onRefresh('Marked as Returned!');
  };

  const handleDeleteLoan = async (loanId: string) => {
    await supabase.from('equipment_loans').delete().eq('id', loanId);
    onRefresh('Borrow record removed.');
  };

  const exportEquipmentCsv = () => {
    const headers = [
      'Equipment Name',
      'Quantity',
      'Borrower Name',
      'Matric No',
      'Phone Number',
      'Application Date',
      'Borrow Date',
      'Return Date',
      'Status',
      'Remarks',
    ];
    const rows = loans.map((l) =>
      [
        l.equipment_name,
        l.quantity,
        l.borrower_name,
        l.matric_no,
        l.phone_number,
        l.application_date,
        l.borrow_date,
        l.return_date,
        l.status,
        l.remarks,
      ]
        .map((v) => `"${String(v || '').replace(/"/g, '""')}"`)
        .join(',')
    );
    const blob = new Blob([[headers.join(','), ...rows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Equipment_Borrowing_Log_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  return (
    <div className="space-y-6">
      {/* 1. EQUIPMENT INVENTORY CATALOG */}
      <div className="bg-white rounded-3xl border border-emerald-100 p-6 shadow-2xs space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="p-2.5 rounded-2xl bg-emerald-100 text-emerald-800">
              <Package className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-lg font-extrabold text-slate-900">
                Club Equipment Inventory &amp; Borrowing Hub
              </h2>
              <p className="text-xs text-slate-500">
                View available club equipment, condition remarks, and submit borrow requests.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => openNewBorrowApplication()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-800 text-white cursor-pointer"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Borrow Equipment</span>
            </button>
            {isAdmin && (
              <button
                type="button"
                onClick={openAddItem}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-amber-400 hover:bg-amber-300 text-emerald-950 cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add Inventory Item</span>
              </button>
            )}
          </div>
        </div>

        {items.length === 0 ? (
          <p className="text-xs text-slate-400 py-8 text-center">
            No equipment items listed yet.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {items.map((item) => {
              const currentlyBorrowed = loans
                .filter(
                  (l) =>
                    l.equipment_id === item.id &&
                    (l.status === 'Borrowed' || l.status === 'Overdue')
                )
                .reduce((sum, l) => sum + Number(l.quantity), 0);
              const available = Math.max(0, item.total_quantity - currentlyBorrowed);

              return (
                <div
                  key={item.id}
                  className="p-4 rounded-2xl border border-emerald-100 bg-emerald-50/30 flex flex-col justify-between space-y-3"
                >
                  <div className="space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-extrabold text-slate-900">
                        {item.item_name}
                      </h3>
                      {isAdmin && (
                        <div className="flex items-center gap-1 shrink-0">
                          <button
                            type="button"
                            onClick={() => openEditItem(item)}
                            className="p-1 rounded bg-white text-slate-600 hover:text-emerald-700 cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteItem(item.id)}
                            className="p-1 rounded bg-white text-slate-400 hover:text-rose-600 cursor-pointer"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2 text-xs">
                      <span
                        className={`px-2 py-0.5 rounded-md font-extrabold ${
                          available > 0
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        Available: {available} / {item.total_quantity}
                      </span>
                    </div>

                    {item.remarks && (
                      <p className="text-xs text-slate-600 pt-1">
                        <strong>Remark:</strong> {item.remarks}
                      </p>
                    )}
                  </div>

                  <button
                    type="button"
                    disabled={available <= 0}
                    onClick={() => openNewBorrowApplication(item.id)}
                    className="w-full py-2 rounded-xl text-xs font-bold bg-white hover:bg-emerald-700 hover:text-white text-emerald-900 border border-emerald-200 transition cursor-pointer disabled:opacity-40"
                  >
                    {available > 0 ? 'Borrow This Item' : 'All Units Borrowed Out'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* 2. BORROWING LOG & APPLICATION TRACKER */}
      <div className="bg-white rounded-3xl border border-emerald-100 overflow-hidden shadow-2xs">
        <div className="p-5 border-b border-slate-100 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <ClipboardList className="w-5 h-5 text-emerald-700" />
            <div>
              <h3 className="text-base font-extrabold text-slate-900">
                Equipment Borrowing Applications &amp; Return Log ({loans.length})
              </h3>
              <p className="text-xs text-slate-500">
                Tracks Application Date, Borrow Date, Return Date, Borrower Name, Phone &amp; Remarks.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={exportEquipmentCsv}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 cursor-pointer"
          >
            <Download className="w-4 h-4" />
            <span>Export Loans CSV</span>
          </button>
        </div>

        {loans.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">
            No equipment borrow records yet.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-[11px] font-bold uppercase text-slate-600 border-b border-slate-100">
                  <th className="py-3 px-4">Equipment &amp; Qty</th>
                  <th className="py-3 px-4">Borrower &amp; Phone</th>
                  <th className="py-3 px-4">Applied Date</th>
                  <th className="py-3 px-4">Borrow $\rightarrow$ Return Date</th>
                  <th className="py-3 px-4">Remark</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {loans.map((loan) => {
                  const canManage = isAdmin || loan.user_id === profile.id;
                  const cleanDigits = (loan.phone_number || '').replace(/[^0-9]/g, '');
                  const waUrl = `https://wa.me/${
                    cleanDigits.startsWith('0') ? '6' + cleanDigits : cleanDigits
                  }`;

                  return (
                    <tr key={loan.id} className="hover:bg-emerald-50/30">
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-900">
                          {loan.equipment_name}
                        </div>
                        <span className="text-[11px] font-extrabold text-emerald-700">
                          Qty: {loan.quantity} unit(s)
                        </span>
                      </td>
                      <td className="py-3.5 px-4">
                        <div className="font-bold text-slate-800">
                          {loan.borrower_name}{' '}
                          <span className="font-mono text-slate-400">
                            ({loan.matric_no})
                          </span>
                        </div>
                        <a
                          href={waUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 font-mono text-[11px] text-emerald-700 hover:underline"
                        >
                          <Phone className="w-3 h-3" />
                          <span>{loan.phone_number}</span>
                        </a>
                      </td>
                      <td className="py-3.5 px-4 font-mono text-slate-600">
                        {loan.application_date}
                      </td>
                      <td className="py-3.5 px-4 font-mono">
                        <span className="font-bold text-slate-800">
                          {loan.borrow_date}
                        </span>{' '}
                        $\rightarrow${' '}
                        <span className="font-bold text-emerald-800">
                          {loan.return_date}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-slate-600 max-w-xs">
                        {loan.remarks || '-'}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`px-2.5 py-0.5 rounded-full text-[11px] font-bold ${
                            loan.status === 'Returned'
                              ? 'bg-emerald-100 text-emerald-800'
                              : loan.status === 'Overdue'
                              ? 'bg-rose-100 text-rose-700'
                              : 'bg-amber-100 text-amber-900'
                          }`}
                        >
                          {loan.status}
                        </span>
                      </td>
                      <td className="py-3.5 px-4 text-right">
                        {canManage && (
                          <div className="inline-flex items-center gap-1">
                            {loan.status !== 'Returned' && (
                              <button
                                type="button"
                                onClick={() => handleQuickMarkReturned(loan.id)}
                                className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                              >
                                Return
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => openEditLoan(loan)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 cursor-pointer"
                              title="Edit Record"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            {isAdmin && (
                              <button
                                type="button"
                                onClick={() => handleDeleteLoan(loan.id)}
                                className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 cursor-pointer"
                                title="Delete Record"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* MODAL 1: ADMIN ADD / EDIT INVENTORY ITEM */}
      {showItemModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-md w-full overflow-hidden">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingItem ? 'Edit Equipment Item' : 'Add Equipment to Inventory'}
              </h3>
              <button
                type="button"
                onClick={() => setShowItemModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveItem} className="p-6 space-y-4 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Equipment Name / Type *
                </label>
                <input
                  type="text"
                  value={itemName}
                  onChange={(e) => setItemName(e.target.value)}
                  placeholder="e.g., Portable PA System / Digital Timer"
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Total Quantity Owned *
                </label>
                <input
                  type="number"
                  min="0"
                  value={totalQty}
                  onChange={(e) => setTotalQty(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                  required
                />
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Equipment Remarks / Condition Comment
                </label>
                <textarea
                  rows={2}
                  value={itemRemarks}
                  onChange={(e) => setItemRemarks(e.target.value)}
                  placeholder="e.g., Stored in Cabinet A. Handle with care."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowItemModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingItem}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-700 text-white cursor-pointer"
                >
                  {savingItem && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>Save Item</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: BORROW APPLICATION / ADMIN EDIT LOAN */}
      {showLoanModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-100 max-w-lg w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-sm font-bold">
                {editingLoan
                  ? 'Edit Equipment Borrow Record'
                  : 'Equipment Borrow Application'}
              </h3>
              <button
                type="button"
                onClick={() => setShowLoanModal(false)}
                className="text-emerald-200 hover:text-white cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveLoan} className="p-6 space-y-3.5 text-xs">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">
                    Select Equipment *
                  </label>
                  <select
                    value={selectedEqId}
                    onChange={(e) => setSelectedEqId(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                    required
                  >
                    {items.map((i) => (
                      <option key={i.id} value={i.id}>
                        {i.item_name} (Total: {i.total_quantity})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Quantity *
                  </label>
                  <input
                    type="number"
                    min="1"
                    value={loanQty}
                    onChange={(e) => setLoanQty(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Borrower Name *
                  </label>
                  <input
                    type="text"
                    value={borrowerName}
                    onChange={(e) => setBorrowerName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Matric No. *
                  </label>
                  <input
                    type="text"
                    value={matricNo}
                    onChange={(e) => setMatricNo(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Phone Number *
                  </label>
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 font-mono"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 rounded-2xl bg-emerald-50/60 border border-emerald-200">
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Application Date *
                  </label>
                  <input
                    type="date"
                    value={applicationDate}
                    onChange={(e) => setApplicationDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Borrow Date *
                  </label>
                  <input
                    type="date"
                    value={borrowDate}
                    onChange={(e) => setBorrowDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-emerald-950 mb-1">
                    Return Date *
                  </label>
                  <input
                    type="date"
                    value={returnDate}
                    onChange={(e) => setReturnDate(e.target.value)}
                    className="w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-1.5"
                    required
                  />
                </div>
              </div>

              {isAdmin && (
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Loan Status
                  </label>
                  <select
                    value={loanStatus}
                    onChange={(e) =>
                      setLoanStatus(
                        e.target.value as
                          | 'Pending'
                          | 'Borrowed'
                          | 'Returned'
                          | 'Overdue'
                      )
                    }
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-bold"
                  >
                    <option value="Pending">Pending</option>
                    <option value="Borrowed">Borrowed</option>
                    <option value="Returned">Returned</option>
                    <option value="Overdue">Overdue</option>
                  </select>
                </div>
              )}

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Purpose / Condition Remarks
                </label>
                <input
                  type="text"
                  value={loanRemarks}
                  onChange={(e) => setLoanRemarks(e.target.value)}
                  placeholder="e.g., Borrowed for Kolej booth setup..."
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setShowLoanModal(false)}
                  className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingLoan}
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl font-bold bg-emerald-700 text-white cursor-pointer"
                >
                  {savingLoan ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{editingLoan ? 'Save Changes' : 'Confirm Borrow'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}