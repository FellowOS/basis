/** Shared Tailwind classes for ontology explorer panels (Basis theme, no Explorer navy palette). */

export const ontPageScroll = "flex h-full flex-col overflow-auto bg-background p-5";

export const ontHero =
  "flex flex-wrap justify-between gap-4 rounded-2xl border border-border bg-card p-5 shadow-sm";

export const ontTitle = "my-2 text-2xl font-bold tracking-tight text-foreground";

export const ontLead = "m-0 max-w-2xl text-sm leading-relaxed text-muted-foreground";

export const ontCard = "rounded-2xl border border-border bg-card p-4 shadow-sm";

export const ontSectionTitle = "mb-3.5 text-base font-semibold text-foreground";

export const ontInput =
  "w-full rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground";

export const ontRowCard =
  "rounded-xl border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50";

export const ontBtnSecondary =
  "inline-flex cursor-pointer items-center justify-center gap-2 rounded-xl border border-border bg-muted/50 px-3 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-muted";

export const ontBtnSmall =
  "inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1.5 text-xs font-bold text-foreground hover:bg-muted";

export const ontMuted = "text-sm text-muted-foreground";

export const ontStrong = "font-semibold text-foreground";

export const ontSplitShell = "flex h-full min-h-0 bg-background";

export const ontSidebar =
  "flex w-[min(360px,38vw)] min-w-[280px] shrink-0 flex-col border-r border-border bg-muted/20";

export const ontMainPane = "flex min-h-0 min-w-0 flex-1 flex-col";

export const ontPanelHeader = "shrink-0 border-b border-border px-4 py-3";

export const ontCodeBlock =
  "max-h-40 overflow-auto rounded-md border bg-muted/50 p-3 font-mono text-xs text-foreground";

export const ontKicker =
  "inline-flex items-center gap-2 text-[11px] font-bold uppercase tracking-widest text-primary";

export const ontLabel =
  "mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

export const ontErrorBanner =
  "rounded-xl border border-destructive/20 bg-destructive/10 px-3 py-2.5 text-sm text-destructive";

export const ontManagerShell = "flex min-h-0 flex-1 w-full flex-col overflow-hidden bg-background";

export const ontManagerToolbar =
  "flex shrink-0 flex-wrap items-center gap-2.5 border-b border-border bg-card px-4 py-3";

export const ontManagerSearchBox =
  "flex w-[280px] shrink-0 items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 py-1.5";

export const ontManagerSearchInput =
  "w-full border-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground";

export const ontManagerMain = "flex min-h-0 flex-1 overflow-hidden";

export const ontManagerListPanel = "min-w-0 flex-1 overflow-y-auto border-r border-border";

export const ontManagerRightPanel =
  "flex w-[360px] shrink-0 flex-col overflow-hidden border-l border-border bg-card";

export const ontManagerRightHeader =
  "flex shrink-0 items-center justify-between border-b border-border px-4 py-3.5";

export const ontManagerCentered = "flex h-full flex-col items-center justify-center p-10";

export const ontManagerList = "flex flex-col gap-2 px-3.5 py-3";

export const ontManagerListHeader = "pb-1.5 text-xs font-bold text-muted-foreground";

export const ontManagerRow =
  "flex cursor-pointer items-center gap-3.5 rounded-xl border px-3.5 py-3 transition-colors";

export const ontManagerRowMain = "flex min-w-0 flex-1 flex-col gap-1";

export const ontManagerRowName = "text-sm font-bold text-foreground";

export const ontManagerRowUri =
  "truncate font-mono text-[11px] text-muted-foreground";

export const ontManagerRowStats = "flex shrink-0 gap-4";

export const ontManagerRowActions = "flex shrink-0 gap-1";

export const ontManagerActionBtn =
  "grid cursor-pointer place-items-center rounded-md border-0 bg-transparent p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground";

export const ontManagerSourceLink =
  "inline-flex items-center gap-1 text-[11px] text-primary no-underline hover:underline";

export const ontManagerDetailBody = "flex flex-1 flex-col gap-0 overflow-y-auto px-4 py-3.5";

export const ontManagerStatRow = "mb-1 mt-3 flex gap-1.5";

export const ontManagerTagChip =
  "rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground";

export const ontManagerDisabledBadge =
  "rounded-full border border-border bg-muted px-1.5 py-0.5 text-[10px] font-bold text-muted-foreground";

export const ontManagerBrowseBtn =
  "inline-flex cursor-pointer items-center gap-1 rounded-md border border-border bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary";

export const ontManagerCloseBtn =
  "cursor-pointer border-0 bg-transparent p-0 text-lg leading-none text-muted-foreground hover:text-foreground";

export const ontStatValue = "text-sm font-extrabold text-foreground";

export const ontStatLabel = "text-[10px] text-muted-foreground";

/** Badge chips (status / format) — pair with `ontBadgeBase`. */
export const ontBadgeBase =
  "rounded-full border px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide";

export const ontFormatBadgeClass: Record<string, string> = {
  turtle: "border-ok/25 bg-ok/10 text-ok",
  xml: "border-destructive/25 bg-destructive/10 text-destructive",
  "json-ld": "border-warn/25 bg-warn/10 text-warn",
  nt: "border-primary/25 bg-primary/10 text-primary",
};

export const ontFormatBadgeFallback =
  "border-primary/30 bg-primary/10 text-primary";

/** OntologyLoader dialog panels */
export const ontLoaderPanelBody = "flex flex-col gap-3.5";

export const ontLoaderFieldGroup = "flex flex-col gap-1.5";

export const ontLoaderSelect =
  "w-full cursor-pointer appearance-none rounded-xl border border-input bg-background px-3 py-2.5 text-sm text-foreground";

export const ontLoaderTextarea =
  "w-full resize-y rounded-xl border border-input bg-background px-3 py-2.5 font-mono text-sm text-foreground";

export const ontLoaderPreviewCard =
  "rounded-xl border border-ok/20 bg-ok/5 p-3.5";

export const ontLoaderPreviewTitle =
  "text-[15px] font-extrabold tracking-tight text-foreground";

export const ontLoaderPreviewGrid = "mt-3 grid grid-cols-2 gap-2.5";

export const ontLoaderPreviewMetaLabel =
  "text-[10px] font-bold uppercase tracking-wide text-muted-foreground";

export const ontLoaderPreviewMetaValue =
  "break-all text-[11px] text-muted-foreground";

export const ontLoaderPreviewMetaValueMono =
  "break-all font-mono text-[11px] text-muted-foreground";

export const ontLoaderDropzone =
  "flex cursor-pointer flex-col items-center gap-2.5 rounded-xl border-2 border-dashed border-border px-5 py-8 transition-colors";

export const ontLoaderDropzoneActive = "border-primary/50 bg-primary/5";

export const ontLoaderSuccessBox =
  "flex items-center gap-2 rounded-lg border border-ok/25 bg-ok/10 px-3 py-2 text-xs text-ok";

export const ontLoaderErrorBox =
  "flex items-center gap-2 rounded-lg border border-destructive/25 bg-destructive/10 px-3 py-2 text-xs text-destructive";

export const ontLoaderAdvancedToggle =
  "inline-flex cursor-pointer items-center gap-1.5 border-0 bg-transparent p-0 text-xs text-muted-foreground";

export const ontLoaderModeTab =
  "cursor-pointer rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors";

export const ontLoaderModeTabIdle =
  "border-border bg-transparent text-muted-foreground";

export const ontLoaderModeTabActive =
  "border-primary/25 bg-primary/15 text-foreground";

/** OntologySearch (registry side panel) */
export const ontSearchShell = "flex h-full flex-col overflow-hidden";

export const ontSearchTop = "flex shrink-0 flex-col gap-2 border-b border-border px-3.5 py-3";

export const ontSearchBar =
  "flex items-center gap-2 rounded-lg border border-input bg-muted/40 px-3 py-1.5";

export const ontSearchInput =
  "min-w-0 flex-1 border-0 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground";

export const ontSearchClearBtn =
  "grid cursor-pointer place-items-center border-0 bg-transparent p-0.5 text-muted-foreground hover:text-foreground";

export const ontSearchFilterBtn =
  "cursor-pointer rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors";

export const ontSearchFilterIdle = "border-border bg-transparent text-muted-foreground";

export const ontSearchFilterActive = "border-primary/35 bg-primary/15 text-foreground";

export const ontSearchBody = "flex min-h-0 flex-1 overflow-hidden";

export const ontSearchResults = "min-w-0 flex-1 overflow-y-auto";

export const ontSearchHint = "flex h-full flex-col items-center justify-center p-8";

export const ontSearchResultList = "flex flex-col gap-1.5 p-3";

export const ontSearchResultRow =
  "flex cursor-pointer flex-col gap-1 rounded-[10px] border px-3.5 py-2.5 transition-colors";

export const ontSearchResultSelected = "border-primary/30 bg-primary/10";

export const ontSearchResultIdle = "border-border bg-muted/20 hover:bg-muted/40";

export const ontSearchDetailPanel =
  "flex w-80 shrink-0 flex-col overflow-hidden border-l border-border bg-muted/30";

export const ontSearchDetailHeader =
  "flex shrink-0 items-center justify-between border-b border-border px-3.5 py-3";

export const ontSearchDetailBody = "flex flex-1 flex-col overflow-y-auto p-3.5";

export const ontSearchCollapseBtn =
  "flex w-full cursor-pointer items-center gap-1 border-0 bg-transparent p-0 py-1.5 text-left text-xs font-semibold text-muted-foreground";

export const ontSearchDetailSection =
  "mt-2.5 border-t border-border/60 pt-2.5";

export const ontSearchDetailSectionLabel =
  "mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground";

export const ontSearchOpenUri =
  "mt-3.5 inline-flex items-center gap-1 text-[11px] text-primary no-underline hover:underline";

export const ontEntityTypeBadgeClass: Record<string, string> = {
  class: "border-primary/25 bg-primary/10 text-primary",
  property: "border-warn/25 bg-warn/10 text-warn",
  individual: "border-ok/25 bg-ok/10 text-ok",
  concept: "border-primary/30 bg-primary/10 text-primary",
  scheme: "border-primary/30 bg-primary/10 text-primary",
};

export const ontEntityTypeBadgeFallback =
  "border-border bg-muted text-muted-foreground";

/** Alignments matrix */
export const ontAlignMatrixWrap = "overflow-x-auto";

export const ontAlignMatrixTable = "min-w-full border-collapse text-xs";

export const ontAlignMatrixCorner = "border-b border-border px-3 py-2";

export const ontAlignMatrixColHeader =
  "whitespace-nowrap border-b border-border px-3 py-2 text-center font-bold text-primary";

export const ontAlignMatrixRowHeader =
  "whitespace-nowrap border-r border-border px-3 py-2 font-bold text-primary";

export const ontAlignMatrixCell =
  "min-w-[100px] border-b border-r border-border px-2.5 py-2 text-center align-middle";

export const ontAlignMatrixCellDiag = "bg-muted/50";

export const ontAlignRelationBadge =
  "inline-block cursor-pointer rounded-full border px-2 py-0.5 text-[9px] font-black";

export const ontAlignRelationClass: Record<string, string> = {
  "owl:equivalentClass": "border-ok/40 text-ok",
  "owl:equivalentProperty": "border-ok/40 text-ok",
  "skos:exactMatch": "border-ok/35 text-ok",
  "skos:closeMatch": "border-primary/35 text-primary",
  "skos:broadMatch": "border-warn/35 text-warn",
  "skos:narrowMatch": "border-warn/35 text-warn",
  "skos:relatedMatch": "border-primary/25 text-primary",
};

export const ontAlignRelationBadgeLg =
  "rounded-full border px-2.5 py-1 text-[10px] font-black";

export const ontAlignList = "flex flex-col gap-2";

export const ontAlignSuggestList =
  "mt-3.5 flex max-h-64 flex-col gap-2 overflow-auto";

export const ontSkosChip =
  "rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] text-muted-foreground";

export const ontSkosChipHidden =
  "rounded-full border border-border bg-muted/40 px-2 py-0.5 text-[11px] italic text-muted-foreground opacity-50";

/** SKOS Vocabulary Manager (mirrors ontSearch* layout tokens) */
export const ontSkosShell = "flex h-full flex-col overflow-hidden";

export const ontSkosToolbar = "shrink-0 border-b border-border px-3 py-2.5";

export const ontSkosSearchBar =
  "flex items-center gap-1.5 rounded-lg border border-input bg-muted/40 px-2.5 py-1.5";

export const ontSkosSearchInput =
  "min-w-0 flex-1 border-0 bg-transparent text-xs text-foreground outline-none placeholder:text-muted-foreground";

export const ontSkosBody = "flex min-h-0 flex-1 overflow-hidden";

export const ontSkosTreeCol = "min-w-0 flex-1 overflow-y-auto px-1.5 py-2";

export const ontSkosDetailPanel =
  "flex w-[300px] shrink-0 flex-col overflow-hidden border-l border-border bg-muted/30";

export const ontSkosDetailHeader =
  "flex shrink-0 items-center justify-between border-b border-border px-3.5 py-3";

export const ontSkosDetailBody = "flex flex-1 flex-col overflow-y-auto p-3.5";

export const ontSkosCentered =
  "flex h-full flex-col items-center justify-center p-6";

export const ontSkosEmptyState =
  "flex h-full flex-col items-center justify-center p-7 text-center";

export const ontSkosSchemePanel =
  "mb-2 overflow-hidden rounded-[10px] border border-border bg-muted/20";

export const ontSkosSchemeHeaderBtn =
  "flex w-full cursor-pointer items-center justify-between border-0 border-b border-border/60 bg-transparent px-3 py-2.5";

export const ontSkosSchemeTitle = "text-sm font-bold text-foreground";

export const ontSkosExpandBtn =
  "flex w-[18px] shrink-0 cursor-pointer items-center border-0 bg-transparent p-0 text-muted-foreground";

export const ontSkosTreeSpacer = "inline-block w-[18px] shrink-0";

export const ontSkosTreeRow =
  "flex cursor-pointer items-center gap-1 rounded-md py-1.5 pr-2.5 transition-colors hover:bg-primary/5";

export const ontSkosTreeRowSelected = "bg-primary/10 hover:bg-primary/10";

export const ontSkosTreeCount = "shrink-0 text-[10px] text-muted-foreground";

export const ontSkosUriLink = "cursor-help font-mono text-[11px] text-primary";

export const ontSkosNavLink =
  "inline-flex cursor-pointer items-center gap-1 border-0 bg-transparent p-0 text-left hover:opacity-80";

export const ontSkosIconBtn =
  "grid cursor-pointer place-items-center border-0 bg-transparent p-0.5 text-muted-foreground hover:text-foreground";

export const ontSkosPropSection = "mt-2.5 border-t border-border/60 pt-2.5";

export const ontSkosPropSectionLabel =
  "mb-1 text-[10px] font-bold uppercase tracking-wide text-muted-foreground";

export const ontSkosDetailTitle =
  "mb-1 text-[17px] font-extrabold tracking-tight text-foreground";

export const ontSkosUriMono = "break-all font-mono text-[10px] text-muted-foreground";

export const ontSkosBodyText = "m-0 text-sm leading-relaxed text-muted-foreground";

export const ontSkosNoteText = "m-0 text-xs leading-normal text-muted-foreground";

export const ontSkosLoadingRow = "flex items-center gap-2 px-5 py-2.5";

export const ontSkosErrorInset = "mx-2.5 mb-2.5";

export const ontSkosChipRow = "mb-1.5 flex flex-wrap gap-1";

/** Vocabulary workspace property panel */
export const ontVocabEmptyTitle = "mb-1 text-[15px] font-semibold text-foreground";

export const ontVocabPropHeader = "mb-5 border-b border-border pb-4";

export const ontVocabPropKicker = "oh-kicker mb-2";

export const ontVocabPropTitle = "oh-title break-words text-xl";

export const ontVocabPropUri =
  "oh-mono mb-5 rounded-[var(--radius)] border border-border bg-muted/30 px-3 py-2";

export const ontVocabPropSection = "mb-6";

export const ontVocabPropChipRow = "flex flex-wrap gap-2";

export const ontVocabPropAltChip = "ws-pill ws-pill--mono text-[13px] px-2.5 py-1";

export const ontVocabPropBody = "oh-muted leading-relaxed";

export const ontVocabPropCard = "oh-card p-3.5";

export const ontVocabPropCardLabel = "oh-label mt-0";

export const ontVocabPropNarrowerList = "flex flex-col gap-1.5";

export const ontVocabPropNarrowerItem =
  "rounded-md border border-border bg-background px-2.5 py-1.5 text-[13px] text-foreground";

export const ontVocabPropEmptyNarrower = "oh-muted italic";
