import { basisSessionClient } from '@/lib/basis-session-client.js';

/** Session-authenticated workspace client (OpenAPI v1 paths). */
export function workspaceApiClient(workspaceId: string) {
  return basisSessionClient().kb(workspaceId);
}
