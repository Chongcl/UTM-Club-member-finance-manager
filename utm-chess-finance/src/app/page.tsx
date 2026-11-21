'use client';

import React, { useEffect, useState, useCallback } from 'react';
import {
  supabase,
  isSupabaseConfigured,
  UserProfile,
  Budget,
  EventRsvp,
  ActivityFeePayment,
  Claim,
  EquipmentItem,
  EquipmentLoan,
  Announcement,
  Poll,
  PollVote,
  AdminPermissions,
  DEFAULT_ADMIN_PERMISSIONS,
  FULL_OWNER_PERMISSIONS,
  PERMISSION_LABELS,
  DEFAULT_DEPARTMENTS,
  TRANSPORT_OPTIONS,
  MAX_FILE_SIZE_BYTES,
  isEntryPassMode,
  exportMultiSheetExcel,
  ActivityLogEntry,
  DEFAULT_CLAIM_APPROVAL_THRESHOLD,
  logActivity,
} from '@/lib/supabase';
import Navbar, { NavTab } from '@/components/Navbar';
import CinematicHub from '@/components/CinematicHub';
import EquipmentSection from '@/components/EquipmentSection';
import ProfileSection from '@/components/ProfileSection';
import ClaimFormModal from '@/components/ClaimFormModal';
import AuditReviewModal from '@/components/AuditReviewModal';
import BudgetModal, { EditableActivity } from '@/components/BudgetModal';
import EventOperationsModal from '@/components/EventOperationsModal';
import QrScannerModal from '@/components/QrScannerModal';
import LedgerSection, { LedgerEntryItem } from '@/components/LedgerSection';
import ActivityLogSection from '@/components/ActivityLogSection';
import RecordHistoryModal, { HistoryModalTarget } from '@/components/RecordHistoryModal';
import {
  filterActiveRecords,
  softDeleteRecord,
  computeFieldChanges,
  recordEditHistory,
} from '@/lib/history';
import { normalizeEquipmentItem, normalizeEquipmentLoan } from '@/lib/equipment';
import {
  Calendar,
  MapPin,
  Clock,
  Receipt,
  CheckCircle2,
  PlusCircle,
  Download,
  Eye,
  Loader2,
  Layers,
  Car,
  Edit3,
  Trash2,
  CreditCard,
  QrCode,
  Crown,
  Shield,
  X,
  Ticket,
  Palette,
  AlertTriangle,
  FileText,
  FileSpreadsheet,
  ExternalLink,
  History,
} from 'lucide-react';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

const NO_PERMISSIONS: AdminPermissions = {
  can_manage_activities: false,
  can_manage_posters_polls: false,
  can_manage_equipment: false,
  can_manage_claims_fees: false,
  can_manage_transport: false,
  can_manage_finance: false,
  can_manage_members: false,
};

const BG_PRESETS = [
  {
    id: 'emerald-aurora',
    name: '1. Aurora Borealis (Moving Silk)',
    desc: 'Flowing emerald, teal & sky atmospheric waves',
    swatch: 'linear-gradient(135deg, #10b981 0%, #06b6d4 55%, #3b82f6 100%)',
  },
  {
    id: 'frosted-glass',
    name: '2. Frosted Glass Prism (Moving Orbs)',
    desc: 'Translucent floating glass spheres over soft mint & sky',
    swatch: 'linear-gradient(135deg, #34d399 0%, #38bdf8 50%, #94a3b8 100%)',
  },
  {
    id: 'galaxy-nebula',
    name: '3. Midnight Galaxy (Moving Nebula)',
    desc: 'Deep space obsidian with drifting starlight & teal nebula',
    swatch: 'linear-gradient(135deg, #090d16 0%, #1e293b 50%, #0d9488 100%)',
  },
  {
    id: 'nordic-mist',
    name: '4. Nordic Mist (Minimalist Glass)',
    desc: 'Clean alabaster, soft sage & calm architectural glass',
    swatch: 'linear-gradient(135deg, #f8fafc 0%, #d1fae5 55%, #e2e8f0 100%)',
  },
  {
    id: 'ocean-silk',
    name: '5. Oceanic Horizon (Moving Wave)',
    desc: 'Smooth coastal sapphire, aqua & deep sea motion',
    swatch: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 55%, #0f172a 100%)',
  },
  {
    id: 'royal-gold',
    name: '6. Champagne & Jade (Moving Glow)',
    desc: 'Warm sand, champagne gold & forest emerald drift',
    swatch: 'linear-gradient(135deg, #f59e0b 0%, #10b981 55%, #0f766e 100%)',
  },
  {
    id: 'obsidian-carbon',
    name: '7. Obsidian Carbon (Dark Glass)',
    desc: 'Sleek matte carbon dark mode with subtle emerald edge glow',
    swatch: 'linear-gradient(135deg, #020617 0%, #0f172a 60%, #064e3b 100%)',
  },
  {
    id: 'sunset-silk',
    name: '8. Sunset Horizon (Moving Silk)',
    desc: 'Warm coral, peach & twilight amber gradient',
    swatch: 'linear-gradient(135deg, #fb923c 0%, #f43f5e 55%, #fbbf24 100%)',
  },
  {
    id: 'cyber-grid',
    name: '9. Architectural Dot Matrix',
    desc: 'Crisp minimalist studio grid with top spotlight',
    swatch: 'repeating-linear-gradient(45deg, #10b981 0, #10b981 3px, #0f172a 3px, #0f172a 10px)',
  },
  {
    id: 'custom-image',
    name: '10. Custom Wallpaper (Upload / URL)',
    desc: 'Upload your own photo or paste any custom image URL',
    swatch: 'linear-gradient(135deg, #475569 0%, #0f172a 100%)',
  },
];

export default function Page() {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleMode, setRoleMode] = useState<'member' | 'admin' | 'owner'>('member');
  const [authLoading, setAuthLoading] = useState(true);
  const [darkMode, setDarkMode] = useState(false);

  const [clubName, setClubName] = useState('ClubSync');
  const [logoUrl, setLogoUrl] = useState('');
  const [currentBatch, setCurrentBatch] = useState('2026/2027');
  const [adminPinSetting, setAdminPinSetting] = useState('EXEC-2026');
  const [ownerPinSetting, setOwnerPinSetting] = useState('OWNER-2026');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [bgStyle, setBgStyle] = useState('emerald-aurora');
  const [bgImageUrl, setBgImageUrl] = useState('');

  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentBankInfo, setPaymentBankInfo] = useState('');
  const [paymentQrFile, setPaymentQrFile] = useState<File | null>(null);

  const [clubNameInput, setClubNameInput] = useState('ClubSync');
  const [newBatchInput, setNewBatchInput] = useState('2026/2027');
  const [newAdminPinInput, setNewAdminPinInput] = useState('EXEC-2026');
  const [newOwnerPinInput, setNewOwnerPinInput] = useState('OWNER-2026');
  const [departmentsText, setDepartmentsText] = useState(DEFAULT_DEPARTMENTS.join('\n'));

  const [showThemeStudio, setShowThemeStudio] = useState(false);
  const [bgFile, setBgFile] = useState<File | null>(null);
  const [logoFile, setLogoFile] = useState<File | null>(null);
  const [logoUrlInput, setLogoUrlInput] = useState('');
  const [savingTheme, setSavingTheme] = useState(false);

  const [confirmDialog, setConfirmDialog] = useState<ConfirmDialogState | null>(null);
  const [confirmRunning, setConfirmRunning] = useState(false);
  const [batchFilter, setBatchFilter] = useState<string>('ALL');

  const [permModalTarget, setPermModalTarget] = useState<UserProfile | null>(null);
  const [editingPerms, setEditingPerms] = useState<AdminPermissions>(DEFAULT_ADMIN_PERMISSIONS);

  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [matricNo, setMatricNo] = useState('A23CS0142');
  const [phoneNumber, setPhoneNumber] = useState('012-3456789');
  const [authError, setAuthError] = useState<string | null>(null);

  const [activeTab, setActiveTab] = useState<NavTab>('activities');
  const [activityTimeFilter, setActivityTimeFilter] = useState<'All' | 'Active' | 'Closed'>('All');

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [feePayments, setFeePayments] = useState<ActivityFeePayment[]>([]);
  const [allMembers, setAllMembers] = useState<UserProfile[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [claimThreshold, setClaimThreshold] = useState<number>(DEFAULT_CLAIM_APPROVAL_THRESHOLD);
  const [claimThresholdInput, setClaimThresholdInput] = useState<string>(String(DEFAULT_CLAIM_APPROVAL_THRESHOLD));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<EditableActivity | null>(null);
  const [opsModalEvent, setOpsModalEvent] = useState<Budget | null>(null);
  const [opsModalTab, setOpsModalTab] = useState<'fee' | 'transport' | 'qr' | 'pass'>('pass');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [quickAdjustFinanceOpen, setQuickAdjustFinanceOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDarkMode(localStorage.getItem('clubsync_dark') === 'true');
      const savedStyle = localStorage.getItem('clubsync_bg_style');
      const savedImg = localStorage.getItem('clubsync_bg_image');
      const savedLogo = localStorage.getItem('clubsync_logo_url');
      const savedPayQr = localStorage.getItem('clubsync_payment_qr');
      const savedPayBank = localStorage.getItem('clubsync_payment_bank');
      const savedThresh = localStorage.getItem('clubsync_claim_threshold');
      if (savedStyle) setBgStyle(savedStyle);
      if (savedImg) setBgImageUrl(savedImg);
      if (savedLogo) {
        setLogoUrl(savedLogo);
        setLogoUrlInput(savedLogo);
      }
      if (savedPayQr) setPaymentQrUrl(savedPayQr);
      if (savedPayBank) setPaymentBankInfo(savedPayBank);
      if (savedThresh !== null) {
        const parsed = parseFloat(savedThresh);
        if (!isNaN(parsed) && parsed >= 0) {
          setClaimThreshold(parsed);
          setClaimThresholdInput(String(parsed));
        }
      }
    }
  }, []);

  const toggleDarkMode = () => {
    setDarkMode((prev) => {
      const next = !prev;
      if (typeof window !== 'undefined') localStorage.setItem('clubsync_dark', String(next));
      return next;
    });
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage((p) => (p === msg ? null : p)), 3500);
  };

  const saveClaimThreshold = async (rawValue: string) => {
    if (!(roleMode === 'owner' && profile?.role === 'owner')) return;
    const parsed = parseFloat(rawValue);
    const nextThresh = !isNaN(parsed) && parsed >= 0 ? parsed : DEFAULT_CLAIM_APPROVAL_THRESHOLD;
    setClaimThreshold(nextThresh);
    setClaimThresholdInput(String(nextThresh));
    if (typeof window !== 'undefined') {
      localStorage.setItem('clubsync_claim_threshold', String(nextThresh));
    }
    const { error } = await supabase
      .from('club_settings')
      .upsert({ id: 1, claim_approval_threshold: nextThresh });
    if (profile) {
      void logActivity(
        profile,
        'Settings',
        'Claim threshold updated',
        `${profile.full_name} (${profile.matric_no}) set 2-stage claim threshold to RM ${nextThresh.toFixed(0)}`
      );
    }
    if (error) {
      showToast(`Saved locally (RM ${nextThresh.toFixed(0)}). Add DB column to sync all devices.`);
    } else {
      showToast(`2-stage threshold saved: RM ${nextThresh.toFixed(0)}`);
    }
    fetchAllData();
  };

  const normalizeProfile = (raw: Record<string, unknown>): UserProfile => {
    const p = (raw.admin_permissions as Partial<AdminPermissions>) || {};
    return {
      id: String(raw.id || ''),
      email: String(raw.email || ''),
      full_name: String(raw.full_name || ''),
      matric_no: String(raw.matric_no || ''),
      phone_number: String(raw.phone_number || ''),
      role: (raw.role as 'member' | 'treasurer' | 'owner') || 'member',
      admin_permissions: {
        can_manage_activities: p.can_manage_activities ?? DEFAULT_ADMIN_PERMISSIONS.can_manage_activities,
        can_manage_posters_polls: p.can_manage_posters_polls ?? DEFAULT_ADMIN_PERMISSIONS.can_manage_posters_polls,
        can_manage_equipment: p.can_manage_equipment ?? DEFAULT_ADMIN_PERMISSIONS.can_manage_equipment,
        can_manage_claims_fees: Boolean(p.can_manage_claims_fees),
        can_manage_transport: p.can_manage_transport ?? DEFAULT_ADMIN_PERMISSIONS.can_manage_transport,
        can_manage_finance: Boolean(p.can_manage_finance),
        can_manage_members: Boolean(p.can_manage_members),
      },
      member_type: String(raw.member_type || 'Member'),
      year_of_study: String(raw.year_of_study || ''),
      course: String(raw.course || ''),
      hometown: String(raw.hometown || ''),
      ic_no: String(raw.ic_no || ''),
      dormitory: String(raw.dormitory || ''),
      member_status: String(raw.member_status || 'Active'),
      batch_year: String(raw.batch_year || '2026/2027'),
      bank_name: String(raw.bank_name || ''),
      bank_account_no: String(raw.bank_account_no || ''),
      bank_account_holder: String(raw.bank_account_holder || ''),
      bank_qr_url: String(raw.bank_qr_url || ''),
      created_at: String(raw.created_at || ''),
    };
  };

  const resolveValidRoleMode = (norm: UserProfile, saved: 'member' | 'admin' | 'owner' | null): 'member' | 'admin' | 'owner' => {
    if (norm.role === 'member') {
      if (typeof window !== 'undefined') localStorage.setItem(`clubsync_mode_${norm.id}`, 'member');
      return 'member';
    }
    if (norm.role === 'treasurer') {
      return saved === 'member' ? 'member' : 'admin';
    }
    return saved || 'owner';
  };

  const fetchOrCreateProfile = useCallback(async (uid: string, uEmail: string, meta?: Record<string, string>) => {
    const saved =
      typeof window !== 'undefined'
        ? (localStorage.getItem(`clubsync_mode_${uid}`) as 'member' | 'admin' | 'owner' | null)
        : null;
    const { data: existing } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (existing) {
      const norm = normalizeProfile(existing as Record<string, unknown>);
      setRoleMode(resolveValidRoleMode(norm, saved));
      setProfile(norm);
      return;
    }
    const { data: ins } = await supabase
      .from('users')
      .upsert({
        id: uid,
        email: uEmail,
        full_name: meta?.full_name || uEmail.split('@')[0],
        matric_no: meta?.matric_no || 'A23CS0142',
        phone_number: meta?.phone_number || '012-3456789',
        role: 'member',
        admin_permissions: DEFAULT_ADMIN_PERMISSIONS,
        member_type: 'Member',
      })
      .select('*')
      .single();
    if (ins) {
      setRoleMode('member');
      setProfile(normalizeProfile(ins as Record<string, unknown>));
    }
  }, []);

  const fetchAllData = useCallback(async () => {
    const [bRes, cRes, rRes, fRes, mRes, lRes, sRes, eqIRes, eqLRes, annRes, pRes, pvRes, logRes] = await Promise.all([
      supabase.from('budgets').select('*').order('event_date', { ascending: true }),
      supabase.from('claims').select('*').order('created_at', { ascending: false }),
      supabase.from('event_rsvps').select('*'),
      supabase.from('activity_fee_payments').select('*').order('created_at', { ascending: false }),
      supabase.from('users').select('*').order('full_name', { ascending: true }),
      supabase.from('ledger_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('club_settings').select('*').eq('id', 1).maybeSingle(),
      supabase.from('equipment_items').select('*').order('item_name', { ascending: true }),
      supabase.from('equipment_loans').select('*').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('*'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000),
    ]);
    if (bRes.data) setBudgets(bRes.data as Budget[]);
    if (cRes.data) setClaims(cRes.data as Claim[]);
    if (rRes.data) setRsvps(rRes.data as EventRsvp[]);
    if (fRes.data) setFeePayments(fRes.data as ActivityFeePayment[]);
    if (mRes.data) {
      const list = (mRes.data as Record<string, unknown>[]).map(normalizeProfile);
      setAllMembers(list);
      if (sessionUserId) {
        const me = list.find((u) => u.id === sessionUserId);
        if (me) {
          setProfile(me);
          if (me.role === 'member') setRoleMode('member');
        }
      }
    }
    if (lRes.data) setLedgerEntries(lRes.data as LedgerEntryItem[]);
    const normalizedLoans = eqLRes.data
      ? (eqLRes.data as Record<string, unknown>[]).map(normalizeEquipmentLoan)
      : [];
    if (eqLRes.data) setEquipmentLoans(normalizedLoans);
    if (eqIRes.data) {
      setEquipmentItems(
        (eqIRes.data as Record<string, unknown>[]).map((raw) =>
          normalizeEquipmentItem(raw, normalizedLoans)
        )
      );
    }
    if (annRes.data) setAnnouncements(annRes.data as Announcement[]);
    if (pRes.data) setPolls(pRes.data as Poll[]);
    if (pvRes.data) setPollVotes(pvRes.data as PollVote[]);
    if (logRes.data) setActivityLogs(logRes.data as ActivityLogEntry[]);
    if (sRes.data) {
      if (sRes.data.claim_approval_threshold !== null && sRes.data.claim_approval_threshold !== undefined) {
        const thresh = Number(sRes.data.claim_approval_threshold);
        if (!isNaN(thresh) && thresh >= 0) {
          setClaimThreshold(thresh);
          setClaimThresholdInput(String(thresh));
          if (typeof window !== 'undefined') {
            localStorage.setItem('clubsync_claim_threshold', String(thresh));
          }
        }
      }
      const cName = String(sRes.data.club_name || 'ClubSync');
      const bYear = String(sRes.data.current_batch || '2026/2027');
      const aPin = String(sRes.data.admin_pin || 'EXEC-2026');
      const oPin = String(sRes.data.owner_pin || 'OWNER-2026');
      const depts = Array.isArray(sRes.data.departments)
        ? (sRes.data.departments as string[]).filter(Boolean)
        : DEFAULT_DEPARTMENTS;
      setClubName(cName);
      setClubNameInput(cName);
      setCurrentBatch(bYear);
      setNewBatchInput(bYear);
      setAdminPinSetting(aPin);
      setNewAdminPinInput(aPin);
      setOwnerPinSetting(oPin);
      setNewOwnerPinInput(oPin);
      setOwnerUserId(sRes.data.owner_user_id ? String(sRes.data.owner_user_id) : null);

      if (sRes.data.payment_qr_url) {
        setPaymentQrUrl(String(sRes.data.payment_qr_url));
        if (typeof window !== 'undefined') localStorage.setItem('clubsync_payment_qr', String(sRes.data.payment_qr_url));
      }
      if (sRes.data.payment_bank_info) {
        setPaymentBankInfo(String(sRes.data.payment_bank_info));
        if (typeof window !== 'undefined') localStorage.setItem('clubsync_payment_bank', String(sRes.data.payment_bank_info));
      }

      const localStyle = typeof window !== 'undefined' ? localStorage.getItem('clubsync_bg_style') : null;
      const localImg = typeof window !== 'undefined' ? localStorage.getItem('clubsync_bg_image') : null;
      const localLogo = typeof window !== 'undefined' ? localStorage.getItem('clubsync_logo_url') : null;

      if (!localStyle && sRes.data.bg_style) {
        setBgStyle(String(sRes.data.bg_style));
        if (typeof window !== 'undefined') localStorage.setItem('clubsync_bg_style', String(sRes.data.bg_style));
      }
      if (!localImg && sRes.data.bg_image_url) {
        setBgImageUrl(String(sRes.data.bg_image_url));
        if (typeof window !== 'undefined') localStorage.setItem('clubsync_bg_image', String(sRes.data.bg_image_url));
      }
      if (!localLogo && sRes.data.logo_url) {
        setLogoUrl(String(sRes.data.logo_url));
        setLogoUrlInput(String(sRes.data.logo_url));
        if (typeof window !== 'undefined') localStorage.setItem('clubsync_logo_url', String(sRes.data.logo_url));
      }
      if (depts.length > 0) {
        setDepartments((prev) => (prev.join('|') === depts.join('|') ? prev : depts));
        setDepartmentsText(depts.join('\n'));
      }
    }
  }, [sessionUserId]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setSessionUserId(session.user.id);
        fetchOrCreateProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata as Record<string, string>
        );
        fetchAllData();
      }
      setAuthLoading(false);
    });
    const { data: sub } = supabase.auth.onAuthStateChange((_ev, session) => {
      if (session?.user) {
        setSessionUserId(session.user.id);
        fetchOrCreateProfile(
          session.user.id,
          session.user.email || '',
          session.user.user_metadata as Record<string, string>
        );
        fetchAllData();
      } else {
        setSessionUserId(null);
        setProfile(null);
        setRoleMode('member');
      }
    });
    return () => sub.subscription.unsubscribe();
  }, [fetchOrCreateProfile, fetchAllData]);

  const handleRsvpAttendance = async (ev: Budget, nextStatus: 'Attending' | 'Not Attending') => {
    if (!profile) return;
    const existing = rsvps.find((r) => r.budget_id === ev.id && r.user_id === profile.id);
    const optimisticRow: EventRsvp = {
      id: existing?.id || `temp-${ev.id}-${profile.id}`,
      budget_id: ev.id,
      user_id: profile.id,
      student_name: profile.full_name,
      matric_no: profile.matric_no,
      phone_number: profile.phone_number,
      member_type: profile.member_type || 'Member',
      dormitory: existing?.dormitory || profile.dormitory || '',
      attendance: nextStatus,
      transport_type: nextStatus === 'Not Attending' ? 'None' : existing?.transport_type || 'None',
      is_driver: nextStatus === 'Not Attending' ? false : existing?.is_driver || false,
      car_details: existing?.car_details || '',
      seats_available: existing?.seats_available ?? 4,
      trips_count: existing?.trips_count ?? 1,
      assigned_driver_name: existing?.assigned_driver_name || '',
      qr_checked_in: existing?.qr_checked_in || false,
      qr_checked_in_at: existing?.qr_checked_in_at || null,
      pass_approved: existing?.pass_approved || false,
      updated_at: new Date().toISOString(),
    };

    setRsvps((prev) => [...prev.filter((r) => !(r.budget_id === ev.id && r.user_id === profile.id)), optimisticRow]);
    showToast(nextStatus === 'Attending' ? `Attending "${ev.event_name}"` : 'Marked as Not Attending');

    const corePayload = {
      budget_id: ev.id,
      user_id: profile.id,
      student_name: profile.full_name,
      matric_no: profile.matric_no,
      phone_number: profile.phone_number,
      member_type: profile.member_type || 'Member',
      dormitory: existing?.dormitory || profile.dormitory || '',
      attendance: nextStatus,
      transport_type: nextStatus === 'Not Attending' ? 'None' : existing?.transport_type || 'None',
      pass_approved: existing?.pass_approved ?? false,
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from('event_rsvps').upsert(corePayload, { onConflict: 'budget_id,user_id' });
    if (error && existing?.id && !existing.id.startsWith('temp-')) {
      await supabase.from('event_rsvps').update(corePayload).eq('id', existing.id);
    }
    fetchAllData();
  };

  const activeBudgets = filterActiveRecords('budgets', budgets, activityLogs);
  const activeClaims = filterActiveRecords('claims', claims, activityLogs);
  const activeFeePayments = filterActiveRecords('activity_fee_payments', feePayments, activityLogs);
  const activeEquipmentItems = filterActiveRecords('equipment_items', equipmentItems, activityLogs);
  const activeEquipmentLoans = filterActiveRecords('equipment_loans', equipmentLoans, activityLogs);
  const activeLedgerEntries = filterActiveRecords('ledger_entries', ledgerEntries, activityLogs);
  const activeAnnouncements = filterActiveRecords('announcements', announcements, activityLogs);
  const activePolls = filterActiveRecords('polls', polls, activityLogs);
  const activeRsvps = filterActiveRecords('event_rsvps', rsvps, activityLogs);

  const handleExportSingleEventExcel = async (ev: Budget) => {
    const evPayments = activeFeePayments.filter((f) => f.budget_id === ev.id);
    const evClaims = activeClaims.filter((c) => c.budget_id === ev.id);
    const evRsvps = activeRsvps.filter((r) => r.budget_id === ev.id);
    const evAttending = evRsvps.filter((r) => r.attendance === 'Attending');
    const evApprovedClaims = evClaims.filter((c) => c.status === 'Approved');
    const feesTotal = evPayments
      .filter((f) => f.status !== 'Rejected')
      .reduce((s, f) => s + Number(f.amount_paid), 0);
    const reimbursedTotal = evApprovedClaims.reduce((s, c) => s + Number(c.amount), 0);

    await exportMultiSheetExcel(`${ev.event_name}_Excel_Report`, [
      {
        name: '1_Event_Summary',
        headers: ['Metric', 'Value'],
        rows: [
          ['Activity Name', ev.event_name],
          ['Department', ev.category],
          ['Date & Time', `${ev.event_date} (${ev.event_time})`],
          ['Location', ev.location],
          ['Total Fee Payments Received (RM)', feesTotal.toFixed(2)],
          ['Total Reimbursements Paid (RM)', reimbursedTotal.toFixed(2)],
          ['Net Event Balance (RM)', (feesTotal - reimbursedTotal).toFixed(2)],
          ['Total Attending Members', evAttending.length],
          ['Total QR Checked-In', evRsvps.filter((r) => r.qr_checked_in).length],
        ],
      },
      {
        name: '2_Fee_Received',
        headers: ['Date', 'Student Name', 'Matric No', 'Phone', 'Amount Paid (RM)', 'Status', 'Receipt URL'],
        rows: evPayments.map((p) => [
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
        headers: ['Date', 'Claimant', 'Matric No', 'Phone', 'Title', 'Amount (RM)', 'Bank / DuitNow Info', 'Reviewed By', 'Receipt URL', 'Proof of Paid URL'],
        rows: evApprovedClaims.map((c) => [
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
        rows: evClaims.map((c) => [
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
        name: '5_Attendance_Carpool',
        headers: ['Name', 'Matric No', 'Phone', 'RSVP', 'QR Checked-In', 'Transport', 'Dorm', 'Assigned Driver'],
        rows: evRsvps.map((r) => [
          r.student_name,
          r.matric_no,
          r.phone_number,
          r.attendance,
          r.qr_checked_in ? 'Yes' : 'No',
          r.is_driver ? `Driver (${r.car_details})` : r.transport_type,
          r.dormitory || '-',
          r.assigned_driver_name || '-',
        ]),
      },
    ]);
    showToast(`Exported Multi-Sheet Excel for "${ev.event_name}"`);
  };

  const handleUnlockAdmin = async (pin: string): Promise<boolean> => {
    if (!profile) return false;
    const normalizedPin = pin.trim().toUpperCase();
    if (
      normalizedPin === ownerPinSetting.trim().toUpperCase() ||
      normalizedPin === 'OWNER-2026'
    ) {
      await supabase.from('users').update({ role: 'treasurer' }).eq('role', 'owner').neq('id', profile.id);
      await supabase
        .from('users')
        .update({ role: 'owner', admin_permissions: FULL_OWNER_PERMISSIONS })
        .eq('id', profile.id);
      await supabase.from('club_settings').update({ owner_user_id: profile.id }).eq('id', 1);
      setProfile((prev) => (prev ? { ...prev, role: 'owner', admin_permissions: FULL_OWNER_PERMISSIONS } : null));
      setRoleMode('owner');
      localStorage.setItem(`clubsync_mode_${profile.id}`, 'owner');
      fetchAllData();
      showToast('Owner Mode unlocked');
      return true;
    }
    if (
      normalizedPin === adminPinSetting.trim().toUpperCase() ||
      normalizedPin === 'EXEC-2026'
    ) {
      if (profile.role === 'member') {
        await supabase.from('users').update({ role: 'treasurer', admin_permissions: DEFAULT_ADMIN_PERMISSIONS }).eq('id', profile.id);
        setProfile((prev) => (prev ? { ...prev, role: 'treasurer', admin_permissions: DEFAULT_ADMIN_PERMISSIONS } : null));
      }
      setRoleMode('admin');
      localStorage.setItem(`clubsync_mode_${profile.id}`, 'admin');
      fetchAllData();
      showToast('Admin Mode unlocked');
      return true;
    }
    return false;
  };

  const handleSwitchMode = async (target: 'member' | 'admin' | 'owner') => {
    if (!profile) return;
    setRoleMode(target);
    localStorage.setItem(`clubsync_mode_${profile.id}`, target);
    if (target === 'member' && (activeTab === 'ledger' || activeTab === 'members' || activeTab === 'logs')) setActiveTab('activities');
    showToast(`Switched to ${target.toUpperCase()} Mode`);
  };

  const handleSaveThemeStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTheme(true);
    try {
      let finalBgUrl = bgImageUrl.trim();
      if (bgFile && bgFile.size <= MAX_FILE_SIZE_BYTES) {
        const path = `backgrounds/${Date.now()}.${bgFile.name.split('.').pop() || 'jpg'}`;
        const { error } = await supabase.storage.from('receipts').upload(path, bgFile);
        if (!error) finalBgUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      }

      let finalLogoUrl = logoUrlInput.trim();
      if (logoFile && logoFile.size <= MAX_FILE_SIZE_BYTES) {
        const ext = logoFile.name.split('.').pop() || 'png';
        const path = `logos/club-logo-${Date.now()}.${ext}`;
        const { error } = await supabase.storage.from('receipts').upload(path, logoFile);
        if (!error) finalLogoUrl = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
      }

      const chosenStyle = bgFile ? 'custom-image' : bgStyle;
      setBgStyle(chosenStyle);
      setBgImageUrl(finalBgUrl);
      setLogoUrl(finalLogoUrl);
      setLogoUrlInput(finalLogoUrl);

      if (typeof window !== 'undefined') {
        localStorage.setItem('clubsync_bg_style', chosenStyle);
        localStorage.setItem('clubsync_bg_image', finalBgUrl);
        localStorage.setItem('clubsync_logo_url', finalLogoUrl);
      }

      await supabase.from('club_settings').upsert({
        id: 1,
        bg_style: chosenStyle,
        bg_image_url: finalBgUrl,
        logo_url: finalLogoUrl,
      });

      setBgFile(null);
      setLogoFile(null);
      setShowThemeStudio(false);
      showToast('Saved Logo & Background');
    } finally {
      setSavingTheme(false);
    }
  };

  const hasAdminDbRole = profile?.role === 'treasurer' || profile?.role === 'owner';
  const isOwner = roleMode === 'owner' && profile?.role === 'owner';
  const isAdminOrOwner = (roleMode === 'admin' || roleMode === 'owner') && hasAdminDbRole;
  const effectivePermissions: AdminPermissions = isOwner
    ? FULL_OWNER_PERMISSIONS
    : isAdminOrOwner
    ? profile?.admin_permissions || DEFAULT_ADMIN_PERMISSIONS
    : NO_PERMISSIONS;

  const isNaturallyDarkStyle = bgStyle === 'galaxy-nebula' || bgStyle === 'obsidian-carbon';
  const isDarkCanvas = darkMode || isNaturallyDarkStyle;

  const getBackdropStyle = (): React.CSSProperties => {
    if (bgStyle === 'custom-image' && bgImageUrl) {
      return {
        backgroundImage: `linear-gradient(${
          isDarkCanvas ? 'rgba(2,6,23,0.82), rgba(2,6,23,0.90)' : 'rgba(255,255,255,0.68), rgba(241,245,249,0.82)'
        }), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      };
    }

    if (isDarkCanvas) {
      switch (bgStyle) {
        case 'galaxy-nebula':
          return {
            backgroundColor: '#050811',
            backgroundImage:
              'radial-gradient(at 15% 15%, rgba(45, 212, 191, 0.28) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(56, 189, 248, 0.25) 0px, transparent 55%), radial-gradient(at 50% 90%, rgba(16, 185, 129, 0.22) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 20s ease infinite',
          };
        case 'obsidian-carbon':
          return {
            backgroundColor: '#020617',
            backgroundImage:
              'radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.22) 0px, transparent 60%), radial-gradient(at 90% 90%, rgba(15, 23, 42, 0.9) 0px, transparent 50%)',
          };
        case 'ocean-silk':
          return {
            backgroundColor: '#020b18',
            backgroundImage:
              'radial-gradient(at 10% 10%, rgba(14, 165, 233, 0.35) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(37, 99, 235, 0.30) 0px, transparent 55%), radial-gradient(at 50% 95%, rgba(20, 184, 166, 0.25) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 18s ease infinite',
          };
        case 'royal-gold':
          return {
            backgroundColor: '#090a0f',
            backgroundImage:
              'radial-gradient(at 10% 10%, rgba(245, 158, 11, 0.32) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(16, 185, 129, 0.28) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 20s ease infinite',
          };
        case 'sunset-silk':
          return {
            backgroundColor: '#13090c',
            backgroundImage:
              'radial-gradient(at 15% 15%, rgba(251, 146, 60, 0.30) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(244, 63, 94, 0.28) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 20s ease infinite',
          };
        case 'cyber-grid':
          return {
            backgroundColor: '#020617',
            backgroundImage:
              'radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.28) 0px, transparent 60%), radial-gradient(rgba(16, 185, 129, 0.18) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 24px 24px',
          };
        default:
          return {
            backgroundColor: '#03120e',
            backgroundImage:
              'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.35) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(6, 182, 212, 0.30) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(5, 150, 105, 0.25) 0px, transparent 50%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 18s ease infinite',
          };
      }
    }

    switch (bgStyle) {
      case 'nordic-mist':
        return {
          backgroundColor: '#f1f5f9',
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(167, 243, 208, 0.55) 0px, transparent 50%), radial-gradient(at 100% 100%, rgba(226, 232, 240, 0.8) 0px, transparent 50%)',
        };
      case 'frosted-glass':
        return {
          backgroundColor: '#e0f2fe',
          backgroundImage:
            'radial-gradient(at 15% 15%, rgba(52, 211, 153, 0.50) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(56, 189, 248, 0.48) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(148, 163, 184, 0.35) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 20s ease infinite',
        };
      case 'ocean-silk':
        return {
          backgroundColor: '#dbeafe',
          backgroundImage:
            'radial-gradient(at 10% 10%, rgba(34, 211, 238, 0.50) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(59, 130, 246, 0.42) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 18s ease infinite',
        };
      case 'royal-gold':
        return {
          backgroundColor: '#fef3c7',
          backgroundImage:
            'radial-gradient(at 10% 10%, rgba(251, 191, 36, 0.50) 0px, transparent 50%), radial-gradient(at 90% 15%, rgba(52, 211, 153, 0.45) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 20s ease infinite',
        };
      case 'sunset-silk':
        return {
          backgroundColor: '#ffedd5',
          backgroundImage:
            'radial-gradient(at 12% 12%, rgba(251, 146, 60, 0.48) 0px, transparent 50%), radial-gradient(at 88% 18%, rgba(251, 113, 133, 0.42) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 20s ease infinite',
        };
      case 'cyber-grid':
        return {
          backgroundColor: '#f0fdf4',
          backgroundImage:
            'radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.32) 0px, transparent 60%), radial-gradient(rgba(4, 120, 87, 0.16) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 24px 24px',
        };
      default:
        return {
          backgroundColor: '#d1fae5',
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(52, 211, 153, 0.55) 0px, transparent 50%), radial-gradient(at 100% 10%, rgba(34, 211, 238, 0.48) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(16, 185, 129, 0.35) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 18s ease infinite',
        };
    }
  };

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );

  if (!sessionUserId || !profile) {
    return (
      <div className="min-h-screen relative overflow-hidden flex items-center justify-center p-4 bg-gradient-to-br from-emerald-50 via-teal-50/70 to-sky-100">
        <div className="fixed -top-28 -left-28 w-96 h-96 rounded-full bg-emerald-300/30 blur-3xl pointer-events-none" />
        <div className="fixed -bottom-28 -right-28 w-96 h-96 rounded-full bg-sky-300/30 blur-3xl pointer-events-none" />
        <div className="relative z-10 max-w-md w-full bg-white/90 backdrop-blur-xl text-slate-900 rounded-3xl shadow-xl border border-white overflow-hidden">
          <div className="bg-gradient-to-b from-emerald-100/80 via-teal-50/50 to-white p-6 text-center text-slate-900 border-b border-emerald-100">
            {logoUrl && !logoUrl.toLowerCase().endsWith('.pdf') ? (
              <img src={logoUrl} alt={clubName} className="w-14 h-14 rounded-2xl object-cover mx-auto mb-2 bg-white shadow-sm border border-emerald-200" />
            ) : (
              <div className="w-13 h-13 rounded-2xl bg-emerald-600 text-white flex items-center justify-center mx-auto mb-2 shadow-sm">
                <Layers className="w-7 h-7" />
              </div>
            )}
            <h1 className="text-lg font-extrabold text-emerald-950">{clubName}</h1>
            <p className="text-xs text-slate-500 mt-0.5">Club Finance &amp; Activity Portal</p>
          </div>
          <div className="grid grid-cols-2 bg-emerald-50/80 border border-emerald-100 p-1 m-5 mb-2 rounded-2xl">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${authMode === 'login' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-800'}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`py-2 text-xs font-bold rounded-xl transition cursor-pointer ${authMode === 'signup' ? 'bg-emerald-600 text-white shadow-xs' : 'text-slate-600 hover:text-emerald-800'}`}
            >
              Register
            </button>
          </div>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              setAuthError(null);
              const res =
                authMode === 'signup'
                  ? await supabase.auth.signUp({
                      email: email.trim(),
                      password,
                      options: {
                        data: {
                          full_name: fullName.trim(),
                          matric_no: matricNo.trim().toUpperCase(),
                          phone_number: phoneNumber.trim(),
                          role: 'member',
                        },
                      },
                    })
                  : await supabase.auth.signInWithPassword({ email: email.trim(), password });
              if (res.error) setAuthError(res.error.message);
            }}
            className="p-6 pt-2 space-y-3 text-xs"
          >
            {authMode === 'signup' && (
              <>
                <input
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Full Name *"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={matricNo}
                    onChange={(e) => setMatricNo(e.target.value)}
                    placeholder="Matric No *"
                    className="rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 font-mono"
                    required
                  />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Phone *"
                    className="rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 font-mono"
                    required
                  />
                </div>
              </>
            )}
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="Email *"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password *"
              className="w-full rounded-xl border border-slate-200 bg-slate-50/60 focus:bg-white px-3 py-2 text-sm"
              required
            />
            {authError && <div className="text-rose-600">{authError}</div>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm shadow-sm cursor-pointer">
              {authMode === 'login' ? 'Sign In' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const visibleBudgets = activeBudgets.filter((b) => activityTimeFilter === 'All' || b.status === activityTimeFilter);
  const visibleClaims = activeClaims.filter((c) => isAdminOrOwner || c.user_id === profile.id);
  const isUserClubOwner = (userId?: string) =>
    Boolean(
      userId &&
        ((ownerUserId && userId === ownerUserId) ||
          allMembers.some((u) => u.id === userId && u.role === 'owner') ||
          ((isOwner || profile.role === 'owner') && userId === profile.id))
    );
  const uniqueBatches = Array.from(new Set([currentBatch, ...allMembers.map((m) => m.batch_year || '2026/2027')]));
  const filteredMembers = allMembers.filter((m) => batchFilter === 'ALL' || (m.batch_year || '2026/2027') === batchFilter);

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-500 relative overflow-x-hidden ${
        isDarkCanvas ? 'text-slate-100' : 'text-slate-900'
      }`}
      style={getBackdropStyle()}
    >
      <style>{`
        @keyframes clubsyncNebula {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes clubsyncFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-16px) scale(1.03); }
        }
      `}</style>

      {(bgStyle === 'galaxy-nebula' || bgStyle === 'frosted-glass' || bgStyle === 'emerald-aurora') && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl"
            style={{ animation: 'clubsyncFloat 12s ease-in-out infinite' }}
          />
          <div
            className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-cyan-500/15 blur-3xl"
            style={{ animation: 'clubsyncFloat 15s ease-in-out infinite reverse' }}
          />
        </div>
      )}

      <div className="relative z-10 flex flex-col min-h-screen">
        <Navbar
          profile={profile}
          clubName={clubName}
          logoUrl={logoUrl}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          currentBatch={currentBatch}
          roleMode={isAdminOrOwner ? roleMode : 'member'}
          darkMode={isDarkCanvas}
          onToggleDarkMode={toggleDarkMode}
          canCustomizeTheme={isAdminOrOwner && effectivePermissions.can_manage_posters_polls}
          onOpenThemeStudio={() => setShowThemeStudio(true)}
          pendingClaimsCount={isAdminOrOwner ? activeClaims.filter((c) => c.status === 'Pending').length : 0}
          onUnlockAdmin={handleUnlockAdmin}
          onSwitchMode={handleSwitchMode}
          onSignOut={async () => {
            await supabase.auth.signOut();
            setProfile(null);
            setSessionUserId(null);
            setRoleMode('member');
          }}
          onOpenNewClaim={() => setIsClaimModalOpen(true)}
          onOpenQrScanner={() => setIsQrScannerOpen(true)}
          onOpenNewActivity={
            isAdminOrOwner && effectivePermissions.can_manage_activities
              ? () => {
                  setEditingActivity(null);
                  setIsBudgetModalOpen(true);
                }
              : undefined
          }
          onOpenNewFinance={
            isAdminOrOwner && effectivePermissions.can_manage_finance
              ? () => {
                  setActiveTab('ledger');
                  setQuickAdjustFinanceOpen(true);
                }
              : undefined
          }
        />

        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-500/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <main className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
          {activeTab === 'activities' && (
            <div className="space-y-8">
              <CinematicHub
                announcements={activeAnnouncements}
                polls={activePolls}
                pollVotes={pollVotes}
                profile={profile}
                isAdmin={isAdminOrOwner && effectivePermissions.can_manage_posters_polls}
                logs={activityLogs}
                onRefresh={(m: string) => {
                  fetchAllData();
                  showToast(m);
                }}
              />

              <section className="space-y-4">
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-5 rounded-3xl border backdrop-blur-xl shadow-xs ${
                    isDarkCanvas ? 'bg-slate-900/75 border-white/10' : 'bg-white/85 border-white/90'
                  }`}
                >
                  <h2 className="text-lg font-extrabold tracking-tight">Activities &amp; Events</h2>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQrScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-white border border-white/15 shadow-xs cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>Scan QR</span>
                    </button>
                    {isAdminOrOwner && effectivePermissions.can_manage_activities && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActivity(null);
                          setIsBudgetModalOpen(true);
                        }}
                        className={`px-3.5 py-2 rounded-xl text-xs font-bold border cursor-pointer ${
                          isDarkCanvas ? 'bg-white/10 border-white/15 text-white' : 'bg-slate-900 text-white border-slate-800'
                        }`}
                      >
                        + New Activity
                      </button>
                    )}
                    <div className={`flex p-1 rounded-xl text-xs ${isDarkCanvas ? 'bg-slate-800' : 'bg-slate-100'}`}>
                      {(['All', 'Active', 'Closed'] as const).map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setActivityTimeFilter(t)}
                          className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                            activityTimeFilter === t ? 'bg-emerald-600 text-white' : 'opacity-70'
                          }`}
                        >
                          {t === 'Active' ? 'Upcoming' : t === 'Closed' ? 'Past' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {visibleBudgets.map((ev) => {
                    const myRsvp = activeRsvps.find((r) => r.budget_id === ev.id && r.user_id === profile.id);
                    const isAttending = myRsvp?.attendance === 'Attending';
                    const isNotAttending = myRsvp?.attendance === 'Not Attending';
                    const qrCount = activeRsvps.filter((r) => r.budget_id === ev.id && r.qr_checked_in).length;
                    const paxCount = activeRsvps.filter(
                      (r) => r.budget_id === ev.id && r.attendance === 'Attending' && r.transport_type !== 'None' && !r.is_driver
                    ).length;
                    const drvCount = activeRsvps.filter((r) => r.budget_id === ev.id && r.is_driver).length;

                    const reqFee = Number(ev.registration_fee || 0);
                    const requiresFee = reqFee > 0;
                    const savedMode =
                      (typeof window !== 'undefined' ? localStorage.getItem(`clubsync_qrmode_${ev.id}`) : null) ||
                      ev.ticket_qr_mode ||
                      (requiresFee ? 'entry_pass' : 'scan_attendance');
                    const hasEntryPass = isEntryPassMode(savedMode);

                    return (
                      <div
                        key={ev.id}
                        className={`rounded-3xl p-5 border backdrop-blur-xl flex flex-col justify-between space-y-4 transition hover:-translate-y-0.5 hover:shadow-xl ${
                          isDarkCanvas
                            ? 'bg-slate-900/75 border-white/10 hover:border-emerald-500/40'
                            : 'bg-white/85 border-white/90 hover:bg-white/95 shadow-xs'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                              {ev.category}
                            </span>
                            {isAdminOrOwner && (
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => handleExportSingleEventExcel(ev)}
                                  className="px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                                  title="Download Multi-Sheet Excel Report for this Activity"
                                >
                                  <FileSpreadsheet className="w-3 h-3" />
                                  <span>Excel</span>
                                </button>
                                {effectivePermissions.can_manage_activities && (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryTarget({
                                          table: 'budgets',
                                          recordId: ev.id,
                                          title: ev.event_name,
                                        })
                                      }
                                      className={`px-2 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                        isDarkCanvas ? 'bg-white/10 text-amber-300 hover:bg-white/20' : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
                                      }`}
                                      title="View edit & delete history"
                                    >
                                      <History className="w-3 h-3" />
                                      <span>History</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setEditingActivity(ev);
                                        setIsBudgetModalOpen(true);
                                      }}
                                      className={`px-2.5 py-1 rounded-lg text-[11px] font-bold flex items-center gap-1 cursor-pointer ${
                                        isDarkCanvas ? 'bg-white/10 text-white hover:bg-white/20' : 'bg-slate-100 text-slate-800 hover:bg-slate-200'
                                      }`}
                                    >
                                      <Edit3 className="w-3 h-3" />
                                      <span>Edit</span>
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setConfirmDialog({
                                          title: 'Remove Activity from Web?',
                                          message: `"${ev.event_name}" will be removed from ClubSync dashboards and lists, while its original database record remains preserved in Supabase.`,
                                          confirmLabel: 'Remove from Web',
                                          danger: true,
                                          onConfirm: async () => {
                                            await softDeleteRecord({
                                              actor: profile,
                                              category: 'Activities',
                                              table: 'budgets',
                                              recordId: ev.id,
                                              recordTitle: ev.event_name,
                                              extraSummary: `${ev.category} · ${ev.event_date}`,
                                            });
                                            fetchAllData();
                                            showToast('Activity removed from web (kept in Supabase)');
                                          },
                                        })
                                      }
                                      className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                      title="Remove activity from web view (keeps row in Supabase)"
                                    >
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </>
                                )}
                              </div>
                            )}
                          </div>

                          <h3 className="text-base font-extrabold">{ev.event_name}</h3>
                          <p className="text-xs opacity-75">{ev.description}</p>

                          <div className="text-xs opacity-80 space-y-1 pt-1">
                            <div>
                              <Calendar className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500" />
                              {ev.event_date}
                            </div>
                            <div>
                              <Clock className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500" />
                              {ev.event_time}
                            </div>
                            <div>
                              <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500" />
                              {ev.location}
                            </div>
                          </div>

                          <div className="flex flex-wrap gap-2 pt-2">
                            {hasEntryPass ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('pass');
                                }}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <Ticket className="w-3.5 h-3.5" />
                                <span>{myRsvp?.qr_checked_in ? '✓ Attended' : 'Entry Pass'}</span>
                              </button>
                            ) : isAdminOrOwner ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('qr');
                                }}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Venue QR ({qrCount})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsQrScannerOpen(true)}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-slate-950 hover:bg-slate-900 text-white border border-white/15 text-xs font-bold flex items-center justify-center gap-1.5 shadow-2xs cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>{myRsvp?.qr_checked_in ? '✓ Attended' : 'Scan Attendance'}</span>
                              </button>
                            )}

                            {requiresFee && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('fee');
                                }}
                                className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1 border cursor-pointer ${
                                  isDarkCanvas
                                    ? 'bg-amber-500/20 border-amber-500/30 text-amber-300'
                                    : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'
                                }`}
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>RM {reqFee.toFixed(0)}</span>
                              </button>
                            )}

                            <button
                              type="button"
                              onClick={() => {
                                setOpsModalEvent(ev);
                                setOpsModalTab('transport');
                              }}
                              className={`py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 border transition cursor-pointer ${
                                isDarkCanvas
                                  ? 'bg-white/10 hover:bg-white/15 text-slate-100 border-white/10'
                                  : 'bg-slate-100 hover:bg-slate-200 text-slate-800 border-slate-200/80'
                              }`}
                            >
                              <Car className="w-3.5 h-3.5 text-emerald-500" />
                              <span>Carpool ({paxCount}/{drvCount})</span>
                            </button>
                          </div>
                        </div>

                        <div className="pt-3 border-t border-slate-500/15 flex items-center justify-between gap-2 text-xs">
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRsvpAttendance(ev, 'Attending')}
                              className={`px-3.5 py-1.5 rounded-xl font-bold transition cursor-pointer flex items-center gap-1 ${
                                isAttending
                                  ? 'bg-emerald-600 text-white shadow-xs'
                                  : isDarkCanvas
                                  ? 'bg-white/10 text-slate-300 hover:bg-emerald-600/30'
                                  : 'bg-slate-100 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700'
                              }`}
                            >
                              {isAttending && <CheckCircle2 className="w-3.5 h-3.5" />}
                              <span>{isAttending ? 'Attending' : 'Attend'}</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => handleRsvpAttendance(ev, 'Not Attending')}
                              className={`px-3 py-1.5 rounded-xl font-bold transition cursor-pointer ${
                                isNotAttending
                                  ? 'bg-slate-800 text-white'
                                  : isDarkCanvas
                                  ? 'bg-white/5 text-slate-400 hover:bg-white/10'
                                  : 'bg-slate-100 text-slate-500 hover:bg-slate-200'
                              }`}
                            >
                              {isNotAttending ? 'Not Attending' : 'No'}
                            </button>
                          </div>

                          {isAttending && (
                            <select
                              value={myRsvp?.transport_type || 'None'}
                              onChange={async (e) => {
                                const val = e.target.value as 'None' | 'One-Way' | 'Return Trip' | 'Round Trip';
                                const prevTransport = myRsvp?.transport_type || 'None';
                                setRsvps((prev) =>
                                  prev.map((r) =>
                                    r.budget_id === ev.id && r.user_id === profile.id ? { ...r, transport_type: val } : r
                                  )
                                );
                                if (myRsvp?.id && !myRsvp.id.startsWith('temp-')) {
                                  await supabase.from('event_rsvps').update({ transport_type: val }).eq('id', myRsvp.id);
                                  const changes = computeFieldChanges([
                                    { field: 'Transport Type', before: prevTransport, after: val },
                                  ]);
                                  await recordEditHistory({
                                    actor: profile,
                                    category: 'Carpool',
                                    table: 'event_rsvps',
                                    recordId: myRsvp.id,
                                    recordTitle: `${profile.full_name} (${ev.event_name})`,
                                    changes,
                                  });
                                }
                                fetchAllData();
                              }}
                              className="rounded-xl border border-slate-500/30 bg-transparent px-2 py-1 font-bold"
                            >
                              {TRANSPORT_OPTIONS.map((o) => (
                                <option key={o} value={o} className="text-slate-900">
                                  {o === 'None' ? 'Own Transport' : o}
                                </option>
                              ))}
                            </select>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
          )}

          {activeTab === 'equipment' && (
            <div className="text-slate-900">
              <EquipmentSection
                items={activeEquipmentItems}
                loans={activeEquipmentLoans}
                profile={profile}
                isAdmin={isAdminOrOwner && effectivePermissions.can_manage_equipment}
                logs={activityLogs}
                onRefresh={(m: string) => {
                  fetchAllData();
                  showToast(m);
                }}
              />
            </div>
          )}

          {activeTab === 'claims' && (
            <section className="bg-white/90 backdrop-blur-xl text-slate-900 rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
              <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-700" />
                  <h2 className="text-base font-extrabold">Reimbursement Claims</h2>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {isOwner && (
                    <div className="flex items-center gap-1.5 bg-indigo-50 border border-indigo-200 rounded-xl px-2.5 py-1 text-xs">
                      <span className="font-bold text-indigo-900">2-Stage &gt; RM</span>
                      <input
                        type="number"
                        min="0"
                        step="10"
                        value={claimThresholdInput}
                        onChange={(e) => setClaimThresholdInput(e.target.value)}
                        className="w-16 rounded-lg border border-indigo-200 bg-white px-2 py-1 text-xs font-extrabold text-indigo-950"
                      />
                      <button
                        type="button"
                        onClick={() => void saveClaimThreshold(claimThresholdInput)}
                        className="px-2.5 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-[11px] cursor-pointer"
                      >
                        Save
                      </button>
                    </div>
                  )}
                  <button
                    type="button"
                    onClick={() => setIsClaimModalOpen(true)}
                    className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
                  >
                    <PlusCircle className="w-4 h-4 inline mr-1" />
                    New Claim
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Claimant &amp; Bank</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status &amp; Proof</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleClaims.map((c) => {
                      const bankStr =
                        c.payment_info ||
                        (c.description?.includes('Reimburse To:')
                          ? c.description.split('Reimburse To:')[1]?.trim()
                          : '');
                      const isReceiptPdf =
                        c.receipt_file_name?.toLowerCase().endsWith('.pdf') ||
                        c.receipt_url?.toLowerCase().split('?')[0].endsWith('.pdf') ||
                        c.receipt_url?.startsWith('data:application/pdf');
                      return (
                        <tr key={c.id}>
                          <td className="py-3 px-4 font-bold">
                            <div className="flex items-center gap-2.5">
                              {c.receipt_url && !isReceiptPdf && (
                                <button
                                  type="button"
                                  onClick={() => setSelectedClaim(c)}
                                  className="w-9 h-9 rounded-lg border border-emerald-200 bg-emerald-50/40 overflow-hidden shrink-0 cursor-pointer hover:border-emerald-400"
                                  title="View full receipt photo"
                                >
                                  <img
                                    src={c.receipt_url}
                                    alt={c.title}
                                    className="w-full h-full object-cover"
                                  />
                                </button>
                              )}
                              <div>
                                {c.title} <span className="text-emerald-700 block font-normal">{c.category}</span>
                              </div>
                            </div>
                          </td>
                          <td className="py-3 px-4">
                            <div className="font-semibold">
                              {c.claimant_name} ({c.matric_no})
                            </div>
                            {bankStr && <div className="text-[11px] font-mono text-slate-500">{bankStr}</div>}
                          </td>
                          <td className="py-3 px-4 font-extrabold">RM {Number(c.amount).toFixed(2)}</td>
                          <td className="py-3 px-4 space-y-1">
                            <span
                              className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${
                                c.status === 'Approved'
                                  ? 'bg-emerald-100 text-emerald-800'
                                  : c.status === 'Rejected'
                                  ? 'bg-rose-100 text-rose-700'
                                  : 'bg-amber-100 text-amber-900'
                              }`}
                            >
                              {c.status === 'Pending' && Number(c.amount) > claimThreshold
                                ? isUserClubOwner(c.user_id)
                                  ? c.treasurer_verified_by
                                    ? 'Treasurer Verified (Ready)'
                                    : 'Awaiting Treasurer Approval'
                                  : c.treasurer_verified_by
                                  ? 'Stage 2/2: Awaiting Owner'
                                  : 'Stage 1/2: Awaiting Treasurer'
                                : c.status}
                            </span>
                            {c.payout_proof_url && (
                              <div>
                                <a
                                  href={c.payout_proof_url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 hover:underline"
                                >
                                  <span>✓ Proof of Paid</span>
                                  <ExternalLink className="w-3 h-3" />
                                </a>
                              </div>
                            )}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <div className="inline-flex items-center justify-end gap-1.5">
                              <button
                                type="button"
                                onClick={() =>
                                  setHistoryTarget({
                                    table: 'claims',
                                    recordId: c.id,
                                    title: c.title,
                                  })
                                }
                                className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold cursor-pointer inline-flex items-center gap-1"
                                title="View edit & delete history"
                              >
                                <History className="w-3.5 h-3.5" />
                                <span>History</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => setSelectedClaim(c)}
                                className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer inline-flex items-center gap-1"
                              >
                                <Eye className="w-3.5 h-3.5" />
                                <span>
                                  {isAdminOrOwner && effectivePermissions.can_manage_claims_fees
                                    ? 'Review / Edit'
                                    : 'View / Edit'}
                                </span>
                              </button>
                              {((isAdminOrOwner && effectivePermissions.can_manage_claims_fees) ||
                                (c.user_id === profile.id && c.status !== 'Approved')) && (
                                <button
                                  type="button"
                                  onClick={() =>
                                    setConfirmDialog({
                                      title: 'Remove Claim from Web?',
                                      message: `"${c.title}" (RM ${Number(c.amount).toFixed(2)}) will be removed from ClubSync dashboards and tables, while its row remains preserved in Supabase.`,
                                      confirmLabel: 'Remove from Web',
                                      danger: true,
                                      onConfirm: async () => {
                                        if (c.status === 'Approved' && c.budget_id) {
                                          const linkedBudget = activeBudgets.find((b) => b.id === c.budget_id);
                                          if (linkedBudget) {
                                            await supabase
                                              .from('budgets')
                                              .update({
                                                spent_amount: Math.max(
                                                  0,
                                                  Number(linkedBudget.spent_amount) - Number(c.amount)
                                                ),
                                              })
                                              .eq('id', linkedBudget.id);
                                          }
                                        }
                                        await softDeleteRecord({
                                          actor: profile,
                                          category: 'Claims',
                                          table: 'claims',
                                          recordId: c.id,
                                          recordTitle: c.title,
                                          extraSummary: `RM ${Number(c.amount).toFixed(2)} by ${c.claimant_name}`,
                                        });
                                        fetchAllData();
                                        showToast('Claim removed from web (kept in Supabase)');
                                      },
                                    })
                                  }
                                  className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                  title="Remove claim from web view (keeps row in Supabase)"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {activeTab === 'profile' && (
            <div className="text-slate-900">
              <ProfileSection
                profile={profile}
                departments={departments}
                budgets={budgets}
                myRsvps={rsvps.filter((r) => r.user_id === profile.id)}
                myFeePayments={feePayments.filter((f) => f.user_id === profile.id)}
                onUpdated={(u: Partial<UserProfile>, m: string) => {
                  setProfile((p) => (p ? { ...p, ...u } : null));
                  fetchAllData();
                  showToast(m);
                }}
              />
            </div>
          )}

          {activeTab === 'ledger' && isAdminOrOwner && (
            <div className="text-slate-900">
              <LedgerSection
                entries={activeLedgerEntries}
                events={activeBudgets.map((b) => ({ id: b.id, event_name: b.event_name }))}
                budgets={activeBudgets}
                rsvps={activeRsvps}
                claims={activeClaims}
                feePayments={activeFeePayments}
                profile={profile}
                logs={activityLogs}
                canEdit={effectivePermissions.can_manage_finance}
                externalOpenModal={quickAdjustFinanceOpen}
                onCloseExternalModal={() => setQuickAdjustFinanceOpen(false)}
                onSelectClaim={(c: Claim) => setSelectedClaim(c)}
                onRefresh={(m: string) => {
                  fetchAllData();
                  showToast(m);
                }}
              />
            </div>
          )}

          {activeTab === 'members' && isAdminOrOwner && (
            <div className="space-y-6 text-slate-900">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-emerald-100 p-6 space-y-4 shadow-xs">
                <div className="flex justify-between items-center">
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Club Settings, DuitNow / Payment QR &amp; Passcodes</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-900 border">
                    {isOwner ? 'Owner' : 'Admin'}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-3">
                    <div>
                      <label className="block font-bold mb-1">Departments / Units (1 per line)</label>
                      <textarea
                        rows={4}
                        value={departmentsText}
                        disabled={!effectivePermissions.can_manage_members}
                        onChange={(e) => setDepartmentsText(e.target.value)}
                        className="w-full rounded-xl border p-2.5 font-semibold"
                      />
                    </div>
                    <div className="p-3.5 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2">
                      <label className="block font-extrabold text-emerald-950">
                        Club DuitNow / TNG / Payment QR (Shown in Activity Fee Payment)
                      </label>
                      <input
                        type="file"
                        accept="image/*,application/pdf"
                        onChange={(e) => setPaymentQrFile(e.target.files?.[0] || null)}
                        className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                      />
                      <input
                        type="url"
                        value={paymentQrUrl}
                        onChange={(e) => setPaymentQrUrl(e.target.value)}
                        placeholder="Or paste Payment QR Image / PDF URL..."
                        className="w-full rounded-xl border bg-white px-3 py-1.5"
                      />
                      <input
                        type="text"
                        value={paymentBankInfo}
                        onChange={(e) => setPaymentBankInfo(e.target.value)}
                        placeholder="Club Bank Name, Account No & Holder (e.g., Maybank 551234567890 UTM Chess Club)"
                        className="w-full rounded-xl border bg-white px-3 py-1.5 font-mono font-bold"
                      />
                    </div>
                  </div>
                  <div className="space-y-2.5">
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block font-bold mb-1">Club Name (Owner Only)</label>
                        <input
                          type="text"
                          value={clubNameInput}
                          disabled={!isOwner}
                          onChange={(e) => setClubNameInput(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2 font-extrabold"
                        />
                      </div>
                      <div>
                        <label className="block font-bold mb-1">Active Batch Year (Owner Only)</label>
                        <input
                          type="text"
                          value={newBatchInput}
                          disabled={!isOwner}
                          onChange={(e) => setNewBatchInput(e.target.value)}
                          className="w-full rounded-xl border px-3 py-2 font-bold"
                        />
                      </div>
                    </div>
                    {isOwner && (
                      <>
                        <div className="grid grid-cols-2 gap-2">
                          <div>
                            <label className="block font-bold mb-1">Admin Passcode</label>
                            <input
                              type="text"
                              value={newAdminPinInput}
                              onChange={(e) => setNewAdminPinInput(e.target.value)}
                              className="w-full rounded-xl border px-3 py-2 font-mono font-bold"
                            />
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Owner Passcode</label>
                            <input
                              type="text"
                              value={newOwnerPinInput}
                              onChange={(e) => setNewOwnerPinInput(e.target.value)}
                              className="w-full rounded-xl border px-3 py-2 font-mono font-bold"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="block font-bold mb-1">
                            2-Stage Approval Threshold (RM)
                          </label>
                          <input
                            type="number"
                            min="0"
                            step="10"
                            value={claimThresholdInput}
                            onChange={(e) => setClaimThresholdInput(e.target.value)}
                            className="w-full rounded-xl border px-3 py-2 font-bold"
                          />
                        </div>
                      </>
                    )}
                    {(isOwner || effectivePermissions.can_manage_members || effectivePermissions.can_manage_claims_fees) && (
                      <button
                        type="button"
                        onClick={async () => {
                          let finalPayQr = paymentQrUrl.trim();
                          if (paymentQrFile && paymentQrFile.size <= MAX_FILE_SIZE_BYTES) {
                            const ext = paymentQrFile.name.split('.').pop() || 'png';
                            const path = `payment-qr/club-qr-${Date.now()}.${ext}`;
                            const { error } = await supabase.storage.from('receipts').upload(path, paymentQrFile);
                            if (!error) finalPayQr = supabase.storage.from('receipts').getPublicUrl(path).data.publicUrl;
                          }
                          setPaymentQrUrl(finalPayQr);
                          setPaymentQrFile(null);
                          if (typeof window !== 'undefined') {
                            localStorage.setItem('clubsync_payment_qr', finalPayQr);
                            localStorage.setItem('clubsync_payment_bank', paymentBankInfo.trim());
                          }

                          const depts = departmentsText
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const corePayload: Record<string, unknown> = {
                            id: 1,
                            departments: depts.length ? depts : DEFAULT_DEPARTMENTS,
                          };
                          if (isOwner) {
                            corePayload.club_name = clubNameInput.trim() || 'ClubSync';
                            corePayload.current_batch = newBatchInput.trim();
                            corePayload.admin_pin = newAdminPinInput.trim();
                            corePayload.owner_pin = newOwnerPinInput.trim();
                          }
                          const parsedThresh = parseFloat(claimThresholdInput);
                          const nextThresh =
                            !isNaN(parsedThresh) && parsedThresh >= 0
                              ? parsedThresh
                              : DEFAULT_CLAIM_APPROVAL_THRESHOLD;
                          if (isOwner && typeof window !== 'undefined') {
                            localStorage.setItem('clubsync_claim_threshold', String(nextThresh));
                          }
                          const fullPayload: Record<string, unknown> = {
                            ...corePayload,
                            payment_qr_url: finalPayQr,
                            payment_bank_info: paymentBankInfo.trim(),
                            ...(isOwner ? { claim_approval_threshold: nextThresh } : {}),
                          };
                          const { error } = await supabase.from('club_settings').upsert(fullPayload);
                          if (error) {
                            await supabase.from('club_settings').upsert(corePayload);
                            if (isOwner) {
                              await supabase
                                .from('club_settings')
                                .upsert({ id: 1, claim_approval_threshold: nextThresh });
                            }
                          }
                          if (isOwner) {
                            setClaimThreshold(nextThresh);
                            setClaimThresholdInput(String(nextThresh));
                          }
                          void logActivity(
                            profile,
                            'Settings',
                            'Club settings updated',
                            `${profile.full_name} (${profile.matric_no}) updated club settings (2-stage claim threshold: RM ${nextThresh.toFixed(0)})`
                          );
                          fetchAllData();
                          showToast('Settings & Club Payment QR saved');
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Save Settings &amp; Payment QR
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <section className="bg-white/90 backdrop-blur-xl rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
                <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h2 className="text-base font-extrabold">
                      Member Roster &amp; Clearance ({filteredMembers.length})
                    </h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <select
                      value={batchFilter}
                      onChange={(e) => setBatchFilter(e.target.value)}
                      className="rounded-xl border px-3 py-1.5 font-bold"
                    >
                      <option value="ALL">All Batches</option>
                      {uniqueBatches.map((b) => (
                        <option key={b} value={b}>
                          Batch {b}
                        </option>
                      ))}
                    </select>
                    {effectivePermissions.can_manage_members && batchFilter !== 'ALL' && (
                      <button
                        type="button"
                        onClick={() =>
                          setConfirmDialog({
                            title: `Clear Batch (${batchFilter})`,
                            message: `Confirm clearing all non-owner members in Batch "${batchFilter}" who have returned all equipment?`,
                            confirmLabel: 'Confirm Clearance',
                            danger: true,
                            onConfirm: async () => {
                              const toClear = filteredMembers.filter(
                                (m) =>
                                  m.role !== 'owner' &&
                                  m.id !== profile.id &&
                                  !equipmentLoans.some((l) => l.user_id === m.id && l.status !== 'Returned')
                              );
                              for (const m of toClear) await supabase.from('users').delete().eq('id', m.id);
                              fetchAllData();
                              showToast(`Cleared ${toClear.length} member(s)`);
                            },
                          })
                        }
                        className="px-3.5 py-1.5 rounded-xl font-bold bg-slate-100 hover:bg-rose-50 text-slate-700 hover:text-rose-700 border cursor-pointer"
                      >
                        Clear Batch {batchFilter}
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        const csv = [
                          'Name,Matric,Phone,Dorm,Batch,Department,Role',
                          ...filteredMembers.map(
                            (m) =>
                              `"${m.full_name}","${m.matric_no}","${m.phone_number}","${m.dormitory}","${
                                m.batch_year || currentBatch
                              }","${m.member_type}","${m.role}"`
                          ),
                        ].join('\n');
                        const a = document.createElement('a');
                        a.href = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
                        a.download = 'Members_Roster.csv';
                        a.click();
                      }}
                      className="px-3.5 py-1.5 rounded-xl font-bold bg-emerald-600 text-white cursor-pointer"
                    >
                      <Download className="w-3.5 h-3.5 inline mr-1" />
                      Export CSV
                    </button>
                  </div>
                </div>

                <div className="overflow-x-auto">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-50 border-b text-[11px] font-bold uppercase text-slate-600">
                        <th className="py-3 px-4">Member &amp; Batch</th>
                        <th className="py-3 px-4">Phone &amp; Dorm</th>
                        <th className="py-3 px-4">Equipment</th>
                        <th className="py-3 px-4">Role</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {filteredMembers.map((m) => {
                        const isThisOwner = m.role === 'owner' || (ownerUserId !== null && m.id === ownerUserId);
                        const isThisAdmin = m.role === 'treasurer' && !isThisOwner;
                        const pCount = Object.values(m.admin_permissions || {}).filter(Boolean).length;
                        const unreturnedLoans = equipmentLoans.filter((l) => l.user_id === m.id && l.status !== 'Returned');
                        return (
                          <tr key={m.id}>
                            <td className="py-3 px-4">
                              <div className="font-bold">
                                {m.full_name} ({m.matric_no})
                              </div>
                              <div className="text-[11px] text-slate-400">
                                {m.member_type} • Batch {m.batch_year || currentBatch}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {m.phone_number} • {m.dormitory || '-'}
                            </td>
                            <td className="py-3 px-4">
                              {unreturnedLoans.length === 0 ? (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700">
                                  ✓ Clear
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                                  Owes {unreturnedLoans.length}
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isThisOwner ? (
                                <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-amber-400 text-slate-950">
                                  Owner
                                </span>
                              ) : isThisAdmin ? (
                                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900">
                                  Admin ({pCount}/7)
                                </span>
                              ) : (
                                'Member'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                {isOwner && isThisAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPermModalTarget(m);
                                      setEditingPerms(m.admin_permissions || DEFAULT_ADMIN_PERMISSIONS);
                                    }}
                                    className="px-2.5 py-1 rounded-lg font-bold bg-emerald-50 text-emerald-900 border border-emerald-200 cursor-pointer"
                                  >
                                    Permissions
                                  </button>
                                )}
                                {!isThisOwner && effectivePermissions.can_manage_members && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isThisAdmin && !isOwner) {
                                        showToast('Only Owner can revoke Admin');
                                        return;
                                      }
                                      setConfirmDialog({
                                        title: isThisAdmin ? `Revoke Admin — ${m.full_name}` : `Make Admin — ${m.full_name}`,
                                        message: isThisAdmin
                                          ? `Confirm revoking Admin status from ${m.full_name}?`
                                          : `Confirm making ${m.full_name} an Admin?`,
                                        confirmLabel: 'Confirm',
                                        danger: isThisAdmin,
                                        onConfirm: async () => {
                                          const next = isThisAdmin ? 'member' : 'treasurer';
                                          await supabase
                                            .from('users')
                                            .update({ role: next, admin_permissions: DEFAULT_ADMIN_PERMISSIONS })
                                            .eq('id', m.id);
                                          void logActivity(
                                            profile,
                                            'Members',
                                            isThisAdmin ? 'Revoked Admin role' : 'Granted Admin role',
                                            `${profile.full_name} ${isThisAdmin ? 'revoked Admin status from' : 'granted Admin status to'} ${m.full_name} (${m.matric_no})`
                                          );
                                          fetchAllData();
                                          showToast('Role updated');
                                        },
                                      });
                                    }}
                                    className="px-2.5 py-1 rounded-lg font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 cursor-pointer"
                                  >
                                    {isThisAdmin ? 'Revoke Admin' : 'Make Admin'}
                                  </button>
                                )}
                                {isOwner && !isThisOwner && m.id !== profile.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDialog({
                                        title: `Transfer Ownership to ${m.full_name}?`,
                                        message: `Confirm transferring Owner control to ${m.full_name} (${m.matric_no})?`,
                                        confirmLabel: 'Transfer',
                                        danger: true,
                                        onConfirm: async () => {
                                          await supabase.from('users').update({ role: 'treasurer' }).eq('id', profile.id);
                                          await supabase
                                            .from('users')
                                            .update({ role: 'owner', admin_permissions: FULL_OWNER_PERMISSIONS })
                                            .eq('id', m.id);
                                          await supabase.from('club_settings').update({ owner_user_id: m.id }).eq('id', 1);
                                          void logActivity(
                                            profile,
                                            'Members',
                                            'Ownership transferred',
                                            `${profile.full_name} transferred Club Ownership to ${m.full_name} (${m.matric_no})`
                                          );
                                          setRoleMode('admin');
                                          localStorage.setItem(`clubsync_mode_${profile.id}`, 'admin');
                                          fetchAllData();
                                          showToast(`Transferred Ownership to ${m.full_name}`);
                                        },
                                      })
                                    }
                                    className="px-1.5 py-0.5 text-[11px] font-normal text-slate-400 hover:text-slate-600 underline-offset-2 hover:underline bg-transparent cursor-pointer"
                                  >
                                    Transfer Host
                                  </button>
                                )}
                                {effectivePermissions.can_manage_members && !isThisOwner && m.id !== profile.id && (
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setConfirmDialog({
                                        title: `Remove Member — ${m.full_name}`,
                                        message:
                                          unreturnedLoans.length > 0
                                            ? `Warning: ${m.full_name} still owes ${unreturnedLoans.length} equipment item(s)! Remove anyway?`
                                            : `Confirm removing ${m.full_name} from the roster?`,
                                        confirmLabel: 'Remove',
                                        danger: true,
                                        onConfirm: async () => {
                                          await supabase.from('users').delete().eq('id', m.id);
                                          void logActivity(
                                            profile,
                                            'Members',
                                            'Member removed',
                                            `${profile.full_name} removed ${m.full_name} (${m.matric_no}) from the roster`
                                          );
                                          fetchAllData();
                                          showToast(`Removed ${m.full_name}`);
                                        },
                                      })
                                    }
                                    className="p-1 text-slate-300 hover:text-rose-500 cursor-pointer"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </section>
            </div>
          )}

          {activeTab === 'logs' && isAdminOrOwner && (
            <ActivityLogSection
              logs={activityLogs}
              profile={profile}
              onRefresh={(m: string) => {
                fetchAllData();
                showToast(m);
              }}
            />
          )}
        </main>
      </div>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border max-w-md w-full overflow-hidden p-6 space-y-4">
            <div className="flex items-start gap-3">
              <div
                className={`p-2.5 rounded-2xl shrink-0 ${
                  confirmDialog.danger ? 'bg-amber-100 text-amber-800' : 'bg-emerald-100 text-emerald-800'
                }`}
              >
                <AlertTriangle className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-extrabold">{confirmDialog.title}</h3>
                <p className="text-xs text-slate-600 mt-1 leading-relaxed">{confirmDialog.message}</p>
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2 border-t">
              <button
                type="button"
                onClick={() => setConfirmDialog(null)}
                className="px-4 py-2 rounded-xl text-xs font-bold text-slate-600 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={confirmRunning}
                onClick={async () => {
                  setConfirmRunning(true);
                  try {
                    await confirmDialog.onConfirm();
                    setConfirmDialog(null);
                  } finally {
                    setConfirmRunning(false);
                  }
                }}
                className={`px-5 py-2 rounded-xl text-xs font-extrabold text-white cursor-pointer ${
                  confirmDialog.danger ? 'bg-slate-900 hover:bg-rose-700' : 'bg-emerald-600'
                }`}
              >
                {confirmRunning ? 'Processing...' : confirmDialog.confirmLabel}
              </button>
            </div>
          </div>
        </div>
      )}

      {showThemeStudio && isAdminOrOwner && effectivePermissions.can_manage_posters_polls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border max-w-lg w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-300" />
                Logo &amp; Background Studio
              </span>
              <button type="button" onClick={() => setShowThemeStudio(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveThemeStudio} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2.5">
                <label className="block font-bold text-slate-800">Club Logo (JPG, PNG, WEBP or PDF)</label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    logoUrl.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-12 h-12 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <FileText className="w-6 h-6" />
                      </div>
                    ) : (
                      <img src={logoUrl} alt="Logo" className="w-12 h-12 rounded-xl object-cover border bg-white shrink-0" />
                    )
                  ) : (
                    <div className="w-12 h-12 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Layers className="w-6 h-6" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full text-xs file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                </div>
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="Or paste Logo URL..."
                  className="w-full rounded-xl border bg-white px-3 py-1.5"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-bold text-slate-800">Background Style (10 Choices)</label>
                {BG_PRESETS.map((preset) => (
                  <label
                    key={preset.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer transition ${
                      bgStyle === preset.id ? 'border-emerald-600 bg-emerald-50/70 ring-2 ring-emerald-500/20' : 'border-slate-200 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <input
                        type="radio"
                        name="bgStyle"
                        checked={bgStyle === preset.id}
                        onChange={() => {
                          setBgStyle(preset.id);
                          if (typeof window !== 'undefined') localStorage.setItem('clubsync_bg_style', preset.id);
                        }}
                      />
                      <div
                        className="w-9 h-9 rounded-xl shadow-inner border border-black/10 shrink-0"
                        style={{ background: preset.swatch }}
                      />
                      <div>
                        <div className="font-bold text-slate-900">{preset.name}</div>
                        <div className="text-slate-500">{preset.desc}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {bgStyle === 'custom-image' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border space-y-2.5">
                  <div>
                    <label className="block font-bold mb-1">Upload Wallpaper Image</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBgFile(e.target.files?.[0] || null)}
                      className="w-full file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-xs file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">Or Paste Image URL</label>
                    <input
                      type="url"
                      value={bgImageUrl}
                      onChange={(e) => setBgImageUrl(e.target.value)}
                      placeholder="https://images.unsplash.com/..."
                      className="w-full rounded-xl border bg-white px-3 py-2"
                    />
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button type="button" onClick={() => setShowThemeStudio(false)} className="px-4 py-2">
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={savingTheme}
                  className="px-5 py-2.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                >
                  {savingTheme ? 'Saving...' : 'Save'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {permModalTarget && isOwner && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl max-w-lg w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <span className="text-sm font-bold">
                <Shield className="w-4 h-4 inline mr-1.5 text-amber-300" />
                Permissions — {permModalTarget.full_name}
              </span>
              <button type="button" onClick={() => setPermModalTarget(null)}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                await supabase
                  .from('users')
                  .update({ role: 'treasurer', admin_permissions: editingPerms })
                  .eq('id', permModalTarget.id);
                setPermModalTarget(null);
                fetchAllData();
                showToast('Permissions updated');
              }}
              className="p-6 space-y-2.5 text-xs"
            >
              {PERMISSION_LABELS.map((item) => (
                <label key={item.key} className="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={editingPerms[item.key]}
                    onChange={(e) => setEditingPerms((p) => ({ ...p, [item.key]: e.target.checked }))}
                    className="mt-0.5"
                  />
                  <div>
                    <div className="font-bold">{item.label}</div>
                    <div className="text-slate-500">{item.desc}</div>
                  </div>
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPermModalTarget(null)} className="px-4 py-2">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold">
                  Save
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        budgets={activeBudgets}
        rsvps={activeRsvps}
        feePayments={activeFeePayments}
        profile={profile}
        isAdmin={isAdminOrOwner}
        equipmentItems={activeEquipmentItems}
        equipmentLoans={activeEquipmentLoans}
        onSuccess={(m: string) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <EventOperationsModal
        event={opsModalEvent}
        initialTab={opsModalTab}
        profile={profile}
        isAdmin={isAdminOrOwner}
        permissions={effectivePermissions}
        rsvps={activeRsvps}
        feePayments={activeFeePayments}
        claims={activeClaims}
        logs={activityLogs}
        paymentQrUrl={paymentQrUrl}
        paymentBankInfo={paymentBankInfo}
        onClose={() => setOpsModalEvent(null)}
        onOpenScanner={() => setIsQrScannerOpen(true)}
        onRefresh={(m: string) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <ClaimFormModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        budgets={activeBudgets}
        departments={departments}
        existingClaims={activeClaims}
        profile={profile}
        onSuccess={(m: string) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <AuditReviewModal
        claim={selectedClaim}
        budget={activeBudgets.find((b) => b.id === selectedClaim?.budget_id)}
        budgets={activeBudgets}
        departments={departments}
        logs={activityLogs}
        allClaims={activeClaims}
        claimantProfile={allMembers.find((u) => u.id === selectedClaim?.user_id)}
        onSelectClaim={(c: Claim) => setSelectedClaim(c)}
        profile={{ ...profile, role: isAdminOrOwner && effectivePermissions.can_manage_claims_fees ? (isOwner ? 'owner' : 'treasurer') : 'member' }}
        isOwner={isOwner}
        isClaimantOwner={isUserClubOwner(selectedClaim?.user_id)}
        approvalThreshold={claimThreshold}
        onClose={() => setSelectedClaim(null)}
        onUpdated={(m: string) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <BudgetModal
        isOpen={isBudgetModalOpen}
        onClose={() => {
          setIsBudgetModalOpen(false);
          setEditingActivity(null);
        }}
        initialData={editingActivity}
        departments={departments}
        rsvps={activeRsvps}
        feePayments={activeFeePayments}
        profile={profile}
        logs={activityLogs}
        onSuccess={(m: string) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <RecordHistoryModal
        target={historyTarget}
        logs={activityLogs}
        onClose={() => setHistoryTarget(null)}
      />
    </div>
  );
}