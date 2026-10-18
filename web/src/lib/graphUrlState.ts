import { kbPath } from '@/lib/nav-config.js';

export type KbGraphUrlParams = {
  focus?: string;
  /** ISO instant for temporal scrubber (F-TIM / F-SRCH-03). */
  at?: string;
  /** Legacy/share flag (`?timeline=1`); scrubber is shown when temporal bounds exist. */
  timeline?: boolean;
};

export type KbGraphDiffPreviewParams = {
  diffFrom: string;
  diffTo: string;
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

export function kbGraphImportDialogPath(kbId: string): string {
  return `${kbPath(kbId, 'graph')}?import=1`;
}

export function kbGraphExportDialogPath(kbId: string): string {
  return `${kbPath(kbId, 'graph')}?export=1`;
}

export function parseKbGraphUrlState(search: string): KbGraphUrlParams {
  const params = new URLSearchParams(search);
  return {
    focus: params.get('focus') ?? undefined,
    at: params.get('at') ?? undefined,
    timeline: params.get('timeline') === '1',
  };
}

export function parseKbGraphDiffPreviewParams(search: string): KbGraphDiffPreviewParams | null {
  const params = new URLSearchParams(search);
  const diffFrom = params.get('diff_from')?.trim();
  const diffTo = params.get('diff_to')?.trim();
  if (!diffFrom || !diffTo) return null;
  return { diffFrom, diffTo };
}

/** Graph canvas with diff overlay (`?at=` + `diff_from` / `diff_to`, F-DIFF-01 preview). */
export function kbGraphDiffPreviewPath(
  kbId: string,
  diffFrom: string,
  diffTo: string,
  focusNodeId?: string,
): string {
  const sp = new URLSearchParams();
  sp.set('at', diffTo.trim());
  sp.set('diff_from', diffFrom.trim());
  sp.set('diff_to', diffTo.trim());
  const focus = focusNodeId?.trim();
  if (focus) sp.set('focus', focus);
  return `${kbPath(kbId, 'graph')}?${sp.toString()}`;
}

export function clearKbGraphDiffPreviewParams(search: string): URLSearchParams {
  const params = new URLSearchParams(search);
  params.delete('diff_from');
  params.delete('diff_to');
  return params;
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
