import { describe, expect, it } from 'vitest';

import {
  findRememberReviewItemIdInToolTraces,
  parseRememberReviewItemId,
} from '@/lib/kb-chat-playground/remember-review-link.js';

describe('parseRememberReviewItemId', () => {
  it('reads review_item_id from object', () => {
    expect(parseRememberReviewItemId({ review_item_id: 'ri-1', status: 'pending' })).toBe('ri-1');
  });

  it('reads from JSON string', () => {
    expect(parseRememberReviewItemId(JSON.stringify({ review_item_id: 'ri-2' }))).toBe('ri-2');
  });
});

describe('findRememberReviewItemIdInToolTraces', () => {
  it('finds propose_remember trace', () => {
    const id = findRememberReviewItemIdInToolTraces([
      {
        name: 'search_chunks',
        arguments: {},
        result: '{}',
      },
      {
        name: 'propose_remember',
        arguments: { content: 'x' },
        result: JSON.stringify({ review_item_id: 'ri-9' }),
      },
    ]);
    expect(id).toBe('ri-9');
  });
});
