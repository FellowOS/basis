import { describe, expect, it } from 'vitest';

import { isWorkspaceScopedApiPath, workspaceApiPath, workspaceApiRoot } from '@/lib/explorer/api-path.js';

describe('workspaceApiPath', () => {
  it('builds v1 workspace roots and subpaths', () => {
    expect(workspaceApiRoot('kb-1')).toBe('/api/v1/workspaces/kb-1');
    expect(workspaceApiPath('kb-1', 'search/config')).toBe('/api/v1/workspaces/kb-1/search/config');
  });

  it('detects scoped paths', () => {
    expect(isWorkspaceScopedApiPath('/api/v1/workspaces/x/graph/stats')).toBe(true);
    expect(isWorkspaceScopedApiPath('/api/workspaces/x/graph/stats')).toBe(false);
    expect(isWorkspaceScopedApiPath('/api/graph/stats')).toBe(false);
  });
});
