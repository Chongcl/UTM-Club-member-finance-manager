'use client';

import React, { useState, useEffect } from 'react';
import { supabase, DEFAULT_DEPARTMENTS, TicketQrMode, EventRsvp, ActivityFeePayment, isEntryPassMode } from '@/lib/supabase';
import { X, Calendar, Loader2, CheckCircle2, Car, CreditCard, QrCode, RefreshCw, ShieldCheck, ExternalLink, Sparkles, Ticket } from 'lucide-react';

export interface EditableActivity {
  id?: string; event_name: string; category: string; event_date?: string; event_time?: string;
  location?: string; registration_fee?: number; driver_allowance_per_trip?: number;
  driver_recruitment_open?: boolean; qr_code_token?: string; ticket_qr_mode?: TicketQrMode;
  description: string; status?: 'Active' | 'Closed';
}

interface BudgetModalProps {
  isOpen: boolean; onClose: () => void; onSuccess: (message: string) => void;
  initialData?: EditableActivity | null; departments?: string[]; rsvps?: EventRsvp[]; feePayments?: ActivityFeePayment[];
}

export default function BudgetModal({
  isOpen, onClose, onSuccess, initialData, departments = DEFAULT_DEPARTMENTS, rsvps = [], feePayments = [],
}: BudgetModalProps) {
  const isEditing = Boolean(initialData?.id);
  const [editTab, setEditTab] = useState<'general' | 'qr' | 'fees' | 'carpool'>('general');
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [eventTime, setEventTime] = useState('08:00 PM - 10:00 PM');
  const [location, setLocation] = useState('Student Activity Hall');
  const [registrationFee, setRegistrationFee] = useState('0');
  const [driverAllowance, setDriverAllowance] = useState('5.00');
  const [driverRecruitmentOpen, setDriverRecruitmentOpen] = useState(true);
  const [useEntryPass, setUseEntryPass] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [status, setStatus] = useState<'Active' | 'Closed'>('Active');
  const [description, setDescription] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setEditTab('general');
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
        (typeof window !== 'undefined' && initialData.id ? localStorage.getItem(`clubsync_qrmode_${initialData.id}`) : null) ||
        initialData.ticket_qr_mode ||
        (Number(feeVal) > 0 ? 'entry_pass' : 'scan_attendance');
      setUseEntryPass(isEntryPassMode(savedMode));
      setQrToken(initialData.qr_code_token || (initialData.id ? initialData.id.slice(0, 6).toUpperCase() : 'EV2026'));
      setStatus(initialData.status || 'Active');
      setDescription(initialData.description || '');
    } else {
      setEventName(''); setCategory(departments[0] || 'Member');
      setEventDate(new Date().toISOString().split('T')[0]); setEventTime('08:00 PM - 10:00 PM');
      setLocation('Student Activity Hall'); setRegistrationFee('0'); setDriverAllowance('5.00');
      setDriverRecruitmentOpen(true); setUseEntryPass(false);
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
  const modeValue: TicketQrMode = useEntryPass ? 'entry_pass' : 'scan_attendance';

  // In Entry Pass mode: Member gets QR if they paid the fee (when fee > 0) OR if Admin granted pass_approved
  const isMemberEligibleForPass = (rsvp: EventRsvp) => {
    if (rsvp.attendance !== 'Attending') return false;
    if (rsvp.pass_approved === true) return true;
    if (reqFeeNum > 0) {
      return eventPayments.some((f) => f.user_id === rsvp.user_id && f.status === 'Verified');
    }
    return false;
  };

  const venueQrPayload = `CLUBSYNC_QR::v1::${eventId}::${qrToken}`;
  const venueQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(venueQrPayload)}`;

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
        if (typeof window !== 'undefined') localStorage.setItem(`clubsync_qrmode_${eventId}`, modeValue);
        const { error } = await supabase.from('budgets').update({ ...basePayload, ticket_qr_mode: modeValue }).eq('id', eventId);
        if (error) await supabase.from('budgets').update(basePayload).eq('id', eventId);
        onSuccess(`Saved activity "${eventName.trim()}"!`);
      } else {
        const { data: created, error } = await supabase.from('budgets').insert({ ...basePayload, ticket_qr_mode: modeValue, allocated_amount: 0, spent_amount: 0 }).select('*').single();
        if (error) {
          const { data: fallback } = await supabase.from('budgets').insert({ ...basePayload, allocated_amount: 0, spent_amount: 0 }).select('*').single();
          if (fallback && typeof window !== 'undefined') localStorage.setItem(`clubsync_qrmode_${fallback.id}`, modeValue);
        } else if (created && typeof window !== 'undefined') {
          localStorage.setItem(`clubsync_qrmode_${created.id}`, modeValue);
        }
        onSuccess(`Published activity "${eventName.trim()}"!`);
      }
      onClose();
    } finally {
      setSaving(false);
    }
  };

  const handleRegenerateQr = async () => {
    const newTok = Math.random().toString(36).substring(2, 10).toUpperCase();
    setQrToken(newTok);
    if (eventId) {
      await supabase.from('budgets').update({ qr_code_token: newTok }).eq('id', eventId);
      onSuccess('Generated new QR code!');
    }
  };

  const handleToggleMemberPass = async (rsvp: EventRsvp) => {
    const nextVal = !isMemberEligibleForPass(rsvp);
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    onSuccess(`${nextVal ? 'Granted' : 'Locked'} Entry Pass QR for ${rsvp.student_name}!`);
  };

  const handleVerifyFee = async (paymentId: string, newStatus: 'Verified' | 'Rejected') => {
    await supabase.from('activity_fee_payments').update({ status: newStatus }).eq('id', paymentId);
    onSuccess(`Fee payment marked as ${newStatus}!`);
  };

  const handleAutoAssignCarpool = async () => {
    if (eventDrivers.length === 0 || unassignedPassengers.length === 0) return;
    const tracker = eventDrivers.map((d) => ({
      name: d.student_name, max: Number(d.seats_available) || 4,
      used: passengers.filter((p) => p.assigned_driver_name === d.student_name).length,
    }));
    const sorted = [...unassignedPassengers].sort((a, b) => (a.dormitory || '').localeCompare(b.dormitory || ''));
    let count = 0;
    for (const pax of sorted) {
      const drv = tracker.find((t) => t.used < t.max);
      if (!drv) break;
      await supabase.from('event_rsvps').update({ assigned_driver_name: drv.name }).eq('id', pax.id);
      drv.used += 1; count += 1;
    }
    onSuccess(`Auto-assigned ${count} passenger(s) to drivers!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 max-w-4xl w-full overflow-hidden my-8">
        <div className="bg-slate-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold">{isEditing ? `Edit Activity — ${eventName}` : 'Create New Activity'}</h2>
              <p className="text-[11px] text-slate-400">Configure event type, QR attendance vs Entry Pass, fees, and carpool</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {isEditing && (
              <div className="flex flex-wrap bg-slate-800 p-1 rounded-xl text-xs">
                <button type="button" onClick={() => setEditTab('general')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${editTab === 'general' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>1. Settings</button>
                <button type="button" onClick={() => setEditTab('qr')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${editTab === 'qr' ? 'bg-violet-600 text-white' : 'text-slate-300'}`}>2. QR &amp; Attendance ({attendingRsvps.length})</button>
                <button type="button" onClick={() => setEditTab('fees')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${editTab === 'fees' ? 'bg-amber-500 text-slate-950' : 'text-slate-300'}`}>3. Fees ({eventPayments.length})</button>
                <button type="button" onClick={() => setEditTab('carpool')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${editTab === 'carpool' ? 'bg-indigo-600 text-white' : 'text-slate-300'}`}>4. Carpool ({passengers.length}P)</button>
              </div>
            )}
            <button type="button" onClick={onClose} className="text-slate-400 hover:text-white cursor-pointer ml-1"><X className="w-5 h-5" /></button>
          </div>
        </div>

        <div className="p-6 max-h-[78vh] overflow-y-auto text-xs">
          {editTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2"><label className="block font-bold mb-1">Activity Name *</label><input type="text" value={eventName} onChange={(e) => setEventName(e.target.value)} className="w-full rounded-xl border px-3 py-2 text-sm font-bold" required /></div>
                <div><label className="block font-bold mb-1">Status</label><select value={status} onChange={(e) => setStatus(e.target.value as 'Active' | 'Closed')} className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"><option value="Active">Upcoming Activity</option><option value="Closed">Past Event</option></select></div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div><label className="block font-bold mb-1">Date *</label><input type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
                <div><label className="block font-bold mb-1">Time *</label><input type="text" value={eventTime} onChange={(e) => setEventTime(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
                <div><label className="block font-bold mb-1">Venue *</label><input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
                <div><label className="block font-bold mb-1">Department / Unit</label><select value={category} onChange={(e) => setCategory(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-semibold">{departments.map((c) => (<option key={c} value={c}>{c}</option>))}</select></div>
              </div>

              {/* Clean 2-Option Event QR Type Selector */}
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                <div>
                  <label className="block font-extrabold text-slate-900 mb-2">Select Event QR Type (Admin / Owner Control):</label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => setUseEntryPass(false)}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${!useEntryPass ? 'bg-emerald-600 text-white border-emerald-700 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="font-extrabold flex items-center gap-1.5 text-sm"><QrCode className="w-4 h-4" /><span>Option 1: Scan Attendance Only (Minimalist)</span></div>
                      <p className={`text-[11px] mt-1 ${!useEntryPass ? 'text-emerald-100' : 'text-slate-500'}`}>
                        No &quot;Entry Pass&quot; button is shown to members. Members simply scan the event QR code and attendance is recorded automatically.
                      </p>
                    </button>

                    <button
                      type="button"
                      onClick={() => setUseEntryPass(true)}
                      className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${useEntryPass ? 'bg-violet-600 text-white border-violet-700 shadow-md' : 'bg-white text-slate-800 border-slate-200 hover:bg-slate-100'}`}
                    >
                      <div className="font-extrabold flex items-center gap-1.5 text-sm"><Ticket className="w-4 h-4" /><span>Option 2: Entry Pass Ticket (Fee / Admin Grant)</span></div>
                      <p className={`text-[11px] mt-1 ${useEntryPass ? 'text-violet-100' : 'text-slate-500'}`}>
                        Members get a personal Entry Pass QR automatically after paying the event fee (or when manually granted by Admin).
                      </p>
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                  <div>
                    <label className="block font-bold text-slate-800 mb-1"><CreditCard className="w-3.5 h-3.5 inline mr-1 text-amber-600" />Activity Fee (RM) — 0 = Free (Hidden for Members)</label>
                    <input type="number" step="0.01" min="0" value={registrationFee} onChange={(e) => setRegistrationFee(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-extrabold" />
                  </div>
                  <div>
                    <label className="block font-bold text-slate-800 mb-1"><Car className="w-3.5 h-3.5 inline mr-1 text-indigo-600" />Carpool Driver RM / Trip</label>
                    <input type="number" step="0.01" min="0" value={driverAllowance} onChange={(e) => setDriverAllowance(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-extrabold" />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer"><input type="checkbox" checked={driverRecruitmentOpen} onChange={(e) => setDriverRecruitmentOpen(e.target.checked)} /><span>Enable Carpool &amp; Drivers</span></label>
                  </div>
                </div>
              </div>

              <div><label className="block font-bold mb-1">Description *</label><textarea rows={2} value={description} onChange={(e) => setDescription(e.target.value)} className="w-full rounded-xl border px-3 py-2" required /></div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" disabled={saving} className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}<span>{isEditing ? 'Save All Changes' : 'Publish Activity'}</span></button>
              </div>
            </form>
          )}

          {editTab === 'qr' && isEditing && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-slate-50 border rounded-3xl p-5 flex flex-col items-center text-center space-y-3">
                <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">Venue Attendance QR</span>
                <div className="p-3 bg-white rounded-2xl border-2 border-emerald-600"><img src={venueQrUrl} alt="Venue QR" className="w-44 h-44 object-contain" /></div>
                <p className="text-[11px] text-slate-500">Members scan this QR with their phone to automatically record attendance.</p>
                <button type="button" onClick={handleRegenerateQr} className="w-full py-2 px-3 rounded-xl font-bold bg-amber-400 text-slate-950 cursor-pointer"><RefreshCw className="w-3.5 h-3.5 inline mr-1" />Regenerate QR</button>
              </div>
              <div className="lg:col-span-8 space-y-3">
                <div className="flex justify-between items-center bg-slate-50 p-3 rounded-2xl border">
                  <span className="font-extrabold">Registered Members ({attendingRsvps.length})</span>
                  <span className={`px-2.5 py-1 rounded-lg font-bold ${useEntryPass ? 'bg-violet-100 text-violet-900' : 'bg-emerald-100 text-emerald-900'}`}>
                    Mode: {useEntryPass ? 'Entry Pass Ticket' : 'Scan Attendance Only'}
                  </span>
                </div>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Member</th><th className="py-2 px-3">Fee Status</th><th className="py-2 px-3">Attendance / Pass</th>{useEntryPass && <th className="py-2 px-3 text-right">Grant Pass</th>}</tr></thead>
                    <tbody className="divide-y">
                      {attendingRsvps.map((r) => {
                        const paid = eventPayments.find((f) => f.user_id === r.user_id && f.status === 'Verified');
                        const hasPass = isMemberEligibleForPass(r);
                        return (
                          <tr key={r.id}>
                            <td className="py-2 px-3 font-bold">{r.student_name} ({r.matric_no})</td>
                            <td className="py-2 px-3">{reqFeeNum <= 0 ? 'No Fee' : paid ? <span className="text-emerald-700 font-bold">Paid ✓</span> : <span className="text-amber-700 font-bold">Unpaid</span>}</td>
                            <td className="py-2 px-3">
                              {r.qr_checked_in ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]"><ShieldCheck className="w-3 h-3 inline mr-0.5" />Scanned &amp; Attended</span>
                              ) : useEntryPass ? (
                                hasPass ? <span className="px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 font-bold text-[10px]">✓ Entry Pass Unlocked</span> : <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">✗ Pass Locked</span>
                              ) : (
                                <span className="text-slate-400">Waiting for Scan</span>
                              )}
                            </td>
                            {useEntryPass && (
                              <td className="py-2 px-3 text-right">
                                <button type="button" onClick={() => handleToggleMemberPass(r)} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${hasPass ? 'bg-rose-50 text-rose-700' : 'bg-violet-600 text-white'}`}>{hasPass ? 'Lock Pass' : 'Grant Pass'}</button>
                              </td>
                            )}
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {editTab === 'fees' && isEditing && (
            <div className="space-y-4">
              <div className="border rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-50 border-b"><th className="py-2.5 px-3">Student</th><th className="py-2.5 px-3">Amount</th><th className="py-2.5 px-3">Status</th><th className="py-2.5 px-3 text-right">Verify / Receipt</th></tr></thead>
                  <tbody className="divide-y">
                    {eventPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-bold">{p.student_name} ({p.matric_no})</td>
                        <td className="py-2.5 px-3 font-extrabold text-emerald-700">RM {Number(p.amount_paid).toFixed(2)}</td>
                        <td className="py-2.5 px-3">{p.status}</td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <a href={p.receipt_url} target="_blank" rel="noopener noreferrer" className="px-2 py-1 rounded bg-slate-100 text-emerald-700 font-bold"><ExternalLink className="w-3 h-3 inline" /></a>
                          <button type="button" onClick={() => handleVerifyFee(p.id, 'Verified')} className="px-2.5 py-1 rounded bg-emerald-600 text-white font-bold cursor-pointer">Verify</button>
                          <button type="button" onClick={() => handleVerifyFee(p.id, 'Rejected')} className="px-2.5 py-1 rounded bg-rose-50 text-rose-700 font-bold cursor-pointer">Reject</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {editTab === 'carpool' && isEditing && (
            <div className="space-y-4">
              <div className="flex justify-between items-center bg-indigo-50 p-3.5 rounded-2xl border border-indigo-200">
                <span className="font-bold text-indigo-950">Passengers: {passengers.length} • Unassigned: {unassignedPassengers.length} • Drivers: {eventDrivers.length}</span>
                {eventDrivers.length > 0 && unassignedPassengers.length > 0 && <button type="button" onClick={handleAutoAssignCarpool} className="px-3 py-1.5 rounded-xl bg-indigo-600 text-white font-extrabold cursor-pointer"><Sparkles className="w-3.5 h-3.5 inline mr-1" />1-Click Auto-Assign</button>}
              </div>
              <div className="border rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Passenger</th><th className="py-2 px-3">Dorm</th><th className="py-2 px-3">Trip</th><th className="py-2 px-3">Assign Driver</th></tr></thead>
                  <tbody className="divide-y">
                    {passengers.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2 px-3 font-bold">{p.student_name} ({p.phone_number})</td>
                        <td className="py-2 px-3 font-bold text-indigo-700">{p.dormitory || '-'}</td>
                        <td className="py-2 px-3">{p.transport_type}</td>
                        <td className="py-2 px-3">
                          <select value={p.assigned_driver_name || ''} onChange={async (e) => { await supabase.from('event_rsvps').update({ assigned_driver_name: e.target.value }).eq('id', p.id); onSuccess('Assigned driver!'); }} className="rounded border px-2 py-1 font-bold">
                            <option value="">-- Unassigned --</option>
                            {eventDrivers.map((d) => (<option key={d.id} value={d.student_name}>{d.student_name} ({d.car_details})</option>))}
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
      </div>
    </div>
  );
}