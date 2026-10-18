/**
 * Explorer `.ws-*` layout primitives as Tailwind (replaces `console-shell.css` ws rules).
 */

export const wsPage =
  "flex flex-1 flex-col w-full min-h-0 overflow-hidden bg-background text-foreground";

export const wsPageRow =
  "flex flex-1 flex-row w-full min-h-0 overflow-hidden bg-background text-foreground max-[900px]:flex-col";

export const wsScroll = "min-h-0 flex-1 overflow-y-auto overflow-x-hidden";

export const wsPadded = "p-4";

export const wsScrollPadded = `${wsScroll} ${wsPadded}`;

export const wsCard =
  "rounded-[calc(var(--radius)+6px)] border border-border bg-card p-[18px]";

export const wsEyebrow =
  "text-[10px] font-bold uppercase tracking-[0.08em] text-muted-foreground";

export const wsLabel = wsEyebrow;

export const wsTitle = "m-0 text-xl font-bold text-foreground";

export const wsBody = "text-[13px] leading-relaxed text-muted-foreground";

export const wsTextarea =
  "box-border w-full resize-y rounded-[var(--radius)] border border-border bg-background px-3 py-2 font-mono text-[13px] leading-relaxed text-foreground outline-none focus:border-primary focus:ring-2 focus:ring-primary/20";

export const wsPill =
  "inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold";

export const wsPillMono =
  `${wsPill} border border-border bg-muted text-muted-foreground`;

export const wsPillAccent =
  `${wsPill} border border-[color-mix(in_oklch,var(--primary)_22%,var(--border))] bg-primary/10 text-primary`;

export const wsEmpty =
  "flex flex-col items-center justify-center gap-2 px-5 py-10 text-center text-muted-foreground";

export const wsEmptyTitle = "text-sm font-bold text-foreground";

export const wsEmptyBody = "max-w-[36ch] text-xs leading-normal";

export const wsListItem =
  "block w-full cursor-pointer rounded-[var(--radius)] border border-transparent bg-transparent px-3 py-2.5 text-left text-muted-foreground transition-colors hover:border-border hover:bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))] hover:text-foreground";

export const wsListItemActive =
  "border-[color-mix(in_oklch,var(--primary)_22%,var(--border))] bg-primary/10 text-foreground";

export const wsSidebar =
  "flex flex-col overflow-hidden border-r border-border bg-[color-mix(in_oklch,var(--muted)_22%,var(--card))]";

export const wsSidebarHeader = "shrink-0 border-b border-border px-3.5 py-3";

export const wsSidebarBody = "min-h-0 flex-1 overflow-y-auto px-2.5 py-2";

export const wsSplitSidebar =
  "ws-split-sidebar flex w-[min(480px,42vw)] min-w-[280px] max-w-[520px] shrink-0 flex-col overflow-hidden border-r border-border max-[900px]:w-full max-[900px]:max-w-none max-[900px]:max-h-[min(52vh,480px)] max-[900px]:border-r-0 max-[900px]:border-b";

export const wsSkeleton =
  "animate-pulse rounded-[var(--radius)] bg-[color-mix(in_oklch,var(--muted)_55%,var(--card))]";

export const wsAnimateIn = "animate-in fade-in duration-200";
