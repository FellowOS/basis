'use client';

import { motion } from 'motion/react';
import { PublicIcon } from '@/components/ui/public-icon.js';

export type MarketingFeature = {
  icon: string;
  title: string;
  description: string;
};

export type Features1Props = {
  eyebrow: string;
  headline: string;
  subhead: string;
  features: readonly MarketingFeature[];
};

export function Features1({ eyebrow, headline, subhead, features }: Features1Props) {
  return (
    <section className="w-full py-16 px-4 sm:px-6 lg:px-8 border-t border-border/60 bg-background/40 backdrop-blur-sm">
      <div className="max-w-[1400px] mx-auto">
        <div className="mb-12 md:mb-16 lg:mb-20">
          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4 }}
            className="text-sm sm:text-base text-muted-foreground mb-4"
          >
            {eyebrow}
          </motion.p>

          <motion.h2
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.1 }}
            className="font-display text-3xl sm:text-4xl md:text-5xl font-semibold text-foreground mb-6 tracking-tight"
          >
            {headline}
          </motion.h2>

          <motion.p
            initial={{ opacity: 0, y: 10 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.4, delay: 0.2 }}
            className="text-base sm:text-lg text-muted-foreground max-w-xl"
          >
            {subhead}
          </motion.p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-8 md:gap-x-8 md:gap-y-12">
          {features.map((feature, index) => {
            return (
              <motion.div
                key={feature.title}
                initial={{ opacity: 0, y: 20 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.4, delay: index * 0.05 }}
                className="flex flex-col"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-xl border border-border bg-card shadow-sm">
                    <PublicIcon name={feature.icon} size={22} className="text-[var(--brand-primary,#d4880a)]" />
                  </div>

                  <h3 className="text-base tracking-tight font-semibold text-foreground">{feature.title}</h3>
                </div>

                <p className="text-sm sm:text-base text-muted-foreground leading-relaxed">{feature.description}</p>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

export default Features1;
