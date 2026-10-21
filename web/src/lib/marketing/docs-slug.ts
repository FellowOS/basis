/** Heading anchor ids for in-page TOC (aligned with fellowos/website docs). */
export function docsHeadingSlug(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff]+/g, '-')
    .replace(/^-|-$/g, '');
}
