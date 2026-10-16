export type GraphLoadBudget = {
  maxNodes: number;
  maxEdges: number;
};

export type GraphCatalogTotals = {
  nodeTotal: number | null;
  edgeTotal: number | null;
};

const STORAGE_PREFIX = "sema.graphLoadBudget.v2:";

export const GRAPH_LOAD_BUDGET_MIN_NODES = 20;
export const GRAPH_LOAD_BUDGET_MIN_EDGES = 20;
export const GRAPH_LOAD_BUDGET_NODE_STEP = 10;
export const GRAPH_LOAD_BUDGET_EDGE_STEP = 20;

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

export function clampLoadBudget(
  budget: GraphLoadBudget,
  totals: GraphCatalogTotals,
): GraphLoadBudget {
  const nodeCeiling = catalogNodeCeiling(totals);
  const edgeCeiling = catalogEdgeCeiling(totals);
  const minNodes = nodeCeiling === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_NODES;
  const minEdges = edgeCeiling === 0 ? 0 : GRAPH_LOAD_BUDGET_MIN_EDGES;

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

export function mergeCatalogTotals(
  stats: GraphCatalogTotals,
  fromLoad?: { graphNodeTotal?: number | null; graphEdgeTotal?: number | null } | null,
): GraphCatalogTotals {
  return {
    nodeTotal: stats.nodeTotal ?? fromLoad?.graphNodeTotal ?? null,
    edgeTotal: stats.edgeTotal ?? fromLoad?.graphEdgeTotal ?? null,
  };
}
