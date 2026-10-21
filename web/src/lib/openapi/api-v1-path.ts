/** Platform / auth OpenAPI v1 path prefixes. */

export const API_V1_PREFIX = '/api/v1';

export const API_V1_AUTH_PREFIX = `${API_V1_PREFIX}/auth`;

export function platformV1Path(subpath: string): string {
  const segment = subpath.replace(/^\//, '');
  return segment ? `${API_V1_PREFIX}/${segment}` : API_V1_PREFIX;
}

export function authV1Path(subpath: string): string {
  return platformV1Path(`auth/${subpath.replace(/^\//, '')}`);
}
