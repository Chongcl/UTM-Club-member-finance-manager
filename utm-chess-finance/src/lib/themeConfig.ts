export type MeshBackdropId =
  | ''
  | 'mesh-sunrise'
  | 'mesh-botanical'
  | 'mesh-lavender'
  | 'mesh-ocean-glass';

export const MESH_BACKDROP_IDS = [
  'mesh-sunrise',
  'mesh-botanical',
  'mesh-lavender',
  'mesh-ocean-glass',
] as const;

export type DynamicBgId =
  | 'mesh-sunrise'
  | 'mesh-botanical'
  | 'mesh-lavender'
  | 'mesh-ocean-glass'
  | 'rb-aurora'
  | 'rb-soft-aurora'
  | 'rb-particles'
  | 'rb-galaxy'
  | 'rb-light-rays'
  | 'rb-dot-grid'
  | 'mu-grid-pattern'
  | 'mu-dot-pattern';

export type ColorPaletteId =
  | 'default'
  | 'obsidian-amber'
  | 'aion-cosmic'
  | 'emerald-matrix'
  | 'porcelain-ocean'
  | 'solar-mist'
  | 'emerald-dew'
  | 'rose-quartz'
  | 'custom';

export type SurfaceMode = 'liquid-glass' | 'classic';

export interface ClubThemeConfig {
  backgroundId: string;
  bgMesh?: MeshBackdropId;
  bgColors: {
    primary: string;
    secondary: string;
    accent: string;
  };
  bgSpeed: number;
  bgOpacity: number;
  bgScrim: number;
  colorPalette: ColorPaletteId;
  customAccent: string;
  surfaceMode: SurfaceMode;
  glassBlur: number;
  glassOpacity: number;
  mobileNavGlass: boolean;
  // Granular design overrides (empty string = follow selected theme palette)
  cardTint: string;
  tableHeaderTint: string;
  buttonColor: string;
  buttonTextColor: string;
  fontColor: string;
}

export const DYNAMIC_BG_IDS: readonly DynamicBgId[] = [
  'mesh-sunrise',
  'mesh-botanical',
  'mesh-lavender',
  'mesh-ocean-glass',
  'rb-aurora',
  'rb-soft-aurora',
  'rb-particles',
  'rb-galaxy',
  'rb-light-rays',
  'rb-dot-grid',
  'mu-grid-pattern',
  'mu-dot-pattern',
];

export function isDynamicBgId(id?: string | null): id is DynamicBgId {
  return Boolean(id && (DYNAMIC_BG_IDS as readonly string[]).includes(id));
}

export const DEFAULT_THEME_CONFIG: ClubThemeConfig = {
  backgroundId: 'emerald-aurora',
  bgMesh: '',
  bgColors: {
    primary: '#10b981',
    secondary: '#0ea5e9',
    accent: '#f59e0b',
  },
  bgSpeed: 0.7,
  bgOpacity: 0.75,
  bgScrim: 0.15,
  colorPalette: 'default',
  customAccent: '#059669',
  surfaceMode: 'liquid-glass',
  glassBlur: 18,
  glassOpacity: 0.72,
  mobileNavGlass: true,
  cardTint: '',
  tableHeaderTint: '',
  buttonColor: '',
  buttonTextColor: '',
  fontColor: '',
};

export interface DynamicBgOption {
  id: DynamicBgId;
  source: 'mesh' | 'react-bits' | 'magic-ui';
  name: string;
  desc: string;
  preview: string;
  recommendedMode: 'dark' | 'light' | 'both';
  defaultColors: { primary: string; secondary: string; accent: string };
  lightColors?: { primary: string; secondary: string; accent: string };
}

export function getColorsForMode(
  opt: DynamicBgOption,
  darkMode: boolean
): { primary: string; secondary: string; accent: string } {
  return !darkMode && opt.lightColors ? { ...opt.lightColors } : { ...opt.defaultColors };
}

export const DYNAMIC_BG_OPTIONS: DynamicBgOption[] = [
  {
    id: 'mesh-sunrise',
    source: 'mesh',
    name: 'Sunrise Glass Mesh',
    desc: 'Warm peach, soft rose & sky-blue ambient glow for crisp daylight cards',
    preview:
      'radial-gradient(at 15% 15%, #fed7aa 0, transparent 55%), radial-gradient(at 85% 20%, #fbcfe8 0, transparent 55%), radial-gradient(at 50% 85%, #bae6fd 0, transparent 60%), #fffbf7',
    recommendedMode: 'light',
    defaultColors: { primary: '#fb923c', secondary: '#f472b6', accent: '#38bdf8' },
    lightColors: { primary: '#fdba74', secondary: '#f9a8d4', accent: '#7dd3fc' },
  },
  {
    id: 'mesh-botanical',
    source: 'mesh',
    name: 'Botanical Mint Wash',
    desc: 'Fresh mint, seafoam teal & soft lemon wash with fine architectural dots',
    preview:
      'radial-gradient(at 15% 15%, #a7f3d0 0, transparent 55%), radial-gradient(at 85% 20%, #fef08a 0, transparent 55%), radial-gradient(at 50% 85%, #99f6e4 0, transparent 60%), #f6fcf9',
    recommendedMode: 'light',
    defaultColors: { primary: '#10b981', secondary: '#14b8a6', accent: '#eab308' },
    lightColors: { primary: '#6ee7b7', secondary: '#5eead4', accent: '#fde047' },
  },
  {
    id: 'mesh-lavender',
    source: 'mesh',
    name: 'Lavender Cloud Veil',
    desc: 'Pastel violet, cotton-candy sky & blush blobs in airy porcelain light',
    preview:
      'radial-gradient(at 15% 15%, #ddd6fe 0, transparent 55%), radial-gradient(at 85% 20%, #bae6fd 0, transparent 55%), radial-gradient(at 50% 85%, #fecdd3 0, transparent 60%), #fbfaff',
    recommendedMode: 'light',
    defaultColors: { primary: '#a78bfa', secondary: '#38bdf8', accent: '#fb7185' },
    lightColors: { primary: '#c4b5fd', secondary: '#7dd3fc', accent: '#fda4af' },
  },
  {
    id: 'mesh-ocean-glass',
    source: 'mesh',
    name: 'Ocean Porcelain Grid',
    desc: 'Luminous cyan, porcelain blue & crisp geometric hairline grid',
    preview:
      'radial-gradient(at 15% 15%, #a5f3fc 0, transparent 55%), radial-gradient(at 85% 25%, #bfdbfe 0, transparent 55%), radial-gradient(at 50% 90%, #c7d2fe 0, transparent 60%), #f4f9ff',
    recommendedMode: 'light',
    defaultColors: { primary: '#06b6d4', secondary: '#3b82f6', accent: '#6366f1' },
    lightColors: { primary: '#67e8f9', secondary: '#93c5fd', accent: '#a5b4fc' },
  },
  {
    id: 'rb-aurora',
    source: 'react-bits',
    name: 'React Bits · Aurora Ribbons',
    desc: 'Flowing multi-stop luminous aurora waves for Dark & Light modes',
    preview: 'linear-gradient(135deg, #0ea5e9 0%, #10b981 50%, #f59e0b 100%)',
    recommendedMode: 'both',
    defaultColors: { primary: '#10b981', secondary: '#0ea5e9', accent: '#f59e0b' },
    lightColors: { primary: '#38bdf8', secondary: '#34d399', accent: '#fbbf24' },
  },
  {
    id: 'rb-soft-aurora',
    source: 'react-bits',
    name: 'React Bits · Soft Aurora Mist',
    desc: 'Ultra-smooth diffused atmospheric color silk with organic flow',
    preview: 'linear-gradient(135deg, #fde68a 0%, #93c5fd 55%, #c4b5fd 100%)',
    recommendedMode: 'both',
    defaultColors: { primary: '#fdba74', secondary: '#93c5fd', accent: '#c4b5fd' },
    lightColors: { primary: '#fb923c', secondary: '#60a5fa', accent: '#c084fc' },
  },
  {
    id: 'rb-particles',
    source: 'react-bits',
    name: 'React Bits · Cosmic Particles',
    desc: 'Drifting micro-particles & subtle constellations in 3D space',
    preview: 'linear-gradient(135deg, #040712 0%, #1e293b 60%, #fb923c 100%)',
    recommendedMode: 'both',
    defaultColors: { primary: '#e2e8f0', secondary: '#38bdf8', accent: '#fb923c' },
    lightColors: { primary: '#0ea5e9', secondary: '#10b981', accent: '#f97316' },
  },
  {
    id: 'rb-galaxy',
    source: 'react-bits',
    name: 'React Bits · Deep Galaxy Starfield',
    desc: 'Layered deep-space twinkling starfield with soft nebula tint',
    preview: 'linear-gradient(135deg, #020617 0%, #0f172a 55%, #3b82f6 100%)',
    recommendedMode: 'dark',
    defaultColors: { primary: '#e2e8f0', secondary: '#60a5fa', accent: '#fb923c' },
    lightColors: { primary: '#2563eb', secondary: '#0d9488', accent: '#f59e0b' },
  },
  {
    id: 'rb-light-rays',
    source: 'react-bits',
    name: 'React Bits · Volumetric Light Rays',
    desc: 'Top-down atmospheric light beams (emerald, gold, or porcelain)',
    preview: 'linear-gradient(180deg, #10b981 0%, #050a07 75%, #020617 100%)',
    recommendedMode: 'both',
    defaultColors: { primary: '#10b981', secondary: '#4ade80', accent: '#34d399' },
    lightColors: { primary: '#0d9488', secondary: '#34d399', accent: '#38bdf8' },
  },
  {
    id: 'rb-dot-grid',
    source: 'react-bits',
    name: 'React Bits · Architectural Dot Grid',
    desc: 'Interactive WebGL geometric studio grid with subtle ripple glow',
    preview: 'radial-gradient(rgba(56,189,248,0.45) 1.5px, transparent 1.5px), linear-gradient(135deg, #0f172a 0%, #1e293b 100%)',
    recommendedMode: 'both',
    defaultColors: { primary: '#64748b', secondary: '#94a3b8', accent: '#38bdf8' },
    lightColors: { primary: '#64748b', secondary: '#94a3b8', accent: '#0284c7' },
  },
  {
    id: 'mu-grid-pattern',
    source: 'magic-ui',
    name: 'Magic UI · Architectural Hairline Grid',
    desc: 'Ultra-lightweight crisp technical hairline grid (ideal for Light Mode)',
    preview: 'linear-gradient(to right, rgba(148,163,184,0.22) 1px, transparent 1px), linear-gradient(to bottom, rgba(148,163,184,0.22) 1px, transparent 1px), #f5f7fb',
    recommendedMode: 'light',
    defaultColors: { primary: '#94a3b8', secondary: '#cbd5e1', accent: '#38bdf8' },
    lightColors: { primary: '#64748b', secondary: '#cbd5e1', accent: '#38bdf8' },
  },
  {
    id: 'mu-dot-pattern',
    source: 'magic-ui',
    name: 'Magic UI · Optical Dot Pattern',
    desc: 'Lightweight SVG radial-faded dot matrix with optional gentle shimmer',
    preview: 'radial-gradient(rgba(16,185,129,0.42) 1.5px, transparent 1.5px), #f4faf7',
    recommendedMode: 'light',
    defaultColors: { primary: '#34d399', secondary: '#a7f3d0', accent: '#059669' },
    lightColors: { primary: '#10b981', secondary: '#34d399', accent: '#059669' },
  },
];

export interface ColorPaletteOption {
  id: ColorPaletteId;
  label: string;
  modeHint: 'Both' | 'Dark' | 'Light';
  accent: string;
  hover: string;
  soft: string;
  cardHintLight: string;
  cardHintDark: string;
}

export const COLOR_PALETTE_OPTIONS: ColorPaletteOption[] = [
  {
    id: 'default',
    label: 'ClubSync Emerald',
    modeHint: 'Both',
    accent: '#059669',
    hover: '#047857',
    soft: 'rgba(16, 185, 129, 0.14)',
    cardHintLight: '#ffffff',
    cardHintDark: '#0f172a',
  },
  {
    id: 'obsidian-amber',
    label: 'Obsidian Amber',
    modeHint: 'Dark',
    accent: '#f59e0b',
    hover: '#d97706',
    soft: 'rgba(245, 158, 11, 0.16)',
    cardHintLight: '#fffbeb',
    cardHintDark: '#0b0f19',
  },
  {
    id: 'aion-cosmic',
    label: 'Aion Cosmic Blue',
    modeHint: 'Dark',
    accent: '#3b82f6',
    hover: '#2563eb',
    soft: 'rgba(59, 130, 246, 0.16)',
    cardHintLight: '#eff6ff',
    cardHintDark: '#070b18',
  },
  {
    id: 'emerald-matrix',
    label: 'Emerald Matrix',
    modeHint: 'Dark',
    accent: '#10b981',
    hover: '#059669',
    soft: 'rgba(16, 185, 129, 0.18)',
    cardHintLight: '#ecfdf5',
    cardHintDark: '#06120d',
  },
  {
    id: 'porcelain-ocean',
    label: 'Porcelain Ocean',
    modeHint: 'Light',
    accent: '#0284c7',
    hover: '#0369a1',
    soft: 'rgba(2, 132, 199, 0.14)',
    cardHintLight: '#f8fafc',
    cardHintDark: '#0c1524',
  },
  {
    id: 'solar-mist',
    label: 'Solar Mist',
    modeHint: 'Light',
    accent: '#ea580c',
    hover: '#c2410c',
    soft: 'rgba(234, 88, 12, 0.14)',
    cardHintLight: '#fffaf5',
    cardHintDark: '#16100c',
  },
  {
    id: 'emerald-dew',
    label: 'Emerald Dew',
    modeHint: 'Light',
    accent: '#0d9488',
    hover: '#0f766e',
    soft: 'rgba(13, 148, 136, 0.14)',
    cardHintLight: '#f4fbf8',
    cardHintDark: '#071512',
  },
  {
    id: 'rose-quartz',
    label: 'Rose Quartz',
    modeHint: 'Both',
    accent: '#e11d48',
    hover: '#be123c',
    soft: 'rgba(225, 29, 72, 0.14)',
    cardHintLight: '#fff5f7',
    cardHintDark: '#180c12',
  },
  {
    id: 'custom',
    label: 'Custom Hex',
    modeHint: 'Both',
    accent: '#059669',
    hover: '#047857',
    soft: 'rgba(5, 150, 105, 0.15)',
    cardHintLight: '#ffffff',
    cardHintDark: '#0f172a',
  },
];

export interface StarterThemePreset {
  id: string;
  name: string;
  mode: 'dark' | 'light';
  subtitle: string;
  swatch: string;
  patch: Partial<ClubThemeConfig>;
}

export const STARTER_THEME_PRESETS: StarterThemePreset[] = [
  {
    id: 'starter-liquid-obsidian',
    name: 'Liquid Obsidian',
    mode: 'dark',
    subtitle: 'Aurora + Obsidian Amber',
    swatch: 'linear-gradient(135deg, #070910 0%, #3B82F6 55%, #F59E0B 100%)',
    patch: {
      backgroundId: 'rb-aurora',
      bgColors: { primary: '#070910', secondary: '#3B82F6', accent: '#F59E0B' },
      bgSpeed: 0.65,
      bgOpacity: 0.8,
      bgScrim: 0.18,
      colorPalette: 'obsidian-amber',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.72,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-aion-cosmic',
    name: 'Aion Cosmic',
    mode: 'dark',
    subtitle: 'Galaxy Starfield + Cosmic Copper',
    swatch: 'linear-gradient(135deg, #040712 0%, #E2E8F0 55%, #FB923C 100%)',
    patch: {
      backgroundId: 'rb-galaxy',
      bgColors: { primary: '#040712', secondary: '#E2E8F0', accent: '#FB923C' },
      bgSpeed: 0.6,
      bgOpacity: 0.85,
      bgScrim: 0.12,
      colorPalette: 'aion-cosmic',
      surfaceMode: 'liquid-glass',
      glassBlur: 20,
      glassOpacity: 0.7,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-emerald-matrix',
    name: 'Emerald Matrix',
    mode: 'dark',
    subtitle: 'Light Rays + Bioluminescent Mint',
    swatch: 'linear-gradient(135deg, #050A07 0%, #10B981 55%, #4ADE80 100%)',
    patch: {
      backgroundId: 'rb-light-rays',
      bgColors: { primary: '#10B981', secondary: '#4ADE80', accent: '#050A07' },
      bgSpeed: 0.7,
      bgOpacity: 0.78,
      bgScrim: 0.15,
      colorPalette: 'emerald-matrix',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.74,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-sunrise-glass',
    name: 'Sunrise Glass',
    mode: 'light',
    subtitle: 'Sunrise Mesh + Solar Mist Glass',
    swatch:
      'radial-gradient(at 20% 20%, #fed7aa 0, transparent 60%), radial-gradient(at 80% 80%, #bae6fd 0, transparent 60%), linear-gradient(135deg, #fffbf7 0%, #fbcfe8 100%)',
    patch: {
      backgroundId: 'mesh-sunrise',
      bgColors: { primary: '#fdba74', secondary: '#f9a8d4', accent: '#7dd3fc' },
      bgSpeed: 0.6,
      bgOpacity: 0.85,
      bgScrim: 0.08,
      colorPalette: 'solar-mist',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.74,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-botanical-mint',
    name: 'Botanical Mint',
    mode: 'light',
    subtitle: 'Botanical Mesh + Emerald Dew',
    swatch:
      'radial-gradient(at 20% 20%, #a7f3d0 0, transparent 60%), radial-gradient(at 85% 25%, #fef08a 0, transparent 60%), linear-gradient(135deg, #f6fcf9 0%, #99f6e4 100%)',
    patch: {
      backgroundId: 'mesh-botanical',
      bgColors: { primary: '#6ee7b7', secondary: '#5eead4', accent: '#fde047' },
      bgSpeed: 0.6,
      bgOpacity: 0.85,
      bgScrim: 0.08,
      colorPalette: 'emerald-dew',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.74,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-lavender-cloud',
    name: 'Lavender Cloud',
    mode: 'light',
    subtitle: 'Lavender Mesh + Rose Quartz',
    swatch:
      'radial-gradient(at 20% 20%, #ddd6fe 0, transparent 60%), radial-gradient(at 85% 80%, #fecdd3 0, transparent 60%), linear-gradient(135deg, #fbfaff 0%, #bae6fd 100%)',
    patch: {
      backgroundId: 'mesh-lavender',
      bgColors: { primary: '#c4b5fd', secondary: '#7dd3fc', accent: '#fda4af' },
      bgSpeed: 0.6,
      bgOpacity: 0.85,
      bgScrim: 0.08,
      colorPalette: 'rose-quartz',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.74,
      mobileNavGlass: true,
    },
  },
  {
    id: 'starter-porcelain-aurora',
    name: 'Porcelain Aurora',
    mode: 'light',
    subtitle: 'Aurora Ribbons + Porcelain Ocean',
    swatch: 'linear-gradient(135deg, #F5F7FB 0%, #38BDF8 50%, #34D399 100%)',
    patch: {
      backgroundId: 'rb-aurora',
      bgColors: { primary: '#38bdf8', secondary: '#34d399', accent: '#fbbf24' },
      bgSpeed: 0.65,
      bgOpacity: 0.75,
      bgScrim: 0.1,
      colorPalette: 'porcelain-ocean',
      surfaceMode: 'liquid-glass',
      glassBlur: 18,
      glassOpacity: 0.76,
      mobileNavGlass: true,
    },
  },
];

function clampNum(val: unknown, min: number, max: number, fallback: number): number {
  const num = Number(val);
  if (!Number.isFinite(num)) return fallback;
  return Math.min(max, Math.max(min, num));
}

function safeHex(val: unknown, fallback = ''): string {
  if (typeof val !== 'string') return fallback;
  const trimmed = val.trim();
  if (/^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)) return trimmed;
  return fallback;
}

export function decodeThemeConfig(raw?: string | null): ClubThemeConfig {
  if (!raw || typeof raw !== 'string') return { ...DEFAULT_THEME_CONFIG };
  const trimmed = raw.trim();
  if (!trimmed) return { ...DEFAULT_THEME_CONFIG };

  if (trimmed.startsWith('json:') || trimmed.startsWith('{')) {
    try {
      const jsonStr = trimmed.startsWith('json:') ? trimmed.slice(5) : trimmed;
      const parsed = JSON.parse(jsonStr) as Partial<ClubThemeConfig>;
      const validPaletteIds = new Set(COLOR_PALETTE_OPTIONS.map((p) => p.id));
      const colorPalette: ColorPaletteId =
        parsed.colorPalette && validPaletteIds.has(parsed.colorPalette)
          ? parsed.colorPalette
          : 'default';

      const validMeshIds = new Set<string>(MESH_BACKDROP_IDS);
      const bgMesh: MeshBackdropId =
        typeof parsed.bgMesh === 'string' && validMeshIds.has(parsed.bgMesh.trim())
          ? (parsed.bgMesh.trim() as MeshBackdropId)
          : '';

      return {
        backgroundId:
          typeof parsed.backgroundId === 'string' && parsed.backgroundId.trim()
            ? parsed.backgroundId.trim()
            : DEFAULT_THEME_CONFIG.backgroundId,
        bgMesh,
        bgColors: {
          primary: safeHex(parsed.bgColors?.primary, DEFAULT_THEME_CONFIG.bgColors.primary),
          secondary: safeHex(parsed.bgColors?.secondary, DEFAULT_THEME_CONFIG.bgColors.secondary),
          accent: safeHex(parsed.bgColors?.accent, DEFAULT_THEME_CONFIG.bgColors.accent),
        },
        bgSpeed: clampNum(parsed.bgSpeed, 0, 1.5, DEFAULT_THEME_CONFIG.bgSpeed),
        bgOpacity: clampNum(parsed.bgOpacity, 0.15, 1.0, DEFAULT_THEME_CONFIG.bgOpacity),
        bgScrim: clampNum(parsed.bgScrim, 0, 0.65, DEFAULT_THEME_CONFIG.bgScrim),
        colorPalette,
        customAccent: safeHex(parsed.customAccent, DEFAULT_THEME_CONFIG.customAccent),
        surfaceMode: parsed.surfaceMode === 'classic' ? 'classic' : 'liquid-glass',
        glassBlur: clampNum(parsed.glassBlur, 8, 28, DEFAULT_THEME_CONFIG.glassBlur),
        glassOpacity: clampNum(parsed.glassOpacity, 0.45, 0.9, DEFAULT_THEME_CONFIG.glassOpacity),
        mobileNavGlass: parsed.mobileNavGlass !== false,
        cardTint: safeHex(parsed.cardTint, ''),
        tableHeaderTint: safeHex(parsed.tableHeaderTint, ''),
        buttonColor: safeHex(parsed.buttonColor, ''),
        buttonTextColor: safeHex(parsed.buttonTextColor, ''),
        fontColor: safeHex(parsed.fontColor, ''),
      };
    } catch {
      return { ...DEFAULT_THEME_CONFIG };
    }
  }

  return {
    ...DEFAULT_THEME_CONFIG,
    backgroundId: trimmed,
  };
}

export function encodeThemeConfig(cfg: ClubThemeConfig): string {
  const hasCustomizations =
    isDynamicBgId(cfg.backgroundId) ||
    Boolean(cfg.bgMesh) ||
    cfg.colorPalette !== 'default' ||
    cfg.surfaceMode !== DEFAULT_THEME_CONFIG.surfaceMode ||
    cfg.glassBlur !== DEFAULT_THEME_CONFIG.glassBlur ||
    cfg.glassOpacity !== DEFAULT_THEME_CONFIG.glassOpacity ||
    cfg.mobileNavGlass !== DEFAULT_THEME_CONFIG.mobileNavGlass ||
    Boolean(cfg.cardTint) ||
    Boolean(cfg.tableHeaderTint) ||
    Boolean(cfg.buttonColor) ||
    Boolean(cfg.buttonTextColor) ||
    Boolean(cfg.fontColor);

  if (!hasCustomizations) {
    return cfg.backgroundId || DEFAULT_THEME_CONFIG.backgroundId;
  }

  return `json:${JSON.stringify(cfg)}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const full =
    clean.length === 3
      ? clean
          .split('')
          .map((c) => c + c)
          .join('')
      : clean;
  if (full.length !== 6) return hex;
  const r = parseInt(full.slice(0, 2), 16);
  const g = parseInt(full.slice(2, 4), 16);
  const b = parseInt(full.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(2)})`;
}

export function applyThemeConfigToDocument(cfg: ClubThemeConfig, darkMode: boolean): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  const palette =
    COLOR_PALETTE_OPTIONS.find((p) => p.id === cfg.colorPalette) || COLOR_PALETTE_OPTIONS[0];

  const accentHex =
    cfg.buttonColor ||
    (cfg.colorPalette === 'custom' && cfg.customAccent ? cfg.customAccent : palette.accent);

  root.setAttribute('data-color-theme', cfg.colorPalette);
  root.setAttribute('data-surface-mode', cfg.surfaceMode);
  root.style.setProperty('--lg-blur', `${clampNum(cfg.glassBlur, 8, 28, 18)}px`);
  root.style.setProperty('--lg-tint-opacity', `${clampNum(cfg.glassOpacity, 0.45, 0.9, 0.72)}`);
  root.style.setProperty('--lg-accent', accentHex);
  root.style.setProperty(
    '--lg-accent-hover',
    cfg.buttonColor ? cfg.buttonColor : cfg.colorPalette === 'custom' ? cfg.customAccent : palette.hover
  );
  root.style.setProperty('--lg-accent-soft', hexToRgba(accentHex, darkMode ? 0.18 : 0.13));

  if (cfg.cardTint) {
    root.setAttribute('data-has-card-tint', 'true');
    root.style.setProperty(
      '--lg-card-bg',
      hexToRgba(cfg.cardTint, clampNum(cfg.glassOpacity, 0.45, 0.94, 0.82))
    );
  } else {
    root.removeAttribute('data-has-card-tint');
    root.style.removeProperty('--lg-card-bg');
  }

  if (cfg.tableHeaderTint) {
    root.setAttribute('data-has-table-tint', 'true');
    root.style.setProperty('--lg-table-head-bg', hexToRgba(cfg.tableHeaderTint, darkMode ? 0.35 : 0.85));
  } else {
    root.removeAttribute('data-has-table-tint');
    root.style.removeProperty('--lg-table-head-bg');
  }

  if (cfg.buttonColor || cfg.colorPalette !== 'default') {
    root.setAttribute('data-has-btn-tint', 'true');
    root.style.setProperty('--lg-btn-bg', accentHex);
    root.style.setProperty('--lg-btn-text', cfg.buttonTextColor || '#ffffff');
  } else {
    root.removeAttribute('data-has-btn-tint');
    root.style.removeProperty('--lg-btn-bg');
    root.style.removeProperty('--lg-btn-text');
  }

  if (cfg.fontColor) {
    root.setAttribute('data-has-font-color', 'true');
    root.style.setProperty('--lg-font-color', cfg.fontColor);
  } else {
    root.removeAttribute('data-has-font-color');
    root.style.removeProperty('--lg-font-color');
  }
}

export function clearThemeConfigFromDocument(): void {
  if (typeof document === 'undefined') return;
  const root = document.documentElement;
  root.removeAttribute('data-color-theme');
  root.removeAttribute('data-surface-mode');
  root.removeAttribute('data-has-card-tint');
  root.removeAttribute('data-has-table-tint');
  root.removeAttribute('data-has-btn-tint');
  root.removeAttribute('data-has-font-color');
  for (const prop of [
    '--lg-blur',
    '--lg-tint-opacity',
    '--lg-accent',
    '--lg-accent-hover',
    '--lg-accent-soft',
    '--lg-card-bg',
    '--lg-table-head-bg',
    '--lg-btn-bg',
    '--lg-btn-text',
    '--lg-font-color',
  ]) {
    root.style.removeProperty(prop);
  }
}
