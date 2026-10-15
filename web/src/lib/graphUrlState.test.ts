import { describe, expect, it } from 'vitest';
import { kbGraphPath, parseKbGraphUrlState } from '@/lib/graphUrlState.js';

describe('graphUrlState', () => {
  it('builds focus + at links', () => {
    expect(kbGraphPath('kb-1', { focus: 'n1', at: '2026-01-01' })).toBe(
      '/kbs/kb-1/graph?focus=n1&at=2026-01-01',
    );
  });

  it('parses at from query', () => {
    expect(parseKbGraphUrlState('?focus=a&at=2030-01-01T00:00:00Z').at).toBe('2030-01-01T00:00:00Z');
  });
});
