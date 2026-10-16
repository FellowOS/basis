import type { LocaleMessages } from '@/i18n/locales/en/index.js';

type KbSettingsCopy = LocaleMessages['kbSettings'];

export function kbMemberRoleLabel(ks: KbSettingsCopy, role: string): string {
  const labels = ks.roleLabels as Record<string, string>;
  return labels[role] ?? role;
}

export function kbVisibilityLabel(ks: KbSettingsCopy, visibility: string): string {
  const labels = ks.visibilityLabels as Record<string, string>;
  return labels[visibility] ?? visibility;
}
