import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbPath } from '@/lib/nav-config.js';
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

export function KbGraphDiffWorkspace({
  kbId,
  className,
  initialFrom,
  initialTo,
}: {
  kbId: string;
  className?: string;
  initialFrom?: string;
  initialTo?: string;
}) {
  const { locale } = useI18n();
  const zh = locale === 'zh';
  const [fromTime, setFromTime] = useState(initialFrom ?? '');
  const [toTime, setToTime] = useState(initialTo ?? '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState<GraphDiffResponse | null>(null);

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

  async function runDiff() {
    if (!fromTime.trim() || !toTime.trim()) return;
    setLoading(true);
    setError('');
    setDiff(null);
    try {
      const params = new URLSearchParams({ from: fromTime.trim(), to: toTime.trim() });
      const data = await api<GraphDiffResponse>(`/api/kbs/${kbId}/graph/diff?${params}`);
      setDiff(data);
    } catch (err) {
      setError(formatUserFacingApiError(err, zh ? 'zh' : 'en'));
    } finally {
      setLoading(false);
    }
  }

  const section = (title: string, items: ReactNode) => (
    <section className="rounded-lg border bg-card p-4">
      <h3 className="text-sm font-semibold">{title}</h3>
      <div className="mt-2 text-sm text-muted-foreground">{items}</div>
    </section>
  );

  return (
    <div className={cn('kb-graph-diff-workspace flex min-h-0 flex-col gap-4', className)}>
      <p className="text-sm text-muted-foreground">
        {zh
          ? '对比两个时点的图投影（节点、边与属性变更）。合并与发布仍通过审核队列与本体版本完成。'
          : 'Compare graph projection at two instants (nodes, edges, property changes). Merge/publish still flows through review and ontology versions.'}
      </p>
      <div className="flex flex-wrap items-end gap-3">
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">{zh ? '起始时刻 (from)' : 'From (ISO)'}</label>
          <Input value={fromTime} onChange={(e) => setFromTime(e.target.value)} className="min-w-[220px] font-mono text-xs" />
        </div>
        <div className="grid gap-1">
          <label className="text-xs text-muted-foreground">{zh ? '结束时刻 (to)' : 'To (ISO)'}</label>
          <Input value={toTime} onChange={(e) => setToTime(e.target.value)} className="min-w-[220px] font-mono text-xs" />
        </div>
        <Button type="button" size="sm" disabled={loading} onClick={() => void runDiff()}>
          {loading ? <Spinner className="size-4" /> : null}
          {zh ? '对比' : 'Compare'}
        </Button>
        <Link to={kbPath(kbId, 'graph')} className="text-xs text-primary hover:underline">
          {zh ? '返回图谱' : 'Back to graph'}
        </Link>
      </div>
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
                    <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(id)}`} className="font-mono text-xs text-primary hover:underline">
                      {id}
                    </Link>
                  </div>
                ))
              : zh ? '无' : 'None',
          )}
          {section(
            zh ? '移除节点' : 'Removed nodes',
            diff.removed_nodes.length ? (
              <ul className="font-mono text-xs">{diff.removed_nodes.map((id) => <li key={id}>{id}</li>)}</ul>
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
                    <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(row.id)}`} className="text-primary hover:underline">
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
                  <li key={i}>{e.source_id} → {e.target_id} ({e.type ?? '?'})</li>
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
