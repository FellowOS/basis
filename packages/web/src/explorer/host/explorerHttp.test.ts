import { beforeEach, describe, expect, it } from 'vitest';

import {
  buildExplorerGraphApiPath,
  buildExplorerKbApiPath,
  resolveExplorerApiUrl,
  setActiveExplorerHttpConfig,
} from './explorerHttp.js';

describe('explorerHttp KB injection (§9.6)', () => {
  const kbId = 'kb-test-uuid';

  beforeEach(() => {
    setActiveExplorerHttpConfig({ apiRoot: `/api/kbs/${kbId}` });
  });

  it('buildExplorerGraphApiPath scopes graph routes under the KB', () => {
    expect(buildExplorerGraphApiPath('snapshot', kbId)).toBe(
      `/api/kbs/${kbId}/graph/snapshot`,
    );
    expect(buildExplorerGraphApiPath('stats', kbId)).toBe(`/api/kbs/${kbId}/graph/stats`);
    expect(buildExplorerGraphApiPath('search', kbId)).toBe(`/api/kbs/${kbId}/graph/search`);
  });

  it('buildExplorerKbApiPath uses apiRoot when kbId is omitted', () => {
    expect(buildExplorerKbApiPath('realtime-ticket')).toBe(`/api/kbs/${kbId}/realtime-ticket`);
  });

  it('resolveExplorerApiUrl rewrites standalone Explorer /api/graph paths', () => {
    expect(resolveExplorerApiUrl('/api/graph/stats')).toBe(`/api/kbs/${kbId}/graph/stats`);
    expect(resolveExplorerApiUrl('/api/graph/nodes?limit=200')).toBe(
      `/api/kbs/${kbId}/graph/nodes?limit=200`,
    );
  });

  it('does not double-rewrite already KB-scoped paths', () => {
    expect(resolveExplorerApiUrl('/api/kbs/other-kb/graph/stats')).toBe(
      '/api/kbs/other-kb/graph/stats',
    );
  });
});
