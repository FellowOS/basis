import { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { Check, Clock, Loader2, X } from 'lucide-react';
import { buildExplorerKbApiPath, explorerFetch } from '@/explorer/host/explorerHttp.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { formatGraphAuditAction } from '@/lib/kb-graph-audit.js';
import { formatNodeRef, formatNodeRefDetail } from '@/lib/format-node-ref.js';
import { fetchKbNodeLabels } from '@/lib/kb-node-labels.js';

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

export function KbReviewQueueTab({ kbId }: { kbId: string }) {
  const { locale } = useI18n();
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
      if (!queueRes.ok) throw new Error(`Queue HTTP ${queueRes.status}`);
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
      setError(err instanceof Error ? err.message : 'Failed to load');
      setItems([]);
      setEvents([]);
      setMerges([]);
    } finally {
      setLoading(false);
    }
  }, [kbId]);

  useEffect(() => {
    void load();
  }, [load]);

  async function revertLedgerMerge(mergeId: string) {
    if (!canRevertMerge) return;
    setBusyMergeId(mergeId);
    setError(null);
    try {
      const res = await explorerFetch(
        buildExplorerKbApiPath(`ledger/entity-merges/${encodeURIComponent(mergeId)}/revert`, kbId),
        { method: 'POST' },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.detail === 'object' && body.detail?.message
            ? String(body.detail.message)
            : `HTTP ${res.status}`;
        throw new Error(message);
      }
      void queryClient.invalidateQueries({ queryKey: ['graph', 'full-load', kbId] });
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Revert failed');
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
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        const message =
          typeof body?.detail === 'object' && body.detail?.message
            ? String(body.detail.message)
            : `HTTP ${res.status}`;
        throw new Error(message);
      }
      setItems((prev) => prev.filter((row) => row.id !== itemId));
      if (action === 'approve') {
        void queryClient.invalidateQueries({ queryKey: ['graph', 'full-load', kbId] });
      }
      void load();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Action failed');
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
              ? '合并、图导入与本体映射需编辑者批准后才会生效。'
              : 'Merges, graph imports, and ontology mappings apply only after editor approval.'}
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
            <p className="text-sm text-muted-foreground">{empty}</p>
          ) : (
            <ul className="flex flex-col gap-3">
              {items.map((item) => {
                const isImport = item.kind === 'graph_import';
                const isMapping = item.kind === 'ontology_mapping';
                const primaryId = item.payload.primary_id ?? '—';
                const duplicateIds = item.payload.duplicate_ids ?? [];
                const approveLabelForItem = isImport
                  ? locale === 'zh'
                    ? '批准导入'
                    : 'Approve import'
                  : isMapping
                    ? locale === 'zh'
                      ? '批准映射'
                      : 'Approve mapping'
                    : approveLabel;
                return (
                  <li
                    key={item.id}
                    className="oh-card text-sm"
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
                    {!isImport && !isMapping ? (
                      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">{graphOnlyMergeHint}</p>
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
