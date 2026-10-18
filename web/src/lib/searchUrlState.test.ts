import { describe, expect, it } from 'vitest';
import { kbSearchPath, parseKbSearchUrlState, resolveKbSearchScope } from '@/lib/searchUrlState.js';

describe('searchUrlState', () => {
  it('parses legacy tab and maps scope=all to documents', () => {
    const legacy = parseKbSearchUrlState('?tab=graph&q=smoke');
    expect(legacy.scope).toBe('graph');
    expect(legacy.q).toBe('smoke');

    expect(resolveKbSearchScope('all', null)).toBe('chunks');
    const modern = parseKbSearchUrlState('?scope=all&q=test');
    expect(modern.scope).toBe('chunks');
  });

  it('builds shareable search paths', () => {
    const href = kbSearchPath('kb-1', { scope: 'graph', q: 'node' });
    expect(href).toBe('/kbs/kb-1/search?scope=graph&q=node');
  });

  it('round-trips temporal query params', () => {
    const href = kbSearchPath('kb-1', {
      scope: 'chunks',
      q: 'x',
      asOf: '2030-01-01T00:00:00Z',
      at: '2030-06-01T00:00:00Z',
    });
    const parsed = parseKbSearchUrlState(href.split('?')[1] ?? '');
    expect(parsed.asOf).toBe('2030-01-01T00:00:00Z');
    expect(parsed.at).toBe('2030-06-01T00:00:00Z');
  });

  it('maps legacy tab param when building paths', () => {
    const href = kbSearchPath('kb-1', { tab: 'chunks', q: 'x' });
    expect(href).toContain('scope=chunks');
    expect(href).toContain('q=x');
  });
});
