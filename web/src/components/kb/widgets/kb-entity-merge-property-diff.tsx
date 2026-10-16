import { PublicIcon } from '@/components/ui/public-icon.js';
import { useEffect, useState } from 'react';
import {
  diffGraphNodeFields,
  fetchKbGraphNode,
  graphNodeFieldMap,
} from '@/lib/kb-graph-node-detail.js';
import { useI18n } from '@/i18n/context.js';
import { cn } from '@/lib/utils.js';

export function KbEntityMergePropertyDiff({
  kbId,
  primaryId,
  duplicateId,
  className,
  variant = 'console',
}: {
  kbId: string;
  primaryId: string;
  duplicateId: string;
  className?: string;
  /** Explorer console uses oh-card styling; review queue uses compact table. */
  variant?: 'console' | 'compact';
}) {
  const { t } = useI18n();
  const er = t.entityResolution;
  const [rows, setRows] = useState<
    Array<{ key: string; primary: string; duplicate: string; differs: boolean }>
  >([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  useEffect(() => {
    let ignore = false;
    setLoading(true);
    setLoadError('');
    void (async () => {
      try {
        const [a, b] = await Promise.all([
          fetchKbGraphNode(kbId, primaryId),
          fetchKbGraphNode(kbId, duplicateId),
        ]);
        if (!ignore) {
          setRows(diffGraphNodeFields(graphNodeFieldMap(a), graphNodeFieldMap(b)));
        }
      } catch {
        if (!ignore) setLoadError(er.propertyDiffLoadError);
      } finally {
        if (!ignore) setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [kbId, primaryId, duplicateId, er.propertyDiffLoadError]);

  if (loading) {
    return (
      <div className={cn('flex items-center gap-2 text-xs text-muted-foreground', className)}>
        <PublicIcon name='loader-01' className="size-3 animate-spin" />
        {er.propertyDiffLoading}
      </div>
    );
  }
  if (loadError) {
    return <p className={cn('text-xs text-destructive', className)}>{loadError}</p>;
  }
  if (rows.length === 0) {
    return (
      <p className={cn('text-xs text-muted-foreground', className)}>{er.propertyDiffEmpty}</p>
    );
  }

  if (variant === 'compact') {
    return (
      <div className={cn('mt-3 overflow-hidden rounded-md border border-border text-xs', className)}>
        <div className="grid grid-cols-[7rem_1fr_1fr] border-b border-border bg-muted/40 font-medium text-muted-foreground">
          <div className="px-2 py-1.5">{er.fieldCol}</div>
          <div className="border-l border-border px-2 py-1.5">{er.keepCol}</div>
          <div className="border-l border-border px-2 py-1.5">{er.removeCol}</div>
        </div>
        {rows.map((row) => (
          <div
            key={row.key}
            className={cn(
              'grid grid-cols-[7rem_1fr_1fr] border-b border-border last:border-b-0',
              row.differs && 'bg-amber-500/5',
            )}
          >
            <div className="px-2 py-1.5 font-medium text-muted-foreground">{row.key}</div>
            <div className="break-words border-l border-border px-2 py-1.5">{row.primary || '—'}</div>
            <div
              className={cn(
                'break-words border-l border-border px-2 py-1.5',
                row.differs && 'font-medium text-amber-700 dark:text-amber-400',
              )}
            >
              {row.duplicate || '—'}
            </div>
          </div>
        ))}
      </div>
    );
  }

  return (
    <div
      className={cn('mt-3 overflow-hidden rounded-[10px] border border-[rgba(74,163,255,0.12)]', className)}
    >
      <div
        className="grid grid-cols-[120px_1fr_1fr] border-b border-[var(--ws-border)] bg-black/25 text-[10px] font-bold uppercase tracking-wide text-[var(--ws-text-dim)]"
      >
        <div className="px-3 py-2">{er.fieldCol}</div>
        <div className="border-l border-[var(--ws-border)] px-3 py-2">{er.keepCol}</div>
        <div className="border-l border-[var(--ws-border)] px-3 py-2">{er.removeCol}</div>
      </div>
      {rows.map((row) => (
        <div
          key={row.key}
          className={cn(
            'grid grid-cols-[120px_1fr_1fr] border-b border-[rgba(74,163,255,0.06)] text-xs last:border-b-0',
            row.differs && 'bg-[rgba(242,182,109,0.04)]',
          )}
        >
          <div className="px-3 py-2 font-semibold text-[var(--ws-text-dim)]">{row.key}</div>
          <div className="break-words border-l border-[var(--ws-border)] px-3 py-2">{row.primary || '—'}</div>
          <div
            className={cn(
              'break-words border-l border-[var(--ws-border)] px-3 py-2',
              row.differs && 'font-semibold text-[#fbbf24]',
            )}
          >
            {row.duplicate || '—'}
          </div>
        </div>
      ))}
    </div>
  );
}
