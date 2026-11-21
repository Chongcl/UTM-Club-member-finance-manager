'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  DEFAULT_DEPARTMENTS,
  TicketQrMode,
  PassApprovalRule,
  EventRsvp,
  ActivityFeePayment,
  UserProfile,
  ActivityLogEntry,
  isEntryPassMode,
} from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import {
  X,
  Calendar,
  Loader2,
  CheckCircle2,
  Car,
  CreditCard,
  QrCode,
  RefreshCw,
  ShieldCheck,
  ExternalLink,
  Sparkles,
  Ticket,
  Settings,
  Users,
  Trash2,
  History,
} from 'lucide-react';

export interface EditableActivity {
  id?: string; event_name: string; category: string; event_date?: string; event_time?: string;
  location?: string; registration_fee?: number; driver_allowance_per_trip?: number;
  driver_recruitment_open?: boolean; qr_code_token?: string; ticket_qr_mode?: TicketQrMode;
  pass_approval_rule?: PassApprovalRule; description: string; status?: 'Active' | 'Closed';
}

interface BudgetModalProps {
  isOpen: boolean; onClose: () => void; onSuccess: (message: string) => void;
  initialData?: EditableActivity | null; departments?: string[]; rsvps?: EventRsvp[]; feePayments?: ActivityFeePayment[];
  profile?: UserProfile | null; logs?: ActivityLogEntry[];
}

export default function BudgetModal({
  isOpen, onClose, onSuccess, initialData, departments = DEFAULT_DEPARTMENTS, rsvps = [], feePayments = [], profile = null, logs = [],
}: BudgetModalProps) {
  const isEditing = Boolean(initialData?.id);
  const [openSection, setOpenSection] = useState<'none' | 'settings' | 'passes' | 'fees' | 'carpool'>('none');
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('08:00 PM - 10:00 PM');
  const [location, setLocation] = useState('Student Activity Hall');
  const [registrationFee, setRegistrationFee] = useState('0');
  const [driverAllowance, setDriverAllowance] = useState('5.00');
  const [driverRecruitmentOpen, setDriverRecruitmentOpen] = useState(true);
  const [useEntryPass, setUseEntryPass] = useState(false);
  const [passRule, setPassRule] = useState<PassApprovalRule>('auto_after_payment');
  const [qrToken, setQrToken] = useState('');
  const [status, setStatus] = useState<'Active' | 'Closed'>('Active');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);
  const [localPassOverrides, setLocalPassOverrides] = useState<Record<string, boolean>>({});
  const [feeFilter, setFeeFilter] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');

  // Only initialize when modal opens or switches to a different activity ID (prevents auto-jump when granting passes!)
  const lastInitIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!isOpen) {
      lastInitIdRef.current = null;
      return;
    }
    const currentKey = initialData?.id || 'NEW';
    if (lastInitIdRef.current === currentKey) return;
    lastInitIdRef.current = currentKey;

    setOpenSection('none');
    setLocalPassOverrides({});
    if (initialData) {
      setEventName(initialData.event_name || '');
      setCategory(initialData.category || departments[0] || 'Member');
      setEventDate(initialData.event_date || new Date().toISOString().split('T')[0]);
      setEventTime(initialData.event_time || '08:00 PM - 10:00 PM');
      setLocation(initialData.location || 'Student Activity Hall');
      const feeVal = initialData.registration_fee ?? 0;
      setRegistrationFee(String(feeVal));
      setDriverAllowance(String(initialData.driver_allowance_per_trip ?? 5.0));
      setDriverRecruitmentOpen(initialData.driver_recruitment_open ?? true);
      const savedMode =
        initialData.ticket_qr_mode ||
        (Number(feeVal) > 0 ? 'entry_pass' : 'scan_attendance');
      setUseEntryPass(isEntryPassMode(savedMode));

      const savedRule =
        initialData.pass_approval_rule ||
        (savedMode === 'manual_only' ? 'manual_only' : 'auto_after_payment');
      setPassRule(savedRule);
      const hasPendingFees = feePayments.some((f) => f.budget_id === initialData.id && f.status === 'Pending');
      setFeeFilter(hasPendingFees ? 'Pending' : 'Verified');

      setQrToken(initialData.qr_code_token || (initialData.id ? initialData.id.slice(0, 6).toUpperCase() : 'EV2026'));
      setStatus(initialData.status || 'Active');
      setDescription(initialData.description || '');
    } else {
      setEventName(''); setCategory(departments[0] || 'Member');
      setEventDate(new Date().toISOString().split('T')[0]); setEventTime('08:00 PM - 10:00 PM');
      setLocation('Student Activity Hall'); setRegistrationFee('0'); setDriverAllowance('5.00');
      setDriverRecruitmentOpen(true); setUseEntryPass(false); setPassRule('auto_after_payment');
      setQrToken(Math.random().toString(36).substring(2, 8).toUpperCase());
      setStatus('Active'); setDescription('');
    }
  }, [initialData, isOpen, departments]);

  if (!isOpen) return null;

  const eventId = initialData?.id || '';
  const eventRsvps = rsvps.filter((r) => r.budget_id === eventId);
  const attendingRsvps = eventRsvps.filter((r) => r.attendance === 'Attending');
  const eventPayments = feePayments.filter((f) => f.budget_id === eventId);
  const passengers = attendingRsvps.filter((r) => r.transport_type !== 'None' && !r.is_driver);
  const unassignedPassengers = passengers.filter((p) => !p.assigned_driver_name);
  const eventDrivers = attendingRsvps.filter((r) => r.is_driver);
  const reqFeeNum = Math.max(0, parseFloat(registrationFee) || 0);
  const allowanceNum = Math.max(0, parseFloat(driverAllowance) || 0);
  const modeValue: TicketQrMode = !useEntryPass ? 'scan_attendance' : passRule === 'manual_only' ? 'manual_only' : 'entry_pass';

  const isMemberEligibleForPass = (rsvp: EventRsvp) => {
    if (rsvp.attendance !== 'Attending') return false;
    if (localPassOverrides[rsvp.id] !== undefined) return localPassOverrides[rsvp.id];
    if (passRule === 'manual_only') return rsvp.pass_approved === true;
    if (reqFeeNum > 0) {
      const hasPaid = eventPayments.some((f) => f.user_id === rsvp.user_id && f.status === 'Verified');
      return hasPaid || rsvp.pass_approved === true;
    }
    return rsvp.pass_approved === true;
  };

  const venueQrPayload = `CLUBSYNC_QR::v1::${eventId}::${qrToken}`;
  const venueQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=220x220&margin=10&data=${encodeURIComponent(venueQrPayload)}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const basePayload = {
        event_name: eventName.trim(), category, event_date: eventDate, event_time: eventTime.trim(),
        location: location.trim(), registration_fee: reqFeeNum, driver_allowance_per_trip: allowanceNum,
        driver_recruitment_open: driverRecruitmentOpen, qr_code_token: qrToken,
        description: description.trim(), status,
      };
      if (isEditing && eventId) {
        const { error } = await supabase
          .from('budgets')
          .update({ ...basePayload, ticket_qr_mode: modeValue, pass_approval_rule: passRule })
          .eq('id', eventId);
        if (error) await supabase.from('budgets').update(basePayload).eq('id', eventId);
        if (profile && initialData) {
          const changes = computeFieldChanges([
            { field: 'Activity Name', before: initialData.event_name, after: basePayload.event_name },
            { field: 'Department', before: initialData.category, after: basePayload.category },
            { field: 'Date', before: initialData.event_date || '', after: basePayload.event_date },
            { field: 'Time', before: initialData.event_time || '', after: basePayload.event_time },
            { field: 'Venue', before: initialData.location || '', after: basePayload.location },
            { field: 'Fee (RM)', before: Number(initialData.registration_fee ?? 0).toFixed(2), after: reqFeeNum.toFixed(2) },
            { field: 'Driver Allowance', before: Number(initialData.driver_allowance_per_trip ?? 5).toFixed(2), after: allowanceNum.toFixed(2) },
            { field: 'Carpool Open', before: initialData.driver_recruitment_open ?? true, after: driverRecruitmentOpen },
            { field: 'Status', before: initialData.status || 'Active', after: status },
            { field: 'Description', before: initialData.description, after: basePayload.description },
          ]);
          void recordEditHistory({
            actor: profile,
            category: 'Activities',
            table: 'budgets',
            recordId: eventId,
            recordTitle: basePayload.event_name,
            changes,
          });
        }
        onSuccess(`Saved "${eventName.trim()}"!`);
      } else {
        const { error } = await supabase
          .from('budgets')
          .insert({ ...basePayload, ticket_qr_mode: modeValue, pass_approval_rule: passRule, allocated_amount: 0, spent_amount: 0 });
        if (error) {
          await supabase.from('budgets').insert({ ...basePayload, allocated_amount: 0, spent_amount: 0 });
        }
        void emitClubNotification({
          targetUserId: null,
          type: 'activity',
          title: `New Activity: ${basePayload.event_name}`,
          body: `${basePayload.event_date}${basePayload.event_time ? ` • ${basePayload.event_time}` : ''} @ ${basePayload.location}`,
          targetTab: 'activities',
          actorName: profile?.full_name || '',
        });
        onSuccess(`Published "${eventName.trim()}"!`);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  // In-place Grant / Lock Pass (Never jumps out of the current drawer!)
  const handleToggleMemberPass = async (rsvp: EventRsvp) => {
    const nextVal = !isMemberEligibleForPass(rsvp);
    setLocalPassOverrides((prev) => ({ ...prev, [rsvp.id]: nextVal }));
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    onSuccess(`${nextVal ? 'Granted' : 'Locked'} pass for ${rsvp.student_name}.`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-8">
        <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <h2 className="text-base font-bold">{isEditing ? `Edit Activity — ${eventName}` : 'New Activity'}</h2>
          </div>
          <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <form onSubmit={handleSave} className="p-6 max-h-[80vh] overflow-y-auto space-y-4 text-xs">
          {/* Core Activity Info */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="sm:col-span-2"><label className="block font-bold mb-1">Activity Name *</label><input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" required /></div>
            <div><label className="block font-bold mb-1">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as 'Active' | 'Closed')} className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"><option value="Active">Upcoming</option><option value="Closed">Past</option></select></div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div><label className="block font-bold mb-1">Date *</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
            <div><label className="block font-bold mb-1">Time *</label><input type="text" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
            <div><label className="block font-bold mb-1">Venue *</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
            <div><label className="block font-bold mb-1">Department</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-semibold">{departments.map((c) => (<option key={c} value={c}>{c}</option>))}</select></div>
          </div>

          <div><label className="block font-bold mb-1">Description *</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>

          {/* Compact Action Buttons Bar (Hides all detailed settings & lists inside buttons until clicked) */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'settings' ? 'none' : 'settings')}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                  openSection === 'settings' ? 'bg-slate-900 text-white border-slate-900' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <Settings className="w-4 h-4 text-emerald-500" />
                <span>Event Settings ({useEntryPass ? 'Entry Pass' : 'Scan Attendance'})</span>
              </button>

              {isEditing && (
                <>
                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'passes' ? 'none' : 'passes')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                      openSection === 'passes' ? 'bg-slate-950 text-white border-slate-950' : 'bg-slate-950/90 hover:bg-slate-900 text-white border-slate-800'
                    }`}
                  >
                    <QrCode className="w-4 h-4" />
                    <span>QR &amp; Grant Pass ({attendingRsvps.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'fees' ? 'none' : 'fees')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                      openSection === 'fees' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Fee Payments ({eventPayments.length})</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'carpool' ? 'none' : 'carpool')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                      openSection === 'carpool' ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    <Users className="w-4 h-4" />
                    <span>Carpool ({passengers.length}P / {eventDrivers.length}D)</span>
                  </button>
                </>
              )}
            </div>

            {/* 1. HIDDEN SETTINGS PANEL */}
            {openSection === 'settings' && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div>
                  <label className="block font-bold text-slate-800 mb-2">Attendance Type</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <button
                      type="button"
                      onClick={() => setUseEntryPass(false)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${!useEntryPass ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-800 border-slate-200'}`}
                    >
                      <div className="font-bold flex items-center gap-1.5"><QrCode className="w-4 h-4" /><span>Scan Attendance Only</span></div>
                      <p className={`text-[11px] mt-0.5 ${!useEntryPass ? 'text-slate-300' : 'text-slate-500'}`}>Members scan the event QR to record attendance automatically.</p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseEntryPass(true)}
                      className={`p-3 rounded-xl border text-left transition cursor-pointer ${useEntryPass ? 'bg-slate-950 text-white border-slate-950' : 'bg-white text-slate-800 border-slate-200'}`}
                    >
                      <div className="font-bold flex items-center gap-1.5"><Ticket className="w-4 h-4" /><span>Entry Pass</span></div>
                      <p className={`text-[11px] mt-0.5 ${useEntryPass ? 'text-slate-300' : 'text-slate-500'}`}>Members receive a personal Entry Pass QR code.</p>
                    </button>
                  </div>
                </div>

                {/* Entry Pass Approval Rule (Auto after payment vs Manual grant) */}
                {useEntryPass && (
                  <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                    <label className="block font-bold text-slate-800">How do members receive their Entry Pass QR?</label>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${passRule === 'auto_after_payment' ? 'border-emerald-600 bg-emerald-50/60 font-bold' : 'border-slate-200'}`}>
                        <input type="radio" checked={passRule === 'auto_after_payment'} onChange={() => setPassRule('auto_after_payment')} />
                        <span>Auto-grant pass after fee payment (or Admin grant)</span>
                      </label>
                      <label className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${passRule === 'manual_only' ? 'border-emerald-600 bg-emerald-50/60 font-bold' : 'border-slate-200'}`}>
                        <input type="radio" checked={passRule === 'manual_only'} onChange={() => setPassRule('manual_only')} />
                        <span>Manual grant by Admin only</span>
                      </label>
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-700 mb-1"><CreditCard className="w-3.5 h-3.5 inline mr-1" />Activity Fee (RM)</label>
                    <input type="number" step="0.01" min="0" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-bold" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-700 mb-1"><Car className="w-3.5 h-3.5 inline mr-1" />Carpool Driver RM / Trip</label>
                    <input type="number" step="0.01" min="0" value={driverAllowance} onChange={(e) => setDriverAllowance(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-bold" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer"><input type="checkbox" checked={driverRecruitmentOpen} onChange={(e) => setDriverRecruitmentOpen(e.target.checked)} /><span>Enable Carpool</span></label>
                  </div>
                </div>
              </div>
            )}

            {/* 2. HIDDEN QR & GRANT PASS PANEL */}
            {openSection === 'passes' && isEditing && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 bg-white border rounded-2xl p-4 flex flex-col items-center text-center space-y-2">
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">Venue Attendance QR</span>
                  <img src={venueQrUrl} alt="Venue QR" className="w-36 h-36 object-contain" />
                  <button type="button" onClick={async () => { const tok = Math.random().toString(36).substring(2, 10).toUpperCase(); setQrToken(tok); await supabase.from('budgets').update({ qr_code_token: tok }).eq('id', eventId); onSuccess('Regenerated QR!'); }} className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"><RefreshCw className="w-3 h-3 inline mr-1" />Reset QR</button>
                </div>
                <div className="md:col-span-8 space-y-2">
                  <div className="font-bold text-slate-800">Attending Members ({attendingRsvps.length})</div>
                  <div className="border bg-white rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Member</th><th className="py-2 px-3">Fee</th><th className="py-2 px-3">Status</th><th className="py-2 px-3 text-right">Pass</th></tr></thead>
                      <tbody className="divide-y">
                        {attendingRsvps.map((r) => {
                          const paid = eventPayments.find((f) => f.user_id === r.user_id && f.status === 'Verified');
                          const hasPass = isMemberEligibleForPass(r);
                          return (
                            <tr key={r.id}>
                              <td className="py-2 px-3 font-bold">{r.student_name}</td>
                              <td className="py-2 px-3">{reqFeeNum <= 0 ? '-' : paid ? <span className="text-emerald-700 font-bold">Paid ✓</span> : 'Unpaid'}</td>
                              <td className="py-2 px-3">{r.qr_checked_in ? <span className="text-emerald-700 font-bold"><ShieldCheck className="w-3.5 h-3.5 inline mr-0.5" />Attended</span> : hasPass ? <span className="text-emerald-700 font-bold">✓ Active</span> : <span className="text-slate-400">Locked</span>}</td>
                              <td className="py-2 px-3 text-right">
                                <button type="button" onClick={() => handleToggleMemberPass(r)} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${hasPass ? 'bg-rose-50 text-rose-700' : 'bg-emerald-600 text-white'}`}>{hasPass ? 'Lock' : 'Grant Pass'}</button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* 3. HIDDEN FEE PAYMENTS PANEL */}
            {openSection === 'fees' && isEditing && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex p-1 rounded-xl bg-white border border-slate-200 gap-1">
                    {(['Pending', 'Verified', 'Rejected'] as const).map((st) => {
                      const cnt = eventPayments.filter((f) => f.status === st).length;
                      return (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setFeeFilter(st)}
                          className={`px-3 py-1 rounded-lg font-bold text-[11px] cursor-pointer ${
                            feeFilter === st ? 'bg-emerald-600 text-white' : 'text-slate-600 hover:bg-slate-100'
                          }`}
                        >
                          {st} ({cnt})
                        </button>
                      );
                    })}
                  </div>
                </div>
                <div className="border bg-white rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Student</th><th className="py-2 px-3">Amount</th><th className="py-2 px-3">Status</th><th className="py-2 px-3 text-right">Action</th></tr></thead>
                    <tbody className="divide-y">
                      {eventPayments.filter((p) => p.status === feeFilter).length === 0 ? (
                        <tr><td colSpan={4} className="py-5 text-center text-slate-400">No {feeFilter.toLowerCase()} fees.</td></tr>
                      ) : (
                      eventPayments.filter((p) => p.status === feeFilter).map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-bold">{p.student_name}</td>
                          <td className="py-2 px-3 font-bold text-emerald-700">RM {Number(p.amount_paid).toFixed(2)}</td>
                          <td className="py-2 px-3">{p.status}</td>
                          <td className="py-2 px-3 text-right space-x-1">
                            {p.receipt_url && (
                              <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-slate-100"><ExternalLink className="w-3 h-3 inline" /></a>
                            )}
                            {p.status !== 'Verified' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await supabase.from('activity_fee_payments').update({ status: 'Verified' }).eq('id', p.id);
                                  if (passRule === 'auto_after_payment' && p.user_id) {
                                    await supabase.from('event_rsvps').update({ pass_approved: true }).eq('budget_id', eventId).eq('user_id', p.user_id);
                                  }
                                  if (profile) {
                                    void recordEditHistory({
                                      actor: profile,
                                      category: 'Fees',
                                      table: 'activity_fee_payments',
                                      recordId: p.id,
                                      recordTitle: `${p.student_name} fee`,
                                      changes: computeFieldChanges([{ field: 'Status', before: p.status, after: 'Verified' }]),
                                    });
                                  }
                                  if (p.user_id) {
                                    void emitClubNotification({
                                      targetUserId: p.user_id,
                                      type: 'fee',
                                      title: `Fee Payment Verified — ${eventName || 'Activity'}`,
                                      body: `RM ${Number(p.amount_paid).toFixed(2)} receipt verified.${
                                        passRule === 'auto_after_payment' ? ' Your Entry Pass QR is now unlocked.' : ''
                                      }`,
                                      targetTab: 'activities',
                                      targetId: eventId,
                                      actorName: profile?.full_name || '',
                                    });
                                  }
                                  onSuccess('Verified!');
                                }}
                                className="px-2 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer"
                              >
                                Verify
                              </button>
                            )}
                            {p.status !== 'Rejected' && (
                              <button
                                type="button"
                                onClick={async () => {
                                  await supabase.from('activity_fee_payments').update({ status: 'Rejected' }).eq('id', p.id);
                                  if (profile) {
                                    void recordEditHistory({
                                      actor: profile,
                                      category: 'Fees',
                                      table: 'activity_fee_payments',
                                      recordId: p.id,
                                      recordTitle: `${p.student_name} fee`,
                                      changes: computeFieldChanges([{ field: 'Status', before: p.status, after: 'Rejected' }]),
                                    });
                                  }
                                  if (p.user_id) {
                                    void emitClubNotification({
                                      targetUserId: p.user_id,
                                      type: 'fee',
                                      title: `Fee Payment Rejected — ${eventName || 'Activity'}`,
                                      body: `Your RM ${Number(p.amount_paid).toFixed(2)} receipt was rejected. Please re-upload or contact Treasurer.`,
                                      targetTab: 'activities',
                                      targetId: eventId,
                                      actorName: profile?.full_name || '',
                                    });
                                  }
                                  onSuccess('Rejected.');
                                }}
                                className="px-2 py-1 rounded bg-rose-50 text-rose-700 font-bold cursor-pointer"
                              >
                                Reject
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => setHistoryTarget({ table: 'activity_fee_payments', recordId: p.id, title: `${p.student_name} Fee` })}
                              className="p-1 rounded bg-slate-100 text-slate-700 cursor-pointer"
                              title="History"
                            >
                              <History className="w-3 h-3 inline" />
                            </button>
                            <button
                              type="button"
                              onClick={async () => {
                                await softDeleteRecord({
                                  actor: profile,
                                  category: 'Fees',
                                  table: 'activity_fee_payments',
                                  recordId: p.id,
                                  recordTitle: `${p.student_name} — RM ${Number(p.amount_paid).toFixed(2)}`,
                                });
                                onSuccess('Removed fee record from web (kept in Supabase).');
                              }}
                              className="p-1 rounded bg-rose-50 text-rose-600 cursor-pointer"
                              title="Delete from web (kept in Supabase)"
                            >
                              <Trash2 className="w-3 h-3 inline" />
                            </button>
                          </td>
                        </tr>
                      ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>
            )}

            {/* 4. HIDDEN CARPOOL PANEL */}
            {openSection === 'carpool' && isEditing && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold">Passengers: {passengers.length} • Drivers: {eventDrivers.length}</span>
                  {eventDrivers.length > 0 && unassignedPassengers.length > 0 && (
                    <button type="button" onClick={async () => {
                      const tracker = eventDrivers.map((d) => ({ name: d.student_name, max: Number(d.seats_available) || 4, used: passengers.filter((p) => p.assigned_driver_name === d.student_name).length }));
                      for (const pax of unassignedPassengers) {
                        const drv = tracker.find((t) => t.used < t.max);
                        if (!drv) break;
                        await supabase.from('event_rsvps').update({ assigned_driver_name: drv.name }).eq('id', pax.id);
                        drv.used += 1;
                      }
                      onSuccess('Auto-assigned passengers!');
                    }} className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"><Sparkles className="w-3 h-3 inline mr-1" />Auto-Assign</button>
                  )}
                </div>
                <div className="border bg-white rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Passenger</th><th className="py-2 px-3">Dorm</th><th className="py-2 px-3">Trip</th><th className="py-2 px-3">Driver</th></tr></thead>
                    <tbody className="divide-y">
                      {passengers.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-bold">{p.student_name}</td>
                          <td className="py-2 px-3">{p.dormitory || '-'}</td>
                          <td className="py-2 px-3">{p.transport_type}</td>
                          <td className="py-2 px-3">
                            <select value={p.assigned_driver_name || ''} onChange={async (e) => {
                              const nextDriver = e.target.value;
                              await supabase.from('event_rsvps').update({ assigned_driver_name: nextDriver }).eq('id', p.id);
                              if (nextDriver && p.user_id) {
                                const drv = eventDrivers.find((d) => d.student_name === nextDriver);
                                void emitClubNotification({
                                  targetUserId: p.user_id,
                                  type: 'carpool',
                                  title: `Carpool Assigned — ${eventName || 'Activity'}`,
                                  body: `Driver: ${nextDriver}${
                                    drv?.pickup_time || drv?.pickup_point
                                      ? ` (${drv.pickup_time || 'Time TBA'} @ ${drv.pickup_point || 'Point TBA'})`
                                      : ''
                                  }`,
                                  targetTab: 'activities',
                                  targetId: eventId,
                                  actorName: profile?.full_name || '',
                                });
                              }
                              onSuccess('Assigned!');
                            }} className="rounded border px-2 py-1 font-bold">
                              <option value="">-- Unassigned --</option>
                              {eventDrivers.map((d) => (<option key={d.id} value={d.student_name}>{d.student_name}</option>))}
                            </select>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer">Cancel</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}<span>{isEditing ? 'Save Changes' : 'Publish'}</span></button>
          </div>
        </form>
      </div>
      <RecordHistoryModal
        target={historyTarget}
        logs={logs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}