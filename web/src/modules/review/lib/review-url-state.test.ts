import { describe, expect, it } from 'vitest';
import {
  auditEventMatchesReviewItem,
  decisionIdFromApproveResponse,
  decisionIdFromDetail,
  reviewDecisionPath,
  reviewItemPath,
  mergeKbDecisionParam,
  parseDecisionUrlState,
  parseReviewUrlState,
} from '@/modules/review/lib/review-url-state.js';

describe('reviewUrlState', () => {
  it('parses review item id', () => {
    const state = parseReviewUrlState('?reviewItem=item-42');
    expect(state.reviewItemId).toBe('item-42');
  });

  it('builds review item path', () => {
    const href = reviewItemPath('kb-1', 'item-42');
    expect(href).toBe('/workspaces/kb-1/review?reviewItem=item-42');
  });

  it('builds decision deep link path', () => {
    expect(reviewDecisionPath('kb-1', 'dec-1')).toBe(
      '/workspaces/kb-1/decisions?decision=dec-1',
    );
  });

  it('parses decision url state', () => {
    expect(parseDecisionUrlState('?decision=dec-9&q=merge').decisionId).toBe('dec-9');
  });

  it('merges decision param', () => {
    const next = mergeKbDecisionParam('q=merge', 'dec-2');
    expect(next.get('q')).toBe('merge');
    expect(next.get('decision')).toBe('dec-2');
  });

  it('extracts decision_id from detail', () => {
    expect(decisionIdFromDetail({ decision_id: 'dec-1' })).toBe('dec-1');
    expect(decisionIdFromDetail({ extra: { decision_id: 'dec-2' } })).toBe('dec-2');
  });

  it('reads decision_id from approve response body', () => {
    expect(decisionIdFromApproveResponse({ item: {}, decision_id: 'dec-3' })).toBe('dec-3');
  });

  it('matches audit rows to review item id', () => {
    expect(auditEventMatchesReviewItem({ item_id: 'ri-1' }, 'ri-1')).toBe(true);
    expect(auditEventMatchesReviewItem({ review_item_id: 'ri-2' }, 'ri-2')).toBe(true);
    expect(auditEventMatchesReviewItem({ item_id: 'other' }, 'ri-1')).toBe(false);
  });
});
