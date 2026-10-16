import { en } from "@/i18n/locales/en/index.js";
import { fmt } from "@/i18n/format.js";
import type { Locale } from "@/i18n/locale.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";

export type GraphWorkspaceLocale = Locale;

export type GraphWorkspaceCopyKey = keyof typeof en.kbGraphWorkspace.workspace;

function pack(locale: GraphWorkspaceLocale) {
  return messagesForLocale(locale).kbGraphWorkspace;
}

export function graphCopy(locale: GraphWorkspaceLocale, key: GraphWorkspaceCopyKey): string {
  return pack(locale).workspace[key];
}

export function graphEgoModeLabel(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoMode");
  }
  return fmt(pack(locale).helpers.egoModeActiveLabel, { hops: String(hops) });
}

export function graphEgoModeTitle(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoModeTitleOff");
  }
  return fmt(pack(locale).helpers.egoModeActiveTitle, { hops: String(hops) });
}

export function graphStatusCounts(
  locale: GraphWorkspaceLocale,
  nodes: number,
  edges: number,
): string {
  return fmt(pack(locale).helpers.statusCounts, {
    nodes: nodes.toLocaleString(),
    edges: edges.toLocaleString(),
  });
}

export function graphActiveCountLabel(locale: GraphWorkspaceLocale, count: number): string {
  return fmt(pack(locale).helpers.activeCount, { count: count.toLocaleString() });
}

export function graphSearchResultsLabel(locale: GraphWorkspaceLocale, count: number): string {
  const h = pack(locale).helpers;
  const template = count === 1 && locale !== "zh" ? h.searchResultsOne : h.searchResults;
  return fmt(template, { count: String(count) });
}

export function graphFocusedViewSummary(
  locale: GraphWorkspaceLocale,
  visibleNeighbors: number,
): string {
  const total = visibleNeighbors + 1;
  return fmt(pack(locale).helpers.focusedViewSummary, { total: String(total) });
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
    visible: String(visible),
    collapsed: String(collapsed),
  });
}

export function graphDirectNeighborsSummary(
  locale: GraphWorkspaceLocale,
  count: number,
): string {
  return fmt(pack(locale).helpers.directNeighborsSummary, { count: String(count) });
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
  const loadedStr = loaded.toLocaleString();
  if (total) {
    return fmt(h.loadNodesProgress, {
      loaded: loadedStr,
      total: total.toLocaleString(),
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
  const loadedStr = loaded.toLocaleString();
  if (total) {
    return fmt(h.loadEdgesProgress, {
      loaded: loadedStr,
      total: total.toLocaleString(),
    });
  }
  return fmt(h.loadEdgesProgressPartial, { loaded: loadedStr });
}
