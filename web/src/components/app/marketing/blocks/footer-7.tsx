'use client';

import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/app/shared/shell/app-logo.js';

export type Footer7Props = {
  brand: string;
  about: string;
  navTitle: string;
  loginLabel: string;
  registerLabel: string;
  copyright: string;
  tagline: string;
};

export function Footer7({
  brand,
  about,
  navTitle,
  loginLabel,
  registerLabel,
  copyright,
  tagline,
}: Footer7Props) {
  return (
    <footer className="relative w-full px-4 sm:px-6 lg:px-8 py-12 sm:py-16 border-t border-border/60 bg-background/30 backdrop-blur-sm">
      <div className="relative max-w-[1400px] mx-auto w-full">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.5 }}
          className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr_1fr] gap-10 lg:gap-8"
        >
          <div className="flex items-start gap-5">
            <div className="shrink-0 w-[72px] h-[72px] rounded-full border border-border bg-card flex items-center justify-center shadow-sm">
              <AppLogo size={40} />
            </div>
            <h3 className="font-display text-2xl sm:text-3xl font-semibold text-foreground leading-[1.05] tracking-tight">
              {brand}
            </h3>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{navTitle}</h4>
            <ul className="flex flex-col gap-2 text-lg sm:text-xl text-foreground">
              <li>
                <Link to="/login" className="hover:text-muted-foreground transition-colors">
                  {loginLabel}
                </Link>
              </li>
              <li>
                <Link to="/login?mode=register" className="hover:text-muted-foreground transition-colors">
                  {registerLabel}
                </Link>
              </li>
            </ul>
          </div>

          <div className="flex flex-col gap-4">
            <h4 className="text-xs tracking-[0.2em] uppercase text-muted-foreground">{brand}</h4>
            <p className="text-base sm:text-lg text-foreground leading-relaxed">{about}</p>
          </div>
        </motion.div>

        <div className="mt-12 flex flex-col gap-2 text-muted-foreground text-xs sm:text-sm">
          <p>{copyright}</p>
          <p>{tagline}</p>
        </div>
      </div>
    </footer>
  );
}

export default Footer7;
