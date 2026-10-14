import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.js";
import type { GraphLoadPhase } from "./types";
import { getGraphLoadTitle } from "./graphLoading";

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
  showLoadingStatus,
  loadingPhase,
  summary,
  activeNodeCount,
  focusedSummary,
}: {
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
        <StatusBadge>{getGraphLoadTitle(loadingPhase)}</StatusBadge>
      ) : null}
      {summary ? (
        <StatusBadge>
          {summary.nodeCount.toLocaleString()} nodes · {summary.edgeCount.toLocaleString()} edges
        </StatusBadge>
      ) : null}
      {hasActive ? (
        <StatusBadge tone="success">{activeNodeCount!.toLocaleString()} active</StatusBadge>
      ) : null}
      {focusedSummary ? <StatusBadge tone="warm">{focusedSummary}</StatusBadge> : null}
    </div>
  );
}
