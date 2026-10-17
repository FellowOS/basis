import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import {
  DataPanel,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { KbExplorerUnavailable } from '@/components/app/kb/explorer-shell/kb-explorer-unavailable.js';
import {
  KbSearchChunkList,
  KbSearchEntityList,
  KbSearchGraphList,
  type ChunkHit,
  type GraphSearchHit,
} from '@/components/app/kb/search/kb-search-results.js';
import { Button } from '@/components/ui/button.js';
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
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useExplorerClient } from '@/lib/explorer-context.js';
import type { LedgerEntityHit } from '@/components/app/kb/ledger/ledger-entity-browser.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import {
  kbSearchPath,
  parseKbSearchUrlState,
  resolveKbSearchScope,
  type KbSearchScope,
} from '@/lib/searchUrlState.js';

const PREVIEW_LIMIT = 8;
const SEARCH_LIMIT = 30;

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

  const urlState = useMemo(
    () => parseKbSearchUrlState(searchParams.toString()),
    [searchParams],
  );

  const [scope, setScope] = useState<KbSearchScope>(() =>
    resolveKbSearchScope(searchParams.get('scope'), searchParams.get('tab')),
  );
  const [query, setQuery] = useState(() => searchParams.get('q') ?? '');

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
  const graphLabels = useKbNodeLabels(id, graphLabelIds);

  const syncSearchUrl = useCallback(
    (opts: { q: string; scope: KbSearchScope }) => {
      if (!id) return;
      const href = kbSearchPath(id, { scope: opts.scope, q: opts.q });
      const next = href.split('?')[1] ?? '';
      setSearchParams(new URLSearchParams(next), { replace: true });
    },
    [id, setSearchParams],
  );

  const fetchChunks = useCallback(
    async (q: string, limit: number) => {
      if (!id) return [] as ChunkHit[];
      const params = new URLSearchParams({ q, limit: String(limit) });
      const data = await api<{ chunks: ChunkHit[] }>(`/api/kbs/${id}/search?${params}`);
      return data.chunks ?? [];
    },
    [id],
  );

  const fetchGraph = useCallback(
    async (q: string, limit: number) => {
      const data = await client.graph.search({ query: q, limit });
      return data.results as GraphSearchHit[];
    },
    [client],
  );

  const fetchEntities = useCallback(
    async (q: string, limit: number) => {
      if (!id) return [] as LedgerEntityHit[];
      const path = q
        ? `/api/kbs/${id}/ledger/entities?query=${encodeURIComponent(q)}&limit=${limit}`
        : `/api/kbs/${id}/ledger/entities?limit=${limit}`;
      const data = await api<{ entities: LedgerEntityHit[] }>(path);
      return data.entities ?? [];
    },
    [id],
  );

  const runSearch = useCallback(
    async (activeScope: KbSearchScope, q: string) => {
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
          const chunks = await fetchChunks(trimmed, limit);
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
          const graph = await fetchGraph(trimmed, limit);
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
    const parsed = parseKbSearchUrlState(searchParams.toString());
    setScope(parsed.scope);
    const q = searchParams.get('q');
    if (q != null) setQuery(q);
  }, [searchParams]);

  useEffect(() => {
    const q = searchParams.get('q')?.trim();
    if (!q || !id) return;
    const key = [urlState.scope, q].join('|');
    if (ranUrlQueryKey.current === key) return;
    if (urlState.scope === 'graph' && capsLoading) return;
    if (urlState.scope === 'graph' && caps && !caps.graph) {
      ranUrlQueryKey.current = key;
      return;
    }
    ranUrlQueryKey.current = key;
    setQuery(q);
    setScope(urlState.scope);
    void runSearch(urlState.scope, q);
  }, [id, searchParams, urlState.scope, capsLoading, caps, runSearch]);

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

  function placeholderForScope(activeScope: KbSearchScope): string {
    if (activeScope === 'chunks') return s.chunkPlaceholder;
    if (activeScope === 'graph') return s.graphPlaceholder;
    return s.entityPlaceholder;
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    const q = query.trim();
    if (!id) return;
    if (scope !== 'entities' && !q) return;
    syncSearchUrl({ q, scope });
    void runSearch(scope, q);
  }

  function changeScope(next: KbSearchScope) {
    setScope(next);
    syncSearchUrl({ q: query.trim(), scope: next });
    const q = query.trim();
    if (q || next === 'entities') {
      void runSearch(next, q);
    } else {
      setChunkResults([]);
      setGraphResults([]);
      setEntityResults([]);
      setHasSearched(false);
      setError(null);
    }
  }

  const name = kb?.name ?? id ?? t.common.ellipsis;

  if (graphScopeBlocked && id) {
    return <KbExplorerUnavailable kbId={id} feature="graph" />;
  }

  const resultCount =
    scope === 'chunks'
      ? chunkResults.length
      : scope === 'graph'
        ? graphResults.length
        : entityResults.length;
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
          {t.pages.kbSubtitles.search}{' '}
          {id ? (
            <Link
              to={kbPath(id, 'settings') + '?tab=search'}
              className="text-primary underline-offset-2 hover:underline"
            >
              {s.searchSettingsLink}
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
                  <Label htmlFor="kb-search-scope" className="sr-only">
                    {s.scopeLabel}
                  </Label>
                  <Select
                    value={scope}
                    onValueChange={(v) => changeScope(v as KbSearchScope)}
                  >
                    <SelectTrigger id="kb-search-scope" className="h-9 w-[9.5rem]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="chunks">{s.scopeDocuments}</SelectItem>
                      <SelectItem value="graph" disabled={!graphEnabled}>
                        {s.scopeGraph}
                      </SelectItem>
                      <SelectItem value="entities">{s.scopeEntities}</SelectItem>
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
            <EmptyState title={s.landingTitle} description={s.landingBody} />
          ) : !id ? (
            <EmptyState title={s.noResults} />
          ) : scope === 'chunks' ? (
            <KbSearchChunkList kbId={id} hits={chunkResults} copy={s} emptyCell={emptyCell} />
          ) : scope === 'graph' ? (
            <KbSearchGraphList
              kbId={id}
              hits={graphResults}
              labels={graphLabels}
              copy={s}
              locale={locale as Locale}
            />
          ) : (
            <KbSearchEntityList kbId={id} hits={entityResults} copy={s} />
          )}
        </div>
      </DataPanel>
    </ConsolePageLayout>
  );
}
