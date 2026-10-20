/** Public marketing site navigation (product home + docs). */

export type ProductNavKey =
  | 'product'
  | 'howItWorks'
  | 'capabilities'
  | 'docs'
  | 'developers'
  | 'selfHost';

export type ProductNavItem = {
  key: ProductNavKey;
  /** In-app path; use `hash` for same-page anchors on `/`. */
  to: string;
  hash?: string;
};

export type ProductDeveloperLinkKey = 'apiDocs' | 'openApiSpec' | 'github';

export type ProductDeveloperLink = {
  key: ProductDeveloperLinkKey;
  to: string;
  external?: boolean;
};

/** Primary nav — left-to-right on desktop. */
export const PRODUCT_NAV: ProductNavItem[] = [
  { key: 'product', to: '/', hash: 'product' },
  { key: 'howItWorks', to: '/', hash: 'how-it-works' },
  { key: 'capabilities', to: '/', hash: 'capabilities' },
  { key: 'selfHost', to: '/', hash: 'self-host' },
  { key: 'docs', to: '/docs' },
];

export const PRODUCT_DEVELOPER_LINKS: ProductDeveloperLink[] = [
  { key: 'apiDocs', to: '/swagger' },
  { key: 'openApiSpec', to: '/openapi/v1.json', external: true },
  { key: 'github', to: 'https://github.com/fellowos/basis', external: true },
];

export function productNavHref(item: ProductNavItem): string {
  return item.hash ? `${item.to}#${item.hash}` : item.to;
}

export function isProductNavActive(
  item: ProductNavItem,
  pathname: string,
  hash: string,
  activeKey?: ProductNavKey,
): boolean {
  if (activeKey) return item.key === activeKey;
  if (item.key === 'docs') {
    return pathname === '/docs' || pathname.startsWith('/docs/');
  }
  if (item.key === 'developers') {
    return pathname === '/swagger' || pathname.startsWith('/swagger/');
  }
  if (item.hash) {
    return pathname === '/' && hash === `#${item.hash}`;
  }
  return pathname === item.to;
}

export function isDevelopersNavActive(pathname: string, activeKey?: ProductNavKey): boolean {
  if (activeKey === 'developers') return true;
  return pathname === '/swagger' || pathname.startsWith('/swagger/');
}
