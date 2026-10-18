import { describe, expect, it } from 'vitest';
import {
  kbIngestSourcePath,
  kbSourcesDocumentPath,
  kbSourcesProcessPath,
  parseSourcesUrlState,
} from '@/lib/sourcesUrlState.js';

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

  it('parses document focus and process dialog flags', () => {
    expect(parseSourcesUrlState('?doc=paper-1').docId).toBe('paper-1');
    expect(parseSourcesUrlState('?version=v-1').openProcessDialog).toBe(false);
    expect(parseSourcesUrlState('?version=v-1&process=1').openProcessDialog).toBe(true);
  });

  it('builds document and process deep links', () => {
    expect(kbSourcesDocumentPath('kb-1', 'doc-a')).toBe('/kbs/kb-1/sources?doc=doc-a');
    expect(kbSourcesProcessPath('kb-1', 'ver-1')).toBe(
      '/kbs/kb-1/sources?version=ver-1&process=1',
    );
  });
});
