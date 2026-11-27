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
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [returningHome, setReturningHome] = useState(false);
  const [newMenuOpen, setNewMenuOpen] = useState(false);
  const [accountMenuOpen, setAccountMenuOpen] = useState(false);
  const [installPromptEvent, setInstallPromptEvent] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

  const newMenuRef = useRef<HTMLDivElement>(null);
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
    if (!newMenuOpen && !accountMenuOpen) return;
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (newMenuOpen && newMenuRef.current && !newMenuRef.current.contains(target)) {
        setNewMenuOpen(false);
      }
      if (accountMenuOpen && accountMenuRef.current && !accountMenuRef.current.contains(target)) {
        setAccountMenuOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setNewMenuOpen(false);
        setAccountMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [newMenuOpen, accountMenuOpen]);

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
    setNewMenuOpen(false);
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

  const hasAdminQuickActions = Boolean(onOpenNewActivity || onOpenNewFinance);
  const initials = (profile.full_name || 'U')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() || '')
    .join('');

  const desktopTabs: Array<{ id: NavTab; label: string; badge?: number }> = [
    { id: 'activities', label: 'Activities' },
    { id: 'equipment', label: 'Gear' },
    { id: 'claims', label: 'Claims', badge: pendingClaimsCount > 0 ? pendingClaimsCount : undefined },
    ...(isAdminOrOwner
      ? ([
          { id: 'ledger', label: 'Finance' },
          { id: 'members', label: 'Members' },
          { id: 'logs', label: 'Logs' },
        ] as Array<{ id: NavTab; label: string }>)
      : []),
  ];

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
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-3">
          {/* Left: Menu trigger + Brand + Batch */}
          <div className="flex items-center gap-2 sm:gap-2.5 min-w-0 shrink-0">
            <button
              type="button"
              onClick={() => setDrawerOpen(true)}
              className={`lg:hidden p-2 rounded-xl border transition cursor-pointer shrink-0 ${
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
                <span className="text-sm sm:text-[15px] font-bold tracking-tight group-hover:text-emerald-600 dark:group-hover:text-emerald-400 transition truncate max-w-[140px] sm:max-w-[200px]">
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
              </div>
            </button>
          </div>

          {/* Center: Desktop Tab Strip */}
          <nav
            aria-label="Primary sections"
            className={`hidden lg:flex items-center gap-0.5 p-1 rounded-xl border ${
              darkMode
                ? 'bg-white/[0.04] border-white/10'
                : 'bg-slate-100/90 border-slate-200/80'
            }`}
          >
            {desktopTabs.map((tab) => {
              const active = activeTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleNav(tab.id)}
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                    active
                      ? darkMode
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs'
                      : darkMode
                      ? 'text-slate-400 hover:text-slate-200 hover:bg-white/5'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-white/60'
                  }`}
                >
                  <span>{tab.label}</span>
                  {tab.badge !== undefined && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-400 text-slate-950 text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
                      {tab.badge > 99 ? '99+' : tab.badge}
                    </span>
                  )}
                </button>
              );
            })}
          </nav>

          {/* Right: Actions + Utilities + Account */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Quick Studio Shortcuts on Wide Viewports */}
            {canManagePublicPage && onOpenPublicPageEditor && (
              <button
                type="button"
                onClick={onOpenPublicPageEditor}
                className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 text-emerald-300 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Customize Public Landing Page"
              >
                <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
                <span>Public Page</span>
              </button>
            )}
            {canCustomizeTheme && onOpenThemeStudio && (
              <button
                type="button"
                onClick={onOpenThemeStudio}
                className={`hidden xl:inline-flex items-center gap-1.5 px-2.5 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
                }`}
                title="Customize Logo & Background"
              >
                <Palette className="w-3.5 h-3.5 text-amber-500" />
                <span>Theme</span>
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
              onClick={onOpenQrScanner}
              className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                darkMode
                  ? 'bg-white/5 border-white/10 text-slate-200 hover:bg-white/10'
                  : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50'
              }`}
              title="Scan QR Attendance"
            >
              <QrCode className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>Scan QR</span>
            </button>

            {/* Primary Action: Submit Claim or + New Dropdown for Admins */}
            {hasAdminQuickActions ? (
              <div className="relative" ref={newMenuRef}>
                <button
                  type="button"
                  onClick={() => {
                    setAccountMenuOpen(false);
                    setNewMenuOpen((v) => !v);
                  }}
                  className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span className="hidden sm:inline">New</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-80" />
                </button>

                {newMenuOpen && (
                  <div
                    className={`absolute right-0 mt-2 w-52 rounded-2xl border shadow-xl p-1.5 z-40 animate-[modalScaleIn_130ms_ease-out] ${
                      darkMode
                        ? 'bg-slate-900 border-white/10 text-slate-100'
                        : 'bg-white border-slate-200 text-slate-900'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setNewMenuOpen(false);
                        onOpenNewClaim();
                      }}
                      className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Receipt className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Submit Claim</span>
                    </button>
                    {onOpenNewActivity && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMenuOpen(false);
                          onOpenNewActivity();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                        }`}
                      >
                        <Calendar className="w-4 h-4 text-sky-500 shrink-0" />
                        <span>New Activity</span>
                      </button>
                    )}
                    {onOpenNewFinance && (
                      <button
                        type="button"
                        onClick={() => {
                          setNewMenuOpen(false);
                          onOpenNewFinance();
                        }}
                        className={`w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                          darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                        }`}
                      >
                        <Wallet className="w-4 h-4 text-amber-500 shrink-0" />
                        <span>Add Finance Record</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <button
                type="button"
                onClick={onOpenNewClaim}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs transition cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span className="hidden sm:inline">Submit Claim</span>
              </button>
            )}

            {/* Desktop Account / Role Mode Popover */}
            <div className="relative hidden lg:block" ref={accountMenuRef}>
              <button
                type="button"
                onClick={() => {
                  setNewMenuOpen(false);
                  setAccountMenuOpen((v) => !v);
                }}
                className={`inline-flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded-xl border transition cursor-pointer ${
                  darkMode
                    ? 'bg-white/5 border-white/10 hover:bg-white/10 text-slate-100'
                    : 'bg-white border-slate-200 hover:bg-slate-50 text-slate-800'
                }`}
                aria-label="Account and workspace controls"
              >
                <span className="w-7 h-7 rounded-lg bg-emerald-600 text-white text-[11px] font-bold flex items-center justify-center shrink-0">
                  {initials}
                </span>
                <span
                  className={`px-1.5 py-0.5 rounded-md text-[10px] font-bold uppercase tracking-wide ${
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
                  className={`absolute right-0 mt-2 w-64 rounded-2xl border shadow-xl p-2 z-40 animate-[modalScaleIn_130ms_ease-out] space-y-1.5 ${
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
                    <div className="font-mono text-[11px] text-slate-500 dark:text-slate-400 truncate mt-0.5">
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

                  {canManagePublicPage && onOpenPublicPageEditor && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenPublicPageEditor();
                      }}
                      className={`xl:hidden w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Globe className="w-4 h-4 text-emerald-500 shrink-0" />
                      <span>Edit Public Landing Page</span>
                    </button>
                  )}

                  {canCustomizeTheme && onOpenThemeStudio && (
                    <button
                      type="button"
                      onClick={() => {
                        setAccountMenuOpen(false);
                        onOpenThemeStudio();
                      }}
                      className={`xl:hidden w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold text-left cursor-pointer ${
                        darkMode ? 'hover:bg-white/5' : 'hover:bg-slate-50'
                      }`}
                    >
                      <Palette className="w-4 h-4 text-amber-500 shrink-0" />
                      <span>Logo &amp; Background Studio</span>
                    </button>
                  )}

                  <div className="pt-1 border-t border-slate-200/70 dark:border-white/10 space-y-1">
                    {roleMode === 'member' && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          setPinError(null);
                          setPinModalOpen(true);
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl text-xs font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <Lock className="w-3.5 h-3.5 shrink-0" />
                        <span>Unlock Admin Mode</span>
                      </button>
                    )}

                    {roleMode === 'admin' && (
                      <>
                        {profile.role === 'owner' && (
                          <button
                            type="button"
                            onClick={() => {
                              setAccountMenuOpen(false);
                              void onSwitchMode('owner');
                            }}
                            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-bold bg-amber-400 text-slate-950 hover:bg-amber-300 cursor-pointer"
                          >
                            <Crown className="w-3.5 h-3.5 shrink-0" />
                            <span>Switch to Owner Mode</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            void onSwitchMode('member');
                          }}
                          className={`w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                            darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200/70'
                          }`}
                        >
                          <Unlock className="w-3.5 h-3.5 shrink-0" />
                          <span>Exit to Member Mode</span>
                        </button>
                      </>
                    )}

                    {roleMode === 'owner' && (
                      <div className="grid grid-cols-2 gap-1.5 pt-0.5">
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            void onSwitchMode('admin');
                          }}
                          className="py-2 rounded-xl text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
                        >
                          Admin Mode
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setAccountMenuOpen(false);
                            void onSwitchMode('member');
                          }}
                          className={`py-2 rounded-xl text-xs font-semibold cursor-pointer ${
                            darkMode ? 'bg-white/5 hover:bg-white/10' : 'bg-slate-100 hover:bg-slate-200/70'
                          }`}
                        >
                          Member Mode
                        </button>
                      </div>
                    )}

                    {installPromptEvent && !isStandalone && (
                      <button
                        type="button"
                        onClick={() => {
                          setAccountMenuOpen(false);
                          void handleInstallPwa();
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Download className="w-3.5 h-3.5 shrink-0" />
                        <span>Install App</span>
                      </button>
                    )}

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

      {/* Mobile & Tablet Navigation Drawer */}
      {drawerOpen &&
        typeof document !== 'undefined' &&
        createPortal(
          <div className="fixed inset-0 z-[70] flex" role="dialog" aria-modal="true" aria-label="Navigation menu">
            <div
              onClick={() => setDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs touch-none animate-[modalFadeIn_150ms_ease-out]"
            />
            <aside
              className={`relative z-10 w-76 max-w-[85vw] h-[100dvh] max-h-[100dvh] shadow-2xl flex flex-col overflow-hidden ${
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

              {/* 2. Scrollable Middle Navigation */}
              <div className="flex-1 min-h-0 overflow-y-auto overscroll-contain touch-pan-y px-3.5 py-3 space-y-3">
                <nav className="space-y-1 text-xs font-semibold">
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
                    <span>Home &amp; Activities</span>
                  </button>
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
                    <span>Scan QR Attendance</span>
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
                    <span>Equipment Borrowing</span>
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
                      <span>Reimbursement Claims</span>
                    </span>
                    {pendingClaimsCount > 0 && (
                      <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950 font-bold tabular-nums">
                        {pendingClaimsCount}
                      </span>
                    )}
                  </button>
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
                    <span>My Profile</span>
                  </button>
                </nav>
                {isAdminOrOwner && (
                  <nav className="space-y-1 pt-2.5 border-t border-slate-200/80 dark:border-white/10 text-xs font-semibold">
                    <div className="px-3 pb-1 text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Administration
                    </div>
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
                      <span>Club Finance &amp; Savings</span>
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
                      <span>Members &amp; Batch Clearance</span>
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
                      <span>Security &amp; Activity Log</span>
                    </button>
                    {canManagePublicPage && onOpenPublicPageEditor && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenPublicPageEditor();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/10 cursor-pointer"
                      >
                        <Globe className="w-4 h-4 shrink-0" />
                        <span>Edit Public Landing Page</span>
                      </button>
                    )}
                    {canCustomizeTheme && onOpenThemeStudio && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenThemeStudio();
                        }}
                        className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 cursor-pointer"
                      >
                        <Palette className="w-4 h-4 shrink-0" />
                        <span>Logo &amp; Background Studio</span>
                      </button>
                    )}
                    {onOpenNewActivity && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          onOpenNewActivity();
                        }}
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-500/20 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
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
                        className="w-full flex items-center gap-2.5 px-3 py-2 rounded-xl bg-amber-400/15 text-amber-600 dark:text-amber-400 hover:bg-amber-400/25 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5 shrink-0" />
                        <span>Add Finance Record</span>
                      </button>
                    )}
                  </nav>
                )}
              </div>

              {/* 3. Pinned Bottom Footer */}
              <div
                className={`shrink-0 border-t px-4 pt-3 pb-[max(1rem,env(safe-area-inset-bottom))] space-y-2 text-xs font-bold ${
                  darkMode ? 'border-white/10 bg-slate-900' : 'border-slate-200 bg-white'
                }`}
              >
                {roleMode === 'member' && (
                  <button
                    type="button"
                    onClick={() => {
                      setDrawerOpen(false);
                      setPinError(null);
                      setPinModalOpen(true);
                    }}
                    className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/25 cursor-pointer hover:bg-emerald-500/15 transition"
                  >
                    <Lock className="w-3.5 h-3.5 inline mr-1.5" />
                    Unlock Admin Mode
                  </button>
                )}
                {roleMode === 'admin' && (
                  <>
                    {profile.role === 'owner' && (
                      <button
                        type="button"
                        onClick={() => {
                          setDrawerOpen(false);
                          void onSwitchMode('owner');
                        }}
                        className="w-full py-2 rounded-xl bg-amber-400 text-slate-950 cursor-pointer"
                      >
                        <Crown className="w-3.5 h-3.5 inline mr-1.5" />
                        Owner Mode
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        void onSwitchMode('member');
                      }}
                      className="w-full py-2 rounded-xl bg-slate-500/15 hover:bg-slate-500/25 cursor-pointer"
                    >
                      <Unlock className="w-3.5 h-3.5 inline mr-1.5" />
                      Exit to Member Mode
                    </button>
                  </>
                )}
                {roleMode === 'owner' && (
                  <div className="grid grid-cols-2 gap-1.5">
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        void onSwitchMode('admin');
                      }}
                      className="py-2 rounded-xl bg-emerald-600 text-white cursor-pointer"
                    >
                      Admin Mode
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setDrawerOpen(false);
                        void onSwitchMode('member');
                      }}
                      className="py-2 rounded-xl bg-slate-500/15 hover:bg-slate-500/25 cursor-pointer"
                    >
                      Member Mode
                    </button>
                  </div>
                )}
                {installPromptEvent && !isStandalone && (
                  <button
                    type="button"
                    onClick={handleInstallPwa}
                    className="w-full py-2.5 rounded-xl bg-emerald-600/15 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-600/25 border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Download className="w-3.5 h-3.5" />
                    <span>Install App</span>
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDrawerOpen(false);
                    void onSignOut();
                  }}
                  className="w-full py-2.5 px-3 rounded-xl bg-rose-500/10 text-rose-600 dark:text-rose-400 hover:bg-rose-500/20 border border-rose-500/25 cursor-pointer flex items-center justify-center gap-1.5"
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
