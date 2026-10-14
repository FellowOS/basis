import type { HTMLAttributes, ReactNode } from 'react';
import { Skeleton } from '@/components/ui/skeleton.js';
import { cardSurfaceClass } from './Card.js';
import { cn } from '@/lib/utils.js';

export function MiniStatCard({
  icon,
  tint = 'var(--primary)',
  tintBg = 'color-mix(in oklch, var(--primary) 12%, transparent)',
  value,
  label,
  sub,
  loading = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  icon: ReactNode;
  tint?: string;
  tintBg?: string;
  value: string | number;
  label: string;
  sub?: string;
  loading?: boolean;
}) {
  return (
    <div
      className={cn(
        cardSurfaceClass,
        'flex min-w-0 items-center gap-3.5 p-4',
        className,
      )}
      {...props}
    >
      <span
        className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl"
        style={{ background: tintBg, color: tint }}
      >
        {icon}
      </span>
      <div className="min-w-0">
        {loading ? (
          <Skeleton className="h-7 w-16" />
        ) : (
          <p className="truncate text-lg font-extrabold text-foreground">{value}</p>
        )}
        <p className="mt-0.5 truncate text-[11.5px] font-semibold text-muted-foreground">
          {label}
          {sub ? ` · ${sub}` : ''}
        </p>
      </div>
    </div>
  );
}
