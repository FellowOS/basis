import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { KbEntityMergePropertyDiff } from '@/components/kb/widgets/kb-entity-merge-property-diff.js';
import { buildExplorerKbApiPath, explorerFetch } from '@/explorer/host/explorerHttp.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleDateTime, formatLocaleNumber } from '@/i18n/format.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import type { Locale } from '@/i18n/locale.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { throwIfApiNotOk } from '@/lib/api-error.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { formatGraphAuditAction } from '@/lib/kb-graph-audit.js';
import { formatNodeRef, formatNodeRefDetail } from '@/lib/format-node-ref.js';
import { fetchKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbOntologyProposalPath, kbOntologyVersionsPath, kbPath } from '@/lib/nav-config.js';
import { Button } from '@/components/ui/button.js';
import { cn } from '@/lib/utils.js';

type ReviewItem = {
  id: string;
  kind: string;
  status: string;
  payload: {
    primary_id?: string;
    duplicate_ids?: string[];
    filename?: string;
    byte_size?: number;
    mapping_id?: string;
    signature?: string;
    target_uri?: string | null;
    target_kind?: string;
    direction?: string;
    content?: string;
    statement_id?: string;
    surface_phrase?: string;
    objects?: Array<{
      statement_id?: string;
      object_entity_id?: string | null;
      object_value?: string | null;
    }>;
  };
  created_at: string;
};

type AuditEvent = {
  id: number;
  action: string;
  created_at: string;
  detail?: Record<string, unknown>;
};

type EntityMergeRow = {
  id: string;
  source_entity_id: string;
  target_entity_id: string;
  why: string | null;
  created_at: string;
  reverted_at: string | null;
};

type TimelineEntry =
  | { kind: 'audit'; id: string; at: string; event: AuditEvent }
  | { kind: 'ledger_merge'; id: string; at: string; merge: EntityMergeRow };

function auditDetailLine(
  locale: Locale,
  event: AuditEvent,
  r: LocaleMessages['kbReview'],
  audit: LocaleMessages['kbGraphAudit'],
  labels: Record<string, string | null>,
): string | null {
  const d = event.detail ?? {};
  if (event.action.includes('merge')) {
    const primary = d.primary_id as string | undefined;
    const dupes = d.duplicate_ids as string[] | undefined;
    if (primary && dupes?.length) {
      return `${formatNodeRef(primary, labels)} ← ${dupes.map((id) => formatNodeRef(id, labels)).join(', ')}`;
    }
    const payload = d.payload as { primary_id?: string; duplicate_ids?: string[] } | undefined;
    if (payload?.primary_id) {
      const dupList = payload.duplicate_ids ?? [];
      return `${formatNodeRef(payload.primary_id, labels)} ← ${dupList.map((id) => formatNodeRef(id, labels)).join(', ')}`;
    }
  }
  if (event.action === 'kb.graph.import' || event.action === 'kb.graph.import_proposed') {
    const nodes = d.nodes_imported;
    const edges = d.edges_imported;
    const file = d.filename;
    return [
      file,
      nodes != null ? fmt(r.importNodes, { count: formatLocaleNumber(locale, Number(nodes)) }) : null,
      edges != null ? fmt(r.importEdges, { count: formatLocaleNumber(locale, Number(edges)) }) : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (event.action === 'kb.graph.export') {
    const fmt = d.format;
    return fmt ? String(fmt) : null;
  }
  if (event.action === 'kb.graph.projection_rebuild') {
    const parts: string[] = [];
    if (d.projection_revision != null) {
      parts.push(
        fmt(audit.projectionRevision, {
          revision: formatLocaleNumber(locale, Number(d.projection_revision)),
        }),
      );
    }
    if (d.node_count != null && d.edge_count != null) {
      parts.push(`${d.node_count}/${d.edge_count}`);
    }
    return parts.length ? parts.join(' · ') : null;
  }
  const mergePayload = d.merge as { ledger_notice?: string; ledger_skipped_ids?: string[] } | undefined;
  const ledgerNotice = (d.ledger_notice as string | undefined) ?? mergePayload?.ledger_notice;
  const ledgerSkipped =
    (d.ledger_skipped_ids as string[] | undefined) ?? mergePayload?.ledger_skipped_ids;
  if (event.action === 'kb.graph.merge_approved' && ledgerNotice === 'graph_only_merge') {
    return r.graphOnlyMergeApproved;
  }
  if (event.action === 'kb.graph.merge_approved' && ledgerNotice === 'partial_ledger') {
    const skipped = ledgerSkipped?.join(', ');
    return fmt(r.partialLedgerSkipped, { skipped: skipped ?? '' });
  }
  if (event.action === 'kb.graph.merge_approved') {
    const ledger = d.ledger_merges as { source_entity_id?: string; target_entity_id?: string }[] | undefined;
    if (ledger?.length) {
      return ledger
        .map(
          (row) =>
            `${formatNodeRef(row.source_entity_id ?? '', labels)} → ${formatNodeRef(row.target_entity_id ?? '', labels)}`,
        )
        .join('; ');
    }
    const merge = d.merge as { ledger_merges?: { source_entity_id: string; target_entity_id: string }[] } | undefined;
    if (merge?.ledger_merges?.length) {
      return merge.ledger_merges
        .map(
          (row) =>
            `${formatNodeRef(row.source_entity_id, labels)} → ${formatNodeRef(row.target_entity_id, labels)}`,
        )
        .join('; ');
    }
  }
  return null;
}

function auditProposalId(event: AuditEvent): string | null {
  const d = event.detail ?? {};
  const direct = d.proposal_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const extra = d.extra as { proposal_id?: string } | undefined;
  if (typeof extra?.proposal_id === 'string' && extra.proposal_id.trim()) {
    return extra.proposal_id.trim();
  }
  const payload = d.payload as { proposal_id?: string } | undefined;
  if (typeof payload?.proposal_id === 'string' && payload.proposal_id.trim()) {
    return payload.proposal_id.trim();
  }
  return null;
}

function collectAuditLabelIds(events: AuditEvent[]): string[] {
  const ids: string[] = [];
  for (const event of events) {
    const d = event.detail ?? {};
    const primary = d.primary_id as string | undefined;
    if (primary) ids.push(primary);
    const dupes = d.duplicate_ids as string[] | undefined;
    if (dupes?.length) ids.push(...dupes);
    const payload = d.payload as { primary_id?: string; duplicate_ids?: string[] } | undefined;
    if (payload?.primary_id) ids.push(payload.primary_id);
    if (payload?.duplicate_ids?.length) ids.push(...payload.duplicate_ids);
    const ledger = d.ledger_merges as { source_entity_id?: string; target_entity_id?: string }[] | undefined;
    for (const row of ledger ?? []) {
      if (row.source_entity_id) ids.push(row.source_entity_id);
      if (row.target_entity_id) ids.push(row.target_entity_id);
    }
    const merge = d.merge as { ledger_merges?: { source_entity_id: string; target_entity_id: string }[] } | undefined;
    for (const row of merge?.ledger_merges ?? []) {
      ids.push(row.source_entity_id, row.target_entity_id);
    }
  }
  return ids;
}

function mergeTimeline(
  events: AuditEvent[],
  merges: EntityMergeRow[],
): TimelineEntry[] {
  const rows: TimelineEntry[] = events.map((event) => ({
    kind: 'audit',
    id: `audit-${event.id}`,
    at: event.created_at,
    event,
  }));
  for (const merge of merges) {
    rows.push({
      kind: 'ledger_merge',
      id: `merge-${merge.id}`,
      at: merge.created_at,
      merge,
    });
  }
  return rows.sort((a, b) => (a.at < b.at ? 1 : a.at > b.at ? -1 : 0));
}

export function KbReviewQueueTab({
  kbId,
  focusItemId,
}: {
  kbId: string;
  focusItemId?: string;
}) {
  const { t, locale } = useI18n();
  const emptyCell = t.common.emptyCell;
  const r = t.kbReview;
  const auditMessages = t.kbGraphAudit;
  const apiError = useCallback(
    (err: unknown) => formatUserFacingApiError(err, locale as Locale),
    [locale],
  );
  const { caps } = useKbCapabilities();
  const queryClient = useQueryClient();
  const [items, setItems] = useState<ReviewItem[]>([]);
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [merges, setMerges] = useState<EntityMergeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [busyMergeId, setBusyMergeId] = useState<string | null>(null);
  const [labels, setLabels] = useState<Record<string, string | null>>({});
  const [diffExpandedId, setDiffExpandedId] = useState<string | null>(null);
  const [highlightItemId, setHighlightItemId] = useState<string | null>(null);
  const canRevertMerge = Boolean(caps?.graph_write);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [queueRes, auditRes, mergesRes] = await Promise.all([
        explorerFetch(buildExplorerKbApiPath('review/items', kbId)),
        explorerFetch(
          `${buildExplorerKbApiPath('audit/graph-mutations', kbId)}?action_prefix=${encodeURIComponent('kb.')}&limit=50`,
        ),
        explorerFetch(`${buildExplorerKbApiPath('ledger/entity-merges', kbId)}?active_only=false`),
      ]);
      await throwIfApiNotOk(queueRes);
      const queueData = (await queueRes.json()) as { items?: ReviewItem[] };
      setItems(queueData.items ?? []);

      let loadedEvents: AuditEvent[] = [];
      if (auditRes.ok) {
        const auditData = (await auditRes.json()) as { events?: AuditEvent[] };
        loadedEvents = auditData.events ?? [];
        setEvents(loadedEvents);
      } else {
        setEvents([]);
      }

      let loadedMerges: EntityMergeRow[] = [];
      if (mergesRes.ok) {
        const mergeData = (await mergesRes.json()) as { merges?: EntityMergeRow[] };
        loadedMerges = mergeData.merges ?? [];
        setMerges(loadedMerges);
      } else {
        setMerges([]);
      }

      const labelIds: string[] = [];
      for (const item of queueData.items ?? []) {
        if (item.kind === 'entity_merge' && item.payload) {
          if (item.payload.primary_id) labelIds.push(item.payload.primary_id);
          labelIds.push(...(item.payload.duplicate_ids ?? []));
        }
      }
      for (const row of loadedMerges) {
        labelIds.push(row.source_entity_id, row.target_entity_id);
      }
      labelIds.push(...collectAuditLabelIds(loadedEvents));
      void fetchKbNodeLabels(kbId, labelIds)
        .then((next) => setLabels((prev) => ({ ...prev, ...next })))
        .catch(() => {});
    } catch (err) {
      setError(apiError(err));
      setItems([]);
      setEvents([]);
      setMerges([]);
    } finally {
      setLoading(false);
    }
  }, [apiError, kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!focusItemId || loading) return;
    const item = items.find((row) => row.id === focusItemId);
    if (!item) return;
    if (item.kind === 'entity_merge') {
      setDiffExpandedId(focusItemId);
    }
    setHighlightItemId(focusItemId);
    const timer = window.setTimeout(() => {
      document.getElementById(`review-item-${focusItemId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }, 0);
    const clearHighlight = window.setTimeout(() => setHighlightItemId(null), 4000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearHighlight);
    };
  }, [focusItemId, items, loading]);

  async function revertLedgerMerge(mergeId: string) {
    if (!canRevertMerge) return;
    setBusyMergeId(mergeId);
    setError(null);
    try {
      const res = await explorerFetch(
        buildExplorerKbApiPath(`ledger/entity-merges/${encodeURIComponent(mergeId)}/revert`, kbId),
        { method: 'POST' },
      );
      await throwIfApiNotOk(res);
      void queryClient.invalidateQueries({ queryKey: ['graph', 'full-load', kbId] });
      void load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyMergeId(null);
    }
  }

  async function resolve(itemId: string, action: 'approve' | 'reject') {
    setBusyId(itemId);
    setError(null);
    try {
      const res = await explorerFetch(
        buildExplorerKbApiPath(`review/items/${encodeURIComponent(itemId)}/${action}`, kbId),
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
      );
      await throwIfApiNotOk(res);
      setItems((prev) => prev.filter((row) => row.id !== itemId));
      if (action === 'approve') {
        void queryClient.invalidateQueries({ queryKey: ['graph', 'full-load', kbId] });
      }
      void load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setBusyId(null);
    }
  }

  const timeline = mergeTimeline(events, merges);

  function renderNodeRef(id: string) {
    const { title, subtitle } = formatNodeRefDetail(id, labels);
    return (
      <span className="inline-block">
        <span>{title}</span>
        {subtitle ? (
          <span className="mt-0.5 block font-mono text-[10px] font-normal text-muted-foreground">{subtitle}</span>
        ) : null}
      </span>
    );
  }

  function kindLabel(kind: string) {
    if (kind === 'graph_import') return r.kindImport;
    if (kind === 'ontology_mapping') return r.kindMapping;
    if (kind === 'statement_remember') return r.kindRemember;
    if (kind === 'statement_conflict') return r.kindConflict;
    if (kind === 'entity_merge') return r.kindMerge;
    return kind;
  }

  return (
    <div className="flex min-h-0 flex-1 overflow-hidden max-[900px]:flex-col">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden border-r border-border max-[900px]:max-h-[min(52vh,480px)] max-[900px]:border-r-0 max-[900px]:border-b">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <PublicIcon name="check-square-contained" size={13} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{r.queueTitle}</span>
          {!loading ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{items.length}</span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto">
          {loading ? (
            <div className="flex items-center gap-2 px-4 py-3 text-sm text-muted-foreground">
              <PublicIcon name="loader-01" size={16} className="animate-spin" />
              {t.common.loading}
            </div>
          ) : error ? (
            <p className="px-4 py-3 text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <div className="flex h-full min-h-32 flex-col items-center justify-center px-6 text-center">
              <PublicIcon name="check-square-contained" size={18} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{r.emptyQueue}</p>
              <p className="mt-1 max-w-sm text-[11px] leading-snug text-muted-foreground">
                {r.emptyQueuePrefix}
                <Link to={kbOntologyVersionsPath(kbId)} className="text-foreground underline-offset-2 hover:underline">
                  {r.emptyQueueLink}
                </Link>
                {r.emptyQueueSuffix}
              </p>
            </div>
          ) : (
            <ul>
              {items.map((item) => {
                const isImport = item.kind === 'graph_import';
                const isMapping = item.kind === 'ontology_mapping';
                const isRemember = item.kind === 'statement_remember';
                const isConflict = item.kind === 'statement_conflict';
                const isEntityMerge = item.kind === 'entity_merge';
                const primaryId = item.payload.primary_id ?? emptyCell;
                const duplicateIds = item.payload.duplicate_ids ?? [];
                const firstDuplicate = duplicateIds[0];
                const showDiff = diffExpandedId === item.id;
                const approveLabelForItem = isImport
                  ? r.approveImport
                  : isMapping
                    ? r.approveMapping
                    : isRemember
                      ? r.approveFact
                      : isConflict
                        ? r.acknowledge
                        : r.approveMerge;
                return (
                  <li
                    key={item.id}
                    id={`review-item-${item.id}`}
                    className={cn(
                      'border-b border-border px-4 py-2.5 text-sm',
                      highlightItemId === item.id && 'bg-muted',
                    )}
                  >
                    <div className="text-[11px] text-muted-foreground">{kindLabel(item.kind)}</div>
                    <div className="mt-1 text-[13px] leading-snug">
                      {isImport
                        ? `${item.payload.filename ?? r.importDefaultFilename} (${fmt(r.importByteSize, {
                            size:
                              item.payload.byte_size != null
                                ? formatLocaleNumber(locale as Locale, item.payload.byte_size)
                                : '?',
                          })})`
                        : isMapping
                          ? (
                            <span className="flex flex-col gap-1 font-mono text-xs">
                              <span>{item.payload.signature ?? emptyCell}</span>
                              <span className="text-muted-foreground">
                                → {item.payload.target_uri ?? emptyCell} (
                                {item.payload.target_kind ?? r.mappingKindUnknown})
                              </span>
                            </span>
                          )
                          : isRemember
                            ? (
                              <span className="whitespace-pre-wrap">
                                {String(item.payload.content ?? item.payload.statement_id ?? emptyCell)}
                              </span>
                            )
                          : isConflict
                            ? (
                              <span className="flex flex-col gap-1">
                                <span>
                                  {r.conflictPredicate}
                                  <span className="font-mono text-xs">
                                    {String(item.payload.surface_phrase ?? emptyCell)}
                                  </span>
                                </span>
                                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                                  {item.payload.objects?.map((obj) => (
                                    <li key={obj.statement_id}>
                                      {obj.object_entity_id
                                        ? renderNodeRef(obj.object_entity_id)
                                        : String(obj.object_value ?? emptyCell)}
                                    </li>
                                  ))}
                                </ul>
                              </span>
                            )
                          : (
                          <span className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs font-normal">
                              {r.primary}
                            </span>
                            {primaryId !== emptyCell ? renderNodeRef(primaryId) : emptyCell}
                            {duplicateIds.length ? (
                              <>
                                <span className="text-muted-foreground text-xs font-normal pt-1">
                                  {r.duplicates}
                                </span>
                                <span className="flex flex-col gap-1">
                                  {duplicateIds.map((dup) => (
                                    <span key={dup}>{renderNodeRef(dup)}</span>
                                  ))}
                                </span>
                              </>
                            ) : null}
                          </span>
                        )}
                    </div>
                    {!isImport && !isMapping && !isRemember && !isConflict ? (
                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{r.graphOnlyMergeHint}</p>
                    ) : null}
                    {isEntityMerge && primaryId !== emptyCell && firstDuplicate ? (
                      <>
                        <Button
                          type="button"
                          variant="link"
                          className="mt-2 h-auto gap-1 p-0 text-[11px] text-foreground"
                          onClick={() =>
                            setDiffExpandedId(showDiff ? null : item.id)
                          }
                        >
                          {showDiff ? (
                            <PublicIcon name="chevron-down" size={12} />
                          ) : (
                            <PublicIcon name="chevron-right" size={12} />
                          )}
                          {r.propertyDiff}
                        </Button>
                        {showDiff ? (
                          <KbEntityMergePropertyDiff
                            kbId={kbId}
                            primaryId={primaryId}
                            duplicateId={firstDuplicate}
                            variant="compact"
                          />
                        ) : null}
                      </>
                    ) : null}
                    {isMapping ? (
                      <div className="mt-2">
                        <Link
                          to={kbPath(kbId, 'mappings')}
                          className="text-[11px] text-foreground underline-offset-2 hover:underline"
                        >
                          {r.openMappings}
                        </Link>
                      </div>
                    ) : null}
                    <div className="mt-3 flex flex-wrap gap-2">
                      <Button
                        type="button"
                        size="sm"
                        className="h-8"
                        disabled={busyId === item.id}
                        onClick={() => void resolve(item.id, 'approve')}
                      >
                        {busyId === item.id ? (
                          <PublicIcon name="loader-01" size={12} className="animate-spin" />
                        ) : (
                          <PublicIcon name="check-01" size={12} />
                        )}
                        {approveLabelForItem}
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        className="h-8"
                        disabled={busyId === item.id}
                        onClick={() => void resolve(item.id, 'reject')}
                      >
                        <PublicIcon name="x-02" size={12} />
                        {r.reject}
                      </Button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="flex w-[min(360px,34vw)] min-w-[260px] shrink-0 flex-col overflow-hidden max-[900px]:max-h-[min(40vh,360px)] max-[900px]:w-full max-[900px]:min-w-0">
        <div className="flex h-12 shrink-0 items-center gap-2 border-b border-border px-4">
          <PublicIcon name="clock-01" size={13} className="shrink-0 text-muted-foreground" />
          <span className="text-[11px] font-semibold tracking-wide text-muted-foreground uppercase">{r.timelineTitle}</span>
          {!loading ? (
            <span className="font-mono text-[11px] tabular-nums text-muted-foreground">{timeline.length}</span>
          ) : null}
        </div>
        <div className="min-h-0 flex-1 overflow-auto px-4 py-3">
          {!loading && timeline.length === 0 ? (
            <div className="flex h-full min-h-32 flex-col items-center justify-center px-4 text-center">
              <PublicIcon name="clock-01" size={18} className="mb-2 text-muted-foreground" />
              <p className="text-sm font-medium text-foreground">{r.emptyLog}</p>
            </div>
          ) : (
            <ol className="relative border-l border-border pl-4">
              {timeline.map((entry) => {
                if (entry.kind === 'ledger_merge') {
                  const row = entry.merge;
                  return (
                    <li key={entry.id} className="mb-4 last:mb-0">
                      <span
                        className="absolute -left-1.5 mt-1.5 size-2 rounded-full bg-primary"
                        aria-hidden
                      />
                      <div className="text-xs font-semibold text-foreground">
                        {r.ledgerMergeLabel}
                        {row.reverted_at ? r.ledgerMergeReverted : ''}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatNodeRef(row.source_entity_id, labels)} →{' '}
                        {formatNodeRef(row.target_entity_id, labels)}
                      </div>
                      {row.why ? (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{row.why}</div>
                      ) : null}
                      {canRevertMerge && !row.reverted_at ? (
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 h-8"
                          disabled={busyMergeId === row.id}
                          onClick={() => void revertLedgerMerge(row.id)}
                        >
                          {busyMergeId === row.id ? (
                            <PublicIcon name="loader-01" size={12} className="animate-spin" />
                          ) : null}
                          {r.revertMerge}
                        </Button>
                      ) : null}
                      <time className="mt-1 block text-[10px] text-muted-foreground">
                        {formatLocaleDateTime(locale, entry.at)}
                      </time>
                    </li>
                  );
                }
                const event = entry.event;
                const detail = auditDetailLine(locale, event, r, auditMessages, labels);
                const proposalId = auditProposalId(event);
                return (
                  <li key={entry.id} className="mb-4 last:mb-0">
                    <span
                      className="absolute -left-1.5 mt-1.5 size-2 rounded-full bg-muted-foreground"
                      aria-hidden
                    />
                    <div className="text-xs font-semibold text-foreground">
                      {formatGraphAuditAction(event.action, locale as Locale)}
                    </div>
                    {detail ? (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
                    ) : null}
                    {proposalId ? (
                      <Link
                        to={kbOntologyProposalPath(kbId, proposalId)}
                        className="mt-1 inline-block text-[11px] text-foreground underline-offset-2 hover:underline"
                      >
                        {r.openOntologyProposal}
                      </Link>
                    ) : null}
                    <time className="mt-1 block text-[10px] text-muted-foreground">
                      {formatLocaleDateTime(locale, entry.at)}
                    </time>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      </aside>
    </div>
  );
}
