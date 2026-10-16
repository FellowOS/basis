import { errorFromApiResponse } from '@/lib/api-error.js';
import { ensureRequestIdHeader } from '@/lib/request-id.js';

const TOKEN_KEY = 'basis_token';

export function getToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function setToken(token: string | null): void {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* ignore */
  }
}

/** 所有请求只打 Basis API（Python，进程内使用 semantica SDK）。 */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers);
  ensureRequestIdHeader(headers);
  const token = getToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const response = await fetch(path, { ...init, headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw errorFromApiResponse(response.status, data);
  }
  return data as T;
}

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
    const body = await api<{ user: BasisUser }>('/api/auth/me');
    return body.user;
  } catch {
    setToken(null);
    return null;
  }
}

export async function login(input: {
  email: string;
  password: string;
}): Promise<{ user: BasisUser; token: string }> {
  const body = await api<{ user: BasisUser; token: string }>('/api/auth/login', {
    method: 'POST',
    body: JSON.stringify({ email: input.email, password: input.password }),
  });
  setToken(body.token);
  return body;
}

export async function register(input: {
  email: string;
  password: string;
  display_name: string;
}): Promise<{ user: BasisUser; token: string }> {
  const body = await api<{ user: BasisUser; token: string }>('/api/auth/register', {
    method: 'POST',
    body: JSON.stringify(input),
  });
  setToken(body.token);
  return body;
}

export async function logout(): Promise<void> {
  try {
    await api('/api/auth/logout', { method: 'POST' });
  } finally {
    setToken(null);
  }
}
