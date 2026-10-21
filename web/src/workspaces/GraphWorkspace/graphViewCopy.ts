import { fmt } from "@/i18n/format.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";
import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy.js";
import type { FocusedUnavailableReason, GroupedViewUnavailableReason } from "./types";

function pack(locale: GraphWorkspaceLocale) {
  return messagesForLocale(locale).kbGraphWorkspace;
}

export function groupedViewReasonText(
  reason: GroupedViewUnavailableReason | null | undefined,
  locale: GraphWorkspaceLocale = "en",
): string | null {
  if (!reason) {
    return null;
  }

  const g = pack(locale);
  switch (reason.code) {
    case "communities-undetected":
      return g.groupedView.communitiesUndetected;
    case "community-nodes-missing":
      return g.groupedView.communityNodesMissing;
    case "invalid-community-layout":
      return fmt(g.helpers.invalidCommunityLayout, { nodeId: reason.nodeId });
    case "missing-grouped-node":
      return fmt(g.helpers.missingGroupedNode, { edgeId: reason.edgeId });
  }
}

export function focusedUnavailableReasonText(
  reason: FocusedUnavailableReason | null | undefined,
  locale: GraphWorkspaceLocale = "en",
): string | null {
  if (!reason) {
    return null;
  }

  const f = pack(locale).focusedMode;
  switch (reason.code) {
    case "no-selection":
      return f.noSelection;
    case "grouped-unresolvable":
      return f.groupedUnresolvable;
    case "not-in-graph":
      return f.notInGraph;
  }
}
