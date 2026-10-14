import { describe, expect, it } from 'vitest';

import { resolveGraphNodeEvidenceLinks } from './graph-evidence-links.js';

describe('resolveGraphNodeEvidenceLinks', () => {
  const kbId = 'kb-1';

  it('links document nodes by id and type', () => {
    const links = resolveGraphNodeEvidenceLinks(kbId, 'snap-doc', 'document', {});
    expect(links.some((l) => l.kind === 'sources-doc' && l.to.includes('doc=snap-doc'))).toBe(true);
  });

  it('prefers chunk property over search fallback', () => {
    const links = resolveGraphNodeEvidenceLinks(kbId, 'node-1', 'Entity', {
      chunk_id: 'chunk-abc',
    });
    expect(links).toHaveLength(1);
    expect(links[0].kind).toBe('sources-chunk');
    expect(links[0].to).toContain('chunk=chunk-abc');
  });

  it('falls back to search when no evidence fields', () => {
    const links = resolveGraphNodeEvidenceLinks(kbId, 'opaque-id', 'Entity', {});
    expect(links).toHaveLength(1);
    expect(links[0].kind).toBe('search');
    expect(links[0].to).toContain('q=opaque-id');
  });
});
