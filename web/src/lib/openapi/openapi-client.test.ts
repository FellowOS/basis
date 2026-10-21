import { beforeEach, describe, expect, it, vi } from 'vitest';

const createBasisPublicOpenApiClient = vi.fn(() => ({}));

vi.mock('@/lib/openapi/transport.js', () => ({
  createBasisPublicOpenApiClient: (opts: unknown) => createBasisPublicOpenApiClient(opts),
}));

vi.mock('@/lib/openapi/basis-api-url.js', () => ({
  basisApiBaseUrl: vi.fn(() => ''),
}));

vi.mock('@/lib/workspace/request-id.js', () => ({
  ensureRequestIdHeader: (headers: Headers) => headers,
}));

describe('publicOpenApi', () => {
  beforeEach(() => {
    vi.resetModules();
    createBasisPublicOpenApiClient.mockClear();
  });

  it('recreates the public client when api base changes', async () => {
    const { basisApiBaseUrl } = await import('@/lib/openapi/basis-api-url.js');
    vi.mocked(basisApiBaseUrl)
      .mockReturnValueOnce('')
      .mockReturnValueOnce('http://127.0.0.1:8090');

    const { publicOpenApi } = await import('@/lib/openapi/client.js');
    publicOpenApi();
    publicOpenApi();

    expect(createBasisPublicOpenApiClient).toHaveBeenCalledTimes(2);
    expect(createBasisPublicOpenApiClient).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ baseUrl: '' }),
    );
    expect(createBasisPublicOpenApiClient).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ baseUrl: 'http://127.0.0.1:8090' }),
    );
  });
});
