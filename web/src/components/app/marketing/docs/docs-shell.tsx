import type { ReactNode } from 'react';
import { useNavigate } from 'react-router-dom';

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
import { DocsSidebarNav, useProductDocsFlatPages } from '@/components/app/marketing/docs/docs-sidebar-nav.js';
import { docsPath, type DocSlug } from '@/lib/product-docs-nav.js';

type DocsShellProps = {
  /** Omitted on the 404 page so no page is marked current. */
  activeSlug?: DocSlug;
  children: ReactNode;
};

export function DocsShell({ activeSlug, children }: DocsShellProps) {
  const navigate = useNavigate();
  const { t } = useI18n();
  const flatPages = useProductDocsFlatPages();

  return (
    <div className="flex h-dvh max-h-dvh flex-col overflow-hidden bg-background text-foreground">
      <ProductSiteHeader activeKey="developers" />
      <div className="flex min-h-0 flex-1 border-t border-border">
        <aside className="hidden w-60 shrink-0 border-r border-border lg:block">
          <ScrollShadow
            hideScrollBar
            className="h-full py-6 pl-5 pr-3 sm:pl-8 sm:pr-4"
            fadeColor="var(--background)"
          >
            <DocsSidebarNav />
          </ScrollShadow>
        </aside>
        <main className="min-h-0 min-w-0 flex-1 overflow-y-auto px-5 py-8 sm:px-8">
          <div className="mb-6 lg:hidden">
            <Select
              value={activeSlug ? docsPath(activeSlug) : ''}
              onValueChange={(url) => navigate(url)}
            >
              <SelectTrigger className="w-full" size="sm">
                <SelectValue placeholder={t.docs.selectPage} />
              </SelectTrigger>
              <SelectContent>
                {flatPages.map((page) => (
                  <SelectItem key={page.url} value={page.url}>
                    {page.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {children}
        </main>
      </div>
    </div>
  );
}
