import { en } from './en.js';
import { zh } from './zh.js';
import type { Locale } from './locale.js';

export type AnyLocaleMessages = typeof en | typeof zh;

export function messagesForLocale(locale: Locale): AnyLocaleMessages {
  return locale === 'zh' ? zh : en;
}
