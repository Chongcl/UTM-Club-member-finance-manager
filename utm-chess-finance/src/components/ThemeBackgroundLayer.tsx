'use client';

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { GridPattern } from './backgrounds/GridPattern';
import { DotPattern } from './backgrounds/DotPattern';
import { ClubThemeConfig, isDynamicBgId } from '@/lib/themeConfig';

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

  const primary = config.bgColors?.primary || '#10b981';
  const secondary = config.bgColors?.secondary || '#0ea5e9';
  const accent = config.bgColors?.accent || '#f59e0b';

  const baseCanvasClass = darkMode ? 'bg-[#070910]' : 'bg-[#F8FAFC]';
  const positionClass = contained
    ? 'pointer-events-none absolute inset-0 -z-10 overflow-hidden'
    : 'pointer-events-none fixed inset-0 -z-10 overflow-hidden';

  const renderEffect = () => {
    switch (config.backgroundId) {
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
    <div className={`${positionClass} ${baseCanvasClass}`} aria-hidden="true">
      {!darkMode && (
        <div
          className="absolute inset-0"
          style={{
            background: `radial-gradient(ellipse at 12% 0%, ${primary}14 0%, transparent 55%), radial-gradient(ellipse at 88% 100%, ${secondary}12 0%, transparent 55%)`,
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
              : `rgba(248, 250, 252, ${scrim.toFixed(2)})`,
          }}
        />
      )}
    </div>
  );
}
