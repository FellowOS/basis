import type { ReactNode } from "react";

import { Badge } from "@/components/ui/badge.js";
import type { GraphLoadPhase } from "./types";
import { getGraphLoadTitle } from "./graphLoading";
import {
  type GraphWorkspaceLocale,
  graphActiveCountLabel,
  graphCopy,
  graphStatusCounts,
} from "./graphWorkspaceCopy";
import { GraphLoadBudgetControl } from "./GraphLoadBudgetControl";
import type { GraphCatalogTotals, GraphLoadBudget } from "./graphLoadBudget";

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
  readOnly = false,
  trailing,
  loadBudget,
}: {
  locale?: GraphWorkspaceLocale;
  showLoadingStatus: boolean;
  loadingPhase?: GraphLoadPhase;
  summary: GraphStatusSummary | null | undefined;
  activeNodeCount: number | null;
  focusedSummary: string | null;
  readOnly?: boolean;
  trailing?: ReactNode;
  loadBudget?: {
    budget: GraphLoadBudget;
    onBudgetCommit: (budget: GraphLoadBudget) => void;
    catalogTotals: GraphCatalogTotals;
    disabled?: boolean;
  };
}) {
  const hasLoading = showLoadingStatus && loadingPhase;
  const hasSummary = Boolean(summary);
  const hasActive = activeNodeCount !== null;
  const hasFocused = Boolean(focusedSummary);

  if (!hasLoading && !hasSummary && !hasActive && !hasFocused && !readOnly && !trailing) {
    return null;
  }

  return (
    <div className="flex flex-wrap items-center justify-end gap-2">
      {readOnly ? (
        <StatusBadge tone="warm">{graphCopy(locale, "viewerReadOnly")}</StatusBadge>
      ) : null}
      {hasLoading && loadingPhase ? (
        <StatusBadge>{getGraphLoadTitle(loadingPhase, locale)}</StatusBadge>
      ) : null}
      {summary && loadBudget ? (
        <GraphLoadBudgetControl
          locale={locale}
          budget={loadBudget.budget}
          onBudgetCommit={loadBudget.onBudgetCommit}
          loadedNodes={summary.nodeCount}
          loadedEdges={summary.edgeCount}
          catalogTotals={loadBudget.catalogTotals}
          disabled={loadBudget.disabled}
        />
      ) : null}
      {summary && !loadBudget ? (
        <StatusBadge>
          {graphStatusCounts(locale, summary.nodeCount, summary.edgeCount)}
        </StatusBadge>
      ) : null}
      {hasActive ? (
        <StatusBadge tone="success">{graphActiveCountLabel(locale, activeNodeCount!)}</StatusBadge>
      ) : null}
      {focusedSummary ? <StatusBadge tone="warm">{focusedSummary}</StatusBadge> : null}
      {trailing}
    </div>
  );
}
