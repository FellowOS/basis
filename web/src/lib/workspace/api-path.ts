/** Workspace HTTP base path (OpenAPI v1). */

export const WORKSPACES_API_V1_PREFIX = '/api/v1/workspaces';

/** `GET/POST /api/v1/workspaces` — workspace collection (platform session). */
export const platformWorkspacesCollectionPath = WORKSPACES_API_V1_PREFIX;

export function workspaceApiRoot(workspaceId: string): string {
  return `${WORKSPACES_API_V1_PREFIX}/${encodeURIComponent(workspaceId)}`;
}

/** `/api/v1/workspaces/{id}/{subpath}` — subpath without leading slash. */
export function workspaceApiPath(workspaceId: string, subpath: string): string {
  const segment = subpath.replace(/^\//, '');
  return segment ? `${workspaceApiRoot(workspaceId)}/${segment}` : workspaceApiRoot(workspaceId);
}

/** True when `path` is already scoped to a workspace under OpenAPI v1. */
export function isWorkspaceScopedApiPath(path: string): boolean {
  return path.startsWith(`${WORKSPACES_API_V1_PREFIX}/`);
}
