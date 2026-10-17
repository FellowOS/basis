import { createBasisPublicOpenApiClient } from '@basis/client';

import { basisApiBaseUrl } from '@/lib/basis-api-url.js';
import { basisSessionClient } from '@/lib/basis-session-client.js';
import { unwrapOpenApi } from '@/lib/openapi-response.js';
import { ensureRequestIdHeader } from '@/lib/request-id.js';

let _publicOpenApi: ReturnType<typeof createBasisPublicOpenApiClient> | null = null;

/** Unauthenticated OpenAPI client (login providers, magic-link, …). */
export function publicOpenApi() {
  if (!_publicOpenApi) {
    _publicOpenApi = createBasisPublicOpenApiClient({
      baseUrl: basisApiBaseUrl(),
      beforeRequest: ensureRequestIdHeader,
    });
  }
  return _publicOpenApi;
}

/** Session-authenticated typed OpenAPI client (`openapi-fetch`). */
export function openApi() {
  return basisSessionClient().openapi();
}

type OpenApiInit = {
  params?: {
    path?: Record<string, string>;
    query?: Record<string, unknown>;
  };
  body?: unknown;
};

export async function openApiGET<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await openApi().GET(path as never, init as never),
  ) as T;
}

export async function openApiPOST<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await openApi().POST(path as never, init as never),
  ) as T;
}

export async function openApiPUT<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await openApi().PUT(path as never, init as never),
  ) as T;
}

export async function openApiPATCH<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await openApi().PATCH(path as never, init as never),
  ) as T;
}

export async function openApiDELETE(path: string, init?: OpenApiInit): Promise<void> {
  unwrapOpenApi(await openApi().DELETE(path as never, init as never));
}

export async function publicOpenApiGET<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await publicOpenApi().GET(path as never, init as never),
  ) as T;
}

export async function publicOpenApiPOST<T>(path: string, init?: OpenApiInit): Promise<T> {
  return unwrapOpenApi(
    await publicOpenApi().POST(path as never, init as never),
  ) as T;
}

function kbOpenApiPath(suffix: string): string {
  const segment = suffix.replace(/^\//, '');
  return segment ? `/api/v1/kbs/{kb_id}/${segment}` : `/api/v1/kbs/{kb_id}`;
}

function kbOpenApiInit(kbId: string, suffix: string, init?: OpenApiInit): OpenApiInit {
  return {
    ...init,
    params: {
      ...init?.params,
      path: { kb_id: kbId, ...(init?.params?.path ?? {}) },
    },
  };
}

/** KB sub-route: `/api/v1/kbs/{kb_id}/<suffix>` with path param binding. */
export async function kbOpenApiGET<T>(
  kbId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiGET<T>(kbOpenApiPath(suffix), kbOpenApiInit(kbId, suffix, init));
}

export async function kbOpenApiPOST<T>(
  kbId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPOST<T>(kbOpenApiPath(suffix), kbOpenApiInit(kbId, suffix, init));
}

export async function kbOpenApiPUT<T>(
  kbId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPUT<T>(kbOpenApiPath(suffix), kbOpenApiInit(kbId, suffix, init));
}

export async function kbOpenApiPATCH<T>(
  kbId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPATCH<T>(kbOpenApiPath(suffix), kbOpenApiInit(kbId, suffix, init));
}

export async function kbOpenApiDELETE(
  kbId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<void> {
  return openApiDELETE(kbOpenApiPath(suffix), kbOpenApiInit(kbId, suffix, init));
}
