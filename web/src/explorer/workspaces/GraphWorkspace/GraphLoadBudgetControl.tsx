import { PublicIcon } from "@/components/ui/public-icon.js";
import { useEffect, useState } from "react";

import { Button } from "@/components/ui/button.js";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover.js";
import { Slider } from "@/components/ui/slider.js";
import { fmt } from "@/i18n/format.js";
import { messagesForLocale } from "@/i18n/pick-locale.js";

import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy";
import {
  GRAPH_LOAD_BUDGET_EDGE_STEP,
  GRAPH_LOAD_BUDGET_MIN_EDGES,
  GRAPH_LOAD_BUDGET_MIN_NODES,
  GRAPH_LOAD_BUDGET_NODE_STEP,
  catalogEdgeCeiling,
  catalogNodeCeiling,
  type GraphCatalogTotals,
  type GraphLoadBudget,
} from "./graphLoadBudget";

function loadBudgetCopy(locale: GraphWorkspaceLocale) {
  return messagesForLocale(locale).kbGraphWorkspace.loadBudget;
}

function summaryLabel(
  locale: GraphWorkspaceLocale,
  loadedNodes: number,
  loadedEdges: number,
  budget: GraphLoadBudget,
  catalogTotals: GraphCatalogTotals,
): string {
  const lb = loadBudgetCopy(locale);
  const nLoaded = loadedNodes.toLocaleString();
  const eLoaded = loadedEdges.toLocaleString();
  const nodeCatalog = catalogTotals.nodeTotal;
  const edgeCatalog = catalogTotals.edgeTotal;
  const nDenominator = nodeCatalog != null ? nodeCatalog.toLocaleString() : budget.maxNodes.toLocaleString();
  const eDenominator = edgeCatalog != null ? edgeCatalog.toLocaleString() : budget.maxEdges.toLocaleString();

  return fmt(lb.summary, {
    nLoaded,
    nMax: nDenominator,
    eLoaded,
    eMax: eDenominator,
  });
}

export function GraphLoadBudgetControl({
  locale = "en",
  budget,
  onBudgetCommit,
  loadedNodes,
  loadedEdges,
  catalogTotals,
  disabled = false,
}: {
  locale?: GraphWorkspaceLocale;
  budget: GraphLoadBudget;
  onBudgetCommit: (budget: GraphLoadBudget) => void;
  loadedNodes: number;
  loadedEdges: number;
  catalogTotals: GraphCatalogTotals;
  disabled?: boolean;
}) {
  const lb = loadBudgetCopy(locale);
  const [open, setOpen] = useState(false);
  const [draftNodes, setDraftNodes] = useState(budget.maxNodes);
  const [draftEdges, setDraftEdges] = useState(budget.maxEdges);

  const nodeMax = catalogNodeCeiling(catalogTotals);
  const edgeMax = catalogEdgeCeiling(catalogTotals);
  const slidersDisabled = disabled || (nodeMax === 0 && edgeMax === 0);

  useEffect(() => {
    setDraftNodes(budget.maxNodes);
    setDraftEdges(budget.maxEdges);
  }, [budget.maxEdges, budget.maxNodes]);

  const commitDraft = (nodes: number, edges: number) => {
    onBudgetCommit({ maxNodes: nodes, maxEdges: edges });
  };

  const triggerText = summaryLabel(locale, loadedNodes, loadedEdges, budget, catalogTotals);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="secondary"
          size="sm"
          disabled={slidersDisabled}
          className="h-8 max-w-[min(100%,20rem)] gap-1.5 px-2.5 text-xs font-normal"
          aria-label={lb.ariaLabel}
        >
          <PublicIcon name="settings" className="size-3.5 shrink-0 opacity-70" />
          <span className="truncate">{triggerText}</span>
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 space-y-4 p-3">
        <div className="space-y-1">
          <p className="text-xs font-medium text-foreground">{lb.title}</p>
          <p className="text-[11px] leading-snug text-muted-foreground">{lb.hint}</p>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{lb.nodesLabel}</span>
            <span className="tabular-nums font-medium">
              {draftNodes.toLocaleString()}
              <span className="text-muted-foreground font-normal">
                {" "}/ {nodeMax.toLocaleString()}
              </span>
            </span>
          </div>
          <Slider
            min={nodeMax === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_NODES}
            max={Math.max(nodeMax, nodeMax === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_NODES)}
            step={GRAPH_LOAD_BUDGET_NODE_STEP}
            value={[draftNodes]}
            disabled={slidersDisabled || nodeMax === 0}
            onValueChange={([value]) => setDraftNodes(value)}
            onValueCommit={([value]) => commitDraft(value, draftEdges)}
          />
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">{lb.edgesLabel}</span>
            <span className="tabular-nums font-medium">
              {draftEdges.toLocaleString()}
              <span className="text-muted-foreground font-normal">
                {" "}/ {edgeMax.toLocaleString()}
              </span>
            </span>
          </div>
          <Slider
            min={edgeMax === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_EDGES}
            max={Math.max(edgeMax, edgeMax === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_EDGES)}
            step={GRAPH_LOAD_BUDGET_EDGE_STEP}
            value={[draftEdges]}
            disabled={slidersDisabled || edgeMax === 0}
            onValueChange={([value]) => setDraftEdges(value)}
            onValueCommit={([value]) => commitDraft(draftNodes, value)}
          />
        </div>

        {catalogTotals.nodeTotal != null && catalogTotals.edgeTotal != null ? (
          <p className="text-[10px] text-muted-foreground">
            {fmt(lb.catalogFull, {
              nodes: catalogTotals.nodeTotal.toLocaleString(),
              edges: catalogTotals.edgeTotal.toLocaleString(),
            })}
          </p>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
