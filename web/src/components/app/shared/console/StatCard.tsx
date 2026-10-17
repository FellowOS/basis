import type { ReactNode } from 'react';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';
import { AnimatedNumber } from './AnimatedNumber.js';
import { Card } from './Card.js';

export interface StatCardProps {
  label: string;
  value: string | number;
  icon: ReactNode;
  iconColor?: string;
  iconBg?: string;
  delta?: { value: string; positive: boolean };
  sparkline?: ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  icon,
  iconColor = 'var(--primary)',
  iconBg = 'color-mix(in oklch, var(--primary) 12%, transparent)',
  delta,
  sparkline,
  className,
}: StatCardProps) {
  const { locale } = useI18n();
  return (
    <Card padding="md" className={cn('min-w-0', className)}>
      <div className="flex items-center justify-between gap-2">
        <div
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-[13px]"
          style={{ background: iconBg, color: iconColor }}
        >
          {icon}
        </div>
        {delta && (
          <span
            className={cn(
              'inline-flex items-center gap-1 rounded-full px-2 py-1 text-[11px] font-bold',
              delta.positive ? 'text-ok bg-ok-soft' : 'text-bad bg-bad-soft',
            )}
          >
            {delta.positive ? '↗' : '↘'} {delta.value}
          </span>
        )}
      </div>
      <p className="mt-4 truncate text-xs font-medium text-muted-foreground">{label}</p>
      <AnimatedNumber
        value={value}
        locale={locale}
        className="mt-1 block truncate text-2xl font-extrabold text-foreground"
      />
      {sparkline && <div className="mt-3 h-9">{sparkline}</div>}
    </Card>
  );
}
