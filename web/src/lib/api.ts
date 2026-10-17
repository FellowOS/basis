import { type ApiErrorWithMeta } from '@/lib/api-error.js';
import { getToken, setToken } from '@/lib/auth-token.js';
import { basisSessionClient } from '@/lib/basis-session-client.js';
import { unwrapOpenApi } from '@/lib/openapi-response.js';

export { getToken, setToken } from '@/lib/auth-token.js';

export type BasisUser = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

export async function fetchSession(): Promise<BasisUser | null> {
  const token = getToken();
  if (!token) return null;
  try {
    const body = unwrapOpenApi(
      await basisSessionClient().openapi().GET('/api/v1/auth/me'),
    ) as { user: BasisUser };
    return body.user;
  } catch (err) {
    const status = (err as ApiErrorWithMeta).status;
    if (status === 401 || status === 403) {
      setToken(null);
    }
    return null;
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: BasisUser; token: string }> {
  const body = unwrapOpenApi(
    await basisSessionClient().openapi().POST('/api/v1/auth/login', {
      body: { email: input.email, password: input.password },
    }),
  ) as { user: BasisUser; token: string };
  setToken(body.token);
  return body;
}

export async function register(input: {
  email: string;
  password: string;
  display_name: string;
}): Promise<{ user: BasisUser; token: string }> {
  const body = unwrapOpenApi(
    await basisSessionClient().openapi().POST('/api/v1/auth/register', {
      body: input,
    }),
  ) as { user: BasisUser; token: string };
  setToken(body.token);
  return body;
}

export async function logout(): Promise<void> {
  try {
    unwrapOpenApi(await basisSessionClient().openapi().POST('/api/v1/auth/logout'));
  } finally {
    setToken(null);
  }
}
