import { kbPath } from '@/lib/nav-config.js';

export type KbGraphUrlParams = {
  focus?: string;
  /** ISO instant for temporal scrubber (F-TIM / F-SRCH-03). */
  at?: string;
  /** Legacy/share flag (`?timeline=1`); scrubber is shown when temporal bounds exist. */
  timeline?: boolean;
};

export function kbGraphPath(kbId: string, params?: KbGraphUrlParams): string {
  if (!params?.focus && !params?.at?.trim() && !params?.timeline) {
    return kbPath(kbId, 'graph');
  }
  const sp = new URLSearchParams();
  const focus = params.focus?.trim();
  if (focus) sp.set('focus', focus);
  const at = params.at?.trim();
  if (at) sp.set('at', at);
  if (params.timeline) sp.set('timeline', '1');
  return `${kbPath(kbId, 'graph')}?${sp.toString()}`;
}

export function parseKbGraphUrlState(search: string): KbGraphUrlParams {
  const params = new URLSearchParams(search);
  return {
    focus: params.get('focus') ?? undefined,
    at: params.get('at') ?? undefined,
    timeline: params.get('timeline') === '1',
  };
}

/** Sync graph route query while preserving other params (e.g. `focus`). */
export function mergeKbGraphAtParam(
  search: string,
  atIso: string | null | undefined,
): URLSearchParams {
  const params = new URLSearchParams(search);
  const trimmed = atIso?.trim();
  if (trimmed) {
    params.set('at', trimmed);
  } else {
    params.delete('at');
  }
  return params;
}
