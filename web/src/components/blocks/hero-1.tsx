'use client';

import type { ReactNode } from 'react';
import { motion } from 'motion/react';

import { HeroMotionBackground } from '@/components/marketing/hero-motion-background.js';
import { cn } from '@/lib/utils.js';

export type Hero1Props = {
  pillText: string;
  headline: string;
  subhead: string;
  highlights: readonly string[];
  aside: ReactNode;
  footerCopyright: string;
  footerTagline: string;
};

export function Hero1({
  pillText,
  headline,
  subhead,
  highlights,
  aside,
  footerCopyright,
  footerTagline,
}: Hero1Props) {
  const headlineSingleLine = headline.length <= 22;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden px-4 pb-2 pt-14 sm:px-6 sm:pb-3 sm:pt-16">
      <HeroMotionBackground />

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10 xl:gap-14">
          <div className="flex min-h-0 flex-col justify-center lg:pr-4">
            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.08 }}
              className="text-xs tracking-wide text-muted-foreground sm:text-sm"
            >
              {pillText}
            </motion.p>

            <motion.h1
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.14 }}
              className={cn(
                'mt-2 font-display text-xl font-semibold leading-[1.08] tracking-[-0.035em] sm:mt-2.5 sm:text-2xl md:text-3xl lg:mt-3 lg:text-[2.65rem]',
                headlineSingleLine && 'sm:whitespace-nowrap',
              )}
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="mt-3 max-w-xl text-pretty text-xs leading-relaxed text-foreground/65 sm:mt-4 sm:text-sm sm:leading-snug md:text-[15px]"
            >
              {subhead}
            </motion.p>

            <motion.ul
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.26 }}
              className="mt-5 m-0 flex list-none flex-col gap-3 p-0 sm:mt-6 sm:gap-3.5"
            >
              {highlights.map((line) => (
                <li key={line} className="flex gap-2.5 text-sm text-foreground/75 sm:text-[15px]">
                  <span
                    className="mt-2 size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.55)]"
                    aria-hidden
                  />
                  <span className="text-pretty leading-snug">{line}</span>
                </li>
              ))}
            </motion.ul>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.22 }}
            className="flex w-full flex-col justify-center lg:max-w-md lg:justify-self-end xl:max-w-[420px]"
          >
            {aside}
          </motion.div>
        </div>

        <footer
          className="relative z-10 flex shrink-0 flex-col gap-1 border-t border-border/35 pt-2.5 text-[10px] leading-snug sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:text-[11px]"
        >
          <p className="text-foreground/55">{footerCopyright}</p>
          <p className="text-foreground/45 sm:text-right">{footerTagline}</p>
        </footer>
      </div>
    </section>
  );
}

export default Hero1;
