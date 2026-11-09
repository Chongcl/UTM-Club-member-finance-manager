'use client';

import React, { useState, useEffect } from 'react';
import {
  supabase,
  Budget,
  UserProfile,
  EventRsvp,
  ActivityFeePayment,
  AdminPermissions,
  TicketQrMode,
  MAX_FILE_SIZE_BYTES,
} from '@/lib/supabase';
import {
  X,
  CreditCard,
  Car,
  CheckCircle2,
  ExternalLink,
  Download,
  Phone,
  Copy,
  RefreshCw,
  Ticket,
  ShieldCheck,
  Lock,
  Camera,
  Sparkles,
} from 'lucide-react';

interface EventOperationsModalProps {
  event: Budget | null;
  initialTab: 'fee' | 'transport' | 'qr' | 'pass';
  profile: UserProfile;
  isAdmin: boolean;
  permissions: AdminPermissions;
  rsvps: EventRsvp[];
  feePayments: ActivityFeePayment[];
  onClose: () => void;
  onOpenScanner?: () => void;
  onRefresh: (msg: string) => void;
}

type TransportSurveyChoice = 'OWN' | 'One-Way' | 'Return Trip' | 'Round Trip' | 'DRIVER';

export default function EventOperationsModal({
  event,
  initialTab,
  profile,
  isAdmin,
  permissions,
  rsvps,
  feePayments,
  onClose,
  onOpenScanner,
  onRefresh,
}: EventOperationsModalProps) {
  const [tab, setTab] = useState<'fee' | 'transport' | 'qr' | 'pass'>(!isAdmin && initialTab === 'qr' ? 'pass' : initialTab);
  const [amountPaid, setAmountPaid] = useState('0');
  const [feeFile, setFeeFile] = useState<File | null>(null);
  const [surveyChoice, setSurveyChoice] = useState<TransportSurveyChoice>('OWN');
  const [dormitoryInput, setDormitoryInput] = useState('');
  const [carDetails, setCarDetails] = useState('');
  const [seatsAvailable, setSeatsAvailable] = useState('4');
  const [tripsCount, setTripsCount] = useState('1');
  const [qrToken, setQrToken] = useState('');
  const [ticketMode, setTicketMode] = useState<TicketQrMode>('all_registered');

  useEffect(() => {
    setTab(!isAdmin && initialTab === 'qr' ? 'pass' : initialTab);
    if (event) {
      const feeVal = Number(event.registration_fee || 0);
      setAmountPaid(String(feeVal));
      setQrToken(event.qr_code_token || event.id.slice(0, 6).toUpperCase());

      // Strict fallback: read DB ticket_qr_mode or localStorage override, or default to 'paid_only' if event has a fee
      const savedMode =
        event.ticket_qr_mode ||
        (typeof window !== 'undefined'
          ? (localStorage.getItem(`clubsync_qrmode_${event.id}`) as TicketQrMode | null)
          : null) ||
        (feeVal > 0 ? 'paid_only' : 'all_registered');
      setTicketMode(savedMode);

      const cur = rsvps.find((r) => r.budget_id === event.id && r.user_id === profile.id);
      setSurveyChoice(
        cur?.is_driver
          ? 'DRIVER'
          : cur?.transport_type && cur.transport_type !== 'None'
          ? cur.transport_type
          : 'OWN'
      );
      setCarDetails(cur?.car_details || '');
      setSeatsAvailable(String(cur?.seats_available ?? 4));
      setTripsCount(String(cur?.trips_count ?? 1));
      setDormitoryInput(cur?.dormitory || profile.dormitory || '');
    }
  }, [event, initialTab, isAdmin, rsvps, profile.id, profile.dormitory]);

  if (!event) return null;

  const myRsvp = rsvps.find((r) => r.budget_id === event.id && r.user_id === profile.id);
  const eventRsvps = rsvps.filter((r) => r.budget_id === event.id);
  const attendingRsvps = eventRsvps.filter((r) => r.attendance === 'Attending');
  const qrCheckedInList = eventRsvps.filter((r) => r.qr_checked_in);
  const passengers = attendingRsvps.filter((r) => r.transport_type !== 'None' && !r.is_driver);
  const unassignedPassengers = passengers.filter((p) => !p.assigned_driver_name);
  const eventDrivers = attendingRsvps.filter((r) => r.is_driver);
  const eventPayments = feePayments.filter((f) => f.budget_id === event.id);
  const allowancePerTrip = Number(event.driver_allowance_per_trip || 0);
  const reqFee = Number(event.registration_fee || 0);

  // Strict Member QR Eligibility Check:
  // - If 'manual_only': Member NEVER sees QR unless Admin explicitly granted pass_approved === true
  // - If 'paid_only': Member sees QR ONLY if they paid Verified fee (or reqFee === 0) or Admin granted pass_approved === true
  // - If 'all_registered': Member sees QR once registered as 'Attending'
  const isMemberEligibleForPass = (rsvp?: EventRsvp) => {
    if (!rsvp || rsvp.attendance !== 'Attending') return false;
    if (rsvp.pass_approved === true) return true;
    if (ticketMode === 'manual_only') return false;
    if (ticketMode === 'paid_only') {
      if (reqFee <= 0) return true;
      return eventPayments.some((f) => f.user_id === rsvp.user_id && f.status === 'Verified');
    }
    return true;
  };

  const myPassEligible = isMemberEligibleForPass(myRsvp);
  const myPassPayload = `CLUBSYNC_PASS::v1::${event.id}::${profile.id}::${qrToken}`;
  const myPassQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(myPassPayload)}`;

  const venueQrPayload = `CLUBSYNC_QR::v1::${event.id}::${qrToken}`;
  const venueQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=280x280&margin=10&data=${encodeURIComponent(venueQrPayload)}`;

  const handleRegenerateQrToken = async () => {
    if (!permissions.can_manage_activities) return;
    const newTok = Math.random().toString(36).substring(2, 10).toUpperCase();
    await supabase.from('budgets').update({ qr_code_token: newTok }).eq('id', event.id);
    setQrToken(newTok);
    onRefresh('Generated new QR! Old QR expired; existing attendance records remain saved.');
  };

  const handleToggleManualPass = async (rsvp: EventRsvp) => {
    const currentlyHas = isMemberEligibleForPass(rsvp);
    const nextVal = !currentlyHas;
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    onRefresh(`${nextVal ? 'Granted' : 'Revoked'} Entry Pass QR for ${rsvp.student_name}!`);
  };

  const handlePayFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const numAmt = parseFloat(amountPaid) || 0;
    if (numAmt <= 0 || !feeFile || feeFile.size > MAX_FILE_SIZE_BYTES) return;
    const path = `fees/${event.id}/${profile.id}-${Date.now()}.${feeFile.name.split('.').pop() || 'jpg'}`;
    const { error } = await supabase.storage.from('receipts').upload(path, feeFile);
    if (!error) {
      const receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      await supabase.from('activity_fee_payments').insert({
        budget_id: event.id,
        user_id: profile.id,
        student_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: profile.phone_number,
        amount_paid: numAmt,
        receipt_url: receiptUrl,
        receipt_file_name: feeFile.name,
        status: 'Verified',
      });
      setFeeFile(null);
      onRefresh('Fee receipt submitted! Your personal Entry Pass QR is now unlocked.');
    }
  };

  const handleSaveTransportForm = async (e: React.FormEvent) => {
    e.preventDefault();
    const isDriving = surveyChoice === 'DRIVER';
    const nextTransport = surveyChoice === 'OWN' || surveyChoice === 'DRIVER' ? 'None' : surveyChoice;
    await supabase.from('event_rsvps').upsert(
      {
        budget_id: event.id,
        user_id: profile.id,
        student_name: profile.full_name,
        matric_no: profile.matric_no,
        phone_number: profile.phone_number,
        member_type: profile.member_type || 'Member',
        dormitory: dormitoryInput.trim() || profile.dormitory || '',
        attendance: 'Attending',
        transport_type: nextTransport,
        is_driver: isDriving,
        car_details: isDriving ? carDetails.trim() : '',
        seats_available: isDriving ? Math.max(1, parseInt(seatsAvailable) || 4) : 0,
        trips_count: isDriving ? Math.max(1, parseInt(tripsCount) || 1) : 0,
        assigned_driver_name: nextTransport === 'None' ? '' : myRsvp?.assigned_driver_name || '',
        qr_checked_in: myRsvp?.qr_checked_in || false,
        qr_checked_in_at: myRsvp?.qr_checked_in_at || null,
        pass_approved: myRsvp?.pass_approved || false,
        updated_at: new Date().toISOString(),
      },
      { onConflict: 'budget_id,user_id' }
    );
    onRefresh('Transport & Carpool choice saved!');
  };

  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    a.download = filename;
    a.click();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border max-w-5xl w-full overflow-hidden my-8">
        <div className="bg-emerald-900 text-white px-6 py-4 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <Ticket className="w-5 h-5 text-amber-300" />
            <div>
              <h2 className="text-base font-bold">{event.event_name}</h2>
              <p className="text-xs text-emerald-200">
                {event.event_date} • {event.location}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex flex-wrap bg-emerald-950/70 p-1 rounded-xl text-xs">
              <button
                type="button"
                onClick={() => setTab('pass')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  tab === 'pass' ? 'bg-amber-400 text-emerald-950' : 'text-emerald-200'
                }`}
              >
                Entry Pass QR
              </button>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setTab('qr')}
                  className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                    tab === 'qr' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                  }`}
                >
                  Venue QR ({qrCheckedInList.length})
                </button>
              )}
              <button
                type="button"
                onClick={() => setTab('fee')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  tab === 'fee' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                }`}
              >
                Pay Fee (RM {reqFee.toFixed(0)})
              </button>
              <button
                type="button"
                onClick={() => setTab('transport')}
                className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${
                  tab === 'transport' ? 'bg-emerald-600 text-white' : 'text-emerald-200'
                }`}
              >
                Carpool ({passengers.length}P • {eventDrivers.length}D)
              </button>
            </div>
            <button type="button" onClick={onClose} className="cursor-pointer ml-1">
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 text-xs">
          {tab === 'pass' && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-gradient-to-b from-emerald-900 to-slate-900 text-white rounded-3xl p-6 flex flex-col items-center text-center justify-between shadow-xl border border-emerald-700">
                <div className="space-y-1">
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-amber-400 text-emerald-950">
                    Personal Event Entry Pass QR
                  </span>
                  <h3 className="text-base font-extrabold mt-1">{event.event_name}</h3>
                  <p className="text-[11px] text-emerald-200">
                    {event.event_date} • {event.location}
                  </p>
                </div>

                {myPassEligible ? (
                  <div className="my-4 p-3.5 bg-white rounded-3xl shadow-lg border-4 border-amber-400">
                    <img src={myPassQrUrl} alt="My Entry Pass QR" className="w-48 h-48 object-contain mx-auto" />
                    <div className="mt-2 pt-2 border-t border-slate-200 text-slate-900">
                      <p className="font-extrabold text-xs">{profile.full_name}</p>
                      <p className="font-mono text-[11px] text-slate-500">{profile.matric_no}</p>
                    </div>
                  </div>
                ) : (
                  <div className="my-6 p-6 rounded-2xl bg-white/10 border border-white/15 space-y-2">
                    <Lock className="w-8 h-8 text-amber-300 mx-auto" />
                    <p className="text-xs font-extrabold">Entry Pass QR Locked</p>
                    <p className="text-[11px] text-emerald-200 leading-relaxed">
                      {!myRsvp || myRsvp.attendance !== 'Attending'
                        ? 'Click "Attend" on this activity card first to register.'
                        : ticketMode === 'paid_only'
                        ? `This event requires Activity Fee payment (RM ${reqFee.toFixed(
                            2
                          )}) before your Entry Pass QR is unlocked.`
                        : 'This event requires Admin approval before your Entry Pass QR is unlocked in your portal.'}
                    </p>
                    {ticketMode === 'paid_only' && reqFee > 0 && (
                      <button
                        type="button"
                        onClick={() => setTab('fee')}
                        className="mt-2 px-4 py-2 rounded-xl bg-amber-400 text-emerald-950 font-extrabold cursor-pointer"
                      >
                        Pay Event Fee Now $\rightarrow$
                      </button>
                    )}
                  </div>
                )}

                <div className="w-full pt-3 border-t border-white/15 flex items-center justify-between text-[11px]">
                  <span className="text-emerald-200">Eligibility Status:</span>
                  <span
                    className={`font-extrabold ${
                      myRsvp?.qr_checked_in
                        ? 'text-amber-300'
                        : myPassEligible
                        ? 'text-emerald-300'
                        : 'text-rose-300'
                    }`}
                  >
                    {myRsvp?.qr_checked_in
                      ? '✓ SCANNED & ATTENDED'
                      : myPassEligible
                      ? '✓ ELIGIBLE TO ATTEND'
                      : '✗ NOT ELIGIBLE YET'}
                  </span>
                </div>
              </div>

              <div className="lg:col-span-7 space-y-4">
                {isAdmin && (
                  <div className="p-4 rounded-2xl bg-slate-900 text-white flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <h4 className="text-xs font-extrabold text-emerald-300 flex items-center gap-1.5">
                        <Camera className="w-4 h-4" />
                        <span>Door Gatekeeper: Scan Member Entry Pass QR</span>
                      </h4>
                      <p className="text-[11px] text-slate-300">
                        Scan a member&apos;s QR at the entrance to verify eligibility and record attendance automatically.
                      </p>
                    </div>
                    {onOpenScanner && (
                      <button
                        type="button"
                        onClick={() => {
                          onClose();
                          onOpenScanner();
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer shrink-0"
                      >
                        Launch QR Scanner
                      </button>
                    )}
                  </div>
                )}

                <div className="space-y-2">
                  <h4 className="text-sm font-extrabold">
                    Registered Members &amp; QR Eligibility ({attendingRsvps.length})
                  </h4>
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                          <th className="py-2.5 px-3">Member</th>
                          <th className="py-2.5 px-3">Pay Fee</th>
                          <th className="py-2.5 px-3">QR Eligibility &amp; Attendance</th>
                          <th className="py-2.5 px-3 text-right">Admin Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendingRsvps.map((r) => {
                          const paid = eventPayments.find((f) => f.user_id === r.user_id && f.status === 'Verified');
                          const hasPass = isMemberEligibleForPass(r);
                          return (
                            <tr key={r.id}>
                              <td className="py-2.5 px-3 font-bold">
                                {r.student_name} <span className="font-mono text-slate-400">({r.matric_no})</span>
                              </td>
                              <td className="py-2.5 px-3">
                                {reqFee <= 0 ? (
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
                                    Attended &amp; Verified
                                  </span>
                                ) : hasPass ? (
                                  <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                    ✓ Eligible (QR Active)
                                  </span>
                                ) : (
                                  <span className="px-2 py-0.5 rounded-full bg-rose-50 text-rose-700 font-bold text-[10px]">
                                    ✗ QR Locked
                                  </span>
                                )}
                              </td>
                              <td className="py-2.5 px-3 text-right">
                                {isAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => handleToggleManualPass(r)}
                                    className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                                      hasPass ? 'bg-rose-50 text-rose-700' : 'bg-emerald-700 text-white'
                                    }`}
                                  >
                                    {hasPass ? 'Lock QR' : 'Grant QR Pass'}
                                  </button>
                                )}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}

          {tab === 'qr' && isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-emerald-50/60 border border-emerald-200 rounded-3xl p-5 flex flex-col items-center text-center space-y-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-700 text-white">
                  Admin Venue QR (Members Scan This)
                </span>
                <div className="p-3 bg-white rounded-3xl border-2 border-emerald-600">
                  <img src={venueQrUrl} alt="Event QR" className="w-52 h-52 object-contain" />
                </div>
                {permissions.can_manage_activities && (
                  <button
                    type="button"
                    onClick={handleRegenerateQrToken}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl font-bold bg-amber-400 text-emerald-950 cursor-pointer"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>Generate New QR (Expire Old QR)</span>
                  </button>
                )}
              </div>
              <div className="lg:col-span-7 space-y-3">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold">Recorded QR Attendance ({qrCheckedInList.length})</h3>
                  <button
                    type="button"
                    onClick={() =>
                      exportCsv(
                        `${event.event_name}_QR_Attendance.csv`,
                        ['Name', 'Matric', 'Phone', 'Department', 'Scan Time'],
                        qrCheckedInList.map((r) => [
                          r.student_name,
                          r.matric_no,
                          r.phone_number,
                          r.member_type,
                          r.qr_checked_in_at || 'Verified',
                        ])
                      )
                    }
                    className="px-3 py-1.5 rounded-xl bg-emerald-100 text-emerald-900 font-bold cursor-pointer"
                  >
                    <Download className="w-3.5 h-3.5 inline mr-1" />
                    Export CSV
                  </button>
                </div>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-emerald-50 border-b">
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Department</th>
                        <th className="py-2 px-3 text-right">Time</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {qrCheckedInList.map((r) => (
                        <tr key={r.id}>
                          <td className="py-2 px-3 font-bold">
                            {r.student_name} ({r.matric_no})
                          </td>
                          <td className="py-2 px-3">{r.member_type}</td>
                          <td className="py-2 px-3 text-right font-mono">
                            {r.qr_checked_in_at ? new Date(r.qr_checked_in_at).toLocaleTimeString() : 'Verified'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'fee' && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <form
                onSubmit={handlePayFeeSubmit}
                className="lg:col-span-2 bg-emerald-50/60 border border-emerald-200 rounded-2xl p-5 space-y-3 self-start"
              >
                <h3 className="text-sm font-extrabold">Submit Activity Fee (RM {reqFee.toFixed(2)})</h3>
                <p className="text-[11px] text-slate-600">
                  Uploading your fee receipt automatically unlocks your Personal Entry Pass QR.
                </p>
                <input
                  type="number"
                  step="0.01"
                  value={amountPaid}
                  onChange={(e) => setAmountPaid(e.target.value)}
                  className="w-full rounded-xl border bg-white px-3 py-2 font-bold"
                  required
                />
                <input
                  type="file"
                  accept="image/*,application/pdf"
                  onChange={(e) => setFeeFile(e.target.files?.[0] || null)}
                  className="w-full"
                  required
                />
                <button type="submit" className="w-full py-2.5 rounded-xl font-bold bg-emerald-700 text-white cursor-pointer">
                  <CheckCircle2 className="w-4 h-4 inline mr-1" />
                  Submit Fee Proof
                </button>
              </form>
              <div className="lg:col-span-3 space-y-3">
                <h3 className="text-sm font-extrabold">Fee Submissions ({eventPayments.length})</h3>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-emerald-50 border-b">
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Receipt</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eventPayments
                        .filter((p) => isAdmin || p.user_id === profile.id)
                        .map((p) => (
                          <tr key={p.id}>
                            <td className="py-2 px-3 font-bold">
                              {p.student_name} ({p.matric_no})
                            </td>
                            <td className="py-2 px-3 font-extrabold text-emerald-800">
                              RM {Number(p.amount_paid).toFixed(2)}
                            </td>
                            <td className="py-2 px-3">{p.status}</td>
                            <td className="py-2 px-3 text-right">
                              <a
                                href={p.receipt_url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="px-2 py-1 rounded bg-slate-100 text-emerald-700 font-bold"
                              >
                                <ExternalLink className="w-3.5 h-3.5 inline" />
                              </a>
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'transport' && (
            <div className="space-y-5">
              <div className="flex flex-wrap justify-between gap-2 bg-slate-50 p-3.5 rounded-2xl border">
                <div className="flex gap-4 font-bold">
                  <span>Passengers: {passengers.length}</span>
                  <span>Unassigned: {unassignedPassengers.length}</span>
                  <span>Drivers: {eventDrivers.length}</span>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      const lines = eventDrivers.map(
                        (d, i) =>
                          `Car ${i + 1}: ${d.student_name} (${d.car_details}) -> ` +
                          passengers
                            .filter((p) => p.assigned_driver_name === d.student_name)
                            .map((p) => `${p.student_name} (${p.dormitory})`)
                            .join(', ')
                      );
                      navigator.clipboard.writeText(lines.join('\n'));
                      onRefresh('Copied WhatsApp list!');
                    }}
                    className="px-3 py-1 rounded-xl bg-emerald-700 text-white font-bold cursor-pointer"
                  >
                    <Copy className="w-3 h-3 inline mr-1" />
                    Copy WhatsApp
                  </button>
                </div>
              </div>

              <form onSubmit={handleSaveTransportForm} className="p-4 rounded-2xl border border-emerald-200 space-y-3">
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(
                    [
                      'OWN',
                      'One-Way',
                      'Return Trip',
                      'Round Trip',
                      ...(event.driver_recruitment_open || isAdmin ? (['DRIVER'] as const) : []),
                    ] as TransportSurveyChoice[]
                  ).map((opt) => (
                    <button
                      type="button"
                      key={opt}
                      onClick={() => setSurveyChoice(opt)}
                      className={`p-2 rounded-xl border font-bold cursor-pointer ${
                        surveyChoice === opt ? 'bg-emerald-700 text-white' : 'bg-slate-50'
                      }`}
                    >
                      {opt === 'OWN'
                        ? 'Own Transport'
                        : opt === 'DRIVER'
                        ? `Driver (RM ${allowancePerTrip}/trip)`
                        : `Need: ${opt}`}
                    </button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                  <input
                    type="text"
                    value={dormitoryInput}
                    onChange={(e) => setDormitoryInput(e.target.value)}
                    placeholder="Pickup Dorm (e.g., KTDI M17)"
                    className="rounded-xl border px-3 py-2 font-bold"
                  />
                  {surveyChoice === 'DRIVER' && (
                    <>
                      <input
                        type="text"
                        value={carDetails}
                        onChange={(e) => setCarDetails(e.target.value)}
                        placeholder="Car & Plate *"
                        className="rounded-xl border px-3 py-2"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        value={seatsAvailable}
                        onChange={(e) => setSeatsAvailable(e.target.value)}
                        placeholder="Seats *"
                        className="rounded-xl border px-3 py-2 font-bold"
                        required
                      />
                      <input
                        type="number"
                        min="1"
                        value={tripsCount}
                        onChange={(e) => setTripsCount(e.target.value)}
                        placeholder="Trips *"
                        className="rounded-xl border px-3 py-2 font-bold"
                        required
                      />
                    </>
                  )}
                </div>
                <div className="flex justify-end">
                  <button type="submit" className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold cursor-pointer">
                    Save My Carpool Choice
                  </button>
                </div>
              </form>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}