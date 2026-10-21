import { basisSessionClient } from '@/lib/session/basis-session-client.js';

/** Resolve an OpenAPI path against `VITE_BASIS_API_URL` (or same-origin). */
export function basisApiUrl(path: string): string {
  return basisSessionClient().apiUrl(path);
}

/** Authenticated `fetch` with Bearer token, request ID, and API base URL. */
export function basisSessionFetch(path: string, init: RequestInit = {}): Promise<Response> {
  return basisSessionClient().sessionFetch(path, init);
}
