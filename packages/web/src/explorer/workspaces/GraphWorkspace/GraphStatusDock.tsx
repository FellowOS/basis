import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.js";
import type { GraphLoadPhase } from "./types";
import { getGraphLoadTitle } from "./graphLoading";
import {
  type GraphWorkspaceLocale,
  graphActiveCountLabel,
  graphStatusCounts,
} from "./graphWorkspaceCopy";

function StatusBadge({
  children,
  tone = "default",
}: {
  children: ReactNode;
  tone?: "default" | "warm" | "success";
}) {
  const variant = tone === "success" ? "success" : tone === "warm" ? "warning" : "secondary";
  return <Badge variant={variant}>{children}</Badge>;
}

export type GraphStatusSummary = {
  nodeCount: number;
  edgeCount: number;
};

export function GraphStatusDock({
  locale = "en",
  showLoadingStatus,
  loadingPhase,
  summary,
  activeNodeCount,
  focusedSummary,
}: {
  locale?: GraphWorkspaceLocale;
  showLoadingStatus: boolean;
  loadingPhase?: GraphLoadPhase;
  summary: GraphStatusSummary | null | undefined;
  activeNodeCount: number | null;
  focusedSummary: string | null;
}) {
  const hasLoading = showLoadingStatus && loadingPhase;
  const hasSummary = Boolean(summary);
  const hasActive = activeNodeCount !== null;
  const hasFocused = Boolean(focusedSummary);

  if (!hasLoading && !hasSummary && !hasActive && !hasFocused) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {hasLoading && loadingPhase ? (
        <StatusBadge>{getGraphLoadTitle(loadingPhase, locale)}</StatusBadge>
      ) : null}
      {summary ? (
        <StatusBadge>
          {graphStatusCounts(locale, summary.nodeCount, summary.edgeCount)}
        </StatusBadge>
      ) : null}
      {hasActive ? (
        <StatusBadge tone="success">{graphActiveCountLabel(locale, activeNodeCount!)}</StatusBadge>
      ) : null}
      {focusedSummary ? <StatusBadge tone="warm">{focusedSummary}</StatusBadge> : null}
    </div>
  );
}
