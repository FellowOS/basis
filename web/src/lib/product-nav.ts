/** Public marketing site navigation (product home + docs). */

export type ProductNavKey = 'product' | 'capabilities' | 'developers' | 'selfHost' | 'pricing';

export type ProductNavItem = {
  key: ProductNavKey;
  /** In-app path; use `hash` for same-page anchors on `/`. */
  to: string;
  hash?: string;
};

export type ProductDeveloperLinkKey = 'docsHub' | 'apiDocs' | 'openApiSpec';

export type ProductDeveloperLink = {
  key: ProductDeveloperLinkKey;
  to: string;
  external?: boolean;
};

/** Primary nav — left-to-right on desktop. */
export const PRODUCT_NAV: ProductNavItem[] = [
  { key: 'product', to: '/', hash: 'product' },
  { key: 'capabilities', to: '/', hash: 'capabilities' },
  { key: 'selfHost', to: '/', hash: 'self-host' },
  { key: 'pricing', to: '/', hash: 'pricing' },
];

export const PRODUCT_DEVELOPER_LINKS: ProductDeveloperLink[] = [
  { key: 'docsHub', to: '/docs' },
  { key: 'apiDocs', to: '/swagger' },
  { key: 'openApiSpec', to: '/openapi/v1.json', external: true },
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
  if (item.key === 'developers') {
    return pathname === '/docs' || pathname.startsWith('/docs/') || pathname === '/swagger';
  }
  if (item.hash) {
    return pathname === '/' && hash === `#${item.hash}`;
  }
  return pathname === item.to;
}

export function isDevelopersNavActive(pathname: string, activeKey?: ProductNavKey): boolean {
  if (activeKey === 'developers') return true;
  return (
    pathname === '/docs' ||
    pathname.startsWith('/docs/') ||
    pathname === '/swagger' ||
    pathname.startsWith('/swagger/')
  );
}
