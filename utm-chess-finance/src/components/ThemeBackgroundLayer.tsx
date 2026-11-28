'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { GridPattern } from './backgrounds/GridPattern';
import { DotPattern } from './backgrounds/DotPattern';
import {
  ClubThemeConfig,
  DYNAMIC_BG_OPTIONS,
  getColorsForMode,
  hexToRgba,
  isDynamicBgId,
} from '@/lib/themeConfig';

const Aurora = dynamic(() => import('./backgrounds/Aurora'), { ssr: false });
const SoftAurora = dynamic(() => import('./backgrounds/SoftAurora'), { ssr: false });
const Particles = dynamic(() => import('./backgrounds/Particles'), { ssr: false });
const Galaxy = dynamic(() => import('./backgrounds/Galaxy'), { ssr: false });
const LightRays = dynamic(() => import('./backgrounds/LightRays'), { ssr: false });
const DotGrid = dynamic(() => import('./backgrounds/DotGrid'), { ssr: false });

export interface ThemeBackgroundLayerProps {
  config: Pick<
    ClubThemeConfig,
    'backgroundId' | 'bgColors' | 'bgSpeed' | 'bgOpacity' | 'bgScrim'
  >;
  darkMode: boolean;
  /** Render absolute inside preview frames instead of fixed full-screen viewport */
  contained?: boolean;
}

export default function ThemeBackgroundLayer({
  config,
  darkMode,
  contained = false,
}: ThemeBackgroundLayerProps) {
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const sync = () => setReducedMotion(mq.matches);
    sync();
    mq.addEventListener('change', sync);
    return () => mq.removeEventListener('change', sync);
  }, []);

  if (!isDynamicBgId(config.backgroundId)) {
    return null;
  }

  const speed = reducedMotion ? 0 : Math.max(0, Math.min(1.5, config.bgSpeed ?? 0.7));
  const paused = reducedMotion || speed === 0;
  const opacity = Math.max(0.15, Math.min(1, config.bgOpacity ?? 0.75));
  const scrim = Math.max(0, Math.min(0.65, config.bgScrim ?? 0.15));

  const bgOpt = DYNAMIC_BG_OPTIONS.find((o) => o.id === config.backgroundId);
  const usesDarkDefaults =
    bgOpt &&
    config.bgColors?.primary?.toLowerCase() === bgOpt.defaultColors.primary.toLowerCase() &&
    config.bgColors?.secondary?.toLowerCase() === bgOpt.defaultColors.secondary.toLowerCase() &&
    config.bgColors?.accent?.toLowerCase() === bgOpt.defaultColors.accent.toLowerCase();

  const resolvedColors =
    !darkMode && bgOpt?.lightColors && usesDarkDefaults
      ? getColorsForMode(bgOpt, false)
      : {
          primary: config.bgColors?.primary || (bgOpt ? getColorsForMode(bgOpt, darkMode).primary : '#10b981'),
          secondary:
            config.bgColors?.secondary || (bgOpt ? getColorsForMode(bgOpt, darkMode).secondary : '#0ea5e9'),
          accent: config.bgColors?.accent || (bgOpt ? getColorsForMode(bgOpt, darkMode).accent : '#f59e0b'),
        };

  const { primary, secondary, accent } = resolvedColors;

  const isMeshBg = config.backgroundId.startsWith('mesh-');
  const meshBaseColors: Record<string, string> = {
    'mesh-sunrise': '#FFFBF7',
    'mesh-botanical': '#F6FCF9',
    'mesh-lavender': '#FBFAFF',
    'mesh-ocean-glass': '#F4F9FF',
  };

  const positionClass = contained
    ? 'pointer-events-none absolute inset-0 -z-10 overflow-hidden'
    : 'pointer-events-none fixed inset-0 -z-10 overflow-hidden';

  const renderMeshLayer = () => {
    const a1 = darkMode ? 0.24 * opacity : 0.48 * opacity;
    const a2 = darkMode ? 0.2 * opacity : 0.42 * opacity;
    const a3 = darkMode ? 0.18 * opacity : 0.4 * opacity;

    const layers: string[] = [
      `radial-gradient(65% 55% at 10% 8%, ${hexToRgba(primary, a1)} 0%, transparent 65%)`,
      `radial-gradient(60% 50% at 92% 14%, ${hexToRgba(secondary, a2)} 0%, transparent 65%)`,
      `radial-gradient(70% 55% at 52% 94%, ${hexToRgba(accent, a3)} 0%, transparent 68%)`,
    ];

    const hasDots = config.backgroundId === 'mesh-botanical';
    const hasGrid = config.backgroundId === 'mesh-ocean-glass';

    return (
      <div
        className="absolute inset-0"
        style={{
          backgroundColor: darkMode ? '#070910' : meshBaseColors[config.backgroundId] || '#F8FAFC',
          backgroundImage: layers.join(', '),
        }}
      >
        {hasDots && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: darkMode
                ? 'radial-gradient(rgba(255,255,255,0.08) 1px, transparent 1px)'
                : 'radial-gradient(rgba(15,23,42,0.09) 1px, transparent 1px)',
              backgroundSize: '22px 22px',
              opacity: Math.min(1, opacity * 0.9),
            }}
          />
        )}
        {hasGrid && (
          <div
            className="absolute inset-0"
            style={{
              backgroundImage: darkMode
                ? 'linear-gradient(to right, rgba(255,255,255,0.05) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.05) 1px, transparent 1px)'
                : 'linear-gradient(to right, rgba(15,23,42,0.055) 1px, transparent 1px), linear-gradient(to bottom, rgba(15,23,42,0.055) 1px, transparent 1px)',
              backgroundSize: '36px 36px',
              maskImage: 'radial-gradient(ellipse at center, black 45%, transparent 100%)',
              WebkitMaskImage: 'radial-gradient(ellipse at center, black 45%, transparent 100%)',
            }}
          />
        )}
      </div>
    );
  };

  const renderEffect = () => {
    switch (config.backgroundId) {
      case 'mesh-sunrise':
      case 'mesh-botanical':
      case 'mesh-lavender':
      case 'mesh-ocean-glass':
        return renderMeshLayer();
      case 'rb-aurora':
        return (
          <Aurora
            colorStops={[primary, secondary, accent]}
            speed={speed}
            opacity={opacity}
            lightMode={!darkMode}
            paused={paused}
            mouseInteraction={false}
            intro={false}
          />
        );
      case 'rb-soft-aurora':
        return (
          <SoftAurora
            color1={primary}
            color2={secondary}
            speed={speed}
            opacity={opacity}
            lightMode={!darkMode}
            enableMouseInteraction={false}
            intro={false}
          />
        );
      case 'rb-particles':
        return (
          <Particles
            particleColors={[primary, secondary, accent]}
            speed={speed * 0.25}
            opacity={opacity}
            lightMode={!darkMode}
            paused={paused}
            particleCount={140}
            moveParticlesOnHover={false}
            intro={false}
          />
        );
      case 'rb-galaxy':
        return (
          <Galaxy
            starColors={[primary, secondary, accent]}
            speed={speed}
            starSpeed={speed * 0.45}
            opacity={opacity}
            lightMode={!darkMode}
            disableAnimation={paused}
            transparent
            mouseInteraction={false}
            intro={false}
          />
        );
      case 'rb-light-rays':
        return (
          <LightRays
            raysOrigin="top-center"
            raysColor={primary}
            raysSpeed={speed}
            opacity={opacity}
            lightMode={!darkMode}
            followMouse={false}
            intro={false}
          />
        );
      case 'rb-dot-grid':
        return (
          <DotGrid
            baseColor={primary}
            activeColor={accent}
            dotSize={4}
            gap={22}
            opacity={opacity}
            paused={paused}
            mouseInteraction={false}
            intro={false}
          />
        );
      case 'mu-grid-pattern':
        return (
          <GridPattern
            width={36}
            height={36}
            style={{
              stroke: primary,
              fill: secondary,
              opacity,
            }}
            className="[mask-image:radial-gradient(ellipse_at_center,white_60%,transparent_100%)]"
          />
        );
      case 'mu-dot-pattern':
        return (
          <DotPattern
            width={22}
            height={22}
            cr={1.25}
            glow={!paused && speed > 0}
            style={{
              color: primary,
              opacity,
            }}
            className="[mask-image:radial-gradient(ellipse_at_center,white_65%,transparent_100%)]"
          />
        );
      default:
        return null;
    }
  };

  return (
    <div
      className={`${positionClass} ${darkMode ? 'bg-[#070910]' : 'bg-[#F8FAFC]'}`}
      aria-hidden="true"
    >
      {!darkMode && !isMeshBg && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 12% 0%, ${hexToRgba(primary, 0.22)} 0%, transparent 56%), radial-gradient(ellipse at 88% 100%, ${hexToRgba(secondary, 0.2)} 0%, transparent 58%), radial-gradient(ellipse at 50% 45%, ${hexToRgba(accent, 0.1)} 0%, transparent 62%)`,
          }}
        />
      )}
      <div className="absolute inset-0">{renderEffect()}</div>
      {scrim > 0 && (
        <div
          className="absolute inset-0 transition-opacity duration-300"
          style={{
            backgroundColor: darkMode
              ? `rgba(4, 7, 17, ${scrim.toFixed(2)})`
              : `rgba(255, 255, 255, ${(scrim * 0.55).toFixed(2)})`,
          }}
        />
      )}
    </div>
  );
}
