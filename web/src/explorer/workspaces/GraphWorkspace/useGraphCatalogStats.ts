import { useEffect, useState } from "react";

import { buildExplorerGraphApiPath, explorerFetchJson } from "../../host/explorerHttp";
import type { GraphCatalogTotals } from "./graphLoadBudget";

const EMPTY_TOTALS: GraphCatalogTotals = { nodeTotal: null, edgeTotal: null };

export function useGraphCatalogStats(kbId: string, refreshKey = 0): GraphCatalogTotals {
  const [totals, setTotals] = useState<GraphCatalogTotals>(EMPTY_TOTALS);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await explorerFetchJson<{ node_count?: number; edge_count?: number }>(
          buildExplorerGraphApiPath("stats", kbId),
        );
        if (cancelled) {
          return;
        }
        setTotals({
          nodeTotal: typeof data.node_count === "number" ? data.node_count : null,
          edgeTotal: typeof data.edge_count === "number" ? data.edge_count : null,
        });
      } catch {
        if (!cancelled) {
          setTotals(EMPTY_TOTALS);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [kbId, refreshKey]);

  return totals;
}
