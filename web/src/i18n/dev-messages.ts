import { localeFromBrowser, type Locale } from './locale.js';
import { messagesForLocale } from './pick-locale.js';

export function devMessage(
  key: keyof typeof import('./locales/en/dev.js').dev,
  locale?: Locale,
): string {
  const loc =
    locale
    ?? localeFromBrowser(typeof navigator !== 'undefined' ? navigator.language : 'en');
  return messagesForLocale(loc).dev[key];
}
