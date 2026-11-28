'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Palette,
  Sun,
  Moon,
  X,
  Check,
  ChevronDown,
  ChevronRight,
  RotateCcw,
  Sparkles,
  Image as ImageIcon,
  Sliders,
  Layers,
  FileText,
  Smartphone,
} from 'lucide-react';
import {
  ClubThemeConfig,
  COLOR_PALETTE_OPTIONS,
  DEFAULT_THEME_CONFIG,
  DYNAMIC_BG_OPTIONS,
  MeshBackdropId,
  STARTER_THEME_PRESETS,
  getColorsForMode,
  isDynamicBgId,
} from '@/lib/themeConfig';

export interface ClassicBgPreset {
  id: string;
  name: string;
  desc: string;
  swatch: string;
}

export interface ThemeStudioDrawerProps {
  open: boolean;
  onCloseCancel: () => void;
  onSubmitSave: (e: React.FormEvent) => void;
  savingTheme: boolean;
  isDarkCanvas: boolean;
  onSetDarkMode: (dark: boolean) => void;
  themeConfig: ClubThemeConfig;
  setThemeConfig: React.Dispatch<React.SetStateAction<ClubThemeConfig>>;
  savedThemeSnapshot: ClubThemeConfig;
  setBgStyle: (id: string) => void;
  classicPresets: ClassicBgPreset[];
  bgImageUrl: string;
  setBgImageUrl: (v: string) => void;
  setBgFile: (f: File | null) => void;
  logoUrl: string;
  logoUrlInput: string;
  setLogoUrlInput: (v: string) => void;
  setLogoFile: (f: File | null) => void;
}

type StudioTab = 'presets' | 'background' | 'style';

export default function ThemeStudioDrawer({
  open,
  onCloseCancel,
  onSubmitSave,
  savingTheme,
  isDarkCanvas,
  onSetDarkMode,
  themeConfig,
  setThemeConfig,
  savedThemeSnapshot,
  setBgStyle,
  classicPresets,
  bgImageUrl,
  setBgImageUrl,
  setBgFile,
  logoUrl,
  logoUrlInput,
  setLogoUrlInput,
  setLogoFile,
}: ThemeStudioDrawerProps) {
  const [visible, setVisible] = useState(false);
  const [activeTab, setActiveTab] = useState<StudioTab>('presets');
  const [fineTuneOpen, setFineTuneOpen] = useState(false);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  useEffect(() => {
    if (!open) {
      setVisible(false);
      return;
    }
    const raf = requestAnimationFrame(() => setVisible(true));
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onCloseCancel();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onCloseCancel]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const hasUnsavedChanges =
    JSON.stringify(themeConfig) !== JSON.stringify(savedThemeSnapshot);

  const hasOverrides = Boolean(
    themeConfig.cardTint ||
      themeConfig.tableHeaderTint ||
      themeConfig.buttonColor ||
      themeConfig.buttonTextColor ||
      themeConfig.fontColor
  );

  const lightStarters = STARTER_THEME_PRESETS.filter((p) => p.mode === 'light');
  const darkStarters = STARTER_THEME_PRESETS.filter((p) => p.mode === 'dark');
  const orderedPresetSections = isDarkCanvas
    ? [
        { title: 'Dark Themes', badge: 'Recommended for Dark', items: darkStarters },
        { title: 'Light Themes', badge: 'Switches to Light Mode', items: lightStarters },
      ]
    : [
        { title: 'Light Themes', badge: 'Recommended for Light', items: lightStarters },
        { title: 'Dark Themes', badge: 'Switches to Dark Mode', items: darkStarters },
      ];

  const meshOptions = DYNAMIC_BG_OPTIONS.filter((o) => o.source === 'mesh');
  const reactBitsOptions = DYNAMIC_BG_OPTIONS.filter((o) => o.source === 'react-bits');
  const magicUiOptions = DYNAMIC_BG_OPTIONS.filter((o) => o.source === 'magic-ui');

  const activeMeshId: MeshBackdropId = themeConfig.backgroundId.startsWith('mesh-')
    ? (themeConfig.backgroundId as MeshBackdropId)
    : themeConfig.bgMesh || '';
  const hasAnimatedEffect =
    isDynamicBgId(themeConfig.backgroundId) && !themeConfig.backgroundId.startsWith('mesh-');

  const handleSelectModeToggle = (nextDark: boolean) => {
    onSetDarkMode(nextDark);
    const colorSourceId = activeMeshId || themeConfig.backgroundId;
    const activeOpt = DYNAMIC_BG_OPTIONS.find((o) => o.id === colorSourceId);
    if (activeOpt) {
      setThemeConfig((prev) => ({
        ...prev,
        bgColors: getColorsForMode(activeOpt, nextDark),
      }));
    }
  };

  const handleSelectMesh = (meshId: MeshBackdropId) => {
    if (!meshId) {
      if (themeConfig.backgroundId.startsWith('mesh-')) {
        setBgStyle('emerald-aurora');
        setThemeConfig((prev) => ({
          ...prev,
          backgroundId: 'emerald-aurora',
          bgMesh: '',
          bgColors: { ...DEFAULT_THEME_CONFIG.bgColors },
        }));
      } else {
        const effectOpt = DYNAMIC_BG_OPTIONS.find((o) => o.id === themeConfig.backgroundId);
        setThemeConfig((prev) => ({
          ...prev,
          bgMesh: '',
          bgColors: effectOpt ? getColorsForMode(effectOpt, isDarkCanvas) : prev.bgColors,
        }));
      }
      return;
    }

    const opt = DYNAMIC_BG_OPTIONS.find((o) => o.id === meshId);
    if (!opt) return;
    const matchedColors = getColorsForMode(opt, isDarkCanvas);

    if (hasAnimatedEffect) {
      setThemeConfig((prev) => ({
        ...prev,
        bgMesh: meshId,
        bgColors: matchedColors,
        bgScrim: isDarkCanvas ? prev.bgScrim : Math.min(prev.bgScrim, 0.14),
      }));
    } else {
      setBgStyle(meshId);
      setThemeConfig((prev) => ({
        ...prev,
        backgroundId: meshId,
        bgMesh: meshId,
        bgColors: matchedColors,
        bgScrim: isDarkCanvas ? prev.bgScrim : Math.min(prev.bgScrim, 0.14),
      }));
    }
  };

  const handleSelectDynamicBg = (optId: string) => {
    const opt = DYNAMIC_BG_OPTIONS.find((o) => o.id === optId);
    if (!opt) return;
    setBgStyle(opt.id);
    setThemeConfig((prev) => {
      const preservedMesh: MeshBackdropId = prev.backgroundId.startsWith('mesh-')
        ? (prev.backgroundId as MeshBackdropId)
        : prev.bgMesh || '';
      const meshOpt = preservedMesh
        ? DYNAMIC_BG_OPTIONS.find((o) => o.id === preservedMesh)
        : undefined;
      return {
        ...prev,
        backgroundId: opt.id,
        bgMesh: preservedMesh,
        bgColors: preservedMesh
          ? prev.bgColors || (meshOpt ? getColorsForMode(meshOpt, isDarkCanvas) : getColorsForMode(opt, isDarkCanvas))
          : getColorsForMode(opt, isDarkCanvas),
        bgScrim: isDarkCanvas ? prev.bgScrim : Math.min(prev.bgScrim, 0.14),
      };
    });
  };

  const handleResetToDefault = () => {
    const nextCfg: ClubThemeConfig = {
      ...DEFAULT_THEME_CONFIG,
      backgroundId: isDarkCanvas ? 'emerald-aurora' : 'mesh-sunrise',
      bgMesh: '',
      bgColors: isDarkCanvas
        ? { ...DEFAULT_THEME_CONFIG.bgColors }
        : { primary: '#fdba74', secondary: '#f9a8d4', accent: '#7dd3fc' },
      colorPalette: isDarkCanvas ? 'default' : 'solar-mist',
      bgScrim: isDarkCanvas ? 0.15 : 0.08,
    };
    setThemeConfig(nextCfg);
    setBgStyle(nextCfg.backgroundId);
    setBgFile(null);
  };

  const modeBadgeLabel = (mode: 'dark' | 'light' | 'both') =>
    mode === 'light' ? 'Light' : mode === 'dark' ? 'Dark' : 'Both';

  const modeBadgeClass = (mode: 'dark' | 'light' | 'both') => {
    if (mode === 'light') {
      return isDarkCanvas
        ? 'bg-amber-500/20 text-amber-200 border-amber-400/30'
        : 'bg-amber-50 text-amber-800 border-amber-200';
    }
    if (mode === 'dark') {
      return isDarkCanvas
        ? 'bg-indigo-500/25 text-indigo-200 border-indigo-400/30'
        : 'bg-slate-800 text-white border-slate-700';
    }
    return isDarkCanvas
      ? 'bg-emerald-500/20 text-emerald-200 border-emerald-400/30'
      : 'bg-emerald-50 text-emerald-700 border-emerald-200';
  };

  const drawerChrome = isDarkCanvas
    ? 'bg-slate-900/95 text-slate-100 border-white/10'
    : 'bg-white/95 text-slate-900 border-slate-200';

  const cardBg = isDarkCanvas
    ? 'bg-white/[0.04] border-white/10'
    : 'bg-slate-50/90 border-slate-200';

  const innerControlBg = isDarkCanvas
    ? 'bg-slate-950/70 border-white/10 text-slate-100'
    : 'bg-white border-slate-200 text-slate-900';

  const mutedText = isDarkCanvas ? 'text-slate-400' : 'text-slate-500';

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex justify-end items-end sm:items-stretch"
      role="dialog"
      aria-modal="true"
      aria-label="Theme Studio"
    >
      {/* Non-obscuring backdrop on desktop so live changes remain clearly visible */}
      <div
        onClick={onCloseCancel}
        className={`fixed inset-0 transition-opacity duration-200 ${
          visible ? 'opacity-100' : 'opacity-0'
        } bg-slate-950/35 sm:bg-slate-950/15`}
      />

      <form
        onSubmit={onSubmitSave}
        className={`relative z-10 w-full sm:w-[420px] max-h-[88dvh] sm:max-h-none sm:h-[100dvh] sm:border-l rounded-t-3xl sm:rounded-none shadow-2xl backdrop-blur-2xl flex flex-col overflow-hidden transition-transform duration-200 ease-out ${drawerChrome} ${
          visible ? 'translate-y-0 sm:translate-x-0' : 'translate-y-full sm:translate-y-0 sm:translate-x-full'
        }`}
      >
        {/* 1. Pinned Top Header + Mode Switch + 3 Tabs */}
        <div
          className={`shrink-0 px-5 pt-4 pb-3 border-b space-y-3 ${
            isDarkCanvas ? 'border-white/10' : 'border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                <Palette className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <h2 className="text-sm font-extrabold tracking-tight truncate">Theme Studio</h2>
                  {hasUnsavedChanges && (
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-amber-400/20 text-amber-600 dark:text-amber-300 border border-amber-400/30 text-[10px] font-bold">
                      Unsaved
                    </span>
                  )}
                </div>
                <p className={`text-[11px] truncate ${mutedText}`}>
                  Live preview updates behind this panel
                </p>
              </div>
            </div>

            <div className="flex items-center gap-1.5 shrink-0">
              {/* Quick Light / Dark Mode Toggle Pill */}
              <div
                className={`inline-flex p-0.5 rounded-xl border text-[11px] font-bold ${
                  isDarkCanvas ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200'
                }`}
              >
                <button
                  type="button"
                  onClick={() => handleSelectModeToggle(false)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition cursor-pointer ${
                    !isDarkCanvas
                      ? 'bg-white text-slate-900 shadow-2xs'
                      : 'text-slate-400 hover:text-white'
                  }`}
                  title="Switch to Light Mode"
                >
                  <Sun className="w-3 h-3 text-amber-500" />
                  <span>Light</span>
                </button>
                <button
                  type="button"
                  onClick={() => handleSelectModeToggle(true)}
                  className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg transition cursor-pointer ${
                    isDarkCanvas
                      ? 'bg-slate-800 text-white shadow-2xs'
                      : 'text-slate-500 hover:text-slate-900'
                  }`}
                  title="Switch to Dark Mode"
                >
                  <Moon className="w-3 h-3 text-sky-400" />
                  <span>Dark</span>
                </button>
              </div>

              <button
                type="button"
                onClick={onCloseCancel}
                className={`p-1.5 rounded-xl transition cursor-pointer ${
                  isDarkCanvas
                    ? 'text-slate-400 hover:text-white hover:bg-white/10'
                    : 'text-slate-400 hover:text-slate-800 hover:bg-slate-100'
                }`}
                aria-label="Close Theme Studio"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* 3 Focused Tabs */}
          <div
            className={`grid grid-cols-3 gap-1 p-1 rounded-2xl border text-xs font-bold ${
              isDarkCanvas ? 'bg-white/5 border-white/10' : 'bg-slate-100 border-slate-200/80'
            }`}
          >
            {(
              [
                { id: 'presets', label: 'Presets', icon: Sparkles },
                { id: 'background', label: 'Background', icon: ImageIcon },
                { id: 'style', label: 'Style & Colors', icon: Sliders },
              ] as const
            ).map((t) => {
              const IconComp = t.icon;
              const active = activeTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setActiveTab(t.id)}
                  className={`flex items-center justify-center gap-1.5 py-2 px-2 rounded-xl transition cursor-pointer ${
                    active
                      ? isDarkCanvas
                        ? 'bg-slate-800 text-white shadow-xs'
                        : 'bg-white text-slate-900 shadow-xs'
                      : isDarkCanvas
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  <IconComp className="w-3.5 h-3.5 shrink-0" />
                  <span className="truncate">{t.label}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* 2. Scrollable Tab Content */}
        <div className="flex-1 min-h-0 overflow-y-auto px-5 py-4 space-y-5 text-xs">
          {/* ===================== TAB 1: PRESETS ===================== */}
          {activeTab === 'presets' && (
            <div className="space-y-5">
              {orderedPresetSections.map((section) => (
                <div key={section.title} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="text-xs font-extrabold uppercase tracking-wider">
                      {section.title}
                    </h3>
                    <span className={`text-[10px] font-semibold ${mutedText}`}>
                      {section.badge}
                    </span>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {section.items.map((starter) => {
                      const active =
                        themeConfig.backgroundId === starter.patch.backgroundId &&
                        themeConfig.colorPalette === starter.patch.colorPalette &&
                        isDarkCanvas === (starter.mode === 'dark');
                      const paletteMeta = COLOR_PALETTE_OPTIONS.find(
                        (p) => p.id === starter.patch.colorPalette
                      );

                      return (
                        <button
                          key={starter.id}
                          type="button"
                          onClick={() => {
                            const nextCfg: ClubThemeConfig = {
                              ...themeConfig,
                              bgMesh: '',
                              ...starter.patch,
                            };
                            setThemeConfig(nextCfg);
                            setBgStyle(nextCfg.backgroundId);
                            setBgFile(null);
                            onSetDarkMode(starter.mode === 'dark');
                          }}
                          className={`group rounded-2xl border p-2.5 text-left transition cursor-pointer flex flex-col gap-2 ${
                            active
                              ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                              : `${cardBg} hover:border-emerald-400/60`
                          }`}
                        >
                          <div
                            className="w-full h-14 rounded-xl border border-black/10 relative overflow-hidden shadow-inner"
                            style={{ background: starter.swatch }}
                          >
                            <span
                              className="absolute bottom-2 left-2 w-4 h-4 rounded-full border-2 border-white shadow-sm"
                              style={{ backgroundColor: paletteMeta?.accent || '#059669' }}
                            />
                            {active && (
                              <span className="absolute top-1.5 right-1.5 w-5 h-5 rounded-full bg-emerald-600 text-white flex items-center justify-center shadow">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </div>
                          <div className="min-w-0">
                            <div className="font-extrabold truncate">{starter.name}</div>
                            <div className={`text-[10px] truncate mt-0.5 ${mutedText}`}>
                              {starter.subtitle}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* ===================== TAB 2: BACKGROUND ===================== */}
          {activeTab === 'background' && (
            <div className="space-y-5">
              {/* Group 1: Colorful Mesh (Pairs with any animated effect below) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div>
                    <h3 className="font-extrabold uppercase tracking-wider text-[11px]">
                      Colorful Mesh
                    </h3>
                    <p className={`text-[10px] ${mutedText}`}>
                      Pairs with any animated effect below
                    </p>
                  </div>
                  {activeMeshId ? (
                    <button
                      type="button"
                      onClick={() => handleSelectMesh('')}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer shrink-0"
                    >
                      Clear Mesh
                    </button>
                  ) : (
                    <span className={`text-[10px] font-semibold ${mutedText}`}>
                      Recommended for Light Mode
                    </span>
                  )}
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {meshOptions.map((opt) => {
                    const active = activeMeshId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectMesh(opt.id as MeshBackdropId)}
                        className={`p-2 rounded-2xl border text-left transition cursor-pointer space-y-1.5 ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${cardBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div
                          className="w-full h-11 rounded-xl border border-black/10 relative"
                          style={{ background: opt.preview }}
                        >
                          {active && (
                            <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-emerald-600 text-white flex items-center justify-center">
                              <Check className="w-2.5 h-2.5" />
                            </span>
                          )}
                        </div>
                        <div className="font-bold text-[11px] truncate">{opt.name}</div>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 2: Animated Effects (React Bits) */}
              <div className="space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="font-extrabold uppercase tracking-wider text-[11px]">
                    Animated Effects (React Bits)
                  </h3>
                  {hasAnimatedEffect && activeMeshId && (
                    <button
                      type="button"
                      onClick={() => {
                        setBgStyle(activeMeshId);
                        setThemeConfig((prev) => ({
                          ...prev,
                          backgroundId: activeMeshId,
                          bgMesh: activeMeshId,
                        }));
                      }}
                      className="text-[10px] font-bold text-rose-500 hover:underline cursor-pointer shrink-0"
                    >
                      Effect Off
                    </button>
                  )}
                </div>
                <div className="space-y-1.5">
                  {reactBitsOptions.map((opt) => {
                    const active = themeConfig.backgroundId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectDynamicBg(opt.id)}
                        className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-2xl border text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${cardBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl border border-black/10 shrink-0"
                            style={{ background: opt.preview }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold truncate">
                              {opt.name.replace('React Bits · ', '')}
                            </div>
                            <div className={`text-[10px] truncate ${mutedText}`}>{opt.desc}</div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${modeBadgeClass(
                            opt.recommendedMode
                          )}`}
                        >
                          {modeBadgeLabel(opt.recommendedMode)}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Group 3: Minimal Patterns & Classic */}
              <div className="space-y-2">
                <h3 className="font-extrabold uppercase tracking-wider text-[11px]">
                  Minimal Patterns &amp; Classic
                </h3>
                <div className="space-y-1.5">
                  {magicUiOptions.map((opt) => {
                    const active = themeConfig.backgroundId === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectDynamicBg(opt.id)}
                        className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-2xl border text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${cardBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl border border-black/10 shrink-0"
                            style={{ background: opt.preview }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold truncate">
                              {opt.name.replace('Magic UI · ', '')}
                            </div>
                            <div className={`text-[10px] truncate ${mutedText}`}>{opt.desc}</div>
                          </div>
                        </div>
                        <span
                          className={`px-2 py-0.5 rounded-md border text-[10px] font-bold shrink-0 ${modeBadgeClass(
                            opt.recommendedMode
                          )}`}
                        >
                          {modeBadgeLabel(opt.recommendedMode)}
                        </span>
                      </button>
                    );
                  })}

                  {classicPresets.map((preset) => {
                    const active = themeConfig.backgroundId === preset.id;
                    return (
                      <button
                        key={preset.id}
                        type="button"
                        onClick={() => {
                          setBgStyle(preset.id);
                          setThemeConfig((prev) => ({ ...prev, backgroundId: preset.id, bgMesh: '' }));
                        }}
                        className={`w-full flex items-center justify-between gap-2.5 p-2 rounded-2xl border text-left transition cursor-pointer ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${cardBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div
                            className="w-10 h-10 rounded-xl border border-black/10 shrink-0"
                            style={{ background: preset.swatch }}
                          />
                          <div className="min-w-0">
                            <div className="font-bold truncate">{preset.name}</div>
                            <div className={`text-[10px] truncate ${mutedText}`}>{preset.desc}</div>
                          </div>
                        </div>
                        {active && (
                          <Check className="w-4 h-4 text-emerald-500 shrink-0" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>

              {themeConfig.backgroundId === 'custom-image' && (
                <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardBg}`}>
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
                      className={`w-full rounded-xl border px-3 py-2 ${innerControlBg}`}
                    />
                  </div>
                </div>
              )}

              {/* Collapsed Fine-Tune Background Accordion */}
              {(isDynamicBgId(themeConfig.backgroundId) || Boolean(activeMeshId)) && (
                <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                  <button
                    type="button"
                    onClick={() => setFineTuneOpen((v) => !v)}
                    className="w-full px-3.5 py-2.5 flex items-center justify-between font-extrabold cursor-pointer"
                  >
                    <span>Fine-Tune Background</span>
                    {fineTuneOpen ? (
                      <ChevronDown className="w-4 h-4" />
                    ) : (
                      <ChevronRight className="w-4 h-4" />
                    )}
                  </button>
                  {fineTuneOpen && (
                    <div
                      className={`px-3.5 pb-3.5 pt-2 border-t space-y-3 ${
                        isDarkCanvas ? 'border-white/10' : 'border-slate-200'
                      }`}
                    >
                      <div className="grid grid-cols-3 gap-2">
                        {(
                          [
                            { key: 'primary', label: 'Primary' },
                            { key: 'secondary', label: 'Secondary' },
                            { key: 'accent', label: 'Glow' },
                          ] as const
                        ).map((c) => (
                          <label
                            key={c.key}
                            className={`flex items-center gap-1.5 p-1.5 rounded-xl border cursor-pointer ${innerControlBg}`}
                          >
                            <input
                              type="color"
                              value={themeConfig.bgColors[c.key]}
                              onChange={(e) =>
                                setThemeConfig((prev) => ({
                                  ...prev,
                                  bgColors: { ...prev.bgColors, [c.key]: e.target.value },
                                }))
                              }
                              className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                            />
                            <span className="text-[10px] font-bold truncate">{c.label}</span>
                          </label>
                        ))}
                      </div>
                      <div className="space-y-2.5">
                        <div>
                          <div className="flex justify-between font-bold mb-1">
                            <span>Animation Speed</span>
                            <span className="font-mono tabular-nums">
                              {themeConfig.bgSpeed.toFixed(1)}x
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={1.5}
                            step={0.1}
                            value={themeConfig.bgSpeed}
                            onChange={(e) =>
                              setThemeConfig((prev) => ({
                                ...prev,
                                bgSpeed: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-emerald-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between font-bold mb-1">
                            <span>Background Intensity</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(themeConfig.bgOpacity * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0.15}
                            max={1}
                            step={0.05}
                            value={themeConfig.bgOpacity}
                            onChange={(e) =>
                              setThemeConfig((prev) => ({
                                ...prev,
                                bgOpacity: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-emerald-600 cursor-pointer"
                          />
                        </div>
                        <div>
                          <div className="flex justify-between font-bold mb-1">
                            <span>Contrast Veil</span>
                            <span className="font-mono tabular-nums">
                              {Math.round(themeConfig.bgScrim * 100)}%
                            </span>
                          </div>
                          <input
                            type="range"
                            min={0}
                            max={0.65}
                            step={0.05}
                            value={themeConfig.bgScrim}
                            onChange={(e) =>
                              setThemeConfig((prev) => ({
                                ...prev,
                                bgScrim: parseFloat(e.target.value),
                              }))
                            }
                            className="w-full accent-emerald-600 cursor-pointer"
                          />
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ===================== TAB 3: STYLE & COLORS ===================== */}
          {activeTab === 'style' && (
            <div className="space-y-5">
              {/* Club Logo Upload & URL */}
              <div className={`p-3.5 rounded-2xl border space-y-2.5 ${cardBg}`}>
                <label className="block font-extrabold">
                  Club Logo (JPG, PNG, WEBP or PDF)
                </label>
                <div className="flex items-center gap-3">
                  {logoUrl ? (
                    logoUrl.toLowerCase().endsWith('.pdf') ? (
                      <div className="w-11 h-11 rounded-xl bg-emerald-700 text-white flex items-center justify-center shrink-0">
                        <FileText className="w-5 h-5" />
                      </div>
                    ) : (
                      <img
                        src={logoUrl}
                        alt="Logo"
                        className="w-11 h-11 rounded-xl object-cover border bg-white shrink-0"
                      />
                    )
                  ) : (
                    <div className="w-11 h-11 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0">
                      <Layers className="w-5 h-5" />
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*,application/pdf"
                    onChange={(e) => setLogoFile(e.target.files?.[0] || null)}
                    className="w-full text-[11px] file:mr-2 file:py-1.5 file:px-3 file:rounded-lg file:border-0 file:text-[11px] file:font-bold file:bg-emerald-600 file:text-white cursor-pointer"
                  />
                </div>
                <input
                  type="url"
                  value={logoUrlInput}
                  onChange={(e) => setLogoUrlInput(e.target.value)}
                  placeholder="Or paste Logo URL..."
                  className={`w-full rounded-xl border px-3 py-1.5 ${innerControlBg}`}
                />
              </div>

              {/* Color Palette Swatches */}
              <div className="space-y-2">
                <h3 className="font-extrabold uppercase tracking-wider text-[11px]">
                  Color Palette
                </h3>
                <div className="grid grid-cols-3 gap-2">
                  {COLOR_PALETTE_OPTIONS.map((pal) => {
                    const active = themeConfig.colorPalette === pal.id;
                    return (
                      <button
                        key={pal.id}
                        type="button"
                        onClick={() =>
                          setThemeConfig((prev) => ({ ...prev, colorPalette: pal.id }))
                        }
                        className={`p-2 rounded-xl border text-left cursor-pointer transition space-y-1.5 ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${innerControlBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div className="flex items-center justify-between gap-1">
                          <span
                            className="w-4 h-4 rounded-full border border-black/15 shrink-0"
                            style={{
                              backgroundColor:
                                pal.id === 'custom' ? themeConfig.customAccent : pal.accent,
                            }}
                          />
                          <span className={`text-[9px] font-bold ${mutedText}`}>
                            {pal.modeHint}
                          </span>
                        </div>
                        <div className="text-[10px] font-bold truncate">{pal.label}</div>
                      </button>
                    );
                  })}
                </div>

                {themeConfig.colorPalette === 'custom' && (
                  <label
                    className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer ${innerControlBg}`}
                  >
                    <span className="font-bold">Custom Theme Accent Color</span>
                    <input
                      type="color"
                      value={themeConfig.customAccent}
                      onChange={(e) =>
                        setThemeConfig((prev) => ({ ...prev, customAccent: e.target.value }))
                      }
                      className="w-8 h-7 rounded cursor-pointer border-0 bg-transparent p-0"
                    />
                  </label>
                )}
              </div>

              {/* Surface Style (Liquid Glass vs Classic Clean) */}
              <div className="space-y-2.5">
                <h3 className="font-extrabold uppercase tracking-wider text-[11px]">
                  Surface Style
                </h3>
                <div className="grid grid-cols-2 gap-2.5">
                  {(
                    [
                      {
                        id: 'liquid-glass',
                        title: 'Liquid Glass',
                        desc: 'Frosted depth, specular rim & mobile glass dock',
                      },
                      {
                        id: 'classic',
                        title: 'Classic Clean',
                        desc: 'Crisp solid surface cards & flat chrome',
                      },
                    ] as const
                  ).map((opt) => {
                    const active = themeConfig.surfaceMode === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() =>
                          setThemeConfig((prev) => ({ ...prev, surfaceMode: opt.id }))
                        }
                        className={`p-3 rounded-2xl border text-left transition cursor-pointer space-y-1 ${
                          active
                            ? 'border-emerald-500 ring-2 ring-emerald-500/25 bg-emerald-500/10'
                            : `${cardBg} hover:border-emerald-400/60`
                        }`}
                      >
                        <div className="font-extrabold flex items-center justify-between">
                          <span>{opt.title}</span>
                          {active && <Check className="w-3.5 h-3.5 text-emerald-500" />}
                        </div>
                        <div className={`text-[10px] leading-snug ${mutedText}`}>
                          {opt.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>

                {themeConfig.surfaceMode === 'liquid-glass' && (
                  <div className={`p-3.5 rounded-2xl border space-y-3 ${cardBg}`}>
                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span>Glass Blur</span>
                        <span className="font-mono tabular-nums">{themeConfig.glassBlur}px</span>
                      </div>
                      <input
                        type="range"
                        min={8}
                        max={28}
                        step={1}
                        value={themeConfig.glassBlur}
                        onChange={(e) =>
                          setThemeConfig((prev) => ({
                            ...prev,
                            glassBlur: parseInt(e.target.value, 10),
                          }))
                        }
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <div>
                      <div className="flex justify-between font-bold mb-1">
                        <span>Glass Transparency</span>
                        <span className="font-mono tabular-nums">
                          {Math.round(themeConfig.glassOpacity * 100)}%
                        </span>
                      </div>
                      <input
                        type="range"
                        min={0.45}
                        max={0.9}
                        step={0.05}
                        value={themeConfig.glassOpacity}
                        onChange={(e) =>
                          setThemeConfig((prev) => ({
                            ...prev,
                            glassOpacity: parseFloat(e.target.value),
                          }))
                        }
                        className="w-full accent-emerald-600 cursor-pointer"
                      />
                    </div>
                    <label
                      className={`flex items-center justify-between p-2.5 rounded-xl border cursor-pointer ${innerControlBg}`}
                    >
                      <span className="flex items-center gap-2 font-bold">
                        <Smartphone className="w-3.5 h-3.5 text-emerald-500" />
                        <span>Mobile Bottom Nav Glass</span>
                      </span>
                      <input
                        type="checkbox"
                        checked={themeConfig.mobileNavGlass}
                        onChange={(e) =>
                          setThemeConfig((prev) => ({
                            ...prev,
                            mobileNavGlass: e.target.checked,
                          }))
                        }
                        className="accent-emerald-600 w-4 h-4 cursor-pointer"
                      />
                    </label>
                  </div>
                )}
              </div>

              {/* Collapsed Advanced Custom Overrides Accordion */}
              <div className={`rounded-2xl border overflow-hidden ${cardBg}`}>
                <button
                  type="button"
                  onClick={() => setAdvancedOpen((v) => !v)}
                  className="w-full px-3.5 py-2.5 flex items-center justify-between font-extrabold cursor-pointer"
                >
                  <span className="flex items-center gap-2">
                    <span>Advanced Custom Overrides</span>
                    {hasOverrides && (
                      <span className="px-1.5 py-0.5 rounded-md bg-amber-500/20 text-amber-600 dark:text-amber-300 text-[9px] font-bold">
                        Active
                      </span>
                    )}
                  </span>
                  {advancedOpen ? (
                    <ChevronDown className="w-4 h-4" />
                  ) : (
                    <ChevronRight className="w-4 h-4" />
                  )}
                </button>
                {advancedOpen && (
                  <div
                    className={`px-3.5 pb-3.5 pt-2.5 border-t space-y-2.5 ${
                      isDarkCanvas ? 'border-white/10' : 'border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <p className={`text-[10px] leading-snug ${mutedText}`}>
                        Override specific UI surfaces independently of the active palette.
                      </p>
                      <button
                        type="button"
                        onClick={() =>
                          setThemeConfig((prev) => ({
                            ...prev,
                            cardTint: '',
                            tableHeaderTint: '',
                            buttonColor: '',
                            buttonTextColor: '',
                            fontColor: '',
                          }))
                        }
                        className="text-[10px] font-bold text-rose-500 hover:underline shrink-0 cursor-pointer"
                      >
                        Clear Overrides
                      </button>
                    </div>
                    <div className="space-y-1.5">
                      {(
                        [
                          { key: 'cardTint', label: 'Card Surface Tint', fallback: '#ffffff' },
                          { key: 'tableHeaderTint', label: 'Table Header Tint', fallback: '#f8fafc' },
                          { key: 'buttonColor', label: 'Primary Button Color', fallback: '#059669' },
                          { key: 'buttonTextColor', label: 'Button Text Color', fallback: '#ffffff' },
                          { key: 'fontColor', label: 'Custom Font Color', fallback: '#0f172a' },
                        ] as const
                      ).map((item) => {
                        const currentVal = themeConfig[item.key];
                        return (
                          <div
                            key={item.key}
                            className={`flex items-center justify-between gap-2 p-2 rounded-xl border ${innerControlBg}`}
                          >
                            <label className="flex items-center gap-2 cursor-pointer min-w-0">
                              <input
                                type="color"
                                value={currentVal || item.fallback}
                                onChange={(e) =>
                                  setThemeConfig((prev) => ({
                                    ...prev,
                                    [item.key]: e.target.value,
                                  }))
                                }
                                className="w-6 h-6 rounded cursor-pointer border-0 bg-transparent p-0 shrink-0"
                              />
                              <span className="text-[11px] font-bold truncate">{item.label}</span>
                            </label>
                            {currentVal ? (
                              <button
                                type="button"
                                onClick={() =>
                                  setThemeConfig((prev) => ({ ...prev, [item.key]: '' }))
                                }
                                className="text-[10px] font-bold text-rose-500 hover:underline shrink-0 cursor-pointer"
                              >
                                Clear
                              </button>
                            ) : (
                              <span className={`text-[10px] font-semibold shrink-0 ${mutedText}`}>
                                Auto
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* 3. Sticky Footer Actions */}
        <div
          className={`shrink-0 px-5 py-3.5 border-t flex items-center justify-between gap-2 text-xs ${
            isDarkCanvas ? 'border-white/10 bg-slate-900/95' : 'border-slate-200 bg-white/95'
          }`}
        >
          <button
            type="button"
            onClick={handleResetToDefault}
            className={`inline-flex items-center gap-1 px-2.5 py-2 rounded-xl font-bold transition cursor-pointer ${
              isDarkCanvas
                ? 'text-slate-300 hover:bg-white/10'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
            title="Reset to clean default for current mode"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>Reset</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onCloseCancel}
              className={`px-3.5 py-2 rounded-xl font-bold transition cursor-pointer ${
                isDarkCanvas
                  ? 'text-slate-300 hover:bg-white/10'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={savingTheme}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold shadow-sm cursor-pointer disabled:opacity-60"
            >
              {savingTheme ? 'Saving...' : 'Save Theme'}
            </button>
          </div>
        </div>
      </form>
    </div>,
    document.body
  );
}
