import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useSearchParams } from 'react-router-dom';

import { ProductSiteFooter } from '@/components/app/marketing/product-site-footer.js';
import { ProductSiteHeader } from '@/components/app/marketing/product-site-header.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { useI18n } from '@/i18n/context.js';
import { useTheme } from '@/lib/theme.js';

import {
  AuthFormCard,
  loadAuthProviders,
  type AuthProviders,
} from './auth-form-card.js';
import { BinaryOrbits, type BinaryOrbitsHandle } from './binary-orbits.js';

export function LoginScreen() {
  const { t } = useI18n();
  const { theme } = useTheme();
  const m = t.marketing;
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(() => {
    const mode = searchParams.get('mode');
    return mode === 'register' || mode === 'login';
  });
  const isRegister = searchParams.get('mode') === 'register';
  const isDark = theme === 'dark';
  const [authProviders, setAuthProviders] = useState<AuthProviders | null>(null);
  const orbitsRef = useRef<BinaryOrbitsHandle>(null);

  useEffect(() => {
    void loadAuthProviders().then(setAuthProviders);
  }, []);

  useEffect(() => {
    const mode = searchParams.get('mode');
    if (mode === 'register' || mode === 'login') setOpen(true);
  }, [searchParams]);

  useEffect(() => {
    const onHash = () => {
      if (window.location.hash === '#capabilities') {
        orbitsRef.current?.ripple();
      }
    };
    onHash();
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  function openAuth(mode: 'login' | 'register') {
    setSearchParams({ mode }, { replace: true });
    setOpen(true);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    const mode = searchParams.get('mode');
    if (!next && (mode === 'register' || mode === 'login')) {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div
      className="relative flex h-dvh max-h-dvh flex-col overflow-hidden overscroll-none text-foreground"
      style={{
        background: isDark ? '#090b10' : '#ffffff',
        '--login-canvas': isDark ? '#090b10' : '#ffffff',
        '--login-panel': isDark ? '#121820' : '#152033',
        '--login-panel-fg': '#f4f1ea',
        '--login-panel-muted': 'rgb(244 241 234 / 0.68)',
        '--login-panel-faint': isDark ? 'rgb(244 241 234 / 0.4)' : 'rgb(244 241 234 / 0.42)',
        '--login-panel-line': isDark ? 'rgb(244 241 234 / 0.12)' : 'rgb(244 241 234 / 0.14)',
        '--login-gold': isDark ? '#e8a830' : '#e0a04a',
        '--login-cta-bg': isDark ? '#f3ead7' : '#152033',
        '--login-cta-fg': isDark ? '#152033' : '#f6f4ef',
        '--login-cta-shimmer': isDark ? '#e8a830' : '#d4880a',
      } as CSSProperties}
    >
      <div className="absolute inset-y-0 right-0 z-0 w-full sm:w-[62%] lg:w-[58%]">
        <BinaryOrbits
          ref={orbitsRef}
          className="pointer-events-auto h-full min-h-0"
          colors={isDark ? ['#e0a04a', '#f6ead2'] : ['#152033', '#c9842a']}
          backgroundColor={isDark ? '#090b10' : '#ffffff'}
          mode="auto"
          centerX={0.56}
          centerY={0.5}
          interactive
          hoverWake
          clickRipple
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--login-canvas)] from-35% via-[var(--login-canvas)]/80 to-transparent sm:from-0% sm:via-[var(--login-canvas)]/40"
          aria-hidden
        />
      </div>

      <ProductSiteHeader activeKey="product" onGetStarted={() => openAuth('login')} />

      <main
        id="product"
        className="relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden px-5 py-4 sm:py-5 sm:pl-8 sm:pr-[62%] lg:pr-[58%]"
      >
        <div className="pointer-events-auto flex min-h-0 flex-1 flex-col justify-center">
          <p className="max-w-xl text-xs leading-relaxed text-pretty text-muted-foreground sm:text-[13px]">
            {m.heroEyebrow}
          </p>
          <h1
            className="mt-3 text-[1.65rem] font-semibold leading-[1.1] tracking-[-0.035em] sm:mt-3.5 sm:text-4xl lg:text-[2.65rem]"
            aria-label={`${m.heroHeadline} ${m.heroHeadlineRest}`}
          >
            <span className="block">{m.heroHeadline}</span>
            <span className="mt-0.5 block text-[var(--login-gold)] sm:mt-1">{m.heroHeadlineRest}</span>
          </h1>
          <p className="mt-2 line-clamp-3 text-[13px] leading-relaxed text-pretty text-muted-foreground sm:mt-3 sm:line-clamp-2 sm:text-sm">
            {m.heroSubhead}
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-2.5 sm:mt-5 sm:gap-3">
            <Button
              type="button"
              size="default"
              className="bg-[var(--login-cta-bg)] px-6 text-[var(--login-cta-fg)] hover:bg-[var(--login-cta-bg)] hover:brightness-110 sm:px-7"
              onClick={() => openAuth('login')}
            >
              {m.ctaLogin}
            </Button>
            <Button
              type="button"
              size="default"
              variant="ghost"
              className="border border-foreground/15 bg-transparent px-6 text-foreground hover:bg-foreground/6 sm:px-7"
              onClick={() => openAuth('register')}
            >
              {m.ctaRegister}
            </Button>
          </div>
          <p
            id="capabilities"
            className="mt-5 max-w-xl border-t border-border/60 pt-4 text-[11px] leading-relaxed text-pretty text-muted-foreground scroll-mt-24 sm:mt-6 sm:pt-5 sm:text-xs"
          >
            {m.heroPillars}
          </p>
        </div>
      </main>

      <ProductSiteFooter />

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100%-1rem)] flex-col gap-0 overflow-hidden border-black/10 bg-white p-0 shadow-[0_24px_64px_-20px_rgb(0_0_0_/_0.45)] sm:max-w-[24.5rem] data-[state=closed]:[--tw-exit-scale:1] data-[state=open]:[--tw-enter-scale:1] dark:border-white/10 dark:bg-[#141a22] [&_[data-slot=dialog-close]]:top-3.5 [&_[data-slot=dialog-close]]:right-3.5">
          <DialogTitle className="sr-only">
            {isRegister ? t.login.registerTitle : t.login.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isRegister ? t.login.registerSubtitle : t.login.subtitle}
          </DialogDescription>
          <AuthFormCard providers={authProviders} />
        </DialogContent>
      </Dialog>
    </div>
  );
}
