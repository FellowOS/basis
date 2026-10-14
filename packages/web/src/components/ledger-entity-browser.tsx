import { type FormEvent, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/console-ui/index.js';
import { EntityRefLine } from '@/components/entity-ref-line.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { api } from '@/lib/api.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';

export type LedgerEntityHit = {
  id?: string;
  entity_id: string;
  canonical_label: string | null;
  description: string | null;
  entity_kind: string;
};

type EntityFactHit = {
  statement_id: string;
  surface_phrase: string;
  object_entity_id: string | null;
  object_value: string | null;
  status: string;
  evidence_chunk_id?: string | null;
  evidence_quote?: string | null;
};

export function ledgerEntityId(hit: LedgerEntityHit): string {
  return hit.id ?? hit.entity_id;
}

export function LedgerEntityList({
  kbId,
  entities,
  emptyLabel,
}: {
  kbId: string;
  entities: LedgerEntityHit[];
  emptyLabel: string;
}) {
  const { locale } = useI18n();
  const [factsEntityId, setFactsEntityId] = useState<string | null>(null);
  const [entityFacts, setEntityFacts] = useState<EntityFactHit[]>([]);
  const [factsLoading, setFactsLoading] = useState(false);

  const factLabelIds = entityFacts.flatMap((fact) =>
    fact.object_entity_id ? [fact.object_entity_id] : [],
  );
  const factLabels = useKbNodeLabels(kbId, factsEntityId ? [factsEntityId, ...factLabelIds] : []);

  const showStatements = locale === 'zh' ? '陈述' : 'Statements';
  const hideStatements = locale === 'zh' ? '收起' : 'Hide';
  const openInGraph = locale === 'zh' ? '在图谱中打开' : 'Open in graph';
  const openEvidence = locale === 'zh' ? '证据' : 'Evidence';

  async function toggleEntityFacts(entityId: string) {
    if (factsEntityId === entityId) {
      setFactsEntityId(null);
      setEntityFacts([]);
      return;
    }
    setFactsLoading(true);
    setFactsEntityId(entityId);
    try {
      const data = await api<{ facts: EntityFactHit[] }>(
        `/api/kbs/${kbId}/ledger/entities/${encodeURIComponent(entityId)}/facts`,
      );
      setEntityFacts(data.facts ?? []);
    } catch {
      setEntityFacts([]);
    } finally {
      setFactsLoading(false);
    }
  }

  if (entities.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyLabel}</p>;
  }

  return (
    <div className="space-y-3">
      {entities.map((hit) => {
        const entityId = ledgerEntityId(hit);
        const labels: Record<string, string | null> = {
          [entityId]: hit.canonical_label,
        };
        const factsOpen = factsEntityId === entityId;
        return (
          <div key={entityId} className="rounded-md border p-3 text-sm">
            <div className="flex items-start justify-between gap-2">
              <EntityRefLine id={entityId} labels={labels} />
              <div className="flex shrink-0 flex-col gap-1">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs"
                  disabled={factsLoading && factsEntityId === entityId}
                  onClick={() => void toggleEntityFacts(entityId)}
                >
                  {factsOpen ? hideStatements : showStatements}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(entityId)}`}>
                    {openInGraph}
                  </Link>
                </Button>
              </div>
            </div>
            {hit.description ? (
              <p className="mt-2 line-clamp-2 text-muted-foreground">{hit.description}</p>
            ) : null}
            <div className="mt-1 text-xs text-muted-foreground">{hit.entity_kind}</div>
            {factsOpen ? (
              <ul className="mt-3 space-y-2 border-t border-border pt-3 text-xs">
                {factsLoading ? (
                  <li className="text-muted-foreground">{locale === 'zh' ? '加载中…' : 'Loading…'}</li>
                ) : entityFacts.length === 0 ? (
                  <li className="text-muted-foreground">
                    {locale === 'zh' ? '无开放陈述' : 'No open statements'}
                  </li>
                ) : (
                  entityFacts.map((fact) => (
                    <li key={fact.statement_id}>
                      <span className="font-medium">{fact.surface_phrase}</span>
                      {' → '}
                      {fact.object_entity_id ? (
                        <EntityRefLine
                          id={fact.object_entity_id}
                          labels={factLabels}
                          className="inline"
                        />
                      ) : (
                        <span className="text-muted-foreground">{fact.object_value}</span>
                      )}
                      <span className="ml-2 text-muted-foreground">({fact.status})</span>
                      {fact.evidence_quote ? (
                        <blockquote className="mt-1 border-l-2 pl-2 text-muted-foreground">
                          {fact.evidence_quote}
                        </blockquote>
                      ) : null}
                      {fact.evidence_chunk_id ? (
                        <div className="mt-1 flex flex-wrap gap-2">
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                            <Link
                              to={`${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(fact.evidence_chunk_id)}`}
                            >
                              {openEvidence}
                            </Link>
                          </Button>
                          <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                            <Link
                              to={`${kbPath(kbId, 'search')}?entity=${encodeURIComponent(entityId)}`}
                            >
                              {locale === 'zh' ? '搜相关片段' : 'Search chunks'}
                            </Link>
                          </Button>
                        </div>
                      ) : null}
                    </li>
                  ))
                )}
              </ul>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LedgerEntityBrowser({
  kbId,
  limit = 30,
  loadRecentOnMount = true,
}: {
  kbId: string;
  limit?: number;
  loadRecentOnMount?: boolean;
}) {
  const { locale } = useI18n();
  const [query, setQuery] = useState('');
  const [entities, setEntities] = useState<LedgerEntityHit[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const placeholder =
    locale === 'zh' ? '实体名称或描述（留空浏览最近）' : 'Entity label or description (empty = recent)';
  const searchLabel = locale === 'zh' ? '搜索' : 'Search';
  const searching = locale === 'zh' ? '加载中…' : 'Loading…';
  const noResults = locale === 'zh' ? '无实体' : 'No entities';
  const countLabel = locale === 'zh' ? `共 ${entities.length} 个实体` : `${entities.length} entities`;
  const searchFailed = locale === 'zh' ? '加载失败' : 'Failed to load';

  async function fetchEntities(q: string) {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({ limit: String(limit) });
      if (q.trim()) params.set('query', q.trim());
      const data = await api<{ entities: LedgerEntityHit[] }>(
        `/api/kbs/${kbId}/ledger/entities?${params}`,
      );
      setEntities(data.entities ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : searchFailed);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (!loadRecentOnMount) return;
    void fetchEntities('');
  }, [kbId, limit, loadRecentOnMount]);

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    await fetchEntities(query);
  }

  return (
    <DataPanel>
      <form onSubmit={(e) => void onSubmit(e)}>
        <DataPanelToolbar
          search={
            <ToolbarSearch
              className="w-full min-w-[12rem] max-w-md sm:w-72"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={placeholder}
            />
          }
          actions={
            <>
              <Button type="submit" size="sm" disabled={loading}>
                {loading ? <Spinner className="size-4" /> : null}
                {loading ? searching : searchLabel}
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={loading}
                onClick={() => void fetchEntities(query)}
              >
                {locale === 'zh' ? '刷新' : 'Refresh'}
              </Button>
            </>
          }
        />
      </form>
      <DataPanelBody padded={false} className="mt-2">
        {error ? (
          <p className="px-4 py-3 text-sm text-destructive">{error}</p>
        ) : null}
        {loading && entities.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : entities.length === 0 ? (
          <EmptyState
            title={noResults}
            description={
              locale === 'zh'
                ? '输入关键词搜索，或留空浏览最近创建的账本实体。'
                : 'Search by keyword, or leave empty to browse recent ledger entities.'
            }
          />
        ) : (
          <>
            <div className="space-y-3 p-4">
              <LedgerEntityList kbId={kbId} entities={entities} emptyLabel={noResults} />
            </div>
            <DataPanelTableFooter
              countLabel={countLabel}
              page={1}
              totalPages={1}
              onPageChange={() => {}}
            />
          </>
        )}
      </DataPanelBody>
    </DataPanel>
  );
}
