'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  DEFAULT_DEPARTMENTS,
  TicketQrMode,
  EventRsvp,
  ActivityFeePayment,
} from '@/lib/supabase';
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
  Download,
  Phone,
} from 'lucide-react';

export interface EditableActivity {
  id?: string;
  event_name: string;
  category: string;
  event_date?: string;
  event_time?: string;
  location?: string;
  registration_fee?: number;
  driver_allowance_per_trip?: number;
  driver_recruitment_open?: boolean;
  qr_code_token?: string;
  ticket_qr_mode?: TicketQrMode;
  description: string;
  status?: 'Active' | 'Closed';
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  initialData?: EditableActivity | null;
  departments?: string[];
  rsvps?: EventRsvp[];
  feePayments?: ActivityFeePayment[];
}

export default function BudgetModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  departments = DEFAULT_DEPARTMENTS,
  rsvps = [],
  feePayments = [],
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
  const [ticketQrMode, setTicketQrMode] = useState<TicketQrMode>('all_registered');
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
        initialData.ticket_qr_mode ||
        (typeof window !== 'undefined' && initialData.id
          ? (localStorage.getItem(`clubsync_qrmode_${initialData.id}`) as TicketQrMode | null)
          : null) ||
        (Number(feeVal) > 0 ? 'paid_only' : 'all_registered');
      setTicketQrMode(savedMode);
      setQrToken(initialData.qr_code_token || (initialData.id ? initialData.id.slice(0, 6).toUpperCase() : 'EV2026'));
      setStatus(initialData.status || 'Active');
      setDescription(initialData.description || '');
    } else {
      setEventName('');
      setCategory(departments[0] || 'Member');
      setEventDate(new Date().toISOString().split('T')[0]);
      setEventTime('08:00 PM - 10:00 PM');
      setLocation('Student Activity Hall');
      setRegistrationFee('0');
      setDriverAllowance('5.00');
      setDriverRecruitmentOpen(true);
      setTicketQrMode('all_registered');
      setQrToken(Math.random().toString(36).substring(2, 8).toUpperCase());
      setStatus('Active');
      setDescription('');
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

  const isMemberEligibleForPass = (rsvp: EventRsvp) => {
    if (rsvp.attendance !== 'Attending') return false;
    if (rsvp.pass_approved === true) return true;
    if (ticketQrMode === 'manual_only') return false;
    if (ticketQrMode === 'paid_only') {
      if (reqFeeNum <= 0) return true;
      return eventPayments.some((f) => f.user_id === rsvp.user_id && f.status === 'Verified');
    }
    return true;
  };

  const venueQrPayload = `CLUBSYNC_QR::v1::${eventId}::${qrToken}`;
  const venueQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=10&data=${encodeURIComponent(venueQrPayload)}`;

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const payload = {
        event_name: eventName.trim(),
        category,
        event_date: eventDate,
        event_time: eventTime.trim(),
        location: location.trim(),
        registration_fee: reqFeeNum,
        driver_allowance_per_trip: allowanceNum,
        driver_recruitment_open: driverRecruitmentOpen,
        ticket_qr_mode: ticketQrMode,
        qr_code_token: qrToken,
        description: description.trim(),
        status,
      };
      if (isEditing && eventId) {
        if (typeof window !== 'undefined') localStorage.setItem(`clubsync_qrmode_${eventId}`, ticketQrMode);
        await supabase.from('budgets').update(payload).eq('id', eventId);
        onSuccess(`Saved all settings for "${eventName.trim()}"!`);
      } else {
        const { data: created } = await supabase
          .from('budgets')
          .insert({ ...payload, allocated_amount: 0, spent_amount: 0 })
          .select('*')
          .single();
        if (created && typeof window !== 'undefined') {
          localStorage.setItem(`clubsync_qrmode_${created.id}`, ticketQrMode);
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
      onSuccess('Regenerated new QR code! Old QR codes are now expired.');
    }
  };

  const handleToggleMemberPass = async (rsvp: EventRsvp) => {
    const currentlyHas = isMemberEligibleForPass(rsvp);
    const nextVal = !currentlyHas;
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    onSuccess(`${nextVal ? 'Granted' : 'Revoked'} QR Pass for ${rsvp.student_name}!`);
  };

  const handleVerifyFee = async (paymentId: string, newStatus: 'Verified' | 'Rejected') => {
    await supabase.from('activity_fee_payments').update({ status: newStatus }).eq('id', paymentId);
    onSuccess(`Fee payment marked as ${newStatus}!`);
  };

  const handleAutoAssignCarpool = async () => {
    if (eventDrivers.length === 0 || unassignedPassengers.length === 0) return;
    const tracker = eventDrivers.map((d) => ({
      name: d.student_name,
      max: Number(d.seats_available) || 4,
      used: passengers.filter((p) => p.assigned_driver_name === d.student_name).length,
    }));
    const sorted = [...unassignedPassengers].sort((a, b) => (a.dormitory || '').localeCompare(b.dormitory || ''));
    let count = 0;
    for (const pax of sorted) {
      const drv = tracker.find((t) => t.used < t.max);
      if (!drv) break;
      await supabase.from('event_rsvps').update({ assigned_driver_name: drv.name }).eq('id', pax.id);
      drv.used += 1;
      count += 1;
    }
    onSuccess(`Auto-assigned ${count} passenger(s) to drivers!`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-emerald-200 max-w-4xl w-full overflow-hidden my-8">
        {/* Header + 4-Tab Command Bar inside Edit Mode */}
        <div className="bg-emerald-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Calendar className="w-5 h-5 text-emerald-300" />
            <div>
              <h2 className="text-base font-bold">
                {isEditing ? `Edit Activity & Manage Ecosystem — ${eventName}` : 'Create New Activity'}
              </h2>
              <p className="text-[11px] text-emerald-200">
                Configure details, QR Pass distribution rules, fee verification, and carpool drivers in one place
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {isEditing && (
              <div className="flex flex-wrap bg-emerald-950/80 p-1 rounded-xl text-xs">
                <button
                  type="button"
                  onClick={() => setEditTab('general')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    editTab === 'general' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                  }`}
                >
                  1. Details &amp; Rules
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('qr')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    editTab === 'qr' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200'
                  }`}
                >
                  2. QR Pass &amp; Venue QR ({attendingRsvps.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('fees')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    editTab === 'fees' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                  }`}
                >
                  3. Fee Verification ({eventPayments.length})
                </button>
                <button
                  type="button"
                  onClick={() => setEditTab('carpool')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    editTab === 'carpool' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                  }`}
                >
                  4. Carpool ({passengers.length}P • {eventDrivers.length}D)
                </button>
              </div>
            )}
            <button type="button" onClick={onClose} className="text-emerald-200 hover:text-white cursor-pointer ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[78vh] overflow-y-auto text-xs">
          {/* =================================================================
              TAB 1: GENERAL DETAILS, FEE, CARPOOL & QR DISTRIBUTION MODE
             ================================================================= */}
          {editTab === 'general' && (
            <form onSubmit={handleSave} className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block font-bold text-slate-700 mb-1">Activity Name *</label>
                  <input
                    type="text"
                    value={eventName}
                    onChange={(e) => setEventName(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2 text-sm font-bold"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Status</label>
                  <select
                    value={status}
                    onChange={(e) => setStatus(e.target.value as 'Active' | 'Closed')}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm font-bold"
                  >
                    <option value="Active">Upcoming Activity</option>
                    <option value="Closed">Past Event</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Time *</label>
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Venue *</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">Department / Unit</label>
                  <select
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                    className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 font-semibold"
                  >
                    {departments.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Complete Fee, Carpool & QR Mode Settings Box */}
              <div className="p-4 rounded-2xl bg-emerald-50/90 border border-emerald-200 space-y-3.5">
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block font-bold text-emerald-950 mb-1">
                      <CreditCard className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                      Entry Fee (RM)
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={registrationFee}
                      onChange={(e) => {
                        setRegistrationFee(e.target.value);
                        if (parseFloat(e.target.value) > 0 && ticketQrMode === 'all_registered') {
                          setTicketQrMode('paid_only');
                        }
                      }}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-extrabold text-emerald-900"
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-emerald-950 mb-1">
                      <Car className="w-3.5 h-3.5 inline mr-1 text-emerald-700" />
                      Carpool Driver RM / Trip
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={driverAllowance}
                      onChange={(e) => setDriverAllowance(e.target.value)}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2 text-sm font-extrabold text-emerald-900"
                    />
                  </div>
                  <div className="flex items-end pb-2">
                    <label className="flex items-center gap-2 font-bold text-emerald-950 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={driverRecruitmentOpen}
                        onChange={(e) => setDriverRecruitmentOpen(e.target.checked)}
                      />
                      <span>Open Carpool &amp; Driver List</span>
                    </label>
                  </div>
                </div>

                <div className="pt-2 border-t border-emerald-200">
                  <label className="block font-extrabold text-emerald-950 mb-1.5">
                    <QrCode className="w-4 h-4 inline mr-1.5 text-emerald-700" />
                    How Do Members Get Their Personal Entry Pass QR Code? (Admin Control)
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        ticketQrMode === 'all_registered'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-800 border-emerald-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="qrMode"
                        checked={ticketQrMode === 'all_registered'}
                        onChange={() => setTicketQrMode('all_registered')}
                        className="hidden"
                      />
                      <div className="font-extrabold">1. Direct Member QR</div>
                      <div className={`text-[11px] mt-0.5 ${ticketQrMode === 'all_registered' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Members directly get the QR code as soon as they click &quot;Attend&quot;.
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        ticketQrMode === 'paid_only'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-800 border-emerald-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="qrMode"
                        checked={ticketQrMode === 'paid_only'}
                        onChange={() => setTicketQrMode('paid_only')}
                        className="hidden"
                      />
                      <div className="font-extrabold">2. Paid Fee Members Only</div>
                      <div className={`text-[11px] mt-0.5 ${ticketQrMode === 'paid_only' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Members automatically get the QR only after paying the fee (or Admin grant).
                      </div>
                    </label>

                    <label
                      className={`p-3 rounded-xl border cursor-pointer transition ${
                        ticketQrMode === 'manual_only'
                          ? 'bg-emerald-700 text-white border-emerald-800 shadow-xs'
                          : 'bg-white text-slate-800 border-emerald-200'
                      }`}
                    >
                      <input
                        type="radio"
                        name="qrMode"
                        checked={ticketQrMode === 'manual_only'}
                        onChange={() => setTicketQrMode('manual_only')}
                        className="hidden"
                      />
                      <div className="font-extrabold">3. Admin Manual Grant Only</div>
                      <div className={`text-[11px] mt-0.5 ${ticketQrMode === 'manual_only' ? 'text-emerald-100' : 'text-slate-500'}`}>
                        Members will NOT see any QR in their portal unless Admin grants it.
                      </div>
                    </label>
                  </div>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Activity Description *</label>
                <textarea
                  rows={2}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2"
                  required
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={onClose} className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold bg-emerald-700 hover:bg-emerald-800 text-white shadow-sm cursor-pointer"
                >
                  {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                  <span>{isEditing ? 'Save All Activity Changes' : 'Publish Activity'}</span>
                </button>
              </div>
            </form>
          )}

          {/* =================================================================
              TAB 2: QR PASS DISTRIBUTION & VENUE QR MANAGER (INSIDE EDIT MODE)
             ================================================================= */}
          {editTab === 'qr' && isEditing && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-4 bg-emerald-50/70 border border-emerald-200 rounded-3xl p-5 flex flex-col items-center text-center space-y-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-700 text-white">
                  Official Venue QR Code
                </span>
                <div className="p-3 bg-white rounded-2xl border-2 border-emerald-600">
                  <img src={venueQrUrl} alt="Venue QR" className="w-44 h-44 object-contain" />
                </div>
                <p className="text-[11px] text-slate-600">
                  Members can scan this Venue QR to record attendance, OR you can scan each member&apos;s Personal Entry Pass QR at the door.
                </p>
                <button
                  type="button"
                  onClick={handleRegenerateQr}
                  className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl font-bold bg-amber-400 text-emerald-950 cursor-pointer"
                >
                  <RefreshCw className="w-3.5 h-3.5" />
                  <span>Regenerate / Expire Old QR</span>
                </button>
              </div>

              <div className="lg:col-span-8 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2 bg-slate-50 p-3 rounded-2xl border">
                  <div>
                    <span className="font-extrabold text-slate-900 block">
                      Member QR Pass Distribution ({attendingRsvps.length} Registered)
                    </span>
                    <span className="text-[11px] text-slate-500">
                      Current Mode:{' '}
                      <strong>
                        {ticketQrMode === 'all_registered'
                          ? 'Direct Member QR'
                          : ticketQrMode === 'paid_only'
                          ? 'Paid Fee Members Only'
                          : 'Admin Manual Grant Only'}
                      </strong>
                    </span>
                  </div>
                  <select
                    value={ticketQrMode}
                    onChange={async (e) => {
                      const m = e.target.value as TicketQrMode;
                      setTicketQrMode(m);
                      if (typeof window !== 'undefined') localStorage.setItem(`clubsync_qrmode_${eventId}`, m);
                      await supabase.from('budgets').update({ ticket_qr_mode: m }).eq('id', eventId);
                      onSuccess('Updated QR Pass mode!');
                    }}
                    className="rounded-xl border border-emerald-300 bg-white px-3 py-1.5 font-bold"
                  >
                    <option value="all_registered">Mode: Direct Member QR</option>
                    <option value="paid_only">Mode: Paid Fee Only</option>
                    <option value="manual_only">Mode: Admin Manual Grant Only</option>
                  </select>
                </div>

                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                        <th className="py-2.5 px-3">Member</th>
                        <th className="py-2.5 px-3">Fee Status</th>
                        <th className="py-2.5 px-3">Portal QR Status</th>
                        <th className="py-2.5 px-3 text-right">Grant / Revoke QR</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {attendingRsvps.map((r) => {
                        const paid = eventPayments.find((f) => f.user_id === r.user_id && f.status === 'Verified');
                        const hasPass = isMemberEligibleForPass(r);
                        const cleanDigits = (r.phone_number || '').replace(/[^0-9]/g, '');
                        const waUrl = `https://wa.me/${cleanDigits.startsWith('0') ? '6' + cleanDigits : cleanDigits}?text=${encodeURIComponent(
                          `Hi ${r.student_name}, your Entry Pass QR for *${eventName}* is now unlocked in your ClubSync portal!`
                        )}`;
                        return (
                          <tr key={r.id}>
                            <td className="py-2.5 px-3 font-bold">
                              {r.student_name} <span className="font-mono text-slate-400">({r.matric_no})</span>
                            </td>
                            <td className="py-2.5 px-3">
                              {reqFeeNum <= 0 ? (
                                'Free'
                              ) : paid ? (
                                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 font-bold">
                                  Paid RM {Number(paid.amount_paid).toFixed(0)}
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 font-bold">Unpaid</span>
                              )}
                            </td>
                            <td className="py-2.5 px-3">
                              {r.qr_checked_in ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-emerald-700 text-white font-bold text-[10px]">
                                  <ShieldCheck className="w-3 h-3" />
                                  Scanned &amp; Attended
                                </span>
                              ) : hasPass ? (
                                <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                  ✓ QR Visible in Portal
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">
                                  ✗ QR Hidden / Locked
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3 text-right space-x-1">
                              <button
                                type="button"
                                onClick={() => handleToggleMemberPass(r)}
                                className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                                  hasPass ? 'bg-rose-50 text-rose-700' : 'bg-emerald-700 text-white'
                                }`}
                              >
                                {hasPass ? 'Lock / Revoke QR' : 'Grant QR Pass'}
                              </button>
                              <a
                                href={waUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 text-emerald-800 font-bold"
                              >
                                <Phone className="w-3 h-3" />
                                WhatsApp
                              </a>
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

          {/* =================================================================
              TAB 3: FEE VERIFICATION MANAGER (INSIDE EDIT MODE)
             ================================================================= */}
          {editTab === 'fees' && isEditing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 bg-emerald-50 p-4 rounded-2xl border border-emerald-200">
                <div>
                  <h4 className="font-extrabold text-sm text-emerald-950">
                    Activity Fee Verification ({eventPayments.length} Submissions)
                  </h4>
                  <p className="text-[11px] text-emerald-800">
                    Verifying a student&apos;s fee payment automatically unlocks their Personal Entry Pass QR.
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <span className="font-bold">Entry Fee (RM):</span>
                  <input
                    type="number"
                    step="0.01"
                    value={registrationFee}
                    onChange={(e) => setRegistrationFee(e.target.value)}
                    className="w-24 rounded-xl border border-emerald-300 bg-white px-3 py-1.5 font-extrabold"
                  />
                </div>
              </div>

              <div className="border rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                      <th className="py-2.5 px-3">Student</th>
                      <th className="py-2.5 px-3">Amount Paid</th>
                      <th className="py-2.5 px-3">Status</th>
                      <th className="py-2.5 px-3 text-right">Verify / Receipt</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {eventPayments.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-bold">
                          {p.student_name} ({p.matric_no})
                        </td>
                        <td className="py-2.5 px-3 font-extrabold text-emerald-700">
                          RM {Number(p.amount_paid).toFixed(2)}
                        </td>
                        <td className="py-2.5 px-3">
                          <span
                            className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                              p.status === 'Verified' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-700'
                            }`}
                          >
                            {p.status}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right space-x-1">
                          <a
                            href={p.receipt_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="px-2.5 py-1 rounded-lg bg-slate-100 text-emerald-700 font-bold"
                          >
                            Receipt <ExternalLink className="w-3 h-3 inline" />
                          </a>
                          <button
                            type="button"
                            onClick={() => handleVerifyFee(p.id, 'Verified')}
                            className="px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold cursor-pointer"
                          >
                            Verify &amp; Unlock QR
                          </button>
                          <button
                            type="button"
                            onClick={() => handleVerifyFee(p.id, 'Rejected')}
                            className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 font-bold cursor-pointer"
                          >
                            Reject
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* =================================================================
              TAB 4: CARPOOL & DRIVER ASSIGNMENT (INSIDE EDIT MODE)
             ================================================================= */}
          {editTab === 'carpool' && isEditing && (
            <div className="space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-50 p-4 rounded-2xl border border-amber-200">
                <div className="flex flex-wrap items-center gap-4 font-bold">
                  <span>Passengers: {passengers.length}</span>
                  <span>Unassigned: {unassignedPassengers.length}</span>
                  <span>Drivers: {eventDrivers.length}</span>
                </div>
                {eventDrivers.length > 0 && unassignedPassengers.length > 0 && (
                  <button
                    type="button"
                    onClick={handleAutoAssignCarpool}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-400 text-emerald-950 font-extrabold cursor-pointer"
                  >
                    <Sparkles className="w-3.5 h-3.5 inline mr-1" />
                    1-Click Auto-Assign by Dorm
                  </button>
                )}
              </div>

              <div className="border rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                      <th className="py-2.5 px-3">Passenger</th>
                      <th className="py-2.5 px-3">Dormitory Block</th>
                      <th className="py-2.5 px-3">Trip Needed</th>
                      <th className="py-2.5 px-3">Assign Driver</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {passengers.map((p) => (
                      <tr key={p.id}>
                        <td className="py-2.5 px-3 font-bold">
                          {p.student_name} ({p.phone_number})
                        </td>
                        <td className="py-2.5 px-3 font-bold text-emerald-800">{p.dormitory || '-'}</td>
                        <td className="py-2.5 px-3">{p.transport_type}</td>
                        <td className="py-2.5 px-3">
                          <select
                            value={p.assigned_driver_name || ''}
                            onChange={async (e) => {
                              await supabase
                                .from('event_rsvps')
                                .update({ assigned_driver_name: e.target.value })
                                .eq('id', p.id);
                              onSuccess('Assigned driver!');
                            }}
                            className="rounded-lg border px-2.5 py-1 font-bold"
                          >
                            <option value="">-- Unassigned --</option>
                            {eventDrivers.map((d) => (
                              <option key={d.id} value={d.student_name}>
                                {d.student_name} ({d.car_details})
                              </option>
                            ))}
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