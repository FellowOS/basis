/**
 * Governance / ontology-hub `.oh-*` and embedded workspace shell (replaces `governance.css` oh/vocab/er rules used in TSX).
 */

/** SPARQL / ontology / review / vocabulary hub viewport height (was `.kb-explorer-console.kb-*-workspace`). */
export const govEmbeddedWorkspaceShell =
  "min-h-[20rem] flex-1 h-[clamp(20rem,calc(100dvh-11rem),56rem)] max-h-[calc(100dvh-11rem)]";

export const govOhKicker =
  "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-[0.08em] text-primary";

export const govOhTitle =
  "mt-1.5 text-[1.35rem] font-bold tracking-tight text-foreground";

export const govOhLead =
  "mt-2 max-w-2xl text-[13px] leading-relaxed text-muted-foreground";

export const govOhCard = "rounded-[calc(var(--radius)+6px)] border border-border bg-card p-4";

export const govOhLabel =
  "mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-muted-foreground";

export const govOhMuted = "m-0 text-[13px] text-muted-foreground";

export const govOhMono =
  "break-all font-mono text-[11px] text-muted-foreground";

export const govOhBannerError =
  "rounded-[var(--radius)] border border-border bg-destructive/10 px-3.5 py-2.5 text-[13px] text-destructive";

export const govOhSuggestion =
  "grid cursor-pointer grid-cols-[1fr_auto_1fr_auto] items-center gap-2.5 rounded-[var(--radius)] border border-border bg-background p-2.5 text-left text-foreground transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))]";

export const govVocabTreeRow =
  "vocab-tree-row flex cursor-pointer select-none items-center border-b border-border px-2 transition-colors hover:bg-[color-mix(in_oklch,var(--primary)_7%,var(--card))] data-[selected=true]:bg-primary/10";
