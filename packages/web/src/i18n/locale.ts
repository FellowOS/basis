import type { LocaleMessages } from './locales/en/index.js';

export const LOCALES = ['en', 'zh'] as const;
export type Locale = (typeof LOCALES)[number];

export const LOCALE_HTML_LANG: Record<Locale, string> = {
  en: 'en',
  zh: 'zh-CN',
};

const LOCALE_LABEL_KEYS = {
  en: 'localeEnglish',
  zh: 'localeChinese',
} as const satisfies Record<Locale, 'localeEnglish' | 'localeChinese'>;

export function isLocale(value: string): value is Locale {
  return (LOCALES as readonly string[]).includes(value);
}

export function localeFromBrowser(lang: string): Locale {
  return lang.toLowerCase().startsWith('zh') ? 'zh' : 'en';
}

export function localeLabel(locale: Locale, sidebar: LocaleMessages['sidebar']): string {
  return sidebar[LOCALE_LABEL_KEYS[locale]];
}
