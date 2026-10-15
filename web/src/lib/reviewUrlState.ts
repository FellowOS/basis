import { kbPath } from '@/lib/nav-config.js';

/** Sole owner of review queue deep-link query params. */
const ITEM_PARAM = 'reviewItem';

export function parseReviewUrlState(search: string): { reviewItemId?: string } {
  const params = new URLSearchParams(search);
  return {
    reviewItemId: params.get(ITEM_PARAM) ?? undefined,
  };
}

/** Deep-link to the review queue with a specific item in view (F-GOV / F-ALT). */
export function kbReviewItemPath(kbId: string, itemId: string): string {
  const params = new URLSearchParams({ [ITEM_PARAM]: itemId });
  return `${kbPath(kbId, 'review')}?${params.toString()}`;
}

/** Deep-link to Decisions workspace with causal chain loaded (F-GOV-07). */
export function kbReviewDecisionPath(kbId: string, decisionId: string): string {
  const params = new URLSearchParams({ decision: decisionId });
  return `${kbPath(kbId, 'decisions')}?${params.toString()}`;
}
