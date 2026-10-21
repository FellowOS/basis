/** Public product documentation IA (marketing site `/docs/*`). */

export type DocSlug =
  | 'overview'
  | 'quickstart'
  | 'concepts'
  | 'rest-api'
  | 'bocp'
  | 'connectors-basis'
  | 'auth'
  | 'mcp'
  | 'api-reference'
  | 'deployment';

/** All routable doc slugs (must match Fumadocs pages under `content/docs/{locale}/`). */
export const DOC_SLUGS: DocSlug[] = [
  'overview',
  'quickstart',
  'concepts',
  'rest-api',
  'bocp',
  'connectors-basis',
  'auth',
  'mcp',
  'api-reference',
  'deployment',
];

export function docsPath(slug: DocSlug): string {
  return slug === 'overview' ? '/docs' : `/docs/${slug}`;
}

export function docSlugFromParam(param: string | undefined): DocSlug {
  if (!param || param === 'overview') return 'overview';
  if ((DOC_SLUGS as readonly string[]).includes(param)) return param as DocSlug;
  return 'overview';
}
