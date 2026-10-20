/**
 * Workbench runtime (Cloud SPA + Desktop shell).
 * API aligned with Fellow @fellow/app-runtime `getRuntime()` / `FellowRuntime`.
 */

export type BasisEnvironment = 'local' | 'cloud';

export interface AppRuntime {
  authRequired: boolean;
  apiBase: string;
  desktop?: boolean;
  environment?: BasisEnvironment;
  activeTarget?: string;
  localApiBase?: string;
}

/** Electron preload window chrome (Fellow: DesktopBridge subset). */
export interface BasisDesktopBridge {
  apiBase?: string;
  desktop?: boolean;
  authRequired?: boolean;
  webUrl?: string;
  hasCustomWindowControls?: boolean;
  isMac?: boolean;
  windowMinimize?: () => void;
  windowMaximize?: () => void;
  windowClose?: () => void;
  isWindowMaximized?: () => Promise<boolean>;
  onWindowMaximizedChange?: (handler: (maximized: boolean) => void) => () => void;
}

declare global {
  interface Window {
    /** Primary preload injection (Fellow: __FELLOW_RUNTIME__). */
    __BASIS_RUNTIME__?: AppRuntime;
    /** Desktop shell bridge (runtime + window controls). */
    __BASIS_DESKTOP__?: BasisDesktopBridge;
  }
}

const FALLBACK_RUNTIME: AppRuntime = {
  authRequired: true,
  apiBase: '',
  environment: 'local',
};

function runtimeFromPreload(): AppRuntime | null {
  if (typeof window === 'undefined') return null;
  if (window.__BASIS_RUNTIME__) {
    return window.__BASIS_RUNTIME__;
  }
  const legacy = window.__BASIS_DESKTOP__;
  if (!legacy) return null;
  return {
    authRequired: legacy.authRequired ?? false,
    apiBase: legacy.apiBase ?? '',
    desktop: legacy.desktop ?? true,
    environment: 'local',
    localApiBase: legacy.apiBase,
  };
}

function runtimeFromViteEnv(): AppRuntime {
  const raw = import.meta.env.VITE_BASIS_AUTH_REQUIRED;
  const authRequired = raw !== 'false' && raw !== '0';
  const apiBase =
    (import.meta.env.VITE_BASIS_API_URL as string | undefined)?.trim().replace(/\/$/, '') ?? '';
  return {
    authRequired,
    apiBase,
    environment: 'local',
    localApiBase: apiBase || undefined,
  };
}

/** Stable runtime snapshot for guards, API base, and desktop product mode. */
export function getAppRuntime(): AppRuntime {
  const fromPreload = runtimeFromPreload();
  if (fromPreload) return fromPreload;
  if (typeof window !== 'undefined') {
    return runtimeFromViteEnv();
  }
  return FALLBACK_RUNTIME;
}

export function appAuthRequired(): boolean {
  return getAppRuntime().authRequired;
}

export function appIsDesktopProduct(): boolean {
  const rt = getAppRuntime();
  if (rt.desktop === true) return true;
  return !rt.authRequired;
}
