/** English `t.*` tree — module namespaces in `./module-locales.ts` (generated). */

import { default as core } from '@/i18n/core/en.js';
import { moduleLocalesEn } from '@/i18n/module-locales.js';

export const en = {
  core,
  ...moduleLocalesEn,
} as const;

export type LocaleMessages = typeof en;
