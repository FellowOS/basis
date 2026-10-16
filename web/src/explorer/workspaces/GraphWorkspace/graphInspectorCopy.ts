import { en } from "@/i18n/locales/en/index.js";
import { fmt } from "@/i18n/format.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy.js";

export type InspectorCopyKey = keyof typeof en.kbGraphWorkspace.inspector;

function pack(locale: GraphWorkspaceLocale) {
  return messagesForLocale(locale).kbGraphWorkspace;
}

export function inspectorCopy(locale: GraphWorkspaceLocale, key: InspectorCopyKey): string {
  return pack(locale).inspector[key];
}

export function inspectorCanonicalNodeLine(
  locale: GraphWorkspaceLocale,
  nodeId: string,
): string {
  return fmt(pack(locale).helpers.inspectorCanonicalNode, { nodeId });
}

export function inspectorPathBandBadge(
  locale: GraphWorkspaceLocale,
  band: string,
  hops: number,
): string {
  const h = pack(locale).helpers;
  const bandMap: Record<string, string> = {
    direct: h.inspectorPathBandDirect,
    near: h.inspectorPathBandNear,
    "mid-range": h.inspectorPathBandMid,
    distant: h.inspectorPathBandDistant,
  };
  const bandLabel = bandMap[band] ?? band;
  const hopTemplate = hops === 1 && locale !== "zh" ? h.inspectorPathBandHopsOne : h.inspectorPathBandHops;
  const hopPart = fmt(hopTemplate, { hops: String(hops) });
  return `${bandLabel} · ${hopPart}`;
}

export function inspectorAltPathsBadge(locale: GraphWorkspaceLocale, count: number): string {
  const h = pack(locale).helpers;
  const template = count === 1 && locale !== "zh" ? h.inspectorAltPathsOne : h.inspectorAltPaths;
  return fmt(template, { count: String(count) });
}

export function inspectorHopsSummary(locale: GraphWorkspaceLocale, hops: number): string {
  return fmt(pack(locale).helpers.inspectorHops, { hops: String(hops) });
}

export function inspectorBadgeCount(
  locale: GraphWorkspaceLocale,
  count: number,
  kind: "sourceFields" | "candidateLinks",
): string {
  const h = pack(locale).helpers;
  const template =
    kind === "sourceFields" ? h.inspectorSourceFieldsBadge : h.inspectorCandidateLinksBadge;
  return fmt(template, { count: String(count) });
}

export function inspectorFocusTitle(
  locale: GraphWorkspaceLocale,
  nodeId: string,
  isBottleneck: boolean,
): string {
  const h = pack(locale).helpers;
  return fmt(isBottleneck ? h.inspectorFocusBottleneck : h.inspectorFocus, { nodeId });
}
