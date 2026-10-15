import { kbPath } from '@/lib/nav-config.js';

/** Sole owner of review workspace deep-link query params. */
const TAB_PARAM = 'tab';
const ITEM_PARAM = 'reviewItem';
const QUEUE_TAB = 'queue';

export function parseReviewUrlState(search: string): { tab?: string; reviewItemId?: string } {
  const params = new URLSearchParams(search);
  return {
    tab: params.get(TAB_PARAM) ?? undefined,
    reviewItemId: params.get(ITEM_PARAM) ?? undefined,
  };
}

/** Deep-link to the review queue with a specific item in view (F-GOV / F-ALT). */
export function kbReviewItemPath(kbId: string, itemId: string): string {
  const params = new URLSearchParams({
    [TAB_PARAM]: QUEUE_TAB,
    [ITEM_PARAM]: itemId,
  });
  return `${kbPath(kbId, 'review')}?${params.toString()}`;
}
