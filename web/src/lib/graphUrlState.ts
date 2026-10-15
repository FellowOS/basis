import { kbPath } from '@/lib/nav-config.js';

export type KbGraphUrlParams = {
  focus?: string;
  /** ISO instant for temporal scrubber (F-TIM / F-SRCH-03). */
  at?: string;
};

export function kbGraphPath(kbId: string, params?: KbGraphUrlParams): string {
  if (!params?.focus && !params?.at?.trim()) {
    return kbPath(kbId, 'graph');
  }
  const sp = new URLSearchParams();
  const focus = params.focus?.trim();
  if (focus) sp.set('focus', focus);
  const at = params.at?.trim();
  if (at) sp.set('at', at);
  return `${kbPath(kbId, 'graph')}?${sp.toString()}`;
}

export function parseKbGraphUrlState(search: string): KbGraphUrlParams {
  const params = new URLSearchParams(search);
  return {
    focus: params.get('focus') ?? undefined,
    at: params.get('at') ?? undefined,
  };
}
