import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  type ReactNode,
} from "react";
import { fmt } from "@/i18n/format.js";
import { localeFromBrowser, type Locale } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import { errorFromApiResponse } from "@/lib/api-error.js";
import { basisApiUrl } from "@/lib/basis-session-fetch.js";
import { isKbScopedApiPath, kbApiRoot } from "@/lib/kb-api-path.js";
import { ensureRequestIdHeader } from "@/lib/request-id.js";

export type ExplorerHttpConfig = {
  /**
   * KB-scoped API root, e.g. `/api/v1/kbs/{kb_id}`.
   * Rewrites Explorer `/api/graph/...` calls to `${apiRoot}/graph/...`.
   */
  apiRoot?: string;
  getAuthHeaders?: () => HeadersInit;
  /** Basis: ticketed KB WebSocket via `buildKbExplorerHttpConfig`. */
  openGraphUpdatesSocket?: () => Promise<WebSocket>;
};

function explorerHttpLocale(locale?: Locale): Locale {
  if (locale) {
    return locale;
  }
  const lang = typeof navigator !== "undefined" ? navigator.language : "en";
  return localeFromBrowser(lang);
}

function kbContextRequiredMessage(locale?: Locale): string {
  return messagesForLocale(explorerHttpLocale(locale)).kbExplorer.kbContextRequired;
}

function requestFailedMessage(status: number, locale?: Locale): string {
  return fmt(messagesForLocale(explorerHttpLocale(locale)).common.requestFailedStatus, {
    status,
  });
}

export function assertKbExplorerContext(): void {
  const { apiRoot } = activeConfig;
  if (!apiRoot) {
    throw new Error(kbContextRequiredMessage());
  }
}

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
  if (
    !apiRoot &&
    pathOrUrl.startsWith("/api/") &&
    !isKbScopedApiPath(pathOrUrl)
  ) {
    throw new Error(kbContextRequiredMessage());
  }
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

/** KB-scoped API path (`/api/v1/kbs/{id}/...`). Requires `kbId` or active `apiRoot`. */
export function buildExplorerKbApiPath(subpath: string, kbId?: string): string {
  const segment = subpath.replace(/^\//, "");
  if (kbId) {
    return `${kbApiRoot(kbId)}/${segment}`;
  }
  const { apiRoot } = getActiveExplorerHttpConfig();
  if (apiRoot) {
    return `${normalizeRoot(apiRoot)}/${segment}`;
  }
  throw new Error(kbContextRequiredMessage());
}

/** Graph routes under `/api/v1/kbs/{id}/graph/...`. */
export function buildExplorerGraphApiPath(resource: string, kbId?: string): string {
  const segment = resource.replace(/^\//, "");
  return buildExplorerKbApiPath(`graph/${segment}`, kbId);
}

function rewriteApiPath(pathname: string, apiRoot: string): string {
  const root = normalizeRoot(apiRoot);
  if (pathname === root || pathname.startsWith(`${root}/`)) {
    return pathname;
  }
  // Already KB-scoped (Basis or another host); do not prepend apiRoot again.
  if (isKbScopedApiPath(pathname)) {
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
  ensureRequestIdHeader(headers);
  const auth = activeConfig.getAuthHeaders?.();
  if (auth) {
    new Headers(auth).forEach((value, key) => {
      if (!headers.has(key)) {
        headers.set(key, value);
      }
    });
  }
  const absolute =
    url.startsWith("http://") || url.startsWith("https://") ? url : basisApiUrl(url);
  return fetch(absolute, { ...init, headers });
}

/** KB-scoped fetch with auth, request ID, and coded API errors (X-01). */
export async function explorerFetchJson<T = unknown>(
  input: string | URL,
  init?: RequestInit,
  fallbackMessage?: string,
  locale?: Locale,
): Promise<T> {
  const response = await explorerFetch(input, init);
  const contentType = response.headers.get("content-type") ?? "";
  const payload = contentType.includes("application/json")
    ? await response.json().catch(() => ({}))
    : await response.text().catch(() => "");
  if (!response.ok) {
    throw errorFromApiResponse(
      response.status,
      payload,
      fallbackMessage ?? requestFailedMessage(response.status, locale),
    );
  }
  return payload as T;
}

export async function openGraphUpdatesWebSocket(locale?: Locale): Promise<WebSocket> {
  if (activeConfig.openGraphUpdatesSocket) {
    return activeConfig.openGraphUpdatesSocket();
  }
  throw new Error(
    messagesForLocale(explorerHttpLocale(locale)).kbExplorer.graphUpdatesWebSocketRequired,
  );
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
