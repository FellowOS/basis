import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

export type KbGraphAuditEvent = {
  id: number;
  action: string;
  actor_id: string | null;
  created_at: string;
  detail?: Record<string, unknown>;
};

export function formatGraphAuditAction(action: string, locale: Locale): string {
  const m = messagesForLocale(locale);
  const actions = {
    ...m.platformAuditActions,
    ...m.kbGraphAudit.actions,
  } as Record<string, string>;
  return actions[action] ?? action;
}

export function formatGraphAuditDetail(event: KbGraphAuditEvent, locale: Locale): string {
  const messages = messagesForLocale(locale);
  const copy = messages.kbGraphAudit;
  const emptyCell = messages.common.emptyCell;
  const d = event.detail ?? {};
  if (event.action === 'kb.graph.projection_rebuild') {
    const parts: string[] = [];
    if (d.projection_revision != null) {
      parts.push(
        fmt(copy.projectionRevision, {
          revision: formatLocaleNumber(locale, Number(d.projection_revision)),
        }),
      );
    }
    if (d.node_count != null && d.edge_count != null) {
      parts.push(
        fmt(copy.nodesEdgesRatio, {
          nodes: formatLocaleNumber(locale, Number(d.node_count)),
          edges: formatLocaleNumber(locale, Number(d.edge_count)),
        }),
      );
    }
    return parts.join(' · ') || emptyCell;
  }
  if (event.action === 'kb.graph.export' && d.format) {
    return String(d.format);
  }
  if (
    (event.action === 'kb.graph.import' || event.action === 'kb.graph.import_proposed') &&
    (d.filename != null || d.nodes_imported != null)
  ) {
    return [
      d.filename,
      d.nodes_imported != null
        ? fmt(copy.nodesImported, { count: formatLocaleNumber(locale, Number(d.nodes_imported)) })
        : null,
      d.edges_imported != null
        ? fmt(copy.edgesImported, { count: formatLocaleNumber(locale, Number(d.edges_imported)) })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  const reviewItemId = reviewItemIdFromGraphAuditDetail(d);
  if (reviewItemId) {
    return reviewItemId;
  }
  return emptyCell;
}

export function proposalIdFromGraphAuditDetail(
  detail: Record<string, unknown> | undefined,
): string | null {
  if (!detail) return null;
  const direct = detail.proposal_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const extra = detail.extra;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const nested = (extra as Record<string, unknown>).proposal_id;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  const payload = detail.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).proposal_id;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return null;
}

export function reviewItemIdFromGraphAuditDetail(
  detail: Record<string, unknown> | undefined,
): string | null {
  if (!detail) return null;
  for (const key of ['review_item_id', 'item_id'] as const) {
    const v = detail[key];
    if (typeof v === 'string' && v.trim()) return v.trim();
  }
  const payload = detail.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).review_item_id;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return null;
}
