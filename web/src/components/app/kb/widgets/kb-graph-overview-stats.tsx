import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbPath } from '@/lib/nav-config.js';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Spinner } from '@/components/ui/spinner.js';
import { graphProgressWidthStyle } from '@/lib/graph/graph-ui-classes.js';
import { useI18n } from '@/i18n/context.js';
import { formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';

type GraphStats = {
  node_count?: number;
  edge_count?: number;
  node_types?: Record<string, number>;
  edge_types?: Record<string, number>;
};

type NodeItem = {
  id: string;
  type: string;
  content?: string;
};

function TypeBar({
  locale,
  label,
  count,
  total,
}: {
  locale: Locale;
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-2 py-1 text-xs">
      <span className="w-28 shrink-0 truncate text-muted-foreground" title={label}>
        {label}
      </span>
      <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
        <div className="h-full rounded-full bg-primary" style={graphProgressWidthStyle(pct / 100)} />
      </div>
      <span className="w-16 shrink-0 text-right tabular-nums text-muted-foreground">
        {formatLocaleNumber(locale, count)} ({pct}%)
      </span>
    </div>
  );
}

export function KbGraphOverviewStats({ kbId }: { kbId: string }) {
  const { t, locale } = useI18n();
  const w = t.kbGraphWorkspace.widgets;
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<GraphStats | null>(null);
  const [nodeTypes, setNodeTypes] = useState<Record<string, number>>({});
  const [topNodes, setTopNodes] = useState<Array<{ node: NodeItem; degree: number }>>([]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [statsBody, nodesBody, edgesBody] = await Promise.all([
        api<GraphStats>(`/api/kbs/${kbId}/graph/stats`),
        api<{ nodes: NodeItem[] }>(`/api/kbs/${kbId}/graph/nodes?limit=500`),
        api<{ edges: Array<{ source: string; target: string }> }>(
          `/api/kbs/${kbId}/graph/edges?limit=2000`,
        ),
      ]);
      setStats(statsBody);
      const nodes = nodesBody.nodes ?? [];
      const typeMap: Record<string, number> = {};
      for (const n of nodes) {
        const type = n.type || 'unknown';
        typeMap[type] = (typeMap[type] ?? 0) + 1;
      }
      setNodeTypes(typeMap);

      const degree: Record<string, number> = {};
      for (const e of edgesBody.edges ?? []) {
        degree[e.source] = (degree[e.source] ?? 0) + 1;
        degree[e.target] = (degree[e.target] ?? 0) + 1;
      }
      setTopNodes(
        nodes
          .map((n) => ({ node: n, degree: degree[n.id] ?? 0 }))
          .sort((a, b) => b.degree - a.degree)
          .slice(0, 8),
      );
    } catch (err) {
      setError(formatUserFacingApiError(err, locale as Locale));
      setStats(null);
    } finally {
      setLoading(false);
    }
  }, [kbId, locale]);

  useEffect(() => {
    void load();
  }, [load]);

  const nodeTypeEntries = Object.entries(nodeTypes).sort((a, b) => b[1] - a[1]);
  const totalTyped = nodeTypeEntries.reduce((s, [, c]) => s + c, 0);

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-start justify-between gap-2 space-y-0">
        <div>
          <CardTitle className="text-base">{w.overviewTitle}</CardTitle>
          <CardDescription>{w.overviewDescription}</CardDescription>
        </div>
        <Link className="text-sm text-primary hover:underline" to={kbPath(kbId, 'graph')}>
          {w.openGraph}
        </Link>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner className="size-4" />
            {t.common.loading}
          </div>
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : stats ? (
          <>
            <dl className="grid gap-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-muted-foreground">{w.nodesLabel}</dt>
                <dd className="font-mono text-lg font-semibold">
                  {formatLocaleNumber(locale, stats.node_count ?? 0)}
                </dd>
              </div>
              <div>
                <dt className="text-muted-foreground">{w.edgesLabel}</dt>
                <dd className="font-mono text-lg font-semibold">
                  {formatLocaleNumber(locale, stats.edge_count ?? 0)}
                </dd>
              </div>
            </dl>
            {nodeTypeEntries.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{w.nodeTypesSample}</p>
                {nodeTypeEntries.slice(0, 8).map(([label, count]) => (
                  <TypeBar key={label} locale={locale} label={label} count={count} total={totalTyped} />
                ))}
              </div>
            ) : null}
            {topNodes.length > 0 ? (
              <div>
                <p className="mb-2 text-xs font-medium text-muted-foreground">{w.highestDegreeSample}</p>
                <ul className="space-y-1 text-xs">
                  {topNodes.map(({ node, degree }) => (
                    <li key={node.id} className="flex justify-between gap-2 font-mono">
                      <Link
                        className="truncate text-primary hover:underline"
                        to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(node.id)}`}
                      >
                        {node.content?.slice(0, 48) || node.id}
                      </Link>
                      <span className="shrink-0 text-muted-foreground">{degree}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </>
        ) : null}
      </CardContent>
    </Card>
  );
}
