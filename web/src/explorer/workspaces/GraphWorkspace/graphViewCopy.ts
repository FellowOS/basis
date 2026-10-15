import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy";
import type { FocusedUnavailableReason, GroupedViewUnavailableReason } from "./types";

type Pair = { zh: string; en: string };

const GROUPED_VIEW_COPY: Record<string, Pair> = {
  "communities-undetected": {
    zh: "尚未检测到社区结构，无法使用分组视图。",
    en: "Grouped view is unavailable until communities can be detected.",
  },
  "community-nodes-missing": {
    zh: "无法创建社区节点，分组视图不可用。",
    en: "Grouped view is unavailable because no community nodes could be created.",
  },
};

const FOCUSED_MODE_COPY: Record<FocusedUnavailableReason["code"], Pair> = {
  "no-selection": {
    zh: "请先选择节点以进入聚焦模式。",
    en: "Select a node to inspect in Focused mode.",
  },
  "grouped-unresolvable": {
    zh: "当前分组选择无法进入聚焦模式。",
    en: "Focused mode is unavailable for this grouped selection.",
  },
  "not-in-graph": {
    zh: "所选项不在当前图谱中。",
    en: "Selected item is not available in the current graph.",
  },
};

export function groupedViewReasonText(
  reason: GroupedViewUnavailableReason | null | undefined,
  locale: GraphWorkspaceLocale = "en",
): string | null {
  if (!reason) {
    return null;
  }

  switch (reason.code) {
    case "communities-undetected":
    case "community-nodes-missing":
      return GROUPED_VIEW_COPY[reason.code][locale];
    case "invalid-community-layout":
      return locale === "zh"
        ? `分组节点 ${reason.nodeId} 坐标无效。`
        : `Grouped node ${reason.nodeId} has invalid coordinates.`;
    case "missing-grouped-node":
      return locale === "zh"
        ? `分组边 ${reason.edgeId} 引用了缺失的分组节点。`
        : `Grouped edge ${reason.edgeId} references a missing grouped node.`;
  }
}

export function focusedUnavailableReasonText(
  reason: FocusedUnavailableReason | null | undefined,
  locale: GraphWorkspaceLocale = "en",
): string | null {
  if (!reason) {
    return null;
  }

  return FOCUSED_MODE_COPY[reason.code][locale];
}
