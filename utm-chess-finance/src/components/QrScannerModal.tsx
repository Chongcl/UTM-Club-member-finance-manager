'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, Budget, UserProfile, EventRsvp, ActivityFeePayment, PublicGuestRegistration, EquipmentItem, EquipmentLoan, logActivity } from '@/lib/supabase';
import {
  localDateStr,
  addDaysStr,
  approvalOf,
  availableForRange,
  submitLoanRequest,
  syncAvailabilityToday,
} from '@/lib/equipment';
import { X, Camera, CheckCircle2, AlertTriangle, Upload, QrCode, ShieldCheck, XCircle, Package, RotateCcw, ArrowUpRight, Loader2, MapPin } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean; onClose: () => void; budgets: Budget[]; rsvps: EventRsvp[];
  feePayments?: ActivityFeePayment[]; guestRegistrations?: PublicGuestRegistration[];
  profile: UserProfile; isAdmin?: boolean; onSuccess: (msg: string) => void;
  equipmentItems?: EquipmentItem[]; equipmentLoans?: EquipmentLoan[];
}

interface GatePassResult {
  allowed: boolean; studentName: string; matricNo: string; department: string;
  eventName: string; feeStatus: string; reason: string; isGuest?: boolean;
}

declare global {
  interface Window {
    jsQR?: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
  }
}

export default function QrScannerModal({
  isOpen, onClose, budgets, rsvps, feePayments = [], guestRegistrations = [], profile, isAdmin = false, onSuccess,
  equipmentItems = [], equipmentLoans = [],
}: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [gatePass, setGatePass] = useState<GatePassResult | null>(null);

  // On-the-spot equipment borrow / return (QR sticker on the box or clock)
  const itemsRef = useRef<EquipmentItem[]>(equipmentItems);
  const lockRef = useRef(false);
  const [eqScan, setEqScan] = useState<{ item: EquipmentItem; unit?: number } | null>(null);
  const [eqQty, setEqQty] = useState('1');
  const [eqStartDate, setEqStartDate] = useState(localDateStr());
  const [eqReturnDate, setEqReturnDate] = useState(addDaysStr(localDateStr(), 7));
  const [eqPurpose, setEqPurpose] = useState('');
  const [eqBusy, setEqBusy] = useState(false);
  const [eqError, setEqError] = useState<string | null>(null);

  useEffect(() => { itemsRef.current = equipmentItems; }, [equipmentItems]);
  useEffect(() => {
    if (!isOpen) {
      const today = localDateStr();
      lockRef.current = false;
      setEqScan(null);
      setEqStartDate(today);
      setEqReturnDate(addDaysStr(today, 7));
      setEqError(null);
    }
  }, [isOpen]);

  const closeEqPanel = () => {
    const today = localDateStr();
    setEqScan(null);
    setEqStartDate(today);
    setEqReturnDate(addDaysStr(today, 7));
    setEqError(null);
    lockRef.current = false;
  };

  useEffect(() => {
    if (!isOpen || typeof window === 'undefined') return;
    if (!window.jsQR) {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/jsqr@1.4.0/dist/jsQR.min.js';
      script.async = true;
      document.body.appendChild(script);
    }
  }, [isOpen]);

  const verifyAndRecordQrPayload = useCallback(async (rawText: string) => {
    setErrorMsg(null);
    const trimmed = rawText.trim();

    if (trimmed.includes('CLUBSYNC_EQ::v1::')) {
      const eqPayload = trimmed.slice(trimmed.indexOf('CLUBSYNC_EQ::v1::'));
      const eqParts = eqPayload.split('::');
      const itemId = eqParts[2]?.trim();
      const unitNo = eqParts[3] ? parseInt(eqParts[3], 10) : undefined;
      const found = itemsRef.current.find((i) => i.id === itemId);
      if (!found) { setErrorMsg('Equipment not found. This sticker may belong to an item that was removed.'); return; }
      lockRef.current = true;
      setEqQty('1');
      setEqPurpose('');
      setEqError(null);
      setEqReturnDate(addDaysStr(localDateStr(), 7));
      setEqScan({ item: found, unit: Number.isFinite(unitNo) ? unitNo : undefined });
      return;
    }

    if (trimmed.includes('CLUBSYNC_GUEST::v1::')) {
      const guestPayload = trimmed.slice(trimmed.indexOf('CLUBSYNC_GUEST::v1::'));
      const parts = guestPayload.split('::');
      const eventId = parts[2]?.trim();
      const regId = parts[3]?.trim();
      const scannedToken = parts[4]?.trim().toUpperCase();

      const targetEvent = budgets.find((b) => b.id === eventId);
      if (!targetEvent) { setErrorMsg('Event not found.'); return; }

      const activeToken = (targetEvent.qr_code_token || targetEvent.id.slice(0, 6)).trim().toUpperCase();
      if (scannedToken !== activeToken) {
        setGatePass({
          allowed: false, isGuest: true, studentName: 'Expired Guest QR Pass', matricNo: '-', department: 'Guest',
          eventName: targetEvent.event_name, feeStatus: 'Expired',
          reason: 'DENIED: This guest QR pass has expired.',
        });
        return;
      }

      let guestReg = guestRegistrations.find((g) => g.id === regId && g.budget_id === targetEvent.id && !g.deleted_at);
      if (!guestReg && regId) {
        const { data: liveGuest } = await supabase
          .from('public_guest_registrations')
          .select('*')
          .eq('id', regId)
          .eq('budget_id', targetEvent.id)
          .is('deleted_at', null)
          .maybeSingle();
        if (liveGuest) guestReg = liveGuest as PublicGuestRegistration;
      }

      if (!guestReg) {
        setGatePass({
          allowed: false, isGuest: true, studentName: 'Unregistered Guest', matricNo: '-', department: 'Guest',
          eventName: targetEvent.event_name, feeStatus: 'Not Found',
          reason: 'DENIED: Guest registration record was not found.',
        });
        return;
      }

      if (!guestReg.pass_approved) {
        setGatePass({
          allowed: false, isGuest: true, studentName: guestReg.guest_name, matricNo: guestReg.lookup_code,
          department: guestReg.institution_or_matric || 'Guest', eventName: targetEvent.event_name,
          feeStatus: guestReg.payment_status === 'Pending' ? 'Pending Verification' : guestReg.payment_status,
          reason: 'DENIED: Guest fee verification or Admin pass grant required.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      await supabase
        .from('public_guest_registrations')
        .update({ qr_checked_in: true, qr_checked_in_at: nowIso })
        .eq('id', guestReg.id);

      setGatePass({
        allowed: true, isGuest: true, studentName: guestReg.guest_name, matricNo: guestReg.lookup_code,
        department: guestReg.institution_or_matric || 'Guest', eventName: targetEvent.event_name,
        feeStatus:
          guestReg.payment_status === 'Free'
            ? 'Free Guest Entry ✓'
            : `Paid RM ${Number(guestReg.amount_paid).toFixed(2)} ✓`,
        reason: 'ACCESS GRANTED (Guest): Guest attendance automatically recorded!',
      });
      onSuccess(`Admitted Guest ${guestReg.guest_name}!`);
      return;
    }

    if (trimmed.includes('CLUBSYNC_PASS::v1::')) {
      const passPayload = trimmed.slice(trimmed.indexOf('CLUBSYNC_PASS::v1::'));
      const parts = passPayload.split('::');
      const eventId = parts[2]?.trim();
      const userId = parts[3]?.trim();
      const scannedToken = parts[4]?.trim().toUpperCase();

      const targetEvent = budgets.find((b) => b.id === eventId);
      if (!targetEvent) { setErrorMsg('Event not found.'); return; }

      const activeToken = (targetEvent.qr_code_token || targetEvent.id.slice(0, 6)).trim().toUpperCase();
      if (scannedToken !== activeToken) {
        setGatePass({
          allowed: false, studentName: 'Expired QR Pass', matricNo: '-', department: '-',
          eventName: targetEvent.event_name, feeStatus: 'Expired',
          reason: 'DENIED: This QR code has expired.',
        });
        return;
      }

      const memberRsvp = rsvps.find((r) => r.budget_id === targetEvent.id && r.user_id === userId);
      if (!memberRsvp || memberRsvp.attendance !== 'Attending') {
        setGatePass({
          allowed: false, studentName: memberRsvp?.student_name || 'Unregistered',
          matricNo: memberRsvp?.matric_no || '-', department: memberRsvp?.member_type || '-',
          eventName: targetEvent.event_name, feeStatus: 'Not Attending',
          reason: 'DENIED: Member is not registered as Attending.',
        });
        return;
      }

      const reqFee = Number(targetEvent.registration_fee || 0);
      const paidRecord = feePayments.find((f) => f.budget_id === targetEvent.id && f.user_id === userId && f.status === 'Verified');
      const isManualOnly = targetEvent.ticket_qr_mode === 'manual_only';
      const eligible = isManualOnly ? Boolean(memberRsvp.pass_approved) : Boolean(memberRsvp.pass_approved) || (reqFee > 0 && Boolean(paidRecord));

      if (!eligible) {
        setGatePass({
          allowed: false, studentName: memberRsvp.student_name, matricNo: memberRsvp.matric_no,
          department: memberRsvp.member_type, eventName: targetEvent.event_name,
          feeStatus: reqFee > 0 ? `Unpaid (RM ${reqFee.toFixed(2)})` : 'Not Granted',
          reason: 'DENIED: Fee payment or Admin grant required.',
        });
        return;
      }

      const nowIso = new Date().toISOString();
      await supabase.from('event_rsvps').update({ qr_checked_in: true, qr_checked_in_at: nowIso, updated_at: nowIso }).eq('id', memberRsvp.id);

      setGatePass({
        allowed: true, studentName: memberRsvp.student_name, matricNo: memberRsvp.matric_no,
        department: memberRsvp.member_type, eventName: targetEvent.event_name,
        feeStatus: paidRecord ? `Paid RM ${Number(paidRecord.amount_paid).toFixed(2)} ✓` : 'Admin Granted ✓',
        reason: 'ACCESS GRANTED: Attendance automatically recorded!',
      });
      onSuccess(`Admitted ${memberRsvp.student_name}!`);
      return;
    }

    const idx = trimmed.indexOf('CLUBSYNC_QR::v1::');
    const payload = idx !== -1 ? trimmed.slice(idx).trim() : trimmed;
    if (!payload.startsWith('CLUBSYNC_QR::v1::')) {
      setErrorMsg('Invalid QR! Please scan an official ClubSync QR code.');
      return;
    }
    const parts = payload.split('::');
    const eventId = parts[2]?.trim();
    const scannedToken = parts[3]?.trim().toUpperCase();
    const targetEvent = budgets.find((b) => b.id === eventId);
    if (!targetEvent) { setErrorMsg('Event not found.'); return; }

    const activeToken = (targetEvent.qr_code_token || targetEvent.id.slice(0, 6)).trim().toUpperCase();
    if (scannedToken !== activeToken) {
      setErrorMsg('Expired QR Code! Please scan the latest QR displayed by the Admin.');
      return;
    }

    const existing = rsvps.find((r) => r.budget_id === targetEvent.id && r.user_id === profile.id);
    const nowIso = new Date().toISOString();
    await supabase.from('event_rsvps').upsert({
      budget_id: targetEvent.id, user_id: profile.id, student_name: profile.full_name,
      matric_no: profile.matric_no, phone_number: profile.phone_number, member_type: profile.member_type || 'Member',
      dormitory: existing?.dormitory || profile.dormitory || '', attendance: 'Attending',
      transport_type: existing?.transport_type || 'None', is_driver: existing?.is_driver || false,
      car_details: existing?.car_details || '', seats_available: existing?.seats_available ?? 4,
      trips_count: existing?.trips_count ?? 1, assigned_driver_name: existing?.assigned_driver_name || '',
      pass_approved: existing?.pass_approved ?? false,
      qr_checked_in: true, qr_checked_in_at: nowIso, updated_at: nowIso,
    }, { onConflict: 'budget_id,user_id' });

    setSuccessMsg(`Attendance automatically recorded for "${targetEvent.event_name}"!`);
    setTimeout(() => { onSuccess(`Attendance recorded for "${targetEvent.event_name}"!`); onClose(); }, 1000);
  }, [budgets, rsvps, feePayments, guestRegistrations, profile, onSuccess, onClose]);

  useEffect(() => {
    if (!isOpen) return;
    setErrorMsg(null); setSuccessMsg(null); setGatePass(null);
    let stream: MediaStream | null = null;
    let animId: number;
    let active = true;

    navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment' } }).then(async (s) => {
      if (!active) { s.getTracks().forEach((t) => t.stop()); return; }
      stream = s;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.setAttribute('playsinline', 'true');
        await videoRef.current.play();
        setCameraActive(true);
      }
      const tick = () => {
        if (!active) return;
        const v = videoRef.current; const c = canvasRef.current;
        if (!lockRef.current && v && c && v.readyState === v.HAVE_ENOUGH_DATA && window.jsQR) {
          c.width = v.videoWidth; c.height = v.videoHeight;
          const ctx = c.getContext('2d');
          if (ctx) {
            ctx.drawImage(v, 0, 0, c.width, c.height);
            const img = ctx.getImageData(0, 0, c.width, c.height);
            const code = window.jsQR(img.data, img.width, img.height);
            if (code?.data) verifyAndRecordQrPayload(code.data);
          }
        }
        animId = requestAnimationFrame(tick);
      };
      animId = requestAnimationFrame(tick);
    }).catch(() => setCameraActive(false));

    return () => {
      active = false;
      if (animId) cancelAnimationFrame(animId);
      if (stream) stream.getTracks().forEach((t) => t.stop());
      setCameraActive(false);
    };
  }, [isOpen, verifyAndRecordQrPayload]);

  const handleImageFileScan = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const img = new Image();
    img.onload = () => {
      const c = canvasRef.current;
      if (!c || !window.jsQR) return;
      c.width = img.width; c.height = img.height;
      const ctx = c.getContext('2d');
      if (!ctx) return;
      ctx.drawImage(img, 0, 0);
      const data = ctx.getImageData(0, 0, c.width, c.height);
      const code = window.jsQR(data.data, data.width, data.height);
      if (code?.data) verifyAndRecordQrPayload(code.data);
      else setErrorMsg('No valid ClubSync QR Code detected in this image.');
    };
    img.src = URL.createObjectURL(file);
  };

  const eqToday = localDateStr();
  const diffDays = (startStr: string, endStr: string): number => {
    const s = new Date(`${startStr}T00:00:00`).getTime();
    const e = new Date(`${endStr}T00:00:00`).getTime();
    return Number.isFinite(s) && Number.isFinite(e) ? Math.max(0, Math.round((e - s) / 86400000)) : 0;
  };
  const eqEffectiveEnd = eqReturnDate >= eqStartDate ? eqReturnDate : eqStartDate;
  const eqDurationDays = diffDays(eqStartDate, eqEffectiveEnd);
  const eqActiveLoans = eqScan
    ? equipmentLoans.filter(
        (l) =>
          l.item_id === eqScan.item.id &&
          l.status !== 'Returned' &&
          approvalOf(l) === 'Approved' &&
          l.borrow_date <= eqToday &&
          (isAdmin || l.user_id === profile.id)
      )
    : [];
  const eqPendingMine = eqScan
    ? equipmentLoans.filter((l) => l.item_id === eqScan.item.id && approvalOf(l) === 'Pending' && l.user_id === profile.id)
    : [];
  const eqAvail = eqScan
    ? availableForRange(eqScan.item, equipmentLoans, eqStartDate, eqEffectiveEnd, eqToday)
    : 0;

  const handleEqBorrow = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!eqScan) return;
    setEqBusy(true);
    setEqError(null);
    try {
      const res = await submitLoanRequest({
        item: eqScan.item,
        loans: equipmentLoans,
        profile,
        quantity: Math.max(1, parseInt(eqQty) || 1),
        startDate: eqStartDate,
        endDate: eqEffectiveEnd,
        purpose: eqPurpose.trim() || 'Borrowed via QR scan',
      });
      if (!res.ok) { setEqError(res.error || 'Could not save.'); return; }
      const msg = res.approval === 'Pending'
        ? `Request sent for ${res.quantity}x ${eqScan.item.item_name} — waiting for admin approval.`
        : `Borrowed ${res.quantity}x ${eqScan.item.item_name}!`;
      setSuccessMsg(msg);
      onSuccess(msg);
      closeEqPanel();
      setTimeout(() => setSuccessMsg(null), 4000);
    } finally {
      setEqBusy(false);
    }
  };

  const handleEqReturn = async (loan: EquipmentLoan) => {
    if (!eqScan) return;
    setEqBusy(true);
    setEqError(null);
    try {
      const nowIso = new Date().toISOString();
      const { error } = await supabase
        .from('equipment_loans')
        .update({ status: 'Returned', returned_at: nowIso })
        .eq('id', loan.id);
      if (error) {
        const { error: fbErr } = await supabase
          .from('equipment_loans')
          .update({ status: 'Returned' })
          .eq('id', loan.id);
        if (fbErr) {
          setEqError(fbErr.message || 'Could not mark equipment returned.');
          return;
        }
      }
      await syncAvailabilityToday(
        eqScan.item,
        equipmentLoans.map((l) => (l.id === loan.id ? { ...l, status: 'Returned' as const, returned_at: nowIso } : l))
      );
      void logActivity(
        profile,
        'Equipment',
        'Equipment returned',
        `${loan.quantity}x ${loan.item_name} returned by ${loan.borrower_name} (${loan.matric_no}) via QR scan` +
          (loan.user_id !== profile.id ? ` — marked by ${profile.full_name}` : '')
      );
      const msg = `Returned ${loan.quantity}x ${loan.item_name}!`;
      setSuccessMsg(msg);
      onSuccess(msg);
      closeEqPanel();
      setTimeout(() => setSuccessMsg(null), 4000);
    } finally {
      setEqBusy(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full overflow-hidden shadow-2xl">
        <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
          <div className="flex items-center gap-2">
            <QrCode className="w-5 h-5 text-emerald-400" />
            <div><h3 className="text-sm font-bold">{isAdmin ? 'Scan Attendance / Entry Pass QR' : 'Scan Event Attendance QR'}</h3><p className="text-[11px] text-slate-400">Automatically records attendance upon scan</p></div>
          </div>
          <button type="button" onClick={onClose} className="cursor-pointer"><X className="w-5 h-5" /></button>
        </div>

        <div className="p-6 space-y-4 text-center">
          {eqScan ? (
            <div className="rounded-3xl border-2 border-emerald-600 bg-emerald-50/60 p-4 text-left space-y-3 text-xs">
              <div className="flex items-start gap-2.5">
                <div className="w-10 h-10 rounded-2xl bg-emerald-600 text-white flex items-center justify-center shrink-0"><Package className="w-5 h-5" /></div>
                <div className="min-w-0">
                  <div className="text-[10px] font-extrabold uppercase text-emerald-700">Equipment scanned</div>
                  <h4 className="text-base font-extrabold text-slate-900 leading-tight">{eqScan.item.item_name}</h4>
                  <div className="text-[11px] text-slate-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" />{eqScan.item.location || 'Club Storage'}{eqScan.unit ? ` • Unit ${eqScan.unit}` : ''}
                  </div>
                </div>
              </div>

              {eqActiveLoans.length > 0 && (
                <div className="space-y-2">
                  <div className="font-extrabold text-slate-800">{isAdmin ? 'Currently borrowed' : 'You are holding this'}</div>
                  {eqActiveLoans.map((l) => (
                    <div key={l.id} className="flex items-center justify-between gap-2 bg-white rounded-xl border border-slate-200 px-3 py-2">
                      <div className="min-w-0">
                        <div className="font-bold text-slate-900">{l.quantity}x {isAdmin ? `• ${l.borrower_name}` : ''}</div>
                        <div className="text-[11px] text-slate-500">Due {l.return_date}</div>
                      </div>
                      <button type="button" disabled={eqBusy} onClick={() => handleEqReturn(l)} className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer shrink-0">
                        {eqBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}<span>Return</span>
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {eqPendingMine.length > 0 && (
                <div className="p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-900 font-semibold">
                  You already have {eqPendingMine.reduce((s, l) => s + Number(l.quantity || 0), 0)} unit(s) awaiting admin approval for this item.
                </div>
              )}

              <form onSubmit={handleEqBorrow} className="space-y-2.5 pt-1 border-t border-emerald-200">
                <div className="font-extrabold text-slate-800 pt-2 flex items-center justify-between">
                  <span>{eqScan.item.requires_approval ? 'Request this item' : 'Borrow this item now'}</span>
                  <span className={`text-[11px] font-bold ${eqAvail > 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{eqAvail} free</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">Quantity</label>
                    <input type="number" min="1" max={Math.max(1, eqAvail)} value={eqQty} onChange={(e) => setEqQty(e.target.value)} className="w-full rounded-xl border border-emerald-300 bg-white px-2.5 py-2 font-bold" required />
                  </div>
                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">Start Date</label>
                    <input
                      type="date"
                      min={eqToday}
                      value={eqStartDate}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (!v) return;
                        const span = diffDays(eqStartDate, eqEffectiveEnd);
                        setEqStartDate(v);
                        setEqReturnDate(addDaysStr(v, span));
                      }}
                      className="w-full rounded-xl border border-emerald-300 bg-white px-2 py-2"
                      required
                    />
                  </div>
                  <div>
                    <label className="block font-bold text-emerald-900 mb-1">Return By</label>
                    <input type="date" min={eqStartDate} value={eqEffectiveEnd} onChange={(e) => setEqReturnDate(e.target.value)} className="w-full rounded-xl border border-emerald-300 bg-white px-2 py-2" required />
                  </div>
                </div>
                <div className="p-2.5 rounded-xl bg-white/90 border border-emerald-200 space-y-1.5">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-bold text-emerald-900">Duration (days):</span>
                    <input
                      type="number"
                      min={0}
                      max={365}
                      value={eqDurationDays}
                      onChange={(e) => {
                        const n = Math.max(0, Math.min(365, parseInt(e.target.value || '0', 10) || 0));
                        setEqReturnDate(addDaysStr(eqStartDate, n));
                      }}
                      className="w-16 rounded-lg border border-emerald-300 bg-white px-2 py-1 text-center font-extrabold text-emerald-950"
                      aria-label="QR borrow duration in days"
                    />
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {[
                      { label: 'Same Day', days: 0 },
                      { label: '1d', days: 1 },
                      { label: '3d', days: 3 },
                      { label: '7d', days: 7 },
                      { label: '14d', days: 14 },
                      { label: '30d', days: 30 },
                    ].map((p) => (
                      <button
                        key={p.days}
                        type="button"
                        onClick={() => setEqReturnDate(addDaysStr(eqStartDate, p.days))}
                        className={`px-2 py-0.5 rounded-md text-[11px] font-bold border cursor-pointer ${
                          eqDurationDays === p.days
                            ? 'bg-emerald-600 text-white border-emerald-600'
                            : 'bg-emerald-50 text-emerald-900 border-emerald-200 hover:bg-emerald-100'
                        }`}
                      >
                        {p.label}
                      </button>
                    ))}
                  </div>
                </div>
                <input type="text" value={eqPurpose} onChange={(e) => setEqPurpose(e.target.value)} placeholder="Purpose (e.g., Training)" className="w-full rounded-xl border border-emerald-300 bg-white px-3 py-2" />
                {eqError && <div className="p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">{eqError}</div>}
                <button type="submit" disabled={eqBusy || eqAvail <= 0} className="w-full inline-flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-300 text-white font-bold cursor-pointer">
                  {eqBusy ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowUpRight className="w-4 h-4" />}
                  <span>{eqAvail <= 0 ? 'Out of stock' : eqScan.item.requires_approval ? 'Send Request' : 'Confirm Borrow'}</span>
                </button>
              </form>

              <button type="button" onClick={closeEqPanel} className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white font-bold cursor-pointer">Scan Next</button>
            </div>
          ) : gatePass ? (
            <div className={`p-5 rounded-3xl border-2 text-left space-y-3 ${gatePass.allowed ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-rose-50 border-rose-600 text-rose-950'}`}>
              <div className="flex items-center gap-2.5">
                {gatePass.allowed ? <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" /> : <XCircle className="w-8 h-8 text-rose-600 shrink-0" />}
                <div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${gatePass.allowed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {gatePass.allowed
                      ? gatePass.isGuest
                        ? 'ACCESS GRANTED (Guest)'
                        : 'ACCESS GRANTED'
                      : 'ENTRY DENIED'}
                  </span>
                  <h4 className="text-base font-extrabold mt-1">{gatePass.studentName}</h4>
                </div>
              </div>
              <div className="text-xs space-y-1 bg-white/80 p-3 rounded-2xl border">
                <p><strong>Matric No:</strong> <span className="font-mono">{gatePass.matricNo}</span></p>
                <p><strong>Event:</strong> {gatePass.eventName}</p>
                <p><strong>Status:</strong> <span className="font-bold">{gatePass.feeStatus}</span></p>
              </div>
              <p className="text-xs font-bold">{gatePass.reason}</p>
              <button type="button" onClick={() => setGatePass(null)} className="w-full py-2.5 rounded-xl bg-slate-950 hover:bg-slate-900 text-white text-xs font-bold cursor-pointer">Scan Next</button>
            </div>
          ) : null}
          <div className={gatePass || eqScan ? 'hidden' : 'space-y-4'}>
            <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-h-[250px] mx-auto flex items-center justify-center border-2 border-emerald-500">
              <video ref={videoRef} className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`} muted />
              <canvas ref={canvasRef} className="hidden" />
              {!cameraActive && <div className="p-6 text-slate-300 text-xs"><Camera className="w-8 h-8 text-emerald-400 mx-auto mb-2" />Point camera at QR Code</div>}
            </div>
            <label className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
              <Upload className="w-4 h-4" /><span>Upload / Capture QR Image</span>
              <input type="file" accept="image/*" capture="environment" onChange={handleImageFileScan} className="hidden" />
            </label>
          </div>
          {successMsg && <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold"><CheckCircle2 className="w-4 h-4 inline mr-1" />{successMsg}</div>}
          {errorMsg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold"><AlertTriangle className="w-4 h-4 inline mr-1" />{errorMsg}</div>}
        </div>
      </div>
    </div>
  );
}