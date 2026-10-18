import { fmt } from '@/i18n/format.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import type { KbAlertStreamItem } from '@/lib/kb-alerts-stream.js';

type AlertsCopy = LocaleMessages['pages']['alerts'];

function detailString(value: unknown): string | null {
  if (typeof value === 'string' && value.trim()) return value.trim();
  if (typeof value === 'number' && Number.isFinite(value)) return String(value);
  return null;
}

/** Secondary lines for alert list rows (F-ALT / F-GOV-05). */
export function kbAlertDetailLines(
  alerts: AlertsCopy,
  alert: KbAlertStreamItem,
): string[] {
  const d = alert.detail ?? {};
  const lines: string[] = [];

  if (alert.kind === 'governance.tripped') {
    const code = detailString(d.code);
    if (code) lines.push(fmt(alerts.governanceTrippedCode, { code }));
    const decisionId = detailString(d.decision_id);
    if (decisionId) lines.push(fmt(alerts.governanceTrippedDecision, { id: decisionId }));
    const itemId = detailString(d.item_id);
    if (itemId) lines.push(fmt(alerts.governanceTrippedReviewItem, { id: itemId }));
    const proposalId = detailString(d.proposal_id);
    if (proposalId) lines.push(fmt(alerts.governanceTrippedProposal, { id: proposalId }));
    const shacl = d.shacl_violation_count ?? d.shacl_count;
    const shaclN = typeof shacl === 'number' ? shacl : Number(shacl);
    if (Number.isFinite(shaclN) && shaclN > 0) {
      lines.push(fmt(alerts.governanceTrippedShacl, { count: shaclN }));
    }
    return lines;
  }

  if (alert.kind === 'processing.failed') {
    const jobId = detailString(d.job_id);
    if (jobId) lines.push(fmt(alerts.processingFailedJob, { id: jobId }));
    const errorCode = detailString(d.error_code);
    if (errorCode) lines.push(fmt(alerts.processingFailedCode, { code: errorCode }));
    return lines;
  }

  if (alert.kind === 'sync_failed') {
    const sourceId = detailString(d.source_id);
    if (sourceId) lines.push(fmt(alerts.syncFailedSource, { id: sourceId }));
    return lines;
  }

  return lines;
}

export function groupAlertsByKind(
  alerts: KbAlertStreamItem[],
): Array<{ kind: string; alerts: KbAlertStreamItem[] }> {
  const order: string[] = [];
  const map = new Map<string, KbAlertStreamItem[]>();
  for (const alert of alerts) {
    if (!map.has(alert.kind)) {
      map.set(alert.kind, []);
      order.push(alert.kind);
    }
    map.get(alert.kind)!.push(alert);
  }
  return order.map((kind) => ({ kind, alerts: map.get(kind)! }));
}
