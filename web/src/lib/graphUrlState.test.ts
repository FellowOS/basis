import { describe, expect, it } from 'vitest';
import { kbGraphPath, mergeKbGraphAtParam, parseKbGraphUrlState } from '@/lib/graphUrlState.js';

describe('graphUrlState', () => {
  it('builds focus + at links', () => {
    expect(kbGraphPath('kb-1', { focus: 'n1', at: '2026-01-01' })).toBe(
      '/kbs/kb-1/graph?focus=n1&at=2026-01-01',
    );
  });

  it('builds timeline entry links', () => {
    expect(kbGraphPath('kb-1', { timeline: true })).toBe('/kbs/kb-1/graph?timeline=1');
    expect(parseKbGraphUrlState('?timeline=1').timeline).toBe(true);
  });

  it('parses at from query', () => {
    expect(parseKbGraphUrlState('?focus=a&at=2030-01-01T00:00:00Z').at).toBe('2030-01-01T00:00:00Z');
  });

  it('merges at while preserving focus', () => {
    const next = mergeKbGraphAtParam('focus=node-1', '2030-06-01T00:00:00Z');
    expect(next.get('focus')).toBe('node-1');
    expect(next.get('at')).toBe('2030-06-01T00:00:00Z');
    expect(next.get('timeline')).toBe('1');
  });
});
