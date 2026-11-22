'use client';

import React, { useEffect, useState } from 'react';
import { UserProfile } from '@/lib/supabase';
import { Menu, X, Calendar, Receipt, UserCheck, Wallet, Users, PlusCircle, Lock, Unlock, KeyRound, LogOut, Layers, Loader2, Package, QrCode, Crown, Moon, Sun, Palette, FileText, ShieldCheck, Globe, Download } from 'lucide-react';

export type NavTab = 'activities' | 'equipment' | 'claims' | 'profile' | 'ledger' | 'members' | 'logs';

interface NavbarProps {
  profile: UserProfile; clubName: string; logoUrl?: string; activeTab: NavTab; onSelectTab: (tab: NavTab) => void;
  currentBatch?: string; roleMode: 'member' | 'admin' | 'owner'; pendingClaimsCount?: number;
  notificationBell?: React.ReactNode;
  darkMode?: boolean; onToggleDarkMode?: () => void; canCustomizeTheme?: boolean; onOpenThemeStudio?: () => void;
  canManagePublicPage?: boolean; onOpenPublicPageEditor?: () => void;
  onUnlockAdmin: (pin: string) => Promise<boolean>;
  onSwitchMode: (target: 'member' | 'admin' | 'owner') => Promise<void>;
  onSignOut: () => Promise<void>; onOpenNewClaim: () => void; onOpenQrScanner: () => void;
  onOpenNewActivity?: () => void; onOpenNewFinance?: () => void; switchingRole?: boolean;
}

export default function Navbar({
  profile, clubName, logoUrl = '', activeTab, onSelectTab, currentBatch = '2026/2027', roleMode, pendingClaimsCount = 0,
  notificationBell,
  darkMode = false, onToggleDarkMode, canCustomizeTheme = false, onOpenThemeStudio, canManagePublicPage = false, onOpenPublicPageEditor,
  onUnlockAdmin, onSwitchMode, onSignOut, onOpenNewClaim, onOpenQrScanner,
  onOpenNewActivity, onOpenNewFinance, switchingRole = false,
}: NavbarProps) {
  const isAdminOrOwner = roleMode === 'admin' || roleMode === 'owner';
  const isOwner = roleMode === 'owner';
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [pinModalOpen, setPinModalOpen] = useState(false);
  const [pinInput, setPinInput] = useState('');
  const [pinError, setPinError] = useState<string | null>(null);
  const [installPromptEvent, setInstallPromptEvent] = useState<{
    prompt: () => Promise<void>;
    userChoice: Promise<{ outcome: string }>;
  } | null>(null);
  const [isStandalone, setIsStandalone] = useState(false);

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
    onSelectTab(tab);
    setDrawerOpen(false);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handlePinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setPinError(null);
    const ok = await onUnlockAdmin(pinInput);
    if (ok) { setPinInput(''); setPinModalOpen(false); setDrawerOpen(false); }
    else setPinError('Invalid Passcode.');
  };

  const renderLogo = () => {
    if (!logoUrl) {
      return (
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-white shadow-md shrink-0">
          <Layers className="w-5 h-5" />
        </div>
      );
    }
    if (logoUrl.toLowerCase().endsWith('.pdf')) {
      return (
        <a href={logoUrl} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()} className="w-10 h-10 rounded-xl bg-emerald-700 text-white flex items-center justify-center shadow-md shrink-0" title="Open Official Club Logo PDF">
          <FileText className="w-5 h-5" />
        </a>
      );
    }
    return <img src={logoUrl} alt={clubName} className="w-10 h-10 rounded-xl object-cover border border-emerald-400/40 shadow-md shrink-0 bg-white" />;
  };

  return (
    <>
      <header className={`sticky top-0 z-30 backdrop-blur-xl border-b transition-colors ${darkMode ? 'bg-slate-950/80 border-white/10 text-white' : 'bg-white/80 border-slate-200/80 text-slate-900'}`}>
        <div className="max-w-7xl mx-auto px-3 sm:px-4 h-16 flex items-center justify-between gap-2 sm:gap-3">
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
            <button type="button" onClick={() => setDrawerOpen(true)} className={`p-2 sm:p-2.5 rounded-xl border transition cursor-pointer shrink-0 ${darkMode ? 'bg-white/5 border-white/10 text-emerald-400 hover:bg-white/10' : 'bg-slate-100 text-slate-800 border-slate-200 hover:bg-slate-200'}`} aria-label="Open menu"><Menu className="w-5 h-5" /></button>
            <button
              type="button"
              onClick={() => handleNav('activities')}
              title="Return to Main Homepage"
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer text-left group min-w-0 flex-1"
            >
              {renderLogo()}
              <span className="text-sm sm:text-base font-extrabold tracking-tight group-hover:text-emerald-500 transition truncate">{clubName || 'ClubSync'}</span>
              <span className={`hidden sm:inline-block px-2 py-0.5 rounded-md text-[10px] font-bold border shrink-0 ${darkMode ? 'bg-white/5 border-white/10 text-emerald-300' : 'bg-emerald-50 text-emerald-800 border-emerald-200'}`}>{currentBatch}</span>
              {isOwner ? <span className="hidden xs:inline-flex sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-extrabold uppercase bg-amber-400 text-slate-950 shrink-0"><Crown className="w-3 h-3 inline mr-0.5" />Owner</span> : isAdminOrOwner ? <span className="hidden xs:inline-flex sm:inline-flex px-2 py-0.5 rounded-md text-[10px] font-bold uppercase bg-emerald-600 text-white shrink-0">Admin</span> : null}
            </button>
          </div>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {canManagePublicPage && onOpenPublicPageEditor && (
              <button
                type="button"
                onClick={onOpenPublicPageEditor}
                className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${darkMode ? 'bg-white/10 border-white/15 text-emerald-300 hover:bg-white/15' : 'bg-emerald-50 border-emerald-200 text-emerald-800 hover:bg-emerald-100'}`}
                title="Customize Public Landing Page"
              >
                <Globe className="w-4 h-4" />
                <span className="hidden lg:inline">Public Page</span>
              </button>
            )}
            {canCustomizeTheme && onOpenThemeStudio && (
              <button type="button" onClick={onOpenThemeStudio} className={`hidden md:inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-bold border transition cursor-pointer ${darkMode ? 'bg-white/10 border-white/15 text-amber-300 hover:bg-white/15' : 'bg-amber-50 border-amber-200 text-amber-900 hover:bg-amber-100'}`} title="Customize Logo & Background">
                <Palette className="w-4 h-4" /><span className="hidden lg:inline">Logo &amp; Theme</span>
              </button>
            )}
            {onToggleDarkMode && (
              <button type="button" onClick={onToggleDarkMode} className={`p-2 rounded-xl border transition cursor-pointer ${darkMode ? 'bg-white/10 border-white/15 text-amber-300' : 'bg-slate-100 border-slate-200 text-slate-700'}`} title="Toggle Dark / Light Mode">{darkMode ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}</button>
            )}
            {notificationBell}
            <button type="button" onClick={onOpenQrScanner} className="hidden md:inline-flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-xs font-bold bg-slate-950 hover:bg-slate-900 text-white border border-white/15 shadow-sm cursor-pointer"><QrCode className="w-4 h-4" /><span>Scan QR</span></button>
            <button type="button" onClick={onOpenNewClaim} className="inline-flex items-center gap-1.5 px-2.5 sm:px-3.5 py-2 rounded-xl text-xs font-bold border bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-500 cursor-pointer"><PlusCircle className="w-4 h-4 text-white" /><span className="hidden sm:inline">Submit Claim</span></button>
          </div>
        </div>
      </header>

      {drawerOpen && (
        <div className="fixed inset-0 z-50 flex">
          <div onClick={() => setDrawerOpen(false)} className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs" />
          <aside className={`relative z-10 w-72 h-full shadow-2xl flex flex-col justify-between p-5 overflow-y-auto ${darkMode ? 'bg-slate-900 text-white border-r border-white/10' : 'bg-white text-slate-900'}`}>
            <div className="space-y-5">
              <div className="flex justify-between items-center pb-3 border-b border-slate-200/20">
                <button
                  type="button"
                  onClick={() => handleNav('activities')}
                  title="Return to Main Homepage"
                  className="flex items-center gap-2 cursor-pointer text-left"
                >
                  {renderLogo()}
                  <span className="font-extrabold text-sm hover:text-emerald-500 transition">{clubName}</span>
                </button>
                <button type="button" onClick={() => setDrawerOpen(false)} className="cursor-pointer"><X className="w-5 h-5" /></button>
              </div>
              <div className={`p-3 rounded-2xl border text-xs ${darkMode ? 'bg-white/5 border-white/10' : 'bg-emerald-50 border-emerald-200'}`}>
                <div className="font-extrabold">{profile.full_name} ({isOwner ? 'Owner' : isAdminOrOwner ? 'Admin' : 'Member'})</div>
                <div className="font-mono opacity-75">{profile.matric_no} • {profile.phone_number}</div>
              </div>
              <nav className="space-y-1 text-xs font-bold">
                <button type="button" onClick={() => handleNav('activities')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'activities' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><Calendar className="w-4 h-4" /><span>Home &amp; Activities</span></button>
                <button type="button" onClick={() => { setDrawerOpen(false); onOpenQrScanner(); }} className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl bg-slate-950 text-white hover:bg-slate-900 border border-white/10 cursor-pointer"><QrCode className="w-4 h-4 text-white" /><span>Scan QR Attendance</span></button>
                <button type="button" onClick={() => handleNav('equipment')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'equipment' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><Package className="w-4 h-4" /><span>Equipment Borrowing</span></button>
                <button type="button" onClick={() => handleNav('claims')} className={`w-full flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'claims' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><span className="flex items-center gap-3"><Receipt className="w-4 h-4" /><span>Reimbursement Claims</span></span>{pendingClaimsCount > 0 && <span className="px-2 py-0.5 rounded-full bg-amber-400 text-slate-950">{pendingClaimsCount}</span>}</button>
                <button type="button" onClick={() => handleNav('profile')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'profile' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><UserCheck className="w-4 h-4" /><span>My Profile</span></button>
              </nav>
              {isAdminOrOwner && (
                <nav className="space-y-1 pt-2 border-t border-slate-200/20 text-xs font-bold">
                  <button type="button" onClick={() => handleNav('ledger')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'ledger' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><Wallet className="w-4 h-4" /><span>Club Finance &amp; Savings</span></button>
                  <button type="button" onClick={() => handleNav('members')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'members' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><Users className="w-4 h-4" /><span>Members &amp; Batch Clearance</span></button>
                  <button type="button" onClick={() => handleNav('logs')} className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl cursor-pointer ${activeTab === 'logs' ? 'bg-emerald-600 text-white' : 'hover:bg-emerald-500/10'}`}><ShieldCheck className="w-4 h-4" /><span>Security &amp; Activity Log</span></button>
                  {canManagePublicPage && onOpenPublicPageEditor && <button type="button" onClick={() => { setDrawerOpen(false); onOpenPublicPageEditor(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-emerald-600 hover:bg-emerald-500/10 cursor-pointer"><Globe className="w-4 h-4" /><span>Edit Public Landing Page</span></button>}
                  {canCustomizeTheme && onOpenThemeStudio && <button type="button" onClick={() => { setDrawerOpen(false); onOpenThemeStudio(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-amber-500 hover:bg-amber-500/10 cursor-pointer"><Palette className="w-4 h-4" /><span>Logo &amp; Background Studio</span></button>}
                  {onOpenNewActivity && <button type="button" onClick={() => { setDrawerOpen(false); onOpenNewActivity(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-emerald-500/10 text-emerald-500 cursor-pointer">+ New Activity</button>}
                  {onOpenNewFinance && <button type="button" onClick={() => { setDrawerOpen(false); onOpenNewFinance(); }} className="w-full flex items-center gap-3 px-3 py-2 rounded-xl bg-amber-400/20 text-amber-500 cursor-pointer">+ Add Finance Record</button>}
                </nav>
              )}
            </div>

            <div className="pt-4 border-t border-slate-200/20 space-y-2 text-xs font-bold">
              {roleMode === 'member' && (
                <button type="button" onClick={() => { setDrawerOpen(false); setPinError(null); setPinModalOpen(true); }} className="w-full py-2.5 rounded-xl bg-emerald-500/10 text-emerald-500 border border-emerald-500/30 cursor-pointer"><Lock className="w-3.5 h-3.5 inline mr-1" />Unlock Admin Mode</button>
              )}
              {roleMode === 'admin' && (
                <>
                  {profile.role === 'owner' && (
                    <button type="button" onClick={() => { setDrawerOpen(false); onSwitchMode('owner'); }} className="w-full py-2 rounded-xl bg-amber-400 text-slate-950 cursor-pointer"><Crown className="w-3.5 h-3.5 inline mr-1" />Owner Mode</button>
                  )}
                  <button type="button" onClick={() => { setDrawerOpen(false); onSwitchMode('member'); }} className="w-full py-2 rounded-xl bg-slate-500/20 cursor-pointer"><Unlock className="w-3.5 h-3.5 inline mr-1" />Exit to Member Mode</button>
                </>
              )}
              {roleMode === 'owner' && (
                <div className="grid grid-cols-2 gap-1.5">
                  <button type="button" onClick={() => { setDrawerOpen(false); onSwitchMode('admin'); }} className="py-2 rounded-xl bg-emerald-600 text-white cursor-pointer">Admin Mode</button>
                  <button type="button" onClick={() => { setDrawerOpen(false); onSwitchMode('member'); }} className="py-2 rounded-xl bg-slate-500/20 cursor-pointer">Member Mode</button>
                </div>
              )}
              {installPromptEvent && !isStandalone && (
                <button type="button" onClick={handleInstallPwa} className="w-full py-2.5 rounded-xl bg-emerald-600/15 text-emerald-600 hover:bg-emerald-600/25 border border-emerald-500/30 cursor-pointer flex items-center justify-center gap-1.5">
                  <Download className="w-3.5 h-3.5" />
                  <span>Install App</span>
                </button>
              )}
              <button type="button" onClick={onSignOut} className="w-full py-2 rounded-xl text-rose-500 hover:bg-rose-500/10 cursor-pointer"><LogOut className="w-3.5 h-3.5 inline mr-1" />Sign Out</button>
            </div>
          </aside>
        </div>
      )}

      {pinModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="bg-white text-slate-900 rounded-3xl max-w-sm w-full overflow-hidden shadow-2xl">
            <div className="bg-emerald-800 text-white px-5 py-4 flex justify-between items-center">
              <span className="text-sm font-extrabold"><KeyRound className="w-4 h-4 inline mr-1" />Unlock Admin Mode</span>
              <button type="button" onClick={() => setPinModalOpen(false)}><X className="w-5 h-5" /></button>
            </div>
            <form onSubmit={handlePinSubmit} className="p-5 space-y-3 text-xs">
              <input type="password" value={pinInput} onChange={(e) => setPinInput(e.target.value)} placeholder="Enter Admin or Owner Code" className="w-full rounded-xl border px-3 py-2 text-sm font-mono" required />
              {pinError && <div className="text-rose-600">{pinError}</div>}
              <div className="flex justify-end gap-2"><button type="button" onClick={() => setPinModalOpen(false)} className="px-3 py-2">Cancel</button><button type="submit" disabled={switchingRole} className="px-4 py-2 rounded-xl bg-emerald-700 text-white font-bold">{switchingRole && <Loader2 className="w-3.5 h-3.5 animate-spin inline mr-1" />}Unlock</button></div>
            </form>
          </div>
        </div>
      )}
    </>
  );
}