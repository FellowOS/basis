import { useEffect, useState, type CSSProperties } from 'react';
import { Link, useSearchParams } from 'react-router-dom';

import { AppLogo } from '@/components/app/shared/shell/app-logo.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { LocaleMenuItems } from '@/i18n/locale-menu.js';
import { useTheme } from '@/lib/theme.js';

import { AuthFormCard } from './auth-form-card.js';
import { BinaryOrbits } from './binary-orbits.js';

export function LoginScreen() {
  const { t, locale } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const m = t.marketing;
  const year = formatLocaleNumber(locale as Locale, new Date().getFullYear());
  const [searchParams, setSearchParams] = useSearchParams();
  const [open, setOpen] = useState(() => searchParams.get('mode') === 'register');
  const isRegister = searchParams.get('mode') === 'register';
  const isDark = theme === 'dark';

  useEffect(() => {
    if (searchParams.get('mode') === 'register') setOpen(true);
  }, [searchParams]);

  function openAuth(mode: 'login' | 'register') {
    if (mode === 'register') setSearchParams({ mode: 'register' }, { replace: true });
    else setSearchParams({}, { replace: true });
    setOpen(true);
  }

  function onOpenChange(next: boolean) {
    setOpen(next);
    if (!next && searchParams.get('mode') === 'register') {
      setSearchParams({}, { replace: true });
    }
  }

  return (
    <div
      className="relative flex h-dvh max-h-dvh flex-col overflow-hidden overscroll-none text-foreground"
      style={{
        background: isDark ? '#090b10' : '#f6f7f9',
        '--login-canvas': isDark ? '#090b10' : '#f6f7f9',
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
          className="pointer-events-auto h-full min-h-0"
          colors={isDark ? ['#e0a04a', '#f6ead2'] : ['#152033', '#c9842a']}
          backgroundColor={isDark ? '#090b10' : '#f6f7f9'}
          mode="auto"
          centerX={0.56}
          centerY={0.5}
        />
        <div
          className="pointer-events-none absolute inset-0 bg-gradient-to-r from-[var(--login-canvas)] from-35% via-[var(--login-canvas)]/80 to-transparent sm:from-0% sm:via-[var(--login-canvas)]/40"
          aria-hidden
        />
      </div>

      <header className="relative z-20 flex h-14 shrink-0 items-center gap-3 px-5 sm:h-16 sm:px-8">
        <Link to="/" className="inline-flex items-center gap-2.5 text-foreground no-underline">
          <AppLogo size={28} label={m.brand} />
          <span className="text-base font-semibold tracking-tight">{m.brand}</span>
        </Link>
        <div className="ml-auto flex items-center gap-0.5">
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            onClick={toggleTheme}
            aria-label={isDark ? m.a11yThemeLight : m.a11yThemeDark}
            className="text-muted-foreground hover:text-foreground"
          >
            <PublicIcon name={isDark ? 'sun-01' : 'moon-01'} size={18} />
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                aria-label={t.sidebar.language}
                className="text-muted-foreground hover:text-foreground"
              >
                <PublicIcon name="globe-02" size={18} />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <LocaleMenuItems />
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <main className="pointer-events-none relative z-10 flex min-h-0 flex-1 items-center overflow-y-auto px-5 py-8 sm:pr-[62%] sm:pl-8 lg:pr-[58%]">
        <div className="pointer-events-auto w-full">
          <p className="text-xs tracking-[0.08em] text-muted-foreground">{m.heroEyebrow}</p>
          <h1
            className="mt-4 text-4xl font-semibold leading-[1.08] tracking-[-0.035em] sm:text-5xl"
            aria-label={`${m.heroHeadline} ${m.heroHeadlineRest}`}
          >
            <span className="block">{m.heroHeadline}</span>
            <span className="mt-1 block text-[var(--login-gold)]">{m.heroHeadlineRest}</span>
          </h1>
          <p className="mt-5 text-[15px] leading-relaxed text-pretty text-muted-foreground">
            {m.heroSubhead}
          </p>
          <div className="mt-8 flex flex-wrap items-center gap-3">
            <Button
              type="button"
              size="lg"
              className="min-w-32 bg-[var(--login-cta-bg)] px-7 text-[var(--login-cta-fg)] hover:bg-[var(--login-cta-bg)] hover:brightness-110"
              onClick={() => openAuth('login')}
            >
              {m.ctaLogin}
            </Button>
            <Button
              type="button"
              size="lg"
              variant="ghost"
              className="min-w-32 border border-foreground/15 bg-transparent px-7 text-foreground hover:bg-foreground/6"
              onClick={() => openAuth('register')}
            >
              {m.ctaRegister}
            </Button>
          </div>
          <ol className="m-0 mt-10 hidden list-none p-0 sm:block">
            {m.highlights.map((layer) => (
              <li
                key={layer.index}
                className="grid grid-cols-[2.25rem_minmax(0,1fr)] gap-x-3 border-t border-border/70 py-3.5"
              >
                <span className="pt-0.5 font-mono text-[11px] tracking-wide text-[var(--login-gold)]">
                  {layer.index}
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-medium">{layer.title}</p>
                  <p className="mt-1 text-sm leading-relaxed text-muted-foreground">{layer.body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </main>

      <footer className="pointer-events-none relative z-10 flex shrink-0 items-center justify-between gap-6 px-5 py-3 text-[11px] text-muted-foreground sm:px-8">
        <p className="shrink-0">{fmt(m.footerCopyright, { year })}</p>
        <p className="min-w-0 truncate">{m.footerTagline}</p>
      </footer>

      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[calc(100%-1rem)] flex-col gap-0 overflow-hidden border-black/10 bg-white p-0 shadow-[0_24px_64px_-20px_rgb(0_0_0_/_0.45)] sm:max-w-[24.5rem] dark:border-white/10 dark:bg-[#141a22] [&_[data-slot=dialog-close]]:top-3.5 [&_[data-slot=dialog-close]]:right-3.5">
          <DialogTitle className="sr-only">
            {isRegister ? t.login.registerTitle : t.login.title}
          </DialogTitle>
          <DialogDescription className="sr-only">
            {isRegister ? t.login.registerSubtitle : t.login.subtitle}
          </DialogDescription>
          <AuthFormCard />
        </DialogContent>
      </Dialog>
    </div>
  );
}
