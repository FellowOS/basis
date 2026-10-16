import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';

export type KbGraphAuditEvent = {
  id: number;
  action: string;
  actor_id: string | null;
  created_at: string;
  detail?: Record<string, unknown>;
};

function pack(locale: Locale) {
  return messagesForLocale(locale).kbGraphAudit;
}

export function formatGraphAuditAction(action: string, locale: Locale): string {
  const actions = pack(locale).actions as Record<string, string>;
  return actions[action] ?? action;
}

export function formatGraphAuditDetail(event: KbGraphAuditEvent, locale: Locale): string {
  const copy = pack(locale);
  const d = event.detail ?? {};
  if (event.action === 'kb.graph.projection_rebuild') {
    const parts: string[] = [];
    if (d.projection_revision != null) {
      parts.push(fmt(copy.projectionRevision, { revision: String(d.projection_revision) }));
    }
    if (d.node_count != null && d.edge_count != null) {
      parts.push(
        fmt(copy.nodesEdgesRatio, {
          nodes: String(d.node_count),
          edges: String(d.edge_count),
        }),
      );
    }
    return parts.join(' · ') || '—';
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
        ? fmt(copy.nodesImported, { count: String(d.nodes_imported) })
        : null,
      d.edges_imported != null
        ? fmt(copy.edgesImported, { count: String(d.edges_imported) })
        : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }
  if (typeof d.review_item_id === 'string') {
    return d.review_item_id;
  }
  return '—';
}
