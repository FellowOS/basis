import { basisSessionClient } from '@/lib/basis-session-client.js';

/** Session-authenticated KB client (OpenAPI v1 paths). */
export function kbApiClient(kbId: string) {
  return basisSessionClient().kb(kbId);
}
