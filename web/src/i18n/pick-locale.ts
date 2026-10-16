import { en } from './locales/en/index.js';
import { zh } from './locales/zh/index.js';
import type { Locale } from './locale.js';

export type AnyLocaleMessages = typeof en | typeof zh;

export function messagesForLocale(locale: Locale): AnyLocaleMessages {
  return locale === 'zh' ? zh : en;
}
