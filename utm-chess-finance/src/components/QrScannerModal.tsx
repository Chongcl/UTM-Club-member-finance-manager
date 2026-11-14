'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { supabase, Budget, UserProfile, EventRsvp, ActivityFeePayment } from '@/lib/supabase';
import { X, Camera, CheckCircle2, AlertTriangle, Upload, QrCode, ShieldCheck, XCircle } from 'lucide-react';

interface QrScannerModalProps {
  isOpen: boolean; onClose: () => void; budgets: Budget[]; rsvps: EventRsvp[];
  feePayments?: ActivityFeePayment[]; profile: UserProfile; isAdmin?: boolean; onSuccess: (msg: string) => void;
}

interface GatePassResult {
  allowed: boolean; studentName: string; matricNo: string; department: string;
  eventName: string; feeStatus: string; reason: string;
}

declare global {
  interface Window {
    jsQR?: (data: Uint8ClampedArray, width: number, height: number) => { data: string } | null;
  }
}

export default function QrScannerModal({
  isOpen, onClose, budgets, rsvps, feePayments = [], profile, isAdmin = false, onSuccess,
}: QrScannerModalProps) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [cameraActive, setCameraActive] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [gatePass, setGatePass] = useState<GatePassResult | null>(null);

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
  }, [budgets, rsvps, feePayments, profile, onSuccess, onClose]);

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
        if (v && c && v.readyState === v.HAVE_ENOUGH_DATA && window.jsQR) {
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
          {gatePass ? (
            <div className={`p-5 rounded-3xl border-2 text-left space-y-3 ${gatePass.allowed ? 'bg-emerald-50 border-emerald-600 text-emerald-950' : 'bg-rose-50 border-rose-600 text-rose-950'}`}>
              <div className="flex items-center gap-2.5">
                {gatePass.allowed ? <ShieldCheck className="w-8 h-8 text-emerald-600 shrink-0" /> : <XCircle className="w-8 h-8 text-rose-600 shrink-0" />}
                <div>
                  <span className={`px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase ${gatePass.allowed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'}`}>
                    {gatePass.allowed ? 'ACCESS GRANTED' : 'ENTRY DENIED'}
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
          ) : (
            <>
              <div className="relative rounded-2xl overflow-hidden bg-slate-950 aspect-square max-h-[250px] mx-auto flex items-center justify-center border-2 border-emerald-500">
                <video ref={videoRef} className={`w-full h-full object-cover ${cameraActive ? 'block' : 'hidden'}`} muted />
                <canvas ref={canvasRef} className="hidden" />
                {!cameraActive && <div className="p-6 text-slate-300 text-xs"><Camera className="w-8 h-8 text-emerald-400 mx-auto mb-2" />Point camera at QR Code</div>}
              </div>
              <label className="w-full inline-flex items-center justify-center gap-2 py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer">
                <Upload className="w-4 h-4" /><span>Upload / Capture QR Image</span>
                <input type="file" accept="image/*" capture="environment" onChange={handleImageFileScan} className="hidden" />
              </label>
            </>
          )}
          {successMsg && <div className="p-3 rounded-xl bg-emerald-600 text-white text-xs font-bold"><CheckCircle2 className="w-4 h-4 inline mr-1" />{successMsg}</div>}
          {errorMsg && <div className="p-3 rounded-xl bg-rose-50 text-rose-700 text-xs font-semibold"><AlertTriangle className="w-4 h-4 inline mr-1" />{errorMsg}</div>}
        </div>
      </div>
    </div>
  );
}