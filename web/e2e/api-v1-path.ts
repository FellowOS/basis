/** OpenAPI v1 paths for Playwright request helpers (mirrors `src/lib/explorer/api-path.ts`). */

/** Basis API origin for `page.request` (bypasses Vite when a reused dev server has no `/api` proxy). */
export function e2eApiBaseUrl(): string {
  const fromEnv = process.env.BASIS_E2E_API_URL?.replace(/\/$/, '');
  if (fromEnv) {
    return fromEnv;
  }
  const port = process.env.BASIS_E2E_API_PORT ?? '8091';
  return `http://127.0.0.1:${port}`;
}

export const E2E_WORKSPACES_COLLECTION = '/api/v1/workspaces';

export function e2eWorkspaceApiPath(workspaceId: string, subpath?: string): string {
  const root = `/api/v1/workspaces/${encodeURIComponent(workspaceId)}`;
  const path = !subpath ? root : `${root}/${subpath.replace(/^\//, '')}`;
  return `${e2eApiBaseUrl()}${path}`;
}
