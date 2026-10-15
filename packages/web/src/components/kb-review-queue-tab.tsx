import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { Check, ChevronDown, ChevronRight, Clock, Loader2, X } from 'lucide-react';
import { KbEntityMergePropertyDiff } from '@/components/kb-entity-merge-property-diff.js';
import { buildExplorerKbApiPath, explorerFetch } from '@/explorer/host/explorerHttp.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { throwIfApiNotOk } from '@/lib/api-error.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { formatGraphAuditAction } from '@/lib/kb-graph-audit.js';
import { formatNodeRef, formatNodeRefDetail } from '@/lib/format-node-ref.js';
import { fetchKbNodeLabels } from '@/lib/kb-node-labels.js';
import { kbOntologyProposalPath, kbOntologyVersionsPath, kbPath } from '@/lib/nav-config.js';
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

function formatAuditAction(action: string, locale: string): string {
  return formatGraphAuditAction(action, locale === 'zh');
}

function auditDetailLine(
  event: AuditEvent,
  locale: string,
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
    if (locale === 'zh') {
      return [file, nodes != null ? `${nodes} 节点` : null, edges != null ? `${edges} 边` : null]
        .filter(Boolean)
        .join(' · ');
    }
    return [file, nodes != null ? `${nodes} nodes` : null, edges != null ? `${edges} edges` : null]
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
      parts.push(locale === 'zh' ? `修订 ${d.projection_revision}` : `rev ${d.projection_revision}`);
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
    return locale === 'zh'
      ? '仅更新图投影，未写入账本 entity_merges'
      : 'Graph projection only; no ledger entity_merges recorded';
  }
  if (event.action === 'kb.graph.merge_approved' && ledgerNotice === 'partial_ledger') {
    const skipped = ledgerSkipped?.join(', ');
    return locale === 'zh'
      ? `部分节点未入账本：${skipped ?? ''}`
      : `Some nodes skipped for ledger: ${skipped ?? ''}`;
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
  const { locale } = useI18n();
  const apiError = useCallback(
    (err: unknown) => formatUserFacingApiError(err, locale === 'zh' ? 'zh' : 'en'),
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

  const title = locale === 'zh' ? '审核队列' : 'Review queue';
  const timelineTitle = locale === 'zh' ? 'KB 变更记录' : 'KB activity log';
  const ledgerMergeLabel = locale === 'zh' ? '账本实体合并' : 'Ledger entity merge';
  const revertMergeLabel = locale === 'zh' ? '回滚合并' : 'Revert merge';
  const timeline = mergeTimeline(events, merges);
  const empty = locale === 'zh' ? '暂无待处理项' : 'No open items';
  const emptyLog = locale === 'zh' ? '暂无记录' : 'No events yet';
  const approveLabel = locale === 'zh' ? '批准合并' : 'Approve merge';
  const rejectLabel = locale === 'zh' ? '驳回' : 'Reject';
  const graphOnlyMergeHint =
    locale === 'zh'
      ? '若重复项不是账本实体，批准后只改图投影，不会写入 entity_merges。'
      : 'Non-ledger nodes update the graph only; entity_merges are not recorded.';

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

  return (
    <div className="flex min-h-0 flex-1 flex-col overflow-hidden bg-background text-foreground lg:flex-row">
      <div className="flex min-h-0 min-w-0 flex-1 flex-col border-b border-border lg:border-b-0 lg:border-r">
        <div className="border-b border-border px-4 py-3">
          <h2 className="text-base font-semibold">{title}</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            {locale === 'zh'
              ? '合并、图导入、Agent 记入与本体映射需编辑者批准后才会生效。OWL 本体变更提案在'
              : 'Merges, imports, remembered facts, and mappings need editor approval. OWL ontology proposals are in'}
            {' '}
            <Link to={kbOntologyVersionsPath(kbId)} className="text-primary hover:underline">
              {locale === 'zh' ? '本体 → 版本' : 'Ontology → Versions'}
            </Link>
            {locale === 'zh' ? '。' : '.'}
            {' '}
            {locale === 'zh'
              ? '治理门控触发时，页头告警可深链回本队列或决策记录。'
              : 'When governance gates trip, use header alerts to jump back here or to Decisions.'}
          </p>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
          {loading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              {locale === 'zh' ? '加载中…' : 'Loading…'}
            </div>
          ) : error ? (
            <p className="text-sm text-destructive">{error}</p>
          ) : items.length === 0 ? (
            <div className="space-y-2 text-sm text-muted-foreground">
              <p>{empty}</p>
              <p>
                {locale === 'zh' ? '有待审的本体提案？前往 ' : 'Pending ontology proposals? Open '}
                <Link to={kbOntologyVersionsPath(kbId)} className="text-primary hover:underline">
                  {locale === 'zh' ? '本体 → 版本' : 'Ontology → Versions'}
                </Link>
                {locale === 'zh' ? '。' : '.'}
              </p>
            </div>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const isImport = item.kind === 'graph_import';
                const isMapping = item.kind === 'ontology_mapping';
                const isRemember = item.kind === 'statement_remember';
                const isEntityMerge = item.kind === 'entity_merge';
                const primaryId = item.payload.primary_id ?? '—';
                const duplicateIds = item.payload.duplicate_ids ?? [];
                const firstDuplicate = duplicateIds[0];
                const showDiff = diffExpandedId === item.id;
                const approveLabelForItem = isImport
                  ? locale === 'zh'
                    ? '批准导入'
                    : 'Approve import'
                  : isMapping
                    ? locale === 'zh'
                      ? '批准映射'
                      : 'Approve mapping'
                    : isRemember
                      ? locale === 'zh'
                        ? '批准记入'
                        : 'Approve fact'
                      : approveLabel;
                return (
                  <li
                    key={item.id}
                    id={`review-item-${item.id}`}
                    className={cn(
                      'oh-card text-sm',
                      highlightItemId === item.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                    )}
                  >
                    <div className="font-mono text-xs text-muted-foreground">{item.kind}</div>
                    <div className="mt-2 font-medium">
                      {isImport
                        ? `${item.payload.filename ?? 'import'} (${item.payload.byte_size ?? '?'} B)`
                        : isMapping
                          ? (
                            <span className="flex flex-col gap-1 font-mono text-xs">
                              <span>{item.payload.signature ?? '—'}</span>
                              <span className="text-muted-foreground">
                                → {item.payload.target_uri ?? '—'} ({item.payload.target_kind ?? '?'})
                              </span>
                            </span>
                          )
                          : isRemember
                            ? (
                              <span className="whitespace-pre-wrap text-sm">
                                {String(item.payload.content ?? item.payload.statement_id ?? '—')}
                              </span>
                            )
                          : (
                          <span className="flex flex-col gap-1">
                            <span className="text-muted-foreground text-xs font-normal">
                              {locale === 'zh' ? '主节点' : 'Primary'}
                            </span>
                            {primaryId !== '—' ? renderNodeRef(primaryId) : '—'}
                            {duplicateIds.length ? (
                              <>
                                <span className="text-muted-foreground text-xs font-normal pt-1">
                                  {locale === 'zh' ? '合并入' : 'Duplicates'}
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
                    {!isImport && !isMapping && !isRemember ? (
                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{graphOnlyMergeHint}</p>
                    ) : null}
                    {isEntityMerge && primaryId !== '—' && firstDuplicate ? (
                      <>
                        <button
                          type="button"
                          className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                          onClick={() =>
                            setDiffExpandedId(showDiff ? null : item.id)
                          }
                        >
                          {showDiff ? (
                            <ChevronDown className="size-3" />
                          ) : (
                            <ChevronRight className="size-3" />
                          )}
                          {locale === 'zh' ? '属性对比' : 'Property diff'}
                        </button>
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
                          className="text-xs text-primary hover:underline"
                        >
                          {locale === 'zh' ? '在本体映射页查看' : 'Open mappings workspace'}
                        </Link>
                      </div>
                    ) : null}
                    <div className="mt-3 flex gap-2">
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className="oh-btn oh-btn--primary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
                        style={{ marginTop: 0, width: 'auto' }}
                        onClick={() => void resolve(item.id, 'approve')}
                      >
                        {busyId === item.id ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <Check className="size-3" />
                        )}
                        {approveLabelForItem}
                      </button>
                      <button
                        type="button"
                        disabled={busyId === item.id}
                        className="oh-btn oh-btn--secondary inline-flex items-center gap-1 px-3 py-1.5 text-xs disabled:opacity-50"
                        style={{ marginTop: 0, width: 'auto' }}
                        onClick={() => void resolve(item.id, 'reject')}
                      >
                        <X className="size-3" />
                        {rejectLabel}
                      </button>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </div>

      <aside className="flex w-full shrink-0 flex-col lg:w-[min(100%,22rem)]">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Clock className="size-4 text-primary" aria-hidden />
            {timelineTitle}
          </div>
        </div>
        <div className="min-h-0 max-h-[40vh] flex-1 overflow-y-auto px-4 py-3 lg:max-h-none">
          {!loading && timeline.length === 0 ? (
            <p className="text-xs text-muted-foreground">{emptyLog}</p>
          ) : (
            <ol className="relative border-l border-border pl-4">
              {timeline.map((entry) => {
                if (entry.kind === 'ledger_merge') {
                  const row = entry.merge;
                  return (
                    <li key={entry.id} className="mb-4 last:mb-0">
                      <span
                        className="absolute -left-1.5 mt-1.5 size-2.5 rounded-full bg-[#9ee8d7]/90"
                        aria-hidden
                      />
                      <div className="text-xs font-semibold text-foreground">
                        {ledgerMergeLabel}
                        {row.reverted_at
                          ? locale === 'zh'
                            ? '（已回滚）'
                            : ' (reverted)'
                          : ''}
                      </div>
                      <div className="mt-0.5 text-[10px] text-muted-foreground">
                        {formatNodeRef(row.source_entity_id, labels)} →{' '}
                        {formatNodeRef(row.target_entity_id, labels)}
                      </div>
                      {row.why ? (
                        <div className="mt-0.5 text-[10px] text-muted-foreground">{row.why}</div>
                      ) : null}
                      {canRevertMerge && !row.reverted_at ? (
                        <button
                          type="button"
                          disabled={busyMergeId === row.id}
                          className="mt-2 inline-flex items-center gap-1 rounded border border-[#f2b66d]/40 bg-[#f2b66d]/10 px-2 py-1 text-[10px] font-semibold text-[#f2d4a6] disabled:opacity-50"
                          onClick={() => void revertLedgerMerge(row.id)}
                        >
                          {busyMergeId === row.id ? (
                            <Loader2 className="size-3 animate-spin" />
                          ) : null}
                          {revertMergeLabel}
                        </button>
                      ) : null}
                      <time className="mt-1 block text-[10px] text-muted-foreground">
                        {new Date(entry.at).toLocaleString()}
                      </time>
                    </li>
                  );
                }
                const event = entry.event;
                const detail = auditDetailLine(event, locale, labels);
                const proposalId = auditProposalId(event);
                return (
                  <li key={entry.id} className="mb-4 last:mb-0">
                    <span
                      className="absolute -left-1.5 mt-1.5 size-2.5 rounded-full bg-[#4aa3ff]/80"
                      aria-hidden
                    />
                    <div className="text-xs font-semibold text-foreground">
                      {formatAuditAction(event.action, locale)}
                    </div>
                    {detail ? (
                      <div className="mt-0.5 text-[10px] text-muted-foreground">{detail}</div>
                    ) : null}
                    {proposalId ? (
                      <Link
                        to={kbOntologyProposalPath(kbId, proposalId)}
                        className="mt-1 inline-block text-[10px] text-primary hover:underline"
                      >
                        {locale === 'zh' ? '打开本体提案' : 'Open ontology proposal'}
                      </Link>
                    ) : null}
                    <time className="mt-1 block text-[10px] text-muted-foreground">
                      {new Date(entry.at).toLocaleString()}
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
