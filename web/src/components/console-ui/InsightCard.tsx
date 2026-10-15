import type { HTMLAttributes, ReactNode } from 'react';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { cn } from '@/lib/utils.js';
import { Card } from './Card.js';

export type InsightTint = 'acc' | 'info' | 'ok' | 'warn' | 'bad';

const tintVar: Record<InsightTint, string> = {
  acc: '--primary',
  info: '--info',
  ok: '--ok',
  warn: '--warn',
  bad: '--bad',
};

const tintSoftVar: Record<InsightTint, string> = {
  acc: '--acc-soft',
  info: '--info-soft',
  ok: '--ok-soft',
  warn: '--warn-soft',
  bad: '--bad-soft',
};

export function InsightCard({
  tint,
  icon,
  kicker,
  text,
  meta,
  children,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tint: InsightTint;
  icon: string;
  kicker: string;
  text: string;
  meta?: string;
  children?: ReactNode;
}) {
  const color = `var(${tintVar[tint]})`;
  const soft = `var(${tintSoftVar[tint]})`;

  return (
    <Card
      padding="md"
      className={cn('relative overflow-hidden bg-gradient-to-br from-bg-3 to-bg-2', className)}
      {...props}
    >
      <div
        className="pointer-events-none absolute -top-5 -right-5 h-20 w-20 rounded-full"
        style={{ background: `radial-gradient(circle, ${soft}, transparent 70%)` }}
      />
      <div className="mb-2.5 flex items-center gap-2.5">
        <span
          className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md"
          style={{ background: soft, color }}
        >
          <PublicIcon name={icon} size={15} />
        </span>
        <span className="text-[11px] font-bold tracking-wider uppercase" style={{ color }}>
          {kicker}
        </span>
      </div>
      <p className="text-[13.5px] leading-relaxed font-semibold text-foreground">{text}</p>
      {meta ? <p className="mt-2 text-[11.5px] text-muted-foreground">{meta}</p> : null}
      {children ? <div className="mt-4">{children}</div> : null}
    </Card>
  );
}
