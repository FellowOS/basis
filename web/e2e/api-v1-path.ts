/** OpenAPI v1 paths for Playwright request helpers (mirrors `src/lib/kb-api-path.ts`). */

export const E2E_KBS_COLLECTION = '/api/v1/kbs';

export function e2eKbPath(kbId: string, subpath?: string): string {
  const root = `/api/v1/kbs/${encodeURIComponent(kbId)}`;
  if (!subpath) {
    return root;
  }
  return `${root}/${subpath.replace(/^\//, '')}`;
}
