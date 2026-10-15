import type { ReactNode } from 'react';
import { PageHeader, type Crumb } from '@/components/console-ui/PageHeader.js';
import { cn } from '@/lib/utils.js';

export type ConsolePageLayoutProps = {
  crumbs: Crumb[];
  /** Short description under the breadcrumb (e.g. KbPageSubtitle text). */
  subtitle?: ReactNode;
  /** Secondary line: role, hint, etc. */
  meta?: ReactNode;
  /** Primary actions aligned to the header row (create, export, …). */
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
};

/**
 * Standard console page shell: breadcrumb → optional subtitle/meta → optional action row → content.
 */
export function ConsolePageLayout({
  crumbs,
  subtitle,
  meta,
  actions,
  children,
  className,
}: ConsolePageLayoutProps) {
  return (
    <div className={cn('flex min-h-0 flex-1 flex-col gap-4', className)}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 space-y-1">
          <PageHeader crumbs={crumbs} />
          {subtitle ? (
            <div className="text-sm text-muted-foreground">{subtitle}</div>
          ) : null}
          {meta ? <div className="text-sm text-muted-foreground">{meta}</div> : null}
        </div>
        {actions ? (
          <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div>
        ) : null}
      </div>
      <div className="flex min-h-0 flex-1 flex-col overflow-hidden">{children}</div>
    </div>
  );
}
