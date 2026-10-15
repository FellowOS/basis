import { kbPath } from '@/lib/nav-config.js';

const CONNECTORS_PARAM = 'connectors';
const INGEST_SOURCE_PARAM = 'ingestSource';

export function parseSourcesUrlState(search: string): {
  openConnectors: boolean;
  ingestSourceId?: string;
} {
  const params = new URLSearchParams(search);
  const sourceId = params.get(INGEST_SOURCE_PARAM)?.trim();
  return {
    openConnectors: params.get(CONNECTORS_PARAM) === '1',
    ingestSourceId: sourceId || undefined,
  };
}

/** Open ingest connectors dialog and focus a source row (e.g. from sync_failed alert). */
export function kbIngestSourcePath(kbId: string, sourceId: string): string {
  const params = new URLSearchParams({
    [CONNECTORS_PARAM]: '1',
    [INGEST_SOURCE_PARAM]: sourceId,
  });
  return `${kbPath(kbId, 'sources')}?${params.toString()}`;
}
