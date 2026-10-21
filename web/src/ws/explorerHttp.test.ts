import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { kbApiRoot } from '@/lib/kb-api-path.js';

import {
  buildExplorerGraphApiPath,
  buildExplorerKbApiPath,
  explorerFetchJson,
  resolveExplorerApiUrl,
  setActiveExplorerHttpConfig,
} from './explorerHttp.js';

const kbId = 'kb-test-uuid';
const root = kbApiRoot(kbId);

describe('explorerHttp KB injection (§9.6)', () => {

  beforeEach(() => {
    setActiveExplorerHttpConfig({ apiRoot: root });
  });

  it('buildExplorerGraphApiPath scopes graph routes under the KB', () => {
    expect(buildExplorerGraphApiPath('snapshot', kbId)).toBe(`${root}/graph/snapshot`);
    expect(buildExplorerGraphApiPath('stats', kbId)).toBe(`${root}/graph/stats`);
    expect(buildExplorerGraphApiPath('search', kbId)).toBe(`${root}/graph/search`);
  });

  it('buildExplorerKbApiPath uses apiRoot when kbId is omitted', () => {
    expect(buildExplorerKbApiPath('realtime-ticket')).toBe(`${root}/realtime-ticket`);
  });

  it('resolveExplorerApiUrl rewrites standalone Explorer /api/graph paths', () => {
    expect(resolveExplorerApiUrl('/api/graph/stats')).toBe(`${root}/graph/stats`);
    expect(resolveExplorerApiUrl('/api/graph/nodes?limit=200')).toBe(
      `${root}/graph/nodes?limit=200`,
    );
  });

  it('does not double-rewrite already KB-scoped paths', () => {
    expect(resolveExplorerApiUrl('/api/v1/kbs/other-kb/graph/stats')).toBe(
      '/api/v1/kbs/other-kb/graph/stats',
    );
  });

  it('rejects legacy /api paths without KB host context', () => {
    setActiveExplorerHttpConfig({});
    expect(() => buildExplorerKbApiPath('graph/stats')).toThrow(/knowledge base/i);
    expect(() => resolveExplorerApiUrl('/api/graph/stats')).toThrow(/knowledge base/i);
  });
});

describe('explorerFetchJson', () => {
  beforeEach(() => {
    setActiveExplorerHttpConfig({ apiRoot: root });
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    setActiveExplorerHttpConfig({});
  });

  it('throws coded errors from API detail', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ detail: { code: 'not_found', message: 'x' } }), {
          status: 404,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    await expect(explorerFetchJson('/api/graph/stats')).rejects.toMatchObject({
      code: 'not_found',
    });
  });

  it('returns JSON on success', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () =>
        new Response(JSON.stringify({ node_count: 3 }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        }),
      ),
    );
    const data = await explorerFetchJson<{ node_count: number }>('/api/graph/stats');
    expect(data.node_count).toBe(3);
  });
});
