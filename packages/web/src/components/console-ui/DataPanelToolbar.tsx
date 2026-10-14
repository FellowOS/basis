import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

/** Search on the left, actions right-aligned — matches Sources (knowledge) page. */
export function DataPanelToolbar({
  search,
  actions,
  className,
}: {
  search?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-2',
        !search && actions && 'justify-end',
        className,
      )}
    >
      {search}
      {actions ? (
        <div
          className={cn(
            'flex flex-wrap items-center justify-end gap-2',
            search ? 'ml-auto' : undefined,
          )}
        >
          {actions}
        </div>
      ) : null}
    </div>
  );
}
