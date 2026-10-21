import { localeFromBrowser, type Locale } from './locale.js';
import { messagesForLocale } from './pick-locale.js';

type DevMessageKey = keyof typeof import('./core/en.js').default['dev'];

export function devMessage(key: DevMessageKey, locale?: Locale): string {
  const loc =
    locale
    ?? localeFromBrowser(typeof navigator !== 'undefined' ? navigator.language : 'en');
  return messagesForLocale(loc).core.dev[key];
}
