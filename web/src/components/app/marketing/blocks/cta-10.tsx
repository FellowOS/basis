'use client';

import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/app/shared/shell/app-logo.js';

export type Cta10Props = {
  title: string;
  body: string;
  primaryCta: { label: string; to: string };
  secondaryCta: { label: string; to: string };
};

export function Cta10({ title, body, primaryCta, secondaryCta }: Cta10Props) {
  return (
    <section className="w-full flex items-center justify-center py-14 px-4 sm:px-6 lg:px-8 bg-transparent">
      <motion.div
        initial={{ opacity: 0, y: 16, scale: 0.98 }}
        whileInView={{ opacity: 1, y: 0, scale: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full max-w-5xl rounded-3xl bg-card/80 backdrop-blur-sm border border-border overflow-hidden grid grid-cols-1 md:grid-cols-[5fr_7fr] p-2"
      >
        <div className="relative aspect-4/5 md:aspect-auto md:min-h-[360px] rounded-2xl overflow-hidden bg-muted grid place-items-center">
          <div className="absolute inset-0 bg-gradient-to-br from-amber-500/15 via-transparent to-foreground/5" />
          <AppLogo size={80} label="Basis" />
        </div>

        <div className="flex flex-col justify-center p-6 sm:p-10 gap-5">
          <h2 className="font-display text-2xl sm:text-3xl md:text-4xl font-semibold text-foreground tracking-tight">
            {title}
          </h2>
          <p className="text-sm sm:text-base text-muted-foreground leading-relaxed max-w-md">{body}</p>
          <div className="flex flex-col sm:flex-row gap-3 max-w-md">
            <Link
              to={primaryCta.to}
              className="inline-flex justify-center px-5 py-3 rounded-full bg-[var(--login-cta-bg,#152033)] text-white text-sm font-medium hover:brightness-110 transition-[filter]"
            >
              {primaryCta.label}
            </Link>
            <Link
              to={secondaryCta.to}
              className="inline-flex justify-center px-5 py-3 rounded-full border border-border text-foreground text-sm font-medium hover:bg-muted/50 transition-colors"
            >
              {secondaryCta.label}
            </Link>
          </div>
        </div>
      </motion.div>
    </section>
  );
}

export default Cta10;
