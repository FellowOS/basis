import { describe, expect, it } from 'vitest';
import { kbReviewDecisionPath, kbReviewItemPath, parseReviewUrlState } from '@/lib/reviewUrlState.js';

describe('reviewUrlState', () => {
  it('parses review item id', () => {
    const state = parseReviewUrlState('?reviewItem=item-42');
    expect(state.reviewItemId).toBe('item-42');
  });

  it('builds review item path', () => {
    const href = kbReviewItemPath('kb-1', 'item-42');
    expect(href).toBe('/kbs/kb-1/review?reviewItem=item-42');
  });

  it('builds decision deep link path', () => {
    expect(kbReviewDecisionPath('kb-1', 'dec-1')).toBe(
      '/kbs/kb-1/decisions?decision=dec-1',
    );
  });
});
