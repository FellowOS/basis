import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

import { AppLogo } from '@/components/app-logo.js';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import { LocaleMenuItems } from '@/i18n/locale-menu.js';
import { cn } from '@/lib/utils.js';
import { useTheme } from '@/lib/theme.js';

type Props = {
  loginTo?: string;
  registerTo?: string;
  /** Hide header sign-in / register when the hero already shows the auth form. */
  showAuthActions?: boolean;
};

export function MarketingHeader({
  loginTo = '/',
  registerTo = '/?mode=register',
  showAuthActions = true,
}: Props) {
  const { t } = useI18n();
  const { theme, toggleTheme } = useTheme();
  const m = t.marketing;
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 6);
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  return (
    <header
      className={cn(
        'fixed inset-x-0 top-0 z-50 transition-[border-color,background-color,backdrop-filter] duration-200',
        scrolled && 'border-b border-border/50 bg-background/75 backdrop-blur-md',
      )}
    >
      <nav className="px-4 sm:px-6 lg:px-8">
        <div className="mx-auto flex h-14 w-full max-w-[1400px] items-center justify-between sm:h-16">
          <Link
            to="/"
            className="flex items-center gap-2 text-foreground no-underline transition-opacity hover:opacity-85"
          >
            <AppLogo size={28} label={m.brand} />
            <span className="font-display text-base font-semibold tracking-tight">{m.brand}</span>
          </Link>

          <div className="flex items-center gap-0.5 sm:gap-1">
            {showAuthActions && (
              <>
                <Link
                  to={registerTo}
                  className="hidden rounded-md px-2.5 py-1.5 text-sm text-muted-foreground no-underline transition-colors hover:text-foreground sm:inline-flex"
                >
                  {m.ctaRegister}
                </Link>
                <Link
                  to={loginTo}
                  className="inline-flex h-8 items-center justify-center rounded-full bg-[var(--login-cta-bg,#152033)] px-4 text-sm font-medium text-white no-underline transition-[filter] hover:brightness-110 sm:h-9 sm:px-5"
                >
                  {m.ctaLogin}
                </Link>
                <span className="mx-0.5 hidden h-4 w-px bg-border/60 sm:mx-1 sm:block" aria-hidden />
              </>
            )}

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? m.a11yThemeLight : m.a11yThemeDark}
              className="text-muted-foreground hover:text-foreground"
            >
              <PublicIcon name={theme === 'dark' ? 'sun-01' : 'moon-01'} size={18} />
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
        </div>
      </nav>
    </header>
  );
}
