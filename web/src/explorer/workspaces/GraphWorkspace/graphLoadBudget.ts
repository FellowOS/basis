export type GraphLoadBudget = {
  maxNodes: number;
  maxEdges: number;
};

export type GraphCatalogTotals = {
  nodeTotal: number | null;
  edgeTotal: number | null;
};

const STORAGE_PREFIX = "sema.graphLoadBudget.v2:";

export const GRAPH_LOAD_BUDGET_MIN_NODES = 1;
export const GRAPH_LOAD_BUDGET_MIN_EDGES = 1;
export const GRAPH_LOAD_BUDGET_NODE_STEP = 10;
export const GRAPH_LOAD_BUDGET_EDGE_STEP = 20;
/** When catalog ceiling is below this, sliders use step 1 instead of the default step. */
export const GRAPH_LOAD_BUDGET_FINE_STEP_CEILING = 50;

const DEFAULT_BUDGET_NODES = 200;
const DEFAULT_BUDGET_EDGES = 400;

type LegacyPresetId = "light" | "standard" | "maximum";

function legacyPresetBudget(
  preset: LegacyPresetId,
  totals: GraphCatalogTotals,
): GraphLoadBudget {
  const nodeCeiling = catalogNodeCeiling(totals);
  const edgeCeiling = catalogEdgeCeiling(totals);
  const clamp = (value: number, cap: number) => Math.min(Math.max(1, value), Math.max(1, cap));
  switch (preset) {
    case "light":
      return {
        maxNodes: clamp(100, nodeCeiling),
        maxEdges: clamp(200, edgeCeiling),
      };
    case "standard":
      return {
        maxNodes: clamp(200, nodeCeiling),
        maxEdges: clamp(400, edgeCeiling),
      };
    case "maximum":
    default:
      return {
        maxNodes: nodeCeiling,
        maxEdges: edgeCeiling,
      };
  }
}

export function catalogNodeCeiling(totals: GraphCatalogTotals): number {
  if (totals.nodeTotal != null) {
    return Math.max(0, totals.nodeTotal);
  }
  return DEFAULT_BUDGET_NODES;
}

export function catalogEdgeCeiling(totals: GraphCatalogTotals): number {
  if (totals.edgeTotal != null) {
    return Math.max(0, totals.edgeTotal);
  }
  return DEFAULT_BUDGET_EDGES;
}

export function loadBudgetSliderBounds(ceiling: number, minFloor: number, step: number) {
  if (ceiling <= 0) {
    return { min: 0, max: 0, step: 1, disabled: true };
  }
  const min = Math.min(minFloor, ceiling);
  const range = ceiling - min;
  const baseStep = ceiling < GRAPH_LOAD_BUDGET_FINE_STEP_CEILING ? 1 : step;
  return {
    min,
    max: ceiling,
    step: range > 0 && range < baseStep ? 1 : baseStep,
    disabled: range <= 0,
  };
}

export function snapLoadBudgetValue(
  value: number,
  bounds: { min: number; max: number; step: number },
) {
  if (bounds.max <= bounds.min) return bounds.min;
  const clamped = Math.min(bounds.max, Math.max(bounds.min, value));
  const steps = Math.round((clamped - bounds.min) / bounds.step);
  return Math.min(bounds.max, bounds.min + steps * bounds.step);
}

export function clampLoadBudget(
  budget: GraphLoadBudget,
  totals: GraphCatalogTotals,
): GraphLoadBudget {
  const nodeCeiling = catalogNodeCeiling(totals);
  const edgeCeiling = catalogEdgeCeiling(totals);
  const minNodes = nodeCeiling === 0 ? 0 : Math.min(GRAPH_LOAD_BUDGET_MIN_NODES, nodeCeiling);
  const minEdges = edgeCeiling === 0 ? 0 : Math.min(GRAPH_LOAD_BUDGET_MIN_EDGES, edgeCeiling);

  return {
    maxNodes: nodeCeiling === 0
      ? 0
      : Math.min(Math.max(minNodes, Math.round(budget.maxNodes)), nodeCeiling),
    maxEdges: edgeCeiling === 0
      ? 0
      : Math.min(Math.max(minEdges, Math.round(budget.maxEdges)), edgeCeiling),
  };
}

export function defaultLoadBudget(totals: GraphCatalogTotals): GraphLoadBudget {
  const nodeCeiling = catalogNodeCeiling(totals);
  const edgeCeiling = catalogEdgeCeiling(totals);
  return clampLoadBudget(
    {
      maxNodes: Math.min(DEFAULT_BUDGET_NODES, nodeCeiling || DEFAULT_BUDGET_NODES),
      maxEdges: Math.min(DEFAULT_BUDGET_EDGES, edgeCeiling || DEFAULT_BUDGET_EDGES),
    },
    totals,
  );
}

export function loadGraphLoadBudget(kbId: string, totals: GraphCatalogTotals): GraphLoadBudget {
  const legacyPrefix = "sema.graphLoadBudget.v1:";
  try {
    const rawV2 = localStorage.getItem(`${STORAGE_PREFIX}${kbId}`);
    if (rawV2) {
      const parsed = JSON.parse(rawV2) as Partial<GraphLoadBudget>;
      if (typeof parsed.maxNodes === "number" && typeof parsed.maxEdges === "number") {
        return clampLoadBudget(
          { maxNodes: parsed.maxNodes, maxEdges: parsed.maxEdges },
          totals,
        );
      }
    }
    const rawV1 = localStorage.getItem(`${legacyPrefix}${kbId}`);
    if (rawV1 === "light" || rawV1 === "standard" || rawV1 === "maximum") {
      const migrated = legacyPresetBudget(rawV1, totals);
      saveGraphLoadBudget(kbId, migrated);
      return migrated;
    }
  } catch {
    // ignore
  }
  return defaultLoadBudget(totals);
}

export function saveGraphLoadBudget(kbId: string, budget: GraphLoadBudget): void {
  try {
    localStorage.setItem(`${STORAGE_PREFIX}${kbId}`, JSON.stringify(budget));
  } catch {
    // ignore
  }
}

function largerTotal(sessionCount: number | null, catalogCount: number | null | undefined): number | null {
  if (sessionCount == null) return catalogCount ?? null;
  if (catalogCount == null) return sessionCount;
  return Math.max(sessionCount, catalogCount);
}

export function mergeCatalogTotals(
  stats: GraphCatalogTotals,
  fromLoad?: { graphNodeTotal?: number | null; graphEdgeTotal?: number | null } | null,
): GraphCatalogTotals {
  return {
    nodeTotal: largerTotal(stats.nodeTotal, fromLoad?.graphNodeTotal),
    edgeTotal: largerTotal(stats.edgeTotal, fromLoad?.graphEdgeTotal),
  };
}

/** When the canvas loaded the full graph (not truncated), keep the slider at the catalog ceiling. */
export function alignLoadBudgetWithLoaded(
  budget: GraphLoadBudget,
  totals: GraphCatalogTotals,
  loaded: { nodes: number; edges: number },
  loadTruncated: boolean,
): GraphLoadBudget {
  const clamped = clampLoadBudget(budget, totals);
  if (loadTruncated) {
    return clamped;
  }
  return clampLoadBudget(
    {
      maxNodes: Math.max(clamped.maxNodes, loaded.nodes),
      maxEdges: Math.max(clamped.maxEdges, loaded.edges),
    },
    totals,
  );
}
