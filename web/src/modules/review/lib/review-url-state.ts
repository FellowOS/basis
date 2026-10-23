import { workspacePath } from '@/lib/nav/nav-config.js';

/** Sole owner of review queue deep-link query params. */
const ITEM_PARAM = 'reviewItem';

export function parseReviewUrlState(search: string): { reviewItemId?: string } {
  const params = new URLSearchParams(search);
  return {
    reviewItemId: params.get(ITEM_PARAM) ?? undefined,
  };
}

/** Deep-link to the review queue with a specific item in view (F-GOV / F-ALT). */
export function reviewItemPath(workspaceId: string, itemId: string): string {
  const params = new URLSearchParams({ [ITEM_PARAM]: itemId });
  return `${workspacePath(workspaceId, 'review')}?${params.toString()}`;
}

/** Deep-link to Decisions workspace with causal chain loaded (F-GOV-07). */
export function reviewDecisionPath(workspaceId: string, decisionId: string): string {
  const params = new URLSearchParams({ decision: decisionId });
  return `${workspacePath(workspaceId, 'decisions')}?${params.toString()}`;
}

const DECISION_PARAM = 'decision';

export function parseDecisionUrlState(search: string): { decisionId?: string; q?: string } {
  const params = new URLSearchParams(search);
  return {
    decisionId: params.get(DECISION_PARAM) ?? undefined,
    q: params.get('q') ?? undefined,
  };
}

/** Sync decisions route `?decision=` while preserving other query params (e.g. `q`). */
export function mergeKbDecisionParam(
  search: string,
  decisionId: string | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams(search);
  const trimmed = decisionId?.trim();
  if (trimmed) params.set(DECISION_PARAM, trimmed);
  else params.delete(DECISION_PARAM);
  return params;
}

/** Extract Explorer governance decision id from audit/alert detail blobs. */
export function decisionIdFromApproveResponse(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null;
  return decisionIdFromDetail(body as Record<string, unknown>);
}

/** True when a graph audit row belongs to a review queue item (deep-link filter). */
export function auditEventMatchesReviewItem(
  detail: Record<string, unknown> | undefined,
  itemId: string,
): boolean {
  if (!detail || !itemId.trim()) return false;
  const id = itemId.trim();
  const direct = detail.item_id;
  if (typeof direct === 'string' && direct.trim() === id) return true;
  const reviewItemId = detail.review_item_id;
  if (typeof reviewItemId === 'string' && reviewItemId.trim() === id) return true;
  const payload = detail.payload;
  if (payload && typeof payload === 'object' && !Array.isArray(payload)) {
    const nested = (payload as Record<string, unknown>).review_item_id;
    if (typeof nested === 'string' && nested.trim() === id) return true;
  }
  return false;
}

export function decisionIdFromDetail(detail: Record<string, unknown> | undefined): string | null {
  if (!detail) return null;
  const direct = detail.decision_id;
  if (typeof direct === 'string' && direct.trim()) return direct.trim();
  const extra = detail.extra;
  if (extra && typeof extra === 'object' && !Array.isArray(extra)) {
    const nested = (extra as Record<string, unknown>).decision_id;
    if (typeof nested === 'string' && nested.trim()) return nested.trim();
  }
  return null;
}
