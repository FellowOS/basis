import { describe, expect, it } from 'vitest';
import { kbSearchPath, parseKbSearchUrlState } from '@/lib/searchUrlState.js';

describe('searchUrlState', () => {
  it('parses graph tab and as_of', () => {
    const state = parseKbSearchUrlState('?tab=graph&q=smoke&as_of=2030-01-01T00:00:00Z');
    expect(state.tab).toBe('graph');
    expect(state.q).toBe('smoke');
    expect(state.as_of).toBe('2030-01-01T00:00:00Z');
  });

  it('builds shareable search paths', () => {
    const href = kbSearchPath('kb-1', {
      tab: 'graph',
      q: 'node',
      as_of: '2026-01-01',
    });
    expect(href).toBe('/kbs/kb-1/search?tab=graph&q=node&as_of=2026-01-01');
  });
});
