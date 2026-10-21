import assert from 'node:assert/strict';

/** Mirrors WorkspaceWsClient.path — run: npm run test:workspace-ws-client */
function pathForKb(workspaceId, subpath) {
  const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
  const suffix = subpath.startsWith('/') ? subpath : `/${subpath}`;
  if (!suffix.startsWith('/api/')) {
    return `${root}${suffix}`;
  }
  return suffix;
}

const kb = 'kb-uuid-123';
assert.equal(pathForKb(kb, 'graph/stats'), '/api/v1/workspaces/kb-uuid-123/graph/stats');
assert.equal(pathForKb(kb, '/documents'), '/api/v1/workspaces/kb-uuid-123/documents');
assert.equal(
  pathForKb(kb, `graph/nodes/${encodeURIComponent('a/b')}/neighbors`),
  '/api/v1/workspaces/kb-uuid-123/graph/nodes/a%2Fb/neighbors',
);
console.log('workspace-ws-client path tests ok');
