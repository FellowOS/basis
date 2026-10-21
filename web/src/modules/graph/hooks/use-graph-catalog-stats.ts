import { useEffect, useState } from "react";

import type { Locale } from "@/i18n/locale.js";

import { buildWorkspaceGraphApiPath, workspaceFetchJson } from '@/lib/explorer/ws-http';
import type { GraphCatalogTotals } from '../lib/graph-load-budget.js';

const EMPTY_TOTALS: GraphCatalogTotals = { nodeTotal: null, edgeTotal: null };

export function useGraphCatalogStats(
  workspaceId: string,
  refreshKey = 0,
  locale: Locale = "en",
): GraphCatalogTotals {
  const [totals, setTotals] = useState<GraphCatalogTotals>(EMPTY_TOTALS);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        const data = await workspaceFetchJson<{ node_count?: number; edge_count?: number }>(
          buildWorkspaceGraphApiPath("stats", workspaceId),
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
  }, [workspaceId, locale, refreshKey]);

  return totals;
}
