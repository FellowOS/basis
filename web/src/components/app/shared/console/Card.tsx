import type { HTMLAttributes, ReactNode } from 'react';
import { cn } from '@/lib/utils.js';

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  children: ReactNode;
  padding?: 'none' | 'sm' | 'md' | 'lg';
}

const paddingClasses = {
  none: '',
  sm: 'p-4',
  md: 'p-5',
  lg: 'p-6',
};

/** Vela card surface: large radius, line border, bg-2 fill, vela shadow. */
export const cardSurfaceClass =
  'rounded-[var(--radius-vela-lg)] border border-line bg-bg-2 shadow-[var(--shadow-vela)]';

export function Card({ className, children, padding = 'md', ...props }: CardProps) {
  return (
    <div className={cn(cardSurfaceClass, paddingClasses[padding], className)} {...props}>
      {children}
    </div>
  );
}

export function CardHeader({ className, children, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn('mb-4 flex items-start justify-between gap-3', className)} {...props}>
      {children}
    </div>
  );
}

export function CardTitle({ className, children, ...props }: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3 className={cn('text-[15px] font-bold text-foreground', className)} {...props}>
      {children}
    </h3>
  );
}

export function CardSubtitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p className={cn('mt-0.5 text-xs text-muted-foreground', className)} {...props}>
      {children}
    </p>
  );
}
