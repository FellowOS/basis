import { kbPath } from '@/lib/nav-config.js';

export type GraphEvidenceLink = {
  kind: 'sources-doc' | 'sources-chunk' | 'search';
  to: string;
};

function pickString(
  properties: Record<string, unknown> | undefined,
  keys: string[],
): string | null {
  if (!properties) return null;
  for (const key of keys) {
    const value = properties[key];
    if (typeof value === 'string' && value.trim()) return value.trim();
  }
  return null;
}

/** Deep links from a graph node to Sema knowledge UI (sources / search). */
export function resolveGraphNodeEvidenceLinks(
  kbId: string,
  nodeId: string,
  nodeType?: string | null,
  properties?: Record<string, unknown>,
): GraphEvidenceLink[] {
  const links: GraphEvidenceLink[] = [];
  const seen = new Set<string>();
  const type = (nodeType ?? '').toLowerCase();

  const chunkId = pickString(properties, [
    'chunk_id',
    'evidence_chunk_id',
    'chunkId',
  ]);
  const docId = pickString(properties, [
    'doc_id',
    'document_id',
    'doc_ref',
    'external_key',
    'docId',
  ]);

  const add = (link: GraphEvidenceLink) => {
    if (seen.has(link.to)) return;
    seen.add(link.to);
    links.push(link);
  };

  if (chunkId) {
    add({
      kind: 'sources-chunk',
      to: `${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(chunkId)}`,
    });
  }
  if (docId) {
    add({
      kind: 'sources-doc',
      to: `${kbPath(kbId, 'sources')}?doc=${encodeURIComponent(docId)}`,
    });
  }

  if (!chunkId && !docId) {
    if (type.includes('chunk')) {
      add({
        kind: 'sources-chunk',
        to: `${kbPath(kbId, 'sources')}?chunk=${encodeURIComponent(nodeId)}`,
      });
    } else if (type.includes('doc') || type === 'document') {
      add({
        kind: 'sources-doc',
        to: `${kbPath(kbId, 'sources')}?doc=${encodeURIComponent(nodeId)}`,
      });
    }
  }

  if (links.length === 0 && nodeId.trim()) {
    add({
      kind: 'search',
      to: `${kbPath(kbId, 'search')}?q=${encodeURIComponent(nodeId)}`,
    });
  }

  return links;
}
