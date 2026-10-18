import { describe, expect, it } from 'vitest';
import {
  clearKbGraphDiffPreviewParams,
  kbGraphDiffPreviewPath,
  kbGraphImportDialogPath,
  kbGraphPath,
  mergeKbGraphAtParam,
  parseKbGraphDiffPreviewParams,
  parseKbGraphUrlState,
} from '@/lib/graphUrlState.js';

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

  it('builds import dialog deep links', () => {
    expect(kbGraphImportDialogPath('kb-1')).toBe('/kbs/kb-1/graph?import=1');
  });

  it('builds diff preview canvas links', () => {
    expect(kbGraphDiffPreviewPath('kb-1', '2020-01-01', '2021-01-01')).toBe(
      '/kbs/kb-1/graph?at=2021-01-01&diff_from=2020-01-01&diff_to=2021-01-01',
    );
    expect(
      parseKbGraphDiffPreviewParams('?diff_from=a&diff_to=b&at=b')?.diffFrom,
    ).toBe('a');
    const cleared = clearKbGraphDiffPreviewParams('focus=n&diff_from=a&diff_to=b');
    expect(cleared.get('focus')).toBe('n');
    expect(cleared.has('diff_from')).toBe(false);
  });

  it('merges at while preserving focus', () => {
    const next = mergeKbGraphAtParam('focus=node-1', '2030-06-01T00:00:00Z');
    expect(next.get('focus')).toBe('node-1');
    expect(next.get('at')).toBe('2030-06-01T00:00:00Z');
  });
});
