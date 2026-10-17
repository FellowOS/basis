/** Public product documentation IA (marketing site `/docs/*`). */

export type DocSlug =
  | 'overview'
  | 'quickstart'
  | 'concepts'
  | 'rest-api'
  | 'auth'
  | 'mcp'
  | 'api-reference'
  | 'deployment';

export type DocNavItem = {
  slug: DocSlug;
};

export type DocNavGroup = {
  id: 'start' | 'integrate' | 'reference' | 'ops';
  items: DocNavItem[];
};

export const PRODUCT_DOCS_NAV: DocNavGroup[] = [
  {
    id: 'start',
    items: [{ slug: 'overview' }, { slug: 'quickstart' }, { slug: 'concepts' }],
  },
  {
    id: 'integrate',
    items: [{ slug: 'rest-api' }, { slug: 'auth' }, { slug: 'mcp' }],
  },
  {
    id: 'reference',
    items: [{ slug: 'api-reference' }],
  },
  {
    id: 'ops',
    items: [{ slug: 'deployment' }],
  },
];

export const DOC_SLUGS: DocSlug[] = PRODUCT_DOCS_NAV.flatMap((g) => g.items.map((i) => i.slug));

export function docsPath(slug: DocSlug): string {
  return slug === 'overview' ? '/docs' : `/docs/${slug}`;
}

export function docSlugFromParam(param: string | undefined): DocSlug {
  if (!param || param === 'overview') return 'overview';
  if ((DOC_SLUGS as readonly string[]).includes(param)) return param as DocSlug;
  return 'overview';
}

export function docsPathActive(pathname: string, slug: DocSlug): boolean {
  const href = docsPath(slug);
  if (slug === 'overview') return pathname === '/docs' || pathname === '/docs/';
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function isProductDocsPath(pathname: string): boolean {
  return pathname === '/docs' || pathname.startsWith('/docs/');
}
