import { createBasisSessionClient } from '@/lib/basis-openapi/transport.js';

import { basisApiBaseUrl } from '@/lib/basis-api-url.js';
import { getToken } from '@/lib/auth-token.js';
import { ensureRequestIdHeader } from '@/lib/request-id.js';

let _client: ReturnType<typeof createBasisSessionClient> | null = null;
let _clientBaseUrl: string | null = null;

export function basisSessionClient() {
  const baseUrl = basisApiBaseUrl();
  if (!_client || _clientBaseUrl !== baseUrl) {
    _clientBaseUrl = baseUrl;
    _client = createBasisSessionClient({
      baseUrl,
      getAccessToken: getToken,
      beforeRequest: ensureRequestIdHeader,
    });
  }
  return _client;
}
