import { createBasisPublicOpenApiClient } from '@/lib/basis-openapi/transport.js';

import { basisApiBaseUrl } from '@/lib/basis-api-url.js';
import { basisSessionClient } from '@/lib/basis-session-client.js';
import { unwrapOpenApi } from '@/lib/openapi-response.js';
import { ensureRequestIdHeader } from '@/lib/request-id.js';

let _publicOpenApi: ReturnType<typeof createBasisPublicOpenApiClient> | null = null;
let _publicOpenApiBaseUrl: string | null = null;

/** Unauthenticated OpenAPI client (login providers, magic-link, …). */
export function publicOpenApi() {
  const baseUrl = basisApiBaseUrl();
  if (!_publicOpenApi || _publicOpenApiBaseUrl !== baseUrl) {
    _publicOpenApiBaseUrl = baseUrl;
    _publicOpenApi = createBasisPublicOpenApiClient({
      baseUrl,
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

function workspaceOpenApiPath(suffix: string): string {
  const segment = suffix.replace(/^\//, '');
  return segment ? `/api/v1/workspaces/{workspace_id}/${segment}` : `/api/v1/workspaces/{workspace_id}`;
}

function workspaceOpenApiInit(workspaceId: string, suffix: string, init?: OpenApiInit): OpenApiInit {
  return {
    ...init,
    params: {
      ...init?.params,
      path: { workspace_id: workspaceId, ...(init?.params?.path ?? {}) },
    },
  };
}

/** Workspace sub-route: `/api/v1/workspaces/{workspace_id}/<suffix>` with path param binding. */
export async function workspaceOpenApiGET<T>(
  workspaceId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiGET<T>(workspaceOpenApiPath(suffix), workspaceOpenApiInit(workspaceId, suffix, init));
}

export async function workspaceOpenApiPOST<T>(
  workspaceId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPOST<T>(workspaceOpenApiPath(suffix), workspaceOpenApiInit(workspaceId, suffix, init));
}

export async function workspaceOpenApiPUT<T>(
  workspaceId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPUT<T>(workspaceOpenApiPath(suffix), workspaceOpenApiInit(workspaceId, suffix, init));
}

export async function workspaceOpenApiPATCH<T>(
  workspaceId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<T> {
  return openApiPATCH<T>(workspaceOpenApiPath(suffix), workspaceOpenApiInit(workspaceId, suffix, init));
}

export async function workspaceOpenApiDELETE(
  workspaceId: string,
  suffix: string,
  init?: OpenApiInit,
): Promise<void> {
  return openApiDELETE(workspaceOpenApiPath(suffix), workspaceOpenApiInit(workspaceId, suffix, init));
}
