'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  UserProfile,
  Claim,
  ActivityFeePayment,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/supabase';
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
  claims: Claim[];
  feePayments?: ActivityFeePayment[];
  profile: UserProfile;
  canEdit?: boolean;
  externalOpenModal?: boolean;
  onCloseExternalModal?: () => void;
  onRefresh: (msg: string) => void;
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

export default function LedgerSection({
  entries,
  events = [],
  claims,
  feePayments = [],
  profile,
  canEdit = true,
  externalOpenModal = false,
  onCloseExternalModal,
  onRefresh,
}: LedgerSectionProps) {
  const [showModal, setShowModal] = useState(false);
  const [modalMode, setModalMode] = useState<'IN' | 'OUT' | 'SET_SAVINGS'>('IN');
  const [editingEntry, setEditingEntry] = useState<LedgerEntryItem | null>(null);
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('IN');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState(IN_CATEGORIES[0]);
  const [selectedEventOption, setSelectedEventOption] = useState<string>('GENERAL');
  const [customEventName, setCustomEventName] = useState('');
  const [amount, setAmount] = useState('');
  const [entryDate, setEntryDate] = useState(
    new Date().toISOString().split('T')[0]
  );
  const [notes, setNotes] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [saving, setSaving] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const manualIn = entries
    .filter((e) => e.entry_type === 'IN')
    .reduce((s, e) => s + Number(e.amount), 0);
  const verifiedFeesIn = feePayments
    .filter((f) => f.status !== 'Rejected')
    .reduce((s, f) => s + Number(f.amount_paid), 0);
  const totalIn = manualIn + verifiedFeesIn;

  const manualOut = entries
    .filter((e) => e.entry_type === 'OUT')
    .reduce((s, e) => s + Number(e.amount), 0);
  const approvedClaimsOut = claims
    .filter((c) => c.status === 'Approved')
    .reduce((s, c) => s + Number(c.amount), 0);
  const totalOut = manualOut + approvedClaimsOut;
  const currentSavingsBalance = totalIn - totalOut;

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
    setSelectedEventOption('OTHER');
    setCustomEventName(entry.event_name || 'General Club Fund');
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
      const { error } = await supabase
        .from('ledger_entries')
        .update(fullPayload)
        .eq('id', editId);
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
        const { error: fallbackErr } = await supabase
          .from('ledger_entries')
          .insert(corePayload);
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
        const { error: upErr } = await supabase.storage
          .from('receipts')
          .upload(safePath, attachmentFile);
        if (!upErr) {
          attachmentUrl = supabase.storage.from('receipts').getPublicUrl(safePath)
            .data.publicUrl;
          attachmentName = attachmentFile.name;
        }
      }

      if (modalMode === 'SET_SAVINGS' && !editingEntry) {
        const diff = Number((num - currentSavingsBalance).toFixed(2));
        if (Math.abs(diff) < 0.01) {
          setShowModal(false);
          onRefresh(`Current Club Savings is already RM ${num.toFixed(2)}.`);
          return;
        }
        const adjType: 'IN' | 'OUT' = diff > 0 ? 'IN' : 'OUT';
        const adjAmount = Math.abs(diff);
        const payload = {
          entry_type: adjType,
          title: title.trim() || `Carry-Forward Savings Update (Target RM ${num.toFixed(2)})`,
          category: 'Carry-Forward / Opening Balance',
          event_name: 'Carry-Forward (All Batches)',
          amount: adjAmount,
          entry_date: entryDate,
          person_in_charge: `${profile.full_name} (${profile.matric_no})`,
          notes: notes.trim() || `Adjusted savings from RM ${currentSavingsBalance.toFixed(2)} to RM ${num.toFixed(2)}`,
          attachment_url: attachmentUrl,
          attachment_name: attachmentName,
        };
        await saveLedgerPayloadWithFallback(payload);
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
          ? 'General Club Fund (Carry-Forward)'
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
        onRefresh(`Updated "${title.trim()}"!`);
      } else {
        await saveLedgerPayloadWithFallback(payload);
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

  const handleDeleteEntry = async (entry: LedgerEntryItem) => {
    if (!canEdit) return;
    await supabase.from('ledger_entries').delete().eq('id', entry.id);
    onRefresh(`Deleted "${entry.title}".`);
  };

  const exportFullLedgerCsv = () => {
    const headers = [
      'Date',
      'Type',
      'Event',
      'Title',
      'Category',
      'Amount (RM)',
      'Recorded By',
      'Proof URL',
    ];
    const manualRows = entries.map((e) => [
      e.entry_date,
      e.entry_type === 'IN' ? 'MONEY IN' : 'MONEY OUT',
      e.event_name || 'General',
      e.title,
      e.category,
      Number(e.amount).toFixed(2),
      e.person_in_charge,
      e.attachment_url || '-',
    ]);
    const feeRows = feePayments
      .filter((f) => f.status !== 'Rejected')
      .map((f) => [
        f.created_at.split('T')[0],
        'FEE IN',
        'Activity Fee',
        `Fee - ${f.student_name}`,
        'Registration Fee',
        Number(f.amount_paid).toFixed(2),
        f.student_name,
        f.receipt_url,
      ]);
    const claimRows = claims
      .filter((c) => c.status === 'Approved')
      .map((c) => [
        c.expense_date,
        'CLAIM OUT',
        c.custom_event_name || 'Event Claim',
        c.title,
        c.category,
        Number(c.amount).toFixed(2),
        c.claimant_name,
        c.receipt_url,
      ]);
    const allRows = [...manualRows, ...feeRows, ...claimRows].map((r) =>
      r.map((v) => `"${String(v || '').replace(/"/g, '""')}"`).join(',')
    );
    const blob = new Blob([[headers.join(','), ...allRows].join('\n')], {
      type: 'text/csv;charset=utf-8;',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `Club_Finance_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const activeCategoryList = entryType === 'IN' ? IN_CATEGORIES : OUT_CATEGORIES;

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-800 text-white rounded-3xl p-5 shadow-md flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-emerald-200">
                Current Club Savings
              </span>
              <Wallet className="w-5 h-5 text-emerald-300" />
            </div>
            <p className="text-2xl font-extrabold mt-2">
              RM {currentSavingsBalance.toFixed(2)}
            </p>
            <p className="text-[11px] text-emerald-200 mt-1">
              Carry-Forward Balance Across All Batches
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => openAddModal('SET_SAVINGS')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Set / Update Current Savings</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">
                Total Money In
              </span>
              <TrendingUp className="w-5 h-5 text-emerald-700" />
            </div>
            <p className="text-2xl font-extrabold text-emerald-700 mt-2">
              + RM {totalIn.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Includes RM {verifiedFeesIn.toFixed(2)} activity fees
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => openAddModal('IN')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Add Money In / Carry-Forward</span>
            </button>
          )}
        </div>

        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold uppercase text-slate-500">
                Total Money Out
              </span>
              <TrendingDown className="w-5 h-5 text-rose-600" />
            </div>
            <p className="text-2xl font-extrabold text-rose-600 mt-2">
              - RM {totalOut.toFixed(2)}
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Includes RM {approvedClaimsOut.toFixed(2)} approved claims
            </p>
          </div>
          {canEdit && (
            <button
              type="button"
              onClick={() => openAddModal('OUT')}
              className="mt-3 w-full py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
            >
              <PlusCircle className="w-3.5 h-3.5" />
              <span>+ Record Expense Out</span>
            </button>
          )}
        </div>
      </div>

      <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-emerald-950">
              Club Financial Ledger (Carry-Forward Across All Batches)
            </h2>
            <p className="text-xs text-slate-500">
              {canEdit
                ? 'All club savings, carry-forward reserves, and expenses are permanently retained across batches.'
                : 'View-Only Admin Mode: Ask the Club Owner for Finance permission to add or edit records.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            {canEdit && (
              <>
                <button
                  type="button"
                  onClick={() => openAddModal('SET_SAVINGS')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Update Savings</span>
                </button>
                <button
                  type="button"
                  onClick={() => openAddModal('IN')}
                  className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 hover:bg-emerald-600 text-white cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4" />
                  <span>+ Add Record</span>
                </button>
              </>
            )}
            <button
              type="button"
              onClick={exportFullLedgerCsv}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 cursor-pointer"
            >
              <Download className="w-4 h-4" />
              <span>Export CSV</span>
            </button>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="bg-emerald-50/70 text-[11px] font-bold uppercase text-emerald-900 border-b border-emerald-100">
                <th className="py-3 px-4">Date</th>
                <th className="py-3 px-4">Type</th>
                <th className="py-3 px-4">Event / Scope</th>
                <th className="py-3 px-4">Title &amp; Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {entries.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    No ledger records yet. Click &ldquo;Set / Update Current Savings&rdquo; or &ldquo;+ Add Record&rdquo; to begin.
                  </td>
                </tr>
              ) : (
                entries.map((e) => (
                  <tr key={e.id} className="hover:bg-emerald-50/40">
                    <td className="py-3 px-4 font-mono">{e.entry_date}</td>
                    <td className="py-3 px-4">
                      <span
                        className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                          e.entry_type === 'IN'
                            ? 'bg-emerald-100 text-emerald-800'
                            : 'bg-rose-100 text-rose-700'
                        }`}
                      >
                        {e.entry_type === 'IN' ? 'Money In' : 'Expense Out'}
                      </span>
                    </td>
                    <td className="py-3 px-4 font-semibold text-emerald-900">
                      {e.event_name || 'General (Carry-Forward)'}
                    </td>
                    <td className="py-3 px-4">
                      <div className="font-bold text-slate-900">{e.title}</div>
                      <div className="text-[11px] text-slate-500">
                        {e.category} {e.notes ? `• ${e.notes}` : ''}
                      </div>
                    </td>
                    <td
                      className={`py-3 px-4 text-right font-extrabold text-sm ${
                        e.entry_type === 'IN'
                          ? 'text-emerald-700'
                          : 'text-rose-600'
                      }`}
                    >
                      {e.entry_type === 'IN' ? '+' : '-'} RM{' '}
                      {Number(e.amount).toFixed(2)}
                    </td>
                    <td className="py-3 px-4 text-right">
                      <div className="inline-flex items-center gap-1.5">
                        {e.attachment_url && (
                          <a
                            href={e.attachment_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="p-1.5 rounded-lg bg-emerald-50 text-emerald-700"
                            title="View File"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                          </a>
                        )}
                        {canEdit && (
                          <>
                            <button
                              type="button"
                              onClick={() => openEditModal(e)}
                              className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-emerald-50 cursor-pointer"
                              title="Edit"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleDeleteEntry(e)}
                              className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                              title="Delete"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
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

      {showModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-md w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingEntry
                  ? 'Edit Finance Record'
                  : modalMode === 'SET_SAVINGS'
                  ? 'Set / Update Current Club Savings'
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
                    }}
                    className={`py-2 rounded-lg text-[11px] font-bold cursor-pointer ${
                      modalMode === 'SET_SAVINGS'
                        ? 'bg-emerald-800 text-white'
                        : 'text-emerald-900'
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
                      modalMode === 'IN'
                        ? 'bg-emerald-600 text-white'
                        : 'text-emerald-900'
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
                      modalMode === 'OUT'
                        ? 'bg-rose-600 text-white'
                        : 'text-slate-700'
                    }`}
                  >
                    - Expense Out
                  </button>
                </div>
              )}

              {modalMode === 'SET_SAVINGS' && !editingEntry ? (
                <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2 text-xs">
                  <div className="flex justify-between">
                    <span className="text-slate-600 font-semibold">Current Calculated Balance:</span>
                    <span className="font-mono font-extrabold text-emerald-900">RM {currentSavingsBalance.toFixed(2)}</span>
                  </div>
                  <p className="text-[11px] text-emerald-800">
                    Enter the exact total savings your club currently holds. The system will automatically record a Carry-Forward adjustment so your balance carries forward across all batches.
                  </p>
                </div>
              ) : (
                <>
                  <div>
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Category
                    </label>
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
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Related Event / Scope
                    </label>
                    <select
                      value={selectedEventOption}
                      onChange={(e) => setSelectedEventOption(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm"
                    >
                      <option value="GENERAL">General Club Fund (Carry-Forward All Batches)</option>
                      {events.map((ev) => (
                        <option key={ev.id} value={ev.event_name}>
                          {ev.event_name}
                        </option>
                      ))}
                      <option value="OTHER">Other (Type Custom Name)</option>
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
                    <label className="block text-xs font-bold text-emerald-900 mb-1">
                      Title / Description *
                    </label>
                    <input
                      type="text"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder={entryType === 'IN' ? 'e.g., Batch Carry-Forward / Sponsorship' : 'e.g., Tournament Refreshments'}
                      className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                      required
                    />
                  </div>
                </>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    {modalMode === 'SET_SAVINGS' && !editingEntry ? 'New Total Savings (RM) *' : 'Amount (RM) *'}
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
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Date *
                  </label>
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
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Attachment / Proof (Max 50MB)
                </label>
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) =>
                    setAttachmentFile(e.target.files?.[0] || null)
                  }
                  className="w-full text-xs text-slate-600 file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Remarks
                </label>
                <input
                  type="text"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Optional notes..."
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                />
              </div>
              {errorMsg && (
                <div className="text-xs text-red-600 bg-red-50 p-2 rounded-lg">
                  {errorMsg}
                </div>
              )}
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
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>{modalMode === 'SET_SAVINGS' && !editingEntry ? 'Update Savings' : 'Save Record'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}