import { describe, expect, it } from 'vitest';
import { searchPath, parseSearchUrlState, resolveSearchScope } from '@/lib/searchUrlState.js';

describe('searchUrlState', () => {
  it('parses legacy tab and maps scope=all to documents', () => {
    const legacy = parseSearchUrlState('?tab=graph&q=smoke');
    expect(legacy.scope).toBe('graph');
    expect(legacy.q).toBe('smoke');

    expect(resolveSearchScope('all', null)).toBe('chunks');
    const modern = parseSearchUrlState('?scope=all&q=test');
    expect(modern.scope).toBe('chunks');
  });

  it('builds shareable search paths', () => {
    const href = searchPath('kb-1', { scope: 'graph', q: 'node' });
    expect(href).toBe('/workspaces/kb-1/search?scope=graph&q=node');
  });

  it('round-trips temporal query params', () => {
    const href = searchPath('kb-1', {
      scope: 'chunks',
      q: 'x',
      asOf: '2030-01-01T00:00:00Z',
      at: '2030-06-01T00:00:00Z',
    });
    const parsed = parseSearchUrlState(href.split('?')[1] ?? '');
    expect(parsed.asOf).toBe('2030-01-01T00:00:00Z');
    expect(parsed.at).toBe('2030-06-01T00:00:00Z');
  });

  it('maps legacy tab param when building paths', () => {
    const href = searchPath('kb-1', { tab: 'chunks', q: 'x' });
    expect(href).toContain('scope=chunks');
    expect(href).toContain('q=x');
  });
});
