import { en } from "@/i18n/locales/en/index.js";
import {
  fmt,
  formatLocaleDateTime,
  formatLocaleNumber,
  formatLocaleYearMonth,
  pickCountForm,
  requestFailedStatusMessage,
} from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import type { GraphZoomTier } from "./graphTheme.js";

export type GraphWorkspaceLocale = Locale;

export type GraphWorkspaceCopyKey = keyof typeof en.kbGraphWorkspace.workspace;

function pack(locale: GraphWorkspaceLocale) {
  return messagesForLocale(locale).kbGraphWorkspace;
}

export function graphCopy(locale: GraphWorkspaceLocale, key: GraphWorkspaceCopyKey): string {
  return pack(locale).workspace[key];
}

export function graphFormatNumber(locale: GraphWorkspaceLocale, value: number): string {
  return formatLocaleNumber(locale, value);
}

export function graphFormatYearMonth(locale: GraphWorkspaceLocale, value: Date): string {
  return formatLocaleYearMonth(locale, value);
}

export function graphFormatTemporalInstant(
  locale: GraphWorkspaceLocale,
  raw: string | undefined,
  fallback: string,
): string {
  if (!raw) return fallback;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return raw;
  return formatLocaleDateTime(locale, date, { dateStyle: 'medium', timeStyle: 'short' });
}

export type GraphEntityShapeLabelKey = keyof typeof en.kbGraphWorkspace.entityShapeLabels;

export function graphEntityShapeLabel(
  locale: GraphWorkspaceLocale,
  shape: GraphEntityShapeLabelKey,
): string {
  return pack(locale).entityShapeLabels[shape];
}

export function graphNodeTypeLabel(locale: GraphWorkspaceLocale, type: string): string {
  const labels = pack(locale).entityShapeLabels as Record<string, string>;
  return labels[type] ?? type;
}

export function graphPluginCopy(locale: GraphWorkspaceLocale) {
  return pack(locale).plugins;
}

export type GraphRegistryLogKey = keyof typeof en.kbGraphWorkspace.registryLog;

export function graphRegistryLog(
  locale: GraphWorkspaceLocale,
  key: GraphRegistryLogKey,
  vars: Record<string, string>,
): string {
  return fmt(pack(locale).registryLog[key], vars);
}

export function graphLoadOverlayCopy(locale: GraphWorkspaceLocale) {
  return pack(locale).loadOverlay;
}

export function graphEffectReasonsCopy(locale: GraphWorkspaceLocale) {
  return pack(locale).effectReasons;
}

export function graphZoomTierLabel(
  locale: GraphWorkspaceLocale,
  tier: GraphZoomTier | string,
): string {
  const labels = pack(locale).effectReasons.zoomTierLabels;
  return labels[tier as keyof typeof labels] ?? tier;
}

export function graphEgoModeLabel(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoMode");
  }
  return fmt(pack(locale).helpers.egoModeActiveLabel, { hops: formatLocaleNumber(locale, hops) });
}

export function graphEgoModeTitle(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoModeTitleOff");
  }
  return fmt(pack(locale).helpers.egoModeActiveTitle, { hops: formatLocaleNumber(locale, hops) });
}

export function graphStatusCounts(
  locale: GraphWorkspaceLocale,
  nodes: number,
  edges: number,
): string {
  return fmt(pack(locale).helpers.statusCounts, {
    nodes: formatLocaleNumber(locale, nodes),
    edges: formatLocaleNumber(locale, edges),
  });
}

export function graphActiveCountLabel(locale: GraphWorkspaceLocale, count: number): string {
  return fmt(pack(locale).helpers.activeCount, { count: formatLocaleNumber(locale, count) });
}

export function graphSearchResultsLabel(locale: GraphWorkspaceLocale, count: number): string {
  const h = pack(locale).helpers;
  const template = pickCountForm(locale, count, h.searchResultsOne, h.searchResults);
  return fmt(template, { count: formatLocaleNumber(locale, count) });
}

export function graphFocusedViewSummary(
  locale: GraphWorkspaceLocale,
  visibleNeighbors: number,
): string {
  const total = visibleNeighbors + 1;
  return fmt(pack(locale).helpers.focusedViewSummary, { total: formatLocaleNumber(locale, total) });
}

export function graphGroupedSummaryAvailable(locale: GraphWorkspaceLocale): string {
  return pack(locale).helpers.groupedSummaryAvailable;
}

export function graphGroupedSummaryDrillIn(locale: GraphWorkspaceLocale): string {
  return pack(locale).helpers.groupedSummaryDrillIn;
}

export function graphNeighborSummary(
  locale: GraphWorkspaceLocale,
  visible: number,
  collapsed: number,
): string {
  return fmt(pack(locale).helpers.neighborSummary, {
    visible: formatLocaleNumber(locale, visible),
    collapsed: formatLocaleNumber(locale, collapsed),
  });
}

export function graphDirectNeighborsSummary(
  locale: GraphWorkspaceLocale,
  count: number,
): string {
  return fmt(pack(locale).helpers.directNeighborsSummary, { count: formatLocaleNumber(locale, count) });
}

export function graphPluginPanelLoading(locale: GraphWorkspaceLocale, label: string): string {
  return fmt(pack(locale).helpers.pluginPanelLoading, { label });
}

export function graphRequestFailed(locale: GraphWorkspaceLocale, status: number): string {
  return requestFailedStatusMessage(locale, status);
}

export function graphLoadPhaseTitle(locale: GraphWorkspaceLocale, phase: string): string {
  const titles = pack(locale).loadPhaseTitle as Record<string, string>;
  return titles[phase] ?? titles.bootstrapping;
}

export function graphLoadStageLabel(locale: GraphWorkspaceLocale, phase: string): string {
  const labels = pack(locale).loadStageLabel as Record<string, string>;
  return labels[phase] ?? pack(locale).helpers.loadStageFallback;
}

export function graphLoadNodesProgressMessage(
  locale: GraphWorkspaceLocale,
  loaded: number,
  total: number | null,
): string {
  const h = pack(locale).helpers;
  const loadedStr = formatLocaleNumber(locale, loaded);
  if (total) {
    return fmt(h.loadNodesProgress, {
      loaded: loadedStr,
      total: formatLocaleNumber(locale, total),
    });
  }
  return fmt(h.loadNodesProgressPartial, { loaded: loadedStr });
}

export function graphLoadEdgesProgressMessage(
  locale: GraphWorkspaceLocale,
  loaded: number,
  total: number | null,
): string {
  const h = pack(locale).helpers;
  const loadedStr = formatLocaleNumber(locale, loaded);
  if (total) {
    return fmt(h.loadEdgesProgress, {
      loaded: loadedStr,
      total: formatLocaleNumber(locale, total),
    });
  }
  return fmt(h.loadEdgesProgressPartial, { loaded: loadedStr });
}
