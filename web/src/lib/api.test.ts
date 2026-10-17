import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSession, getToken, setToken } from './api.js';

function installLocalStorageMock() {
  const store = new Map<string, string>();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value);
    },
    removeItem: (key: string) => {
      store.delete(key);
    },
    clear: () => store.clear(),
    key: () => null,
    length: 0,
  });
}

describe('fetchSession', () => {
  beforeEach(() => {
    installLocalStorageMock();
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 401,
          json: () => Promise.resolve({ detail: 'Unauthorized' }),
        }),
      ),
    );
    setToken('session-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling the API when no token is stored', async () => {
    setToken(null);
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(fetch).not.toHaveBeenCalled();
  });

  it('clears the token on 401 from /api/auth/me', async () => {
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('keeps the token on non-auth failures (e.g. 503)', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() =>
        Promise.resolve({
          ok: false,
          status: 503,
          json: () => Promise.resolve({ detail: 'Unavailable' }),
        }),
      ),
    );
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(getToken()).toBe('session-token');
  });
});
