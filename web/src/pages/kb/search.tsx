import { type FormEvent, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  DataPanel,
  DataPanelBody,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/console-ui/index.js';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { KbExplorerUnavailable } from '@/components/kb/shell/kb-explorer-unavailable.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleFixedDecimals, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useExplorerClient } from '@/lib/explorer-context.js';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import {
  LedgerEntityList,
  type LedgerEntityHit,
} from '@/components/ledger-entity-browser.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbGraphPath } from '@/lib/graphUrlState.js';
import { graphNodeTypeLabel } from '@/explorer/workspaces/GraphWorkspace/graphWorkspaceCopy.js';
import {
  kbSearchPath,
  parseKbSearchTab,
  type KbSearchTab,
} from '@/lib/searchUrlState.js';

type GraphSearchHit = {
  node: { id: string; type: string; content: string };
  score: number;
};

type ChunkHit = {
  chunk_id: string;
  document_id: string;
  document_title: string;
  snippet: string;
  ordinal: number;
};

export function KbSearchPage() {
  const { t, locale } = useI18n();
  const emptyCell = t.common.emptyCell;
  const s = t.kbSearch;
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const { getKb } = useKbCatalog();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const kb = id ? getKb(id) : undefined;
  const client = useExplorerClient();
  const [tab, setTab] = useState<KbSearchTab>(
    () => parseKbSearchTab(searchParams.get('tab')) ?? 'chunks',
  );
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const ranUrlQueryKey = useRef<string | null>(null);
  const [graphResults, setGraphResults] = useState<GraphSearchHit[]>([]);
  const [chunkResults, setChunkResults] = useState<ChunkHit[]>([]);
  const [entityResults, setEntityResults] = useState<LedgerEntityHit[]>([]);
  const [chunkMode, setChunkMode] = useState<string | null>(null);
  const [engine, setEngine] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterDoc, setFilterDoc] = useState(() => searchParams.get('doc') ?? '');
  const [filterEntity, setFilterEntity] = useState(() => searchParams.get('entity') ?? '');
  const [filterCreatedAfter, setFilterCreatedAfter] = useState(
    () => searchParams.get('created_after') ?? '',
  );
  const [filterCreatedBefore, setFilterCreatedBefore] = useState(
    () => searchParams.get('created_before') ?? '',
  );
  const [filterAsOf, setFilterAsOf] = useState(() => searchParams.get('as_of') ?? '');

  const graphBlocked = id && !capsLoading && caps && !caps.graph;
  const graphLabelIds = graphResults.map((hit) => hit.node.id);
  const graphLabels = useKbNodeLabels(id, graphLabelIds);

  useEffect(() => {
    if (tab !== 'entities' || !id || entityResults.length > 0) return;
    let cancelled = false;
    void api<{ entities: LedgerEntityHit[] }>(`/api/kbs/${id}/ledger/entities?limit=30`)
      .then((data) => {
        if (!cancelled) setEntityResults(data.entities ?? []);
      })
      .catch(() => {
        if (!cancelled) setEntityResults([]);
      });
    return () => {
      cancelled = true;
    };
  }, [tab, id, entityResults.length]);

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (q) setQuery(q);
  }, [searchParams]);

  const syncSearchUrl = useCallback(
    (q: string, activeTab: KbSearchTab) => {
      if (!id) return;
      const href = kbSearchPath(id, {
        tab: activeTab,
        q,
        doc: filterDoc.trim() || undefined,
        entity: filterEntity.trim() || undefined,
        created_after: filterCreatedAfter.trim() || undefined,
        created_before: filterCreatedBefore.trim() || undefined,
        as_of: filterAsOf.trim() || undefined,
      });
      const next = href.split('?')[1] ?? '';
      setSearchParams(new URLSearchParams(next), { replace: true });
    },
    [
      id,
      filterDoc,
      filterEntity,
      filterCreatedAfter,
      filterCreatedBefore,
      filterAsOf,
      setSearchParams,
    ],
  );

  const runSearch = useCallback(
    async (activeTab: KbSearchTab, q: string, syncUrl: boolean) => {
      if (!q || !id) return;
      if (syncUrl) syncSearchUrl(q, activeTab);
      setLoading(true);
      setError(null);
      try {
        if (activeTab === 'graph') {
          const asOf = filterAsOf.trim();
          const data = await client.graph.search({
            query: q,
            limit: 30,
            ...(asOf ? { at: asOf } : {}),
          });
          setGraphResults(data.results as GraphSearchHit[]);
          setEngine(
            data.temporal_filter
              ? 'temporal'
              : ((data as { engine?: string }).engine ?? null),
          );
          setChunkResults([]);
          setChunkMode(null);
          setEntityResults([]);
        } else if (activeTab === 'entities') {
          const data = await api<{ entities: LedgerEntityHit[] }>(
            `/api/kbs/${id}/ledger/entities?query=${encodeURIComponent(q)}&limit=30`,
          );
          setEntityResults(data.entities ?? []);
          setGraphResults([]);
          setChunkResults([]);
          setChunkMode(null);
          setEngine(null);
        } else {
          const params = new URLSearchParams({ q, limit: '30' });
          const docFilter = filterDoc.trim();
          const entityFilter = filterEntity.trim();
          if (docFilter) params.set('document_id', docFilter);
          if (entityFilter) params.set('entity_id', entityFilter);
          const after = filterCreatedAfter.trim();
          const before = filterCreatedBefore.trim();
          if (after) params.set('created_after', after);
          const asOf = filterAsOf.trim();
          if (asOf) params.set('as_of', asOf);
          else if (before) params.set('created_before', before);
          const data = await api<{ chunks: ChunkHit[]; mode?: string }>(
            `/api/kbs/${id}/search?${params}`,
          );
          setChunkResults(data.chunks ?? []);
          setChunkMode(data.mode ?? null);
          setGraphResults([]);
          setEntityResults([]);
          setEngine(null);
        }
      } catch (err) {
        setError(formatUserFacingApiError(err, locale as Locale));
        setGraphResults([]);
        setChunkResults([]);
        setEntityResults([]);
      } finally {
        setLoading(false);
      }
    },
    [
      id,
      client,
      filterAsOf,
      filterDoc,
      filterEntity,
      filterCreatedAfter,
      filterCreatedBefore,
      locale,
      syncSearchUrl,
    ],
  );

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (!q || !id) return;
    const urlTab = parseKbSearchTab(searchParams.get('tab')) ?? 'chunks';
    const key = `${urlTab}:${q}:${searchParams.toString()}`;
    if (ranUrlQueryKey.current === key) return;
    if (urlTab === 'graph' && capsLoading) return;
    if (urlTab === 'graph' && caps && !caps.graph) {
      ranUrlQueryKey.current = key;
      return;
    }
    ranUrlQueryKey.current = key;
    setQuery(q);
    setTab(urlTab);
    void runSearch(urlTab, q, false);
  }, [id, searchParams, capsLoading, caps, runSearch]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q || !id) return;
    await runSearch(tab, q, true);
  }

  const name = kb?.name ?? id ?? t.common.ellipsis;

  useEffect(() => {
    const doc = searchParams.get('doc');
    const entity = searchParams.get('entity');
    if (doc) setFilterDoc(doc);
    if (entity) {
      setFilterEntity(entity);
      setTab('chunks');
    }
    const createdAfter = searchParams.get('created_after');
    const createdBefore = searchParams.get('created_before');
    if (createdAfter) setFilterCreatedAfter(createdAfter);
    if (createdBefore) setFilterCreatedBefore(createdBefore);
    const asOf = searchParams.get('as_of');
    if (asOf) setFilterAsOf(asOf);
    const urlTab = parseKbSearchTab(searchParams.get('tab'));
    if (urlTab) setTab(urlTab);
  }, [searchParams]);

  if (tab === 'graph' && graphBlocked) {
    return <KbExplorerUnavailable kbId={id!} feature="graph" />;
  }

  const resultCount =
    tab === 'chunks'
      ? chunkResults.length
      : tab === 'entities'
        ? entityResults.length
        : graphResults.length;
  const countLabel = fmt(
    pickCountForm(locale, resultCount, s.resultCountOne, s.resultCount),
    { count: formatLocaleNumber(locale, resultCount) },
  );

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: id ? kbPath(id, 'graph') : '/kbs' },
        { label: t.menu.kb.search },
      ]}
      subtitle={
        <>
          {t.pages.kbSubtitles.search}
          {id ? (
            <>
              {' '}
              <Link to={kbPath(id, 'graph')} className="text-primary underline-offset-2 hover:underline">
                {s.openGraphLink}
              </Link>
            </>
          ) : null}
        </>
      }
    >
      <DataPanel>
        <form onSubmit={onSubmit}>
          <DataPanelToolbar
            search={
              <ToolbarSearch
                className="w-full min-w-[12rem] max-w-md sm:w-72"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={
                  tab === 'chunks'
                    ? s.chunkPlaceholder
                    : tab === 'entities'
                      ? s.entityPlaceholder
                      : s.graphPlaceholder
                }
              />
            }
            actions={
              <>
                <div className="flex flex-wrap gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant={tab === 'chunks' ? 'default' : 'outline'}
                    onClick={() => setTab('chunks')}
                  >
                    {s.tabChunks}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tab === 'graph' ? 'default' : 'outline'}
                    onClick={() => setTab('graph')}
                    disabled={!!graphBlocked}
                  >
                    {s.tabGraph}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tab === 'entities' ? 'default' : 'outline'}
                    onClick={() => setTab('entities')}
                  >
                    {s.tabEntities}
                  </Button>
                </div>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <Spinner className="size-4" /> : null}
                  {loading ? s.searching : s.search}
                </Button>
              </>
            }
          />
          {tab === 'graph' && id && !graphBlocked ? (
            <div className="mt-2 space-y-2 px-1">
              <p className="text-xs text-muted-foreground">
                {s.graphTemporalHint}{' '}
                <Link to={kbPath(id, 'graph')} className="text-primary underline-offset-2 hover:underline">
                  {s.openInGraph}
                </Link>
              </p>
              <Input
                value={filterAsOf}
                onChange={(e) => setFilterAsOf(e.target.value)}
                placeholder={s.filterAsOf}
                className="text-xs"
              />
            </div>
          ) : null}
          {tab === 'chunks' ? (
            <div className="mt-2 grid gap-2 px-1 sm:grid-cols-2">
              <Input
                value={filterDoc}
                onChange={(e) => setFilterDoc(e.target.value)}
                placeholder={s.filterDoc}
                className="text-xs"
              />
              <Input
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                placeholder={s.filterEntity}
                className="text-xs"
              />
              <Input
                value={filterCreatedAfter}
                onChange={(e) => setFilterCreatedAfter(e.target.value)}
                placeholder={s.filterCreatedAfter}
                className="text-xs sm:col-span-1"
              />
              <Input
                value={filterCreatedBefore}
                onChange={(e) => setFilterCreatedBefore(e.target.value)}
                placeholder={s.filterCreatedBefore}
                className="text-xs sm:col-span-1"
                disabled={Boolean(filterAsOf.trim())}
              />
              <Input
                value={filterAsOf}
                onChange={(e) => setFilterAsOf(e.target.value)}
                placeholder={s.filterAsOf}
                className="text-xs sm:col-span-2"
              />
            </div>
          ) : null}
        </form>
        {(engine || chunkMode || error) && (
          <div className="space-y-1 px-1 text-xs">
            {engine ? (
              <p className="text-muted-foreground">
                {s.engineLabel}：{engine}
              </p>
            ) : null}
            {chunkMode ? (
              <p className="text-muted-foreground">
                {s.modeLabel}：{chunkMode}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DataPanelBody padded={false} className="mt-2">
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            {s.resultsTitle}
            {loading ? null : ` · ${countLabel}`}
          </div>
          <div className="space-y-3 p-4">
          {tab === 'chunks' ? (
            chunkResults.length === 0 ? (
              <EmptyState title={s.noResults} description={s.chunkPlaceholder} />
            ) : (
              chunkResults.map((hit) => (
                <div key={hit.chunk_id} className="rounded-md border p-3 text-sm">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">{hit.document_title || hit.document_id}</div>
                      <div className="text-xs text-muted-foreground">
                        chunk #{hit.ordinal} · {hit.chunk_id}
                      </div>
                    </div>
                    {id ? (
                      <Button variant="outline" size="sm" className="h-7 shrink-0 text-xs" asChild>
                        <Link
                          to={`${kbPath(id, 'sources')}?chunk=${encodeURIComponent(hit.chunk_id)}`}
                        >
                          {s.evidence}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-3">{hit.snippet || emptyCell}</div>
                </div>
              ))
            )
          ) : tab === 'entities' ? (
            id ? (
              entityResults.length === 0 ? (
                <EmptyState title={s.noResults} description={s.entityPlaceholder} />
              ) : (
                <LedgerEntityList kbId={id} entities={entityResults} emptyLabel={s.noResults} />
              )
            ) : (
              <EmptyState title={s.noResults} />
            )
          ) : graphResults.length === 0 ? (
            <EmptyState title={s.noResults} description={s.graphPlaceholder} />
          ) : (
            graphResults.map((hit) => (
              <div key={hit.node.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <EntityRefLine id={hit.node.id} labels={graphLabels} className="min-w-0" />
                  {id ? (
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" asChild>
                      <Link
                        to={kbGraphPath(id, {
                          focus: hit.node.id,
                          at: filterAsOf.trim() || undefined,
                        })}
                      >
                        {s.openInGraph}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="text-muted-foreground">
                  {fmt(s.graphScoreLine, {
                    type: graphNodeTypeLabel(locale as Locale, hit.node.type),
                    score: formatLocaleFixedDecimals(locale, hit.score, 3),
                  })}
                </div>
                {hit.node.content && hit.node.content !== graphLabels[hit.node.id] ? (
                  <div className="mt-1 line-clamp-2 text-muted-foreground">{hit.node.content}</div>
                ) : null}
              </div>
            ))
          )}
          </div>
        </DataPanelBody>
      </DataPanel>
    </ConsolePageLayout>
  );
}
