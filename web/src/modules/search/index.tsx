import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  DataPanel,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { WorkspaceUnavailable } from '@/components/app/shared/workspace/frame/ws-unavailable.js';
import {
  SearchChunkList,
  SearchEntityList,
  SearchGraphList,
  type ChunkHit,
  type GraphSearchHit,
} from '@/modules/search/pages/search-results.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { workspaceApiClient } from '@/lib/workspace/api-client.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { useWorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { useWorkspaceTemporalBounds } from '@/lib/workspace/use-temporal-bounds.js';
import type { LedgerEntityHit } from '@/modules/entities/components/ledger-entity-browser.js';
import { useWorkspaceNodeLabels } from '@/lib/workspace/node-labels.js';
import { graphPath } from '@/lib/graphUrlState.js';
import { workspaceGraphDiffPath, workspacePath } from '@/lib/nav-config.js';
import {
  searchPath,
  parseSearchUrlState,
  resolveSearchScope,
  type SearchScope,
} from '@/lib/searchUrlState.js';

const PREVIEW_LIMIT = 8;
const SEARCH_LIMIT = 30;

export function SearchPage() {
  const { t, locale } = useI18n();
  const emptyCell = t.core.common.emptyCell;
  const s = t.search.page;
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getWorkspace } = useWorkspaceCatalog();
  const { caps, loading: capsLoading } = useWorkspaceCapabilities();
  const { bounds: temporalBounds } = useWorkspaceTemporalBounds(id ?? undefined);
  const kb = id ? getWorkspace(id) : undefined;

  const [scope, setScope] = useState<SearchScope>(() =>
    resolveSearchScope(searchParams.get('scope'), searchParams.get('tab')),
  );
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const [asOf, setAsOf] = useState(() => searchParams.get('as_of') ?? '');
  const [at, setAt] = useState(() => searchParams.get('at') ?? '');

  const [graphResults, setGraphResults] = useState<GraphSearchHit[]>([]);
  const [chunkResults, setChunkResults] = useState<ChunkHit[]>([]);
  const [entityResults, setEntityResults] = useState<LedgerEntityHit[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [hasSearched, setHasSearched] = useState(() => Boolean(searchParams.get('q')?.trim()));

  const ranUrlQueryKey = useRef<string | null>(null);

  const graphEnabled = !capsLoading && caps?.graph === true;
  const graphScopeBlocked = scope === 'graph' && id && !capsLoading && caps && !caps.graph;

  const graphLabelIds = graphResults.map((hit) => hit.node.id);
  const graphLabels = useWorkspaceNodeLabels(id, graphLabelIds);

  const syncSearchUrl = useCallback(
    (opts: {
      q: string;
      scope: SearchScope;
      asOf?: string;
      at?: string;
    }) => {
      if (!id) return;
      const href = searchPath(id, {
        scope: opts.scope,
        q: opts.q,
        asOf: opts.asOf?.trim() || undefined,
        at: opts.at?.trim() || undefined,
      });
      const next = href.split('?')[1] ?? '';
      setSearchParams(new URLSearchParams(next), { replace: true });
    },
    [id, setSearchParams],
  );

  const fetchChunks = useCallback(
    async (q: string, limit: number, asOfIso: string) => {
      if (!id) return [] as ChunkHit[];
      const trimmed = asOfIso.trim();
      const data = await workspaceApiClient(id).searchChunks(q, limit, {
        ...(trimmed ? { as_of: trimmed } : {}),
      });
      return (data.chunks ?? []) as ChunkHit[];
    },
    [id],
  );

  const fetchGraph = useCallback(
    async (q: string, limit: number, atIso: string) => {
      if (!id) return [] as GraphSearchHit[];
      const trimmed = atIso.trim();
      const data = await workspaceApiClient(id).searchGraph(
        q,
        limit,
        trimmed || undefined,
      );
      return data.results as GraphSearchHit[];
    },
    [id],
  );

  const fetchEntities = useCallback(
    async (q: string, limit: number) => {
      if (!id) return [] as LedgerEntityHit[];
      const kb = workspaceApiClient(id);
      if (q.trim()) {
        const data = await kb.findEntities(q, limit);
        return (data.ledger_entities ?? []) as LedgerEntityHit[];
      }
      const data = await kb.listLedgerEntities(limit);
      return (data.entities ?? []) as LedgerEntityHit[];
    },
    [id],
  );

  const runSearch = useCallback(
    async (
      activeScope: SearchScope,
      q: string,
      temporal: { asOf: string; at: string },
    ) => {
      if (!id) return;
      const trimmed = q.trim();
      const needsQuery = activeScope !== 'entities';
      if (needsQuery && !trimmed) return;

      setLoading(true);
      setError(null);
      setHasSearched(true);

      const limit = SEARCH_LIMIT;

      try {
        if (activeScope === 'chunks') {
          const chunks = await fetchChunks(trimmed, limit, temporal.asOf);
          setChunkResults(chunks);
          setGraphResults([]);
          setEntityResults([]);
        } else if (activeScope === 'graph') {
          if (!graphEnabled) {
            setGraphResults([]);
            setChunkResults([]);
            setEntityResults([]);
            return;
          }
          const graph = await fetchGraph(trimmed, limit, temporal.at);
          setGraphResults(graph);
          setChunkResults([]);
          setEntityResults([]);
        } else {
          const entities = await fetchEntities(trimmed, limit);
          setEntityResults(entities);
          setChunkResults([]);
          setGraphResults([]);
        }
      } catch (err) {
        setError(formatUserFacingApiError(err, locale as Locale));
        setChunkResults([]);
        setGraphResults([]);
        setEntityResults([]);
      } finally {
        setLoading(false);
      }
    },
    [id, fetchChunks, fetchGraph, fetchEntities, graphEnabled, locale],
  );

  useEffect(() => {
    const parsed = parseSearchUrlState(searchParams.toString());
    setScope(parsed.scope);
    const q = searchParams.get('q');
    if (q != null) setQuery(q);
    setAsOf(parsed.asOf ?? '');
    setAt(parsed.at ?? '');
  }, [searchParams]);

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (!q || !id) return;
    const parsed = parseSearchUrlState(searchParams.toString());
    const key = [parsed.scope, q, parsed.asOf ?? '', parsed.at ?? ''].join('|');
    if (ranUrlQueryKey.current === key) return;
    if (parsed.scope === 'graph' && capsLoading) return;
    if (parsed.scope === 'graph' && caps && !caps.graph) {
      ranUrlQueryKey.current = key;
      return;
    }
    ranUrlQueryKey.current = key;
    setQuery(q);
    setScope(parsed.scope);
    void runSearch(parsed.scope, q, {
      asOf: parsed.asOf ?? '',
      at: parsed.at ?? '',
    });
  }, [id, searchParams, capsLoading, caps, runSearch]);

  useEffect(() => {
    if (scope !== 'entities' || !id || hasSearched) return;
    let cancelled = false;
    void fetchEntities('', PREVIEW_LIMIT)
      .then((rows) => {
        if (!cancelled) setEntityResults(rows);
      })
      .catch(() => {
        if (!cancelled) setEntityResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [scope, id, hasSearched, fetchEntities]);

  function placeholderForScope(activeScope: SearchScope): string {
    if (activeScope === 'chunks') return s.chunk_placeholder;
    if (activeScope === 'graph') return s.graph_placeholder;
    return s.entity_placeholder;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!id) return;
    if (scope !== 'entities' && !q) return;
    syncSearchUrl({ q, scope, asOf, at });
    void runSearch(scope, q, { asOf, at });
  }

  function changeScope(next: SearchScope) {
    setScope(next);
    syncSearchUrl({ q: query.trim(), scope: next, asOf, at });
    const q = query.trim();
    if (q || next === 'entities') {
      void runSearch(next, q, { asOf, at });
    } else {
      setChunkResults([]);
      setGraphResults([]);
      setEntityResults([]);
      setHasSearched(false);
      setError(null);
    }
  }

  const name = kb?.name ?? id ?? t.core.common.ellipsis;

  if (graphScopeBlocked && id) {
    return <WorkspaceUnavailable workspaceId={id} feature="graph" />;
  }

  const resultCount =
    scope === 'chunks'
      ? chunkResults.length
      : scope === 'graph'
        ? graphResults.length
        : entityResults.length;
  const countLabel = fmt(
    pickCountForm(locale, resultCount, s.result_count_one, s.result_count),
    { count: formatLocaleNumber(locale, resultCount) },
  );

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.core.workspace_nav.platform.workspaces, to: '/workspaces' },
        { label: name, to: id ? workspacePath(id, 'graph') : '/workspaces' },
        { label: t.search.menu.search },
      ]}
      subtitle={
        <>
          {t.search.page.subtitle}{' '}
          {id ? (
            <Link
              to={workspacePath(id, 'settings') + '?tab=search'}
              className="text-primary underline-offset-2 hover:underline"
            >
              {s.search_settings_link}
            </Link>
          ) : null}
        </>
      }
    >
      <DataPanel>
        <form onSubmit={onSubmit}>
          <DataPanelToolbar
            className="gap-3"
            search={
              <div className="flex min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center">
                <ToolbarSearch
                  className="min-w-0 flex-1"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={placeholderForScope(scope)}
                />
                <div className="flex shrink-0 items-center gap-2">
                  <Label htmlFor="workspace-search-scope" className="sr-only">
                    {s.scope_label}
                  </Label>
                  <Select
                    value={scope}
                    onValueChange={(v) => changeScope(v as SearchScope)}
                  >
                    <SelectTrigger id="workspace-search-scope" className="h-9 w-[9.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chunks">{s.scope_documents}</SelectItem>
                      <SelectItem value="graph" disabled={!graphEnabled}>
                        {s.scope_graph}
                      </SelectItem>
                      <SelectItem value="entities">{s.scope_entities}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            }
            actions={
              <Button type="submit" size="sm" className="h-9 min-w-[5.5rem]" disabled={loading}>
                {loading ? <Spinner className="size-4" /> : null}
                {loading ? s.searching : s.search}
              </Button>
            }
          />
          {scope === 'chunks' || scope === 'graph' ? (
            <div className="mt-3 flex flex-col gap-2 border-t border-border/60 px-1 pt-3 sm:flex-row sm:items-end">
              <div className="min-w-0 flex-1 space-y-1.5">
                <Label htmlFor={scope === 'chunks' ? 'workspace-search-as-of' : 'workspace-search-at'}>
                  {scope === 'chunks' ? s.temporal_as_of_label : s.temporal_at_label}
                </Label>
                <Input
                  id={scope === 'chunks' ? 'workspace-search-as-of' : 'workspace-search-at'}
                  data-testid={scope === 'chunks' ? 'workspace-search-as-of' : 'workspace-search-at'}
                  value={scope === 'chunks' ? asOf : at}
                  onChange={(e) =>
                    scope === 'chunks' ? setAsOf(e.target.value) : setAt(e.target.value)
                  }
                  placeholder="2030-01-01T00:00:00Z"
                  className="font-mono text-xs"
                  autoComplete="off"
                />
                <p className="text-[11px] text-muted-foreground">{s.temporal_hint}</p>
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                {scope === 'graph' && graphEnabled && id ? (
                  <>
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link
                        to={graphPath(id, { at: at.trim() || undefined })}
                        data-testid="workspace-search-open-graph"
                      >
                        {s.open_graph_link}
                      </Link>
                    </Button>
                    {at.trim() ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          to={graphPath(id, { at: at.trim(), timeline: true })}
                          data-testid="workspace-search-open-graph-timeline"
                        >
                          {s.open_graph_timeline_link}
                        </Link>
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link to={workspaceGraphDiffPath(id)} data-testid="workspace-search-open-graph-diff">
                        {s.open_graph_diff_link}
                      </Link>
                    </Button>
                  </>
                ) : null}
                {scope === 'chunks' && graphEnabled && id ? (
                  <>
                    {asOf.trim() ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link
                          to={graphPath(id, { at: asOf.trim(), timeline: true })}
                          data-testid="workspace-search-chunks-open-timeline"
                        >
                          {s.open_graph_timeline_link}
                        </Link>
                      </Button>
                    ) : null}
                    <Button type="button" variant="outline" size="sm" asChild>
                      <Link
                        to={
                          asOf.trim() && temporalBounds?.min
                            ? workspaceGraphDiffPath(id, temporalBounds.min, asOf.trim())
                            : workspaceGraphDiffPath(id)
                        }
                        data-testid="workspace-search-chunks-open-graph-diff"
                      >
                        {s.open_graph_diff_link}
                      </Link>
                    </Button>
                  </>
                ) : null}
                {(scope === 'chunks' ? asOf : at).trim() ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (scope === 'chunks') setAsOf('');
                      else setAt('');
                      syncSearchUrl({
                        q: query.trim(),
                        scope,
                        asOf: scope === 'chunks' ? '' : asOf,
                        at: scope === 'graph' ? '' : at,
                      });
                    }}
                  >
                    {s.clear_temporal}
                  </Button>
                ) : null}
              </div>
            </div>
          ) : null}
        </form>

        {error ? (
          <div className="mt-2 px-1">
            <p className="text-sm text-destructive">{error}</p>
          </div>
        ) : null}

        <div className="mt-6 min-w-0 w-full">
          {!loading && hasSearched ? (
            <p className="mb-3 text-xs text-muted-foreground tabular-nums">{countLabel}</p>
          ) : null}
          {!hasSearched && !query.trim() && scope !== 'entities' ? (
            <EmptyState title={s.landing_title} description={s.landing_body} />
          ) : !id ? (
            <EmptyState title={s.no_results} />
          ) : scope === 'chunks' ? (
            <SearchChunkList workspaceId={id} hits={chunkResults} copy={s} emptyCell={emptyCell} />
          ) : scope === 'graph' ? (
            <SearchGraphList
              workspaceId={id}
              hits={graphResults}
              labels={graphLabels}
              copy={s}
              locale={locale as Locale}
              graphAt={at}
            />
          ) : (
            <SearchEntityList workspaceId={id} hits={entityResults} copy={s} />
          )}
        </div>
      </DataPanel>
    </ConsolePageLayout>
  );
}
