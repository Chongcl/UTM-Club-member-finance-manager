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
  const [editingEntry, setEditingEntry] = useState<LedgerEntryItem | null>(null);
  const [entryType, setEntryType] = useState<'IN' | 'OUT'>('IN');
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Club Savings / Opening Balance');
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

  useEffect(() => {
    if (externalOpenModal && canEdit) {
      openAddModal();
      if (onCloseExternalModal) onCloseExternalModal();
    }
  }, [externalOpenModal, canEdit, onCloseExternalModal]);

  const openAddModal = () => {
    setEditingEntry(null);
    setEntryType('IN');
    setTitle('');
    setCategory('Club Savings / Opening Balance');
    setSelectedEventOption('GENERAL');
    setCustomEventName('');
    setAmount('');
    setEntryDate(new Date().toISOString().split('T')[0]);
    setNotes('');
    setAttachmentFile(null);
    setErrorMsg(null);
    setShowModal(true);
  };

  const openEditModal = (entry: LedgerEntryItem) => {
    setEditingEntry(entry);
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

  const handleSaveEntry = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) return;
    setErrorMsg(null);
    const num = parseFloat(amount);
    if (!title.trim() || isNaN(num) || num <= 0) return;

    const finalEventName =
      selectedEventOption === 'GENERAL'
        ? 'General Club Fund'
        : selectedEventOption === 'OTHER'
        ? customEventName.trim() || 'Other Event'
        : selectedEventOption;

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
        if (upErr) throw upErr;
        attachmentUrl = supabase.storage.from('receipts').getPublicUrl(safePath)
          .data.publicUrl;
        attachmentName = attachmentFile.name;
      }

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
        const { error } = await supabase
          .from('ledger_entries')
          .update(payload)
          .eq('id', editingEntry.id);
        if (error) throw error;
        onRefresh(`Updated "${title.trim()}"!`);
      } else {
        const { error } = await supabase.from('ledger_entries').insert(payload);
        if (error) throw error;
        onRefresh(`Recorded RM ${num.toFixed(2)}!`);
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

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-emerald-800 text-white rounded-3xl p-5 shadow-md">
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
            Total In minus Total Out
          </p>
        </div>

        <div className="bg-white rounded-3xl p-5 border border-emerald-200 shadow-xs">
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

        <div className="bg-white rounded-3xl p-5 border border-rose-200 shadow-xs">
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
      </div>

      <div className="bg-white rounded-3xl border border-emerald-200 shadow-xs overflow-hidden">
        <div className="p-5 border-b border-emerald-100 flex flex-wrap items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-emerald-950">
              Club Financial Ledger
            </h2>
            <p className="text-xs text-slate-500">
              {canEdit
                ? 'Add, edit, or delete club funds and expense records.'
                : 'View-Only Admin Mode: Ask the Club Owner for Finance permission to add or edit records.'}
            </p>
          </div>
          <div className="flex gap-2">
            {canEdit && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer"
              >
                <PlusCircle className="w-4 h-4" />
                <span>+ Add / Adjust Record</span>
              </button>
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
                <th className="py-3 px-4">Event</th>
                <th className="py-3 px-4">Title &amp; Category</th>
                <th className="py-3 px-4 text-right">Amount</th>
                <th className="py-3 px-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-emerald-100">
              {entries.map((e) => (
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
                    {e.event_name || 'General'}
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
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {showModal && canEdit && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-emerald-950/60 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white rounded-3xl shadow-2xl border border-emerald-200 max-w-md w-full overflow-hidden my-8">
            <div className="bg-emerald-800 text-white px-6 py-4 flex items-center justify-between">
              <h3 className="text-base font-bold">
                {editingEntry ? 'Edit Finance Record' : 'Add Finance Record'}
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
              <div className="grid grid-cols-2 gap-2 bg-emerald-50 p-1 rounded-xl border border-emerald-200">
                <button
                  type="button"
                  onClick={() => setEntryType('IN')}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    entryType === 'IN'
                      ? 'bg-emerald-700 text-white'
                      : 'text-emerald-900'
                  }`}
                >
                  + Money In / Savings
                </button>
                <button
                  type="button"
                  onClick={() => setEntryType('OUT')}
                  className={`py-2 rounded-lg text-xs font-bold cursor-pointer ${
                    entryType === 'OUT'
                      ? 'bg-rose-600 text-white'
                      : 'text-slate-700'
                  }`}
                >
                  - Expense Out
                </button>
              </div>
              <div>
                <label className="block text-xs font-bold text-emerald-900 mb-1">
                  Related Event
                </label>
                <select
                  value={selectedEventOption}
                  onChange={(e) => setSelectedEventOption(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm"
                >
                  <option value="GENERAL">General Club Fund / Savings</option>
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
                  Title *
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full rounded-xl border border-emerald-300 px-3 py-2 text-sm"
                  required
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold text-emerald-900 mb-1">
                    Amount (RM) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0.10"
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
                  Attachment (Max 50MB)
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
                  className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl text-xs font-bold bg-emerald-700 text-white cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="w-4 h-4" />
                  )}
                  <span>Save</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}