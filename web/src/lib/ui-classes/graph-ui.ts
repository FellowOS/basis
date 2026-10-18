/**
 * Graph workspace chrome (`graph*`) + small runtime style helpers.
 * Explorer-wide bundles: `lib/ui-classes/explorer-ws.ts`.
 */

import type { CSSProperties } from "react";

import { cn } from "@/lib/utils.js";

export const graphPluginLoading =
  "p-4 text-sm text-muted-foreground";

export const graphSuspenseFallback =
  "flex items-center justify-center p-6 text-sm text-muted-foreground";

export const graphShell =
  "palantir-bg relative h-full w-full overflow-hidden";

export const graphLegendPanel = "flex flex-col gap-3";

export const graphLegendEyebrow =
  "text-[11px] font-bold uppercase tracking-wide text-muted-foreground";

export const graphLegendRow =
  "flex items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-2.5 py-2";

export const graphLegendSwatch = "size-2.5 shrink-0 rounded-full";

export const graphLegendTitle =
  "truncate text-sm font-semibold text-foreground";

export const graphLegendMeta = "text-xs text-muted-foreground";

export const graphLegendEmpty = "text-xs leading-relaxed text-muted-foreground";

export const graphPanelTitle = "text-sm font-bold text-foreground";

export const graphPanelSummary = graphLegendEmpty;

export const graphPanelControlBtn =
  "rounded-[10px] border border-border bg-muted/40 px-2.5 py-1.5 text-xs text-foreground enabled:cursor-pointer disabled:cursor-not-allowed disabled:opacity-50";

export const graphNeighborBtn =
  "flex w-full cursor-pointer items-center gap-2.5 rounded-xl border border-border bg-muted/30 px-2.5 py-2 text-left transition-colors hover:bg-muted/50";

export const graphTemporalChip =
  "pointer-events-none absolute bottom-[26px] left-[140px] inline-flex items-center gap-2.5 rounded-full border border-primary/20 bg-card/90 px-3 py-2 text-[11px] uppercase tracking-wide text-foreground shadow-md backdrop-blur-sm";

export const graphTemporalChipAccent = "font-bold text-primary";

export const graphDetailRow =
  "flex justify-between gap-4 rounded-xl border border-border bg-muted/30 px-2.5 py-2";

export const graphDetailLabel = "text-xs text-muted-foreground";

export const graphDetailValue = "text-xs font-semibold text-foreground";

export const graphLoaderMetric =
  "inline-flex items-center gap-1.5 rounded-full border border-border bg-muted px-2.5 py-1.5 text-[11px] font-semibold text-muted-foreground";

export const graphLoaderMetricAccent =
  "inline-flex items-center gap-1.5 rounded-full border border-primary/25 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-foreground";

export const graphTimelineShell =
  "relative flex h-[90px] w-full shrink-0 items-stretch border-t border-border bg-card/85 backdrop-blur-md";

export const graphTimelineControls =
  "flex min-w-20 shrink-0 flex-col items-center justify-center gap-1 border-r border-border px-4";

export const graphTimelinePlayBtn =
  "flex size-[34px] cursor-pointer items-center justify-center rounded-full border-[1.5px] border-border bg-muted text-primary transition-all duration-200";

export const graphTimelinePlayBtnActive =
  "border-ok/50 bg-ok/15 text-ok shadow-[0_0_10px_rgba(76,195,138,0.32)]";

export const graphTimelineDate =
  "font-mono text-[10px] tracking-wide text-muted-foreground transition-colors duration-200";

export const graphTimelineDateActive = "text-ok";

export const graphTimelineLabel =
  "pointer-events-none absolute left-[100px] top-1.5 z-[2] text-[10px] font-semibold uppercase tracking-widest text-muted-foreground";

export const graphTimelineVisHost = "sem-timeline-wrap relative min-h-0 flex-1 overflow-hidden";

export const graphTimelineCanvasHost = "relative h-full w-full";

export const graphCanvasRoot = "relative z-0 h-full w-full";

export const graphCanvasHost = "relative z-0 h-full w-full bg-transparent";

export const graphCanvasOverlay = "pointer-events-none absolute left-0 top-0 z-[4]";

export const graphPluginOverlayLayer =
  "pointer-events-none absolute inset-0 z-[6]";

export const graphPluginOverlaySlot = "absolute inset-0";

export const graphFitViewBtn =
  "absolute bottom-6 left-6 z-10 cursor-pointer rounded-[10px] border border-border bg-primary px-4 py-2 text-xs font-bold text-primary-foreground shadow-md backdrop-blur-sm hover:opacity-90";

export const graphEffectsSection =
  "flex flex-col gap-2 rounded-[14px] border border-border bg-muted/30 px-3 py-2.5";

export const graphEffectsSectionTitle = "text-xs font-bold text-foreground";

export const graphEffectsSubsectionTitle =
  "text-[11px] font-bold uppercase tracking-wide text-primary/90";

export const graphEffectsToggleRow = "flex items-center gap-3 py-2";

export const graphEffectsRowDesc = "text-xs leading-snug text-muted-foreground";

export const graphEffectsRowMeta = "text-[11px] leading-snug text-primary/80";

export const graphEffectsToggleBtn =
  "min-w-[52px] cursor-pointer rounded-full border border-border bg-muted/40 px-2.5 py-2 text-xs font-bold text-foreground";

export const graphEffectsToggleBtnOn =
  "border-primary/30 bg-primary/15 text-foreground";

export const graphEffectsSignalRow =
  "flex items-center gap-2.5 rounded-xl border border-border/80 bg-muted/20 px-2.5 py-2";

export const graphEffectsSignalBadge =
  "whitespace-nowrap rounded-full border border-primary/20 bg-primary/10 px-2 py-1 text-[11px] font-bold text-foreground";

export const graphEffectsDetails =
  "overflow-hidden rounded-xl border border-border/80 bg-muted/30";

export const graphEffectsDetailsSummary =
  "cursor-pointer px-3 py-2.5 text-xs font-bold uppercase tracking-wide text-muted-foreground";

export const graphEffectsPre =
  "m-0 whitespace-pre-wrap break-words px-3 pb-3 text-[11px] leading-snug text-foreground";

export function metricToneClass(value: number, good = 0.6, warn = 0.3) {
  if (value > good) return "text-ok";
  if (value > warn) return "text-warn";
  return "text-destructive";
}

export function metricBarToneClass(value: number, good = 0.6, warn = 0.3) {
  if (value > good) return "bg-ok";
  if (value > warn) return "bg-warn";
  return "bg-destructive";
}

/** Dynamic semantic group / node color swatch (legend, effects, dock). */
export function graphSemanticSwatchStyle(color: string): CSSProperties {
  return {
    background: color,
    boxShadow: [
      "0 0 0 1px color-mix(in oklch, var(--foreground) 6%, transparent)",
      `0 0 16px color-mix(in srgb, ${color} 27%, transparent)`,
    ].join(", "),
  };
}

/** Inspector node header accent dot. */
export function graphNodeAccentDotStyle(color: string): CSSProperties {
  return {
    background: color,
    boxShadow: `0 0 0 1px color-mix(in srgb, ${color} 35%, transparent)`,
  };
}

/** Progress bar fill width; `ratio` is 0–1. */
export function graphProgressWidthStyle(ratio: number): CSSProperties {
  const pct = Math.max(0, Math.min(100, ratio * 100));
  return { width: `${pct}%` };
}

export function pathDistanceBandBadgeClass(band: string) {
  return cn(
    "border-transparent font-semibold",
    band === "direct" && "border-ok/30 bg-ok/10 text-ok",
    band === "near" && "border-primary/30 bg-primary/10 text-primary",
    band === "mid-range" && "border-warn/30 bg-warn/10 text-warn",
    band === "distant" && "border-destructive/30 bg-destructive/10 text-destructive",
    band !== "direct" &&
      band !== "near" &&
      band !== "mid-range" &&
      band !== "distant" &&
      "border-border bg-muted text-muted-foreground",
  );
}
