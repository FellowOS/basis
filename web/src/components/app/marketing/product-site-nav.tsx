import { useEffect, useState, type ReactNode } from 'react';
import { Link, useLocation } from 'react-router-dom';

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { useI18n } from '@/i18n/context.js';
import {
  PRODUCT_DEVELOPER_LINKS,
  PRODUCT_NAV,
  isDevelopersNavActive,
  isProductNavActive,
  productNavHref,
  type ProductNavKey,
} from '@/lib/product-nav.js';
import { cn } from '@/lib/utils.js';
import { productDeveloperLinkLabels, productNavLabel } from '@/lib/product-nav-i18n.js';

type ProductSiteNavProps = {
  activeKey?: ProductNavKey;
  /** Stack links vertically (mobile sheet). */
  layout?: 'horizontal' | 'vertical';
  className?: string;
  onNavigate?: () => void;
};

export function ProductSiteNav({
  activeKey,
  layout = 'horizontal',
  className,
  onNavigate,
}: ProductSiteNavProps) {
  const { t } = useI18n();
  const nav = t.home.marketing.nav;
  const { pathname, hash } = useLocation();
  const developersActive = isDevelopersNavActive(pathname, activeKey);
  const isVertical = layout === 'vertical';
  const [activeSection, setActiveSection] = useState<string | null>(null);

  useEffect(() => {
    if (pathname !== '/') {
      setActiveSection(null);
      return;
    }
    const ids = ['product', 'how-it-works', 'capabilities', 'self-host'];
    const update = () => {
      let current = 'product';
      for (const id of ids) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 96) current = id;
      }
      setActiveSection(current);
    };
    update();
    window.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      window.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, [pathname]);

  const effectiveHash = pathname === '/' && activeSection ? `#${activeSection}` : hash;

  const linkClass = (active: boolean) =>
    cn(
      'text-sm no-underline transition-colors',
      isVertical
        ? cn(
            'flex w-full items-center rounded-lg px-3 py-2.5 font-medium',
            active ? 'bg-accent text-foreground' : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
          )
        : cn(
            'rounded-md px-2.5 py-1.5',
            active ? 'font-medium text-foreground' : 'text-muted-foreground hover:text-foreground',
          ),
    );

  const itemWrap = (node: ReactNode, key: string) =>
    isVertical ? (
      <div key={key} className="w-full">
        {node}
      </div>
    ) : (
      node
    );

  return (
    <nav
      aria-label={nav.aria_main}
      className={cn(
        isVertical ? 'flex flex-col gap-0.5' : 'hidden items-center gap-0.5 lg:flex',
        className,
      )}
    >
      {PRODUCT_NAV.map((item) => {
        const active = isProductNavActive(item, pathname, effectiveHash, activeKey);
        const label = productNavLabel(nav, item.key);
        return itemWrap(
          <Link
            key={item.key}
            to={productNavHref(item)}
            className={linkClass(active)}
            aria-current={active ? 'page' : undefined}
            onClick={onNavigate}
          >
            {label}
          </Link>,
          item.key,
        );
      })}

      {itemWrap(
        <DropdownMenu>
          <DropdownMenuTrigger
            aria-current={developersActive ? 'page' : undefined}
            className={cn(
              linkClass(developersActive),
              !isVertical && 'inline-flex items-center gap-0.5 outline-none',
              isVertical && 'w-full justify-between text-left',
            )}
          >
            <span>{nav.developers}</span>
            <PublicIcon name="chevron-down" size={14} className="opacity-70" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            align={isVertical ? 'start' : 'center'}
            className="min-w-[15rem]"
          >
            {PRODUCT_DEVELOPER_LINKS.map((link) => {
              const { title, desc } = productDeveloperLinkLabels(nav.developers_menu, link.key);
              if (link.external) {
                return (
                  <DropdownMenuItem key={link.key} asChild>
                    <a href={link.to} target="_blank" rel="noopener noreferrer" onClick={onNavigate}>
                      <span className="flex min-w-0 flex-col gap-0.5">
                        <span className="font-medium">{title}</span>
                        {desc ? (
                          <span className="text-xs font-normal text-muted-foreground">{desc}</span>
                        ) : null}
                      </span>
                    </a>
                  </DropdownMenuItem>
                );
              }
              return (
                <DropdownMenuItem key={link.key} asChild>
                  <Link to={link.to} onClick={onNavigate}>
                    <span className="flex min-w-0 flex-col gap-0.5">
                      <span className="font-medium">{title}</span>
                      {desc ? (
                        <span className="text-xs font-normal text-muted-foreground">{desc}</span>
                      ) : null}
                    </span>
                  </Link>
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuContent>
        </DropdownMenu>,
        'developers',
      )}
    </nav>
  );
}
