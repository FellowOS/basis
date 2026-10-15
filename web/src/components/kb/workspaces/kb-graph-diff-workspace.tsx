import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbGraphPath } from '@/lib/graphUrlState.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbSearchPath } from '@/lib/searchUrlState.js';
import { cn } from '@/lib/utils.js';

type GraphDiffResponse = {
  from_time: string;
  to_time: string;
  added_nodes: string[];
  removed_nodes: string[];
  modified_nodes: Array<{ id: string; change: string }>;
  added_edges: Array<{ source_id: string; target_id: string; type?: string }>;
  removed_edges: Array<{ source_id: string; target_id: string; type?: string }>;
  summary: {
    nodes_added: number;
    nodes_removed: number;
    nodes_modified: number;
    edges_added: number;
    edges_removed: number;
  };
};

export type GraphDiffPageActions = {
  openRange: () => void;
  runCompare: () => void;
  loading: boolean;
  rangeSummary: string;
};

export function KbGraphDiffWorkspace({
  kbId,
  className,
  initialFrom,
  initialTo,
  pageActionsInHeader = false,
  onPageActionsChange,
}: {
  kbId: string;
  className?: string;
  initialFrom?: string;
  initialTo?: string;
  pageActionsInHeader?: boolean;
  onPageActionsChange?: (actions: GraphDiffPageActions | null) => void;
}) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const [, setSearchParams] = useSearchParams();
  const [fromTime, setFromTime] = useState(initialFrom ?? '');
  const [toTime, setToTime] = useState(initialTo ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState<GraphDiffResponse | null>(null);
  const [rangeOpen, setRangeOpen] = useState(false);

  useEffect(() => {
    if (initialFrom || initialTo) return;
    void (async () => {
      try {
        const bounds = await api<{ min?: string; max?: string }>(`/api/kbs/${kbId}/temporal/bounds`);
        setFromTime((prev) => prev || bounds.min || '');
        setToTime((prev) => prev || bounds.max || '');
      } catch {
        /* optional */
      }
    })();
  }, [kbId, initialFrom, initialTo]);

  const runDiff = useCallback(async () => {
    if (!fromTime.trim() || !toTime.trim()) return;
    setLoading(true);
    setError('');
    setDiff(null);
    try {
      const params = new URLSearchParams({ from: fromTime.trim(), to: toTime.trim() });
      const data = await api<GraphDiffResponse>(`/api/kbs/${kbId}/graph/diff?${params}`);
      setDiff(data);
      setSearchParams(
        { from: fromTime.trim(), to: toTime.trim() },
        { replace: true },
      );
    } catch (err) {
      setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
    } finally {
      setLoading(false);
    }
  }, [fromTime, kbId, setSearchParams, toTime, zh]);

  const rangeSummary = `${fromTime.trim() || '…'} → ${toTime.trim() || '…'}`;

  useEffect(() => {
    if (!pageActionsInHeader || !onPageActionsChange) return;
    onPageActionsChange({
      openRange: () => setRangeOpen(true),
      runCompare: () => void runDiff(),
      loading,
      rangeSummary,
    });
    return () => onPageActionsChange(null);
  }, [loading, onPageActionsChange, pageActionsInHeader, rangeSummary, runDiff]);

  const graphAtForDiff = diff ? diff.to_time?.trim() || toTime.trim() : '';
  const nodeGraphHref = (nodeId: string) =>
    kbGraphPath(kbId, { focus: nodeId, at: graphAtForDiff || undefined });

  const section = (title: string, items: ReactNode) => (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{items}</div>
    </section>
  );

  return (
    <div className={cn('kb-graph-diff-workspace flex min-h-0 flex-col gap-4', className)}>
      {!pageActionsInHeader ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button type="button" size="sm" variant="outline" onClick={() => setRangeOpen(true)}>
            {zh ? '时间范围' : 'Time range'}
          </Button>
          <span className="max-w-full truncate font-mono text-xs text-muted-foreground">{rangeSummary}</span>
          <Button type="button" size="sm" disabled={loading} onClick={() => void runDiff()}>
            {loading ? <Spinner className="size-4" /> : null}
            {zh ? '对比' : 'Compare'}
          </Button>
          <Link to={kbPath(kbId, 'graph')} className="text-xs text-primary hover:underline">
            {zh ? '返回图谱' : 'Back to graph'}
          </Link>
          {toTime.trim() ? (
            <Link
              to={kbSearchPath(kbId, { tab: 'graph', as_of: toTime.trim() })}
              className="text-xs text-primary hover:underline"
            >
              {zh ? '在「结束时刻」搜索图谱节点' : 'Search graph at end instant'}
            </Link>
          ) : null}
        </div>
      ) : null}
      {pageActionsInHeader ? (
        <div className="flex flex-wrap gap-3 text-xs">
          <Link to={kbPath(kbId, 'graph')} className="text-primary hover:underline">
            {zh ? '返回图谱' : 'Back to graph'}
          </Link>
          {toTime.trim() ? (
            <Link
              to={kbSearchPath(kbId, { tab: 'graph', as_of: toTime.trim() })}
              className="text-primary hover:underline"
            >
              {zh ? '在结束时刻搜索图谱节点' : 'Search graph at end instant'}
            </Link>
          ) : null}
        </div>
      ) : null}

      <Dialog open={rangeOpen} onOpenChange={setRangeOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{zh ? '对比时间范围' : 'Compare time range'}</DialogTitle>
            <DialogDescription>
              {zh ? '使用 ISO-8601 时刻（与图谱时态投影一致）。' : 'Use ISO-8601 instants (same as graph temporal projection).'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="grid gap-2">
              <Label htmlFor="graph-diff-from">{zh ? '起始时刻 (from)' : 'From (ISO)'}</Label>
              <Input
                id="graph-diff-from"
                value={fromTime}
                onChange={(e) => setFromTime(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="graph-diff-to">{zh ? '结束时刻 (to)' : 'To (ISO)'}</Label>
              <Input
                id="graph-diff-to"
                value={toTime}
                onChange={(e) => setToTime(e.target.value)}
                className="font-mono text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setRangeOpen(false)}>
              {zh ? '关闭' : 'Close'}
            </Button>
            <Button
              type="button"
              onClick={() => {
                setRangeOpen(false);
                void runDiff();
              }}
              disabled={loading || !fromTime.trim() || !toTime.trim()}
            >
              {zh ? '对比' : 'Compare'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      {diff ? (
        <div className="grid gap-3 md:grid-cols-2">
          {section(
            zh ? '摘要' : 'Summary',
            <ul className="list-inside list-disc font-mono text-xs">
              <li>+{diff.summary.nodes_added} / −{diff.summary.nodes_removed} nodes</li>
              <li>{diff.summary.nodes_modified} modified</li>
              <li>+{diff.summary.edges_added} / −{diff.summary.edges_removed} edges</li>
            </ul>,
          )}
          {section(
            zh ? '新增节点' : 'Added nodes',
            diff.added_nodes.length
              ? diff.added_nodes.map((id) => (
                  <div key={id}>
                    <Link to={nodeGraphHref(id)} className="font-mono text-xs text-primary hover:underline">
                      {id}
                    </Link>
                  </div>
                ))
              : zh ? '无' : 'None',
          )}
          {section(
            zh ? '移除节点' : 'Removed nodes',
            diff.removed_nodes.length ? (
              <ul className="font-mono text-xs">
                {diff.removed_nodes.map((id) => (
                  <li key={id}>
                    <Link to={nodeGraphHref(id)} className="text-primary hover:underline">
                      {id}
                    </Link>
                  </li>
                ))}
              </ul>
            ) : (
              zh ? '无' : 'None'
            ),
          )}
          {section(
            zh ? '属性变更' : 'Modified nodes',
            diff.modified_nodes.length ? (
              <ul className="font-mono text-xs">
                {diff.modified_nodes.map((row) => (
                  <li key={row.id}>
                    <Link to={nodeGraphHref(row.id)} className="text-primary hover:underline">
                      {row.id}
                    </Link>
                    {' '}
                    ({row.change})
                  </li>
                ))}
              </ul>
            ) : (
              zh ? '无' : 'None'
            ),
          )}
          {section(
            zh ? '新增边' : 'Added edges',
            diff.added_edges.length ? (
              <ul className="font-mono text-xs">
                {diff.added_edges.map((e, i) => (
                  <li key={i}>
                    <Link to={nodeGraphHref(e.source_id)} className="text-primary hover:underline">
                      {e.source_id}
                    </Link>
                    {' → '}
                    <Link to={nodeGraphHref(e.target_id)} className="text-primary hover:underline">
                      {e.target_id}
                    </Link>
                    {' '}
                    ({e.type ?? '?'})
                  </li>
                ))}
              </ul>
            ) : (
              zh ? '无' : 'None'
            ),
          )}
          {section(
            zh ? '移除边' : 'Removed edges',
            diff.removed_edges.length ? (
              <ul className="font-mono text-xs">
                {diff.removed_edges.map((e, i) => (
                  <li key={i}>{e.source_id} → {e.target_id} ({e.type ?? '?'})</li>
                ))}
              </ul>
            ) : (
              zh ? '无' : 'None'
            ),
          )}
        </div>
      ) : null}
    </div>
  );
}
