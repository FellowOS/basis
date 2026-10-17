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

  it('maps legacy tab param when building paths', () => {
    const href = kbSearchPath('kb-1', { tab: 'chunks', q: 'x' });
    expect(href).toContain('scope=chunks');
    expect(href).toContain('q=x');
  });
});
