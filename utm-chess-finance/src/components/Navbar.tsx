'use client';

import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { UserProfile } from '@/lib/supabase';
import ModalShell from './ui/ModalShell';
import {
  Menu,
  X,
  Calendar,
  Receipt,
  UserCheck,
  Wallet,
  Users,
  Plus,
  ChevronDown,
  Lock,
  Unlock,
  KeyRound,
  LogOut,
  Layers,
  Loader2,
  Package,
  QrCode,
  Crown,
  Moon,
  Sun,
  Palette,
  FileText,
  ShieldCheck,
  Globe,
  Download,
} from 'lucide-react';

export type NavTab = 'activities' | 'equipment' | 'claims' | 'profile' | 'ledger' | 'members' | 'logs';

const SECTION_LABELS: Record<NavTab, string> = {
  activities: 'Activities',
  equipment: 'Equipment',
  claims: 'Claims',
  ledger: 'Finance Ledger',
  members: 'Members',
  logs: 'Activity Logs',
  profile: 'Profile',
};

interface NavbarProps {
  profile: UserProfile;
  clubName: string;
  logoUrl?: string;
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  currentBatch?: string;
  roleMode: 'member' | 'admin' | 'owner';
  pendingClaimsCount?: number;
  notificationBell?: React.ReactNode;
  darkMode?: boolean;
  onToggleDarkMode?: () => void;
  canCustomizeTheme?: boolean;
  onOpenThemeStudio?: () => void;
  canManagePublicPage?: boolean;
  onOpenPublicPageEditor?: () => void;
  onUnlockAdmin: (pin: string) => Promise<boolean>;
  onSwitchMode: (target: 'member' | 'admin' | 'owner') => Promise<void>;
  onSignOut: () => Promise<void>;
  onOpenNewClaim: () => void;
  onOpenQrScanner: () => void;
  onOpenNewActivity?: () => void;
  onOpenNewFinance?: () => void;
  switchingRole?: boolean;
}

export default function Navbar({
  profile,
  clubName,
  logoUrl = '',
  activeTab,
  onSelectTab,
  currentBatch = '2026/2027',
  roleMode,
  pendingClaimsCount = 0,
  notificationBell,
  darkMode = false,
  onToggleDarkMode,
  canCustomizeTheme = false,
  onOpenThemeStudio,
  canManagePublicPage = false,
  onOpenPublicPageEditor,
  onUnlockAdmin,
  onSwitchMode,
  onSignOut,
  onOpenNewClaim,
  onOpenQrScanner,
  onOpenNewActivity,
  onOpenNewFinance,
  switchingRole = false,
}: NavbarProps) {
  const isAdminOrOwner = roleMode === 'admin' || roleMode === 'owner';
  const isOwner = roleMode === 'owner';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerVisible, setDrawerVisible] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [returningHome, setReturningHome] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const accountMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(display-mode: standalone)').matches) {
      setIsStandalone(true);
      return;
    }
    const handler = (e: Event) => {
      e.preventDefault();
      setInstallPromptEvent(
        e as unknown as {
          prompt: () => Promise<void>;
          userChoice: Promise<{ outcome: string }>;
        }
      );
    };
    window.addEventListener('beforeinstallprompt', handler);
    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  useEffect(() => {
    if (!accountMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [accountMenuOpen]);

  useEffect(() => {
    if (!drawerOpen) {
      setDrawerVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setDrawerVisible(true));
    return () => cancelAnimationFrame(raf);
  }, [drawerOpen]);

  useEffect(() => {
    if (typeof document === 'undefined' || !drawerOpen) return;
    const prevBodyOverflow = document.body.style.overflow;
    const prevBodyPaddingRight = document.body.style.paddingRight;
    const prevBodyTouchAction = document.body.style.touchAction;
    const prevHtmlOverflow = document.documentElement.style.overflow;

    const scrollbarGap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    document.body.style.touchAction = 'none';
    document.documentElement.style.overflow = 'hidden';
    if (scrollbarGap > 0) {
      document.body.style.paddingRight = `${scrollbarGap}px`;
    }

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setDrawerOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      window.removeEventListener('keydown', onKeyDown);
      document.body.style.overflow = prevBodyOverflow;
      document.body.style.paddingRight = prevBodyPaddingRight;
      document.body.style.touchAction = prevBodyTouchAction;
      document.documentElement.style.overflow = prevHtmlOverflow;
    };
  }, [drawerOpen]);

  const handleInstallPwa = async () => {
    if (!installPromptEvent) return;
    try {
      await installPromptEvent.prompt();
      const choice = await installPromptEvent.userChoice;
      if (choice?.outcome === 'accepted') {
        setInstallPromptEvent(null);
      }
    } catch {
      /* ignore prompt dismissal */
    }
  };

  const handleNav = (tab: NavTab) => {
    if (tab === 'activities' && activeTab !== 'activities') {
      setReturningHome(true);
      setTimeout(() => setReturningHome(false), 700);
    }
    onSelectTab(tab);
    setDrawerOpen(false);
    setAccountMenuOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const ok = await onUnlockAdmin(pinInput);
    if (ok) {
      setPinInput('');
      setPinModalOpen(false);
      setDrawerOpen(false);
    } else {
      setPinError('Invalid Passcode.');
    }
  };

  const initials = (profile.full_name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const renderLogo = () => {
    if (!logoUrl) {
      return (
        <div className="w-9 h-9 rounded-xl bg-emerald-600 flex items-center justify-center text-white shadow-xs shrink-0">
          <Layers className="w-4 h-4" />
        </div>
      );
    }
    if (logoUrl.toLowerCase().endsWith('.pdf')) {
      return (
        <a
          href={logoUrl}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          className="w-9 h-9 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-xs shrink-0"
          title="Open Official Club Logo PDF"
        >
          <FileText className="w-4 h-4" />
        </a>
      );
    }
    return (
      <img
        src={logoUrl}
        alt={clubName}
        className="w-9 h-9 rounded-xl object-cover border border-slate-200 dark:border-white/15 shadow-xs shrink-0 bg-white"
      />
    );
  };

  return (
    <>
      <header
        className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-colors ${
          darkMode
            ? 'bg-slate-950/85 border-white/10 text-white'
            : 'bg-white/85 border-slate-200/80 text-slate-900'
        }`}
      >
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Hamburger Drawer Trigger + Brand + Subtle Batch / Active Section Pill */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={`p-2 rounded-xl border transition cursor-pointer shrink-0 ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  : 'bg-slate-100 text-slate-700 border-slate-200/80 hover:bg-slate-200/70'
              }`}
              aria-label="Open navigation menu"
            >
              <Menu className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => handleNav('activities')}
              title="Return to Main Homepage"
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer text-left group min-w-0"
            >
              {renderLogo()}
              <div className="flex items-center gap-2 min-w-0">
                <span className="text-sm sm:text-[15px] font-bold tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate max-w-[104px] sm:max-w-[200px]">
                  {clubName || 'ClubSync'}
                </span>
                {returningHome && (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-emerald-500 shrink-0" />
                )}
                <span
                  className={`hidden sm:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border tabular-nums shrink-0 ${
                    darkMode
                      ? 'bg-white/5 border-white/10 text-slate-300'
                      : 'bg-slate-100 text-slate-600 border-slate-200'
                  }`}
                >
                  {currentBatch}
                </span>
                <span
                  className={`hidden md:inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-semibold border shrink-0 ${
                    darkMode
                      ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-300'
                      : 'bg-emerald-50 text-emerald-700 border-emerald-200/80'
                  }`}
                >
                  {SECTION_LABELS[activeTab]}
                </span>
              </div>
            </button>
          </div>

          {/* Right: Clean Utility & Account Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {canCustomizeTheme && onOpenThemeStudio && (
              <button
                type="button"
                onClick={onOpenThemeStudio}
                className={`inline-flex items-center gap-1.5 px-2 sm:px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Customize Logo & Background"
                aria-label="Open Theme Studio"
              >
                <Palette className="w-4 h-4 sm:w-3.5 sm:h-3.5 text-amber-500" />
                <span className="hidden sm:inline">Theme</span>
              </button>
            )}

            {onToggleDarkMode && (
              <button
                type="button"
                onClick={onToggleDarkMode}
                className={`p-2 rounded-xl border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 text-amber-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                }`}
                title="Toggle Dark / Light Mode"
                aria-label="Toggle dark mode"
              >
                {darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
              </button>
            )}

            {notificationBell}

            <button
              type="button"
              onClick={onOpenNewClaim}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
              title="Submit Claim"
              aria-label="Submit Claim"
            >
              <Plus className="w-4 h-4" />
              <span className="hidden sm:inline">Submit Claim</span>
            </button>

            {/* Account / Profile & Sign Out Popover */}
            <div className="relative" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => setAccountMenuOpen((v) => !v)}
                className={`inline-flex items-center gap-1.5 sm:gap-2 pl-1.5 pr-2 sm:pr-2.5 py-1 rounded-xl border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-100'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
                aria-label="Account and sign out menu"
                aria-expanded={accountMenuOpen}
              >
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span
                  className={`hidden sm:inline-block px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
                    isOwner
                      ? 'bg-amber-400 text-slate-950'
                      : isAdminOrOwner
                      ? 'bg-emerald-600 text-white'
                      : darkMode
                      ? 'bg-white/10 text-slate-300'
                      : 'bg-slate-100 text-slate-600'
                  }`}
                >
                  {isOwner ? 'Owner' : isAdminOrOwner ? 'Admin' : 'Member'}
                </span>
                <ChevronDown className="w-3.5 h-3.5 text-slate-400" />
              </button>

              {accountMenuOpen && (
                <div
                  className={`absolute right-0 mt-2 w-60 rounded-2xl border shadow-xl p-2 z-40 animate-[modalScaleIn_130ms_ease-out] space-y-1.5 ${
                    darkMode
                      ? 'bg-slate-900 border-white/10 text-slate-100'
                      : 'bg-white border-slate-200 text-slate-900'
                  }`}
                >
                  <div
                    className={`px-3 py-2.5 rounded-xl border text-xs ${
                      darkMode ? 'bg-white/5 border-white/10' : 'bg-slate-50 border-slate-200/70'
                    }`}
                  >
                    <div className="font-bold truncate">{profile.full_name}</div>
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5 tabular-nums">
                      {profile.matric_no}
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleNav('profile')}
                    className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                      activeTab === 'profile'
                        ? 'bg-emerald-600 text-white'
                        : darkMode
                        ? 'hover:bg-white/5'
                        : 'hover:bg-slate-50'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>My Profile</span>
                  </button>

                  <div className="pt-1 border-t border-slate-200/70 dark:border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        void onSignOut();
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-rose-600 dark:text-rose-400 hover:bg-rose-500/10 cursor-pointer"
                    >
                      <LogOut className="w-3.5 h-3.5 shrink-0" />
                      <span>Sign Out</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </header>

      {/* Slide-Over Navigation & Workspace Drawer (Desktop & Mobile) */}
      {drawerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div
              onClick={() => setDrawerOpen(false)}
              className={`fixed inset-0 bg-slate-950/60 backdrop-blur-xs touch-none transition-opacity duration-200 ${
                drawerVisible ? 'opacity-100' : 'opacity-0'
              }`}
            />
            <aside
              className={`relative z-10 w-80 max-w-[86vw] h-[100dvh] max-h-[100dvh] shadow-2xl flex flex-col overflow-hidden transition-transform duration-200 ease-out ${
                drawerVisible ? 'translate-x-0' : '-translate-x-full'
              } ${
                darkMode
                  ? 'bg-slate-900 text-white border-r border-white/10'
                  : 'bg-white text-slate-900 border-r border-slate-200'
              }`}
            >
              {/* 1. Pinned Top Header */}
              <div className="shrink-0 px-5 pt-5 pb-3.5 space-y-3 border-b border-slate-200/80 dark:border-white/10">
                <div className="flex justify-between items-center gap-2">
                  <button
                    type="button"
                    onClick={() => handleNav('activities')}
                    title="Return to Main Homepage"
                    className="flex items-center gap-2.5 cursor-pointer text-left min-w-0 flex-1"
                  >
                    {renderLogo()}
                    <span className="font-bold text-sm hover:text-emerald-500 transition truncate">
                      {clubName}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setDrawerOpen(false)}
                    className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 dark:hover:text-white hover:bg-slate-100 dark:hover:bg-white/10 cursor-pointer shrink-0"
                    aria-label="Close menu"
                  >
                    <X className="w-5 h-5" />
                  </button>
                </div>
                <div
                  className={`p-3 rounded-2xl border text-xs ${
                    darkMode
                      ? 'bg-white/5 border-white/10'
                      : 'bg-slate-50 border-slate-200/80'
                  }`}
                >
                  <div className="font-bold truncate flex items-center justify-between gap-2">
                    <span className="truncate">{profile.full_name}</span>
                    <span
                      className={`px-1.5 py-0.5 rounded text-[10px] font-bold uppercase shrink-0 ${
                        isOwner
                          ? 'bg-amber-400 text-slate-950'
                          : isAdminOrOwner
                          ? 'bg-emerald-600 text-white'
                          : darkMode
                          ? 'bg-white/10 text-slate-300'
                          : 'bg-slate-200 text-slate-700'
                      }`}
                    >
                      {isOwner ? 'Owner' : isAdminOrOwner ? 'Admin' : 'Member'}
                    </span>
                  </div>
                  <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate mt-1 tabular-nums">
                    {profile.matric_no} • {profile.phone_number}
                  </div>
                </div>
              </div>

              {/* 2. Scrollable Middle Navigation, Quick Actions & Workspace Controls */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3.5 py-4 space-y-5">
                {/* Group 1: Navigation */}
                <nav className="space-y-1 text-xs font-semibold" aria-label="Workspace navigation">
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Navigation
                  </div>
                  <button
                    type="button"
                    onClick={() => handleNav('activities')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      activeTab === 'activities'
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Calendar className="w-4 h-4 shrink-0" />
                    <span>Activities</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('equipment')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      activeTab === 'equipment'
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <Package className="w-4 h-4 shrink-0" />
                    <span>Equipment</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleNav('claims')}
                    className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      activeTab === 'claims'
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <span className="flex items-center gap-3">
                      <Receipt className="w-4 h-4 shrink-0" />
                      <span>Claims</span>
                    </span>
                    {pendingClaimsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold tabular-nums">
                        {pendingClaimsCount}
                      </span>
                    )}
                  </button>
                  {isAdminOrOwner && (
                    <>
                      <button
                        type="button"
                        onClick={() => handleNav('ledger')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          activeTab === 'ledger'
                            ? 'bg-emerald-600 text-white'
                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <Wallet className="w-4 h-4 shrink-0" />
                        <span>Finance Ledger</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('members')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          activeTab === 'members'
                            ? 'bg-emerald-600 text-white'
                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <Users className="w-4 h-4 shrink-0" />
                        <span>Members</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNav('logs')}
                        className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                          activeTab === 'logs'
                            ? 'bg-emerald-600 text-white'
                            : 'hover:bg-slate-100 dark:hover:bg-white/5'
                        }`}
                      >
                        <ShieldCheck className="w-4 h-4 shrink-0" />
                        <span>Activity Logs</span>
                      </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleNav('profile')}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer transition ${
                      activeTab === 'profile'
                        ? 'bg-emerald-600 text-white'
                        : 'hover:bg-slate-100 dark:hover:bg-white/5'
                    }`}
                  >
                    <UserCheck className="w-4 h-4 shrink-0" />
                    <span>Profile</span>
                  </button>
                </nav>

                {/* Group 2: Quick Actions */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200/80 dark:border-white/10 text-xs font-semibold">
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Quick Actions
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenQrScanner();
                    }}
                    className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border cursor-pointer transition ${
                      darkMode
                        ? 'bg-white/5 border-white/10 text-white hover:bg-white/10'
                        : 'bg-slate-900 border-slate-900 text-white hover:bg-slate-800'
                    }`}
                  >
                    <QrCode className="w-4 h-4 shrink-0" />
                    <span>Scan QR</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      onOpenNewClaim();
                    }}
                    className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer transition"
                  >
                    <Plus className="w-4 h-4 shrink-0" />
                    <span>New Claim</span>
                  </button>
                  {onOpenNewActivity && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenNewActivity();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-500/20 cursor-pointer transition"
                    >
                      <Calendar className="w-4 h-4 shrink-0" />
                      <span>New Activity</span>
                    </button>
                  )}
                  {onOpenNewFinance && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenNewFinance();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-amber-400/15 text-amber-700 dark:text-amber-300 hover:bg-amber-400/25 cursor-pointer transition"
                    >
                      <Wallet className="w-4 h-4 shrink-0" />
                      <span>New Finance Entry</span>
                    </button>
                  )}
                </div>

                {/* Group 3: Workspace & Admin Controls */}
                <div className="space-y-1.5 pt-3 border-t border-slate-200/80 dark:border-white/10 text-xs font-semibold">
                  <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                    Workspace &amp; Admin Controls
                  </div>
                  {canManagePublicPage && onOpenPublicPageEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenPublicPageEditor();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer transition"
                    >
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>Public Page Editor</span>
                    </button>
                  )}
                  {canCustomizeTheme && onOpenThemeStudio && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        onOpenThemeStudio();
                      }}
                      className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer transition"
                    >
                      <Palette className="w-4 h-4 shrink-0" />
                      <span>Logo &amp; Background Studio</span>
                    </button>
                  )}

                  {roleMode === 'member' && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        setPinError(null);
                        setPinModalOpen(true);
                      }}
                      className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 cursor-pointer hover:bg-emerald-500/15 transition"
                    >
                      <Lock className="w-3.5 h-3.5 shrink-0" />
                      <span>Unlock Admin Mode</span>
                    </button>
                  )}

                  {roleMode === 'admin' && (
                    <div className="space-y-1.5 pt-1">
                      {profile.role === 'owner' && (
                        <button
                          type="button"
                          onClick={() => {
                            setDrawerOpen(false);
                            void onSwitchMode('owner');
                          }}
                          className="w-full py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-bold cursor-pointer flex items-center justify-center gap-1.5"
                        >
                          <Crown className="w-3.5 h-3.5 shrink-0" />
                          <span>Switch to Owner Mode</span>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          void onSwitchMode('member');
                        }}
                        className="w-full py-2 px-3 rounded-xl bg-slate-500/15 hover:bg-slate-500/25 cursor-pointer flex items-center justify-center gap-1.5"
                      >
                        <Unlock className="w-3.5 h-3.5 shrink-0" />
                        <span>Exit to Member Mode</span>
                      </button>
                    </div>
                  )}

                  {roleMode === 'owner' && (
                    <div className="grid grid-cols-2 gap-1.5 pt-1">
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          void onSwitchMode('admin');
                        }}
                        className="py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer"
                      >
                        Admin Mode
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          void onSwitchMode('member');
                        }}
                        className="py-2 rounded-xl bg-slate-500/15 hover:bg-slate-500/25 font-semibold cursor-pointer"
                      >
                        Member Mode
                      </button>
                    </div>
                  )}

                  {installPromptEvent && !isStandalone && (
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        void handleInstallPwa();
                      }}
                      className="w-full py-2.5 px-3 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1.5 font-bold"
                    >
                      <Download className="w-3.5 h-3.5 shrink-0" />
                      <span>Install App</span>
                    </button>
                  )}
                </div>
              </div>

              {/* 3. Pinned Bottom Footer */}
              <div
                className={`shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] text-xs font-bold ${
                  darkMode ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    void onSignOut();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 cursor-pointer flex items-center justify-center gap-1.5 transition"
                >
                  <LogOut className="w-3.5 h-3.5" />
                  <span>Sign Out</span>
                </button>
              </div>
            </aside>
          </div>,
          document.body
        )}

      <ModalShell
        open={pinModalOpen}
        onClose={() => setPinModalOpen(false)}
        zIndexClass="z-[75]"
        maxWidthClass="max-w-sm"
        ariaLabel="Unlock Admin Mode"
      >
        <div className="bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 rounded-2xl border border-slate-200 dark:border-white/10 overflow-hidden shadow-2xl">
          <div className="bg-slate-900 dark:bg-slate-950 text-white px-5 py-4 flex justify-between items-center border-b border-white/10">
            <span className="text-sm font-bold flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-emerald-400" />
              <span>Unlock Admin Mode</span>
            </span>
            <button
              type="button"
              onClick={() => setPinModalOpen(false)}
              className="p-1 rounded-lg text-slate-400 hover:text-white hover:bg-white/10 cursor-pointer"
              aria-label="Close modal"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <form onSubmit={handlePinSubmit} className="p-5 space-y-3.5 text-xs">
            <div className="space-y-1.5">
              <label className="block text-[11px] font-semibold text-slate-600 dark:text-slate-300">
                Passcode
              </label>
              <input
                type="password"
                value={pinInput}
                onChange={(e) => setPinInput(e.target.value)}
                placeholder="Enter Admin or Owner Code"
                autoFocus
                className="w-full rounded-xl border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm font-mono focus:bg-white dark:focus:bg-slate-900"
                required
              />
            </div>
            {pinError && (
              <div className="px-3 py-2 rounded-xl bg-rose-50 dark:bg-rose-500/15 border border-rose-200 dark:border-rose-500/30 text-rose-700 dark:text-rose-300 font-semibold">
                {pinError}
              </div>
            )}
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setPinModalOpen(false)}
                className="px-3.5 py-2 rounded-xl border border-slate-200 dark:border-white/10 text-slate-600 dark:text-slate-300 font-semibold hover:bg-slate-50 dark:hover:bg-white/5 cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={switchingRole}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                {switchingRole && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                <span>Unlock</span>
              </button>
            </div>
          </form>
        </div>
      </ModalShell>
    </>
  );
}
