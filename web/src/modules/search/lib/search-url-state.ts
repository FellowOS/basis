import { workspacePath } from '@/lib/nav/nav-config.js';

/** Legacy URL tab values (still parsed). */
export type SearchTab = 'chunks' | 'graph' | 'entities';

/** Active search target (documents, graph, or entities). */
export type SearchScope = SearchTab;

const TAB_PARAM = 'tab';
const SCOPE_PARAM = 'scope';

export function parseSearchTab(raw: string | null | undefined): SearchTab | undefined {
  if (raw === 'chunks' || raw === 'graph' || raw === 'entities') return raw;
  return undefined;
}

/** Map URL scope/tab to a single search target (`all` legacy → documents). */
export function resolveSearchScope(
  scopeRaw: string | null | undefined,
  tabRaw: string | null | undefined,
  defaultScope: SearchScope = 'chunks',
): SearchScope {
  const scope = scopeRaw?.trim();
  if (scope === 'chunks' || scope === 'graph' || scope === 'entities') return scope;
  if (scope === 'all') return 'chunks';
  return parseSearchTab(tabRaw) ?? defaultScope;
}

export type SearchUrlParams = {
  /** Legacy — also sets scope when `scope` omitted. */
  tab?: SearchTab;
  scope?: SearchScope;
  q?: string;
  /** Chunk search point-in-time (ISO). */
  asOf?: string;
  createdAfter?: string;
  createdBefore?: string;
  /** Graph search temporal instant (ISO). */
  at?: string;
};

function setOptionalIso(sp: URLSearchParams, key: string, value: string | undefined) {
  const trimmed = value?.trim();
  if (trimmed) sp.set(key, trimmed);
}

/** Build `/workspaces/:id/search` with shareable query params (F-SRCH-03). */
export function searchPath(workspaceId: string, params: SearchUrlParams): string {
  const sp = new URLSearchParams();
  const scope = params.scope ?? params.tab;
  if (scope) sp.set(SCOPE_PARAM, scope);
  const q = params.q?.trim();
  if (q) sp.set('q', q);
  setOptionalIso(sp, 'as_of', params.asOf);
  setOptionalIso(sp, 'created_after', params.createdAfter);
  setOptionalIso(sp, 'created_before', params.createdBefore);
  setOptionalIso(sp, 'at', params.at);
  const qs = sp.toString();
  return qs ? `${workspacePath(workspaceId, 'search')}?${qs}` : workspacePath(workspaceId, 'search');
}

export function parseSearchUrlState(search: string): SearchUrlParams & {
  scope: SearchScope;
} {
  const params = new URLSearchParams(search);
  const tab = parseSearchTab(params.get(TAB_PARAM));
  const scope = resolveSearchScope(params.get(SCOPE_PARAM), params.get(TAB_PARAM));
  return {
    tab,
    scope,
    q: params.get('q') ?? undefined,
    asOf: params.get('as_of') ?? undefined,
    createdAfter: params.get('created_after') ?? undefined,
    createdBefore: params.get('created_before') ?? undefined,
    at: params.get('at') ?? undefined,
  };
}
