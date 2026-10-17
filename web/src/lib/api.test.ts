import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fetchSession, getToken, setToken } from './api.js';
import { basisSessionClient } from './basis-session-client.js';

vi.mock('./basis-session-client.js', () => ({
  basisSessionClient: vi.fn(),
}));

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
  const getMock = vi.fn();

  beforeEach(() => {
    installLocalStorageMock();
    getMock.mockReset();
    vi.mocked(basisSessionClient).mockReturnValue({
      openapi: () => ({ GET: getMock }),
    } as ReturnType<typeof basisSessionClient>);
    setToken('session-token');
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('returns null without calling the API when no token is stored', async () => {
    setToken(null);
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(getMock).not.toHaveBeenCalled();
  });

  it('clears the token on 401 from /api/v1/auth/me', async () => {
    getMock.mockResolvedValue({
      error: { detail: 'Unauthorized' },
      response: { status: 401 },
    });
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(getToken()).toBeNull();
  });

  it('keeps the token on non-auth failures (e.g. 503)', async () => {
    getMock.mockResolvedValue({
      error: { detail: 'Unavailable' },
      response: { status: 503 },
    });
    const user = await fetchSession();
    expect(user).toBeNull();
    expect(getToken()).toBe('session-token');
  });
});
