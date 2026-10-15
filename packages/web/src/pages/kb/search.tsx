import { type FormEvent, useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  DataPanel,
  DataPanelBody,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/console-ui/index.js';
import { KbPageSubtitle } from '@/components/kb-page-subtitle.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { KbExplorerUnavailable } from '@/components/kb-explorer-unavailable.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
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

type SearchTab = 'chunks' | 'graph' | 'entities';

export function KbSearchPage() {
  const { t, locale } = useI18n();
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const { getKb } = useKbCatalog();
  const { caps, loading: capsLoading } = useKbCapabilities();
  const kb = id ? getKb(id) : undefined;
  const client = useExplorerClient();
  const [tab, setTab] = useState<SearchTab>('chunks');
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');
  const ranUrlQuery = useRef(false);
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

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (!q || !id || ranUrlQuery.current) return;
    ranUrlQuery.current = true;
    setQuery(q);
    setTab('chunks');
    void (async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ q, limit: '30' });
        const data = await api<{ chunks: ChunkHit[]; mode?: string }>(
          `/api/kbs/${id}/search?${params}`,
        );
        setChunkResults(data.chunks ?? []);
        setChunkMode(data.mode ?? null);
        setGraphResults([]);
        setEntityResults([]);
        setEngine(null);
      } catch (err) {
        setError(formatUserFacingApiError(err, locale === 'zh' ? 'zh' : 'en'));
        setChunkResults([]);
      } finally {
        setLoading(false);
      }
    })();
  }, [id, locale, searchParams]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!q || !id) return;
    setLoading(true);
    setError(null);
    try {
      if (tab === 'graph') {
        const data = await client.graph.search({ query: q, limit: 30 });
        setGraphResults(data.results as GraphSearchHit[]);
        setEngine((data as { engine?: string }).engine ?? null);
        setChunkResults([]);
        setChunkMode(null);
        setEntityResults([]);
      } else if (tab === 'entities') {
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
      setError(formatUserFacingApiError(err, locale === 'zh' ? 'zh' : 'en'));
      setGraphResults([]);
      setChunkResults([]);
      setEntityResults([]);
    } finally {
      setLoading(false);
    }
  }

  const name = kb?.name ?? id ?? '…';
  const searching = locale === 'zh' ? '搜索中…' : 'Searching…';
  const searchLabel = locale === 'zh' ? '搜索' : 'Search';
  const chunkPlaceholder =
    locale === 'zh' ? '文档片段关键词…' : 'Keywords in document chunks…';
  const graphPlaceholder =
    locale === 'zh' ? '节点 id、类型或文本…' : 'Node id, type, or text…';
  const tabChunks = locale === 'zh' ? '文档片段' : 'Chunks';
  const tabGraph = locale === 'zh' ? '图谱节点' : 'Graph';
  const tabEntities = locale === 'zh' ? '账本实体' : 'Entities';
  const entityPlaceholder = locale === 'zh' ? '实体名称或描述…' : 'Entity label or description…';
  const resultsTitle = locale === 'zh' ? '结果' : 'Results';
  const noResults = locale === 'zh' ? '无结果' : 'No results';
  const engineLabel = locale === 'zh' ? '引擎' : 'Engine';
  const modeLabel = locale === 'zh' ? '模式' : 'Mode';
  const openInGraph = locale === 'zh' ? '在图谱中打开' : 'Open in graph';
  const filterDocLabel = locale === 'zh' ? '限定文档 (doc_id)' : 'Limit to document (doc_id)';
  const filterEntityLabel = locale === 'zh' ? '限定实体 (id)' : 'Limit to entity (id)';
  const filterAfterLabel =
    locale === 'zh' ? '文档入库不早于 (ISO)' : 'Document created after (ISO)';
  const filterBeforeLabel =
    locale === 'zh' ? '文档入库不晚于 (ISO)' : 'Document created before (ISO)';
  const filterAsOfLabel =
    locale === 'zh' ? '截至时刻 as_of (ISO，等同 created_before)' : 'As-of instant (ISO, alias for created_before)';

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
  const countLabel =
    locale === 'zh' ? `共 ${resultCount} 条结果` : `${resultCount} result${resultCount === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: name, to: id ? kbPath(id, 'graph') : '/kbs' },
          { label: t.menu.kb.search },
        ]}
      />
      <KbPageSubtitle>
        {t.pages.kbSubtitles.search}
        {id ? (
          <>
            {' '}
            <Link to={kbPath(id, 'graph')} className="text-primary underline-offset-2 hover:underline">
              {locale === 'zh' ? '打开图谱' : 'Open graph'}
            </Link>
          </>
        ) : null}
      </KbPageSubtitle>
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
                    ? chunkPlaceholder
                    : tab === 'entities'
                      ? entityPlaceholder
                      : graphPlaceholder
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
                    {tabChunks}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tab === 'graph' ? 'default' : 'outline'}
                    onClick={() => setTab('graph')}
                    disabled={!!graphBlocked}
                  >
                    {tabGraph}
                  </Button>
                  <Button
                    type="button"
                    size="sm"
                    variant={tab === 'entities' ? 'default' : 'outline'}
                    onClick={() => setTab('entities')}
                  >
                    {tabEntities}
                  </Button>
                </div>
                <Button type="submit" size="sm" disabled={loading}>
                  {loading ? <Spinner className="size-4" /> : null}
                  {loading ? searching : searchLabel}
                </Button>
              </>
            }
          />
          {tab === 'chunks' ? (
            <div className="mt-2 grid gap-2 px-1 sm:grid-cols-2">
              <Input
                value={filterDoc}
                onChange={(e) => setFilterDoc(e.target.value)}
                placeholder={filterDocLabel}
                className="text-xs"
              />
              <Input
                value={filterEntity}
                onChange={(e) => setFilterEntity(e.target.value)}
                placeholder={filterEntityLabel}
                className="text-xs"
              />
              <Input
                value={filterCreatedAfter}
                onChange={(e) => setFilterCreatedAfter(e.target.value)}
                placeholder={filterAfterLabel}
                className="text-xs sm:col-span-1"
              />
              <Input
                value={filterCreatedBefore}
                onChange={(e) => setFilterCreatedBefore(e.target.value)}
                placeholder={filterBeforeLabel}
                className="text-xs sm:col-span-1"
                disabled={Boolean(filterAsOf.trim())}
              />
              <Input
                value={filterAsOf}
                onChange={(e) => setFilterAsOf(e.target.value)}
                placeholder={filterAsOfLabel}
                className="text-xs sm:col-span-2"
              />
            </div>
          ) : null}
        </form>
        {(engine || chunkMode || error) && (
          <div className="space-y-1 px-1 text-xs">
            {engine ? (
              <p className="text-muted-foreground">
                {engineLabel}：{engine}
              </p>
            ) : null}
            {chunkMode ? (
              <p className="text-muted-foreground">
                {modeLabel}：{chunkMode}
              </p>
            ) : null}
            {error ? <p className="text-sm text-destructive">{error}</p> : null}
          </div>
        )}
        <DataPanelBody padded={false} className="mt-2">
          <div className="border-b border-border px-4 py-2 text-xs text-muted-foreground">
            {resultsTitle}
            {loading ? null : ` · ${countLabel}`}
          </div>
          <div className="space-y-3 p-4">
          {tab === 'chunks' ? (
            chunkResults.length === 0 ? (
              <EmptyState title={noResults} description={chunkPlaceholder} />
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
                          {locale === 'zh' ? '证据' : 'Evidence'}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                  <div className="mt-1 line-clamp-3">{hit.snippet || '—'}</div>
                </div>
              ))
            )
          ) : tab === 'entities' ? (
            id ? (
              entityResults.length === 0 ? (
                <EmptyState title={noResults} description={entityPlaceholder} />
              ) : (
                <LedgerEntityList kbId={id} entities={entityResults} emptyLabel={noResults} />
              )
            ) : (
              <EmptyState title={noResults} />
            )
          ) : graphResults.length === 0 ? (
            <EmptyState title={noResults} description={graphPlaceholder} />
          ) : (
            graphResults.map((hit) => (
              <div key={hit.node.id} className="rounded-md border p-3 text-sm">
                <div className="flex items-start justify-between gap-2">
                  <EntityRefLine id={hit.node.id} labels={graphLabels} className="min-w-0" />
                  {id ? (
                    <Button variant="ghost" size="sm" className="h-7 shrink-0 text-xs" asChild>
                      <Link to={`${kbPath(id, 'graph')}?focus=${encodeURIComponent(hit.node.id)}`}>
                        {openInGraph}
                      </Link>
                    </Button>
                  ) : null}
                </div>
                <div className="text-muted-foreground">
                  {hit.node.type} · score {hit.score.toFixed(3)}
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
    </div>
  );
}
