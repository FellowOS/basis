import { kbPath } from '@/lib/nav-config.js';

const CONNECTORS_PARAM = 'connectors';
const INGEST_SOURCE_PARAM = 'ingestSource';
const DOC_PARAM = 'doc';
const VERSION_PARAM = 'version';
const PROCESS_PARAM = 'process';

export function parseSourcesUrlState(search: string): {
  openConnectors: boolean;
  ingestSourceId?: string;
  docId?: string;
  versionId?: string;
  openProcessDialog: boolean;
} {
  const params = new URLSearchParams(search);
  const sourceId = params.get(INGEST_SOURCE_PARAM)?.trim();
  const docId = params.get(DOC_PARAM)?.trim();
  const versionId = params.get(VERSION_PARAM)?.trim();
  return {
    openConnectors: params.get(CONNECTORS_PARAM) === '1',
    ingestSourceId: sourceId || undefined,
    docId: docId || undefined,
    versionId: versionId || undefined,
    openProcessDialog: params.get(PROCESS_PARAM) === '1' && Boolean(versionId),
  };
}

/** Highlight a document row on the sources library (F-SRC-08). */
export function kbSourcesDocumentPath(kbId: string, docId: string): string {
  const params = new URLSearchParams({ [DOC_PARAM]: docId });
  return `${kbPath(kbId, 'sources')}?${params.toString()}`;
}

/** Open the process dialog for a version (chunk/extract). */
export function kbSourcesProcessPath(kbId: string, versionId: string): string {
  const params = new URLSearchParams({
    [VERSION_PARAM]: versionId,
    [PROCESS_PARAM]: '1',
  });
  return `${kbPath(kbId, 'sources')}?${params.toString()}`;
}

/** Open ingest connectors dialog and focus a source row (e.g. from sync_failed alert). */
export function kbIngestSourcePath(kbId: string, sourceId: string): string {
  const params = new URLSearchParams({
    [CONNECTORS_PARAM]: '1',
    [INGEST_SOURCE_PARAM]: sourceId,
  });
  return `${kbPath(kbId, 'sources')}?${params.toString()}`;
}
