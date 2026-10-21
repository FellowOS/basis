import { describe, expect, it } from 'vitest';

import { basisApiUrl } from './basis-session-fetch.js';

describe('basisApiUrl', () => {
  it('joins absolute API paths', () => {
    expect(basisApiUrl('/api/v1/workspaces/kb-1/alerts')).toBe('/api/v1/workspaces/kb-1/alerts');
  });
});
