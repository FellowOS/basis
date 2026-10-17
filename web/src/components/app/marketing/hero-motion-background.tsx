'use client';

import { useEffect, useMemo, useState } from 'react';

import SilkWaves from '@/components/app/shared/effects/silk-waves.js';
import { useTheme } from '@/lib/theme.js';

import { HeroBackground } from './hero-background.js';

/** Enough tonal spread for waves to read on white, still light overall. */
const LIGHT_SILK_COLORS = [
  '#ffffff',
  '#f5f0e8',
  '#eddcc4',
  '#e8c99a',
  '#d4880a',
  '#f0d4a8',
  '#e2e8f0',
  '#ffffff',
] as const;

const DARK_SILK_COLORS = [
  '#090b10',
  '#0c1018',
  '#121820',
  '#1a2230',
  '#d4880a',
  '#2a2110',
  '#243040',
  '#090b10',
] as const;

function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;
}

/** Animated silk-wave backdrop for the marketing hero. */
export function HeroMotionBackground() {
  const { theme } = useTheme();
  const isDark = theme === 'dark';
  const [reduceMotion, setReduceMotion] = useState(prefersReducedMotion);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = () => setReduceMotion(mq.matches);
    setReduceMotion(mq.matches);
    mq.addEventListener('change', onChange);
    return () => mq.removeEventListener('change', onChange);
  }, []);

  const silkProps = useMemo(
    () =>
      isDark
        ? {
            colors: [...DARK_SILK_COLORS],
            speed: 0.42,
            scale: 2.2,
            distortion: 0.85,
            curve: 0.9,
            contrast: 1.05,
            brightness: 0.92,
            opacity: 0.72,
            complexity: 1,
            frequency: 0.95,
            offsetY: -0.08,
          }
        : {
            colors: [...LIGHT_SILK_COLORS],
            speed: 0.34,
            scale: 2.35,
            distortion: 0.95,
            curve: 0.85,
            contrast: 1.15,
            brightness: 1.02,
            opacity: 0.88,
            complexity: 1,
            frequency: 1.05,
            offsetY: -0.1,
          },
    [isDark],
  );

  if (reduceMotion) {
    return <HeroBackground className="!absolute inset-0" />;
  }

  return (
    <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden>
      <div className="absolute inset-0 bg-[var(--hero-bg)]" />
      <SilkWaves className="absolute inset-0 mix-blend-multiply dark:mix-blend-normal" {...silkProps} />
      <div
        className="pointer-events-none absolute inset-0 dark:hidden"
        style={{
          background:
            'radial-gradient(ellipse 90% 55% at 50% -5%, rgb(212 136 10 / 0.14) 0%, rgb(212 136 10 / 0.04) 42%, transparent 68%)',
        }}
      />
      <div
        className="absolute inset-0 opacity-[0.12] dark:opacity-40"
        style={{
          background: 'var(--hero-glow-wash)',
          maskImage:
            'radial-gradient(ellipse 110% 70% at 50% 0%, #000 0%, #000 32%, transparent 72%)',
          WebkitMaskImage:
            'radial-gradient(ellipse 110% 70% at 50% 0%, #000 0%, #000 32%, transparent 72%)',
        }}
      />
      <div
        className="absolute inset-x-0 bottom-0 h-12 sm:h-16"
        style={{
          background: 'linear-gradient(to bottom, transparent, var(--hero-bg) 94%)',
        }}
      />
    </div>
  );
}
