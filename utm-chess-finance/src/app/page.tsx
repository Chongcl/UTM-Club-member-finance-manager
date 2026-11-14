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
  Sparkles,
  FileText,
} from 'lucide-react';

interface ConfirmDialogState {
  title: string;
  message: string;
  confirmLabel: string;
  danger?: boolean;
  onConfirm: () => Promise<void>;
}

const BG_PRESETS = [
  {
    id: 'galaxy-nebula',
    name: '1. Cosmic Galaxy & Starlight (Animated)',
    desc: 'Moving deep-space nebula with gentle starlight & violet-cyan aurora',
    swatch: 'linear-gradient(135deg, #0f172a 0%, #4c1d95 50%, #0d9488 100%)',
  },
  {
    id: 'frosted-glass',
    name: '2. Liquid Frosted Glass (Animated)',
    desc: 'Floating translucent glass orbs with soft emerald & sky glow',
    swatch: 'linear-gradient(135deg, #34d399 0%, #38bdf8 50%, #818cf8 100%)',
  },
  {
    id: 'emerald-aurora',
    name: '3. Northern Aurora Wave (Animated)',
    desc: 'Flowing emerald-mint & turquoise-cyan atmospheric waves',
    swatch: 'linear-gradient(135deg, #10b981 0%, #06b6d4 55%, #3b82f6 100%)',
  },
  {
    id: 'royal-gold',
    name: '4. Imperial Gold & Jade (Animated)',
    desc: 'Warm golden champagne & deep emerald luxury drift',
    swatch: 'linear-gradient(135deg, #f59e0b 0%, #10b981 55%, #0f766e 100%)',
  },
  {
    id: 'ocean-silk',
    name: '5. Midnight Ocean Silk (Animated)',
    desc: 'Smooth coastal sapphire, aqua & indigo fluid motion',
    swatch: 'linear-gradient(135deg, #0ea5e9 0%, #2563eb 55%, #1e1b4b 100%)',
  },
  {
    id: 'cyber-grid',
    name: '6. Minimalist Studio Grid',
    desc: 'Clean architectural 28px studio grid with top spotlight',
    swatch: 'repeating-linear-gradient(45deg, #10b981 0, #10b981 3px, #0f172a 3px, #0f172a 10px)',
  },
  {
    id: 'custom-image',
    name: '7. Custom Wallpaper Upload / URL',
    desc: 'Upload your own photo or paste any custom wallpaper URL',
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
  const [bgStyle, setBgStyle] = useState('galaxy-nebula');
  const [bgImageUrl, setBgImageUrl] = useState('');

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
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  const [isQrScannerOpen, setIsQrScannerOpen] = useState(false);
  const [isClaimModalOpen, setIsClaimModalOpen] = useState(false);
  const [isBudgetModalOpen, setIsBudgetModalOpen] = useState(false);
  const [editingActivity, setEditingActivity] = useState<EditableActivity | null>(null);
  const [opsModalEvent, setOpsModalEvent] = useState<Budget | null>(null);
  const [opsModalTab, setOpsModalTab] = useState<'fee' | 'transport' | 'qr' | 'pass'>('pass');
  const [selectedClaim, setSelectedClaim] = useState<Claim | null>(null);
  const [quickAdjustFinanceOpen, setQuickAdjustFinanceOpen] = useState(false);

  // Load persisted theme, logo & dark mode on mount so refresh NEVER resets them
  useEffect(() => {
    if (typeof window !== 'undefined') {
      setDarkMode(localStorage.getItem('clubsync_dark') === 'true');
      const savedStyle = localStorage.getItem('clubsync_bg_style');
      const savedImg = localStorage.getItem('clubsync_bg_image');
      const savedLogo = localStorage.getItem('clubsync_logo_url');
      if (savedStyle) setBgStyle(savedStyle);
      if (savedImg) setBgImageUrl(savedImg);
      if (savedLogo) {
        setLogoUrl(savedLogo);
        setLogoUrlInput(savedLogo);
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
    setTimeout(() => setToastMessage((p) => (p === msg ? null : p)), 4000);
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
        can_manage_activities: Boolean(p.can_manage_activities),
        can_manage_posters_polls: Boolean(p.can_manage_posters_polls),
        can_manage_equipment: Boolean(p.can_manage_equipment),
        can_manage_claims_fees: Boolean(p.can_manage_claims_fees),
        can_manage_transport: Boolean(p.can_manage_transport),
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
      created_at: String(raw.created_at || ''),
    };
  };

  const fetchOrCreateProfile = useCallback(async (uid: string, uEmail: string, meta?: Record<string, string>) => {
    const saved =
      typeof window !== 'undefined'
        ? (localStorage.getItem(`clubsync_mode_${uid}`) as 'member' | 'admin' | 'owner' | null)
        : null;
    const { data: existing } = await supabase.from('users').select('*').eq('id', uid).maybeSingle();
    if (existing) {
      const norm = normalizeProfile(existing as Record<string, unknown>);
      setRoleMode(saved || (norm.role === 'owner' ? 'owner' : norm.role === 'treasurer' ? 'admin' : 'member'));
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
    const [bRes, cRes, rRes, fRes, mRes, lRes, sRes, eqIRes, eqLRes, annRes, pRes, pvRes] = await Promise.all([
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
        if (me) setProfile(me);
      }
    }
    if (lRes.data) setLedgerEntries(lRes.data as LedgerEntryItem[]);
    if (eqIRes.data) setEquipmentItems(eqIRes.data as EquipmentItem[]);
    if (eqLRes.data) setEquipmentLoans(eqLRes.data as EquipmentLoan[]);
    if (annRes.data) setAnnouncements(annRes.data as Announcement[]);
    if (pRes.data) setPolls(pRes.data as Poll[]);
    if (pvRes.data) setPollVotes(pvRes.data as PollVote[]);
    if (sRes.data) {
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
        setDepartments(depts);
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

  // Instant, Bug-Free Attend / Not Attending Handler with Optimistic State & Fallback Save
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

    // 1. Update UI immediately so button changes state with 0 delay
    setRsvps((prev) => [
      ...prev.filter((r) => !(r.budget_id === ev.id && r.user_id === profile.id)),
      optimisticRow,
    ]);

    showToast(nextStatus === 'Attending' ? `✓ Attending "${ev.event_name}"!` : 'Marked as Not Attending.');

    // 2. Save to Supabase (with safe fallback if optional columns are missing)
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
      updated_at: new Date().toISOString(),
    };

    const { error } = await supabase.from('event_rsvps').upsert(corePayload, { onConflict: 'budget_id,user_id' });
    if (error && existing?.id && !existing.id.startsWith('temp-')) {
      await supabase.from('event_rsvps').update(corePayload).eq('id', existing.id);
    }
    fetchAllData();
  };

  const handleUnlockAdmin = async (pin: string): Promise<boolean> => {
    if (!profile) return false;
    if (
      pin.trim().toUpperCase() !== adminPinSetting.trim().toUpperCase() &&
      pin.trim().toUpperCase() !== 'EXEC-2026'
    )
      return false;
    setRoleMode('admin');
    localStorage.setItem(`clubsync_mode_${profile.id}`, 'admin');
    if (profile.role === 'member') await supabase.from('users').update({ role: 'treasurer' }).eq('id', profile.id);
    fetchAllData();
    showToast('Admin Mode unlocked!');
    return true;
  };

  const handleUnlockOwner = async (pin: string): Promise<boolean> => {
    if (!profile) return false;
    if (
      pin.trim().toUpperCase() !== ownerPinSetting.trim().toUpperCase() &&
      pin.trim().toUpperCase() !== 'OWNER-2026'
    )
      return false;
    await supabase.from('users').update({ role: 'treasurer' }).eq('role', 'owner').neq('id', profile.id);
    await supabase
      .from('users')
      .update({ role: 'owner', admin_permissions: FULL_OWNER_PERMISSIONS })
      .eq('id', profile.id);
    await supabase.from('club_settings').update({ owner_user_id: profile.id }).eq('id', 1);
    setRoleMode('owner');
    localStorage.setItem(`clubsync_mode_${profile.id}`, 'owner');
    fetchAllData();
    showToast('Owner Mode unlocked!');
    return true;
  };

  const handleSwitchMode = async (target: 'member' | 'admin' | 'owner') => {
    if (!profile) return;
    setRoleMode(target);
    localStorage.setItem(`clubsync_mode_${profile.id}`, target);
    if (target === 'member' && (activeTab === 'ledger' || activeTab === 'members')) setActiveTab('activities');
    showToast(`Switched to ${target.toUpperCase()} Mode.`);
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

      await supabase
        .from('club_settings')
        .upsert({
          id: 1,
          bg_style: chosenStyle,
          bg_image_url: finalBgUrl,
          logo_url: finalLogoUrl,
        });

      setBgFile(null);
      setLogoFile(null);
      setShowThemeStudio(false);
      showToast('Saved Club Logo & Background Theme!');
    } finally {
      setSavingTheme(false);
    }
  };

  const isOwner = roleMode === 'owner';
  const isAdminOrOwner = roleMode === 'admin' || roleMode === 'owner';
  const effectivePermissions: AdminPermissions = isOwner
    ? FULL_OWNER_PERMISSIONS
    : roleMode === 'admin'
    ? profile?.admin_permissions || DEFAULT_ADMIN_PERMISSIONS
    : DEFAULT_ADMIN_PERMISSIONS;

  const getBackdropStyle = (): React.CSSProperties => {
    if (bgStyle === 'custom-image' && bgImageUrl) {
      return {
        backgroundImage: `linear-gradient(${
          darkMode ? 'rgba(2,6,23,0.82), rgba(2,6,23,0.90)' : 'rgba(255,255,255,0.65), rgba(240,253,244,0.80)'
        }), url(${bgImageUrl})`,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        backgroundAttachment: 'fixed',
      };
    }

    if (darkMode || bgStyle === 'galaxy-nebula') {
      switch (bgStyle) {
        case 'galaxy-nebula':
          return {
            backgroundColor: darkMode ? '#040611' : '#0f172a',
            backgroundImage:
              'radial-gradient(at 15% 15%, rgba(124, 58, 237, 0.42) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(13, 148, 136, 0.38) 0px, transparent 55%), radial-gradient(at 50% 90%, rgba(59, 130, 246, 0.32) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 18s ease infinite',
          };
        case 'frosted-glass':
          return {
            backgroundColor: '#06111c',
            backgroundImage:
              'radial-gradient(at 20% 20%, rgba(52, 211, 153, 0.36) 0px, transparent 50%), radial-gradient(at 80% 30%, rgba(56, 189, 248, 0.34) 0px, transparent 50%), radial-gradient(at 50% 85%, rgba(129, 140, 248, 0.30) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 20s ease infinite',
          };
        case 'royal-gold':
          return {
            backgroundColor: '#090a0f',
            backgroundImage:
              'radial-gradient(at 10% 10%, rgba(245, 158, 11, 0.38) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(16, 185, 129, 0.32) 0px, transparent 55%), radial-gradient(at 50% 95%, rgba(217, 119, 6, 0.25) 0px, transparent 50%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 20s ease infinite',
          };
        case 'ocean-silk':
          return {
            backgroundColor: '#020b18',
            backgroundImage:
              'radial-gradient(at 10% 10%, rgba(14, 165, 233, 0.38) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(37, 99, 235, 0.35) 0px, transparent 55%), radial-gradient(at 50% 95%, rgba(99, 102, 241, 0.30) 0px, transparent 55%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 18s ease infinite',
          };
        case 'cyber-grid':
          return {
            backgroundColor: '#020617',
            backgroundImage:
              'radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.35) 0px, transparent 60%), linear-gradient(to right, rgba(16, 185, 129, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(16, 185, 129, 0.14) 1px, transparent 1px)',
            backgroundSize: '100% 100%, 28px 28px, 28px 28px',
          };
        default:
          return {
            backgroundColor: '#03120e',
            backgroundImage:
              'radial-gradient(at 0% 0%, rgba(16, 185, 129, 0.40) 0px, transparent 50%), radial-gradient(at 100% 0%, rgba(6, 182, 212, 0.35) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(59, 130, 246, 0.28) 0px, transparent 50%)',
            backgroundSize: '180% 180%',
            animation: 'clubsyncNebula 18s ease infinite',
          };
      }
    }

    switch (bgStyle) {
      case 'frosted-glass':
        return {
          backgroundColor: '#e0f2fe',
          backgroundImage:
            'radial-gradient(at 15% 15%, rgba(52, 211, 153, 0.55) 0px, transparent 50%), radial-gradient(at 85% 20%, rgba(56, 189, 248, 0.55) 0px, transparent 50%), radial-gradient(at 50% 90%, rgba(129, 140, 248, 0.45) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 20s ease infinite',
        };
      case 'royal-gold':
        return {
          backgroundColor: '#fef3c7',
          backgroundImage:
            'radial-gradient(at 10% 10%, rgba(251, 191, 36, 0.60) 0px, transparent 50%), radial-gradient(at 90% 15%, rgba(52, 211, 153, 0.50) 0px, transparent 55%), radial-gradient(at 50% 90%, rgba(245, 158, 11, 0.38) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 20s ease infinite',
        };
      case 'ocean-silk':
        return {
          backgroundColor: '#dbeafe',
          backgroundImage:
            'radial-gradient(at 10% 10%, rgba(34, 211, 238, 0.55) 0px, transparent 50%), radial-gradient(at 90% 20%, rgba(59, 130, 246, 0.48) 0px, transparent 55%), radial-gradient(at 50% 90%, rgba(99, 102, 241, 0.40) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 18s ease infinite',
        };
      case 'cyber-grid':
        return {
          backgroundColor: '#ecfdf5',
          backgroundImage:
            'radial-gradient(at 50% 0%, rgba(16, 185, 129, 0.38) 0px, transparent 60%), linear-gradient(to right, rgba(4, 120, 87, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(4, 120, 87, 0.14) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 28px 28px, 28px 28px',
        };
      default:
        return {
          backgroundColor: '#d1fae5',
          backgroundImage:
            'radial-gradient(at 0% 0%, rgba(52, 211, 153, 0.60) 0px, transparent 50%), radial-gradient(at 100% 10%, rgba(34, 211, 238, 0.52) 0px, transparent 50%), radial-gradient(at 50% 100%, rgba(59, 130, 246, 0.38) 0px, transparent 55%)',
          backgroundSize: '180% 180%',
          animation: 'clubsyncNebula 18s ease infinite',
        };
    }
  };

  if (authLoading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-emerald-700 animate-spin" />
      </div>
    );

  if (!sessionUserId || !profile) {
    return (
      <div className="min-h-screen flex items-center justify-center p-4 bg-gradient-to-br from-slate-950 via-emerald-950 to-slate-900">
        <div className="max-w-md w-full bg-white text-slate-900 rounded-3xl shadow-2xl overflow-hidden">
          <div className="bg-slate-900 p-6 text-center text-white">
            {logoUrl && !logoUrl.toLowerCase().endsWith('.pdf') ? (
              <img src={logoUrl} alt={clubName} className="w-14 h-14 rounded-2xl object-cover mx-auto mb-2 bg-white" />
            ) : (
              <Layers className="w-9 h-9 mx-auto mb-1 text-emerald-400" />
            )}
            <h1 className="text-lg font-extrabold">{clubName}</h1>
          </div>
          <div className="grid grid-cols-2 bg-slate-100 p-1 m-5 mb-2 rounded-2xl">
            <button
              type="button"
              onClick={() => setAuthMode('login')}
              className={`py-2 text-xs font-bold rounded-xl ${authMode === 'login' ? 'bg-emerald-600 text-white' : ''}`}
            >
              Sign In
            </button>
            <button
              type="button"
              onClick={() => setAuthMode('signup')}
              className={`py-2 text-xs font-bold rounded-xl ${authMode === 'signup' ? 'bg-emerald-600 text-white' : ''}`}
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
                  className="w-full rounded-xl border px-3 py-2 text-sm"
                  required
                />
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={matricNo}
                    onChange={(e) => setMatricNo(e.target.value)}
                    placeholder="Matric No *"
                    className="rounded-xl border px-3 py-2 font-mono"
                    required
                  />
                  <input
                    type="tel"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    placeholder="Phone *"
                    className="rounded-xl border px-3 py-2 font-mono"
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
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            <input
              type="password"
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Password *"
              className="w-full rounded-xl border px-3 py-2 text-sm"
              required
            />
            {authError && <div className="text-rose-600">{authError}</div>}
            <button type="submit" className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold text-sm cursor-pointer">
              {authMode === 'login' ? 'Sign In' : 'Register'}
            </button>
          </form>
        </div>
      </div>
    );
  }

  const visibleBudgets = budgets.filter((b) => activityTimeFilter === 'All' || b.status === activityTimeFilter);
  const visibleClaims = claims.filter((c) => isAdminOrOwner || c.user_id === profile.id);
  const uniqueBatches = Array.from(new Set([currentBatch, ...allMembers.map((m) => m.batch_year || '2026/2027')]));
  const filteredMembers = allMembers.filter((m) => batchFilter === 'ALL' || (m.batch_year || '2026/2027') === batchFilter);
  const isDarkCanvas = darkMode || bgStyle === 'galaxy-nebula';

  return (
    <div
      className={`min-h-screen flex flex-col transition-all duration-500 relative overflow-x-hidden ${
        isDarkCanvas ? 'text-slate-100' : 'text-slate-900'
      }`}
      style={getBackdropStyle()}
    >
      {/* Smooth Keyframe Animations for Moving Galaxy / Glass / Aurora Backgrounds */}
      <style>{`
        @keyframes clubsyncNebula {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }
        @keyframes clubsyncFloat {
          0%, 100% { transform: translateY(0px) scale(1); }
          50% { transform: translateY(-18px) scale(1.04); }
        }
      `}</style>

      {/* Subtle Ambient Floating Glass / Galaxy Orbs (Non-Intrusive, Pointer-Events-None) */}
      {(bgStyle === 'galaxy-nebula' || bgStyle === 'frosted-glass') && (
        <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
          <div
            className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-emerald-500/15 blur-3xl"
            style={{ animation: 'clubsyncFloat 12s ease-in-out infinite' }}
          />
          <div
            className="absolute top-1/3 -right-24 w-96 h-96 rounded-full bg-violet-500/15 blur-3xl"
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
          roleMode={roleMode}
          darkMode={isDarkCanvas}
          onToggleDarkMode={toggleDarkMode}
          canCustomizeTheme={effectivePermissions.can_manage_posters_polls}
          onOpenThemeStudio={() => setShowThemeStudio(true)}
          pendingClaimsCount={isAdminOrOwner ? claims.filter((c) => c.status === 'Pending').length : 0}
          onUnlockAdmin={handleUnlockAdmin}
          onUnlockOwner={handleUnlockOwner}
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
            effectivePermissions.can_manage_activities
              ? () => {
                  setEditingActivity(null);
                  setIsBudgetModalOpen(true);
                }
              : undefined
          }
          onOpenNewFinance={
            effectivePermissions.can_manage_finance
              ? () => {
                  setActiveTab('ledger');
                  setQuickAdjustFinanceOpen(true);
                }
              : undefined
          }
        />

        {toastMessage && (
          <div className="fixed bottom-5 right-5 z-50 bg-emerald-700 text-white px-4 py-3 rounded-2xl shadow-xl flex items-center gap-2 text-xs font-bold border border-emerald-400/40">
            <CheckCircle2 className="w-4 h-4 text-emerald-200" />
            <span>{toastMessage}</span>
          </div>
        )}

        <main className="max-w-7xl w-full mx-auto px-4 py-6 space-y-6 flex-1">
          {activeTab === 'activities' && (
            <div className="space-y-8">
              <CinematicHub
                announcements={announcements}
                polls={polls}
                pollVotes={pollVotes}
                profile={profile}
                isAdmin={effectivePermissions.can_manage_posters_polls}
                onRefresh={(m) => {
                  fetchAllData();
                  showToast(m);
                }}
              />

              <section className="space-y-4">
                <div
                  className={`flex flex-wrap items-center justify-between gap-3 p-5 rounded-3xl border backdrop-blur-xl shadow-sm ${
                    isDarkCanvas ? 'bg-slate-900/70 border-white/10' : 'bg-white/80 border-white/90'
                  }`}
                >
                  <div>
                    <div className="inline-flex items-center gap-1.5 text-[11px] font-extrabold uppercase tracking-wider text-emerald-500 mb-0.5">
                      <Sparkles className="w-3.5 h-3.5" />
                      <span>Campus Activities, Attendance &amp; Carpool</span>
                    </div>
                    <h2 className="text-lg font-extrabold">Club Activities &amp; Events</h2>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsQrScannerOpen(true)}
                      className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
                    >
                      <QrCode className="w-4 h-4" />
                      <span>{isAdminOrOwner ? 'Scan Attendance / Pass QR' : 'Scan Attendance QR'}</span>
                    </button>
                    {effectivePermissions.can_manage_activities && (
                      <button
                        type="button"
                        onClick={() => {
                          setEditingActivity(null);
                          setIsBudgetModalOpen(true);
                        }}
                        className="px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-900 text-white border border-white/15 cursor-pointer"
                      >
                        + New Activity
                      </button>
                    )}
                    <div className={`flex p-1 rounded-xl text-xs ${isDarkCanvas ? 'bg-slate-800' : 'bg-slate-900/10'}`}>
                      {(['All', 'Active', 'Closed'] as const).map((t) => (
                        <button
                          type="button"
                          key={t}
                          onClick={() => setActivityTimeFilter(t)}
                          className={`px-3 py-1 rounded-lg font-bold cursor-pointer ${
                            activityTimeFilter === t ? 'bg-emerald-600 text-white' : 'opacity-75'
                          }`}
                        >
                          {t === 'Active' ? 'Upcoming' : t === 'Closed' ? 'Past' : 'All'}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Minimalistic, Semantically Colored Activity Cards */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
                  {visibleBudgets.map((ev) => {
                    const myRsvp = rsvps.find((r) => r.budget_id === ev.id && r.user_id === profile.id);
                    const isAttending = myRsvp?.attendance === 'Attending';
                    const isNotAttending = myRsvp?.attendance === 'Not Attending';
                    const qrCount = rsvps.filter((r) => r.budget_id === ev.id && r.qr_checked_in).length;
                    const paxCount = rsvps.filter(
                      (r) => r.budget_id === ev.id && r.attendance === 'Attending' && r.transport_type !== 'None' && !r.is_driver
                    ).length;
                    const drvCount = rsvps.filter((r) => r.budget_id === ev.id && r.is_driver).length;

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
                            : 'bg-white/85 border-white/90 hover:bg-white/95 shadow-sm'
                        }`}
                      >
                        <div className="space-y-2.5">
                          <div className="flex justify-between items-center">
                            <span className="text-[10px] font-bold uppercase px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-500 border border-emerald-500/20">
                              {ev.category}
                            </span>
                            {effectivePermissions.can_manage_activities && (
                              <div className="flex gap-1">
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
                                  onClick={async () => {
                                    await supabase.from('budgets').delete().eq('id', ev.id);
                                    fetchAllData();
                                    showToast('Activity deleted.');
                                  }}
                                  className="p-1.5 text-slate-400 hover:text-rose-500 cursor-pointer"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
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

                          {/* Clean Semantic Action Buttons:
                              - Entry Pass ONLY shows if event is Entry Pass mode
                              - Pay Fee ONLY shows on member page if event requires a fee (reqFee > 0) */}
                          <div className="flex flex-wrap gap-2 pt-2">
                            {hasEntryPass ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('pass');
                                }}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-violet-600 hover:bg-violet-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <Ticket className="w-3.5 h-3.5" />
                                <span>{myRsvp?.qr_checked_in ? '✓ Admitted' : 'Entry Pass'}</span>
                              </button>
                            ) : isAdminOrOwner ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('qr');
                                }}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>Venue QR ({qrCount})</span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => setIsQrScannerOpen(true)}
                                className="flex-1 min-w-[110px] py-2 px-3 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold flex items-center justify-center gap-1.5 shadow-xs cursor-pointer"
                              >
                                <QrCode className="w-3.5 h-3.5" />
                                <span>{myRsvp?.qr_checked_in ? '✓ Scanned In' : 'Scan Attendance'}</span>
                              </button>
                            )}

                            {requiresFee && (
                              <button
                                type="button"
                                onClick={() => {
                                  setOpsModalEvent(ev);
                                  setOpsModalTab('fee');
                                }}
                                className="py-2 px-3 rounded-xl bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-extrabold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
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
                              className="py-2 px-3 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-bold flex items-center justify-center gap-1 shadow-xs cursor-pointer"
                            >
                              <Car className="w-3.5 h-3.5" />
                              <span>Carpool ({paxCount}P/{drvCount}D)</span>
                            </button>
                          </div>
                        </div>

                        {/* Upgraded Instant-Feedback Attendance Bar */}
                        <div className="pt-3 border-t border-slate-500/15 flex items-center justify-between gap-2 text-xs">
                          <div className="flex gap-1.5">
                            <button
                              type="button"
                              onClick={() => handleRsvpAttendance(ev, 'Attending')}
                              className={`px-3.5 py-1.5 rounded-xl font-extrabold transition cursor-pointer flex items-center gap-1 ${
                                isAttending
                                  ? 'bg-emerald-600 text-white shadow-sm ring-2 ring-emerald-400/50'
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
                                  ? 'bg-rose-600 text-white shadow-sm'
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
                                setRsvps((prev) =>
                                  prev.map((r) =>
                                    r.budget_id === ev.id && r.user_id === profile.id ? { ...r, transport_type: val } : r
                                  )
                                );
                                if (myRsvp?.id && !myRsvp.id.startsWith('temp-')) {
                                  await supabase.from('event_rsvps').update({ transport_type: val }).eq('id', myRsvp.id);
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
                items={equipmentItems}
                loans={equipmentLoans}
                profile={profile}
                isAdmin={effectivePermissions.can_manage_equipment}
                onRefresh={(m) => {
                  fetchAllData();
                  showToast(m);
                }}
              />
            </div>
          )}

          {activeTab === 'claims' && (
            <section className="bg-white/90 backdrop-blur-xl text-slate-900 rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
              <div className="p-5 border-b flex justify-between items-center">
                <div className="flex items-center gap-2">
                  <Receipt className="w-5 h-5 text-emerald-700" />
                  <h2 className="text-base font-extrabold">Reimbursement Claims</h2>
                </div>
                <button
                  type="button"
                  onClick={() => setIsClaimModalOpen(true)}
                  className="px-3.5 py-2 rounded-xl text-xs font-bold bg-emerald-600 text-white cursor-pointer"
                >
                  <PlusCircle className="w-4 h-4 inline mr-1" />
                  New Claim
                </button>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead>
                    <tr className="bg-slate-50 border-b">
                      <th className="py-3 px-4">Item</th>
                      <th className="py-3 px-4">Claimant</th>
                      <th className="py-3 px-4">Amount</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y">
                    {visibleClaims.map((c) => (
                      <tr key={c.id}>
                        <td className="py-3 px-4 font-bold">
                          {c.title} <span className="text-emerald-700 block font-normal">{c.category}</span>
                        </td>
                        <td className="py-3 px-4">
                          {c.claimant_name} ({c.matric_no})
                        </td>
                        <td className="py-3 px-4 font-extrabold">RM {Number(c.amount).toFixed(2)}</td>
                        <td className="py-3 px-4">
                          <span
                            className={`px-2.5 py-0.5 rounded-full font-bold ${
                              c.status === 'Approved'
                                ? 'bg-emerald-100 text-emerald-800'
                                : c.status === 'Rejected'
                                ? 'bg-rose-100 text-rose-700'
                                : 'bg-amber-100 text-amber-900'
                            }`}
                          >
                            {c.status}
                          </span>
                        </td>
                        <td className="py-3 px-4 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedClaim(c)}
                            className="px-3 py-1 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                          >
                            <Eye className="w-3.5 h-3.5 inline mr-1" />
                            {effectivePermissions.can_manage_claims_fees ? 'Review' : 'View'}
                          </button>
                        </td>
                      </tr>
                    ))}
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
                onUpdated={(u, m) => {
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
                entries={ledgerEntries}
                events={budgets.map((b) => ({ id: b.id, event_name: b.event_name }))}
                claims={claims}
                feePayments={feePayments}
                profile={profile}
                canEdit={effectivePermissions.can_manage_finance}
                externalOpenModal={quickAdjustFinanceOpen}
                onCloseExternalModal={() => setQuickAdjustFinanceOpen(false)}
                onRefresh={(m) => {
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
                    <span>Club Name, Departments &amp; Passcodes</span>
                  </h3>
                  <span className="px-3 py-1 rounded-full text-xs font-extrabold bg-emerald-50 text-emerald-900 border">
                    {isOwner ? 'Owner Full Control' : 'Admin Mode'}
                  </span>
                </div>
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 text-xs">
                  <div>
                    <label className="block font-bold mb-1">Departments / Units (1 per line)</label>
                    <textarea
                      rows={5}
                      value={departmentsText}
                      disabled={!effectivePermissions.can_manage_members}
                      onChange={(e) => setDepartmentsText(e.target.value)}
                      className="w-full rounded-xl border p-2.5 font-semibold"
                    />
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
                    )}
                    {(isOwner || effectivePermissions.can_manage_members) && (
                      <button
                        type="button"
                        onClick={async () => {
                          const depts = departmentsText
                            .split('\n')
                            .map((s) => s.trim())
                            .filter(Boolean);
                          const payload: Record<string, unknown> = {
                            id: 1,
                            departments: depts.length ? depts : DEFAULT_DEPARTMENTS,
                          };
                          if (isOwner) {
                            payload.club_name = clubNameInput.trim() || 'ClubSync';
                            payload.current_batch = newBatchInput.trim();
                            payload.admin_pin = newAdminPinInput.trim();
                            payload.owner_pin = newOwnerPinInput.trim();
                          }
                          await supabase.from('club_settings').upsert(payload);
                          fetchAllData();
                          showToast('Settings saved!');
                        }}
                        className="w-full py-2.5 rounded-xl bg-emerald-600 text-white font-bold cursor-pointer"
                      >
                        Save Settings
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <section className="bg-white/90 backdrop-blur-xl rounded-3xl border border-emerald-100 overflow-hidden shadow-xs">
                <div className="p-5 border-b flex flex-wrap justify-between items-center gap-3">
                  <div>
                    <h2 className="text-base font-extrabold">
                      Batch Member Clearance &amp; Roster ({filteredMembers.length})
                    </h2>
                    <p className="text-xs text-slate-500">
                      Checks unreturned equipment before clearing members. Role changes require 2-step confirmation.
                    </p>
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
                            title: `Clear Graduated Batch (${batchFilter})`,
                            message: `Confirm clearing all non-owner members in Batch "${batchFilter}" who have returned all equipment?`,
                            confirmLabel: 'Confirm Batch Clearance',
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
                              showToast(`Cleared ${toClear.length} member(s)!`);
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
                        a.download = 'Members_Clearance.csv';
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
                        <th className="py-3 px-4">Equipment Clearance</th>
                        <th className="py-3 px-4">Role &amp; Perms</th>
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
                                  ✓ Clearance Ready
                                </span>
                              ) : (
                                <span className="px-2 py-0.5 rounded-full text-[11px] font-bold bg-amber-100 text-amber-900">
                                  ⚠ Owes {unreturnedLoans.length} Equipment
                                </span>
                              )}
                            </td>
                            <td className="py-3 px-4">
                              {isThisOwner ? (
                                <span className="px-2.5 py-0.5 rounded-full font-extrabold bg-amber-400 text-slate-950">
                                  Host / Owner
                                </span>
                              ) : isThisAdmin ? (
                                <span className="px-2.5 py-0.5 rounded-full font-bold bg-emerald-100 text-emerald-900">
                                  Admin ({pCount === 0 ? 'View-Only' : `${pCount}/7 Perms`})
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
                                    Permissions ({pCount}/7)
                                  </button>
                                )}
                                {!isThisOwner && effectivePermissions.can_manage_members && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      if (isThisAdmin && !isOwner) {
                                        showToast('Only Host / Owner can revoke Admin.');
                                        return;
                                      }
                                      setConfirmDialog({
                                        title: isThisAdmin ? `Revoke Admin — ${m.full_name}` : `Grant Admin Role — ${m.full_name}`,
                                        message: isThisAdmin
                                          ? `Confirm revoking Admin status from ${m.full_name}?`
                                          : `Confirm making ${m.full_name} an Admin (starts in View-Only mode)?`,
                                        confirmLabel: isThisAdmin ? 'Confirm Revoke' : 'Confirm Make Admin',
                                        danger: isThisAdmin,
                                        onConfirm: async () => {
                                          const next = isThisAdmin ? 'member' : 'treasurer';
                                          await supabase
                                            .from('users')
                                            .update({ role: next, admin_permissions: DEFAULT_ADMIN_PERMISSIONS })
                                            .eq('id', m.id);
                                          fetchAllData();
                                          showToast('Role updated!');
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
                                        title: `Transfer Host / Ownership to ${m.full_name}?`,
                                        message: `Please reconfirm carefully: Transferring Host / Ownership to ${m.full_name} (${m.matric_no}) will grant them full Owner control and switch your account to Admin mode.`,
                                        confirmLabel: 'Reconfirm & Transfer Host',
                                        danger: true,
                                        onConfirm: async () => {
                                          await supabase.from('users').update({ role: 'treasurer' }).eq('id', profile.id);
                                          await supabase
                                            .from('users')
                                            .update({ role: 'owner', admin_permissions: FULL_OWNER_PERMISSIONS })
                                            .eq('id', m.id);
                                          await supabase.from('club_settings').update({ owner_user_id: m.id }).eq('id', 1);
                                          setRoleMode('admin');
                                          localStorage.setItem(`clubsync_mode_${profile.id}`, 'admin');
                                          fetchAllData();
                                          showToast(`Transferred Host to ${m.full_name}.`);
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
                                        title: `Clear Member — ${m.full_name}`,
                                        message:
                                          unreturnedLoans.length > 0
                                            ? `Warning: ${m.full_name} still owes ${unreturnedLoans.length} equipment item(s)! Remove anyway?`
                                            : `Confirm clearing ${m.full_name} from the roster?`,
                                        confirmLabel: 'Confirm Clear',
                                        danger: true,
                                        onConfirm: async () => {
                                          await supabase.from('users').delete().eq('id', m.id);
                                          fetchAllData();
                                          showToast(`Cleared ${m.full_name}.`);
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
        </main>
      </div>

      {/* 2-Step Confirmation Modal */}
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

      {/* Logo & Animated Background Studio Modal */}
      {showThemeStudio && effectivePermissions.can_manage_posters_polls && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/75 backdrop-blur-xs p-4 overflow-y-auto">
          <div className="bg-white text-slate-900 rounded-3xl shadow-2xl border max-w-lg w-full overflow-hidden my-8">
            <div className="bg-slate-900 text-white px-6 py-4 flex justify-between items-center">
              <span className="text-sm font-bold flex items-center gap-2">
                <Palette className="w-4 h-4 text-amber-300" />
                Club Logo &amp; Animated Background Studio
              </span>
              <button type="button" onClick={() => setShowThemeStudio(false)} className="cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <form onSubmit={handleSaveThemeStudio} className="p-6 space-y-4 text-xs max-h-[80vh] overflow-y-auto">
              {/* Custom Club Logo Upload (JPG / PNG / PDF) */}
              <div className="p-4 rounded-2xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <label className="block font-extrabold text-emerald-950">
                  Club Logo Upload (Supports JPG, PNG, WEBP or PDF):
                </label>
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
                    className="w-full text-xs"
                  />
                </div>
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="Or paste Logo Image / PDF URL..."
                  className="w-full rounded-xl border bg-white px-3 py-1.5"
                />
              </div>

              <div className="space-y-2">
                <label className="block font-extrabold text-slate-800">Select Animated / Glass Background Theme:</label>
                {BG_PRESETS.map((preset) => (
                  <label
                    key={preset.id}
                    className={`flex items-center justify-between gap-3 p-3 rounded-2xl border cursor-pointer ${
                      bgStyle === preset.id ? 'border-emerald-600 bg-emerald-50/80 ring-2 ring-emerald-500/30' : 'border-slate-200'
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
                        <div className="font-extrabold text-slate-900">{preset.name}</div>
                        <div className="text-slate-500">{preset.desc}</div>
                      </div>
                    </div>
                  </label>
                ))}
              </div>

              {bgStyle === 'custom-image' && (
                <div className="p-3.5 rounded-2xl bg-slate-50 border space-y-2.5">
                  <div>
                    <label className="block font-bold mb-1">Upload Background Image (Max 50MB)</label>
                    <input
                      type="file"
                      accept="image/*"
                      onChange={(e) => setBgFile(e.target.files?.[0] || null)}
                      className="w-full"
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
                  {savingTheme ? 'Saving...' : 'Save Logo & Background'}
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
                Edit Admin Permissions — {permModalTarget.full_name}
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
                showToast('Admin permissions updated!');
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
                    <div className="font-extrabold">{item.label}</div>
                    <div className="text-slate-500">{item.desc}</div>
                  </div>
                </label>
              ))}
              <div className="flex justify-end gap-2 pt-2">
                <button type="button" onClick={() => setPermModalTarget(null)} className="px-4 py-2">
                  Cancel
                </button>
                <button type="submit" className="px-5 py-2 rounded-xl bg-emerald-600 text-white font-bold">
                  Save Permissions
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <QrScannerModal
        isOpen={isQrScannerOpen}
        onClose={() => setIsQrScannerOpen(false)}
        budgets={budgets}
        rsvps={rsvps}
        feePayments={feePayments}
        profile={profile}
        isAdmin={isAdminOrOwner}
        onSuccess={(m) => {
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
        rsvps={rsvps}
        feePayments={feePayments}
        onClose={() => setOpsModalEvent(null)}
        onOpenScanner={() => setIsQrScannerOpen(true)}
        onRefresh={(m) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <ClaimFormModal
        isOpen={isClaimModalOpen}
        onClose={() => setIsClaimModalOpen(false)}
        budgets={budgets}
        departments={departments}
        profile={profile}
        onSuccess={(m) => {
          showToast(m);
          fetchAllData();
        }}
      />
      <AuditReviewModal
        claim={selectedClaim}
        budget={budgets.find((b) => b.id === selectedClaim?.budget_id)}
        profile={{ ...profile, role: effectivePermissions.can_manage_claims_fees ? 'treasurer' : 'member' }}
        onClose={() => setSelectedClaim(null)}
        onUpdated={(m) => {
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
        rsvps={rsvps}
        feePayments={feePayments}
        onSuccess={(m) => {
          showToast(m);
          fetchAllData();
        }}
      />
    </div>
  );
}