'use client';

import React, { useState, useEffect, useRef } from 'react';
import {
  supabase,
  Budget,
  UserProfile,
  EventRsvp,
  ActivityFeePayment,
  Claim,
  AdminPermissions,
  PassApprovalRule,
  ActivityLogEntry,
  isEntryPassMode,
  MAX_FILE_SIZE_BYTES,
  exportMultiSheetExcel,
  downloadFileFromUrl,
  logActivity,
} from '@/lib/supabase';
import { computeFieldChanges, recordEditHistory, softDeleteRecord } from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import { waLink, formatPickupTime } from '@/lib/whatsapp';
import {
  X,
  CheckCircle2,
  ExternalLink,
  Download,
  Copy,
  RefreshCw,
  Ticket,
  ShieldCheck,
  Lock,
  Camera,
  QrCode,
  UploadCloud,
  FileText,
  AlertCircle,
  Loader2,
  Car,
  UserCheck,
  FileSpreadsheet,
  Eye,
  EyeOff,
  Settings,
  MessageCircle,
  Clock,
  MapPin,
  Megaphone,
  Edit3,
  Trash2,
  History,
  ZoomIn,
  XCircle,
} from 'lucide-react';

interface EventOperationsModalProps {
  event: Budget | null; initialTab: 'fee' | 'transport' | 'qr' | 'pass'; profile: UserProfile;
  isAdmin: boolean; permissions: AdminPermissions; rsvps: EventRsvp[]; feePayments: ActivityFeePayment[];
  claims?: Claim[]; logs?: ActivityLogEntry[]; paymentQrUrl?: string; paymentBankInfo?: string;
  onClose: () => void; onOpenScanner?: () => void; onRefresh: (msg: string) => void;
}

type TransportSurveyChoice = 'OWN' | 'One-Way' | 'Return Trip' | 'Round Trip' | 'DRIVER';

export default function EventOperationsModal({
  event, initialTab, profile, isAdmin, permissions, rsvps, feePayments, claims = [], logs = [], paymentQrUrl = '', paymentBankInfo = '', onClose, onOpenScanner, onRefresh,
}: EventOperationsModalProps) {
  const [tab, setTab] = useState<'fee' | 'transport' | 'qr' | 'pass'>(initialTab);
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);
  const [editingFee, setEditingFee] = useState<ActivityFeePayment | null>(null);
  const [editFeeName, setEditFeeName] = useState('');
  const [editFeeMatric, setEditFeeMatric] = useState('');
  const [editFeePhone, setEditFeePhone] = useState('');
  const [editFeeAmount, setEditFeeAmount] = useState('');
  const [editFeeStatus, setEditFeeStatus] = useState<'Verified' | 'Pending' | 'Rejected'>('Verified');
  const [editFeeFile, setEditFeeFile] = useState<File | null>(null);
  const [savingEditFee, setSavingEditFee] = useState(false);
  const [editFeeError, setEditFeeError] = useState<string | null>(null);
  const [amountPaid, setAmountPaid] = useState('0');
  const [feeFile, setFeeFile] = useState<File | null>(null);
  const [feeError, setFeeError] = useState<string | null>(null);
  const [submittingFee, setSubmittingFee] = useState(false);

  // Admin customizable Club Payment QR / Bank Info & Visibility toggle per activity or club-wide
  const [activePayQrUrl, setActivePayQrUrl] = useState(paymentQrUrl);
  const [activePayBankInfo, setActivePayBankInfo] = useState(paymentBankInfo);
  const [showQrToMembers, setShowQrToMembers] = useState(true);
  const [adminQrSetupOpen, setAdminQrSetupOpen] = useState(false);
  const [adminQrFile, setAdminQrFile] = useState<File | null>(null);
  const [savingAdminQr, setSavingAdminQr] = useState(false);

  const [surveyChoice, setSurveyChoice] = useState<TransportSurveyChoice>('OWN');
  const [dormitoryInput, setDormitoryInput] = useState('');
  const [carDetails, setCarDetails] = useState('');
  const [seatsAvailable, setSeatsAvailable] = useState('4');
  const [tripsCount, setTripsCount] = useState('1');
  const [pickupTime, setPickupTime] = useState('');
  const [pickupPoint, setPickupPoint] = useState('');
  const [savingTransport, setSavingTransport] = useState(false);
  const [transportSavedSuccess, setTransportSavedSuccess] = useState(false);
  const [qrToken, setQrToken] = useState('');
  const [hasEntryPass, setHasEntryPass] = useState(false);
  const [passRule, setPassRule] = useState<PassApprovalRule>('auto_after_payment');
  const [feeStatusFilter, setFeeStatusFilter] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');
  const [localPassOverrides, setLocalPassOverrides] = useState<Record<string, boolean>>({});
  const [reviewingFeeId, setReviewingFeeId] = useState<string | null>(null);
  const [feeConfirmAmounts, setFeeConfirmAmounts] = useState<Record<string, string>>({});
  const [rejectReasonByFee, setRejectReasonByFee] = useState<Record<string, string>>({});
  const [zoomReceiptFee, setZoomReceiptFee] = useState<ActivityFeePayment | null>(null);

  const lastEventIdRef = useRef<string | null>(null);
  useEffect(() => {
    if (!event) {
      lastEventIdRef.current = null;
      return;
    }
    if (lastEventIdRef.current === event.id) return;
    lastEventIdRef.current = event.id;

    setLocalPassOverrides({});
    setFeeError(null);
    setTransportSavedSuccess(false);
    setAdminQrSetupOpen(false);
    const feeVal = Number(event.registration_fee || 0);
    setAmountPaid(String(feeVal));
    setQrToken(event.qr_code_token || event.id.slice(0, 6).toUpperCase());

    setActivePayQrUrl(event.payment_qr_url ?? paymentQrUrl);
    setActivePayBankInfo(event.payment_bank_info ?? paymentBankInfo);
    setShowQrToMembers(event.show_payment_qr ?? true);

    const savedMode = event.ticket_qr_mode || (feeVal > 0 ? 'entry_pass' : 'scan_attendance');
    const entryPassActive = isEntryPassMode(savedMode);
    setHasEntryPass(entryPassActive);

    const savedRule: PassApprovalRule =
      event.pass_approval_rule || (savedMode === 'manual_only' ? 'manual_only' : 'auto_after_payment');
    setPassRule(savedRule);
    const hasPending = feePayments.some((f) => f.budget_id === event.id && f.status === 'Pending');
    setFeeStatusFilter(hasPending ? 'Pending' : 'Verified');
    setZoomReceiptFee(null);

    if (initialTab === 'pass' && !entryPassActive) setTab(isAdmin ? 'qr' : 'transport');
    else if (initialTab === 'fee' && feeVal <= 0 && !isAdmin) setTab('transport');
    else setTab(initialTab);

    const cur = rsvps.find((r) => r.budget_id === event.id && r.user_id === profile.id);
    setSurveyChoice(cur?.is_driver ? 'DRIVER' : cur?.transport_type && cur.transport_type !== 'None' ? cur.transport_type : 'OWN');
    setCarDetails(cur?.car_details || '');
    setSeatsAvailable(String(cur?.seats_available ?? 4));
    setTripsCount(String(cur?.trips_count ?? 1));
    setPickupTime(cur?.pickup_time || '');
    setPickupPoint(cur?.pickup_point || '');
    setDormitoryInput(cur?.dormitory || profile.dormitory || '');
  }, [event, initialTab, isAdmin, rsvps, feePayments, profile.id, profile.dormitory, paymentQrUrl, paymentBankInfo]);

  if (!event) return null;

  const myRsvp = rsvps.find((r) => r.budget_id === event.id && r.user_id === profile.id);
  const eventRsvps = rsvps.filter((r) => r.budget_id === event.id);
  const attendingRsvps = eventRsvps.filter((r) => r.attendance === 'Attending');
  const qrCheckedInList = eventRsvps.filter((r) => r.qr_checked_in);
  const passengers = attendingRsvps.filter((r) => r.transport_type !== 'None' && !r.is_driver);
  const eventDrivers = attendingRsvps.filter((r) => r.is_driver);
  const eventPayments = feePayments.filter((f) => f.budget_id === event.id);
  const pendingFeePayments = eventPayments.filter((f) => f.status === 'Pending');
  const eventClaims = claims.filter((c) => c.budget_id === event.id);
  const visibleFeePayments = isAdmin ? eventPayments : eventPayments.filter((p) => p.user_id === profile.id);
  const allowancePerTrip = Number(event.driver_allowance_per_trip || 0);
  const reqFee = Number(event.registration_fee || 0);
  const requiresFee = reqFee > 0;
  const isCurrentUserDriver = Boolean(myRsvp?.is_driver) || surveyChoice === 'DRIVER';
  const myAssignedDriver = myRsvp?.assigned_driver_name
    ? eventDrivers.find((d) => d.student_name === myRsvp.assigned_driver_name) || null
    : null;
  const myPassengers = passengers.filter((p) => p.assigned_driver_name === profile.full_name);

  const buildDriverBroadcastText = (driverName: string, car: string, timeStr?: string | null, pointStr?: string | null, paxList: EventRsvp[] = []) => {
    const t = formatPickupTime(timeStr) || timeStr || 'TBA';
    const pt = pointStr || 'TBA';
    const names = paxList.map((p) => `• ${p.student_name} (${p.dormitory || 'Campus'})`).join('\n') || '• (No passengers assigned yet)';
    return (
      `🚗 *Carpool Pickup — ${event.event_name}*\n` +
      `Driver: ${driverName} (${car || 'Car'})\n` +
      `🕒 Pickup Time: *${t}*\n` +
      `📍 Meeting Point: *${pt}*\n\n` +
      `Passengers:\n${names}\n\n` +
      `Please be at the meeting point 5 mins early!`
    );
  };

  const isMemberEligibleForPass = (rsvp?: EventRsvp) => {
    if (!rsvp || rsvp.attendance !== 'Attending') return false;
    if (localPassOverrides[rsvp.id] !== undefined) return localPassOverrides[rsvp.id];
    if (passRule === 'manual_only') return rsvp.pass_approved === true;
    if (requiresFee) {
      const hasVerifiedPaid = eventPayments.some((f) => f.user_id === rsvp.user_id && f.status === 'Verified');
      return hasVerifiedPaid || rsvp.pass_approved === true;
    }
    return rsvp.pass_approved === true;
  };

  const myPassEligible = isMemberEligibleForPass(myRsvp);
  const myPassPayload = `CLUBSYNC_PASS::v1::${event.id}::${profile.id}::${qrToken}`;
  const myPassQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(myPassPayload)}`;
  const venueQrPayload = `CLUBSYNC_QR::v1::${event.id}::${qrToken}`;
  const venueQrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=260x260&margin=10&data=${encodeURIComponent(venueQrPayload)}`;

  const handleToggleManualPass = async (rsvp: EventRsvp) => {
    const nextVal = !isMemberEligibleForPass(rsvp);
    setLocalPassOverrides((prev) => ({ ...prev, [rsvp.id]: nextVal }));
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    void logActivity(
      profile,
      'Attendance',
      nextVal ? 'Entry pass granted' : 'Entry pass locked',
      `${profile.full_name} ${nextVal ? 'granted' : 'locked'} entry pass for ${rsvp.student_name} (${rsvp.matric_no}) in "${event.event_name}"`
    );
    onRefresh(`${nextVal ? 'Granted' : 'Locked'} pass for ${rsvp.student_name}.`);
  };

  const handleSaveAdminPaymentQrSettings = async () => {
    setSavingAdminQr(true);
    try {
      let finalUrl = activePayQrUrl.trim();
      if (adminQrFile && adminQrFile.size <= MAX_FILE_SIZE_BYTES) {
        const ext = adminQrFile.name.split('.').pop() || 'png';
        const path = `payment-qr/event-${event.id}-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('receipts').upload(path, adminQrFile);
        if (!error) {
          finalUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
        }
      }
      setActivePayQrUrl(finalUrl);
      setAdminQrFile(null);
      await supabase
        .from('budgets')
        .update({
          payment_qr_url: finalUrl || null,
          payment_bank_info: activePayBankInfo.trim() || null,
          show_payment_qr: showQrToMembers,
        })
        .eq('id', event.id);
      setAdminQrSetupOpen(false);
      onRefresh(showQrToMembers ? 'Payment QR & Bank details displayed to members!' : 'Payment QR hidden from members.');
    } finally {
      setSavingAdminQr(false);
    }
  };

  const handleExportActivityMultiSheetExcel = async () => {
    const totalFeeReceived = eventPayments
      .filter((f) => f.status === 'Verified')
      .reduce((s, f) => s + Number(f.amount_paid), 0);
    const approvedClaims = eventClaims.filter((c) => c.status === 'Approved');
    const totalReimbursed = approvedClaims.reduce((s, c) => s + Number(c.amount), 0);

    await exportMultiSheetExcel(`${event.event_name}_Full_Report`, [
      {
        name: '1_Event_Summary',
        headers: ['Metric', 'Value'],
        rows: [
          ['Activity Name', event.event_name],
          ['Department / Category', event.category],
          ['Date & Time', `${event.event_date} (${event.event_time})`],
          ['Venue', event.location],
          ['Registration Fee (RM)', reqFee.toFixed(2)],
          ['Total Fee Payments Received (RM)', totalFeeReceived.toFixed(2)],
          ['Total Approved Reimbursements (RM)', totalReimbursed.toFixed(2)],
          ['Net Event Balance (Fees - Claims) (RM)', (totalFeeReceived - totalReimbursed).toFixed(2)],
          ['Total Attending Members', attendingRsvps.length],
          ['Total QR Checked-In', qrCheckedInList.length],
          ['Total Carpool Passengers / Drivers', `${passengers.length} Passengers / ${eventDrivers.length} Drivers`],
        ],
      },
      {
        name: '2_Fee_Received',
        headers: ['Date', 'Student Name', 'Matric No', 'Phone', 'Amount Paid (RM)', 'Status', 'Receipt URL'],
        rows: eventPayments.map((p) => [
          p.created_at?.split('T')[0] || '',
          p.student_name,
          p.matric_no,
          p.phone_number,
          Number(p.amount_paid).toFixed(2),
          p.status,
          p.receipt_url,
        ]),
      },
      {
        name: '3_Reimbursements_Paid',
        headers: ['Expense Date', 'Claimant', 'Matric No', 'Phone', 'Title', 'Amount (RM)', 'Bank / DuitNow Details', 'Reviewed By', 'Receipt URL', 'Proof of Paid URL'],
        rows: approvedClaims.map((c) => [
          c.expense_date,
          c.claimant_name,
          c.matric_no,
          c.phone_number,
          c.title,
          Number(c.amount).toFixed(2),
          c.payment_info || (c.description?.includes('Reimburse To:') ? c.description.split('Reimburse To:')[1]?.trim() : '-'),
          c.reviewed_by || '-',
          c.receipt_url,
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '4_All_Claims',
        headers: ['Date', 'Claimant', 'Matric No', 'Title', 'Category', 'Merchant', 'Amount (RM)', 'Status', 'Bank / DuitNow Info', 'Receipt URL', 'Proof of Paid URL'],
        rows: eventClaims.map((c) => [
          c.expense_date,
          c.claimant_name,
          c.matric_no,
          c.title,
          c.category,
          c.merchant_name,
          Number(c.amount).toFixed(2),
          c.status,
          c.payment_info || '-',
          c.receipt_url,
          c.payout_proof_url || '-',
        ]),
      },
      {
        name: '5_Attendance_Passes',
        headers: ['Student Name', 'Matric No', 'Phone', 'Department', 'RSVP', 'Pass Status', 'QR Checked-In', 'Check-In Time'],
        rows: eventRsvps.map((r) => [
          r.student_name,
          r.matric_no,
          r.phone_number,
          r.member_type,
          r.attendance,
          isMemberEligibleForPass(r) ? 'Unlocked' : 'Locked',
          r.qr_checked_in ? 'Yes' : 'No',
          r.qr_checked_in_at || '-',
        ]),
      },
      {
        name: '6_Carpool_Drivers',
        headers: ['Role', 'Name', 'Matric No', 'Phone', 'Pickup Dorm', 'Trip Type', 'Car Details', 'Seats', 'Assigned Driver'],
        rows: attendingRsvps.map((r) => [
          r.is_driver ? 'DRIVER' : r.transport_type !== 'None' ? 'PASSENGER' : 'OWN TRANSPORT',
          r.student_name,
          r.matric_no,
          r.phone_number,
          r.dormitory || '-',
          r.transport_type,
          r.car_details || '-',
          r.is_driver ? r.seats_available : '-',
          r.assigned_driver_name || '-',
        ]),
      },
    ]);
    onRefresh(`Exported Multi-Sheet Excel for "${event.event_name}"!`);
  };

  const handlePayFeeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFeeError(null);
    const numAmt = parseFloat(amountPaid) || 0;
    if (numAmt <= 0) {
      setFeeError('Please enter a valid payment amount.');
      return;
    }
    if (!feeFile) {
      setFeeError('Please upload your payment receipt first.');
      return;
    }
    if (feeFile.size > MAX_FILE_SIZE_BYTES) {
      setFeeError('File size must be under 50 MB.');
      return;
    }
    setSubmittingFee(true);
    try {
      const path = `fees/${event.id}/${profile.id}-${Date.now()}.${feeFile.name.split('.').pop() || 'jpg'}`;
      const { error } = await supabase.storage.from('receipts').upload(path, feeFile);
      if (!error) {
        const receiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
        await supabase.from('event_rsvps').upsert({
          budget_id: event.id, user_id: profile.id, student_name: profile.full_name,
          matric_no: profile.matric_no, phone_number: profile.phone_number,
          member_type: profile.member_type || 'Member', dormitory: profile.dormitory || '',
          attendance: 'Attending', transport_type: myRsvp?.transport_type || 'None',
          pass_approved: myRsvp?.pass_approved ?? false,
        }, { onConflict: 'budget_id,user_id' });

        await supabase.from('activity_fee_payments').insert({
          budget_id: event.id, user_id: profile.id, student_name: profile.full_name,
          matric_no: profile.matric_no, phone_number: profile.phone_number, amount_paid: numAmt,
          receipt_url: receiptUrl, receipt_file_name: feeFile.name, status: 'Pending',
        });
        setFeeFile(null);
        void logActivity(
          profile,
          'Fees',
          'Activity fee submitted (Pending)',
          `${profile.full_name} (${profile.matric_no}) submitted RM ${numAmt.toFixed(2)} fee receipt for "${event.event_name}" (Pending verification)`
        );
        onRefresh('Fee receipt submitted! Pending Treasurer verification.');
      }
    } finally {
      setSubmittingFee(false);
    }
  };

  const handleVerifyOrRejectFee = async (p: ActivityFeePayment, decision: 'Verified' | 'Rejected') => {
    if (!isAdmin || !permissions.can_manage_claims_fees) return;
    const rawConfirm = feeConfirmAmounts[p.id];
    const confirmedAmt = rawConfirm !== undefined && !isNaN(parseFloat(rawConfirm)) && parseFloat(rawConfirm) > 0
      ? parseFloat(rawConfirm)
      : Number(p.amount_paid);
    const reason = (rejectReasonByFee[p.id] || '').trim();

    setReviewingFeeId(p.id);
    try {
      const { error } = await supabase
        .from('activity_fee_payments')
        .update({ status: decision, amount_paid: confirmedAmt })
        .eq('id', p.id);
      if (error) {
        onRefresh(error.message || 'Could not update fee payment.');
        return;
      }

      if (decision === 'Verified' && passRule === 'auto_after_payment' && p.user_id) {
        await supabase
          .from('event_rsvps')
          .update({ pass_approved: true })
          .eq('budget_id', event.id)
          .eq('user_id', p.user_id);
      }

      const changes = computeFieldChanges([
        { field: 'Status', before: p.status, after: decision },
        { field: 'Amount Paid (RM)', before: Number(p.amount_paid).toFixed(2), after: confirmedAmt.toFixed(2) },
        ...(decision === 'Rejected' && reason ? [{ field: 'Reject Reason', before: '', after: reason }] : []),
      ]);
      void recordEditHistory({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: p.id,
        recordTitle: `${p.student_name} — ${event.event_name}`,
        changes,
      });
      void logActivity(
        profile,
        'Fees',
        decision === 'Verified' ? 'Fee payment verified' : 'Fee payment rejected',
        `${profile.full_name} (${profile.matric_no}) ${decision.toLowerCase()} RM ${confirmedAmt.toFixed(2)} fee from ${p.student_name} (${p.matric_no}) for "${event.event_name}"${
          decision === 'Rejected' && reason ? ` — Reason: ${reason}` : ''
        }`
      );
      if (p.user_id) {
        void emitClubNotification({
          targetUserId: p.user_id,
          type: 'fee',
          title:
            decision === 'Verified'
              ? `Fee Verified — ${event.event_name}`
              : `Fee Rejected — ${event.event_name}`,
          body:
            decision === 'Verified'
              ? `RM ${confirmedAmt.toFixed(2)} confirmed.${
                  passRule === 'auto_after_payment' ? ' Your Entry Pass is now unlocked.' : ''
                }`
              : reason
              ? `RM ${confirmedAmt.toFixed(2)} rejected: ${reason}`
              : `Your RM ${confirmedAmt.toFixed(2)} receipt was rejected.`,
          targetTab: 'activities',
          targetId: event.id,
          actorName: profile.full_name,
        });
      }
      onRefresh(
        decision === 'Verified'
          ? `✓ Verified RM ${confirmedAmt.toFixed(2)} for ${p.student_name}${passRule === 'auto_after_payment' ? ' (Entry Pass unlocked)' : ''}!`
          : `Rejected fee receipt from ${p.student_name}.`
      );
    } finally {
      setReviewingFeeId(null);
    }
  };

  const openEditFeeModal = (p: ActivityFeePayment) => {
    setEditingFee(p);
    setEditFeeName(p.student_name || '');
    setEditFeeMatric(p.matric_no || '');
    setEditFeePhone(p.phone_number || '');
    setEditFeeAmount(String(p.amount_paid ?? 0));
    setEditFeeStatus(p.status || 'Verified');
    setEditFeeFile(null);
    setEditFeeError(null);
  };

  const handleSaveEditFee = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingFee) return;
    setEditFeeError(null);
    const nextAmt = parseFloat(editFeeAmount);
    if (isNaN(nextAmt) || nextAmt <= 0) {
      setEditFeeError('Please enter a valid fee amount greater than 0.');
      return;
    }

    setSavingEditFee(true);
    try {
      let nextReceiptUrl = editingFee.receipt_url;
      let nextReceiptName = editingFee.receipt_file_name;
      if (editFeeFile) {
        if (editFeeFile.size > MAX_FILE_SIZE_BYTES) {
          setEditFeeError('File size must be under 50 MB.');
          return;
        }
        const ext = editFeeFile.name.split('.').pop() || 'jpg';
        const path = `fees/${event.id}/${editingFee.user_id}-${Date.now()}.${ext}`;
        const { error: upErr } = await supabase.storage.from('receipts').upload(path, editFeeFile);
        if (!upErr) {
          nextReceiptUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
          nextReceiptName = editFeeFile.name;
        }
      }

      const nextStatus = isAdmin ? editFeeStatus : editingFee.status;
      const { error } = await supabase
        .from('activity_fee_payments')
        .update({
          student_name: editFeeName.trim() || editingFee.student_name,
          matric_no: editFeeMatric.trim() || editingFee.matric_no,
          phone_number: editFeePhone.trim(),
          amount_paid: nextAmt,
          status: nextStatus,
          receipt_url: nextReceiptUrl,
          receipt_file_name: nextReceiptName,
        })
        .eq('id', editingFee.id);
      if (error) {
        setEditFeeError(error.message || 'Could not update fee payment.');
        return;
      }

      const changes = computeFieldChanges([
        { field: 'Student Name', before: editingFee.student_name, after: editFeeName.trim() || editingFee.student_name },
        { field: 'Matric No', before: editingFee.matric_no, after: editFeeMatric.trim() || editingFee.matric_no },
        { field: 'Phone', before: editingFee.phone_number, after: editFeePhone.trim() },
        { field: 'Amount Paid (RM)', before: Number(editingFee.amount_paid).toFixed(2), after: nextAmt.toFixed(2) },
        { field: 'Status', before: editingFee.status, after: nextStatus },
        ...(editFeeFile ? [{ field: 'Receipt', before: editingFee.receipt_file_name, after: nextReceiptName }] : []),
      ]);
      void recordEditHistory({
        actor: profile,
        category: 'Fees',
        table: 'activity_fee_payments',
        recordId: editingFee.id,
        recordTitle: `${editFeeName.trim() || editingFee.student_name} — ${event.event_name}`,
        changes,
      });

      setEditingFee(null);
      onRefresh(`Updated fee record for ${editFeeName.trim() || editingFee.student_name}!`);
    } finally {
      setSavingEditFee(false);
    }
  };

  const handleSoftDeleteFee = async (p: ActivityFeePayment) => {
    await softDeleteRecord({
      actor: profile,
      category: 'Fees',
      table: 'activity_fee_payments',
      recordId: p.id,
      recordTitle: `${p.student_name} (${event.event_name}) — RM ${Number(p.amount_paid).toFixed(2)}`,
    });
    onRefresh(`Removed fee record from web view (kept in Supabase).`);
  };

  const handleSaveTransportForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTransport(true);
    setTransportSavedSuccess(false);
    try {
      const isDriving = surveyChoice === 'DRIVER';
      const nextTransport = surveyChoice === 'OWN' || surveyChoice === 'DRIVER' ? 'None' : surveyChoice;
      const coreRow = {
        budget_id: event.id, user_id: profile.id, student_name: profile.full_name,
        matric_no: profile.matric_no, phone_number: profile.phone_number, member_type: profile.member_type || 'Member',
        dormitory: dormitoryInput.trim() || profile.dormitory || '', attendance: 'Attending',
        transport_type: nextTransport, is_driver: isDriving, car_details: isDriving ? carDetails.trim() : '',
        seats_available: isDriving ? Math.max(1, parseInt(seatsAvailable) || 4) : 0,
        trips_count: isDriving ? Math.max(1, parseInt(tripsCount) || 1) : 0,
        assigned_driver_name: nextTransport === 'None' ? '' : myRsvp?.assigned_driver_name || '',
        pass_approved: myRsvp?.pass_approved ?? false,
        updated_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('event_rsvps').upsert({
        ...coreRow,
        pickup_time: isDriving ? pickupTime.trim() || null : null,
        pickup_point: isDriving ? pickupPoint.trim() || null : null,
      }, { onConflict: 'budget_id,user_id' });
      if (error) {
        await supabase.from('event_rsvps').upsert(coreRow, { onConflict: 'budget_id,user_id' });
      }
      void logActivity(
        profile,
        'Carpool',
        isDriving ? 'Registered as driver' : 'Transport updated',
        isDriving
          ? `${profile.full_name} (${profile.matric_no}) registered as driver (${carDetails.trim() || 'Car'}, ${seatsAvailable} seats${
              pickupTime.trim() || pickupPoint.trim()
                ? `, pickup ${formatPickupTime(pickupTime) || ''} ${pickupPoint.trim() ? `@ ${pickupPoint.trim()}` : ''}`
                : ''
            }) for "${event.event_name}"`
          : `${profile.full_name} (${profile.matric_no}) updated transport to ${nextTransport === 'None' ? 'Own Transport' : nextTransport} for "${event.event_name}"`
      );
      if (myRsvp && !myRsvp.id.startsWith('temp-')) {
        const changes = computeFieldChanges([
          { field: 'Transport', before: myRsvp.is_driver ? 'Driver' : myRsvp.transport_type, after: isDriving ? 'Driver' : nextTransport },
          { field: 'Dormitory', before: myRsvp.dormitory, after: coreRow.dormitory },
          { field: 'Car Details', before: myRsvp.car_details, after: coreRow.car_details },
          { field: 'Pickup Time', before: myRsvp.pickup_time || '', after: isDriving ? pickupTime.trim() : '' },
          { field: 'Meeting Point', before: myRsvp.pickup_point || '', after: isDriving ? pickupPoint.trim() : '' },
        ]);
        void recordEditHistory({
          actor: profile,
          category: 'Carpool',
          table: 'event_rsvps',
          recordId: myRsvp.id,
          recordTitle: `${profile.full_name} (${event.event_name})`,
          changes,
        });
      }
      setTransportSavedSuccess(true);
      onRefresh('✓ Carpool & Transport updated!');
      setTimeout(() => {
        onClose();
      }, 450);
    } finally {
      setSavingTransport(false);
    }
  };

  const handleDriverClaimPassenger = async (passenger: EventRsvp, driverName: string) => {
    await supabase.from('event_rsvps').update({ assigned_driver_name: driverName }).eq('id', passenger.id);
    void logActivity(
      profile,
      'Carpool',
      driverName ? 'Passenger assigned' : 'Passenger released',
      driverName
        ? `${driverName} assigned to pick up ${passenger.student_name} (${passenger.matric_no}) for "${event.event_name}"`
        : `${profile.full_name} released passenger ${passenger.student_name} (${passenger.matric_no}) for "${event.event_name}"`
    );
    if (driverName && passenger.user_id) {
      const drv = eventDrivers.find((d) => d.student_name === driverName);
      void emitClubNotification({
        targetUserId: passenger.user_id,
        type: 'carpool',
        title: `Carpool Assigned — ${event.event_name}`,
        body: `Driver: ${driverName}${
          drv?.pickup_time || drv?.pickup_point
            ? ` (${formatPickupTime(drv.pickup_time) || 'Time TBA'} @ ${drv.pickup_point || 'Point TBA'})`
            : ''
        }`,
        targetTab: 'activities',
        targetId: event.id,
        actorName: profile.full_name,
      });
    }
    onRefresh(driverName ? `${driverName} assigned to pick up ${passenger.student_name}!` : `Released ${passenger.student_name}.`);
  };

  const exportCsv = (filename: string, headers: string[], rows: (string | number)[][]) => {
    const csv = [headers.join(','), ...rows.map((r) => r.map((v) => `"${String(v ?? '').replace(/"/g, '""')}"`).join(','))].join('\n');
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' })); a.download = filename; a.click();
  };

  const isQrPdf = activePayQrUrl.toLowerCase().split('?')[0].endsWith('.pdf');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border max-w-4xl w-full overflow-hidden my-8">
        <div className="bg-slate-900 text-white px-6 py-4 space-y-3">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0">
              {hasEntryPass ? <Ticket className="w-5 h-5 text-emerald-400 shrink-0" /> : <QrCode className="w-5 h-5 text-emerald-400 shrink-0" />}
              <div className="min-w-0"><h2 className="text-base font-bold truncate">{event.event_name}</h2><p className="text-xs text-slate-400 truncate">{event.event_date} • {event.location}</p></div>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="shrink-0 w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-slate-200 hover:text-white flex items-center justify-center cursor-pointer transition"><X className="w-4 h-4" /></button>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {isAdmin && (
              <button
                type="button"
                onClick={handleExportActivityMultiSheetExcel}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold cursor-pointer"
                title="Download 6-Sheet Excel Report for this Activity"
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Excel Report</span>
              </button>
            )}
            <div className="flex flex-wrap bg-slate-800 p-1 rounded-xl text-xs">
              {hasEntryPass && (
                <button type="button" onClick={() => setTab('pass')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${tab === 'pass' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>Entry Pass</button>
              )}
              {isAdmin && (
                <button type="button" onClick={() => setTab('qr')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${tab === 'qr' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>Venue QR ({qrCheckedInList.length})</button>
              )}
              {(requiresFee || isAdmin) && (
                <button type="button" onClick={() => setTab('fee')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer inline-flex items-center gap-1.5 ${tab === 'fee' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>
                  <span>Fee (RM {reqFee.toFixed(0)})</span>
                  {isAdmin && permissions.can_manage_claims_fees && pendingFeePayments.length > 0 && (
                    <span className="px-1.5 py-0.2 rounded-full text-[10px] font-extrabold bg-amber-400 text-slate-950">
                      {pendingFeePayments.length}
                    </span>
                  )}
                </button>
              )}
              <button type="button" onClick={() => setTab('transport')} className={`px-3 py-1.5 rounded-lg font-bold cursor-pointer ${tab === 'transport' ? 'bg-emerald-600 text-white' : 'text-slate-300'}`}>Carpool ({passengers.length}P / {eventDrivers.length}D)</button>
            </div>
          </div>
        </div>

        <div className="p-6 max-h-[75vh] overflow-y-auto space-y-6 text-xs">
          {tab === 'pass' && hasEntryPass && (
            <div className={`grid grid-cols-1 ${isAdmin ? 'lg:grid-cols-12' : 'max-w-sm mx-auto'} gap-6`}>
              <div className={`${isAdmin ? 'lg:col-span-5' : 'w-full'} bg-gradient-to-b from-slate-900 to-emerald-950 text-white rounded-3xl p-6 flex flex-col items-center text-center justify-between shadow-xl border border-emerald-700/40`}>
                <div className="space-y-1">
                  <span className="px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">Entry Pass</span>
                  <h3 className="text-base font-extrabold mt-1">{event.event_name}</h3>
                </div>
                {myPassEligible ? (
                  <div className="my-4 p-3.5 bg-white rounded-3xl shadow-lg border-4 border-emerald-500">
                    <img src={myPassQrUrl} alt="Entry Pass QR" className="w-48 h-48 object-contain mx-auto" />
                    <div className="mt-2 pt-2 border-t text-slate-900"><p className="font-extrabold text-xs">{profile.full_name}</p><p className="font-mono text-[11px] text-slate-500">{profile.matric_no}</p></div>
                  </div>
                ) : (
                  <div className="my-5 p-5 rounded-2xl bg-white/10 border border-white/15 space-y-3 w-full">
                    <Lock className="w-8 h-8 text-amber-300 mx-auto" />
                    <p className="text-xs font-extrabold">Entry Pass Locked</p>
                    {requiresFee && passRule === 'auto_after_payment' ? (
                      eventPayments.some((f) => f.user_id === profile.id && f.status === 'Pending') ? (
                        <p className="text-[11px] text-amber-200 font-semibold">
                          ⏳ Receipt submitted — waiting for Treasurer verification to unlock your Entry Pass QR.
                        </p>
                      ) : (
                        <>
                          <p className="text-[11px] text-emerald-100">
                            Pay RM {reqFee.toFixed(2)} and await Treasurer verification to unlock your Entry Pass QR:
                          </p>
                          <button type="button" onClick={() => setTab('fee')} className="w-full py-2.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-extrabold cursor-pointer">
                            Pay RM {reqFee.toFixed(2)} Fee →
                          </button>
                        </>
                      )
                    ) : (
                      <p className="text-[11px] text-emerald-100">Your Entry Pass QR will appear here once granted by the Admin.</p>
                    )}
                  </div>
                )}
                <div className="w-full pt-3 border-t border-white/15 flex justify-between text-[11px]">
                  <span className="text-emerald-200">My Pass Status:</span>
                  <span className="font-extrabold">{myRsvp?.qr_checked_in ? '✓ ATTENDED' : myPassEligible ? '✓ PASS READY' : '✗ LOCKED'}</span>
                </div>
              </div>

              {isAdmin && (
                <div className="lg:col-span-7 space-y-4">
                  {onOpenScanner && (
                    <div className="p-4 rounded-2xl bg-slate-900 text-white flex items-center justify-between gap-3">
                      <div><h4 className="font-extrabold text-emerald-400"><Camera className="w-4 h-4 inline mr-1" />Scan Entry Pass QR</h4><p className="text-[11px] text-slate-300">Automatically verifies eligibility and records attendance.</p></div>
                      <button type="button" onClick={() => { onClose(); onOpenScanner(); }} className="px-4 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-white/20 text-white font-extrabold cursor-pointer">Scan Pass</button>
                    </div>
                  )}
                  <div className="border rounded-2xl overflow-hidden">
                    <table className="w-full text-left border-collapse">
                      <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Member</th>{requiresFee && <th className="py-2 px-3">Fee</th>}<th className="py-2 px-3">Pass Status</th><th className="py-2 px-3 text-right">Action</th></tr></thead>
                      <tbody className="divide-y">
                        {attendingRsvps.map((r) => {
                          const paid = eventPayments.find((f) => f.user_id === r.user_id && f.status === 'Verified');
                          const hasPass = isMemberEligibleForPass(r);
                          return (
                            <tr key={r.id}>
                              <td className="py-2 px-3 font-bold">{r.student_name} ({r.matric_no})</td>
                              {requiresFee && <td className="py-2 px-3">{paid ? <span className="text-emerald-700 font-bold">Paid ✓</span> : <span className="text-amber-700 font-bold">Unpaid</span>}</td>}
                              <td className="py-2 px-3">{r.qr_checked_in ? <span className="px-2 py-0.5 rounded-full bg-emerald-600 text-white font-bold text-[10px]"><ShieldCheck className="w-3 h-3 inline mr-0.5" />Attended</span> : hasPass ? <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">✓ Unlocked</span> : <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-bold text-[10px]">Locked</span>}</td>
                              <td className="py-2 px-3 text-right"><button type="button" onClick={() => handleToggleManualPass(r)} className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${hasPass ? 'bg-rose-50 text-rose-700' : 'bg-emerald-600 text-white'}`}>{hasPass ? 'Lock' : 'Grant Pass'}</button></td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </div>
          )}

          {tab === 'qr' && isAdmin && (
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              <div className="lg:col-span-5 bg-slate-50 border rounded-3xl p-5 flex flex-col items-center text-center space-y-3">
                <span className="px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">Venue Attendance QR</span>
                <div className="p-3 bg-white rounded-3xl border-2 border-emerald-600"><img src={venueQrUrl} alt="Event QR" className="w-52 h-52 object-contain" /></div>
                <p className="text-[11px] text-slate-500">Members scan this QR code to automatically record attendance.</p>
                {permissions.can_manage_activities && <button type="button" onClick={async () => { const tok = Math.random().toString(36).substring(2, 10).toUpperCase(); await supabase.from('budgets').update({ qr_code_token: tok }).eq('id', event.id); setQrToken(tok); onRefresh('Reset QR!'); }} className="px-4 py-2 rounded-xl font-bold bg-slate-200 text-slate-800 cursor-pointer"><RefreshCw className="w-3.5 h-3.5 inline mr-1" />Reset QR</button>}
              </div>
              <div className="lg:col-span-7 space-y-3">
                <div className="flex justify-between"><h3 className="text-sm font-extrabold">Recorded Attendance ({qrCheckedInList.length})</h3><button type="button" onClick={() => exportCsv(`${event.event_name}_Attendance.csv`, ['Name', 'Matric', 'Phone', 'Department', 'Time'], qrCheckedInList.map((r) => [r.student_name, r.matric_no, r.phone_number, r.member_type, r.qr_checked_in_at || 'Verified']))} className="px-3 py-1 rounded-xl bg-slate-100 text-slate-800 font-bold cursor-pointer"><Download className="w-3.5 h-3.5 inline mr-1" />Export CSV</button></div>
                <div className="border rounded-2xl overflow-hidden">
                  <table className="w-full text-left border-collapse">
                    <thead><tr className="bg-slate-50 border-b"><th className="py-2 px-3">Student</th><th className="py-2 px-3">Department</th><th className="py-2 px-3 text-right">Time</th></tr></thead>
                    <tbody className="divide-y">{qrCheckedInList.map((r) => (<tr key={r.id}><td className="py-2 px-3 font-bold">{r.student_name} ({r.matric_no})</td><td className="py-2 px-3">{r.member_type}</td><td className="py-2 px-3 text-right font-mono">{r.qr_checked_in_at ? new Date(r.qr_checked_in_at).toLocaleTimeString() : 'Verified'}</td></tr>))}</tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          {tab === 'fee' && (requiresFee || isAdmin) && (
            <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
              <div className="lg:col-span-2 space-y-3 self-start">
                {isAdmin && (
                  <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 space-y-2.5">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-extrabold text-emerald-950 flex items-center gap-1.5">
                        <Settings className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Admin: Payment QR &amp; Bank Display</span>
                      </span>
                      <button
                        type="button"
                        onClick={() => setAdminQrSetupOpen(!adminQrSetupOpen)}
                        className="px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                      >
                        {adminQrSetupOpen ? 'Close' : 'Upload / Edit QR'}
                      </button>
                    </div>
                    {adminQrSetupOpen && (
                      <div className="space-y-2 pt-2 border-t border-emerald-200">
                        <label className="flex items-center justify-between gap-2 p-2 rounded-xl bg-white border cursor-pointer font-bold text-slate-800">
                          <span className="flex items-center gap-1.5">
                            {showQrToMembers ? <Eye className="w-3.5 h-3.5 text-emerald-600" /> : <EyeOff className="w-3.5 h-3.5 text-slate-400" />}
                            <span>Display Payment QR / Bank Info to Members</span>
                          </span>
                          <input
                            type="checkbox"
                            checked={showQrToMembers}
                            onChange={(e) => setShowQrToMembers(e.target.checked)}
                          />
                        </label>
                        <div>
                          <label className="block font-bold text-emerald-900 mb-1">Upload QR File (JPG, PNG, WEBP, PDF)</label>
                          <input
                            type="file"
                            accept="image/*,application/pdf"
                            onChange={(e) => setAdminQrFile(e.target.files?.[0] || null)}
                            className="w-full text-[11px] file:mr-2 file:py-1 file:px-2.5 file:rounded-lg file:border-0 file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                          />
                        </div>
                        <input
                          type="url"
                          value={activePayQrUrl}
                          onChange={(e) => setActivePayQrUrl(e.target.value)}
                          placeholder="Or paste QR Image / PDF URL (Leave empty for none)"
                          className="w-full rounded-xl border bg-white px-2.5 py-1.5"
                        />
                        <input
                          type="text"
                          value={activePayBankInfo}
                          onChange={(e) => setActivePayBankInfo(e.target.value)}
                          placeholder="Bank Name, Account No & Holder Name"
                          className="w-full rounded-xl border bg-white px-2.5 py-1.5 font-mono font-bold"
                        />
                        <div className="flex justify-between gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => {
                              setActivePayQrUrl('');
                              setActivePayBankInfo('');
                              setAdminQrFile(null);
                            }}
                            className="px-2.5 py-1.5 rounded-xl bg-rose-50 text-rose-700 font-bold cursor-pointer"
                          >
                            Clear QR
                          </button>
                          <button
                            type="button"
                            disabled={savingAdminQr}
                            onClick={handleSaveAdminPaymentQrSettings}
                            className="px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                          >
                            {savingAdminQr ? 'Saving...' : 'Save QR Settings'}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                <form onSubmit={handlePayFeeSubmit} className="bg-slate-50 border rounded-2xl p-5 space-y-3">
                  <h3 className="text-sm font-extrabold">Fee Payment (RM {reqFee.toFixed(2)})</h3>
                  {hasEntryPass && passRule === 'auto_after_payment' && (
                    <p className="text-[11px] text-emerald-700 font-semibold">
                      Your Entry Pass QR unlocks once the Treasurer verifies your receipt.
                    </p>
                  )}

                  {showQrToMembers && (activePayQrUrl || activePayBankInfo) && (
                    <div className="p-4 rounded-2xl bg-white border-2 border-emerald-200 space-y-2.5 text-center shadow-xs">
                      <span className="inline-block px-3 py-0.5 rounded-full text-[10px] font-extrabold uppercase bg-emerald-600 text-white">
                        Scan Directly or Download Payment QR
                      </span>
                      {activePayQrUrl && (
                        isQrPdf ? (
                          <div className="space-y-2">
                            <iframe src={activePayQrUrl} title="Payment QR PDF" className="w-full h-48 rounded-xl border" />
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => downloadFileFromUrl(activePayQrUrl, `${event.event_name}_Payment_QR.pdf`)}
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download QR PDF</span>
                              </button>
                              <a
                                href={activePayQrUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open Full PDF</span>
                              </a>
                            </div>
                          </div>
                        ) : (
                          <div className="space-y-2">
                            <div className="p-2 bg-white rounded-2xl border mx-auto max-w-[220px] shadow-2xs">
                              <img src={activePayQrUrl} alt="Club Payment QR" className="w-full h-auto object-contain rounded-xl" />
                            </div>
                            <div className="flex justify-center gap-2">
                              <button
                                type="button"
                                onClick={() => downloadFileFromUrl(activePayQrUrl, `${event.event_name}_Payment_QR.png`)}
                                className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer"
                              >
                                <Download className="w-3.5 h-3.5" />
                                <span>Download QR</span>
                              </button>
                              <a
                                href={activePayQrUrl}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Full Size</span>
                              </a>
                            </div>
                          </div>
                        )
                      )}
                      {activePayBankInfo && (
                        <div className="text-[11px] bg-emerald-50/80 border border-emerald-200 rounded-xl p-2.5 flex items-center justify-between gap-2 text-left">
                          <div>
                            <span className="text-[10px] font-bold text-emerald-800 block uppercase">Bank Transfer Details:</span>
                            <span className="font-mono font-extrabold text-slate-900 break-all">{activePayBankInfo}</span>
                          </div>
                          <button
                            type="button"
                            onClick={() => navigator.clipboard.writeText(activePayBankInfo)}
                            className="px-2.5 py-1.5 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px] shrink-0 cursor-pointer"
                          >
                            <Copy className="w-3 h-3 inline mr-0.5" />
                            Copy
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Amount Paid (RM)</label>
                    <input type="number" step="0.01" value={amountPaid} onChange={(e) => setAmountPaid(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-bold" required />
                  </div>
                  <label className="flex flex-col items-center justify-center gap-2 p-4 rounded-2xl border-2 border-dashed border-emerald-300 bg-emerald-50/60 hover:bg-emerald-50 cursor-pointer text-center transition">
                    <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center shadow-xs">
                      {feeFile ? <FileText className="w-5 h-5" /> : <UploadCloud className="w-5 h-5" />}
                    </div>
                    <div className="text-xs font-bold text-emerald-950 break-all">
                      {feeFile ? feeFile.name : 'Upload Payment Receipt (JPG, PNG, PDF)'}
                    </div>
                    <span className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px]">
                      <UploadCloud className="w-3.5 h-3.5" />
                      <span>{feeFile ? 'Change File' : 'Upload Receipt'}</span>
                    </span>
                    <input type="file" accept="image/*,application/pdf" onChange={(e) => { setFeeFile(e.target.files?.[0] || null); setFeeError(null); }} className="hidden" />
                  </label>
                  {feeError && <div className="flex items-center gap-1.5 text-xs bg-rose-50 text-rose-700 px-3 py-2 rounded-xl font-semibold"><AlertCircle className="w-4 h-4 shrink-0" /><span>{feeError}</span></div>}
                  <button type="submit" disabled={submittingFee} className="w-full py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"><CheckCircle2 className="w-4 h-4 inline mr-1" />{submittingFee ? 'Uploading...' : 'Submit Payment'}</button>
                </form>
              </div>
              <div className="lg:col-span-3 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h3 className="text-sm font-extrabold">
                    {isAdmin ? `Fee Submissions (${visibleFeePayments.length})` : `My Fee Receipt (${visibleFeePayments.length})`}
                  </h3>
                  {isAdmin && (
                    <div className="inline-flex bg-slate-100 p-1 rounded-xl gap-1">
                      {(['Pending', 'Verified', 'Rejected'] as const).map((statusTab) => {
                        const count = visibleFeePayments.filter((f) => f.status === statusTab).length;
                        const active = feeStatusFilter === statusTab;
                        return (
                          <button
                            key={statusTab}
                            type="button"
                            onClick={() => setFeeStatusFilter(statusTab)}
                            className={`px-2.5 py-1 rounded-lg text-[11px] font-bold cursor-pointer transition ${
                              active
                                ? statusTab === 'Pending'
                                  ? 'bg-amber-500 text-slate-950 shadow-2xs'
                                  : statusTab === 'Verified'
                                  ? 'bg-emerald-600 text-white shadow-2xs'
                                  : 'bg-rose-600 text-white shadow-2xs'
                                : 'text-slate-600 hover:text-slate-900'
                            }`}
                          >
                            {statusTab} ({count})
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>

                {(() => {
                  const displayedFees = isAdmin
                    ? visibleFeePayments.filter((f) => f.status === feeStatusFilter)
                    : visibleFeePayments;
                  return (
                    <div className="border rounded-2xl overflow-hidden">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-50 border-b">
                            <th className="py-2 px-3">Student</th>
                            <th className="py-2 px-3">Amount</th>
                            {(!isAdmin || feeStatusFilter !== 'Pending') && <th className="py-2 px-3">Status</th>}
                            <th className="py-2 px-3 text-right">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y">
                          {displayedFees.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-6 text-center text-slate-400">
                                {isAdmin ? `No ${feeStatusFilter.toLowerCase()} fee submissions.` : 'No payment submission yet.'}
                              </td>
                            </tr>
                          ) : (
                            displayedFees.map((p) => {
                              const isBusy = reviewingFeeId === p.id;
                              const isPdfFile =
                                p.receipt_file_name?.toLowerCase().endsWith('.pdf') ||
                                p.receipt_url?.toLowerCase().split('?')[0].endsWith('.pdf');
                              return (
                                <tr key={p.id}>
                                  <td className="py-2 px-3">
                                    <div className="font-bold text-slate-900">{p.student_name}</div>
                                    <div className="text-[10px] text-slate-400 font-mono">{p.matric_no}</div>
                                  </td>
                                  <td className="py-2 px-3 font-extrabold text-emerald-700">
                                    RM {Number(p.amount_paid).toFixed(2)}
                                  </td>
                                  {(!isAdmin || feeStatusFilter !== 'Pending') && (
                                    <td className="py-2 px-3">
                                      <span
                                        className={`px-2 py-0.5 rounded-full font-bold text-[10px] ${
                                          p.status === 'Verified'
                                            ? 'bg-emerald-100 text-emerald-800'
                                            : p.status === 'Rejected'
                                            ? 'bg-rose-100 text-rose-700'
                                            : 'bg-amber-100 text-amber-900'
                                        }`}
                                      >
                                        {p.status}
                                      </span>
                                    </td>
                                  )}
                                  <td className="py-2 px-3 text-right">
                                    <div className="inline-flex items-center gap-1.5 justify-end">
                                      {p.receipt_url && !isPdfFile ? (
                                        <button
                                          type="button"
                                          onClick={() => setZoomReceiptFee(p)}
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-[11px] cursor-pointer"
                                          title="Zoom Receipt"
                                        >
                                          <ZoomIn className="w-3.5 h-3.5 text-emerald-700" />
                                          {isAdmin && p.status === 'Pending' && <span>Receipt</span>}
                                        </button>
                                      ) : p.receipt_url ? (
                                        <a
                                          href={p.receipt_url}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-slate-100 hover:bg-slate-200 text-emerald-700 font-bold text-[11px]"
                                          title="View Receipt PDF"
                                        >
                                          <ExternalLink className="w-3.5 h-3.5" />
                                          {isAdmin && p.status === 'Pending' && <span>PDF</span>}
                                        </a>
                                      ) : null}

                                      {isAdmin && permissions.can_manage_claims_fees && p.status === 'Pending' ? (
                                        <>
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => void handleVerifyOrRejectFee(p, 'Verified')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] cursor-pointer disabled:opacity-60"
                                          >
                                            {isBusy ? <Loader2 className="w-3 h-3 animate-spin" /> : <CheckCircle2 className="w-3 h-3" />}
                                            <span>Verify</span>
                                          </button>
                                          <button
                                            type="button"
                                            disabled={isBusy}
                                            onClick={() => void handleVerifyOrRejectFee(p, 'Rejected')}
                                            className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold text-[11px] cursor-pointer disabled:opacity-60"
                                          >
                                            <XCircle className="w-3 h-3" />
                                            <span>Reject</span>
                                          </button>
                                        </>
                                      ) : (
                                        <>
                                          <button
                                            type="button"
                                            onClick={() => setHistoryTarget({ table: 'activity_fee_payments', recordId: p.id, title: `${p.student_name} Fee` })}
                                            className="p-1.5 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                                            title="View Edit History"
                                          >
                                            <History className="w-3.5 h-3.5" />
                                          </button>
                                          {(isAdmin || p.user_id === profile.id) && (
                                            <>
                                              <button
                                                type="button"
                                                onClick={() => openEditFeeModal(p)}
                                                className="p-1.5 rounded-lg bg-slate-100 text-slate-800 hover:bg-emerald-50 cursor-pointer"
                                                title="Edit Fee Payment"
                                              >
                                                <Edit3 className="w-3.5 h-3.5" />
                                              </button>
                                              <button
                                                type="button"
                                                onClick={() => handleSoftDeleteFee(p)}
                                                className="p-1.5 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                                title="Delete from web (kept in Supabase)"
                                              >
                                                <Trash2 className="w-3.5 h-3.5" />
                                              </button>
                                            </>
                                          )}
                                        </>
                                      )}
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
                    </div>
                  );
                })()}
              </div>
            </div>
          )}

          {tab === 'transport' && (
            <div className="space-y-5">
              {myAssignedDriver && !isCurrentUserDriver && (
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-300 flex flex-wrap items-center justify-between gap-3">
                  <div className="space-y-1">
                    <div className="text-[10px] font-extrabold uppercase tracking-wide text-emerald-700 flex items-center gap-1">
                      <Car className="w-3.5 h-3.5" /> Your Assigned Carpool Driver
                    </div>
                    <div className="text-sm font-extrabold text-slate-900">
                      {myAssignedDriver.student_name}{' '}
                      <span className="text-xs font-semibold text-slate-600">
                        ({myAssignedDriver.car_details || 'Vehicle'} • {myAssignedDriver.phone_number})
                      </span>
                    </div>
                    {(myAssignedDriver.pickup_time || myAssignedDriver.pickup_point) ? (
                      <div className="text-xs font-bold text-emerald-950 flex flex-wrap items-center gap-3 pt-0.5">
                        {myAssignedDriver.pickup_time && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-200">
                            <Clock className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Pickup: {formatPickupTime(myAssignedDriver.pickup_time)}</span>
                          </span>
                        )}
                        {myAssignedDriver.pickup_point && (
                          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-lg bg-white border border-emerald-200">
                            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                            <span>Meet at: {myAssignedDriver.pickup_point}</span>
                          </span>
                        )}
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-500">Pickup time &amp; meeting point not set by driver yet.</div>
                    )}
                  </div>
                  <a
                    href={waLink(
                      myAssignedDriver.phone_number,
                      `Hi ${myAssignedDriver.student_name}! I'm ${profile.full_name} (${profile.dormitory || 'UTM'}), assigned to your car for ${event.event_name}.${
                        myAssignedDriver.pickup_time || myAssignedDriver.pickup_point
                          ? ` See you at ${formatPickupTime(myAssignedDriver.pickup_time) || 'pickup time'} (${myAssignedDriver.pickup_point || 'meeting point'})!`
                          : ''
                      }`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold text-xs shadow-xs cursor-pointer"
                  >
                    <MessageCircle className="w-4 h-4" />
                    <span>WhatsApp My Driver</span>
                  </a>
                </div>
              )}

              <div className="flex flex-wrap justify-between items-center gap-2 bg-slate-50 p-3.5 rounded-2xl border">
                <span className="font-bold text-slate-800">Passengers Needing Ride: {passengers.length} • Drivers Available: {eventDrivers.length}</span>
                <div className="flex gap-1.5">
                  <button type="button" onClick={() => { const lines = eventDrivers.map((d, i) => { const pax = passengers.filter((p) => p.assigned_driver_name === d.student_name).map((p) => `${p.student_name} (${p.dormitory || 'Campus'})`).join(', ') || 'No passengers yet'; const meet = d.pickup_time || d.pickup_point ? ` [Pickup: ${formatPickupTime(d.pickup_time) || 'TBA'} @ ${d.pickup_point || 'TBA'}]` : ''; return `Car ${i + 1}: ${d.student_name} (${d.car_details || 'Car'})${meet} -> ${pax}`; }); navigator.clipboard.writeText(lines.join('\n')); onRefresh('Copied WhatsApp carpool list!'); }} className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"><Copy className="w-3 h-3 inline mr-1" />Copy List</button>
                  <button type="button" onClick={() => exportCsv(`${event.event_name}_Carpool.csv`, ['Passenger', 'Matric', 'Phone', 'Dorm', 'Trip', 'Driver'], passengers.map((p) => [p.student_name, p.matric_no, p.phone_number, p.dormitory, p.transport_type, p.assigned_driver_name || 'Unassigned']))} className="px-3 py-1.5 rounded-xl bg-white border font-bold cursor-pointer">Export CSV</button>
                </div>
              </div>

              <form onSubmit={handleSaveTransportForm} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className="font-extrabold text-slate-900">1. Update My Transport / Driver Status</h4>
                  {myRsvp?.assigned_driver_name && (
                    <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[11px]">
                      <span>Assigned Driver: {myRsvp.assigned_driver_name}</span>
                      {myAssignedDriver && (
                        <a
                          href={waLink(myAssignedDriver.phone_number, `Hi ${myAssignedDriver.student_name}, I'm ${profile.full_name} in your carpool for ${event.event_name}.`)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 text-white text-[10px] font-extrabold"
                        >
                          <MessageCircle className="w-2.5 h-2.5" /> Chat
                        </a>
                      )}
                    </span>
                  )}
                </div>
                <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 -mb-1">Transport Option</label>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {(['OWN', 'One-Way', 'Return Trip', 'Round Trip', ...(event.driver_recruitment_open || isAdmin ? (['DRIVER'] as const) : [])] as TransportSurveyChoice[]).map((opt) => (
                    <button type="button" key={opt} onClick={() => setSurveyChoice(opt)} className={`p-2 rounded-xl border font-bold cursor-pointer transition ${surveyChoice === opt ? 'bg-slate-900 text-white border-slate-900 shadow-xs' : 'bg-white text-slate-700 hover:bg-slate-100'}`}>{opt === 'OWN' ? 'Own Transport' : opt === 'DRIVER' ? `Driver (RM ${allowancePerTrip}/trip)` : `Need: ${opt}`}</button>
                  ))}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-6 gap-3">
                  <div className={surveyChoice === 'DRIVER' ? 'sm:col-span-3' : 'sm:col-span-6'}>
                    <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Pickup Dorm / Location</label>
                    <input type="text" value={dormitoryInput} onChange={(e) => setDormitoryInput(e.target.value)} placeholder="e.g., KTDI M17" className="w-full rounded-xl border bg-white px-3 py-2 font-bold" />
                  </div>
                  {surveyChoice === 'DRIVER' && (
                    <>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Car Model &amp; Plate No. *</label>
                        <input type="text" value={carDetails} onChange={(e) => setCarDetails(e.target.value)} placeholder="e.g., Perodua Myvi - ABC 1234" className="w-full rounded-xl border bg-white px-3 py-2 font-bold" required />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Available Seats *</label>
                        <input type="number" min="1" value={seatsAvailable} onChange={(e) => setSeatsAvailable(e.target.value)} placeholder="e.g., 4" className="w-full rounded-xl border bg-white px-3 py-2 font-bold" required />
                      </div>
                      <div className="sm:col-span-3">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Number of Trips *</label>
                        <input type="number" min="1" value={tripsCount} onChange={(e) => setTripsCount(e.target.value)} placeholder="e.g., 1" className="w-full rounded-xl border bg-white px-3 py-2 font-bold" required />
                      </div>
                      <div className="sm:col-span-2">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Pickup Time</label>
                        <input type="time" value={pickupTime} onChange={(e) => setPickupTime(e.target.value)} className="w-full rounded-xl border bg-white px-3 py-2 font-bold" />
                      </div>
                      <div className="sm:col-span-4">
                        <label className="block text-[11px] font-extrabold uppercase tracking-wide text-slate-500 mb-1">Meeting Point / Landmark (Shown to Passengers)</label>
                        <input type="text" value={pickupPoint} onChange={(e) => setPickupPoint(e.target.value)} placeholder="e.g., 7:30 PM at KTDI Arked Meranti Bus Stop" className="w-full rounded-xl border bg-white px-3 py-2 font-bold" />
                      </div>
                    </>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  {surveyChoice === 'DRIVER' ? (
                    <div className="flex flex-wrap items-center gap-1.5">
                      <a
                        href={waLink('', buildDriverBroadcastText(profile.full_name, carDetails, pickupTime, pickupPoint, myPassengers))}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-900 border border-emerald-300 font-extrabold text-[11px] cursor-pointer"
                        title="Push pickup time & meeting point announcement to WhatsApp"
                      >
                        <Megaphone className="w-3.5 h-3.5 text-emerald-700" />
                        <span>Broadcast Pickup to WhatsApp ({myPassengers.length})</span>
                      </a>
                    </div>
                  ) : <div />}
                  <div className="flex items-center gap-3">
                    {transportSavedSuccess && (
                      <span className="text-emerald-700 font-extrabold flex items-center gap-1">
                        <CheckCircle2 className="w-4 h-4" />
                        <span>Saved! Closing...</span>
                      </span>
                    )}
                    <button
                      type="submit"
                      disabled={savingTransport}
                      className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-sm transition active:scale-95 cursor-pointer"
                    >
                      {savingTransport ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />}
                      <span>{savingTransport ? 'Saving & Updating...' : 'Confirm & Save Carpool'}</span>
                    </button>
                  </div>
                </div>
              </form>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
                <div className="lg:col-span-5 space-y-2">
                  <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5"><Car className="w-4 h-4 text-emerald-600" /><span>Registered Drivers ({eventDrivers.length})</span></h4>
                  <div className="border rounded-2xl overflow-hidden bg-white">
                    {eventDrivers.length === 0 ? (
                      <div className="p-4 text-center text-slate-400">No drivers registered yet.</div>
                    ) : (
                      <div className="divide-y">
                        {eventDrivers.map((d) => {
                          const driverPax = passengers.filter((p) => p.assigned_driver_name === d.student_name);
                          const assignedCount = driverPax.length;
                          const maxSeats = Number(d.seats_available) || 4;
                          return (
                            <div key={d.id} className="p-3 space-y-1.5">
                              <div className="flex items-center justify-between gap-2">
                                <div>
                                  <div className="font-bold text-slate-900">{d.student_name}</div>
                                  <div className="text-[11px] text-slate-500">{d.car_details || 'Vehicle'} • <span className="font-mono">{d.phone_number}</span></div>
                                </div>
                                <div className="flex items-center gap-1.5 shrink-0">
                                  <a
                                    href={waLink(d.phone_number, `Hi ${d.student_name}, regarding carpool for ${event.event_name}:`)}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                                    title="Open 1-Click WhatsApp chat with driver"
                                  >
                                    <MessageCircle className="w-3 h-3" />
                                    <span>WhatsApp</span>
                                  </a>
                                  <span className={`px-2.5 py-1 rounded-full font-extrabold text-[11px] ${assignedCount >= maxSeats ? 'bg-amber-100 text-amber-900' : 'bg-emerald-100 text-emerald-800'}`}>
                                    {assignedCount}/{maxSeats} seats
                                  </span>
                                  <button
                                    type="button"
                                    onClick={() => setHistoryTarget({ table: 'event_rsvps', recordId: d.id, title: `${d.student_name} (Driver)` })}
                                    className="p-1 rounded-lg bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                                    title="View History"
                                  >
                                    <History className="w-3 h-3" />
                                  </button>
                                  {(isAdmin || d.user_id === profile.id) && (
                                    <button
                                      type="button"
                                      onClick={async () => {
                                        await softDeleteRecord({
                                          actor: profile,
                                          category: 'Carpool',
                                          table: 'event_rsvps',
                                          recordId: d.id,
                                          recordTitle: `${d.student_name} (${event.event_name})`,
                                        });
                                        onRefresh('Removed carpool entry from web view (kept in Supabase).');
                                      }}
                                      className="p-1 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                      title="Delete from web (kept in Supabase)"
                                    >
                                      <Trash2 className="w-3 h-3" />
                                    </button>
                                  )}
                                </div>
                              </div>
                              {(d.pickup_time || d.pickup_point) && (
                                <div className="flex flex-wrap items-center justify-between gap-1.5 text-[11px] bg-emerald-50/80 border border-emerald-200/80 rounded-xl px-2.5 py-1.5 text-emerald-950">
                                  <span className="font-semibold">
                                    {d.pickup_time ? `🕒 ${formatPickupTime(d.pickup_time)}` : ''}
                                    {d.pickup_time && d.pickup_point ? ' • ' : ''}
                                    {d.pickup_point ? `📍 ${d.pickup_point}` : ''}
                                  </span>
                                  {(d.user_id === profile.id || isAdmin) && (
                                    <a
                                      href={waLink('', buildDriverBroadcastText(d.student_name, d.car_details, d.pickup_time, d.pickup_point, driverPax))}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-emerald-600 text-white font-bold text-[10px]"
                                      title="Broadcast pickup details to WhatsApp"
                                    >
                                      <Megaphone className="w-2.5 h-2.5" /> Broadcast
                                    </a>
                                  )}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>

                <div className="lg:col-span-7 space-y-2">
                  <div className="flex items-center justify-between">
                    <h4 className="font-extrabold text-slate-900 flex items-center gap-1.5"><UserCheck className="w-4 h-4 text-emerald-600" /><span>Members Needing Transport ({passengers.length})</span></h4>
                    {isCurrentUserDriver && <span className="text-[11px] text-emerald-700 font-bold">Driver Mode: Click &ldquo;Pick Up&rdquo; to claim passengers</span>}
                  </div>
                  <div className="border rounded-2xl overflow-hidden bg-white">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="py-2 px-3">Passenger</th>
                          <th className="py-2 px-3">Pickup Dorm</th>
                          <th className="py-2 px-3">Trip</th>
                          <th className="py-2 px-3 text-right">Driver / Pickup</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {passengers.length === 0 ? (
                          <tr><td colSpan={4} className="py-6 text-center text-slate-400">No members currently requesting transport.</td></tr>
                        ) : (
                          passengers.map((p) => {
                            const isPickedByMe = p.assigned_driver_name === profile.full_name;
                            const assignedDrv = p.assigned_driver_name
                              ? eventDrivers.find((d) => d.student_name === p.assigned_driver_name)
                              : undefined;
                            const myMeetNote =
                              pickupTime || pickupPoint
                                ? ` Pickup: ${formatPickupTime(pickupTime) || 'TBA'} at ${pickupPoint || p.dormitory || 'your dorm'}.`
                                : '';
                            return (
                              <tr key={p.id}>
                                <td className="py-2 px-3">
                                  <div className="font-bold text-slate-900">{p.student_name}</div>
                                  <div className="font-mono text-[10px] text-slate-500 flex items-center gap-1.5">
                                    <span>{p.phone_number}</span>
                                    {(isCurrentUserDriver || isAdmin) && p.phone_number && (
                                      <a
                                        href={waLink(
                                          p.phone_number,
                                          `Hi ${p.student_name}! I'm ${profile.full_name}, your carpool driver for ${event.event_name}.${myMeetNote}`
                                        )}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md bg-emerald-600 hover:bg-emerald-500 text-white font-sans font-bold text-[9px]"
                                        title="Open WhatsApp chat with passenger"
                                      >
                                        <MessageCircle className="w-2.5 h-2.5" /> WA
                                      </a>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2 px-3 font-semibold text-emerald-900">{p.dormitory || '-'}</td>
                                <td className="py-2 px-3"><span className="px-2 py-0.5 rounded-md bg-slate-100 text-slate-700 font-bold text-[10px]">{p.transport_type}</span></td>
                                <td className="py-2 px-3 text-right">
                                  {isAdmin ? (
                                    <select
                                      value={p.assigned_driver_name || ''}
                                      onChange={(e) => handleDriverClaimPassenger(p, e.target.value)}
                                      className="rounded-lg border px-2 py-1 font-bold text-[11px] bg-white"
                                    >
                                      <option value="">-- Unassigned --</option>
                                      {eventDrivers.map((d) => (<option key={d.id} value={d.student_name}>{d.student_name}</option>))}
                                    </select>
                                  ) : isCurrentUserDriver ? (
                                    isPickedByMe ? (
                                      <button
                                        type="button"
                                        onClick={() => handleDriverClaimPassenger(p, '')}
                                        className="px-2.5 py-1 rounded-lg bg-rose-50 hover:bg-rose-100 text-rose-700 font-bold cursor-pointer"
                                      >
                                        Picked Up ✓ (Release)
                                      </button>
                                    ) : p.assigned_driver_name ? (
                                      <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-700 font-bold text-[10px]">
                                        By {p.assigned_driver_name}
                                      </span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleDriverClaimPassenger(p, profile.full_name)}
                                        className="px-3 py-1 rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                                      >
                                        Pick Up
                                      </button>
                                    )
                                  ) : p.assigned_driver_name ? (
                                    <div className="inline-flex items-center gap-1 justify-end">
                                      <span className="px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 font-bold text-[10px]">
                                        ✓ {p.assigned_driver_name}
                                      </span>
                                      {assignedDrv?.phone_number && (
                                        <a
                                          href={waLink(assignedDrv.phone_number, `Hi ${assignedDrv.student_name}, regarding carpool for ${event.event_name}:`)}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          className="inline-flex items-center gap-0.5 px-2 py-0.5 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[10px]"
                                          title="WhatsApp Assigned Driver"
                                        >
                                          <MessageCircle className="w-2.5 h-2.5" /> WA
                                        </a>
                                      )}
                                    </div>
                                  ) : (
                                    <span className="text-amber-700 font-semibold text-[11px]">Waiting for driver</span>
                                  )}
                                  <div className="inline-flex items-center gap-1 ml-1.5 align-middle">
                                    <button
                                      type="button"
                                      onClick={() => setHistoryTarget({ table: 'event_rsvps', recordId: p.id, title: `${p.student_name} (Carpool)` })}
                                      className="p-1 rounded bg-slate-100 text-slate-700 hover:bg-slate-200 cursor-pointer"
                                      title="View History"
                                    >
                                      <History className="w-3 h-3" />
                                    </button>
                                    {(isAdmin || p.user_id === profile.id) && (
                                      <button
                                        type="button"
                                        onClick={async () => {
                                          await softDeleteRecord({
                                            actor: profile,
                                            category: 'Carpool',
                                            table: 'event_rsvps',
                                            recordId: p.id,
                                            recordTitle: `${p.student_name} (${event.event_name})`,
                                          });
                                          onRefresh('Removed carpool entry from web view (kept in Supabase).');
                                        }}
                                        className="p-1 rounded bg-rose-50 text-rose-700 hover:bg-rose-100 cursor-pointer"
                                        title="Delete from web (kept in Supabase)"
                                      >
                                        <Trash2 className="w-3 h-3" />
                                      </button>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {editingFee && (
        <div className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4">
          <div className="bg-white rounded-3xl max-w-md w-full overflow-hidden shadow-2xl border border-emerald-200">
            <div className="bg-emerald-800 text-white px-5 py-3.5 flex items-center justify-between">
              <h3 className="text-sm font-bold">Edit Fee Payment</h3>
              <button type="button" onClick={() => setEditingFee(null)} className="text-emerald-200 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveEditFee} className="p-5 space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Student Name *</label>
                  <input type="text" value={editFeeName} onChange={(e) => setEditFeeName(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-bold" required />
                </div>
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Matric No *</label>
                  <input type="text" value={editFeeMatric} onChange={(e) => setEditFeeMatric(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono" required />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Phone</label>
                  <input type="text" value={editFeePhone} onChange={(e) => setEditFeePhone(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-mono" />
                </div>
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Amount Paid (RM) *</label>
                  <input type="number" step="0.01" value={editFeeAmount} onChange={(e) => setEditFeeAmount(e.target.value)} className="w-full rounded-xl border px-3 py-2 font-bold" required />
                </div>
              </div>
              {isAdmin && (
                <div>
                  <label className="block font-bold text-emerald-900 mb-1">Verification Status</label>
                  <select value={editFeeStatus} onChange={(e) => setEditFeeStatus(e.target.value as 'Verified' | 'Pending' | 'Rejected')} className="w-full rounded-xl border bg-white px-3 py-2 font-bold">
                    <option value="Verified">Verified</option>
                    <option value="Pending">Pending</option>
                    <option value="Rejected">Rejected</option>
                  </select>
                </div>
              )}
              <div>
                <label className="block font-bold text-emerald-900 mb-1">Replace Receipt File (Optional)</label>
                <input type="file" accept="image/*,application/pdf" onChange={(e) => setEditFeeFile(e.target.files?.[0] || null)} className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:font-bold file:bg-emerald-600 file:text-white cursor-pointer" />
              </div>
              {editFeeError && <div className="p-2.5 rounded-xl bg-rose-50 text-rose-700 font-semibold">{editFeeError}</div>}
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setEditingFee(null)} className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer">Cancel</button>
                <button type="submit" disabled={savingEditFee} className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer">
                  {savingEditFee && <Loader2 className="w-4 h-4 animate-spin" />}
                  <span>Save Fee Changes</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {zoomReceiptFee && zoomReceiptFee.receipt_url && (
        <div
          className="fixed inset-0 z-[70] bg-slate-950/90 backdrop-blur-xs flex flex-col items-center justify-center p-4"
          onClick={() => setZoomReceiptFee(null)}
        >
          <div className="max-w-4xl w-full bg-white rounded-3xl overflow-hidden shadow-2xl grid grid-cols-1 md:grid-cols-12" onClick={(e) => e.stopPropagation()}>
            <div className="md:col-span-7 bg-slate-950 flex items-center justify-center p-4 max-h-[80vh]">
              <img
                src={zoomReceiptFee.receipt_url}
                alt={zoomReceiptFee.student_name}
                className="max-h-[72vh] w-auto max-w-full object-contain rounded-xl bg-white"
              />
            </div>
            <div className="md:col-span-5 p-5 flex flex-col justify-between gap-4 text-xs">
              <div className="space-y-3">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h4 className="text-sm font-extrabold text-slate-900">{zoomReceiptFee.student_name}</h4>
                    <p className="font-mono text-[11px] text-slate-500">{zoomReceiptFee.matric_no}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setZoomReceiptFee(null)}
                    className="w-8 h-8 rounded-full bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center cursor-pointer"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>

                <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-between">
                  <span className="font-bold text-slate-500">Submitted Amount</span>
                  <span className="text-sm font-extrabold text-emerald-700">RM {Number(zoomReceiptFee.amount_paid).toFixed(2)}</span>
                </div>

                {isAdmin && permissions.can_manage_claims_fees && zoomReceiptFee.status === 'Pending' && (
                  <div className="space-y-2.5 pt-1">
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Confirm Amount (RM)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={feeConfirmAmounts[zoomReceiptFee.id] ?? String(zoomReceiptFee.amount_paid)}
                        onChange={(e) =>
                          setFeeConfirmAmounts((prev) => ({ ...prev, [zoomReceiptFee.id]: e.target.value }))
                        }
                        className="w-full rounded-xl border border-slate-200 px-3 py-2 font-extrabold text-emerald-800"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] font-bold text-slate-500 mb-1">Reject Reason (Optional)</label>
                      <input
                        type="text"
                        value={rejectReasonByFee[zoomReceiptFee.id] ?? ''}
                        onChange={(e) =>
                          setRejectReasonByFee((prev) => ({ ...prev, [zoomReceiptFee.id]: e.target.value }))
                        }
                        placeholder="e.g. Blurry slip / wrong RM"
                        className="w-full rounded-xl border border-slate-200 px-3 py-2"
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="space-y-2 pt-3 border-t border-slate-100">
                {isAdmin && permissions.can_manage_claims_fees && zoomReceiptFee.status === 'Pending' && (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      disabled={reviewingFeeId === zoomReceiptFee.id}
                      onClick={async () => {
                        await handleVerifyOrRejectFee(zoomReceiptFee, 'Verified');
                        setZoomReceiptFee(null);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer disabled:opacity-60"
                    >
                      <CheckCircle2 className="w-4 h-4" />
                      <span>Verify Fee</span>
                    </button>
                    <button
                      type="button"
                      disabled={reviewingFeeId === zoomReceiptFee.id}
                      onClick={async () => {
                        await handleVerifyOrRejectFee(zoomReceiptFee, 'Rejected');
                        setZoomReceiptFee(null);
                      }}
                      className="flex-1 inline-flex items-center justify-center gap-1.5 py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 font-bold cursor-pointer disabled:opacity-60"
                    >
                      <XCircle className="w-4 h-4" />
                      <span>Reject</span>
                    </button>
                  </div>
                )}
                {zoomReceiptFee.phone_number && (
                  <a
                    href={waLink(
                      zoomReceiptFee.phone_number,
                      `Hi ${zoomReceiptFee.student_name}, regarding your RM ${Number(zoomReceiptFee.amount_paid).toFixed(2)} fee receipt for ${event.event_name}.`
                    )}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full inline-flex items-center justify-center gap-1.5 py-2 px-3 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold"
                  >
                    <MessageCircle className="w-3.5 h-3.5 text-emerald-700" />
                    <span>Message Member on WhatsApp</span>
                  </a>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      <RecordHistoryModal
        target={historyTarget}
        logs={logs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}