import { afterEach, describe, expect, it, vi } from 'vitest';

import { appAuthRequired, appIsDesktopProduct, getAppRuntime } from '@/lib/app-runtime.js';

describe('getAppRuntime', () => {
  it('reads __BASIS_RUNTIME__ when present', () => {
    vi.stubGlobal('window', {
      __BASIS_RUNTIME__: {
        authRequired: false,
        apiBase: 'http://127.0.0.1:9001',
        desktop: true,
      },
    });
    const rt = getAppRuntime();
    expect(rt.apiBase).toBe('http://127.0.0.1:9001');
    expect(appAuthRequired()).toBe(false);
    vi.unstubAllGlobals();
  });
});

describe('appIsDesktopProduct', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('is true when runtime.desktop is set', () => {
    vi.stubGlobal('window', {
      __BASIS_RUNTIME__: { authRequired: true, apiBase: '', desktop: true },
    });
    expect(appIsDesktopProduct()).toBe(true);
  });

  it('is true when auth is not required (desktop Vite build)', () => {
    vi.stubGlobal('window', {
      __BASIS_RUNTIME__: { authRequired: false, apiBase: '' },
    });
    expect(appIsDesktopProduct()).toBe(true);
  });

  it('is false for cloud auth-required runtime', () => {
    vi.stubGlobal('window', {
      __BASIS_RUNTIME__: { authRequired: true, apiBase: '', desktop: false },
    });
    expect(appIsDesktopProduct()).toBe(false);
  });
});
