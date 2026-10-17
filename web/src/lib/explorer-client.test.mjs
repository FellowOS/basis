import assert from 'node:assert/strict';

/** Mirrors ExplorerClient.path — run: node web/src/lib/explorer-client.test.mjs */
function pathForKb(kbId, subpath) {
  const root = `/api/v1/kbs/${encodeURIComponent(kbId)}`;
  const suffix = subpath.startsWith('/') ? subpath : `/${subpath}`;
  if (!suffix.startsWith('/api/')) {
    return `${root}${suffix}`;
  }
  return suffix;
}

const kb = 'kb-uuid-123';
assert.equal(pathForKb(kb, 'graph/stats'), '/api/v1/kbs/kb-uuid-123/graph/stats');
assert.equal(pathForKb(kb, '/documents'), '/api/v1/kbs/kb-uuid-123/documents');
assert.equal(
  pathForKb(kb, `graph/nodes/${encodeURIComponent('a/b')}/neighbors`),
  '/api/v1/kbs/kb-uuid-123/graph/nodes/a%2Fb/neighbors',
);
console.log('explorer-client path tests ok');
