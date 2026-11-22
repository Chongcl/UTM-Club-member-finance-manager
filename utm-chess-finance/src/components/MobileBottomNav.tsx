'use client';

import React from 'react';
import { Home, Package, QrCode, Receipt, UserCheck } from 'lucide-react';
import type { NavTab } from './Navbar';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQrScanner: () => void;
  pendingClaimsCount?: number;
  darkMode?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenQrScanner,
  pendingClaimsCount = 0,
  darkMode = false,
}: MobileBottomNavProps) {
  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabClass = (tab: NavTab) => {
    const active = activeTab === tab;
    if (darkMode) {
      return active
        ? 'text-emerald-400'
        : 'text-slate-400 hover:text-slate-200';
    }
    return active
      ? 'text-emerald-600'
      : 'text-slate-500 hover:text-slate-900';
  };

  return (
    <nav
      aria-label="Mobile navigation"
      className={`md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)] transition-colors ${
        darkMode
          ? 'bg-slate-950/90 border-white/10 text-white'
          : 'bg-white/90 border-slate-200/80 text-slate-800 shadow-[0_-6px_24px_-8px_rgba(15,23,42,0.08)]'
      }`}
    >
      <div className="max-w-lg mx-auto px-2 h-16 grid grid-cols-5 items-center">
        <button
          type="button"
          onClick={() => handleSelect('activities')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${tabClass(
            'activities'
          )}`}
        >
          <Home className="w-5 h-5" />
          <span>Home</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('equipment')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${tabClass(
            'equipment'
          )}`}
        >
          <Package className="w-5 h-5" />
          <span>Gear</span>
        </button>

        {/* Center Elevated QR Scanner Button */}
        <div className="flex items-center justify-center -mt-5">
          <button
            type="button"
            onClick={onOpenQrScanner}
            aria-label="Scan QR"
            title="Scan QR Attendance"
            className="w-13 h-13 rounded-full bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/35 ring-4 ring-white/90 dark:ring-slate-950 flex items-center justify-center transition active:scale-95 cursor-pointer"
          >
            <QrCode className="w-6 h-6" />
          </button>
        </div>

        <button
          type="button"
          onClick={() => handleSelect('claims')}
          className={`relative flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${tabClass(
            'claims'
          )}`}
        >
          <div className="relative">
            <Receipt className="w-5 h-5" />
            {pendingClaimsCount > 0 && (
              <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-slate-950 text-[9px] font-extrabold flex items-center justify-center shadow">
                {pendingClaimsCount > 9 ? '9+' : pendingClaimsCount}
              </span>
            )}
          </div>
          <span>Claims</span>
        </button>

        <button
          type="button"
          onClick={() => handleSelect('profile')}
          className={`flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-bold transition cursor-pointer ${tabClass(
            'profile'
          )}`}
        >
          <UserCheck className="w-5 h-5" />
          <span>Profile</span>
        </button>
      </div>
    </nav>
  );
}
