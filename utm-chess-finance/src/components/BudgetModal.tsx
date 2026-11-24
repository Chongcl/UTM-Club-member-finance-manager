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
import {
  ActivityConfig,
  ActivityFormat,
  FeeTier,
  PaymentUnlockTiming,
  PostPaymentUnlock,
  resolveActivityConfig,
} from '@/lib/activityConfig';
import { computeFieldChanges, recordEditHistory } from '@/lib/history';
import { softDeleteRecord } from '@/lib/history';
import { emitClubNotification } from '@/lib/notifications';
import type { MemberLookupHint } from '@/lib/memberLookup';
import RecordHistoryModal, { HistoryModalTarget } from './RecordHistoryModal';
import {
  X,
  Calendar,
  Loader2,
  CheckCircle2,
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
  Copy,
  Globe,
  MapPin,
  Video,
  Clock,
  Wallet,
  Link2,
  Plus,
} from 'lucide-react';

export interface EditableActivity {
  id?: string;
  event_name: string;
  category: string;
  event_date?: string;
  end_date?: string | null;
  event_time?: string;
  location?: string;
  registration_fee?: number;
  allocated_amount?: number;
  driver_allowance_per_trip?: number;
  driver_recruitment_open?: boolean;
  qr_code_token?: string;
  ticket_qr_mode?: TicketQrMode;
  pass_approval_rule?: PassApprovalRule;
  is_public_registration?: boolean;
  public_slug?: string | null;
  guest_fee?: number | null;
  guest_capacity?: number;
  activity_config?: ActivityConfig | null;
  description: string;
  status?: 'Active' | 'Closed';
}

function slugifyTitle(val: string): string {
  return val
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

interface BudgetModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (message: string) => void;
  initialData?: EditableActivity | null;
  departments?: string[];
  rsvps?: EventRsvp[];
  feePayments?: ActivityFeePayment[];
  profile?: UserProfile | null;
  logs?: ActivityLogEntry[];
  onOpenMemberProfile?: (hint: MemberLookupHint) => void;
}

const FORMAT_OPTIONS: {
  id: ActivityFormat;
  label: string;
  sub: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: 'physical', label: 'In-Person Event', sub: 'Venue, Carpool & QR', icon: MapPin },
  { id: 'online', label: 'Online Activity', sub: 'Zoom / Link Unlock', icon: Video },
  { id: 'self_paced', label: 'Self-Paced / Period', sub: 'Start → End Range', icon: Clock },
  { id: 'fee_collection', label: 'Fee / Membership', sub: 'Dues, Kit & Orders', icon: Wallet },
];

export default function BudgetModal({
  isOpen,
  onClose,
  onSuccess,
  initialData,
  departments = DEFAULT_DEPARTMENTS,
  rsvps = [],
  feePayments = [],
  profile = null,
  logs = [],
  onOpenMemberProfile,
}: BudgetModalProps) {
  const isEditing = Boolean(initialData?.id);
  const [openSection, setOpenSection] = useState<'none' | 'settings' | 'passes' | 'fees' | 'carpool'>('none');
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  const [activityFormat, setActivityFormat] = useState<ActivityFormat>('physical');
  const [eventName, setEventName] = useState('');
  const [category, setCategory] = useState<string>(departments[0] || 'Member');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [endDate, setEndDate] = useState('');
  const [eventTime, setEventTime] = useState('08:00 PM - 10:00 PM');
  const [location, setLocation] = useState('Student Activity Hall');
  const [registrationFee, setRegistrationFee] = useState('0');
  const [allocatedAmount, setAllocatedAmount] = useState('0');
  const [showFeeTiers, setShowFeeTiers] = useState(false);
  const [feeTiers, setFeeTiers] = useState<FeeTier[]>([]);
  const [allowCustomAmount, setAllowCustomAmount] = useState(false);

  const [accessLinkUrl, setAccessLinkUrl] = useState('');
  const [accessLinkLabel, setAccessLinkLabel] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [accessInstructions, setAccessInstructions] = useState('');
  const [unlockTiming, setUnlockTiming] = useState<PaymentUnlockTiming>('after_verification');
  const [registrationPrompt, setRegistrationPrompt] = useState('');
  const [enablePhysicalLink, setEnablePhysicalLink] = useState(false);

  const [driverAllowance, setDriverAllowance] = useState('5.00');
  const [driverRecruitmentOpen, setDriverRecruitmentOpen] = useState(true);
  const [useEntryPass, setUseEntryPass] = useState(false);
  const [passRule, setPassRule] = useState<PassApprovalRule>('auto_after_payment');
  const [qrToken, setQrToken] = useState('');
  const [status, setStatus] = useState<'Active' | 'Closed'>('Active');
  const [description, setDescription] = useState('');
  const [isPublicRegistration, setIsPublicRegistration] = useState(false);
  const [publicSlug, setPublicSlug] = useState('');
  const [guestFeeInput, setGuestFeeInput] = useState('');
  const [guestCapacityInput, setGuestCapacityInput] = useState('0');
  const [copiedPublicLink, setCopiedPublicLink] = useState(false);
  const [saving, setSaving] = useState(false);
  const [localPassOverrides, setLocalPassOverrides] = useState<Record<string, boolean>>({});
  const [feeFilter, setFeeFilter] = useState<'Pending' | 'Verified' | 'Rejected'>('Pending');

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
      const cfg = resolveActivityConfig(initialData);
      setActivityFormat(cfg.format);
      setEventName(initialData.event_name || '');
      setCategory(initialData.category || departments[0] || 'Member');
      setEventDate(initialData.event_date || '');
      setEndDate(cfg.end_date || '');
      setEventTime(initialData.event_time || '');
      setLocation(initialData.location || '');
      const feeVal = initialData.registration_fee ?? 0;
      setRegistrationFee(String(feeVal));
      setAllocatedAmount(String(initialData.allocated_amount ?? 0));
      setFeeTiers(cfg.fee_tiers);
      setShowFeeTiers(cfg.fee_tiers.length > 0 || cfg.allow_custom_amount);
      setAllowCustomAmount(cfg.allow_custom_amount);

      setAccessLinkUrl(cfg.access_link_url);
      setAccessLinkLabel(initialData.activity_config?.access_link_label || '');
      setAccessCode(cfg.access_code);
      setAccessInstructions(cfg.access_instructions);
      setUnlockTiming(cfg.unlock_timing);
      setRegistrationPrompt(cfg.registration_prompt);
      setEnablePhysicalLink(Boolean(cfg.access_link_url));

      setDriverAllowance(String(initialData.driver_allowance_per_trip ?? 5.0));
      setDriverRecruitmentOpen(
        initialData.driver_recruitment_open ?? cfg.format === 'physical'
      );
      const savedMode =
        initialData.ticket_qr_mode ||
        (Number(feeVal) > 0 && cfg.format === 'physical' ? 'entry_pass' : 'scan_attendance');
      setUseEntryPass(isEntryPassMode(savedMode));

      const savedRule =
        initialData.pass_approval_rule ||
        (savedMode === 'manual_only' ? 'manual_only' : 'auto_after_payment');
      setPassRule(savedRule);
      const hasPendingFees = feePayments.some(
        (f) => f.budget_id === initialData.id && f.status === 'Pending'
      );
      setFeeFilter(hasPendingFees ? 'Pending' : 'Verified');

      setQrToken(
        initialData.qr_code_token ||
          (initialData.id ? initialData.id.slice(0, 6).toUpperCase() : 'EV2026')
      );
      setStatus(initialData.status || 'Active');
      setDescription(initialData.description || '');
      setIsPublicRegistration(Boolean(initialData.is_public_registration));
      setPublicSlug(initialData.public_slug || '');
      setGuestFeeInput(
        initialData.guest_fee !== null && initialData.guest_fee !== undefined
          ? String(initialData.guest_fee)
          : ''
      );
      setGuestCapacityInput(String(initialData.guest_capacity ?? 0));
      setCopiedPublicLink(false);
    } else {
      const today = new Date().toISOString().split('T')[0];
      setActivityFormat('physical');
      setEventName('');
      setCategory(departments[0] || 'Member');
      setEventDate(today);
      setEndDate('');
      setEventTime('08:00 PM - 10:00 PM');
      setLocation('Student Activity Hall');
      setRegistrationFee('0');
      setAllocatedAmount('0');
      setFeeTiers([]);
      setShowFeeTiers(false);
      setAllowCustomAmount(false);
      setAccessLinkUrl('');
      setAccessLinkLabel('');
      setAccessCode('');
      setAccessInstructions('');
      setUnlockTiming('after_verification');
      setRegistrationPrompt('');
      setEnablePhysicalLink(false);
      setDriverAllowance('5.00');
      setDriverRecruitmentOpen(true);
      setUseEntryPass(false);
      setPassRule('auto_after_payment');
      setQrToken(Math.random().toString(36).substring(2, 8).toUpperCase());
      setStatus('Active');
      setDescription('');
      setIsPublicRegistration(false);
      setPublicSlug('');
      setGuestFeeInput('');
      setGuestCapacityInput('0');
      setCopiedPublicLink(false);
    }
  }, [initialData, isOpen, departments, feePayments]);

  if (!isOpen) return null;

  const handleSelectFormat = (nextFmt: ActivityFormat) => {
    setActivityFormat(nextFmt);
    if (!isEditing) {
      const today = new Date().toISOString().split('T')[0];
      if (nextFmt === 'physical') {
        if (!eventDate) setEventDate(today);
        if (!eventTime) setEventTime('08:00 PM - 10:00 PM');
        if (!location || location === 'Online / Google Meet' || location === 'Self-Paced / Remote' || location === 'Club Fee Portal') {
          setLocation('Student Activity Hall');
        }
        setDriverRecruitmentOpen(true);
      } else if (nextFmt === 'online') {
        if (!eventDate) setEventDate(today);
        if (!eventTime) setEventTime('08:30 PM - 10:00 PM');
        if (!location || location === 'Student Activity Hall') {
          setLocation('Zoom / Google Meet / Online');
        }
        setDriverRecruitmentOpen(false);
        setUseEntryPass(false);
      } else if (nextFmt === 'self_paced') {
        if (!eventDate) setEventDate(today);
        if (!endDate) {
          const nextMonth = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];
          setEndDate(nextMonth);
        }
        setEventTime('');
        setLocation('');
        setDriverRecruitmentOpen(false);
        setUseEntryPass(false);
      } else if (nextFmt === 'fee_collection') {
        setEventTime('');
        setLocation('');
        setDriverRecruitmentOpen(false);
        setUseEntryPass(false);
      }
    } else if (nextFmt !== 'physical') {
      setDriverRecruitmentOpen(false);
    }
  };

  const eventId = initialData?.id || '';
  const eventRsvps = rsvps.filter((r) => r.budget_id === eventId);
  const attendingRsvps = eventRsvps.filter((r) => r.attendance === 'Attending');
  const eventPayments = feePayments.filter((f) => f.budget_id === eventId);
  const passengers = attendingRsvps.filter((r) => r.transport_type !== 'None' && !r.is_driver);
  const unassignedPassengers = passengers.filter((p) => !p.assigned_driver_name);
  const eventDrivers = attendingRsvps.filter((r) => r.is_driver);
  const reqFeeNum = Math.max(0, parseFloat(registrationFee) || 0);
  const allowanceNum = Math.max(0, parseFloat(driverAllowance) || 0);
  const modeValue: TicketQrMode = !useEntryPass
    ? 'scan_attendance'
    : passRule === 'manual_only'
    ? 'manual_only'
    : 'entry_pass';

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

  const showVenueQrButton =
    activityFormat === 'physical' || useEntryPass || attendingRsvps.length > 0;
  const showCarpoolButton =
    activityFormat === 'physical' || passengers.length > 0 || eventDrivers.length > 0;

  const handleAddTier = () => {
    setFeeTiers((prev) => [
      ...prev,
      {
        id: `tier-${Date.now()}-${Math.random().toString(36).slice(2, 5)}`,
        name: prev.length === 0 ? 'Standard' : `Option ${prev.length + 1}`,
        amount: reqFeeNum || 10,
        description: '',
      },
    ]);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const allocatedNum = Math.max(0, parseFloat(allocatedAmount) || 0);
      const normalizedSlug = slugifyTitle(
        publicSlug.trim() || (isPublicRegistration ? eventName : '')
      );
      const guestFeeParsed =
        guestFeeInput.trim() === '' ? null : Math.max(0, parseFloat(guestFeeInput) || 0);
      const guestCapParsed = Math.max(0, parseInt(guestCapacityInput, 10) || 0);

      const cleanedTiers = feeTiers
        .filter((t) => t.name.trim())
        .map((t) => ({
          ...t,
          name: t.name.trim(),
          amount: Math.max(0, Number(t.amount || 0)),
          description: t.description?.trim() || undefined,
        }));

      const hasLink = Boolean(accessLinkUrl.trim());
      let unlockMode: PostPaymentUnlock = 'registration_only';
      if (activityFormat === 'physical') {
        if (useEntryPass && hasLink) unlockMode = 'both_link_and_qr';
        else if (useEntryPass) unlockMode = 'entry_pass_qr';
        else if (hasLink) unlockMode = 'access_link';
        else unlockMode = 'registration_only';
      } else if (activityFormat === 'online') {
        unlockMode = 'access_link';
      } else {
        unlockMode = hasLink ? 'access_link' : 'registration_only';
      }

      const effectiveBaseFee =
        reqFeeNum > 0
          ? reqFeeNum
          : cleanedTiers.length > 0
          ? Math.min(...cleanedTiers.map((t) => t.amount))
          : 0;

      const activityConfigPayload: ActivityConfig = {
        format: activityFormat,
        end_date: endDate.trim() || undefined,
        unlock_mode: unlockMode,
        unlock_timing: unlockTiming,
        access_link_url: accessLinkUrl.trim() || undefined,
        access_link_label: accessLinkLabel.trim() || undefined,
        access_code: accessCode.trim() || undefined,
        access_instructions: accessInstructions.trim() || undefined,
        fee_tiers: cleanedTiers.length > 0 ? cleanedTiers : undefined,
        allow_custom_amount: allowCustomAmount || undefined,
        registration_prompt: registrationPrompt.trim() || undefined,
        requires_rsvp: activityFormat !== 'fee_collection',
      };

      const safeDate = eventDate.trim() || new Date().toISOString().split('T')[0];
      const safeTime =
        activityFormat === 'self_paced' || activityFormat === 'fee_collection'
          ? ''
          : eventTime.trim();
      const safeLocation =
        activityFormat === 'self_paced'
          ? 'Self-Paced / Remote'
          : activityFormat === 'fee_collection'
          ? 'Online Fee Collection'
          : location.trim() || 'TBA';

      const basePayload = {
        event_name: eventName.trim(),
        category,
        event_date: eventDate.trim() || (activityFormat === 'fee_collection' ? '' : safeDate),
        event_time: safeTime,
        location: safeLocation,
        registration_fee: effectiveBaseFee,
        allocated_amount: allocatedNum,
        driver_allowance_per_trip: activityFormat === 'physical' ? allowanceNum : 0,
        driver_recruitment_open: activityFormat === 'physical' ? driverRecruitmentOpen : false,
        qr_code_token: qrToken,
        description: description.trim(),
        status,
      };
      const extendedPayload = {
        ...basePayload,
        ticket_qr_mode: modeValue,
        pass_approval_rule: passRule,
        is_public_registration: isPublicRegistration,
        public_slug: normalizedSlug || null,
        guest_fee: guestFeeParsed,
        guest_capacity: guestCapParsed,
      };
      const fullFlexiblePayload = {
        ...extendedPayload,
        end_date: endDate.trim() || null,
        activity_config: activityConfigPayload,
      };

      if (isEditing && eventId) {
        const { error: err1 } = await supabase
          .from('budgets')
          .update(fullFlexiblePayload)
          .eq('id', eventId);
        if (err1) {
          const { error: err2 } = await supabase
            .from('budgets')
            .update(extendedPayload)
            .eq('id', eventId);
          if (err2) {
            await supabase
              .from('budgets')
              .update({
                ...basePayload,
                ticket_qr_mode: modeValue,
                pass_approval_rule: passRule,
              })
              .eq('id', eventId);
          }
        }
        if (profile && initialData) {
          const changes = computeFieldChanges([
            { field: 'Activity Name', before: initialData.event_name, after: basePayload.event_name },
            { field: 'Department', before: initialData.category, after: basePayload.category },
            { field: 'Date', before: initialData.event_date || '', after: basePayload.event_date },
            { field: 'Time', before: initialData.event_time || '', after: basePayload.event_time },
            { field: 'Venue / Mode', before: initialData.location || '', after: basePayload.location },
            {
              field: 'Fee (RM)',
              before: Number(initialData.registration_fee ?? 0).toFixed(2),
              after: effectiveBaseFee.toFixed(2),
            },
            {
              field: 'Allocated Budget (RM)',
              before: Number(initialData.allocated_amount ?? 0).toFixed(2),
              after: allocatedNum.toFixed(2),
            },
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
        const { error: err1 } = await supabase
          .from('budgets')
          .insert({ ...fullFlexiblePayload, spent_amount: 0 });
        if (err1) {
          const { error: err2 } = await supabase
            .from('budgets')
            .insert({ ...extendedPayload, spent_amount: 0 });
          if (err2) {
            await supabase.from('budgets').insert({
              ...basePayload,
              ticket_qr_mode: modeValue,
              pass_approval_rule: passRule,
              spent_amount: 0,
            });
          }
        }
        void emitClubNotification({
          targetUserId: null,
          type: 'activity',
          title: `New ${FORMAT_OPTIONS.find((f) => f.id === activityFormat)?.label || 'Activity'}: ${basePayload.event_name}`,
          body: `${basePayload.event_date || 'Open Schedule'}${basePayload.event_time ? ` • ${basePayload.event_time}` : ''} @ ${basePayload.location}`,
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

  const handleToggleMemberPass = async (rsvp: EventRsvp) => {
    const nextVal = !isMemberEligibleForPass(rsvp);
    setLocalPassOverrides((prev) => ({ ...prev, [rsvp.id]: nextVal }));
    await supabase.from('event_rsvps').update({ pass_approved: nextVal }).eq('id', rsvp.id);
    onSuccess(`${nextVal ? 'Granted' : 'Locked'} pass for ${rsvp.student_name}.`);
  };

  const showAccessCard =
    activityFormat === 'online' ||
    activityFormat === 'self_paced' ||
    (activityFormat === 'fee_collection' && (Boolean(accessLinkUrl.trim()) || enablePhysicalLink)) ||
    (activityFormat === 'physical' && enablePhysicalLink);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-2.5 sm:p-4 overflow-y-auto">
      <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border border-slate-200 max-w-3xl w-full overflow-hidden my-4 sm:my-8">
        <div className="bg-slate-900 text-white px-4 sm:px-6 py-4 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2.5 min-w-0">
            <Calendar className="w-5 h-5 text-emerald-400 shrink-0" />
            <h2 className="text-base font-bold truncate">
              {isEditing ? `Edit Activity — ${eventName}` : 'New Activity / Fee Collection'}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSave} className="p-4 sm:p-6 max-h-[82vh] overflow-y-auto overflow-x-hidden space-y-4 text-xs">
          {/* Step 0: 4-Pill Format Selector */}
          <div>
            <label className="block font-extrabold text-[11px] uppercase tracking-wider text-slate-500 mb-2">
              Activity Format
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const IconComp = opt.icon;
                const active = activityFormat === opt.id;
                return (
                  <button
                    key={opt.id}
                    type="button"
                    onClick={() => handleSelectFormat(opt.id)}
                    className={`p-2.5 rounded-2xl border text-left transition cursor-pointer ${
                      active
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-sm'
                        : 'bg-slate-50 hover:bg-slate-100 text-slate-800 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-extrabold text-xs">
                      <IconComp className="w-3.5 h-3.5 shrink-0" />
                      <span className="truncate">{opt.label}</span>
                    </div>
                    <div
                      className={`text-[10px] mt-0.5 truncate ${
                        active ? 'text-emerald-100' : 'text-slate-500'
                      }`}
                    >
                      {opt.sub}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Core Activity Info */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3">
            <div className="sm:col-span-2">
              <label className="block font-bold mb-1">
                {activityFormat === 'fee_collection' ? 'Fee / Collection Title *' : 'Activity Name *'}
              </label>
              <input
                type="text"
                value={eventName}
                onChange={(e) => setEventName(e.target.value)}
                placeholder={
                  activityFormat === 'fee_collection'
                    ? 'e.g., Annual Club Membership 2026'
                    : activityFormat === 'self_paced'
                    ? 'e.g., 30-Day Training Challenge'
                    : 'Activity title'
                }
                className="w-full rounded-xl border px-3 py-2 text-sm font-bold"
                required
              />
            </div>
            <div>
              <label className="block font-bold mb-1">Department</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2 text-xs font-semibold"
              >
                {departments.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block font-bold mb-1">Status</label>
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value as 'Active' | 'Closed')}
                className="w-full rounded-xl border bg-white px-3 py-2 text-sm font-bold"
              >
                <option value="Active">Active / Open</option>
                <option value="Closed">Closed / Past</option>
              </select>
            </div>
          </div>

          {/* Format-Adapted Date / Time / Venue / Fee Strip */}
          <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
            {activityFormat === 'physical' && (
              <>
                <div>
                  <label className="block font-bold mb-1">Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Time *</label>
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Venue *</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
              </>
            )}

            {activityFormat === 'online' && (
              <>
                <div>
                  <label className="block font-bold mb-1">Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Time *</label>
                  <input
                    type="text"
                    value={eventTime}
                    onChange={(e) => setEventTime(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">Platform Label *</label>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Zoom / Google Meet / Lichess"
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
              </>
            )}

            {activityFormat === 'self_paced' && (
              <>
                <div className="sm:col-span-2">
                  <label className="block font-bold mb-1">Start Date *</label>
                  <input
                    type="date"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
                <div>
                  <label className="block font-bold mb-1">End Date *</label>
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="w-full rounded-xl border px-3 py-2"
                    required
                  />
                </div>
              </>
            )}

            {activityFormat === 'fee_collection' && (
              <div className="sm:col-span-3">
                <label className="block font-bold mb-1">
                  Payment Deadline <span className="text-slate-400 font-normal">(Optional)</span>
                </label>
                <input
                  type="date"
                  value={eventDate}
                  onChange={(e) => setEventDate(e.target.value)}
                  className="w-full rounded-xl border px-3 py-2"
                />
              </div>
            )}

            {/* Inline Fee (RM) + Quick Tiers Toggle */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="font-bold">Fee (RM)</label>
                <button
                  type="button"
                  onClick={() => setShowFeeTiers((v) => !v)}
                  className="text-[10px] font-extrabold text-emerald-700 hover:underline cursor-pointer"
                >
                  {showFeeTiers ? 'Hide Tiers' : '+ Fee Tiers'}
                </button>
              </div>
              <input
                type="number"
                step="0.01"
                min="0"
                value={registrationFee}
                onChange={(e) => setRegistrationFee(e.target.value)}
                className="w-full rounded-xl border bg-white px-3 py-2 font-bold"
              />
            </div>
          </div>

          {/* Optional Event Budget Cap (RM) */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-2xl bg-emerald-50/60 border border-emerald-200 items-center">
            <div>
              <label className="block font-extrabold text-emerald-950">
                Allocated Budget (RM){' '}
                <span className="text-slate-500 font-semibold">(Optional Cap)</span>
              </label>
              <p className="text-[11px] text-emerald-900/75 mt-0.5">
                Set a spending cap to track remaining budget, 80% alerts &amp; live claim impact. Leave 0 if uncapped.
              </p>
            </div>
            <div className="relative">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-extrabold text-emerald-700">
                RM
              </span>
              <input
                type="number"
                step="0.01"
                min="0"
                value={allocatedAmount}
                onChange={(e) => setAllocatedAmount(e.target.value)}
                placeholder="0.00"
                className="w-full rounded-xl border border-emerald-300 bg-white pl-10 pr-3 py-2 font-mono font-extrabold text-slate-900 focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
              />
            </div>
          </div>

          {/* Collapsible Fee Tiers & Custom Amount */}
          {showFeeTiers && (
            <div className="p-3.5 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <div className="font-extrabold text-slate-800">Optional Selectable Fee Tiers</div>
                  <p className="text-[10px] text-slate-500">
                    Let members &amp; guests choose from tiers (e.g., Standard vs With Jersey).
                  </p>
                </div>
                <div className="flex items-center gap-3">
                  <label className="inline-flex items-center gap-1.5 font-bold text-slate-700 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={allowCustomAmount}
                      onChange={(e) => setAllowCustomAmount(e.target.checked)}
                    />
                    <span>Allow custom RM amount</span>
                  </label>
                  <button
                    type="button"
                    onClick={handleAddTier}
                    className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald-600 text-white font-bold text-[11px] cursor-pointer"
                  >
                    <Plus className="w-3 h-3" />
                    <span>Add Tier</span>
                  </button>
                </div>
              </div>

              {feeTiers.length > 0 && (
                <div className="space-y-2">
                  {feeTiers.map((tier, idx) => (
                    <div
                      key={tier.id}
                      className="grid grid-cols-1 sm:grid-cols-12 gap-2 items-center bg-white p-2 rounded-xl border border-slate-200"
                    >
                      <input
                        type="text"
                        value={tier.name}
                        onChange={(e) =>
                          setFeeTiers((prev) =>
                            prev.map((t, i) => (i === idx ? { ...t, name: e.target.value } : t))
                          )
                        }
                        placeholder="Tier Name"
                        className="sm:col-span-4 rounded-lg border px-2.5 py-1.5 font-bold"
                      />
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={tier.amount}
                        onChange={(e) =>
                          setFeeTiers((prev) =>
                            prev.map((t, i) =>
                              i === idx ? { ...t, amount: Math.max(0, parseFloat(e.target.value) || 0) } : t
                            )
                          )
                        }
                        placeholder="RM"
                        className="sm:col-span-2 rounded-lg border px-2.5 py-1.5 font-bold"
                      />
                      <input
                        type="text"
                        value={tier.description || ''}
                        onChange={(e) =>
                          setFeeTiers((prev) =>
                            prev.map((t, i) =>
                              i === idx ? { ...t, description: e.target.value } : t
                            )
                          )
                        }
                        placeholder="Short note (optional)"
                        className="sm:col-span-5 rounded-lg border px-2.5 py-1.5"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          setFeeTiers((prev) => prev.filter((_, i) => i !== idx))
                        }
                        className="sm:col-span-1 p-1.5 text-rose-500 hover:bg-rose-50 rounded-lg cursor-pointer flex justify-center"
                        title="Remove tier"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Contextual Post-Payment / Registration Access Link */}
          {showAccessCard && (
            <div className="p-4 rounded-2xl bg-sky-50/70 border border-sky-200 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="font-extrabold text-sky-950 flex items-center gap-1.5">
                  <Link2 className="w-4 h-4 text-sky-600" />
                  <span>Post-Payment / Registration Access Link</span>
                </div>
                {activityFormat === 'physical' && (
                  <button
                    type="button"
                    onClick={() => setEnablePhysicalLink(false)}
                    className="text-[10px] font-bold text-slate-500 hover:text-rose-600 cursor-pointer"
                  >
                    Hide
                  </button>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Access Link URL (Zoom / Form / Lichess / Group)
                  </label>
                  <input
                    type="url"
                    value={accessLinkUrl}
                    onChange={(e) => setAccessLinkUrl(e.target.value)}
                    placeholder="https://meet.google.com/..."
                    className="w-full rounded-xl border bg-white px-3 py-1.5 font-mono text-[11px]"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">CTA Button Label</label>
                  <input
                    type="text"
                    value={accessLinkLabel}
                    onChange={(e) => setAccessLinkLabel(e.target.value)}
                    placeholder={
                      activityFormat === 'online'
                        ? 'Join Online Event'
                        : 'Open Registration Link'
                    }
                    className="w-full rounded-xl border bg-white px-3 py-1.5 font-semibold"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Access Code / PIN <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="e.g., UTMCHESS26"
                    className="w-full rounded-xl border bg-white px-3 py-1.5 font-mono"
                  />
                </div>
                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Short Instructions <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={accessInstructions}
                    onChange={(e) => setAccessInstructions(e.target.value)}
                    placeholder="Enter link 10 mins before start"
                    className="w-full rounded-xl border bg-white px-3 py-1.5"
                  />
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-4 pt-1 text-[11px]">
                <span className="font-bold text-slate-700">Unlock Timing:</span>
                <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    checked={unlockTiming === 'after_verification'}
                    onChange={() => setUnlockTiming('after_verification')}
                  />
                  <span>After Treasurer Verifies Receipt</span>
                </label>
                <label className="inline-flex items-center gap-1.5 font-semibold cursor-pointer">
                  <input
                    type="radio"
                    checked={unlockTiming === 'immediate_on_submit'}
                    onChange={() => setUnlockTiming('immediate_on_submit')}
                  />
                  <span>Immediately After Uploading Receipt</span>
                </label>
              </div>
            </div>
          )}

          <div>
            <label className="block font-bold mb-1">Description *</label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-xl border px-3 py-2"
              required
            />
          </div>

          {/* Compact Action Buttons Bar */}
          <div className="pt-2 border-t border-slate-200">
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => setOpenSection(openSection === 'settings' ? 'none' : 'settings')}
                className={`inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                  openSection === 'settings'
                    ? 'bg-slate-900 text-white border-slate-900'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                }`}
              >
                <Settings className="w-4 h-4 text-emerald-500" />
                <span>More Options &amp; Guest Portal</span>
              </button>

              {isEditing && (
                <>
                  {showVenueQrButton && (
                    <button
                      type="button"
                      onClick={() => setOpenSection(openSection === 'passes' ? 'none' : 'passes')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                        openSection === 'passes'
                          ? 'bg-slate-950 text-white border-slate-950'
                          : 'bg-slate-950/90 hover:bg-slate-900 text-white border-slate-800'
                      }`}
                    >
                      <QrCode className="w-4 h-4" />
                      <span>QR &amp; Grant Pass ({attendingRsvps.length})</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => setOpenSection(openSection === 'fees' ? 'none' : 'fees')}
                    className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                      openSection === 'fees'
                        ? 'bg-emerald-600 text-white border-emerald-600'
                        : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    <span>Fee Payments ({eventPayments.length})</span>
                  </button>

                  {showCarpoolButton && (
                    <button
                      type="button"
                      onClick={() => setOpenSection(openSection === 'carpool' ? 'none' : 'carpool')}
                      className={`inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl font-bold transition cursor-pointer border ${
                        openSection === 'carpool'
                          ? 'bg-emerald-600 text-white border-emerald-600'
                          : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200'
                      }`}
                    >
                      <Users className="w-4 h-4" />
                      <span>
                        Carpool ({passengers.length}P / {eventDrivers.length}D)
                      </span>
                    </button>
                  )}
                </>
              )}
            </div>

            {/* 1. MORE OPTIONS & SETTINGS DRAWER */}
            {openSection === 'settings' && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-4">
                {activityFormat === 'physical' && (
                  <>
                    <div>
                      <label className="block font-bold text-slate-800 mb-2">Attendance Type</label>
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                        <button
                          type="button"
                          onClick={() => setUseEntryPass(false)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            !useEntryPass
                              ? 'bg-slate-950 text-white border-slate-950'
                              : 'bg-white text-slate-800 border-slate-200'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <QrCode className="w-4 h-4" />
                            <span>Scan Attendance Only</span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              !useEntryPass ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            Members scan the event QR to record attendance automatically.
                          </p>
                        </button>

                        <button
                          type="button"
                          onClick={() => setUseEntryPass(true)}
                          className={`p-3 rounded-xl border text-left transition cursor-pointer ${
                            useEntryPass
                              ? 'bg-slate-950 text-white border-slate-950'
                              : 'bg-white text-slate-800 border-slate-200'
                          }`}
                        >
                          <div className="font-bold flex items-center gap-1.5">
                            <Ticket className="w-4 h-4" />
                            <span>Entry Pass</span>
                          </div>
                          <p
                            className={`text-[11px] mt-0.5 ${
                              useEntryPass ? 'text-slate-300' : 'text-slate-500'
                            }`}
                          >
                            Members receive a personal Entry Pass QR code.
                          </p>
                        </button>
                      </div>
                    </div>

                    {useEntryPass && (
                      <div className="p-3.5 rounded-xl bg-white border border-slate-200 space-y-2">
                        <label className="block font-bold text-slate-800">
                          How do members receive their Entry Pass QR?
                        </label>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <label
                            className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                              passRule === 'auto_after_payment'
                                ? 'border-emerald-600 bg-emerald-50/60 font-bold'
                                : 'border-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              checked={passRule === 'auto_after_payment'}
                              onChange={() => setPassRule('auto_after_payment')}
                            />
                            <span>Auto-grant pass after fee payment</span>
                          </label>
                          <label
                            className={`flex items-center gap-2 p-2.5 rounded-lg border cursor-pointer ${
                              passRule === 'manual_only'
                                ? 'border-emerald-600 bg-emerald-50/60 font-bold'
                                : 'border-slate-200'
                            }`}
                          >
                            <input
                              type="radio"
                              checked={passRule === 'manual_only'}
                              onChange={() => setPassRule('manual_only')}
                            />
                            <span>Manual grant by Admin only</span>
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Carpool Driver RM / Trip
                        </label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          value={driverAllowance}
                          onChange={(e) => setDriverAllowance(e.target.value)}
                          className="w-full rounded-xl border bg-white px-3 py-2 font-bold"
                        />
                      </div>
                      <div className="flex items-end gap-4 pb-2">
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={driverRecruitmentOpen}
                            onChange={(e) => setDriverRecruitmentOpen(e.target.checked)}
                          />
                          <span>Enable Carpool</span>
                        </label>
                        <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={enablePhysicalLink}
                            onChange={(e) => setEnablePhysicalLink(e.target.checked)}
                          />
                          <span>Attach Link</span>
                        </label>
                      </div>
                    </div>
                  </>
                )}

                {activityFormat === 'fee_collection' && !showAccessCard && (
                  <label className="flex items-center gap-2 font-bold text-slate-800 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={enablePhysicalLink}
                      onChange={(e) => setEnablePhysicalLink(e.target.checked)}
                    />
                    <span>Attach Optional Post-Payment Link (e.g., Confirmation Group / Form)</span>
                  </label>
                )}

                <div>
                  <label className="block font-bold text-slate-700 mb-1">
                    Extra Info Prompt During Payment{' '}
                    <span className="text-slate-400 font-normal">(Optional)</span>
                  </label>
                  <input
                    type="text"
                    value={registrationPrompt}
                    onChange={(e) => setRegistrationPrompt(e.target.value)}
                    placeholder="e.g., Lichess Username or Shirt Size (S/M/L/XL)"
                    className="w-full rounded-xl border bg-white px-3 py-2"
                  />
                </div>

                {/* Public / Guest Registration Settings */}
                <div className="p-3.5 rounded-xl bg-white border border-emerald-200 space-y-3">
                  <label className="flex items-center justify-between gap-2 font-bold text-slate-800 cursor-pointer">
                    <span className="flex items-center gap-1.5">
                      <Globe className="w-4 h-4 text-emerald-600" />
                      <span>Open for Public / Guest Registration</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={isPublicRegistration}
                      onChange={(e) => {
                        const checked = e.target.checked;
                        setIsPublicRegistration(checked);
                        if (checked && !publicSlug.trim()) {
                          const generated =
                            slugifyTitle(eventName) ||
                            `event-${Math.random().toString(36).slice(2, 6)}`;
                          setPublicSlug(generated);
                        }
                      }}
                    />
                  </label>

                  {isPublicRegistration && (
                    <div className="space-y-2.5 pt-2 border-t border-slate-100">
                      <div>
                        <label className="block font-bold text-slate-700 mb-1">
                          Public Link Slug (/e/...)
                        </label>
                        <div className="flex gap-2">
                          <div className="flex-1 flex items-center rounded-xl border bg-slate-50 px-2.5 py-1.5 font-mono text-[11px]">
                            <span className="text-slate-400 mr-0.5">/e/</span>
                            <input
                              type="text"
                              value={publicSlug}
                              onChange={(e) => setPublicSlug(e.target.value)}
                              onBlur={() => setPublicSlug((s) => slugifyTitle(s))}
                              placeholder="chess-open-2026"
                              className="w-full bg-transparent font-bold text-slate-900 focus:outline-none"
                            />
                          </div>
                          <button
                            type="button"
                            onClick={async () => {
                              const clean =
                                slugifyTitle(publicSlug) ||
                                slugifyTitle(eventName) ||
                                'event';
                              const origin =
                                typeof window !== 'undefined' ? window.location.origin : '';
                              await navigator.clipboard.writeText(`${origin}/e/${clean}`);
                              setCopiedPublicLink(true);
                              setTimeout(() => setCopiedPublicLink(false), 2000);
                            }}
                            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-[11px] shrink-0 cursor-pointer"
                          >
                            <Copy className="w-3.5 h-3.5" />
                            <span>{copiedPublicLink ? 'Copied!' : 'Copy Public Link'}</span>
                          </button>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Guest Fee (RM, Optional)
                          </label>
                          <input
                            type="number"
                            step="0.01"
                            min="0"
                            value={guestFeeInput}
                            onChange={(e) => setGuestFeeInput(e.target.value)}
                            placeholder={`Default: RM ${reqFeeNum.toFixed(2)}`}
                            className="w-full rounded-xl border bg-white px-3 py-1.5 font-bold"
                          />
                        </div>
                        <div>
                          <label className="block font-bold text-slate-700 mb-1">
                            Guest Capacity (0 = Unlimited)
                          </label>
                          <input
                            type="number"
                            min="0"
                            value={guestCapacityInput}
                            onChange={(e) => setGuestCapacityInput(e.target.value)}
                            className="w-full rounded-xl border bg-white px-3 py-1.5 font-bold"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 2. QR & GRANT PASS PANEL */}
            {openSection === 'passes' && isEditing && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 grid grid-cols-1 md:grid-cols-12 gap-4">
                <div className="md:col-span-4 bg-white border rounded-2xl p-4 flex flex-col items-center text-center space-y-2">
                  <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-full bg-emerald-600 text-white">
                    Venue Attendance QR
                  </span>
                  <img src={venueQrUrl} alt="Venue QR" className="w-36 h-36 object-contain" />
                  <button
                    type="button"
                    onClick={async () => {
                      const tok = Math.random().toString(36).substring(2, 10).toUpperCase();
                      setQrToken(tok);
                      await supabase.from('budgets').update({ qr_code_token: tok }).eq('id', eventId);
                      onSuccess('Regenerated QR!');
                    }}
                    className="w-full py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold cursor-pointer"
                  >
                    <RefreshCw className="w-3 h-3 inline mr-1" />
                    Reset QR
                  </button>
                </div>
                <div className="md:col-span-8 space-y-2">
                  <div className="font-bold text-slate-800">
                    Attending Members ({attendingRsvps.length})
                  </div>
                  <div className="border bg-white rounded-xl overflow-hidden max-h-[220px] overflow-y-auto">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="py-2 px-3">Member</th>
                          <th className="py-2 px-3">Fee</th>
                          <th className="py-2 px-3">Status</th>
                          <th className="py-2 px-3 text-right">Pass</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {attendingRsvps.map((r) => {
                          const paid = eventPayments.find(
                            (f) => f.user_id === r.user_id && f.status === 'Verified'
                          );
                          const hasPass = isMemberEligibleForPass(r);
                          return (
                            <tr key={r.id}>
                              <td className="py-2 px-3 font-bold">
                                {onOpenMemberProfile ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenMemberProfile({
                                        userId: r.user_id,
                                        matricNo: r.matric_no,
                                        name: r.student_name,
                                      })
                                    }
                                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer text-left"
                                  >
                                    {r.student_name}
                                  </button>
                                ) : (
                                  r.student_name
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {reqFeeNum <= 0 ? (
                                  '-'
                                ) : paid ? (
                                  <span className="text-emerald-700 font-bold">Paid ✓</span>
                                ) : (
                                  'Unpaid'
                                )}
                              </td>
                              <td className="py-2 px-3">
                                {r.qr_checked_in ? (
                                  <span className="text-emerald-700 font-bold">
                                    <ShieldCheck className="w-3.5 h-3.5 inline mr-0.5" />
                                    Attended
                                  </span>
                                ) : hasPass ? (
                                  <span className="text-emerald-700 font-bold">✓ Active</span>
                                ) : (
                                  <span className="text-slate-400">Locked</span>
                                )}
                              </td>
                              <td className="py-2 px-3 text-right">
                                <button
                                  type="button"
                                  onClick={() => handleToggleMemberPass(r)}
                                  className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                                    hasPass
                                      ? 'bg-rose-50 text-rose-700'
                                      : 'bg-emerald-600 text-white'
                                  }`}
                                >
                                  {hasPass ? 'Lock' : 'Grant Pass'}
                                </button>
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

            {/* 3. FEE PAYMENTS PANEL */}
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
                            feeFilter === st
                              ? 'bg-emerald-600 text-white'
                              : 'text-slate-600 hover:bg-slate-100'
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
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="py-2 px-3">Student</th>
                        <th className="py-2 px-3">Amount</th>
                        <th className="py-2 px-3">Status</th>
                        <th className="py-2 px-3 text-right">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {eventPayments.filter((p) => p.status === feeFilter).length === 0 ? (
                        <tr>
                          <td colSpan={4} className="py-5 text-center text-slate-400">
                            No {feeFilter.toLowerCase()} fees.
                          </td>
                        </tr>
                      ) : (
                        eventPayments
                          .filter((p) => p.status === feeFilter)
                          .map((p) => (
                            <tr key={p.id}>
                              <td className="py-2 px-3 font-bold">
                                {onOpenMemberProfile ? (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      onOpenMemberProfile({
                                        userId: p.user_id,
                                        matricNo: p.matric_no,
                                        name: p.student_name,
                                      })
                                    }
                                    className="font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer text-left"
                                  >
                                    {p.student_name}
                                  </button>
                                ) : (
                                  p.student_name
                                )}
                                {(p.selected_tier || p.registration_note) && (
                                  <div className="text-[10px] text-slate-500 font-normal">
                                    {p.selected_tier ? `${p.selected_tier}` : ''}
                                    {p.selected_tier && p.registration_note ? ' • ' : ''}
                                    {p.registration_note || ''}
                                  </div>
                                )}
                              </td>
                              <td className="py-2 px-3 font-bold text-emerald-700">
                                RM {Number(p.amount_paid).toFixed(2)}
                              </td>
                              <td className="py-2 px-3">{p.status}</td>
                              <td className="py-2 px-3 text-right space-x-1">
                                {p.receipt_url && (
                                  <a
                                    href={p.receipt_url}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="px-2 py-1 rounded bg-slate-100"
                                  >
                                    <ExternalLink className="w-3 h-3 inline" />
                                  </a>
                                )}
                                {p.status !== 'Verified' && (
                                  <button
                                    type="button"
                                    onClick={async () => {
                                      await supabase
                                        .from('activity_fee_payments')
                                        .update({ status: 'Verified' })
                                        .eq('id', p.id);
                                      if (passRule === 'auto_after_payment' && p.user_id) {
                                        await supabase
                                          .from('event_rsvps')
                                          .update({ pass_approved: true })
                                          .eq('budget_id', eventId)
                                          .eq('user_id', p.user_id);
                                      }
                                      if (profile) {
                                        void recordEditHistory({
                                          actor: profile,
                                          category: 'Fees',
                                          table: 'activity_fee_payments',
                                          recordId: p.id,
                                          recordTitle: `${p.student_name} fee`,
                                          changes: computeFieldChanges([
                                            { field: 'Status', before: p.status, after: 'Verified' },
                                          ]),
                                        });
                                      }
                                      if (p.user_id) {
                                        void emitClubNotification({
                                          targetUserId: p.user_id,
                                          type: 'fee',
                                          title: `Fee Payment Verified — ${eventName || 'Activity'}`,
                                          body: `RM ${Number(p.amount_paid).toFixed(2)} receipt verified.`,
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
                                      await supabase
                                        .from('activity_fee_payments')
                                        .update({ status: 'Rejected' })
                                        .eq('id', p.id);
                                      if (profile) {
                                        void recordEditHistory({
                                          actor: profile,
                                          category: 'Fees',
                                          table: 'activity_fee_payments',
                                          recordId: p.id,
                                          recordTitle: `${p.student_name} fee`,
                                          changes: computeFieldChanges([
                                            { field: 'Status', before: p.status, after: 'Rejected' },
                                          ]),
                                        });
                                      }
                                      if (p.user_id) {
                                        void emitClubNotification({
                                          targetUserId: p.user_id,
                                          type: 'fee',
                                          title: `Fee Payment Rejected — ${eventName || 'Activity'}`,
                                          body: `Your RM ${Number(p.amount_paid).toFixed(2)} receipt was rejected.`,
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
                                  onClick={() =>
                                    setHistoryTarget({
                                      table: 'activity_fee_payments',
                                      recordId: p.id,
                                      title: `${p.student_name} Fee`,
                                    })
                                  }
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

            {/* 4. CARPOOL PANEL */}
            {openSection === 'carpool' && isEditing && (
              <div className="mt-3 p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <div className="flex justify-between items-center">
                  <span className="font-bold">
                    Passengers: {passengers.length} • Drivers: {eventDrivers.length}
                  </span>
                  {eventDrivers.length > 0 && unassignedPassengers.length > 0 && (
                    <button
                      type="button"
                      onClick={async () => {
                        const tracker = eventDrivers.map((d) => ({
                          name: d.student_name,
                          max: Number(d.seats_available) || 4,
                          used: passengers.filter((p) => p.assigned_driver_name === d.student_name)
                            .length,
                        }));
                        for (const pax of unassignedPassengers) {
                          const drv = tracker.find((t) => t.used < t.max);
                          if (!drv) break;
                          await supabase
                            .from('event_rsvps')
                            .update({ assigned_driver_name: drv.name })
                            .eq('id', pax.id);
                          drv.used += 1;
                        }
                        onSuccess('Auto-assigned passengers!');
                      }}
                      className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                    >
                      <Sparkles className="w-3 h-3 inline mr-1" />
                      Auto-Assign
                    </button>
                  )}
                </div>
                <div className="border bg-white rounded-xl overflow-hidden max-h-[200px] overflow-y-auto">
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 border-b">
                        <th className="py-2 px-3">Passenger</th>
                        <th className="py-2 px-3">Dorm</th>
                        <th className="py-2 px-3">Trip</th>
                        <th className="py-2 px-3">Driver</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {passengers.map((p) => (
                        <tr key={p.id}>
                          <td className="py-2 px-3 font-bold">
                            {onOpenMemberProfile ? (
                              <button
                                type="button"
                                onClick={() =>
                                  onOpenMemberProfile({
                                    userId: p.user_id,
                                    matricNo: p.matric_no,
                                    name: p.student_name,
                                  })
                                }
                                className="font-bold text-slate-900 hover:text-emerald-700 hover:underline cursor-pointer text-left"
                              >
                                {p.student_name}
                              </button>
                            ) : (
                              p.student_name
                            )}
                          </td>
                          <td className="py-2 px-3">{p.dormitory || '-'}</td>
                          <td className="py-2 px-3">{p.transport_type}</td>
                          <td className="py-2 px-3">
                            <select
                              value={p.assigned_driver_name || ''}
                              onChange={async (e) => {
                                const nextDriver = e.target.value;
                                await supabase
                                  .from('event_rsvps')
                                  .update({ assigned_driver_name: nextDriver })
                                  .eq('id', p.id);
                                if (nextDriver && p.user_id) {
                                  const drv = eventDrivers.find(
                                    (d) => d.student_name === nextDriver
                                  );
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
                              }}
                              className="rounded border px-2 py-1 font-bold"
                            >
                              <option value="">-- Unassigned --</option>
                              {eventDrivers.map((d) => (
                                <option key={d.id} value={d.student_name}>
                                  {d.student_name}
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

          <div className="flex justify-end gap-2 pt-3 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-xl font-semibold text-slate-600 cursor-pointer"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 rounded-xl font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
            >
              {saving ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <CheckCircle2 className="w-4 h-4" />
              )}
              <span>{isEditing ? 'Save Changes' : 'Publish'}</span>
            </button>
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
