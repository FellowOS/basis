/** Thin scrollbar chrome for compact inline HTML artifact previews. */
export const INLINE_PREVIEW_SCROLLBAR_STYLE_ID = 'fellow-inline-scrollbar';

export const INLINE_PREVIEW_SCROLLBAR_STYLE_TAG = `<style id="${INLINE_PREVIEW_SCROLLBAR_STYLE_ID}">
html {
  scrollbar-width: thin;
  scrollbar-color: rgba(128, 128, 128, 0.45) transparent;
}
::-webkit-scrollbar {
  width: 3px;
  height: 3px;
}
::-webkit-scrollbar-track {
  background: transparent;
}
::-webkit-scrollbar-thumb {
  background: rgba(128, 128, 128, 0.45);
  border-radius: 999px;
}
::-webkit-scrollbar-thumb:hover {
  background: rgba(128, 128, 128, 0.65);
}
</style>`;

export function injectInlinePreviewScrollbarStyle(html: string): string {
  if (html.includes(INLINE_PREVIEW_SCROLLBAR_STYLE_ID)) return html;
  const tag = INLINE_PREVIEW_SCROLLBAR_STYLE_TAG;
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${tag}</head>`);
  }
  if (/<head[^>]*>/i.test(html)) {
    return html.replace(/<head([^>]*)>/i, `<head$1>${tag}`);
  }
  return `${tag}${html}`;
}

export function appendInlinePreviewQuery(url: string): string {
  const parsed = new URL(url);
  parsed.searchParams.set('fellowUi', 'inline');
  return parsed.toString();
}
