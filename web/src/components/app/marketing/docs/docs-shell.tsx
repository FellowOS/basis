import type { ReactNode } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';

import { ProductSiteHeader } from '@/components/app/marketing/product-site-header.js';
import { ScrollShadow } from '@/components/app/shared/primitives/scroll-shadow.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { useI18n } from '@/i18n/context.js';
import {
  PRODUCT_DOCS_NAV,
  docsPath,
  docsPathActive,
  type DocSlug,
} from '@/lib/product-docs-nav.js';
import { cn } from '@/lib/utils.js';

type DocsShellProps = {
  activeSlug: DocSlug;
  children: ReactNode;
};

export function DocsShell({ activeSlug, children }: DocsShellProps) {
  const { t } = useI18n();
  const d = t.docs;
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ProductSiteHeader activeKey="developers" />
      <div className="flex min-h-0 flex-1 border-t border-border">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          <ScrollShadow hideScrollBar className="h-full px-3 py-6" fadeColor="var(--background)">
            <nav aria-label={d.sidebarAria} className="space-y-5">
              {PRODUCT_DOCS_NAV.map((group) => (
                <div key={group.id}>
                  <p className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {d.groups[group.id]}
                  </p>
                  <ul className="flex flex-col gap-0.5">
                    {group.items.map(({ slug }) => {
                      const active = docsPathActive(pathname, slug) || slug === activeSlug;
                      return (
                        <li key={slug}>
                          <Link
                            to={docsPath(slug)}
                            aria-current={active ? 'page' : undefined}
                            className={cn(
                              'block rounded-md px-2 py-1.5 text-[13px] leading-5 transition-colors',
                              active
                                ? 'bg-accent font-medium text-foreground'
                                : 'text-muted-foreground hover:bg-accent/60 hover:text-foreground',
                            )}
                          >
                            {d.pages[slug].navTitle}
                          </Link>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              ))}
            </nav>
          </ScrollShadow>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8 lg:px-10">
          <div className="mb-6 lg:hidden">
            <Select value={activeSlug} onValueChange={(v) => navigate(docsPath(v as DocSlug))}>
              <SelectTrigger className="w-full" size="sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {PRODUCT_DOCS_NAV.flatMap((group) =>
                  group.items.map(({ slug }) => (
                    <SelectItem key={slug} value={slug}>
                      {d.pages[slug].navTitle}
                    </SelectItem>
                  )),
                )}
              </SelectContent>
            </Select>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
