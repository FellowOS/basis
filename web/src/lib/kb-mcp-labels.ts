import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type KbMcpCopy = LocaleMessages['menu']['kbMcp'];

export function kbMcpTokenScopeLabel(copy: KbMcpCopy, scope: string): string {
  const labels = copy.scopeLabels as Record<string, string>;
  return labels[scope] ?? labels[scope.toLowerCase()] ?? scope;
}
