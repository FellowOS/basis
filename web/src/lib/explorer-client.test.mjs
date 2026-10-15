import assert from 'node:assert/strict';

/** Mirrors ExplorerClient.path — run: node web/src/lib/explorer-client.test.mjs */
function pathForKb(kbId, subpath) {
  const suffix = subpath.startsWith('/') ? subpath : `/${subpath}`;
  if (!suffix.startsWith('/api/')) {
    return `/api/kbs/${kbId}${suffix}`;
  }
  return suffix;
}

const kb = 'kb-uuid-123';
assert.equal(pathForKb(kb, 'graph/stats'), '/api/kbs/kb-uuid-123/graph/stats');
assert.equal(pathForKb(kb, '/documents'), '/api/kbs/kb-uuid-123/documents');
assert.equal(
  pathForKb(kb, `graph/nodes/${encodeURIComponent('a/b')}/neighbors`),
  '/api/kbs/kb-uuid-123/graph/nodes/a%2Fb/neighbors',
);
console.log('explorer-client path tests ok');
