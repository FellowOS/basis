/**
 * Tailwind class bundles for Explorer workspaces (Ontology, SPARQL, Reasoning, etc.).
 *
 * Convention: put shared Explorer chrome here — not inline `style=`. Workspace-local
 * bundles may live next to the workspace (e.g. `ontologyUiClasses.ts`). Graph canvas/HUD
 * chrome belongs in `lib/graph/graph-ui-classes.ts`.
 */

export const exWsPage = "ws-page min-h-0";

export const exWsPageRow = "ws-page flex min-h-0 flex-row";

export const exWsSideHeader = "shrink-0 border-b border-border px-5 py-4";

export const exWsSideSection = "shrink-0 border-b border-border px-4 py-3";

export const exWsHeroIcon =
  "grid h-8 w-8 shrink-0 place-items-center rounded-[10px] border border-border bg-primary/10 text-primary";

export const exWsHeroTitle = "text-[15px] font-bold leading-tight text-foreground";

export const exWsEyebrowMb = "ws-eyebrow mb-2";

export const exWsRuleRow =
  "flex items-center gap-2 rounded-[var(--ws-radius-sm)] border border-border bg-card px-2 py-1.5";

export const exWsHint = "text-[11px] leading-snug text-muted-foreground";

export const exWsPaddedCol = "ws-scroll ws-padded flex flex-col gap-4";

export const exWsResultsHeader =
  "flex shrink-0 items-center gap-2.5 border-b border-border px-6 py-4";

export const exWsResultsHeading = "text-[15px] font-bold text-foreground";

export const exWsResultsMeta = "ml-auto flex flex-wrap gap-1.5";

export const exWsRunRulesCard =
  "mb-3.5 rounded-[var(--ws-radius-sm)] border border-border bg-muted/40 p-3.5";

export const exWsProofCard =
  "rounded-[var(--ws-radius-sm)] border border-border bg-card p-3.5";

export const exWsProofConclusion = "mb-2 block break-all font-mono text-xs text-ok";

export const exWsFactRow =
  "flex items-start gap-2.5 rounded-[var(--ws-radius-sm)] border border-border bg-card p-3.5";

export const exWsFactIcon =
  "mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-md border border-ok/30 bg-ok/10 text-ok";

export const exWsMonoCode = "break-all font-mono text-xs leading-relaxed text-foreground";

export const exWsMonoMuted = "break-all font-mono text-[11px] leading-normal text-muted-foreground";

export const exWsApplyLabel =
  "flex cursor-pointer items-center gap-2.5 rounded-[var(--ws-radius-sm)] border border-border p-2.5 has-[:disabled]:cursor-not-allowed has-[:disabled]:opacity-65";

export const exWsApplyLabelOn = "bg-ok/10";

export const exWsApplyLabelOff = "bg-card";

export const exWsSkeletonTall = "ws-skeleton h-[52px]";

export const exWsImportPage = "ws-padded mx-auto flex w-full max-w-[980px] flex-col gap-6";

export const exWsImportGrid = "grid grid-cols-1 gap-[18px] md:grid-cols-2";

export const exWsImportCard = "ws-card flex flex-col gap-[18px] p-6";

export const exWsCardTitleRow = "flex items-center gap-2 text-sm font-bold text-foreground";

export const exWsPageHero = "flex items-center gap-3.5";

export const exWsPageHeroIcon =
  "grid h-[42px] w-[42px] shrink-0 place-items-center rounded-[13px] border border-border bg-primary/10 text-primary";

export const exWsDropzone =
  "flex cursor-pointer flex-col items-center gap-2.5 rounded-[var(--ws-radius)] border-2 border-dashed border-border bg-muted/40 p-8 text-center transition-all duration-200";

export const exWsDropzoneActive = "border-primary bg-primary/10";

/** Compact vocabulary import dropzone (sidebar) */
export const exWsVocabImportDropzone =
  "flex cursor-pointer flex-col items-center rounded-[var(--ws-radius)] border-2 border-dashed border-border bg-background px-3 py-4 text-center transition-all duration-200";

export const exWsVocabImportDropzoneActive = "border-primary bg-primary/10";

export const exWsVocabImportStateCol = "flex flex-col items-center";

export const exWsVocabImportStateIcon = "mb-1.5";

export const exWsVocabImportSuccessCol = "flex flex-col items-center text-ok";

export const exWsVocabImportError =
  "mt-1.5 text-center text-[11px] text-destructive";

export const exWsVocabTreeShell = "h-full w-full overflow-hidden bg-transparent";

export const exWsVocabTreeRow =
  "vocab-tree-row flex cursor-pointer select-none items-center px-2";

export const exWsVocabTreeChevron = "flex w-5 shrink-0 justify-center";

export const exWsVocabTreeIcon = "mr-2 flex shrink-0 items-center";

export const exWsVocabTreeLabel =
  "min-w-0 truncate text-[13px] text-foreground";

export const exWsToastStack = "fixed bottom-7 right-7 z-[1000] flex flex-col gap-2.5";

export const exWsToast =
  "ws-animate-in flex items-center gap-2.5 rounded-[var(--ws-radius-sm)] border px-4 py-3 text-sm font-medium text-foreground shadow-lg backdrop-blur-md";

export const exWsToastSuccess = "border-ok/40 bg-ok/15";

export const exWsToastError = "border-destructive/40 bg-destructive/15";

export const exWsColFill = "flex min-h-0 flex-1 flex-col overflow-hidden";

export const exWsRowFill = "flex min-h-0 flex-1 flex-row overflow-hidden";

export const exWsToolbar =
  "flex shrink-0 flex-wrap items-center gap-2 border-b border-border bg-card px-4 py-2.5";

export const exWsToolbarGrow = "flex min-w-0 flex-1 flex-wrap items-center gap-1.5";

export const exWsSubToolbar =
  "flex shrink-0 items-center gap-2.5 border-b border-border px-4 py-2.5";

export const exWsPanelMuted = "flex min-h-0 flex-1 flex-col overflow-hidden bg-muted/20";

export const exWsScrollFill = "ws-scroll min-h-0 flex-1";

export const exWsEditorPane =
  "relative min-h-40 shrink basis-[42%] border-b border-border";

export const exWsEditorBadge =
  "absolute right-3 top-2 z-10 flex items-center gap-1.5";

export const exWsErrorBanner =
  "ws-animate-in m-4 flex gap-2.5 rounded-[var(--ws-radius-sm)] border border-destructive/30 bg-destructive/10 px-3.5 py-3 text-sm text-destructive";

export const exWsSkeletonStack = "flex flex-col gap-2 p-6";

export const exWsSkeletonRow = "ws-skeleton h-9";

export const exWsTableWrap = "ws-animate-in overflow-x-auto";

export const exWsDataTable = "w-full border-collapse text-xs text-foreground";

export const exWsTh =
  "px-3.5 py-2 text-left font-mono text-[11px] font-bold tracking-wide text-muted-foreground";

export const exWsThIndex = `${exWsTh} w-10`;

export const exWsTd = "max-w-[300px] truncate px-3.5 py-1.5 font-mono";

export const exWsTdIndex = "px-3.5 py-1.5 font-mono text-[11px] text-muted-foreground";

export const exWsTr = "border-b border-border/60";

export const exWsUriCell = "text-ok";

export const exWsNullCell = "italic text-muted-foreground";

export const exWsResultsTitle =
  "flex items-center gap-1.5 text-sm font-bold text-muted-foreground";

export const exWsSplitSidebar =
  "flex w-[min(480px,42vw)] min-w-[320px] shrink-0 flex-col overflow-hidden border-r border-border";

export const exWsSplitMain = "flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden";

export const exWsPaddedStack = "ws-scroll ws-padded flex flex-col gap-4";

export const exWsCardInset = "rounded-[var(--ws-radius-sm)] border border-border bg-muted/30 p-3.5";

export const exWsIconMuted = "shrink-0 text-muted-foreground";

export const exWsOutcomeBadge =
  "inline-block rounded-full border px-2 py-0.5 text-[10px] font-extrabold uppercase tracking-wider";

export const exWsOutcomeOk = "border-ok/30 bg-ok/10 text-ok";

export const exWsOutcomeBad = "border-destructive/30 bg-destructive/10 text-destructive";

export const exWsOutcomeWarn = "border-warn/30 bg-warn/10 text-warn";

export const exWsOutcomeMuted = "border-border bg-muted/40 text-muted-foreground";

export const exWsListCol = "flex flex-col gap-1";

export const exWsListSkeletonStack = "flex flex-col gap-1.5";

export const exWsListSkeletonRow = "ws-skeleton h-[58px]";

export const exWsChainSkeletonRow = "ws-skeleton h-[68px]";

export const exWsEmptyInset = "ws-empty px-3 py-7";

export const exWsListItemTitle = "mb-1.5 text-xs font-bold";

export const exWsListItemMeta = "flex flex-wrap items-center gap-1.5";

export const exWsCategoryHint = "text-[10px] text-muted-foreground";

export const exWsMainGlow =
  "pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_70%_20%,color-mix(in_oklab,var(--primary)_4%,transparent),transparent_55%)]";

export const exWsDetailSection = "mb-7";

export const exWsDetailHeaderRow =
  "mb-2.5 flex flex-wrap items-start justify-between gap-3";

export const exWsDetailActions = "flex items-center gap-2";

export const exWsChainCard = "ws-card p-5.5";

export const exWsChainCardHeader = "mb-5 flex items-center gap-2";

export const exWsChainSectionDot =
  "size-2 shrink-0 rounded-full bg-gradient-to-br from-primary to-warn shadow-[0_0_10px_color-mix(in_oklab,var(--primary)_40%,transparent)]";

export const exWsChainSectionTitle = "text-sm font-bold text-foreground";

export const exWsChainNode =
  "relative rounded-[var(--ws-radius)] border border-l-[3px] bg-card p-3.5";

export const exWsChainNodeTitle = "text-[13px] font-semibold text-foreground";

export const exWsChainEdgeCol = "flex flex-col items-center gap-0 py-0.5";

export const exWsChainEdgeLine = "h-2.5 w-0.5 bg-border";

export const exWsChainEdgePill =
  "flex max-w-[260px] items-center gap-1.5 rounded-full border border-border bg-primary/10 px-2.5 py-0.5";

export const exWsChainEdgeLabel =
  "truncate text-[10px] font-bold tracking-wide text-primary";

export const exWsChainFlowCol = "flex flex-col";

export const exWsCenterEmpty =
  "relative z-[1] flex flex-1 items-center justify-center";

export const exWsScrollLayer = "relative z-[1]";

/** Entity resolution (dedup pairs + merge history) */
export const exWsErPairCard =
  "rounded-[var(--ws-radius-sm)] border border-border bg-card px-3.5 py-3";

export const exWsErEntityChip =
  "inline-block rounded-lg border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-foreground";

export const exWsErExpandBtn =
  "flex cursor-pointer items-center rounded-md border-0 bg-transparent p-1 text-muted-foreground";

export const exWsErPairsCol =
  "ws-scroll flex flex-1 flex-col gap-2.5 overflow-y-auto p-4";

export const exWsErHistoryPanel =
  "ws-scroll w-60 shrink-0 overflow-y-auto border-l border-border p-4";

export const exWsErHistoryRow =
  "flex items-start gap-1.5 border-b border-border py-2";

export const exWsErHistorySummary =
  "truncate text-[11px] font-medium text-foreground";

export const exWsErHistoryTime = "text-[10px] text-muted-foreground";

export const exWsErScoreRow = "flex items-center gap-2";

export const exWsErScoreTrack =
  "h-1 flex-1 overflow-hidden rounded-full bg-muted";

export const exWsErScoreLabel =
  "min-w-[34px] text-right text-[11px] font-bold";

export const exWsErApprox = "text-xs font-bold text-warn";

export function exWsErScoreTone(score: number): { bar: string; text: string } {
  if (score >= 0.9) return { bar: "bg-destructive", text: "text-destructive" };
  if (score >= 0.75) return { bar: "bg-warn", text: "text-warn" };
  return { bar: "bg-ok", text: "text-ok" };
}
