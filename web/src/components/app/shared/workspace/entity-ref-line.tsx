import { formatNodeRefDetail } from '@/lib/workspace/format-node-ref.js';

/** One-line entity display with optional UUID subtitle. */
export function EntityRefLine({
  id,
  labels,
  className,
}: {
  id: string;
  labels: Record<string, string | null | undefined>;
  className?: string;
}) {
  const { title, subtitle } = formatNodeRefDetail(id, labels);
  return (
    <div className={className}>
      <div className="text-sm font-medium">{title}</div>
      {subtitle ? <div className="font-mono text-[10px] text-muted-foreground">{subtitle}</div> : null}
    </div>
  );
}
