import type { LocaleMessages } from '@/i18n/en.js';
import type { ProductDeveloperLinkKey, ProductNavKey } from '@/lib/product-nav.js';

type MarketingNav = LocaleMessages['home']['marketing']['nav'];
type DevelopersMenu = MarketingNav['developers_menu'];

export const PRODUCT_NAV_I18N_KEY: Record<
  ProductNavKey,
  Exclude<keyof MarketingNav, 'developers_menu' | 'aria_main' | 'open_menu'>
> = {
  product: 'product',
  howItWorks: 'how_it_works',
  capabilities: 'capabilities',
  docs: 'docs',
  developers: 'developers',
  selfHost: 'self_host',
};

export const PRODUCT_DEV_LINK_I18N_KEY: Record<
  ProductDeveloperLinkKey,
  { title: keyof DevelopersMenu; desc: keyof DevelopersMenu }
> = {
  apiDocs: { title: 'api_docs', desc: 'api_docs_desc' },
  openApiSpec: { title: 'open_api_spec', desc: 'open_api_spec_desc' },
  github: { title: 'github', desc: 'github_desc' },
};

export function productNavLabel(nav: MarketingNav, key: ProductNavKey): string {
  return nav[PRODUCT_NAV_I18N_KEY[key]];
}

export function productDeveloperLinkLabels(
  menu: DevelopersMenu,
  key: ProductDeveloperLinkKey,
): { title: string; desc: string } {
  const keys = PRODUCT_DEV_LINK_I18N_KEY[key];
  return { title: menu[keys.title], desc: menu[keys.desc] };
}
