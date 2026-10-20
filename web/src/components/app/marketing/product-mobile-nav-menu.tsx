import { useEffect, useMemo, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion, useReducedMotion } from 'motion/react';
import { ChevronDown, Menu, X } from 'lucide-react';

import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Button } from '@/components/ui/button.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { LocaleMenuItems } from '@/i18n/locale-menu.js';
import { useI18n } from '@/i18n/context.js';
import { useBasisSession } from '@/lib/basis-session.js';
import {
  PRODUCT_DEVELOPER_LINKS,
  PRODUCT_NAV,
  productNavHref,
} from '@/lib/product-nav.js';
import { cn } from '@/lib/utils.js';
import { useTheme } from '@/lib/theme.js';

const EASE_OUT: [number, number, number, number] = [0.23, 1, 0.32, 1];

const focusClass =
  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background';

const transitionClass =
  'transition-[background-color,border-color,color,opacity,transform] duration-150 ease-out';

type MenuChild = { label: string; href: string; external?: boolean };

type MenuSection =
  | { id: string; label: string; children: MenuChild[] }
  | { id: string; label: string; href: string; external?: boolean; children?: null };

type ProductMobileNavMenuProps = {
  onGetStarted?: () => void;
};

export function ProductMobileNavMenu({ onGetStarted }: ProductMobileNavMenuProps) {
  const reduce = useReducedMotion();
  const { t } = useI18n();
  const m = t.marketing;
  const { theme, toggleTheme } = useTheme();
  const { ready, user, homePath } = useBasisSession();
  const isDark = theme === 'dark';
  const [open, setOpen] = useState(false);
  const [section, setSection] = useState<string | null>('developers');

  const menu = useMemo((): MenuSection[] => {
    const devMenu = m.nav.developersMenu;
    return [
      {
        id: 'product',
        label: m.nav.product,
        children: PRODUCT_NAV.filter((item) =>
          ['product', 'howItWorks', 'capabilities'].includes(item.key),
        ).map((item) => ({
          label: m.nav[item.key],
          href: productNavHref(item),
        })),
      },
      {
        id: 'developers',
        label: m.nav.developers,
        children: PRODUCT_DEVELOPER_LINKS.map((link) => ({
          label: devMenu[link.key],
          href: link.to,
          external: link.external,
        })),
      },
      {
        id: 'selfHost',
        label: m.nav.selfHost,
        href: productNavHref(PRODUCT_NAV.find((item) => item.key === 'selfHost')!),
      },
      {
        id: 'docs',
        label: m.nav.docs,
        href: '/docs',
      },
    ];
  }, [m]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setOpen(false);
    };
    document.body.style.overflow = 'hidden';
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = '';
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  function close() {
    setOpen(false);
  }

  function renderChildLink(child: MenuChild) {
    const className = cn(
      'flex min-h-11 w-full cursor-pointer items-center rounded-lg px-3 text-left text-sm text-muted-foreground hover:bg-accent/60 hover:text-foreground',
      transitionClass,
      focusClass,
    );
    if (child.external) {
      return (
        <a
          key={child.href}
          href={child.href}
          target="_blank"
          rel="noopener noreferrer"
          className={className}
          onClick={close}
        >
          {child.label}
        </a>
      );
    }
    return (
      <Link key={child.href} to={child.href} className={className} onClick={close}>
        {child.label}
      </Link>
    );
  }

  const overlay = (
    <AnimatePresence>
      {open ? (
        <motion.div
          role="dialog"
          aria-modal="true"
          aria-label={m.nav.ariaMain}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }}
          transition={{ duration: 0.24, ease: EASE_OUT }}
          className="fixed inset-0 z-[100] flex flex-col bg-background lg:hidden"
        >
          <div className="flex h-14 shrink-0 items-center justify-between px-5 sm:h-16 sm:px-8">
            <p className="font-display text-[15px] font-medium tracking-tight text-foreground">{m.brand}</p>
            <button
              type="button"
              aria-label={t.common.close}
              onClick={close}
              className={cn(
                'inline-flex h-10 w-10 cursor-pointer items-center justify-center rounded-xl text-muted-foreground hover:bg-accent hover:text-foreground',
                transitionClass,
                focusClass,
              )}
            >
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>

          <nav aria-label={m.nav.ariaMain} className="min-h-0 flex-1 overflow-y-auto px-3 pb-4 sm:px-5">
            {menu.map((entry, i) => {
              const isOpen = section === entry.id;
              const hasChildren = entry.children && entry.children.length > 0;
              const leafClass = cn(
                'flex min-h-[52px] w-full cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-left hover:bg-accent/50',
                transitionClass,
                focusClass,
              );
              const leafLabelClass =
                'min-w-0 truncate text-[22px] font-medium leading-tight tracking-tight text-foreground';
              return (
                <motion.div
                  key={entry.id}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{
                    duration: 0.3,
                    ease: EASE_OUT,
                    delay: reduce ? 0 : 0.04 + i * 0.035,
                  }}
                >
                  {hasChildren ? (
                    <button
                      type="button"
                      aria-expanded={isOpen}
                      onClick={() => setSection(isOpen ? null : entry.id)}
                      className={leafClass}
                    >
                      <span className={leafLabelClass}>{entry.label}</span>
                      <ChevronDown
                        aria-hidden
                        className={cn(
                          'h-4 w-4 shrink-0 text-muted-foreground transition-transform duration-200 ease-out motion-reduce:transition-none',
                          isOpen && 'rotate-180',
                        )}
                      />
                    </button>
                  ) : 'href' in entry && entry.href ? (
                    entry.external ? (
                      <a
                        href={entry.href}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={leafClass}
                        onClick={close}
                      >
                        <span className={leafLabelClass}>{entry.label}</span>
                      </a>
                    ) : (
                      <Link to={entry.href} className={leafClass} onClick={close}>
                        <span className={leafLabelClass}>{entry.label}</span>
                      </Link>
                    )
                  ) : null}

                  <AnimatePresence initial={false}>
                    {hasChildren && isOpen && entry.children ? (
                      <motion.ul
                        initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }}
                        animate={reduce ? { opacity: 1 } : { height: 'auto', opacity: 1 }}
                        exit={
                          reduce
                            ? { opacity: 0, transition: { duration: 0.12 } }
                            : { height: 0, opacity: 0, transition: { duration: 0.16, ease: EASE_OUT } }
                        }
                        transition={{ duration: 0.2, ease: EASE_OUT }}
                        className="overflow-hidden pl-3"
                      >
                        {entry.children.map((child) => (
                          <li key={child.href}>{renderChildLink(child)}</li>
                        ))}
                      </motion.ul>
                    ) : null}
                  </AnimatePresence>
                </motion.div>
              );
            })}
          </nav>

          <motion.div
            initial={reduce ? { opacity: 0 } : { opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{
              duration: 0.3,
              ease: EASE_OUT,
              delay: reduce ? 0 : 0.04 + menu.length * 0.035,
            }}
            className="shrink-0 space-y-2 p-3 sm:px-5 sm:pb-5"
          >
            <div className="flex items-center justify-end gap-0.5 px-1">
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                onClick={toggleTheme}
                aria-label={isDark ? m.a11yThemeLight : m.a11yThemeDark}
              >
                <PublicIcon name={isDark ? 'sun-01' : 'moon-01'} size={18} />
              </Button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" variant="ghost" size="icon-sm" aria-label={t.sidebar.language}>
                    <PublicIcon name="globe-02" size={18} />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <LocaleMenuItems />
                </DropdownMenuContent>
              </DropdownMenu>
            </div>

            {ready && user ? (
              <Link
                to={homePath}
                onClick={close}
                className={cn(
                  'flex min-h-14 w-full items-center gap-3 rounded-2xl bg-muted/80 px-3 text-left hover:bg-muted',
                  transitionClass,
                  focusClass,
                )}
              >
                <span
                  aria-hidden
                  className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-background text-xs font-semibold text-foreground"
                >
                  {(user.display_name || user.email || '?')[0]?.toUpperCase()}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-foreground">
                    {user.display_name || user.email}
                  </span>
                  {user.email && user.display_name ? (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{user.email}</span>
                  ) : (
                    <span className="mt-0.5 block truncate text-xs text-muted-foreground">{m.openConsole}</span>
                  )}
                </span>
              </Link>
            ) : (
              <div className="rounded-2xl bg-muted/80 p-3">
                {onGetStarted != null ? (
                  <Button
                    type="button"
                    className="w-full rounded-full bg-[var(--login-cta-bg,#152033)] text-[var(--login-cta-fg,#f6f4ef)]"
                    onClick={() => { onGetStarted(); close(); }}
                  >
                    {m.ctaGetStarted}
                  </Button>
                ) : (
                  <Button
                    type="button"
                    className="w-full rounded-full bg-[var(--login-cta-bg,#152033)] text-[var(--login-cta-fg,#f6f4ef)]"
                    asChild
                  >
                    <Link to="/?mode=register" onClick={close}>
                      {m.ctaGetStarted}
                    </Link>
                  </Button>
                )}
              </div>
            )}
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="lg:hidden"
        aria-label={m.nav.openMenu}
        aria-expanded={open}
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" aria-hidden />
      </Button>
      {typeof document !== 'undefined' ? createPortal(overlay, document.body) : null}
    </>
  );
}
