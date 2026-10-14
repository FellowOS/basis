import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";

export type ExplorerHttpConfig = {
  /**
   * KB-scoped API root, e.g. `/api/kbs/{kb_id}`.
   * Rewrites Explorer `/api/graph/...` calls to `${apiRoot}/graph/...`.
   */
  apiRoot?: string;
  getAuthHeaders?: () => HeadersInit;
  /** Hosted apps (Sema) use ticketed WS; standalone Explorer uses `/ws/graph-updates`. */
  openGraphUpdatesSocket?: () => Promise<WebSocket>;
};

const ExplorerHttpContext = createContext<ExplorerHttpConfig>({});

let activeConfig: ExplorerHttpConfig = {};

export function setActiveExplorerHttpConfig(config: ExplorerHttpConfig): void {
  activeConfig = config;
}

export function getActiveExplorerHttpConfig(): ExplorerHttpConfig {
  return activeConfig;
}

export function resolveExplorerApiUrl(pathOrUrl: string): string {
  const { apiRoot } = activeConfig;
  if (!apiRoot) {
    return pathOrUrl;
  }

  try {
    if (pathOrUrl.startsWith("http://") || pathOrUrl.startsWith("https://")) {
      const url = new URL(pathOrUrl);
      if (url.pathname.startsWith("/api/")) {
        url.pathname = rewriteApiPath(url.pathname, apiRoot);
      }
      return url.toString();
    }
  } catch {
    return pathOrUrl;
  }

  if (pathOrUrl.startsWith("/api/")) {
    const [pathname, query = ""] = pathOrUrl.split("?");
    const rewritten = rewriteApiPath(pathname, apiRoot);
    return query ? `${rewritten}?${query}` : rewritten;
  }

  return pathOrUrl;
}

function normalizeRoot(apiRoot: string): string {
  return apiRoot.endsWith("/") ? apiRoot.slice(0, -1) : apiRoot;
}

/**
 * KB-scoped API path for Sema (`/api/kbs/{id}/...`).
 * Standalone Explorer falls back to `/api/...` when `kbId` and `apiRoot` are unset.
 */
export function buildExplorerKbApiPath(subpath: string, kbId?: string): string {
  const segment = subpath.replace(/^\//, "");
  if (kbId) {
    return `/api/kbs/${kbId}/${segment}`;
  }
  const { apiRoot } = getActiveExplorerHttpConfig();
  if (apiRoot) {
    return `${normalizeRoot(apiRoot)}/${segment}`;
  }
  return `/api/${segment}`;
}

/** Graph routes under `/api/kbs/{id}/graph/...` (or `/api/graph/...` standalone). */
export function buildExplorerGraphApiPath(resource: string, kbId?: string): string {
  const segment = resource.replace(/^\//, "");
  return buildExplorerKbApiPath(`graph/${segment}`, kbId);
}

function rewriteApiPath(pathname: string, apiRoot: string): string {
  const root = normalizeRoot(apiRoot);
  if (pathname === root || pathname.startsWith(`${root}/`)) {
    return pathname;
  }
  // Already KB-scoped (Sema or another host); do not prepend apiRoot again.
  if (pathname.startsWith("/api/kbs/")) {
    return pathname;
  }
  if (!pathname.startsWith("/api/")) {
    return pathname;
  }
  const suffix = pathname.slice("/api".length);
  return `${root}${suffix}`;
}

export async function explorerFetch(
  input: string | URL,
  init?: RequestInit,
): Promise<Response> {
  const url =
    typeof input === "string"
      ? resolveExplorerApiUrl(input)
      : resolveExplorerApiUrl(input.toString());
  const headers = new Headers(init?.headers);
  const auth = activeConfig.getAuthHeaders?.();
  if (auth) {
    new Headers(auth).forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });
  }
  return fetch(url, { ...init, headers });
}

export async function openGraphUpdatesWebSocket(): Promise<WebSocket> {
  if (activeConfig.openGraphUpdatesSocket) {
    return activeConfig.openGraphUpdatesSocket();
  }
  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  return new WebSocket(`${protocol}//${window.location.host}/ws/graph-updates`);
}

export function ExplorerHostProvider({
  config,
  children,
}: {
  config: ExplorerHttpConfig;
  children: ReactNode;
}) {
  const value = useMemo(
    () => config,
    [config.apiRoot, config.getAuthHeaders, config.openGraphUpdatesSocket],
  );

  // Set before child queries run (useEffect is too late for useLoadGraph on mount).
  setActiveExplorerHttpConfig(value);

  useEffect(() => {
    setActiveExplorerHttpConfig(value);
  }, [value]);

  return (
    <ExplorerHttpContext.Provider value={value}>{children}</ExplorerHttpContext.Provider>
  );
}

export function useExplorerHttpConfig(): ExplorerHttpConfig {
  return useContext(ExplorerHttpContext);
}
