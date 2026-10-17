import { createBasisSessionClient } from '@basis/client';

import { basisApiBaseUrl } from '@/lib/basis-api-url.js';
import { getToken } from '@/lib/auth-token.js';
import { ensureRequestIdHeader } from '@/lib/request-id.js';

let _client: ReturnType<typeof createBasisSessionClient> | null = null;

export function basisSessionClient() {
  if (!_client) {
    _client = createBasisSessionClient({
      baseUrl: basisApiBaseUrl(),
      getAccessToken: getToken,
      beforeRequest: ensureRequestIdHeader,
    });
  }
  return _client;
}
