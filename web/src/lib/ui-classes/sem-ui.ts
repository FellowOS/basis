/**
 * Explorer `sem-*` surfaces (replaces `sem-components.css` rules used from TSX).
 */

export const semSurface =
  "min-w-0 rounded-[calc(var(--radius)+4px)] border border-border bg-card/95 shadow backdrop-blur-md";

export const semSurfaceSubtle = "bg-card/90";

export const semSurfaceBody = "p-3.5";

export const semSurfaceBodyTight = "p-2.5";

export const semInspector = "h-full overflow-auto bg-card text-foreground";

export const semEmptyState =
  "flex min-h-[240px] h-full flex-col items-center justify-center px-7 py-7 text-center text-muted-foreground";

export const semEmptyStateTitle = "my-3.5 mb-1.5 text-base font-bold text-foreground";

export const semEmptyStateCopy = "max-w-[42ch] text-[13px] leading-relaxed text-muted-foreground";

export const semWorkspaceFrame =
  "flex min-h-0 w-full min-w-0 flex-1 flex-col gap-3";

export const semGridTwo =
  "grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(0,1.12fr)_minmax(320px,0.88fr)]";

export const semGridSplit =
  "grid min-h-0 flex-1 grid-cols-1 gap-4 min-[1180px]:grid-cols-[minmax(280px,360px)_minmax(0,1fr)]";
