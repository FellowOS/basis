/** KB HTTP base path (OpenAPI v1). */

export const KB_API_V1_PREFIX = '/api/v1/kbs';

/** `GET/POST /api/v1/kbs` — KB collection (platform session). */
export const platformKbsCollectionPath = KB_API_V1_PREFIX;

export function kbApiRoot(kbId: string): string {
  return `${KB_API_V1_PREFIX}/${encodeURIComponent(kbId)}`;
}

/** `/api/v1/kbs/{id}/{subpath}` — subpath without leading slash. */
export function kbApiPath(kbId: string, subpath: string): string {
  const segment = subpath.replace(/^\//, '');
  return segment ? `${kbApiRoot(kbId)}/${segment}` : kbApiRoot(kbId);
}

/** True when `path` is already scoped to a KB under OpenAPI v1. */
export function isKbScopedApiPath(path: string): boolean {
  return path.startsWith(`${KB_API_V1_PREFIX}/`);
}
