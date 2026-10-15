import { menu } from './menu.js';
import { common } from './common.js';
import { login } from './login.js';
import { marketing } from './marketing.js';
import { nav } from './nav.js';
import { pages } from './pages.js';
import { sidebar } from './sidebar.js';
import { status } from './status.js';
import { chat } from './chat.js';
import { models } from './models.js';

export const en = {
  menu,
  chat,
  models,
  common,
  sidebar,
  login,
  marketing,
  nav,
  status,
  pages,
} as const;

export type LocaleMessages = typeof en;
