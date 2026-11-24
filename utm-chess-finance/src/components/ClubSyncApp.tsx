'use client';

import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { createPortal } from 'react-dom';
import {
  supabase,
  isSupabaseConfigured,
  UserProfile,
  Budget,
  BudgetPlanItem,
  EventRsvp,
  ActivityFeePayment,
  Claim,
  PreClaim,
  PublicGuestRegistration,
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
  ClubNotificationItem,
  ChatDirectoryMember,
  DEFAULT_CLAIM_APPROVAL_THRESHOLD,
  logActivity,
} from '@/lib/supabase';
import Navbar, { NavTab } from '@/components/Navbar';
import MobileBottomNav from '@/components/MobileBottomNav';
import CinematicHub from '@/components/CinematicHub';
import EquipmentSection from '@/components/EquipmentSection';
import ProfileSection from '@/components/ProfileSection';
import ClaimFormModal from '@/components/ClaimFormModal';
import AuditReviewModal from '@/components/AuditReviewModal';
import PreClaimReviewModal from '@/components/PreClaimReviewModal';
import PublicLandingPage from '@/components/PublicLandingPage';
import PublicLandingEditorModal from '@/components/PublicLandingEditorModal';
import { PublicLandingConfig, PublicLandingSnapshot } from '@/lib/publicLanding';
import {
  resolveActivityConfig,
  formatActivitySchedule,
  hasFeeRequired,
  getFeeDisplayLabel,
  getFormatBadgeMeta,
} from '@/lib/activityConfig';
import BudgetModal, { EditableActivity } from '@/components/BudgetModal';
import { Globe, Link2, Video } from 'lucide-react';
import EventOperationsModal, { EventModalTab } from '@/components/EventOperationsModal';
import QrScannerModal from '@/components/QrScannerModal';
import LedgerSection, { LedgerEntryItem } from '@/components/LedgerSection';
import ActivityLogSection from '@/components/ActivityLogSection';
import RecordHistoryModal, { HistoryModalTarget } from '@/components/RecordHistoryModal';
import NotificationBell from '@/components/NotificationBell';
import FloatingChatDock from '@/components/FloatingChatDock';
import MemberProfileModal from '@/components/MemberProfileModal';
import NetworkStatusBanner from '@/components/NetworkStatusBanner';
import ErrorBoundary from '@/components/ErrorBoundary';
import {
  DashboardSkeleton,
  ClaimsSkeleton,
  QueryErrorCard,
} from '@/components/LoadingSkeletons';
import {
  buildChatbotSnapshot,
  ChatbotPermissions,
} from '@/lib/chatbotEngine';
import { findMemberRecord, MemberLookupHint } from '@/lib/memberLookup';
import {
  filterActiveRecords,
  softDeleteRecord,
  computeFieldChanges,
  recordEditHistory,
  SoftDeletedItem,
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
  EyeOff,
  KeyRound,
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
  Search,
  CalendarClock,
  Bot,
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
  can_view_sensitive_profiles: false,
  can_manage_public_page: false,
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

interface ClubSyncAppProps {
  initialPublicSnapshot?: PublicLandingSnapshot | null;
}

export default function ClubSyncApp({ initialPublicSnapshot = null }: ClubSyncAppProps) {
  const [sessionUserId, setSessionUserId] = useState<string | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [roleMode, setRoleMode] = useState<'member' | 'admin' | 'owner'>('member');
  const [authLoading, setAuthLoading] = useState(true);
  const [dataLoading, setDataLoading] = useState(true);
  const [networkError, setNetworkError] = useState<string | null>(null);
  const [darkMode, setDarkMode] = useState(false);

  const [clubName, setClubName] = useState(initialPublicSnapshot?.clubName || 'ClubSync');
  const [logoUrl, setLogoUrl] = useState(initialPublicSnapshot?.logoUrl || '');
  const [currentBatch, setCurrentBatch] = useState(initialPublicSnapshot?.currentBatch || '2026/2027');
  const [ownerUserId, setOwnerUserId] = useState<string | null>(null);
  const [openingBankBalance, setOpeningBankBalance] = useState<number>(0);
  const [openingCashBalance, setOpeningCashBalance] = useState<number>(0);
  const [openingBalanceDate, setOpeningBalanceDate] = useState<string>(
    new Date().toISOString().split('T')[0]
  );
  const [departments, setDepartments] = useState<string[]>(DEFAULT_DEPARTMENTS);
  const [bgStyle, setBgStyle] = useState('emerald-aurora');
  const [bgImageUrl, setBgImageUrl] = useState('');

  const [paymentQrUrl, setPaymentQrUrl] = useState('');
  const [paymentBankInfo, setPaymentBankInfo] = useState('');
  const [paymentQrFile, setPaymentQrFile] = useState<File | null>(null);

  const [clubNameInput, setClubNameInput] = useState(initialPublicSnapshot?.clubName || 'ClubSync');
  const [newBatchInput, setNewBatchInput] = useState(initialPublicSnapshot?.currentBatch || '2026/2027');
  const [clubTaglineInput, setClubTaglineInput] = useState(
    initialPublicSnapshot?.tagline ||
      'Campus activities, events, and student community — all in one portal.'
  );
  const [clubAboutInput, setClubAboutInput] = useState(initialPublicSnapshot?.clubAbout || '');
  const [instagramUrlInput, setInstagramUrlInput] = useState(initialPublicSnapshot?.instagramUrl || '');
  const [contactEmailInput, setContactEmailInput] = useState(initialPublicSnapshot?.contactEmail || '');
  const [publicLandingConfig, setPublicLandingConfig] = useState<PublicLandingConfig | null>(
    initialPublicSnapshot?.config ?? null
  );
  const [recoveryModalOpen, setRecoveryModalOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryConfirm, setRecoveryConfirm] = useState('');
  const [recoveryShowPw, setRecoveryShowPw] = useState(false);
  const [recoverySaving, setRecoverySaving] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [showPublicPageEditor, setShowPublicPageEditor] = useState(false);
  const [newAdminPinInput, setNewAdminPinInput] = useState('');
  const [newOwnerPinInput, setNewOwnerPinInput] = useState('');
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
  const [activityFormatFilter, setActivityFormatFilter] = useState<'ALL' | 'events' | 'online_programs' | 'fees'>('ALL');
  const deepLinkEventRef = useRef<{ eventId: string; panel?: EventModalTab } | null>(null);
  const deepLinkClaimRef = useRef<string | null>(null);
  const urlInitializedRef = useRef(false);

  const [budgets, setBudgets] = useState<Budget[]>([]);
  const [claims, setClaims] = useState<Claim[]>([]);
  const [preClaims, setPreClaims] = useState<PreClaim[]>([]);
  const [guestRegistrations, setGuestRegistrations] = useState<PublicGuestRegistration[]>([]);
  const [rsvps, setRsvps] = useState<EventRsvp[]>([]);
  const [feePayments, setFeePayments] = useState<ActivityFeePayment[]>([]);
  const [allMembers, setAllMembers] = useState<UserProfile[]>([]);
  const [ledgerEntries, setLedgerEntries] = useState<LedgerEntryItem[]>([]);
  const [budgetPlanItems, setBudgetPlanItems] = useState<BudgetPlanItem[]>([]);
  const [equipmentItems, setEquipmentItems] = useState<EquipmentItem[]>([]);
  const [equipmentLoans, setEquipmentLoans] = useState<EquipmentLoan[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [polls, setPolls] = useState<Poll[]>([]);
  const [pollVotes, setPollVotes] = useState<PollVote[]>([]);
  const [activityLogs, setActivityLogs] = useState<ActivityLogEntry[]>([]);
  const [clubNotifications, setClubNotifications] = useState<ClubNotificationItem[]>([]);
  const [claimThreshold, setClaimThreshold] = useState<number>(DEFAULT_CLAIM_APPROVAL_THRESHOLD);
  const [claimThresholdInput, setClaimThresholdInput] = useState<string>(String(DEFAULT_CLAIM_APPROVAL_THRESHOLD));
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [claimModalInitMode, setClaimModalInitMode] = useState<'receipt' | 'preclaim'>('receipt');
  const [claimModalPreClaimId, setClaimModalPreClaimId] = useState<string | null>(null);
  const [claimsSubTab, setClaimsSubTab] = useState<'receipts' | 'preclaims'>('receipts');
  const [claimsStatusFilter, setClaimsStatusFilter] = useState<string>('ALL');
  const [claimsSearchQuery, setClaimsSearchQuery] = useState<string>('');
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [chatbotTrainerSignal, setChatbotTrainerSignal] = useState(0);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [profileModalMember, setProfileModalMember] = useState<ChatDirectoryMember | UserProfile | null>(null);
  const [chatDmTargetUserId, setChatDmTargetUserId] = useState<string | null>(null);
  const [editingActivity, setEditingActivity] = useState<EditableActivity | null>(null);
  const [opsModalEvent, setOpsModalEvent] = useState<Budget | null>(null);
  const [opsModalTab, setOpsModalTab] = useState<EventModalTab>('pass');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [selectedPreClaim, setSelectedPreClaim] = useState<PreClaim | null>(null);
  const [quickAdjustFinanceOpen, setQuickAdjustFinanceOpen] = useState(false);
  const [historyTarget, setHistoryTarget] = useState<HistoryModalTarget | null>(null);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDarkMode(localStorage.getItem('clubsync_dark') === 'true');
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
    const { error } = await supabase
      .from('club_settings')
      .update({ claim_approval_threshold: nextThresh })
      .eq('id', 1);
    if (profile) {
      void logActivity(
        profile,
        'Settings',
        'Claim threshold updated',
        `${profile.full_name} (${profile.matric_no}) set 2-stage claim threshold to RM ${nextThresh.toFixed(0)}`
      );
    }
    if (error) {
      showToast(error.message || 'Could not update threshold in Supabase.');
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
        can_view_sensitive_profiles: Boolean(p.can_view_sensitive_profiles),
        can_manage_public_page: Boolean(p.can_manage_public_page),
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
      allow_whatsapp_chat: Boolean(raw.allow_whatsapp_chat),
      notifications_read_at: raw.notifications_read_at ? String(raw.notifications_read_at) : undefined,
      public_chat_read_at: raw.public_chat_read_at ? String(raw.public_chat_read_at) : undefined,
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
      const cleanAuthEmail = (uEmail || '').trim();
      const rowCopy: Record<string, unknown> = { ...(existing as Record<string, unknown>) };
      if (
        cleanAuthEmail &&
        cleanAuthEmail.toLowerCase() !== String(rowCopy.email || '').trim().toLowerCase()
      ) {
        const { error: syncErr } = await supabase
          .from('users')
          .update({ email: cleanAuthEmail })
          .eq('id', uid);
        if (!syncErr) {
          rowCopy.email = cleanAuthEmail;
        }
      }
      const norm = normalizeProfile(rowCopy);
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
    if (!isSupabaseConfigured) {
      setDataLoading(false);
      return;
    }
    setDataLoading(true);
    try {
      let activeUid = sessionUserId;
      if (!activeUid) {
        const { data: authData } = await supabase.auth.getUser();
        activeUid = authData.user?.id || null;
      }

      const meRes = activeUid
        ? await supabase.from('users').select('*').eq('id', activeUid).maybeSingle()
        : { data: null };
      const meProfile = meRes.data ? normalizeProfile(meRes.data as Record<string, unknown>) : null;
      if (meProfile) {
        setProfile(meProfile);
        if (meProfile.role === 'member') setRoleMode('member');
      }

    const callerIsOwner = meProfile?.role === 'owner';
    const callerCanViewSensitive =
      callerIsOwner ||
      (meProfile?.role === 'treasurer' &&
        Boolean(meProfile.admin_permissions?.can_view_sensitive_profiles));

    const [
      bRes,
      cRes,
      rRes,
      fRes,
      mRes,
      lRes,
      bpRes,
      sRes,
      pinRes,
      eqIRes,
      eqLRes,
      annRes,
      pRes,
      pvRes,
      logRes,
      notifRes,
      preRes,
      guestRes,
    ] = await Promise.all([
      supabase.from('budgets').select('*').order('event_date', { ascending: true }),
      supabase.from('claims').select('*').order('created_at', { ascending: false }),
      supabase.from('event_rsvps').select('*'),
      supabase.from('activity_fee_payments').select('*').order('created_at', { ascending: false }),
      callerCanViewSensitive
        ? supabase.from('users').select('*').order('full_name', { ascending: true })
        : supabase.from('users_public').select('*').order('full_name', { ascending: true }),
      supabase.from('ledger_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('budget_plan_items').select('*').order('created_at', { ascending: true }),
      supabase.from('club_settings_public').select('*').eq('id', 1).maybeSingle(),
      callerIsOwner
        ? supabase.from('club_settings').select('admin_pin, owner_pin').eq('id', 1).maybeSingle()
        : Promise.resolve({ data: null }),
      supabase.from('equipment_items').select('*').order('item_name', { ascending: true }),
      supabase.from('equipment_loans').select('*').order('created_at', { ascending: false }),
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('*'),
      supabase.from('activity_logs').select('*').order('created_at', { ascending: false }).limit(1000),
      supabase.from('club_notifications').select('*').order('created_at', { ascending: false }).limit(40),
      activeUid
        ? supabase.from('pre_claims').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      meProfile && (meProfile.role === 'owner' || meProfile.role === 'treasurer')
        ? supabase.from('public_guest_registrations').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
    ]);

      const coreErrors = [bRes.error, cRes.error, mRes.error, sRes.error].filter(Boolean);
      if (coreErrors.length > 0 && !bRes.data && !sRes.data) {
        setNetworkError('Unable to reach the club database. Please check your internet connection and retry.');
      } else {
        setNetworkError(null);
      }

    if (bRes.data) setBudgets(bRes.data as Budget[]);
    if (cRes.data) setClaims(cRes.data as Claim[]);
    if (preRes.data) setPreClaims(preRes.data as PreClaim[]);
    if (guestRes.data) setGuestRegistrations(guestRes.data as PublicGuestRegistration[]);
    if (rRes.data) setRsvps(rRes.data as EventRsvp[]);
    if (fRes.data) setFeePayments(fRes.data as ActivityFeePayment[]);
    if (mRes.data) {
      const publicOrAdminList = (mRes.data as Record<string, unknown>[]).map(normalizeProfile);
      const mergedList = meProfile
        ? publicOrAdminList.map((u) => (u.id === meProfile.id ? meProfile : u))
        : publicOrAdminList;
      setAllMembers(mergedList);
    } else if (meProfile) {
      setAllMembers([meProfile]);
    }
    if (lRes.data) setLedgerEntries(lRes.data as LedgerEntryItem[]);
    if (bpRes.data) setBudgetPlanItems(bpRes.data as BudgetPlanItem[]);
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
    if (notifRes.data) setClubNotifications(notifRes.data as ClubNotificationItem[]);

    if (pinRes.data) {
      const pinRow = pinRes.data as { admin_pin?: string | null; owner_pin?: string | null };
      if (pinRow.admin_pin) setNewAdminPinInput(String(pinRow.admin_pin));
      if (pinRow.owner_pin) setNewOwnerPinInput(String(pinRow.owner_pin));
    }

    if (sRes.data) {
      if (sRes.data.claim_approval_threshold !== null && sRes.data.claim_approval_threshold !== undefined) {
        const thresh = Number(sRes.data.claim_approval_threshold);
        if (!isNaN(thresh) && thresh >= 0) {
          setClaimThreshold(thresh);
          setClaimThresholdInput(String(thresh));
        }
      }
      const openBank = Number(sRes.data.opening_bank_balance ?? 0);
      const openCash = Number(sRes.data.opening_cash_balance ?? 0);
      setOpeningBankBalance(!isNaN(openBank) ? openBank : 0);
      setOpeningCashBalance(!isNaN(openCash) ? openCash : 0);
      if (sRes.data.opening_balance_date) {
        setOpeningBalanceDate(String(sRes.data.opening_balance_date).split('T')[0]);
      }
      const cName = String(sRes.data.club_name || 'ClubSync');
      const bYear = String(sRes.data.current_batch || '2026/2027');
      const depts = Array.isArray(sRes.data.departments)
        ? (sRes.data.departments as string[]).filter(Boolean)
        : DEFAULT_DEPARTMENTS;
      setClubName(cName);
      setClubNameInput(cName);
      setCurrentBatch(bYear);
      setNewBatchInput(bYear);
      setOwnerUserId(sRes.data.owner_user_id ? String(sRes.data.owner_user_id) : null);
      setPaymentQrUrl(sRes.data.payment_qr_url ? String(sRes.data.payment_qr_url) : '');
      setPaymentBankInfo(sRes.data.payment_bank_info ? String(sRes.data.payment_bank_info) : '');
      setBgStyle(sRes.data.bg_style ? String(sRes.data.bg_style) : 'emerald-aurora');
      setBgImageUrl(sRes.data.bg_image_url ? String(sRes.data.bg_image_url) : '');
      const dbLogo = sRes.data.logo_url ? String(sRes.data.logo_url) : '';
      setLogoUrl(dbLogo);
      setLogoUrlInput(dbLogo);
      if (sRes.data.club_tagline !== undefined) {
        setClubTaglineInput(
          String(
            sRes.data.club_tagline ||
              'Campus activities, events, and student community — all in one portal.'
          )
        );
      }
      if (sRes.data.club_about !== undefined) {
        setClubAboutInput(String(sRes.data.club_about || ''));
      }
      if (sRes.data.instagram_url !== undefined) {
        setInstagramUrlInput(String(sRes.data.instagram_url || ''));
      }
      if (sRes.data.contact_email !== undefined) {
        setContactEmailInput(String(sRes.data.contact_email || ''));
      }
      if (sRes.data.public_landing_config !== undefined) {
        const rawCfg = sRes.data.public_landing_config;
        setPublicLandingConfig(
          rawCfg && typeof rawCfg === 'object' ? (rawCfg as PublicLandingConfig) : null
        );
      }
      if (depts.length > 0) {
        setDepartments((prev) => (prev.join('|') === depts.join('|') ? prev : depts));
        setDepartmentsText(depts.join('\n'));
      }
    }
    } catch {
      setNetworkError('Unable to reach the club database. Please check your internet connection and retry.');
    } finally {
      setDataLoading(false);
    }
  }, [sessionUserId]);

  const refreshEvents = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const isAdminUser = profile?.role === 'owner' || profile?.role === 'treasurer';
    const [bRes, rRes, fRes, gRes] = await Promise.all([
      supabase.from('budgets').select('*').order('event_date', { ascending: true }),
      supabase.from('event_rsvps').select('*'),
      supabase.from('activity_fee_payments').select('*').order('created_at', { ascending: false }),
      isAdminUser
        ? supabase.from('public_guest_registrations').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
    ]);
    if (bRes.data) setBudgets(bRes.data as Budget[]);
    if (rRes.data) setRsvps(rRes.data as EventRsvp[]);
    if (fRes.data) setFeePayments(fRes.data as ActivityFeePayment[]);
    if (gRes.data) setGuestRegistrations(gRes.data as PublicGuestRegistration[]);
  }, [profile?.role]);

  const refreshHub = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [annRes, pRes, pvRes] = await Promise.all([
      supabase.from('announcements').select('*').order('created_at', { ascending: false }),
      supabase.from('polls').select('*').order('created_at', { ascending: false }),
      supabase.from('poll_votes').select('*'),
    ]);
    if (annRes.data) setAnnouncements(annRes.data as Announcement[]);
    if (pRes.data) setPolls(pRes.data as Poll[]);
    if (pvRes.data) setPollVotes(pvRes.data as PollVote[]);
  }, []);

  const refreshEquipment = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [eqIRes, eqLRes] = await Promise.all([
      supabase.from('equipment_items').select('*').order('item_name', { ascending: true }),
      supabase.from('equipment_loans').select('*').order('created_at', { ascending: false }),
    ]);
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
  }, []);

  const refreshClaims = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const [cRes, preRes, bRes, lRes] = await Promise.all([
      supabase.from('claims').select('*').order('created_at', { ascending: false }),
      sessionUserId
        ? supabase.from('pre_claims').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      supabase.from('budgets').select('*').order('event_date', { ascending: true }),
      supabase.from('ledger_entries').select('*').order('created_at', { ascending: false }),
    ]);
    if (cRes.data) setClaims(cRes.data as Claim[]);
    if (preRes.data) setPreClaims(preRes.data as PreClaim[]);
    if (bRes.data) setBudgets(bRes.data as Budget[]);
    if (lRes.data) setLedgerEntries(lRes.data as LedgerEntryItem[]);
  }, [sessionUserId]);

  const refreshFinance = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const isAdminUser = profile?.role === 'owner' || profile?.role === 'treasurer';
    const [lRes, bpRes, fRes, cRes, preRes, gRes, sRes] = await Promise.all([
      supabase.from('ledger_entries').select('*').order('created_at', { ascending: false }),
      supabase.from('budget_plan_items').select('*').order('created_at', { ascending: true }),
      supabase.from('activity_fee_payments').select('*').order('created_at', { ascending: false }),
      supabase.from('claims').select('*').order('created_at', { ascending: false }),
      sessionUserId
        ? supabase.from('pre_claims').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      isAdminUser
        ? supabase.from('public_guest_registrations').select('*').order('created_at', { ascending: false })
        : Promise.resolve({ data: null }),
      supabase.from('club_settings_public').select('*').eq('id', 1).maybeSingle(),
    ]);
    if (lRes.data) setLedgerEntries(lRes.data as LedgerEntryItem[]);
    if (bpRes.data) setBudgetPlanItems(bpRes.data as BudgetPlanItem[]);
    if (fRes.data) setFeePayments(fRes.data as ActivityFeePayment[]);
    if (cRes.data) setClaims(cRes.data as Claim[]);
    if (preRes.data) setPreClaims(preRes.data as PreClaim[]);
    if (gRes.data) setGuestRegistrations(gRes.data as PublicGuestRegistration[]);
    if (sRes.data) {
      const openBank = Number(sRes.data.opening_bank_balance ?? 0);
      const openCash = Number(sRes.data.opening_cash_balance ?? 0);
      if (!isNaN(openBank)) setOpeningBankBalance(openBank);
      if (!isNaN(openCash)) setOpeningCashBalance(openCash);
      if (sRes.data.opening_balance_date) {
        setOpeningBalanceDate(String(sRes.data.opening_balance_date).split('T')[0]);
      }
    }
  }, [profile?.role, sessionUserId]);

  const refreshMembersAndSettings = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const callerIsOwner = profile?.role === 'owner';
    const callerCanViewSensitive =
      callerIsOwner ||
      (profile?.role === 'treasurer' &&
        Boolean(profile.admin_permissions?.can_view_sensitive_profiles));
    const [mRes, sRes, pinRes] = await Promise.all([
      callerCanViewSensitive
        ? supabase.from('users').select('*').order('full_name', { ascending: true })
        : supabase.from('users_public').select('*').order('full_name', { ascending: true }),
      supabase.from('club_settings_public').select('*').eq('id', 1).maybeSingle(),
      callerIsOwner
        ? supabase.from('club_settings').select('admin_pin, owner_pin').eq('id', 1).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);
    if (mRes.data) {
      const list = (mRes.data as Record<string, unknown>[]).map(normalizeProfile);
      setAllMembers(
        profile ? list.map((u) => (u.id === profile.id ? profile : u)) : list
      );
    }
    if (pinRes.data) {
      const pinRow = pinRes.data as { admin_pin?: string | null; owner_pin?: string | null };
      if (pinRow.admin_pin) setNewAdminPinInput(String(pinRow.admin_pin));
      if (pinRow.owner_pin) setNewOwnerPinInput(String(pinRow.owner_pin));
    }
    if (sRes.data) {
      const depts = Array.isArray(sRes.data.departments)
        ? (sRes.data.departments as string[]).filter(Boolean)
        : DEFAULT_DEPARTMENTS;
      if (depts.length > 0) {
        setDepartments(depts);
        setDepartmentsText(depts.join('\n'));
      }
      if (sRes.data.club_name) {
        setClubName(String(sRes.data.club_name));
        setClubNameInput(String(sRes.data.club_name));
      }
      if (sRes.data.current_batch) {
        setCurrentBatch(String(sRes.data.current_batch));
        setNewBatchInput(String(sRes.data.current_batch));
      }
      if (sRes.data.public_landing_config && typeof sRes.data.public_landing_config === 'object') {
        setPublicLandingConfig(sRes.data.public_landing_config as PublicLandingConfig);
      }
    }
  }, [profile]);

  const refreshLogs = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('activity_logs')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1000);
    if (data) setActivityLogs(data as ActivityLogEntry[]);
  }, []);

  const refreshNotifications = useCallback(async () => {
    if (!isSupabaseConfigured) return;
    const { data } = await supabase
      .from('club_notifications')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(40);
    if (data) setClubNotifications(data as ClubNotificationItem[]);
  }, []);

  // URL Deep-Linking (without useSearchParams so static export/SSR builds cleanly)
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const validTabs: NavTab[] = ['activities', 'equipment', 'claims', 'profile', 'ledger', 'members', 'logs'];
    const validPanels: EventModalTab[] = ['fee', 'transport', 'qr', 'pass', 'access'];

    const applyFromSearch = () => {
      const sp = new URLSearchParams(window.location.search);
      const t = sp.get('tab') as NavTab | null;
      if (t && validTabs.includes(t)) {
        setActiveTab(t);
      }
      const evId = sp.get('event');
      const panelRaw = sp.get('panel') as EventModalTab | null;
      const panel = panelRaw && validPanels.includes(panelRaw) ? panelRaw : 'pass';
      if (evId) {
        deepLinkEventRef.current = { eventId: evId, panel };
      } else {
        setOpsModalEvent(null);
      }
      const clId = sp.get('claim');
      if (clId) {
        deepLinkClaimRef.current = clId;
      } else {
        setSelectedClaim(null);
      }
      urlInitializedRef.current = true;
    };

    applyFromSearch();
    window.addEventListener('popstate', applyFromSearch);
    return () => window.removeEventListener('popstate', applyFromSearch);
  }, []);

  const isCurrentlyAdminOrOwner =
    (roleMode === 'admin' || roleMode === 'owner') &&
    (profile?.role === 'treasurer' || profile?.role === 'owner');

  useEffect(() => {
    if (!profile) return;
    if (!isCurrentlyAdminOrOwner && (activeTab === 'ledger' || activeTab === 'members' || activeTab === 'logs')) {
      setActiveTab('activities');
    }
  }, [profile, isCurrentlyAdminOrOwner, activeTab]);

  useEffect(() => {
    const pending = deepLinkEventRef.current;
    if (!pending || budgets.length === 0) return;
    const found = budgets.find((b) => b.id === pending.eventId && !b.deleted_at);
    if (found) {
      setOpsModalEvent(found);
      setOpsModalTab(pending.panel || 'pass');
      deepLinkEventRef.current = null;
    }
  }, [budgets]);

  useEffect(() => {
    const pendingClaimId = deepLinkClaimRef.current;
    if (!pendingClaimId || claims.length === 0 || !profile) return;
    const found = claims.find((c) => c.id === pendingClaimId && !c.deleted_at);
    if (found && (isCurrentlyAdminOrOwner || found.user_id === profile.id)) {
      setSelectedClaim(found);
    }
    deepLinkClaimRef.current = null;
  }, [claims, isCurrentlyAdminOrOwner, profile]);

  useEffect(() => {
    if (typeof window === 'undefined' || !urlInitializedRef.current || !sessionUserId) return;
    if (deepLinkEventRef.current || deepLinkClaimRef.current) return;
    const sp = new URLSearchParams(window.location.search);
    sp.set('tab', activeTab);
    if (opsModalEvent) {
      sp.set('event', opsModalEvent.id);
      sp.set('panel', opsModalTab);
    } else {
      sp.delete('event');
      sp.delete('panel');
    }
    if (selectedClaim) {
      sp.set('claim', selectedClaim.id);
    } else {
      sp.delete('claim');
    }
    const nextSearch = `?${sp.toString()}`;
    if (window.location.search !== nextSearch) {
      window.history.replaceState(null, '', `${window.location.pathname}${nextSearch}`);
    }
  }, [sessionUserId, activeTab, opsModalEvent, opsModalTab, selectedClaim]);

  useEffect(() => {
    if (!isSupabaseConfigured) {
      setAuthLoading(false);
      return;
    }
    supabase.auth
      .getSession()
      .then(({ data: { session } }) => {
        if (session?.user) {
          setSessionUserId(session.user.id);
          fetchOrCreateProfile(
            session.user.id,
            session.user.email || '',
            session.user.user_metadata as Record<string, string>
          );
          fetchAllData();
        } else {
          setDataLoading(false);
        }
        setAuthLoading(false);
      })
      .catch(() => {
        setAuthLoading(false);
        setDataLoading(false);
      });
    const { data: sub } = supabase.auth.onAuthStateChange((ev, session) => {
      if (ev === 'PASSWORD_RECOVERY') {
        setRecoveryError(null);
        setRecoveryPassword('');
        setRecoveryConfirm('');
        setRecoveryShowPw(false);
        setRecoveryModalOpen(true);
      }
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

  const realtimeRefreshRef = useRef({
    claims: refreshClaims,
    finance: refreshFinance,
    events: refreshEvents,
  });
  realtimeRefreshRef.current = {
    claims: refreshClaims,
    finance: refreshFinance,
    events: refreshEvents,
  };

  const realtimeContextRef = useRef<{
    userId: string | null;
    isAdminOrOwner: boolean;
    budgets: Budget[];
    showToast: (msg: string) => void;
  }>({
    userId: sessionUserId,
    isAdminOrOwner: false,
    budgets: [],
    showToast,
  });

  useEffect(() => {
    if (!isSupabaseConfigured || !sessionUserId) return;

    const pendingScopes = new Set<'claims' | 'finance' | 'events'>();
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const scheduleRefresh = (scope: 'claims' | 'finance' | 'events') => {
      pendingScopes.add(scope);
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        const scopes = Array.from(pendingScopes);
        pendingScopes.clear();
        if (scopes.includes('claims')) void realtimeRefreshRef.current.claims();
        if (scopes.includes('finance')) void realtimeRefreshRef.current.finance();
        if (scopes.includes('events')) void realtimeRefreshRef.current.events();
      }, 400);
    };

    const channel = supabase
      .channel('clubsync-live')
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'claims' },
        (payload) => {
          scheduleRefresh('claims');
          const ctx = realtimeContextRef.current;
          const newRow = (payload.new || {}) as Record<string, unknown>;
          const oldRow = (payload.old || {}) as Record<string, unknown>;

          if (payload.eventType === 'INSERT') {
            if (ctx.isAdminOrOwner && newRow.user_id && String(newRow.user_id) !== ctx.userId) {
              ctx.showToast(
                `New claim from ${String(newRow.claimant_name || 'Member')}: "${String(
                  newRow.title || 'Claim'
                )}" (RM ${Number(newRow.amount || 0).toFixed(2)})`
              );
            }
          } else if (payload.eventType === 'UPDATE') {
            const nextStatus = String(newRow.status || '');
            const prevStatus = String(oldRow.status || '');
            if (
              newRow.user_id &&
              String(newRow.user_id) === ctx.userId &&
              nextStatus !== prevStatus &&
              (nextStatus === 'Approved' || nextStatus === 'Rejected')
            ) {
              ctx.showToast(
                `Your claim "${String(newRow.title || 'Claim')}" was ${nextStatus.toLowerCase()}!`
              );
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'pre_claims' },
        () => {
          scheduleRefresh('claims');
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'budgets' },
        (payload) => {
          scheduleRefresh('events');
          if (payload.eventType === 'UPDATE') {
            const ctx = realtimeContextRef.current;
            const newRow = (payload.new || {}) as Record<string, unknown>;
            const oldRow = (payload.old || {}) as Record<string, unknown>;
            const alloc = Number(newRow.allocated_amount || 0);
            const nextSpent = Number(newRow.spent_amount || 0);
            const prevSpent = Number(oldRow.spent_amount ?? 0);
            if (alloc > 0 && nextSpent > prevSpent) {
              const prevPct = (prevSpent / alloc) * 100;
              const nextPct = (nextSpent / alloc) * 100;
              const evName = String(newRow.event_name || 'Activity');
              if (nextPct >= 100 && prevPct < 100) {
                ctx.showToast(
                  `⚠ Over Budget: "${evName}" reached ${Math.round(nextPct)}% of its RM ${alloc.toFixed(2)} cap!`
                );
              } else if (nextPct >= 80 && prevPct < 80) {
                ctx.showToast(
                  `⚠ Near Budget Limit: "${evName}" reached ${Math.round(nextPct)}% of its RM ${alloc.toFixed(2)} cap.`
                );
              }
            }
          }
        }
      )
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'ledger_entries' },
        (payload) => {
          scheduleRefresh('finance');
          if (payload.eventType === 'INSERT') {
            const ctx = realtimeContextRef.current;
            const newRow = (payload.new || {}) as Record<string, unknown>;
            if (ctx.isAdminOrOwner && newRow.entry_type === 'OUT' && newRow.event_name) {
              const evClean = String(newRow.event_name).trim().toLowerCase();
              const matched = ctx.budgets.find(
                (b) => !b.deleted_at && b.event_name.trim().toLowerCase() === evClean
              );
              const alloc = Number(matched?.allocated_amount || 0);
              if (matched && alloc > 0) {
                const projPct =
                  ((Number(matched.spent_amount || 0) + Number(newRow.amount || 0)) / alloc) * 100;
                if (projPct >= 100) {
                  ctx.showToast(
                    `⚠ Over Budget Alert: "${matched.event_name}" expense pushes spending past 100% of its RM ${alloc.toFixed(2)} cap!`
                  );
                } else if (projPct >= 80) {
                  ctx.showToast(
                    `⚠ Near Budget Limit: "${matched.event_name}" expense reaches ${Math.round(projPct)}% of its RM ${alloc.toFixed(2)} cap.`
                  );
                }
              }
            }
          }
        }
      )
      .subscribe();

    return () => {
      if (debounceTimer) clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [sessionUserId]);

  useEffect(() => {
    if (!sessionUserId || isChatOpen) return;
    let active = true;
    (async () => {
      const { data, error } = await supabase.rpc('get_unread_chat_count');
      if (active && !error && typeof data === 'number') {
        setUnreadChatCount(data);
      }
    })();
    return () => {
      active = false;
    };
  }, [sessionUserId, isChatOpen]);

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
    refreshEvents();
  };

  const activeBudgets = filterActiveRecords('budgets', budgets);
  const activeClaims = filterActiveRecords('claims', claims);
  const activePreClaims = filterActiveRecords('pre_claims', preClaims);
  const activeGuestRegistrations = filterActiveRecords('public_guest_registrations', guestRegistrations);
  const activeFeePayments = filterActiveRecords('activity_fee_payments', feePayments);
  const activeEquipmentItems = filterActiveRecords('equipment_items', equipmentItems);
  const activeEquipmentLoans = filterActiveRecords('equipment_loans', equipmentLoans);
  const activeLedgerEntries = filterActiveRecords('ledger_entries', ledgerEntries);
  const activeBudgetPlanItems = budgetPlanItems.filter((p) => !p.deleted_at);
  const activeAnnouncements = filterActiveRecords('announcements', announcements);
  const activePolls = filterActiveRecords('polls', polls);
  const activeRsvps = filterActiveRecords('event_rsvps', rsvps);

  const deletedRecords: SoftDeletedItem[] = [
    ...budgets
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'budgets' as const,
        recordId: r.id,
        title: r.event_name || 'Activity',
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Activities' as const,
      })),
    ...claims
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'claims' as const,
        recordId: r.id,
        title: `${r.title} (${r.claimant_name})`,
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Claims' as const,
      })),
    ...preClaims
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'pre_claims' as const,
        recordId: r.id,
        title: `Pre-Claim: ${r.title} (${r.requester_name})`,
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Claims' as const,
      })),
    ...guestRegistrations
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'public_guest_registrations' as const,
        recordId: r.id,
        title: `Guest: ${r.guest_name} (${r.lookup_code})`,
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Fees' as const,
      })),
    ...feePayments
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'activity_fee_payments' as const,
        recordId: r.id,
        title: `${r.student_name} (RM ${Number(r.amount_paid).toFixed(2)})`,
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Fees' as const,
      })),
    ...equipmentItems
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'equipment_items' as const,
        recordId: r.id,
        title: r.item_name || 'Equipment',
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Equipment' as const,
      })),
    ...equipmentLoans
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'equipment_loans' as const,
        recordId: r.id,
        title: `${r.borrower_name} — ${r.item_name}`,
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Equipment' as const,
      })),
    ...ledgerEntries
      .filter((r) => Boolean((r as { deleted_at?: string | null }).deleted_at))
      .map((r) => {
        const rec = r as LedgerEntryItem & { deleted_at?: string | null; deleted_by?: string | null };
        return {
          table: 'ledger_entries' as const,
          recordId: rec.id,
          title: `${rec.title} (RM ${Number(rec.amount).toFixed(2)})`,
          deletedAt: rec.deleted_at || rec.created_at,
          deletedBy: rec.deleted_by || 'Admin',
          category: 'Finance' as const,
        };
      }),
    ...announcements
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'announcements' as const,
        recordId: r.id,
        title: r.title || 'Poster / Announcement',
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Activities' as const,
      })),
    ...polls
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'polls' as const,
        recordId: r.id,
        title: r.question || 'Poll',
        deletedAt: r.deleted_at || r.created_at,
        deletedBy: r.deleted_by || 'Admin',
        category: 'Activities' as const,
      })),
    ...rsvps
      .filter((r) => Boolean(r.deleted_at))
      .map((r) => ({
        table: 'event_rsvps' as const,
        recordId: r.id,
        title: `${r.student_name} (${r.matric_no})`,
        deletedAt: r.deleted_at || '',
        deletedBy: r.deleted_by || 'Admin',
        category: 'Activities' as const,
      })),
  ].sort((a, b) => new Date(b.deletedAt).getTime() - new Date(a.deletedAt).getTime());

  const handleExportSingleEventExcel = async (ev: Budget) => {
    const evPayments = activeFeePayments.filter((f) => f.budget_id === ev.id);
    const evClaims = activeClaims.filter((c) => c.budget_id === ev.id);
    const evRsvps = activeRsvps.filter((r) => r.budget_id === ev.id);
    const evAttending = evRsvps.filter((r) => r.attendance === 'Attending');
    const evApprovedClaims = evClaims.filter((c) => c.status === 'Approved');
    const feesTotal = evPayments
      .filter((f) => f.status === 'Verified')
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
    const trimmedPin = pin.trim();
    if (!trimmedPin) return false;
    const { data, error } = await supabase.rpc('verify_role_passcode', { pin_input: trimmedPin });
    const res = (data || {}) as { ok?: boolean; role?: 'owner' | 'admin' | null };
    if (error || !res?.ok || !res.role) return false;

    const targetMode: 'owner' | 'admin' = res.role === 'owner' ? 'owner' : 'admin';
    setRoleMode(targetMode);
    if (typeof window !== 'undefined') {
      localStorage.setItem(`clubsync_mode_${profile.id}`, targetMode);
    }
    await fetchAllData();
    showToast(targetMode === 'owner' ? 'Owner Mode unlocked' : 'Admin Mode unlocked');
    return true;
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

      await supabase
        .from('club_settings')
        .update({
          bg_style: chosenStyle,
          bg_image_url: finalBgUrl,
          logo_url: finalLogoUrl,
        })
        .eq('id', 1);

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

  realtimeContextRef.current = {
    userId: sessionUserId,
    isAdminOrOwner,
    budgets: activeBudgets,
    showToast,
  };

  // Derived synced EventOperationsModal target (always reflects latest budgets after edits/saves)
  const activeOpsEvent = opsModalEvent
    ? activeBudgets.find((b) => b.id === opsModalEvent.id) || opsModalEvent
    : null;

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

  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSessionUserId(null);
    setRoleMode('member');
    setDataLoading(true);
    setNetworkError(null);
    setBudgets([]);
    setClaims([]);
    setPreClaims([]);
    setGuestRegistrations([]);
    setAllMembers([]);
    setLedgerEntries([]);
    setFeePayments([]);
    setRsvps([]);
  };

  const handleRecoveryPasswordSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setRecoveryError(null);
    if (recoveryPassword.length < 6) {
      setRecoveryError('New password must be at least 6 characters.');
      return;
    }
    if (recoveryPassword !== recoveryConfirm) {
      setRecoveryError('Passwords do not match.');
      return;
    }
    setRecoverySaving(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: recoveryPassword });
      if (error) {
        setRecoveryError(error.message || 'Could not update password.');
        return;
      }
      setRecoveryPassword('');
      setRecoveryConfirm('');
      setRecoveryModalOpen(false);
      showToast('Password updated successfully!');
    } finally {
      setRecoverySaving(false);
    }
  };

  const renderPasswordRecoveryModal = () => {
    if (!recoveryModalOpen || typeof document === 'undefined') return null;
    return createPortal(
      <div
        className="fixed inset-0 z-[75] flex items-center justify-center bg-slate-950/70 backdrop-blur-xs p-4"
        role="dialog"
        aria-modal="true"
      >
        <div className="bg-white text-slate-900 rounded-3xl max-w-md w-full shadow-2xl border border-emerald-200 overflow-hidden">
          <div className="bg-gradient-to-r from-emerald-800 to-teal-700 text-white px-6 py-4 flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-white/15 flex items-center justify-center">
                <KeyRound className="w-4 h-4 text-emerald-200" />
              </div>
              <div>
                <h3 className="text-sm font-extrabold">Set New Password</h3>
                <p className="text-[11px] text-emerald-100">Complete your password recovery</p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setRecoveryModalOpen(false)}
              className="p-1 rounded-lg hover:bg-white/15 cursor-pointer"
              aria-label="Close"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <form onSubmit={handleRecoveryPasswordSubmit} className="p-6 space-y-4 text-xs">
            <div>
              <label className="block font-bold text-slate-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  type={recoveryShowPw ? 'text' : 'password'}
                  value={recoveryPassword}
                  onChange={(e) => setRecoveryPassword(e.target.value)}
                  placeholder="At least 6 characters"
                  className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                  required
                />
                <button
                  type="button"
                  onClick={() => setRecoveryShowPw((v) => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 cursor-pointer"
                  aria-label="Toggle password visibility"
                >
                  {recoveryShowPw ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
            <div>
              <label className="block font-bold text-slate-700 mb-1">Confirm New Password</label>
              <input
                type={recoveryShowPw ? 'text' : 'password'}
                value={recoveryConfirm}
                onChange={(e) => setRecoveryConfirm(e.target.value)}
                placeholder="Re-enter your new password"
                className="w-full rounded-xl border border-slate-300 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                required
              />
            </div>
            {recoveryError && (
              <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-700 font-semibold">
                {recoveryError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setRecoveryModalOpen(false)}
                className="px-4 py-2 rounded-xl text-slate-600 hover:bg-slate-100 font-bold cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={recoverySaving}
                className="inline-flex items-center gap-1.5 px-5 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold cursor-pointer disabled:opacity-60"
              >
                {recoverySaving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Update Password</span>
              </button>
            </div>
          </form>
        </div>
      </div>,
      document.body
    );
  };

  const chatbotPermissions = useMemo<ChatbotPermissions>(
    () => ({
      isAdmin: isAdminOrOwner,
      isOwner,
      canViewFinance:
        isAdminOrOwner &&
        (effectivePermissions.can_manage_finance ||
          effectivePermissions.can_manage_claims_fees),
    }),
    [
      isAdminOrOwner,
      isOwner,
      effectivePermissions.can_manage_finance,
      effectivePermissions.can_manage_claims_fees,
    ]
  );

  const chatbotSnapshot = useMemo(
    () =>
      buildChatbotSnapshot({
        clubName,
        currentBatch,
        profile,
        budgets: activeBudgets,
        claims: activeClaims,
        preClaims: activePreClaims,
        rsvps: activeRsvps,
        feePayments: activeFeePayments,
        guestRegistrations: activeGuestRegistrations,
        ledgerEntries: activeLedgerEntries,
        equipmentItems: activeEquipmentItems,
        equipmentLoans: activeEquipmentLoans,
        announcements: activeAnnouncements,
        openingBankBalance,
        openingCashBalance,
        claimThreshold,
        contactEmail: contactEmailInput,
      }),
    [
      clubName,
      currentBatch,
      profile,
      activeBudgets,
      activeClaims,
      activePreClaims,
      activeRsvps,
      activeFeePayments,
      activeGuestRegistrations,
      activeLedgerEntries,
      activeEquipmentItems,
      activeEquipmentLoans,
      activeAnnouncements,
      openingBankBalance,
      openingCashBalance,
      claimThreshold,
      contactEmailInput,
    ]
  );

  const isInitialLoading = dataLoading && budgets.length === 0 && allMembers.length === 0;
  const isInitialFatalError = Boolean(networkError) && budgets.length === 0 && allMembers.length === 0;

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-600 animate-spin" />
      </div>
    );

  if (!sessionUserId || !profile) {
    return (
      <>
        <PublicLandingPage
          initialClubName={clubName}
          initialLogoUrl={logoUrl}
          initialBatch={currentBatch}
          initialConfig={publicLandingConfig}
          initialPublicSnapshot={initialPublicSnapshot}
          authMode={authMode}
          setAuthMode={setAuthMode}
          email={email}
          setEmail={setEmail}
          password={password}
          setPassword={setPassword}
          fullName={fullName}
          setFullName={setFullName}
          matricNo={matricNo}
          setMatricNo={setMatricNo}
          phoneNumber={phoneNumber}
          setPhoneNumber={setPhoneNumber}
          authError={authError}
          setAuthError={setAuthError}
        />
        {renderPasswordRecoveryModal()}
      </>
    );
  }

  const hasMultipleActivityFormats =
    new Set(activeBudgets.map((b) => resolveActivityConfig(b).format)).size > 1;
  const visibleBudgets = activeBudgets.filter((b) => {
    if (activityTimeFilter !== 'All' && b.status !== activityTimeFilter) return false;
    if (activityFormatFilter === 'ALL') return true;
    const fmt = resolveActivityConfig(b).format;
    if (activityFormatFilter === 'events') return fmt === 'physical';
    if (activityFormatFilter === 'online_programs') {
      return fmt === 'online' || fmt === 'self_paced';
    }
    return fmt === 'fee_collection';
  });
  const visibleClaims = activeClaims.filter((c) => isAdminOrOwner || c.user_id === profile.id);
  const visiblePreClaims = activePreClaims.filter((pc) => isAdminOrOwner || pc.user_id === profile.id);
  const isUserClubOwner = (userId?: string) =>
    Boolean(
      userId &&
        ((ownerUserId && userId === ownerUserId) ||
          allMembers.some((u) => u.id === userId && u.role === 'owner') ||
          ((isOwner || profile.role === 'owner') && userId === profile.id))
    );
  const uniqueBatches = Array.from(new Set([currentBatch, ...allMembers.map((m) => m.batch_year || '2026/2027')]));
  const filteredMembers = allMembers.filter((m) => batchFilter === 'ALL' || (m.batch_year || '2026/2027') === batchFilter);
  const canViewSensitiveProfiles = Boolean(
    isOwner || (isAdminOrOwner && effectivePermissions.can_view_sensitive_profiles)
  );

  const handleOpenMemberProfile = async (hint: MemberLookupHint) => {
    const matched = findMemberRecord(allMembers, hint);
    if (matched) {
      setProfileModalMember(matched);
      return;
    }

    if (hint.userId) {
      const { data } = await supabase
        .from('users_public')
        .select('*')
        .eq('id', hint.userId)
        .maybeSingle();
      if (data) {
        setProfileModalMember(normalizeProfile(data as Record<string, unknown>));
        return;
      }
    }

    if (hint.matricNo?.trim()) {
      const { data } = await supabase
        .from('users_public')
        .select('*')
        .ilike('matric_no', hint.matricNo.trim())
        .maybeSingle();
      if (data) {
        setProfileModalMember(normalizeProfile(data as Record<string, unknown>));
        return;
      }
    }

    if (hint.name) {
      showToast(`No registered ClubSync member matched "${hint.name}".`);
    }
  };

  const handleOpenMemberDirect = (member: ChatDirectoryMember | UserProfile) => {
    const matched = allMembers.find((m) => m.id === member.id);
    setProfileModalMember(matched || member);
  };

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-500 relative isolate overflow-x-hidden ${
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
        <div className="fixed inset-0 pointer-events-none overflow-hidden -z-10">
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

      <div className="relative flex flex-col min-h-screen">
        <Navbar
          profile={profile}
          clubName={clubName}
          logoUrl={logoUrl}
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          currentBatch={currentBatch}
          roleMode={isAdminOrOwner ? roleMode : 'member'}
          notificationBell={
            <NotificationBell
              profile={profile}
              isAdminOrOwner={isAdminOrOwner}
              isOwner={isOwner}
              permissions={effectivePermissions}
              claimThreshold={claimThreshold}
              budgets={activeBudgets}
              rsvps={activeRsvps}
              feePayments={activeFeePayments}
              claims={activeClaims}
              equipmentLoans={activeEquipmentLoans}
              notifications={clubNotifications}
              unreadChatCount={unreadChatCount}
              darkMode={isDarkCanvas}
              onNavigateTab={(tab) => setActiveTab(tab)}
              onOpenEventOps={(budget, eventTab) => {
                setActiveTab('activities');
                setOpsModalEvent(budget);
                setOpsModalTab(eventTab);
              }}
              onOpenChat={() => setIsChatOpen(true)}
              onMarkedRead={(newReadIso) =>
                setProfile((p) => (p ? { ...p, notifications_read_at: newReadIso } : p))
              }
            />
          }
          darkMode={isDarkCanvas}
          onToggleDarkMode={toggleDarkMode}
          canCustomizeTheme={isAdminOrOwner && effectivePermissions.can_manage_posters_polls}
          onOpenThemeStudio={() => setShowThemeStudio(true)}
          canManagePublicPage={isAdminOrOwner && effectivePermissions.can_manage_public_page}
          onOpenPublicPageEditor={() => setShowPublicPageEditor(true)}
          pendingClaimsCount={
            isAdminOrOwner
              ? activeClaims.filter((c) => c.status === 'Pending').length +
                activePreClaims.filter((pc) => pc.status === 'Pending').length
              : 0
          }
          onUnlockAdmin={handleUnlockAdmin}
          onSwitchMode={handleSwitchMode}
          onSignOut={handleSignOut}
          onOpenNewClaim={() => {
            setClaimModalInitMode('receipt');
            setClaimModalPreClaimId(null);
            setIsClaimModalOpen(true);
          }}
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

        <NetworkStatusBanner
          networkError={networkError}
          onRetry={() => void fetchAllData()}
          onReconnected={() => void fetchAllData()}
        />

        {toastMessage && (
          <div className="fixed bottom-24 md:bottom-20 right-4 z-[80] bg-slate-900 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-500/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-400" />
            <span>{toastMessage}</span>
          </div>
        )}

        <main className="max-w-7xl w-full mx-auto px-4 pt-6 pb-24 md:pb-6 space-y-6 flex-1">
          {activeTab === 'activities' &&
            (isInitialLoading ? (
              <DashboardSkeleton darkMode={isDarkCanvas} />
            ) : isInitialFatalError ? (
              <QueryErrorCard
                message={networkError || 'Unable to load club activities right now.'}
                onRetry={() => void fetchAllData()}
                darkMode={isDarkCanvas}
              />
            ) : (
              <ErrorBoundary sectionName="Activities & Hub">
                <div className="space-y-8">
                  <CinematicHub
                announcements={activeAnnouncements}
                polls={activePolls}
                pollVotes={pollVotes}
                profile={profile}
                isAdmin={isAdminOrOwner && effectivePermissions.can_manage_posters_polls}
                logs={activityLogs}
                onRefresh={(m: string) => {
                  refreshHub();
                  showToast(m);
                }}
              />

              <section className="space-y-4">
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-4 sm:p-5 rounded-3xl border backdrop-blur-xl shadow-xs ${
                    isDarkCanvas ? 'bg-slate-900/75 border-white/10' : 'bg-white/85 border-white/90'
                  }`}
                >
                  <div className="flex flex-wrap items-center gap-2.5 sm:gap-3">
                    <h2 className="text-base sm:text-lg font-extrabold tracking-tight shrink-0">Activities &amp; Events</h2>
                    {hasMultipleActivityFormats && (
                      <div className={`flex flex-wrap p-1 rounded-xl text-[11px] ${isDarkCanvas ? 'bg-slate-800' : 'bg-slate-100'}`}>
                        {(
                          [
                            { id: 'ALL', label: 'All' },
                            { id: 'events', label: 'Events' },
                            { id: 'online_programs', label: 'Online / Programs' },
                            { id: 'fees', label: 'Fees' },
                          ] as const
                        ).map((f) => (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => setActivityFormatFilter(f.id)}
                            className={`px-2.5 py-1 rounded-lg font-bold cursor-pointer ${
                              activityFormatFilter === f.id ? 'bg-emerald-600 text-white' : 'opacity-70'
                            }`}
                          >
                            {f.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQrScannerOpen(true)}
                      className="hidden md:inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-white border border-white/15 shadow-xs cursor-pointer"
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

                    const cfg = resolveActivityConfig(ev);
                    const formatBadge = getFormatBadgeMeta(cfg.format);
                    const scheduleLabel = formatActivitySchedule(ev, cfg);
                    const requiresFee = hasFeeRequired(ev, cfg);
                    const feeDisplay = getFeeDisplayLabel(ev, cfg);
                    const savedMode = ev.ticket_qr_mode || (requiresFee && cfg.format === 'physical' ? 'entry_pass' : 'scan_attendance');
                    const hasEntryPass = isEntryPassMode(savedMode);

                    const myFeeVerified = activeFeePayments.some(
                      (f) => f.budget_id === ev.id && f.user_id === profile.id && f.status === 'Verified'
                    );
                    const myFeePending = activeFeePayments.some(
                      (f) => f.budget_id === ev.id && f.user_id === profile.id && f.status === 'Pending'
                    );
                    const isUnlockedAccess = !requiresFee
                      ? isAttending || cfg.format === 'fee_collection'
                      : cfg.unlock_timing === 'immediate_on_submit'
                      ? myFeeVerified || myFeePending || myRsvp?.pass_approved === true
                      : myFeeVerified || myRsvp?.pass_approved === true;

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
                          <div className="flex flex-wrap justify-between items-center gap-1.5">
                            <div className="flex flex-wrap items-center gap-1.5">
                              <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-600 border border-emerald-500/20">
                                {ev.category}
                              </span>
                              {cfg.format !== 'physical' && (
                                <span className={`text-[10px] font-extrabold px-2 py-0.5 rounded-md border ${formatBadge.badgeClass}`}>
                                  {formatBadge.label}
                                </span>
                              )}
                            </div>
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
                                            refreshEvents();
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
                              {scheduleLabel}
                            </div>
                            {ev.event_time && cfg.format !== 'self_paced' && cfg.format !== 'fee_collection' && (
                              <div>
                                <Clock className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500" />
                                {ev.event_time}
                              </div>
                            )}
                            {ev.location && cfg.format !== 'self_paced' && cfg.format !== 'fee_collection' && (
                              <div>
                                {cfg.format === 'online' ? (
                                  <Video className="w-3.5 h-3.5 inline mr-1.5 text-sky-500" />
                                ) : (
                                  <MapPin className="w-3.5 h-3.5 inline mr-1.5 text-emerald-500" />
                                )}
                                {ev.location}
                              </div>
                            )}
                          </div>

                          {/* Context-Aware Action Buttons per Activity Format */}
                          {cfg.format === 'physical' && (
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
                                  <span>{feeDisplay}</span>
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
                          )}

                          {cfg.format === 'online' && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('pass');
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isUnlockedAccess
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-slate-950 hover:bg-slate-900 text-white border border-white/15'
                                }`}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>{isUnlockedAccess ? '✓ Open Link' : 'Get Link / Access'}</span>
                              </button>
                              {requiresFee && (!myFeeVerified || isAdminOrOwner) && (
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
                                  <span>{myFeeVerified ? 'Paid ✓' : `Pay Fee (${feeDisplay})`}</span>
                                </button>
                              )}
                            </div>
                          )}

                          {cfg.format === 'self_paced' && (
                            <div className="flex flex-wrap gap-2 pt-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab(
                                    requiresFee && !myFeeVerified && !myFeePending ? 'fee' : 'pass'
                                  );
                                }}
                                className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer ${
                                  isUnlockedAccess
                                    ? 'bg-emerald-600 hover:bg-emerald-500 text-white'
                                    : 'bg-slate-950 hover:bg-slate-900 text-white border border-white/15'
                                }`}
                              >
                                <Link2 className="w-3.5 h-3.5" />
                                <span>
                                  {isUnlockedAccess
                                    ? cfg.access_link_url
                                      ? '✓ Open Resource'
                                      : '✓ Enrolled'
                                    : requiresFee
                                    ? `Enroll / Pay (${feeDisplay})`
                                    : 'Enroll & Access'}
                                </span>
                              </button>
                              {isAdminOrOwner && (
                                <button
                                  type="button"
                                  onClick={() => {
                                    setOpsModalEvent(ev);
                                    setOpsModalTab('fee');
                                  }}
                                  className="py-2 px-3 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-800 border border-slate-200 cursor-pointer"
                                >
                                  Manage
                                </button>
                              )}
                            </div>
                          )}

                          {cfg.format === 'fee_collection' && (
                            <div className="flex flex-wrap items-center justify-between gap-2 pt-2">
                              <span
                                className={`px-2.5 py-1 rounded-full text-[11px] font-extrabold ${
                                  myFeeVerified
                                    ? 'bg-emerald-100 text-emerald-800'
                                    : myFeePending
                                    ? 'bg-amber-100 text-amber-900'
                                    : 'bg-slate-100 text-slate-700'
                                }`}
                              >
                                {myFeeVerified
                                  ? '✓ Paid & Registered'
                                  : myFeePending
                                  ? '⏳ Pending Verification'
                                  : 'Unpaid'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('fee');
                                }}
                                className="flex-1 py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                              >
                                <CreditCard className="w-3.5 h-3.5" />
                                <span>
                                  {myFeeVerified || myFeePending
                                    ? 'View Receipt & Status'
                                    : `Pay Fee (${feeDisplay})`}
                                </span>
                              </button>
                            </div>
                          )}
                        </div>

                        {cfg.format === 'physical' || cfg.format === 'online' ? (
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

                            {cfg.format === 'physical' && isAttending && (
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
                                  refreshEvents();
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
                        ) : cfg.format === 'self_paced' ? (
                          <div className="pt-3 border-t border-slate-500/15 flex items-center justify-between text-[11px] opacity-80">
                            <span>
                              {myFeeVerified || (!requiresFee && isAttending)
                                ? '✓ Enrolled in Program'
                                : myFeePending
                                ? '⏳ Verification Pending'
                                : 'Open Enrollment'}
                            </span>
                            {ev.end_date || cfg.end_date ? (
                              <span className="font-mono">Ends {cfg.end_date || ev.end_date}</span>
                            ) : null}
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            </div>
              </ErrorBoundary>
            ))}

          {activeTab === 'equipment' && (
            <ErrorBoundary sectionName="Equipment Management">
              <div className="text-slate-900">
                <EquipmentSection
                  items={activeEquipmentItems}
                  loans={activeEquipmentLoans}
                  profile={profile}
                  isAdmin={isAdminOrOwner && effectivePermissions.can_manage_equipment}
                  logs={activityLogs}
                  onOpenMemberProfile={handleOpenMemberProfile}
                  onRefresh={(m: string) => {
                    refreshEquipment();
                    showToast(m);
                  }}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'claims' && (() => {
            if (isInitialLoading) {
              return <ClaimsSkeleton darkMode={isDarkCanvas} />;
            }
            if (isInitialFatalError) {
              return (
                <QueryErrorCard
                  message={networkError || 'Unable to load claims right now.'}
                  onRetry={() => void fetchAllData()}
                  darkMode={isDarkCanvas}
                />
              );
            }
            const receiptStatusPills = ['ALL', 'Pending', 'Approved', 'Rejected'] as const;
            const preClaimStatusPills = [
              'ALL',
              'Pending',
              'Pre-Approved',
              'Advance Disbursed',
              'Receipt Submitted',
              'Settled',
            ] as const;
            const q = claimsSearchQuery.trim().toLowerCase();

            const filteredReceiptClaims = visibleClaims.filter((c) => {
              if (claimsStatusFilter !== 'ALL' && c.status !== claimsStatusFilter) return false;
              if (q) {
                const hay = `${c.title} ${c.claimant_name} ${c.matric_no} ${c.category} ${c.merchant_name}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });

            const filteredPreClaims = visiblePreClaims.filter((pc) => {
              if (claimsStatusFilter !== 'ALL' && pc.status !== claimsStatusFilter) return false;
              if (q) {
                const evName =
                  activeBudgets.find((b) => b.id === pc.budget_id)?.event_name ||
                  pc.custom_event_name ||
                  '';
                const hay = `${pc.title} ${pc.requester_name} ${pc.matric_no} ${pc.category} ${evName}`.toLowerCase();
                if (!hay.includes(q)) return false;
              }
              return true;
            });

            return (
              <ErrorBoundary sectionName="Claims & Pre-Claims">
                <section className="bg-white/90 backdrop-blur-xl text-slate-900 rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
                <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
                  <div className="flex flex-wrap items-center gap-3">
                    <div className="flex items-center gap-2">
                      <Receipt className="w-5 h-5 text-emerald-700" />
                      <h2 className="text-base font-extrabold">Claims &amp; Pre-Claims</h2>
                    </div>

                    <div className="inline-flex p-1 rounded-xl bg-slate-100 border border-slate-200 gap-1 text-xs">
                      <button
                        type="button"
                        onClick={() => {
                          setClaimsSubTab('receipts');
                          setClaimsStatusFilter('ALL');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-extrabold cursor-pointer transition ${
                          claimsSubTab === 'receipts'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        Receipt Claims ({visibleClaims.length})
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setClaimsSubTab('preclaims');
                          setClaimsStatusFilter('ALL');
                        }}
                        className={`px-3 py-1.5 rounded-lg font-extrabold inline-flex items-center gap-1 cursor-pointer transition ${
                          claimsSubTab === 'preclaims'
                            ? 'bg-emerald-600 text-white shadow-2xs'
                            : 'text-slate-600 hover:text-slate-900'
                        }`}
                      >
                        <CalendarClock className="w-3.5 h-3.5" />
                        <span>Pre-Claims ({visiblePreClaims.length})</span>
                      </button>
                    </div>
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
                      onClick={() => {
                        setClaimModalInitMode('receipt');
                        setClaimModalPreClaimId(null);
                        setIsClaimModalOpen(true);
                      }}
                      className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                    >
                      <PlusCircle className="w-4 h-4 inline mr-1" />
                      Submit Claim
                    </button>
                  </div>
                </div>

                {/* Compact Filter Pills + Search */}
                <div className="px-5 py-3 bg-slate-50/70 border-b border-slate-200/80 flex flex-wrap items-center justify-between gap-2.5 text-xs">
                  <div className="flex flex-wrap items-center gap-1">
                    {(claimsSubTab === 'receipts' ? receiptStatusPills : preClaimStatusPills).map(
                      (st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => setClaimsStatusFilter(st)}
                          className={`px-2.5 py-1 rounded-lg font-bold text-[11px] cursor-pointer transition ${
                            claimsStatusFilter === st
                              ? 'bg-slate-900 text-white shadow-2xs'
                              : 'bg-white border border-slate-200 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {st === 'ALL' ? 'All' : st}
                        </button>
                      )
                    )}
                  </div>

                  <div className="relative w-full sm:w-60">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      value={claimsSearchQuery}
                      onChange={(e) => setClaimsSearchQuery(e.target.value)}
                      placeholder="Search item, member, dept..."
                      className="w-full rounded-xl border border-slate-200 bg-white pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-emerald-500/30"
                    />
                  </div>
                </div>

                {claimsSubTab === 'receipts' ? (
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
                        {filteredReceiptClaims.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No matching receipt claims found.
                            </td>
                          </tr>
                        ) : (
                          filteredReceiptClaims.map((c) => {
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
                                      <div className="flex items-center gap-1.5 flex-wrap">
                                        <span>{c.title}</span>
                                        {c.pre_claim_id && (
                                          <span className="px-1.5 py-0.2 rounded bg-sky-50 text-sky-800 border border-sky-200 text-[10px] font-bold">
                                            Pre-Claim
                                          </span>
                                        )}
                                      </div>
                                      <span className="text-emerald-700 block font-normal">{c.category}</span>
                                    </div>
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenMemberProfile({
                                        userId: c.user_id,
                                        matricNo: c.matric_no,
                                        name: c.claimant_name,
                                      })
                                    }
                                    className="font-semibold text-emerald-900 hover:text-emerald-700 underline decoration-emerald-300 underline-offset-2 cursor-pointer text-left"
                                    title="View member profile"
                                  >
                                    {c.claimant_name} ({c.matric_no})
                                  </button>
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
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse text-xs">
                      <thead>
                        <tr className="bg-slate-50 border-b">
                          <th className="py-3 px-4">Request &amp; Activity</th>
                          <th className="py-3 px-4">Requester &amp; Needed By</th>
                          <th className="py-3 px-4">Est. / Approved Cap</th>
                          <th className="py-3 px-4">Status &amp; Advance</th>
                          <th className="py-3 px-4 text-right">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {filteredPreClaims.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-8 text-center text-slate-400">
                              No Pre-Claims found. Use &ldquo;Submit Claim → Buying soon? Pre-Claim&rdquo; to request approval before buying.
                            </td>
                          </tr>
                        ) : (
                          filteredPreClaims.map((pc) => {
                            const evName =
                              activeBudgets.find((b) => b.id === pc.budget_id)?.event_name ||
                              pc.custom_event_name ||
                              'General Club Expense';
                            const isMine = pc.user_id === profile.id;
                            const canUploadReceipt =
                              isMine &&
                              (pc.status === 'Pre-Approved' || pc.status === 'Advance Disbursed');
                            const advDisb = Number(pc.advance_disbursed_amount || 0);
                            return (
                              <tr key={pc.id}>
                                <td className="py-3 px-4">
                                  <div className="font-bold text-slate-900">{pc.title}</div>
                                  <div className="text-[11px] text-emerald-700">
                                    {evName} · {pc.category}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <button
                                    type="button"
                                    onClick={() =>
                                      handleOpenMemberProfile({
                                        userId: pc.user_id,
                                        matricNo: pc.matric_no,
                                        name: pc.requester_name,
                                      })
                                    }
                                    className="font-semibold text-emerald-900 hover:text-emerald-700 underline decoration-emerald-300 underline-offset-2 cursor-pointer text-left"
                                  >
                                    {pc.requester_name} ({pc.matric_no})
                                  </button>
                                  <div className="text-[11px] font-mono text-slate-500">
                                    Needed by {pc.needed_date}
                                  </div>
                                </td>
                                <td className="py-3 px-4">
                                  <div className="font-extrabold text-slate-900">
                                    RM {Number(pc.estimated_amount).toFixed(2)}
                                  </div>
                                  {pc.approved_cap !== null && pc.approved_cap !== undefined && (
                                    <div className="text-[11px] font-bold text-emerald-700">
                                      Cap: RM {Number(pc.approved_cap).toFixed(2)}
                                    </div>
                                  )}
                                </td>
                                <td className="py-3 px-4 space-y-1">
                                  <span
                                    className={`inline-block px-2.5 py-0.5 rounded-full font-bold ${
                                      pc.status === 'Pre-Approved' || pc.status === 'Settled'
                                        ? 'bg-emerald-100 text-emerald-800'
                                        : pc.status === 'Advance Disbursed'
                                        ? 'bg-sky-100 text-sky-900'
                                        : pc.status === 'Receipt Submitted'
                                        ? 'bg-indigo-100 text-indigo-900'
                                        : pc.status === 'Rejected' || pc.status === 'Cancelled'
                                        ? 'bg-rose-100 text-rose-700'
                                        : 'bg-amber-100 text-amber-900'
                                    }`}
                                  >
                                    {pc.status === 'Pending' && Number(pc.estimated_amount) > claimThreshold
                                      ? isUserClubOwner(pc.user_id)
                                        ? pc.treasurer_verified_by
                                          ? 'Treasurer Verified'
                                          : 'Awaiting Treasurer'
                                        : pc.treasurer_verified_by
                                        ? 'Stage 2/2: Awaiting Owner'
                                        : 'Stage 1/2: Awaiting Treasurer'
                                      : pc.status}
                                  </span>
                                  {advDisb > 0 ? (
                                    <div className="text-[11px] font-bold text-sky-800">
                                      Adv Disbursed: RM {advDisb.toFixed(2)}
                                    </div>
                                  ) : pc.needs_cash_advance ? (
                                    <div className="text-[11px] font-semibold text-amber-800">
                                      Advance Req: RM {Number(pc.advance_amount || pc.estimated_amount).toFixed(2)}
                                    </div>
                                  ) : null}
                                </td>
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-flex flex-wrap items-center justify-end gap-1.5">
                                    {canUploadReceipt && (
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setClaimModalInitMode('receipt');
                                          setClaimModalPreClaimId(pc.id);
                                          setIsClaimModalOpen(true);
                                        }}
                                        className="px-3 py-1 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer inline-flex items-center gap-1"
                                      >
                                        <Receipt className="w-3.5 h-3.5" />
                                        <span>Upload Receipt →</span>
                                      </button>
                                    )}
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setHistoryTarget({
                                          table: 'pre_claims',
                                          recordId: pc.id,
                                          title: pc.title,
                                        })
                                      }
                                      className="px-2.5 py-1 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 font-bold cursor-pointer inline-flex items-center gap-1"
                                      title="View history"
                                    >
                                      <History className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => setSelectedPreClaim(pc)}
                                      className="px-3 py-1 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold cursor-pointer inline-flex items-center gap-1"
                                    >
                                      <Eye className="w-3.5 h-3.5" />
                                      <span>
                                        {isAdminOrOwner && effectivePermissions.can_manage_claims_fees
                                          ? 'Review'
                                          : 'View'}
                                      </span>
                                    </button>
                                    {((isAdminOrOwner && effectivePermissions.can_manage_claims_fees) ||
                                      (isMine && pc.status === 'Pending')) && (
                                      <button
                                        type="button"
                                        onClick={() =>
                                          setConfirmDialog({
                                            title: 'Remove Pre-Claim from Web?',
                                            message: `"${pc.title}" will be removed from web views while remaining in Supabase.`,
                                            confirmLabel: 'Remove from Web',
                                            danger: true,
                                            onConfirm: async () => {
                                              await softDeleteRecord({
                                                actor: profile,
                                                category: 'Claims',
                                                table: 'pre_claims',
                                                recordId: pc.id,
                                                recordTitle: pc.title,
                                                extraSummary: `Est. RM ${Number(pc.estimated_amount).toFixed(2)}`,
                                              });
                                              refreshClaims();
                                              showToast('Pre-Claim removed from web (kept in Supabase)');
                                            },
                                          })
                                        }
                                        className="p-1.5 rounded-lg text-rose-500 hover:bg-rose-50 cursor-pointer"
                                        title="Remove from web"
                                      >
                                        <Trash2 className="w-3.5 h-3.5" />
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
                )}
                </section>
              </ErrorBoundary>
            );
          })()}

          {activeTab === 'profile' && (
            <ErrorBoundary sectionName="My Profile">
              <div className="text-slate-900">
                <ProfileSection
                  profile={profile}
                  departments={departments}
                  budgets={budgets}
                  myRsvps={rsvps.filter((r) => r.user_id === profile.id)}
                  myFeePayments={feePayments.filter((f) => f.user_id === profile.id)}
                  onUpdated={(u: Partial<UserProfile>, m: string) => {
                    setProfile((p) => (p ? { ...p, ...u } : null));
                    refreshMembersAndSettings();
                    showToast(m);
                  }}
                  onSignOut={handleSignOut}
                />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'ledger' && isAdminOrOwner && (
            <ErrorBoundary sectionName="Club Ledger">
              <div className="text-slate-900">
                <LedgerSection
                  loading={isInitialLoading}
                  entries={activeLedgerEntries}
                events={activeBudgets.map((b) => ({ id: b.id, event_name: b.event_name }))}
                budgets={activeBudgets}
                budgetPlanItems={activeBudgetPlanItems}
                rsvps={activeRsvps}
                claims={activeClaims}
                preClaims={activePreClaims}
                feePayments={activeFeePayments}
                guestRegistrations={activeGuestRegistrations}
                profile={profile}
                logs={activityLogs}
                canEdit={effectivePermissions.can_manage_finance}
                openingBank={openingBankBalance}
                openingCash={openingCashBalance}
                openingDate={openingBalanceDate}
                onSaveOpeningBalance={async ({ bank, cash, date }) => {
                  setOpeningBankBalance(bank);
                  setOpeningCashBalance(cash);
                  setOpeningBalanceDate(date);
                  const { error } = await supabase
                    .from('club_settings')
                    .update({
                      opening_bank_balance: bank,
                      opening_cash_balance: cash,
                      opening_balance_date: date,
                    })
                    .eq('id', 1);
                  if (error) throw error;
                  void logActivity(
                    profile,
                    'Finance',
                    'Updated Starting Club Savings',
                    `${profile.full_name} (${profile.matric_no}) set Starting Savings to Bank RM ${bank.toFixed(2)} + Cash RM ${cash.toFixed(2)} (${date})`
                  );
                  await refreshFinance();
                  showToast(`Starting Savings saved: RM ${(bank + cash).toFixed(2)}`);
                }}
                externalOpenModal={quickAdjustFinanceOpen}
                onCloseExternalModal={() => setQuickAdjustFinanceOpen(false)}
                onSelectClaim={(c: Claim) => setSelectedClaim(c)}
                onOpenMemberProfile={handleOpenMemberProfile}
                onRefresh={(m: string) => {
                  refreshFinance();
                  showToast(m);
                }}
              />
              </div>
            </ErrorBoundary>
          )}

          {activeTab === 'members' && isAdminOrOwner && (
            <ErrorBoundary sectionName="Members & Club Settings">
              <div className="space-y-6 text-slate-900">
              <div className="bg-white/90 backdrop-blur-xl rounded-3xl border border-emerald-100 p-6 space-y-4 shadow-xs">
                <div className="flex flex-wrap justify-between items-center gap-2">
                  <h3 className="text-sm font-extrabold flex items-center gap-2">
                    <Crown className="w-4 h-4 text-amber-500" />
                    <span>Club Settings, DuitNow / Payment QR &amp; Passcodes</span>
                  </h3>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setChatbotTrainerSignal((n) => n + 1)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-bold cursor-pointer"
                    >
                      <Bot className="w-3.5 h-3.5 text-emerald-300" />
                      <span>Train Portal Bot</span>
                    </button>
                    <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-900 border">
                      {isOwner ? 'Owner' : 'Admin'}
                    </span>
                  </div>
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
                        <div className="p-3 rounded-2xl bg-emerald-50/50 border border-emerald-200 space-y-2">
                          <div className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wide">
                            Public Landing Page Showcase
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Club Tagline</label>
                            <input
                              type="text"
                              value={clubTaglineInput}
                              onChange={(e) => setClubTaglineInput(e.target.value)}
                              placeholder="Campus activities, events, and student community..."
                              className="w-full rounded-xl border bg-white px-3 py-1.5"
                            />
                          </div>
                          <div>
                            <label className="block font-bold mb-1">Club About</label>
                            <textarea
                              rows={2}
                              value={clubAboutInput}
                              onChange={(e) => setClubAboutInput(e.target.value)}
                              placeholder="Short club overview displayed in the public portal footer..."
                              className="w-full rounded-xl border bg-white px-3 py-1.5"
                            />
                          </div>
                          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                            <div>
                              <label className="block font-bold mb-1">Instagram URL</label>
                              <input
                                type="url"
                                value={instagramUrlInput}
                                onChange={(e) => setInstagramUrlInput(e.target.value)}
                                placeholder="https://instagram.com/..."
                                className="w-full rounded-xl border bg-white px-3 py-1.5"
                              />
                            </div>
                            <div>
                              <label className="block font-bold mb-1">Contact Email</label>
                              <input
                                type="email"
                                value={contactEmailInput}
                                onChange={(e) => setContactEmailInput(e.target.value)}
                                placeholder="club@utm.my"
                                className="w-full rounded-xl border bg-white px-3 py-1.5"
                              />
                            </div>
                          </div>
                        </div>
                      </>
                    )}
                    {isAdminOrOwner && effectivePermissions.can_manage_public_page && (
                      <div className="p-3 rounded-2xl bg-emerald-50/70 border border-emerald-200 flex flex-col sm:flex-row sm:items-center justify-between gap-2.5">
                        <div className="min-w-0">
                          <div className="text-[11px] font-extrabold text-emerald-950 uppercase tracking-wide flex items-center gap-1.5">
                            <Globe className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                            <span>Visual Landing Page &amp; Footer Builder</span>
                          </div>
                          <p className="text-[11px] text-emerald-800/80 mt-0.5">
                            Customize hero text, section visibility, footer columns, social links (Facebook, Instagram, LinkedIn), and preview live.
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => setShowPublicPageEditor(true)}
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-extrabold whitespace-nowrap shadow-sm transition-colors cursor-pointer"
                        >
                          Open Visual Editor
                        </button>
                      </div>
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

                          const depts = departmentsText
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const updatePayload: Record<string, unknown> = {
                            departments: depts.length ? depts : DEFAULT_DEPARTMENTS,
                            payment_qr_url: finalPayQr,
                            payment_bank_info: paymentBankInfo.trim(),
                          };
                          const parsedThresh = parseFloat(claimThresholdInput);
                          const nextThresh =
                            !isNaN(parsedThresh) && parsedThresh >= 0
                              ? parsedThresh
                              : DEFAULT_CLAIM_APPROVAL_THRESHOLD;
                          if (isOwner) {
                            updatePayload.club_name = clubNameInput.trim() || 'ClubSync';
                            updatePayload.current_batch = newBatchInput.trim();
                            updatePayload.claim_approval_threshold = nextThresh;
                            updatePayload.club_tagline = clubTaglineInput.trim();
                            updatePayload.club_about = clubAboutInput.trim();
                            updatePayload.instagram_url = instagramUrlInput.trim();
                            updatePayload.contact_email = contactEmailInput.trim();
                          }
                          const { error: settingsErr } = await supabase
                            .from('club_settings')
                            .update(updatePayload)
                            .eq('id', 1);
                          if (settingsErr) {
                            showToast(settingsErr.message || 'Could not update settings.');
                            return;
                          }
                          if (isOwner && newAdminPinInput.trim() && newOwnerPinInput.trim()) {
                            const { data: pinRpcRes } = await supabase.rpc('update_club_passcodes', {
                              new_admin_pin: newAdminPinInput.trim(),
                              new_owner_pin: newOwnerPinInput.trim(),
                            });
                            const pinStatus = pinRpcRes as { ok?: boolean; error?: string } | null;
                            if (pinStatus && pinStatus.ok === false) {
                              showToast(pinStatus.error || 'Could not update passcodes.');
                              return;
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
                          ...filteredMembers.map((m) => {
                            const showSens = canViewSensitiveProfiles || m.id === profile.id;
                            return `"${m.full_name}","${m.matric_no}","${showSens ? m.phone_number : 'Restricted'}","${showSens ? m.dormitory : 'Restricted'}","${
                              m.batch_year || currentBatch
                            }","${m.member_type}","${m.role}"`;
                          }),
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
                        const pCount = PERMISSION_LABELS.filter((lbl) =>
                          Boolean(m.admin_permissions?.[lbl.key])
                        ).length;
                        const unreturnedLoans = equipmentLoans.filter((l) => l.user_id === m.id && l.status !== 'Returned');
                        const canSeeMemberContact = canViewSensitiveProfiles || m.id === profile.id;
                        return (
                          <tr key={m.id}>
                            <td className="py-3 px-4">
                              <button
                                type="button"
                                onClick={() => handleOpenMemberDirect(m)}
                                className="font-bold text-emerald-900 hover:text-emerald-700 underline decoration-emerald-300 underline-offset-2 cursor-pointer text-left"
                                title="View member profile"
                              >
                                {m.full_name} ({m.matric_no})
                              </button>
                              <div className="text-[11px] text-slate-400">
                                {m.member_type} • Batch {m.batch_year || currentBatch}
                              </div>
                            </td>
                            <td className="py-3 px-4 font-mono">
                              {canSeeMemberContact ? (
                                `${m.phone_number} • ${m.dormitory || '-'}`
                              ) : (
                                <span className="text-slate-400 font-sans italic">Restricted</span>
                              )}
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
                                  Admin ({pCount}/8)
                                </span>
                              ) : (
                                'Member'
                              )}
                            </td>
                            <td className="py-3 px-4 text-right">
                              <div className="inline-flex flex-wrap items-center justify-end gap-2">
                                <button
                                  type="button"
                                  onClick={() => handleOpenMemberDirect(m)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg font-bold bg-slate-100 hover:bg-emerald-50 text-slate-800 hover:text-emerald-900 border border-slate-200 cursor-pointer"
                                  title="Inspect member profile"
                                >
                                  <Eye className="w-3.5 h-3.5" />
                                  <span>View Profile</span>
                                </button>
                                {isOwner && isThisAdmin && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setPermModalTarget(m);
                                      setEditingPerms({ ...DEFAULT_ADMIN_PERMISSIONS, ...(m.admin_permissions || {}) });
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
                                          refreshMembersAndSettings();
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
                                          refreshMembersAndSettings();
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
            </ErrorBoundary>
          )}

          {activeTab === 'logs' && isAdminOrOwner && (
            <ErrorBoundary sectionName="Activity & Audit Logs">
              <ActivityLogSection
                logs={activityLogs}
                deletedRecords={deletedRecords}
                profile={profile}
                onRefresh={(m: string) => {
                  if (m.toLowerCase().includes('restor')) {
                    fetchAllData();
                  } else {
                    refreshLogs();
                  }
                  showToast(m);
                }}
              />
            </ErrorBoundary>
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
                refreshMembersAndSettings();
                showToast('Permissions updated');
              }}
              className="p-6 space-y-2.5 text-xs max-h-[75vh] overflow-y-auto"
            >
              {PERMISSION_LABELS.map((item) => (
                <label key={item.key} className="flex items-start gap-2.5 p-2.5 rounded-xl border cursor-pointer">
                  <input
                    type="checkbox"
                    checked={Boolean(editingPerms[item.key])}
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
        guestRegistrations={activeGuestRegistrations}
        profile={profile}
        isAdmin={isAdminOrOwner}
        equipmentItems={activeEquipmentItems}
        equipmentLoans={activeEquipmentLoans}
        onSuccess={(m: string) => {
          showToast(m);
          refreshEvents();
          refreshEquipment();
        }}
      />
      <EventOperationsModal
        event={activeOpsEvent}
        initialTab={opsModalTab}
        profile={profile}
        isAdmin={isAdminOrOwner}
        permissions={effectivePermissions}
        rsvps={activeRsvps}
        feePayments={activeFeePayments}
        guestRegistrations={activeGuestRegistrations}
        claims={activeClaims}
        logs={activityLogs}
        paymentQrUrl={paymentQrUrl}
        paymentBankInfo={paymentBankInfo}
        onClose={() => setOpsModalEvent(null)}
        onTabChange={setOpsModalTab}
        onOpenScanner={() => setIsQrScannerOpen(true)}
        onOpenMemberProfile={handleOpenMemberProfile}
        onRefresh={(m: string) => {
          showToast(m);
          refreshEvents();
        }}
      />
      <ClaimFormModal
        isOpen={isClaimModalOpen}
        onClose={() => {
          setIsClaimModalOpen(false);
          setClaimModalPreClaimId(null);
          setClaimModalInitMode('receipt');
        }}
        budgets={activeBudgets}
        departments={departments}
        existingClaims={activeClaims}
        preClaims={activePreClaims}
        initialMode={claimModalInitMode}
        initialPreClaimId={claimModalPreClaimId}
        adminRecipientIds={allMembers
          .filter(
            (u) =>
              u.role === 'owner' ||
              (u.role === 'treasurer' && Boolean(u.admin_permissions?.can_manage_claims_fees))
          )
          .map((u) => u.id)}
        profile={profile}
        onSuccess={(m: string) => {
          showToast(m);
          refreshClaims();
        }}
      />
      <AuditReviewModal
        claim={selectedClaim}
        linkedPreClaim={
          selectedClaim
            ? activePreClaims.find(
                (pc) =>
                  pc.id === selectedClaim.pre_claim_id || pc.linked_claim_id === selectedClaim.id
              ) || null
            : null
        }
        budget={activeBudgets.find((b) => b.id === selectedClaim?.budget_id)}
        budgets={activeBudgets}
        departments={departments}
        logs={activityLogs}
        allClaims={activeClaims}
        claimantProfile={allMembers.find((u) => u.id === selectedClaim?.user_id)}
        onSelectClaim={(c: Claim) => setSelectedClaim(c)}
        profile={{ ...profile, role: isAdminOrOwner && effectivePermissions.can_manage_claims_fees ? (isOwner ? 'owner' : 'treasurer') : 'member' }}
        isOwner={isOwner}
        ownerUserId={ownerUserId}
        isClaimantOwner={isUserClubOwner(selectedClaim?.user_id)}
        approvalThreshold={claimThreshold}
        onClose={() => setSelectedClaim(null)}
        onOpenMemberProfile={handleOpenMemberProfile}
        onUpdated={(m: string) => {
          showToast(m);
          refreshClaims();
        }}
      />
      <PreClaimReviewModal
        preClaim={selectedPreClaim}
        budget={activeBudgets.find((b) => b.id === selectedPreClaim?.budget_id)}
        allClaims={activeClaims}
        requesterProfile={allMembers.find((u) => u.id === selectedPreClaim?.user_id)}
        profile={{
          ...profile,
          role:
            isAdminOrOwner && effectivePermissions.can_manage_claims_fees
              ? isOwner
                ? 'owner'
                : 'treasurer'
              : 'member',
        }}
        isOwner={isOwner}
        canManageClaims={isAdminOrOwner && effectivePermissions.can_manage_claims_fees}
        ownerUserId={ownerUserId}
        isRequesterOwner={isUserClubOwner(selectedPreClaim?.user_id)}
        approvalThreshold={claimThreshold}
        onClose={() => setSelectedPreClaim(null)}
        onOpenMemberProfile={handleOpenMemberProfile}
        onSelectClaim={(c: Claim) => setSelectedClaim(c)}
        onUploadReceipt={(pc: PreClaim) => {
          setClaimModalInitMode('receipt');
          setClaimModalPreClaimId(pc.id);
          setIsClaimModalOpen(true);
        }}
        onUpdated={(m: string) => {
          showToast(m);
          refreshClaims();
        }}
      />
      <PublicLandingEditorModal
        isOpen={showPublicPageEditor}
        onClose={() => setShowPublicPageEditor(false)}
        profile={profile}
        clubName={clubName}
        logoUrl={logoUrl}
        currentBatch={currentBatch}
        initialConfig={publicLandingConfig}
        legacyTagline={clubTaglineInput}
        legacyAbout={clubAboutInput}
        legacyInstagramUrl={instagramUrlInput}
        legacyContactEmail={contactEmailInput}
        onSaved={(nextCfg, legacyUpdates, msg) => {
          setPublicLandingConfig(nextCfg);
          setClubTaglineInput(legacyUpdates.tagline);
          setClubAboutInput(legacyUpdates.about);
          setInstagramUrlInput(legacyUpdates.instagram);
          setContactEmailInput(legacyUpdates.email);
          showToast(msg);
          refreshMembersAndSettings();
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
        onOpenMemberProfile={handleOpenMemberProfile}
        onSuccess={(m: string) => {
          showToast(m);
          refreshEvents();
        }}
      />
      <RecordHistoryModal
        target={historyTarget}
        logs={activityLogs}
        onClose={() => setHistoryTarget(null)}
      />
      <MemberProfileModal
        isOpen={Boolean(profileModalMember)}
        onClose={() => setProfileModalMember(null)}
        member={profileModalMember}
        viewerProfile={profile}
        canViewSensitiveProfiles={canViewSensitiveProfiles}
        isViewerAdmin={profile.role === 'treasurer' || profile.role === 'owner'}
        claims={activeClaims}
        equipmentLoans={activeEquipmentLoans}
        feePayments={activeFeePayments}
        eventRsvps={activeRsvps}
        budgets={activeBudgets}
        onMessageInChat={(targetUid) => {
          setChatDmTargetUserId(targetUid);
          setIsChatOpen(true);
        }}
      />
      <ErrorBoundary sectionName="Club Chat & Portal Bot">
        <FloatingChatDock
          profile={profile}
          departments={departments}
          isOpen={isChatOpen}
          onToggleOpen={setIsChatOpen}
          unreadCount={unreadChatCount}
          onUnreadCountChange={setUnreadChatCount}
          isAdminMode={isAdminOrOwner}
          onOpenMemberProfile={(member) => handleOpenMemberDirect(member)}
          openDmWithUserId={chatDmTargetUserId}
          onClearOpenDmTarget={() => setChatDmTargetUserId(null)}
          onUpdatedPublicReadAt={(iso) =>
            setProfile((prev) => (prev ? { ...prev, public_chat_read_at: iso } : prev))
          }
          chatbotSnapshot={chatbotSnapshot}
          chatbotPermissions={chatbotPermissions}
          faqItems={publicLandingConfig?.faq_items}
          openTrainerSignal={chatbotTrainerSignal}
          onNavigateAction={(action) => {
            if (action === 'new_claim') {
              setClaimModalInitMode('receipt');
              setClaimModalPreClaimId(null);
              setIsClaimModalOpen(true);
            } else if (
              action === 'activities' ||
              action === 'equipment' ||
              action === 'claims' ||
              action === 'profile' ||
              (action === 'ledger' && isAdminOrOwner)
            ) {
              setActiveTab(action);
            }
          }}
        />
      </ErrorBoundary>
      <MobileBottomNav
        activeTab={activeTab}
        onSelectTab={setActiveTab}
        onOpenQrScanner={() => setIsQrScannerOpen(true)}
        pendingClaimsCount={
          isAdminOrOwner
            ? activeClaims.filter((c) => c.status === 'Pending').length +
              activePreClaims.filter((pc) => pc.status === 'Pending').length
            : 0
        }
        darkMode={isDarkCanvas}
      />
      {renderPasswordRecoveryModal()}
    </div>
  );
}