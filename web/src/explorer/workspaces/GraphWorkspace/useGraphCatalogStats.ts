import { useEffect, useState } from "react";

import type { Locale } from "@/i18n/locale.js";

import { buildExplorerGraphApiPath, explorerFetchJson } from "../../explorerHttp";
import type { GraphCatalogTotals } from "./graphLoadBudget";

const EMPTY_TOTALS: GraphCatalogTotals = { nodeTotal: null, edgeTotal: null };

export function useGraphCatalogStats(
  kbId: string,
  refreshKey = 0,
  locale: Locale = "en",
): GraphCatalogTotals {
  const [totals, setTotals] = useState<GraphCatalogTotals>(EMPTY_TOTALS);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await explorerFetchJson<{ node_count?: number; edge_count?: number }>(
          buildExplorerGraphApiPath("stats", kbId),
          undefined,
          undefined,
          locale,
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
  }, [kbId, locale, refreshKey]);

  return totals;
}
