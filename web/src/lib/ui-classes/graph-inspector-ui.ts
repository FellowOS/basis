/**
 * Graph inspector + markdown viewer (`GraphInspectorPanel`, `MarkdownContentViewer`).
 */

export const graphInspectorPanel = "text-foreground";

export const graphNodePanelCollapse =
  "overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_28%,var(--card))] [&+&]:mt-3";

export const graphNodePanelSummary =
  "flex cursor-pointer list-none items-center justify-between gap-3 px-3.5 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-foreground select-none [&::-webkit-details-marker]:hidden after:text-base after:leading-none after:font-medium after:text-muted-foreground after:content-['+'] group-open/node:after:content-['−']";

export const graphNodePanelBody = "px-3.5 pb-3.5";

export const graphInspectorKv =
  "rounded-[calc(var(--radius)-2px)] border border-border bg-card px-3 py-2.5";

export const graphInspectorKvKey =
  "mb-1 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export const graphInspectorKvValue =
  "text-[13px] leading-normal text-foreground [overflow-wrap:anywhere]";

export const graphInspectorMetric =
  "flex flex-col gap-0.5 rounded-[calc(var(--radius)-2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-2.5 py-2";

export const graphInspectorPathChip =
  "inline-flex max-w-40 items-center gap-1.5 rounded-full border border-border bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] px-2.5 py-1 text-xs font-semibold text-foreground transition-colors hover:border-[color-mix(in_oklch,var(--foreground)_12%,var(--border))] hover:bg-[color-mix(in_oklch,var(--muted)_65%,var(--card))] data-[bottleneck=true]:border-[color-mix(in_oklch,var(--warn)_45%,var(--border))] data-[bottleneck=true]:bg-[color-mix(in_oklch,var(--warn)_12%,var(--card))]";

export const graphMarkdownViewer =
  "flex flex-col overflow-hidden rounded-[calc(var(--radius)+2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]";

export const graphMarkdownViewerHeader =
  "flex flex-wrap items-center justify-between gap-2 border-b border-border bg-[color-mix(in_oklch,var(--muted)_35%,var(--card))] px-2.5 py-1.5";

export const graphMarkdownViewerTab =
  "inline-flex cursor-pointer items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-transparent bg-transparent px-2 py-1 text-xs font-semibold text-muted-foreground transition-colors aria-selected:border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] aria-selected:bg-primary/10 aria-selected:text-primary";

export const graphMarkdownViewerToolBtn =
  "inline-flex cursor-pointer items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] px-2 py-0.5 text-[11px] text-muted-foreground disabled:cursor-not-allowed disabled:opacity-65";

export const graphMarkdownViewerSave =
  "inline-flex cursor-pointer items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-primary px-2 py-0.5 text-[11px] font-bold text-primary-foreground disabled:cursor-not-allowed disabled:opacity-55";

export const graphMarkdownViewerError =
  "flex items-center justify-between gap-2 border-b border-[color-mix(in_oklch,var(--destructive)_28%,var(--border))] bg-destructive/10 px-3 py-2 text-xs leading-normal text-destructive";

export const graphMarkdownViewerErrorAction =
  "shrink-0 border-[color-mix(in_oklch,var(--destructive)_32%,var(--border))] text-destructive";

export const graphMarkdownViewerBody = "max-h-[380px] overflow-y-auto p-3";

export const graphMarkdownViewerEditor =
  "box-border block min-h-[280px] w-full resize-y rounded-[calc(var(--radius)-2px)] border border-[color-mix(in_oklch,var(--primary)_35%,var(--border))] bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] p-2.5 font-mono text-xs leading-relaxed text-foreground";

export const graphMarkdownViewerEmpty =
  "text-xs italic leading-normal text-muted-foreground";

export const graphMarkdownViewerSource =
  "m-0 overflow-x-auto rounded-[calc(var(--radius)-2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] p-2.5 [&_code]:whitespace-pre-wrap [&_code]:break-words [&_code]:font-mono [&_code]:text-xs [&_code]:leading-relaxed [&_code]:text-foreground [&_code]:select-text";

/** Wrapper for `ReactMarkdown` output */
export const graphMarkdownPreview =
  "break-words text-[13px] leading-relaxed text-foreground [&_a]:break-all [&_a]:text-primary [&_a]:underline [&_a]:underline-offset-[3px] [&_blockquote]:my-2 [&_blockquote]:rounded-r-[calc(var(--radius)-2px)] [&_blockquote]:border-l-[3px] [&_blockquote]:border-primary [&_blockquote]:bg-primary/5 [&_blockquote]:px-3 [&_blockquote]:py-1.5 [&_blockquote]:italic [&_h1]:mb-1.5 [&_h1]:border-b [&_h1]:border-border [&_h1]:pb-0.5 [&_h1]:text-base [&_h1]:font-bold [&_h2]:my-2 [&_h2]:text-sm [&_h2]:font-bold [&_h3]:my-1.5 [&_h3]:text-[13px] [&_h3]:font-semibold [&_h4]:my-1 [&_h4]:text-xs [&_h4]:font-semibold [&_hr]:my-2.5 [&_hr]:border-0 [&_hr]:border-t [&_hr]:border-border [&_li]:mb-0.5 [&_ol]:mb-2 [&_ol]:pl-[1.125rem] [&_p]:mb-2 [&_pre]:my-2 [&_pre]:overflow-x-auto [&_pre]:rounded-[calc(var(--radius)-2px)] [&_pre]:border [&_pre]:border-border [&_pre]:bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))] [&_pre]:p-2.5 [&_table]:w-full [&_table]:border-collapse [&_table]:text-xs [&_tbody_tr]:border-b [&_tbody_tr]:border-border [&_td]:border-r [&_td]:border-border [&_td]:p-1.5 [&_td]:text-foreground [&_th]:border-r [&_th]:border-border [&_th]:p-1.5 [&_th]:text-left [&_th]:font-bold [&_th]:text-foreground [&_thead]:bg-[color-mix(in_oklch,var(--muted)_45%,var(--card))] [&_ul]:mb-2 [&_ul]:pl-[1.125rem]";

export const graphMdImageBadge =
  "my-0.5 inline-flex items-center gap-1 rounded-[calc(var(--radius)-2px)] border border-border bg-[color-mix(in_oklch,var(--muted)_40%,var(--card))] px-1.5 py-0.5 text-[11px] text-muted-foreground";

export const graphMdUnsafeLink = "text-muted-foreground line-through";

export const graphMdExtIcon = "ml-0.5 inline align-middle";

export const graphMdTableWrap =
  "my-2 w-full overflow-x-auto rounded-[calc(var(--radius)-2px)] border border-border";

export const graphMdInlineCode =
  "rounded border border-border bg-[color-mix(in_oklch,var(--muted)_50%,var(--card))] px-1 py-0.5 font-mono text-xs text-foreground";

export const graphMdBlockCode = "font-mono text-xs leading-normal text-foreground";
