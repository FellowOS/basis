import { type FormEvent, useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { EntityRefLine } from '@/components/app/kb/ledger/entity-ref-line.js';
import { DerivedFactCard } from '@/components/app/kb/widgets/kb-derived-facts-panel.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { ledgerStatementStatusLabel } from '@/lib/kb-ledger-labels.js';
import { useKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbPath } from '@/lib/nav-config.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbOpenApiDELETE, kbOpenApiGET } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

const ENTITY_PAGE_SIZE = 10;

export type LedgerEntityHit = {
  id?: string;
  entity_id: string;
  canonical_label: string | null;
  description: string | null;
  entity_kind: string;
};

type EntityDeleteStatement = {
  statement_id: string;
  subject_id: string;
  subject_label: string | null;
  surface_phrase: string;
  object_entity_id: string | null;
  object_label: string | null;
  object_value: string | null;
  status: string;
  evidence_quote: string | null;
};

type EntityDeletePreview = {
  entity_id: string;
  canonical_label: string | null;
  statement_count: number;
  statements_truncated: boolean;
  statements: EntityDeleteStatement[];
  typed_fact_count: number;
  derived_fact_count: number;
  merge_count: number;
};

function statementDeleteLine(statement: EntityDeleteStatement): string {
  const subject = statement.subject_label || statement.subject_id;
  const object = statement.object_entity_id
    ? statement.object_label || statement.object_entity_id
    : statement.object_value || '';
  return `${subject} ${statement.surface_phrase} ${object}`.trim();
}

type EntityFactHit = {
  statement_id: string;
  surface_phrase: string;
  object_entity_id: string | null;
  object_value: string | null;
  status: string;
  evidence_chunk_id?: string | null;
  evidence_quote?: string | null;
};

type DerivedFactHit = {
  id: string;
  predicate_uri: string;
  subject_id: string;
  object_entity_id: string | null;
  object_value: string | null;
  recorded_at?: string | null;
  rule_id: string | null;
  derivations: Array<{ premise_kind: string; premise_id: string }>;
};

export function ledgerEntityId(hit: LedgerEntityHit): string {
  return hit.id ?? hit.entity_id;
}

function EntityFactsPanel({
  kbId,
  entityId,
  highlightStatementId,
}: {
  kbId: string;
  entityId: string;
  highlightStatementId?: string;
}) {
  const { t, locale } = useI18n();
  const l = t.kbLedger;
  const [entityFacts, setEntityFacts] = useState<EntityFactHit[]>([]);
  const [entityDerivedFacts, setEntityDerivedFacts] = useState<DerivedFactHit[]>([]);
  const [loading, setLoading] = useState(true);

  const factLabelIds = entityFacts.flatMap((fact) =>
    fact.object_entity_id ? [fact.object_entity_id] : [],
  );
  const factLabels = useKbNodeLabels(kbId, [entityId, ...factLabelIds]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const data = await kbOpenApiGET<{
          facts: EntityFactHit[];
          derived_facts?: DerivedFactHit[];
        }>(kbId, `ledger/entities/${encodeURIComponent(entityId)}/facts`);
        if (cancelled) return;
        setEntityFacts(data.facts ?? []);
        setEntityDerivedFacts(data.derived_facts ?? []);
      } catch {
        if (!cancelled) {
          setEntityFacts([]);
          setEntityDerivedFacts([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [kbId, entityId]);

  useEffect(() => {
    if (!highlightStatementId || loading) return;
    const el = document.getElementById(`ledger-statement-${highlightStatementId}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [highlightStatementId, loading, entityFacts]);

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Spinner className="size-5" />
      </div>
    );
  }

  if (entityFacts.length === 0 && entityDerivedFacts.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        {l.noStatementsOrDerived}
      </p>
    );
  }

  return (
    <div className="max-h-[min(60vh,28rem)] space-y-5 overflow-y-auto pr-1">
      {entityFacts.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {l.statementsSection}
            </h4>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatLocaleNumber(locale as Locale, entityFacts.length)}
            </span>
          </div>
          <ul className="space-y-2">
            {entityFacts.map((fact) => (
              <li
                key={fact.statement_id}
                id={`ledger-statement-${fact.statement_id}`}
                data-testid="ledger-statement-row"
                className={`rounded-lg border border-border/70 bg-bg-3/50 p-3${
                  highlightStatementId === fact.statement_id ? ' ring-2 ring-primary' : ''
                }`}
              >
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium">{fact.surface_phrase}</span>
                  <Badge variant="secondary">
                    {ledgerStatementStatusLabel(l, fact.status)}
                  </Badge>
                </div>
                <div className="mt-2 flex items-start gap-1.5 text-sm">
                  <PublicIcon name="arrow-right" size={14} className="mt-0.5 shrink-0 text-muted-foreground" />
                  {fact.object_entity_id ? (
                    <EntityRefLine id={fact.object_entity_id} labels={factLabels} className="min-w-0" />
                  ) : (
                    <span className="text-muted-foreground">{fact.object_value}</span>
                  )}
                </div>
                {fact.evidence_quote ? (
                  <blockquote className="mt-2 border-l-2 border-border pl-2 text-xs leading-relaxed text-muted-foreground">
                    {fact.evidence_quote}
                  </blockquote>
                ) : null}
                {fact.evidence_chunk_id ? (
                  <div className="mt-2 flex flex-wrap gap-3">
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                      <Link
                        to={`${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(fact.evidence_chunk_id)}`}
                      >
                        {l.openEvidence}
                      </Link>
                    </Button>
                    <Button variant="link" size="sm" className="h-auto p-0 text-xs" asChild>
                      <Link to={`${kbPath(kbId, 'search')}?entity=${encodeURIComponent(entityId)}`}>
                        {l.searchChunks}
                      </Link>
                    </Button>
                  </div>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
      {entityDerivedFacts.length > 0 ? (
        <section>
          <div className="mb-2 flex items-center justify-between">
            <h4 className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">
              {l.derivedSection}
            </h4>
            <span className="text-[11px] tabular-nums text-muted-foreground">
              {formatLocaleNumber(locale as Locale, entityDerivedFacts.length)}
            </span>
          </div>
          <ul className="space-y-2">
            {entityDerivedFacts.map((df) => (
              <DerivedFactCard key={df.id} kbId={kbId} fact={df} labels={factLabels} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
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
  const { t } = useI18n();
  const l = t.kbLedger;
  const { caps } = useKbCapabilities();
  const [factsEntityId, setFactsEntityId] = useState<string | null>(null);
  const showLineage = Boolean(caps?.provenance && caps?.graph);

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
                  onClick={() => setFactsEntityId(factsOpen ? null : entityId)}
                >
                  {factsOpen ? l.hideStatements : l.showStatements}
                </Button>
                <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                  <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(entityId)}`}>
                    {l.openInGraph}
                  </Link>
                </Button>
                {showLineage ? (
                  <Button variant="ghost" size="sm" className="h-7 text-xs" asChild>
                    <Link to={`${kbPath(kbId, 'lineage')}?node=${encodeURIComponent(entityId)}`}>
                      {l.openLineage}
                    </Link>
                  </Button>
                ) : null}
              </div>
            </div>
            {hit.description ? (
              <p className="mt-2 line-clamp-2 text-muted-foreground">{hit.description}</p>
            ) : null}
            <div className="mt-1 text-xs text-muted-foreground">{hit.entity_kind}</div>
            {factsOpen ? (
              <div className="mt-3 border-t border-border pt-3">
                <EntityFactsPanel kbId={kbId} entityId={entityId} />
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}

export function LedgerEntityBrowser({
  kbId,
  loadRecentOnMount = true,
  focusStatementId,
}: {
  kbId: string;
  limit?: number;
  loadRecentOnMount?: boolean;
  focusStatementId?: string;
}) {
  const { t, locale } = useI18n();
  const l = t.kbLedger;
  const emptyCell = t.common.emptyCell;
  const { caps } = useKbCapabilities();
  const apiError = useApiErrorMessage();
  const canDeleteEntity = ['owner', 'admin', 'editor'].includes(caps?.role ?? '');
  const [query, setQuery] = useState('');
  const [appliedQuery, setAppliedQuery] = useState('');
  const [entities, setEntities] = useState<LedgerEntityHit[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [factsTarget, setFactsTarget] = useState<LedgerEntityHit | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<LedgerEntityHit | null>(null);
  const [deletePreview, setDeletePreview] = useState<EntityDeletePreview | null>(null);
  const [highlightStatementId, setHighlightStatementId] = useState<string | undefined>(undefined);
  const [deletePreviewError, setDeletePreviewError] = useState<string | null>(null);
  const [deletePreviewLoading, setDeletePreviewLoading] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const showLineage = Boolean(caps?.provenance && caps?.graph);

  const totalPages = Math.max(1, Math.ceil(total / ENTITY_PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pageStart = total === 0 ? 0 : (safePage - 1) * ENTITY_PAGE_SIZE + 1;
  const pageEnd = Math.min(safePage * ENTITY_PAGE_SIZE, total);

  const loc = locale as Locale;
  const countLabel =
    total === 0
      ? l.entityCountEmpty
      : fmt(l.entityCount, {
          start: formatLocaleNumber(loc, pageStart),
          end: formatLocaleNumber(loc, pageEnd),
          total: formatLocaleNumber(loc, total),
        });

  const labelIds = entities.map((hit) => ledgerEntityId(hit));
  const nodeLabels = useKbNodeLabels(kbId, labelIds);

  const fetchEntities = useCallback(
    async (q: string, pageIndex: number) => {
      setLoading(true);
      setError(null);
      try {
        const offset = (pageIndex - 1) * ENTITY_PAGE_SIZE;
        const query: Record<string, unknown> = {
          limit: ENTITY_PAGE_SIZE,
          offset,
        };
        if (q.trim()) query.query = q.trim();
        const data = await kbOpenApiGET<{
          entities: LedgerEntityHit[];
          total: number;
        }>(kbId, 'ledger/entities', { params: { query } });
        setEntities(data.entities ?? []);
        setTotal(data.total ?? 0);
      } catch (err) {
        setError(apiError(err));
        setEntities([]);
        setTotal(0);
      } finally {
        setLoading(false);
      }
    },
    [apiError, kbId],
  );

  useEffect(() => {
    if (!loadRecentOnMount) return;
    void fetchEntities(appliedQuery, safePage);
  }, [appliedQuery, fetchEntities, loadRecentOnMount, safePage]);

  useEffect(() => {
    if (!deleteTarget) {
      setDeletePreview(null);
      setDeletePreviewError(null);
      return;
    }
    const entityId = ledgerEntityId(deleteTarget);
    let cancelled = false;
    setDeletePreview(null);
    setDeletePreviewError(null);
    setDeletePreviewLoading(true);
    void (async () => {
      try {
        const preview = await kbOpenApiGET<EntityDeletePreview>(
          kbId,
          `ledger/entities/${encodeURIComponent(entityId)}/delete-preview`,
        );
        if (!cancelled) setDeletePreview(preview);
      } catch (err) {
        if (!cancelled) setDeletePreviewError(apiError(err));
      } finally {
        if (!cancelled) setDeletePreviewLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [apiError, deleteTarget, kbId]);

  useEffect(() => {
    if (!focusStatementId) {
      setHighlightStatementId(undefined);
      return;
    }
    let cancelled = false;
    void kbOpenApiGET<{
      statement: {
        subject_id: string;
        surface_phrase: string;
        statement_id: string;
      };
    }>(kbId, `ledger/statements/${encodeURIComponent(focusStatementId)}`)
      .then((body) => {
        if (cancelled) return;
        const subjectId = body.statement.subject_id;
        setHighlightStatementId(body.statement.statement_id);
        setFactsTarget({
          entity_id: subjectId,
          id: subjectId,
          canonical_label: null,
          description: null,
          entity_kind: '',
        });
      })
      .catch(() => {
        if (!cancelled) setHighlightStatementId(undefined);
      });
    return () => {
      cancelled = true;
    };
  }, [focusStatementId, kbId]);

  async function confirmDeleteEntity() {
    if (!deleteTarget || deleting) return;
    const entityId = ledgerEntityId(deleteTarget);
    setDeleting(true);
    setError(null);
    try {
      await kbOpenApiDELETE(kbId, `ledger/entities/${encodeURIComponent(entityId)}`);
      if (factsTarget && ledgerEntityId(factsTarget) === entityId) setFactsTarget(null);
      setDeleteTarget(null);
      await fetchEntities(appliedQuery, safePage);
    } catch (err) {
      setDeletePreviewError(apiError(err));
    } finally {
      setDeleting(false);
    }
  }

  function onSubmit(event: FormEvent) {
    event.preventDefault();
    setAppliedQuery(query);
    setPage(1);
  }

  const columns = useMemo((): DataTableColumn<LedgerEntityHit>[] => {
    return [
      {
        key: 'entity',
        header: l.colEntity,
        render: (hit) => {
          const entityId = ledgerEntityId(hit);
          return (
            <EntityRefLine
              id={entityId}
              labels={{ [entityId]: hit.canonical_label, ...nodeLabels }}
            />
          );
        },
      },
      {
        key: 'kind',
        header: l.colKind,
        width: '6rem',
        hideBelow: 'sm',
        render: (hit) =>
          hit.entity_kind ? (
            <Badge variant="secondary" className="max-w-full truncate">
              {hit.entity_kind}
            </Badge>
          ) : (
            <span className="text-muted-foreground">{emptyCell}</span>
          ),
      },
      {
        key: 'description',
        header: l.colDescription,
        hideBelow: 'md',
        render: (hit) => (
          <span className="line-clamp-2 text-muted-foreground">{hit.description || emptyCell}</span>
        ),
      },
      {
        key: 'actions',
        header: l.colActions,
        align: 'right',
        width: '5rem',
        render: (hit) => {
          const entityId = ledgerEntityId(hit);
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  onClick={(event) => event.stopPropagation()}
                >
                  <PublicIcon name="dot-horizontal" size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={() => setFactsTarget(hit)}>
                  {l.viewFacts}
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <Link to={`${kbPath(kbId, 'graph')}?focus=${encodeURIComponent(entityId)}`}>
                    {l.openInGraph}
                  </Link>
                </DropdownMenuItem>
                {showLineage ? (
                  <DropdownMenuItem asChild>
                    <Link to={`${kbPath(kbId, 'lineage')}?node=${encodeURIComponent(entityId)}`}>
                      {l.openLineage}
                    </Link>
                  </DropdownMenuItem>
                ) : null}
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to={`${kbPath(kbId, 'search')}?entity=${encodeURIComponent(entityId)}`}>
                    {l.searchChunks}
                  </Link>
                </DropdownMenuItem>
                {canDeleteEntity ? (
                  <DropdownMenuItem
                    className="text-destructive focus:text-destructive"
                    onClick={() => setDeleteTarget(hit)}
                  >
                    {l.deleteEntity}
                  </DropdownMenuItem>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [canDeleteEntity, emptyCell, kbId, l, nodeLabels, showLineage]);

  return (
    <DataPanel>
      <form onSubmit={(e) => void onSubmit(e)}>
        <DataPanelToolbar
          search={
            <ToolbarSearch
              className="w-full min-w-[12rem] max-w-md sm:w-72"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={l.entityPlaceholder}
            />
          }
          actions={
            <Button type="submit" size="sm" disabled={loading}>
              {loading ? <Spinner className="size-4" /> : null}
              {loading ? l.searching : l.search}
            </Button>
          }
        />
      </form>
      <DataPanelBody padded={false} className="mt-2">
        {error ? <p className="px-4 py-3 text-sm text-destructive">{error}</p> : null}
        {loading && entities.length === 0 ? (
          <div className="flex justify-center py-16">
            <Spinner className="size-6" />
          </div>
        ) : entities.length === 0 ? (
          <EmptyState
            title={l.noEntities}
            description={l.emptyBrowseHint}
          />
        ) : (
          <>
            <DataTable
              columns={columns}
              data={entities}
              rowKey={(hit) => ledgerEntityId(hit)}
              onRowClick={setFactsTarget}
              className="border-0"
            />
            <DataPanelTableFooter
              countLabel={countLabel}
              page={safePage}
              totalPages={totalPages}
              onPageChange={setPage}
            />
          </>
        )}
      </DataPanelBody>

      <Dialog
        open={factsTarget !== null}
        onOpenChange={(open) => {
          if (!open) setFactsTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{l.entityFactsTitle}</DialogTitle>
            <DialogDescription>
              {factsTarget
                ? factsTarget.canonical_label || ledgerEntityId(factsTarget)
                : ''}
            </DialogDescription>
          </DialogHeader>
          {factsTarget ? (
            <EntityFactsPanel
              kbId={kbId}
              entityId={ledgerEntityId(factsTarget)}
              highlightStatementId={highlightStatementId}
            />
          ) : null}
        </DialogContent>
      </Dialog>

      <Dialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deleting) setDeleteTarget(null);
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{l.deleteEntityTitle}</DialogTitle>
            <DialogDescription>
              {fmt(l.deleteEntityDescription, {
                label: deleteTarget?.canonical_label || (deleteTarget ? ledgerEntityId(deleteTarget) : ''),
              })}
            </DialogDescription>
          </DialogHeader>
          {deletePreviewLoading ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Spinner className="size-4" />
              {l.deleteEntityLoading}
            </div>
          ) : null}
          {deletePreviewError ? (
            <p className="text-sm text-destructive">{deletePreviewError}</p>
          ) : null}
          {deletePreview && !deletePreviewLoading ? (
            <div className="space-y-3">
              {deletePreview.statements.length === 0 ? (
                <p className="text-sm text-muted-foreground">{l.deleteEntityNone}</p>
              ) : (
                <ul className="max-h-[min(50vh,18rem)] space-y-2 overflow-y-auto text-sm">
                  {deletePreview.statements.map((statement) => (
                    <li key={statement.statement_id} className="rounded-md border border-border p-3">
                      <div>{statementDeleteLine(statement)}</div>
                      <div className="mt-1 text-xs text-muted-foreground">{statement.status}</div>
                      {statement.evidence_quote ? (
                        <blockquote className="mt-2 border-l-2 pl-2 text-xs text-muted-foreground">
                          {statement.evidence_quote}
                        </blockquote>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
              {deletePreview.statements_truncated ? (
                <p className="text-xs text-muted-foreground">
                  {fmt(l.deleteEntityTruncated, {
                    shown: deletePreview.statements.length,
                    total: deletePreview.statement_count,
                  })}
                </p>
              ) : null}
              {deletePreview.typed_fact_count > 0 ||
              deletePreview.derived_fact_count > 0 ||
              deletePreview.merge_count > 0 ? (
                <p className="text-sm text-muted-foreground">
                  {fmt(l.deleteEntityRelated, {
                    typed: deletePreview.typed_fact_count,
                    derived: deletePreview.derived_fact_count,
                    merges: deletePreview.merge_count,
                  })}
                </p>
              ) : null}
            </div>
          ) : null}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={deleting}
              onClick={() => setDeleteTarget(null)}
            >
              {t.common.cancel}
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={deleting || deletePreviewLoading || deletePreview === null}
              onClick={() => void confirmDeleteEntity()}
            >
              {deleting ? <Spinner className="size-4" /> : null}
              {l.deleteEntityConfirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </DataPanel>
  );
}
