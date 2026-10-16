import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import type { Locale } from '@/i18n/locale.js';
import { messagesForLocale } from '@/i18n/pick-locale.js';
import { kbMemberRoleLabel } from '@/lib/kb-settings-labels.js';

export function formatBasisAuditModelKind(locale: Locale, kind: string): string {
  const models = messagesForLocale(locale).models;
  if (kind === 'llm') return models.tabLlm;
  if (kind === 'embed') return models.tabEmbed;
  return kind;
}

export function formatBasisAuditMemberRole(locale: Locale, role: string): string {
  const ks = messagesForLocale(locale).kbSettings as LocaleMessages['kbSettings'];
  return kbMemberRoleLabel(ks, role);
}
