import { basisApiBaseUrl } from '@/lib/openapi/basis-api-url.js';

export type OpenApiSpecVariant = 'full' | 'platform' | 'workspaces';

const SPEC_PATH: Record<OpenApiSpecVariant, string> = {
  full: '/openapi/v1.json',
  platform: '/openapi/v1/platform.json',
  workspaces: '/openapi/v1/workspaces.json',
};

/** URL for served OpenAPI JSON (respects `VITE_BASIS_API_URL` when set). */
export function openapiSpecUrl(variant: OpenApiSpecVariant): string {
  const base = basisApiBaseUrl().replace(/\/$/, '');
  return `${base}${SPEC_PATH[variant]}`;
}
