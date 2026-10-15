import type { ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

/** Short KB workspace context under breadcrumbs (F-IF-03). */
export function KbPageSubtitle({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <p className={cn('text-sm text-muted-foreground', className)}>{children}</p>
  );
}
