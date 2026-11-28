'use client';

import React from 'react';
import GlassSurface from './ui/GlassSurface';
import { Home, Package, QrCode, Receipt, UserCheck } from 'lucide-react';
import type { NavTab } from './Navbar';

interface MobileBottomNavProps {
  activeTab: NavTab;
  onSelectTab: (tab: NavTab) => void;
  onOpenQrScanner: () => void;
  pendingClaimsCount?: number;
  darkMode?: boolean;
  liquidGlass?: boolean;
}

export default function MobileBottomNav({
  activeTab,
  onSelectTab,
  onOpenQrScanner,
  pendingClaimsCount = 0,
  darkMode = false,
  liquidGlass = true,
}: MobileBottomNavProps) {
  const handleSelect = (tab: NavTab) => {
    onSelectTab(tab);
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const tabClass = (tab: NavTab) => {
    const active = activeTab === tab;
    if (liquidGlass) {
      if (active) {
        return darkMode
          ? 'text-white font-bold'
          : 'text-slate-900 font-bold';
      }
      return darkMode
        ? 'text-slate-300/80 hover:text-white'
        : 'text-slate-600 hover:text-slate-900';
    }
    if (darkMode) {
      return active
        ? 'text-emerald-400'
        : 'text-slate-400 hover:text-slate-200';
    }
    return active
      ? 'text-emerald-600'
      : 'text-slate-500 hover:text-slate-900';
  };

  const renderDockItems = () => (
    <>
      <button
        type="button"
        onClick={() => handleSelect('activities')}
        className={`relative min-h-[44px] mx-0.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition cursor-pointer ${tabClass(
          'activities'
        )} ${liquidGlass && activeTab === 'activities' ? 'lg-lens' : ''}`}
      >
        <Home className="w-5 h-5" />
        <span>Home</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('equipment')}
        className={`relative min-h-[44px] mx-0.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition cursor-pointer ${tabClass(
          'equipment'
        )} ${liquidGlass && activeTab === 'equipment' ? 'lg-lens' : ''}`}
      >
        <Package className="w-5 h-5" />
        <span>Gear</span>
      </button>

      {/* Center Elevated QR Scanner Button */}
      <div className="flex items-center justify-center -mt-5 relative z-10">
        <button
          type="button"
          onClick={onOpenQrScanner}
          aria-label="Scan QR"
          title="Scan QR Attendance"
          style={
            liquidGlass
              ? {
                  backgroundColor: 'var(--lg-btn-bg, var(--lg-accent, #059669))',
                  color: 'var(--lg-btn-text, #ffffff)',
                  boxShadow: darkMode
                    ? 'inset 0 1.5px 0 rgba(255,255,255,0.48), 0 10px 24px -4px rgba(0,0,0,0.65)'
                    : 'inset 0 1.5px 0 rgba(255,255,255,0.65), 0 10px 24px -6px rgba(15,23,42,0.35)',
                }
              : undefined
          }
          className={`w-13 h-13 rounded-full ${
            liquidGlass
              ? 'backdrop-blur-md ring-4'
              : 'bg-emerald-600 hover:bg-emerald-500 text-white shadow-lg shadow-emerald-600/30 ring-4'
          } flex items-center justify-center transition active:scale-95 cursor-pointer ${
            darkMode ? 'ring-slate-950/90' : 'ring-white/95'
          }`}
        >
          <QrCode className="w-6 h-6" />
        </button>
      </div>

      <button
        type="button"
        onClick={() => handleSelect('claims')}
        className={`relative min-h-[44px] mx-0.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition cursor-pointer ${tabClass(
          'claims'
        )} ${liquidGlass && activeTab === 'claims' ? 'lg-lens' : ''}`}
      >
        <div className="relative">
          <Receipt className="w-5 h-5" />
          {pendingClaimsCount > 0 && (
            <span className="absolute -top-1.5 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-400 text-slate-950 text-[9px] font-bold flex items-center justify-center shadow tabular-nums">
              {pendingClaimsCount > 9 ? '9+' : pendingClaimsCount}
            </span>
          )}
        </div>
        <span>Claims</span>
      </button>

      <button
        type="button"
        onClick={() => handleSelect('profile')}
        className={`relative min-h-[44px] mx-0.5 rounded-2xl flex flex-col items-center justify-center gap-0.5 py-1.5 text-[10px] font-semibold transition cursor-pointer ${tabClass(
          'profile'
        )} ${liquidGlass && activeTab === 'profile' ? 'lg-lens' : ''}`}
      >
        <UserCheck className="w-5 h-5" />
        <span>Profile</span>
      </button>
    </>
  );

  if (!liquidGlass) {
    return (
      <nav
        aria-label="Mobile navigation"
        className={`md:hidden fixed bottom-0 inset-x-0 z-30 backdrop-blur-xl border-t pb-[env(safe-area-inset-bottom)] transition-colors ${
          darkMode
            ? 'bg-slate-950/92 border-white/10 text-white'
            : 'bg-white/92 border-slate-200/80 text-slate-800 shadow-[0_-6px_24px_-8px_rgba(15,23,42,0.08)]'
        }`}
      >
        <div className="max-w-lg mx-auto px-2 h-16 grid grid-cols-5 items-center">
          {renderDockItems()}
        </div>
      </nav>
    );
  }

  return (
    <nav
      aria-label="Mobile navigation"
      className="md:hidden fixed bottom-0 inset-x-0 z-30 px-2.5 pb-[max(0.5rem,env(safe-area-inset-bottom))] pointer-events-none"
    >
      <GlassSurface
        width="100%"
        height={64}
        borderRadius={28}
        distortionScale={-160}
        displace={0.5}
        backgroundOpacity={darkMode ? 0.28 : 0.22}
        saturation={1.4}
        className={`max-w-lg mx-auto pointer-events-auto [&_.glass-surface__content]:!py-1 [&_.glass-surface__content]:!px-1.5 ${
          darkMode ? 'text-white' : 'text-slate-900'
        }`}
        style={{ overflow: 'visible' }}
      >
        <div className="w-full h-full grid grid-cols-5 items-center">
          {renderDockItems()}
        </div>
      </GlassSurface>
    </nav>
  );
}
