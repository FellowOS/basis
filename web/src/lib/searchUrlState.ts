import { kbPath } from '@/lib/nav-config.js';

export type KbSearchTab = 'chunks' | 'graph' | 'entities';

const TAB_PARAM = 'tab';

export function parseKbSearchTab(raw: string | null | undefined): KbSearchTab | undefined {
  if (raw === 'chunks' || raw === 'graph' || raw === 'entities') return raw;
  return undefined;
}

export type KbSearchUrlParams = {
  tab?: KbSearchTab;
  q?: string;
  doc?: string;
  entity?: string;
  created_after?: string;
  created_before?: string;
  as_of?: string;
};

/** Build `/kbs/:id/search` with shareable query params (F-SRCH-03). */
export function kbSearchPath(kbId: string, params: KbSearchUrlParams): string {
  const sp = new URLSearchParams();
  if (params.tab) sp.set(TAB_PARAM, params.tab);
  const q = params.q?.trim();
  if (q) sp.set('q', q);
  const doc = params.doc?.trim();
  if (doc) sp.set('doc', doc);
  const entity = params.entity?.trim();
  if (entity) sp.set('entity', entity);
  const after = params.created_after?.trim();
  if (after) sp.set('created_after', after);
  const before = params.created_before?.trim();
  if (before) sp.set('created_before', before);
  const asOf = params.as_of?.trim();
  if (asOf) sp.set('as_of', asOf);
  const qs = sp.toString();
  return qs ? `${kbPath(kbId, 'search')}?${qs}` : kbPath(kbId, 'search');
}

export function parseKbSearchUrlState(search: string): KbSearchUrlParams {
  const params = new URLSearchParams(search);
  const tab = parseKbSearchTab(params.get(TAB_PARAM));
  return {
    tab,
    q: params.get('q') ?? undefined,
    doc: params.get('doc') ?? undefined,
    entity: params.get('entity') ?? undefined,
    created_after: params.get('created_after') ?? undefined,
    created_before: params.get('created_before') ?? undefined,
    as_of: params.get('as_of') ?? undefined,
  };
}
