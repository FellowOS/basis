import { kbPath } from '@/lib/nav-config.js';

/** Legacy URL tab values (still parsed). */
export type KbSearchTab = 'chunks' | 'graph' | 'entities';

/** Active search target (documents, graph, or entities). */
export type KbSearchScope = KbSearchTab;

const TAB_PARAM = 'tab';
const SCOPE_PARAM = 'scope';

export function parseKbSearchTab(raw: string | null | undefined): KbSearchTab | undefined {
  if (raw === 'chunks' || raw === 'graph' || raw === 'entities') return raw;
  return undefined;
}

/** Map URL scope/tab to a single search target (`all` legacy → documents). */
export function resolveKbSearchScope(
  scopeRaw: string | null | undefined,
  tabRaw: string | null | undefined,
  defaultScope: KbSearchScope = 'chunks',
): KbSearchScope {
  const scope = scopeRaw?.trim();
  if (scope === 'chunks' || scope === 'graph' || scope === 'entities') return scope;
  if (scope === 'all') return 'chunks';
  return parseKbSearchTab(tabRaw) ?? defaultScope;
}

export type KbSearchUrlParams = {
  /** Legacy — also sets scope when `scope` omitted. */
  tab?: KbSearchTab;
  scope?: KbSearchScope;
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

/** Build `/kbs/:id/search` with shareable query params (F-SRCH-03). */
export function kbSearchPath(kbId: string, params: KbSearchUrlParams): string {
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
  return qs ? `${kbPath(kbId, 'search')}?${qs}` : kbPath(kbId, 'search');
}

export function parseKbSearchUrlState(search: string): KbSearchUrlParams & {
  scope: KbSearchScope;
} {
  const params = new URLSearchParams(search);
  const tab = parseKbSearchTab(params.get(TAB_PARAM));
  const scope = resolveKbSearchScope(params.get(SCOPE_PARAM), params.get(TAB_PARAM));
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
