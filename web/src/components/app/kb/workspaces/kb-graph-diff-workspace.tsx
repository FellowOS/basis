import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { MiniStatCard } from '@/components/app/shared/console/MiniStatCard.js';
import { EntityRefLine } from '@/components/app/kb/ledger/entity-ref-line.js';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card.js';
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from '@/components/ui/empty.js';
import { KbTemporalRangePicker } from '@/components/app/kb/widgets/kb-temporal-range-picker.js';
import { FieldGroup } from '@/components/ui/field.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Separator } from '@/components/ui/separator.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { formatLocaleDateTime, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { kbOpenApiGET } from '@/lib/openapi-client.js';
import { kbGraphPath } from '@/lib/graphUrlState.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbSearchPath } from '@/lib/searchUrlState.js';
import { endOfLocalDayIso, startOfLocalDayIso } from '@/lib/temporal/day-range.js';
import { resolveScrubberBounds } from '@/lib/temporal/scrubber-bounds.js';
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

function diffChangeTotal(summary: GraphDiffResponse['summary']): number {
  return (
    summary.nodes_added +
    summary.nodes_removed +
    summary.nodes_modified +
    summary.edges_added +
    summary.edges_removed
  );
}

function collectNodeIds(diff: GraphDiffResponse): string[] {
  const ids = new Set<string>();
  for (const id of diff.added_nodes) ids.add(id);
  for (const id of diff.removed_nodes) ids.add(id);
  for (const row of diff.modified_nodes) ids.add(row.id);
  for (const edge of diff.added_edges) {
    ids.add(edge.source_id);
    ids.add(edge.target_id);
  }
  for (const edge of diff.removed_edges) {
    ids.add(edge.source_id);
    ids.add(edge.target_id);
  }
  return [...ids];
}

function DiffSection({
  title,
  count,
  children,
  emptyLabel,
}: {
  title: string;
  count: number;
  children: ReactNode;
  emptyLabel: string;
}) {
  return (
    <section className="space-y-2">
      <div className="flex items-center gap-2">
        <h4 className="text-sm font-semibold text-foreground">{title}</h4>
        <Badge variant={count > 0 ? 'secondary' : 'outline'} className="tabular-nums">
          {count}
        </Badge>
      </div>
      {count > 0 ? (
        <ul className="space-y-2">{children}</ul>
      ) : (
        <p className="text-sm text-muted-foreground">{emptyLabel}</p>
      )}
    </section>
  );
}

function NodeListItem({
  nodeId,
  labels,
  href,
  suffix,
}: {
  nodeId: string;
  labels: Record<string, string | null>;
  href: string;
  suffix?: string;
}) {
  return (
    <li className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm">
      <Link to={href} className="block min-w-0 hover:underline">
        <EntityRefLine id={nodeId} labels={labels} className="min-w-0" />
      </Link>
      {suffix ? (
        <p className="mt-1 font-mono text-[11px] text-muted-foreground">{suffix}</p>
      ) : null}
    </li>
  );
}

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
  const { t, locale } = useI18n();
  const g = t.kbGraphDiff;
  const loc = locale as Locale;
  const [, setSearchParams] = useSearchParams();
  const [fromTime, setFromTime] = useState(initialFrom ?? '');
  const [toTime, setToTime] = useState(initialTo ?? '');
  const [ledgerBounds, setLedgerBounds] = useState<{ min?: string; max?: string } | null>(null);
  const [boundsLoading, setBoundsLoading] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [diff, setDiff] = useState<GraphDiffResponse | null>(null);
  const autoCompareRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    setBoundsLoading(true);
    void (async () => {
      try {
        const bounds = await kbOpenApiGET<{ min?: string; max?: string }>(kbId, 'temporal/bounds');
        if (cancelled) return;
        setLedgerBounds(bounds);
        const resolved = resolveScrubberBounds({
          minDate: bounds.min,
          maxDate: bounds.max,
          now: new Date(),
        });
        if (!initialFrom) {
          setFromTime((prev) => prev || startOfLocalDayIso(resolved.minBound));
        }
        if (!initialTo) {
          setToTime((prev) => prev || endOfLocalDayIso(resolved.maxBound));
        }
      } catch {
        if (!cancelled) setLedgerBounds(null);
      } finally {
        if (!cancelled) setBoundsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [initialFrom, initialTo, kbId]);

  const runDiff = useCallback(async () => {
    if (!fromTime.trim() || !toTime.trim()) return;
    setLoading(true);
    setError('');
    setDiff(null);
    try {
      const data = await kbOpenApiGET<GraphDiffResponse>(kbId, 'graph/diff', {
        params: { query: { from: fromTime.trim(), to: toTime.trim() } },
      });
      setDiff(data);
      setSearchParams({ from: fromTime.trim(), to: toTime.trim() }, { replace: true });
    } catch (err) {
      setError(formatUserFacingApiError(err, loc));
    } finally {
      setLoading(false);
    }
  }, [fromTime, kbId, loc, setSearchParams, toTime]);

  useEffect(() => {
    if (autoCompareRef.current) return;
    if (!initialFrom?.trim() || !initialTo?.trim()) return;
    autoCompareRef.current = true;
    void runDiff();
  }, [initialFrom, initialTo, runDiff]);

  const labelIds = useMemo(() => (diff ? collectNodeIds(diff) : []), [diff]);
  const nodeLabels = useKbNodeLabels(kbId, labelIds);

  const graphAtForDiff = diff ? diff.to_time?.trim() || toTime.trim() : toTime.trim();
  const nodeGraphHref = (nodeId: string) =>
    kbGraphPath(kbId, { focus: nodeId, at: graphAtForDiff || undefined });

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    void runDiff();
  }

  function applyLedgerBounds() {
    const resolved = resolveScrubberBounds({
      minDate: ledgerBounds?.min,
      maxDate: ledgerBounds?.max,
      now: new Date(),
    });
    setFromTime(startOfLocalDayIso(resolved.minBound));
    setToTime(endOfLocalDayIso(resolved.maxBound));
  }

  const canCompare = Boolean(fromTime.trim() && toTime.trim()) && !loading;
  const changeTotal = diff ? diffChangeTotal(diff.summary) : 0;
  const toTimeTrimmed = toTime.trim();

  return (
    <div className={cn('kb-graph-diff-workspace flex min-h-0 flex-col gap-4', className)}>
      <Card className="gap-0 py-0">
        <CardHeader className="border-b px-4 py-4 sm:px-6">
          <CardTitle className="text-base">{g.timeRange}</CardTitle>
          <CardDescription>{g.compareHint}</CardDescription>
        </CardHeader>
        <form onSubmit={(e) => void onSubmit(e)}>
          <CardContent className="px-4 py-4 sm:px-6">
            <FieldGroup className="gap-4">
              <KbTemporalRangePicker
                fromTime={fromTime}
                toTime={toTime}
                onFromChange={setFromTime}
                onToChange={setToTime}
                ledgerMin={ledgerBounds?.min}
                ledgerMax={ledgerBounds?.max}
                boundsLoading={boundsLoading}
                disabled={loading}
              />
            </FieldGroup>
          </CardContent>
          <CardFooter className="flex flex-wrap items-center gap-2 border-t px-4 py-3 sm:px-6">
            <Button type="submit" size="sm" disabled={!canCompare}>
              {loading ? <Spinner className="size-4" /> : null}
              {g.compare}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              disabled={boundsLoading || ledgerBounds === null}
              onClick={applyLedgerBounds}
            >
              {boundsLoading ? <Spinner className="size-4" /> : null}
              {g.useFullRange}
            </Button>
            <Button type="button" size="sm" variant="ghost" asChild>
              <Link to={kbPath(kbId, 'graph')}>{g.graphLink}</Link>
            </Button>
            {toTimeTrimmed ? (
              <Button type="button" size="sm" variant="ghost" asChild>
                <Link to={kbSearchPath(kbId, { scope: 'graph' })}>
                  {g.searchLink}
                </Link>
              </Button>
            ) : null}
          </CardFooter>
        </form>
      </Card>

      {error ? (
        <Alert variant="destructive">
          <PublicIcon name="alert-circle" size={16} />
          <AlertTitle>{t.common.loadFailed}</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      {loading && !diff ? (
        <div className="flex items-center justify-center py-16">
          <Spinner className="size-6" />
        </div>
      ) : null}

      {!loading && !diff && !error ? (
        <Empty className="border border-dashed border-border bg-muted/20">
          <EmptyHeader>
            <EmptyMedia variant="icon">
              <PublicIcon name="git-diff" size={24} />
            </EmptyMedia>
            <EmptyTitle>{g.emptyTitle}</EmptyTitle>
            <EmptyDescription>{g.emptyDescription}</EmptyDescription>
          </EmptyHeader>
          <EmptyContent>
            {boundsLoading ? (
              <p className="text-muted-foreground text-xs">{g.boundsLoading}</p>
            ) : null}
          </EmptyContent>
        </Empty>
      ) : null}

      {diff ? (
        <div className="flex flex-col gap-4 pb-2">
          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
            <span className="font-medium text-foreground">{g.resolvedRange}</span>
            <span className="font-mono">
              {formatLocaleDateTime(loc, diff.from_time)} → {formatLocaleDateTime(loc, diff.to_time)}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            <MiniStatCard
              icon={<PublicIcon name="plus-01" size={18} />}
              tint="var(--ok)"
              tintBg="var(--ok-soft)"
              value={formatLocaleNumber(loc, diff.summary.nodes_added)}
              label={g.statNodesAdded}
            />
            <MiniStatCard
              icon={<PublicIcon name="minus" size={18} />}
              tint="var(--bad)"
              tintBg="var(--bad-soft)"
              value={formatLocaleNumber(loc, diff.summary.nodes_removed)}
              label={g.statNodesRemoved}
            />
            <MiniStatCard
              icon={<PublicIcon name="edit-01" size={18} />}
              tint="var(--info)"
              tintBg="var(--info-soft)"
              value={formatLocaleNumber(loc, diff.summary.nodes_modified)}
              label={g.statNodesModified}
            />
            <MiniStatCard
              icon={<PublicIcon name="link" size={18} />}
              tint="var(--ok)"
              tintBg="var(--ok-soft)"
              value={formatLocaleNumber(loc, diff.summary.edges_added)}
              label={g.statEdgesAdded}
            />
            <MiniStatCard
              icon={<PublicIcon name="minus" size={18} />}
              tint="var(--bad)"
              tintBg="var(--bad-soft)"
              value={formatLocaleNumber(loc, diff.summary.edges_removed)}
              label={g.statEdgesRemoved}
            />
          </div>

          {changeTotal === 0 ? (
            <Empty className="border border-dashed border-border bg-muted/20 py-10">
              <EmptyHeader>
                <EmptyTitle>{g.noChangesTitle}</EmptyTitle>
                <EmptyDescription>{g.noChangesDescription}</EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <Tabs defaultValue="nodes">
              <TabsList variant="line" className="w-full justify-start">
                <TabsTrigger value="nodes">
                  {g.tabNodes}
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {formatLocaleNumber(
                      loc,
                      diff.summary.nodes_added +
                        diff.summary.nodes_removed +
                        diff.summary.nodes_modified,
                    )}
                  </Badge>
                </TabsTrigger>
                <TabsTrigger value="edges">
                  {g.tabEdges}
                  <Badge variant="secondary" className="ml-2 tabular-nums">
                    {formatLocaleNumber(loc, diff.summary.edges_added + diff.summary.edges_removed)}
                  </Badge>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="nodes" className="mt-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="space-y-6">
                    <DiffSection
                      title={g.addedNodesTitle}
                      count={diff.added_nodes.length}
                      emptyLabel={g.none}
                    >
                      {diff.added_nodes.map((id) => (
                        <NodeListItem
                          key={id}
                          nodeId={id}
                          labels={nodeLabels}
                          href={nodeGraphHref(id)}
                        />
                      ))}
                    </DiffSection>
                    <Separator />
                    <DiffSection
                      title={g.removedNodesTitle}
                      count={diff.removed_nodes.length}
                      emptyLabel={g.none}
                    >
                      {diff.removed_nodes.map((id) => (
                        <NodeListItem
                          key={id}
                          nodeId={id}
                          labels={nodeLabels}
                          href={nodeGraphHref(id)}
                        />
                      ))}
                    </DiffSection>
                    <Separator />
                    <DiffSection
                      title={g.modifiedNodesTitle}
                      count={diff.modified_nodes.length}
                      emptyLabel={g.none}
                    >
                      {diff.modified_nodes.map((row) => (
                        <NodeListItem
                          key={row.id}
                          nodeId={row.id}
                          labels={nodeLabels}
                          href={nodeGraphHref(row.id)}
                          suffix={row.change}
                        />
                      ))}
                    </DiffSection>
                  </div>
                </div>
              </TabsContent>

              <TabsContent value="edges" className="mt-4">
                <div className="rounded-lg border border-border p-4">
                  <div className="space-y-6">
                    <DiffSection
                      title={g.addedEdgesTitle}
                      count={diff.added_edges.length}
                      emptyLabel={g.none}
                    >
                      {diff.added_edges.map((edge, index) => (
                        <li
                          key={`${edge.source_id}-${edge.target_id}-${edge.type ?? ''}-${index}`}
                          className="rounded-md border border-border/80 bg-muted/30 px-3 py-2 text-sm"
                        >
                          <div className="flex flex-wrap items-center gap-1.5">
                            <Link
                              to={nodeGraphHref(edge.source_id)}
                              className="min-w-0 hover:underline"
                            >
                              <EntityRefLine
                                id={edge.source_id}
                                labels={nodeLabels}
                                className="inline min-w-0"
                              />
                            </Link>
                            <PublicIcon name="arrow-right" size={14} className="shrink-0 text-muted-foreground" />
                            <Link
                              to={nodeGraphHref(edge.target_id)}
                              className="min-w-0 hover:underline"
                            >
                              <EntityRefLine
                                id={edge.target_id}
                                labels={nodeLabels}
                                className="inline min-w-0"
                              />
                            </Link>
                          </div>
                          {edge.type ? (
                            <Badge variant="outline" className="mt-2 font-mono text-[10px]">
                              {edge.type}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </DiffSection>
                    <Separator />
                    <DiffSection
                      title={g.removedEdgesTitle}
                      count={diff.removed_edges.length}
                      emptyLabel={g.none}
                    >
                      {diff.removed_edges.map((edge, index) => (
                        <li
                          key={`${edge.source_id}-${edge.target_id}-${edge.type ?? ''}-${index}`}
                          className="rounded-md border border-border/80 px-3 py-2 text-sm text-muted-foreground"
                        >
                          <EntityRefLine
                            id={edge.source_id}
                            labels={nodeLabels}
                            className="inline min-w-0"
                          />
                          <span className="mx-1.5">→</span>
                          <EntityRefLine
                            id={edge.target_id}
                            labels={nodeLabels}
                            className="inline min-w-0"
                          />
                          {edge.type ? (
                            <Badge variant="outline" className="ml-2 font-mono text-[10px]">
                              {edge.type}
                            </Badge>
                          ) : null}
                        </li>
                      ))}
                    </DiffSection>
                  </div>
                </div>
              </TabsContent>
            </Tabs>
          )}
        </div>
      ) : null}
    </div>
  );
}
