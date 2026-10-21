import { type ApiErrorWithMeta, errorFromApiResponse } from '@/lib/errors/api-error.js';

type OpenApiResult<T> = {
  data?: T;
  error?: unknown;
  response: Response;
};

/** Map `openapi-fetch` results to the same errors as `api()`. */
export function unwrapOpenApi<T>(result: OpenApiResult<T>): T {
  if (result.error !== undefined) {
    throw errorFromApiResponse(result.response.status, result.error) as ApiErrorWithMeta;
  }
  return result.data as T;
}
