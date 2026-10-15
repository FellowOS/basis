import { describe, expect, it } from 'vitest';
import { kbIngestSourcePath, parseSourcesUrlState } from '@/lib/sourcesUrlState.js';

describe('sourcesUrlState', () => {
  it('parses connector deep link', () => {
    const state = parseSourcesUrlState('?connectors=1&ingestSource=src-9');
    expect(state.openConnectors).toBe(true);
    expect(state.ingestSourceId).toBe('src-9');
  });

  it('builds ingest source path', () => {
    expect(kbIngestSourcePath('kb-1', 'src-9')).toBe(
      '/kbs/kb-1/sources?connectors=1&ingestSource=src-9',
    );
  });
});
