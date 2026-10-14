'use client';

import { ArrowRight } from 'lucide-react';
import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { HeroMotionBackground } from '@/components/marketing/hero-motion-background.js';
import { cn } from '@/lib/utils.js';

export type Hero1Feature = {
  title: string;
  description: string;
};

export type Hero1Props = {
  pillText: string;
  headline: string;
  subhead: string;
  highlights: readonly string[];
  features: readonly Hero1Feature[];
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
  footerCopyright: string;
  footerTagline: string;
};

export function Hero1({
  pillText,
  headline,
  subhead,
  highlights,
  features,
  primaryCta,
  secondaryCta,
  footerCopyright,
  footerTagline,
}: Hero1Props) {
  /** Short zh headline — keep on one line from tablet up; EN stays wrapped. */
  const headlineSingleLine = headline.length <= 22;

  return (
    <section className="relative flex h-full min-h-0 flex-col overflow-hidden px-4 pb-2 pt-14 sm:px-6 sm:pb-3 sm:pt-16">
      <HeroMotionBackground />

      <div className="relative z-10 mx-auto flex h-full min-h-0 w-full max-w-[1400px] flex-1 flex-col">
        <div className="grid min-h-0 flex-1 grid-cols-1 items-center gap-4 lg:grid-cols-[1.06fr_0.94fr] lg:gap-12 xl:gap-20">
          <div className="flex min-h-0 flex-col justify-center">
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
                'mt-2 font-display text-xl font-semibold leading-[1.08] tracking-[-0.035em] sm:mt-2.5 sm:text-2xl md:text-3xl lg:mt-3 lg:text-[2.8rem]',
                headlineSingleLine && 'sm:whitespace-nowrap',
              )}
            >
              {headline}
            </motion.h1>

            <motion.p
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.2 }}
              className="mt-3 max-w-xl text-pretty text-xs leading-relaxed text-foreground/65 sm:mt-4 sm:text-sm sm:leading-snug md:mt-5 md:text-[15px]"
            >
              {subhead}
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, delay: 0.24 }}
              className="mt-5 flex flex-wrap items-center gap-2 sm:mt-6 sm:gap-3 lg:mt-7"
            >
              <Link
                to={primaryCta.to}
                className="inline-flex items-center justify-center rounded-full bg-[var(--login-cta-bg,#152033)] px-4 py-2 text-xs font-medium text-white shadow-[0_10px_30px_-12px_rgba(212,136,10,0.65)] transition-[transform,filter] hover:-translate-y-0.5 hover:brightness-110 sm:px-5 sm:py-2.5 sm:text-sm"
              >
                {primaryCta.label}
              </Link>
              <Link
                to={secondaryCta.to}
                className="inline-flex items-center gap-1.5 rounded-full border border-border/80 bg-background/20 px-3 py-2 text-xs font-medium text-foreground backdrop-blur-sm transition-[transform,background-color] hover:-translate-y-0.5 hover:bg-muted/50 sm:pl-4 sm:pr-2.5 sm:py-2.5 sm:text-sm"
              >
                {secondaryCta.label}
                <span className="flex h-5 w-5 items-center justify-center rounded-full bg-foreground text-background">
                  <ArrowRight className="h-2.5 w-2.5 -rotate-45" />
                </span>
              </Link>
            </motion.div>
          </div>

          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="flex min-h-0 flex-col justify-center lg:max-h-[min(52vh,22rem)] lg:pl-8 xl:pl-12"
          >
            <ol className="m-0 flex list-none flex-col gap-4 p-0 sm:gap-5">
              {features.map((feature, index) => {
                const highlight = highlights[index];
                return (
                  <li key={feature.title} className="flex gap-2.5 sm:gap-3">
                    <span
                      className="mt-[0.55rem] size-1.5 shrink-0 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)]"
                      aria-hidden
                    />
                    <div className="min-w-0 flex-1 space-y-1">
                      <h3 className="text-sm font-semibold tracking-tight text-foreground sm:text-[15px]">
                        <span className="text-pretty">{feature.title}</span>
                      </h3>
                      {highlight && (
                        <p className="text-pretty text-xs leading-snug text-foreground/70 sm:text-[13px]">
                          {highlight}
                        </p>
                      )}
                      <p className="line-clamp-2 text-[11px] leading-relaxed text-muted-foreground sm:text-xs">
                        {feature.description}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ol>
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
