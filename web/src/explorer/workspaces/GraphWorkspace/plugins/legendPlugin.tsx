import {
  graphLegendEmpty,
  graphLegendEyebrow,
  graphLegendMeta,
  graphLegendPanel,
  graphLegendRow,
  graphLegendSwatch,
  graphLegendTitle,
  graphSemanticSwatchStyle,
} from "@/lib/graph/graph-ui-classes.js";

import { buildGraphColorLegend } from "../graphColorLegend";
import type { GraphPlugin } from "./types";

const LEGEND_PANEL_ID = "legend-panel";
const MAX_GROUPS = 8;

export const legendPlugin: GraphPlugin = {
  id: "legend",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "legend-toggle",
      label: "Legend",
      title: "Toggle semantic legend",
      active: context.isPanelOpen(LEGEND_PANEL_ID),
      order: 20,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: LEGEND_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(LEGEND_PANEL_ID)) {
      return null;
    }

    const items = buildGraphColorLegend(context.graph, context.theme)
      .sort((left, right) => right.count - left.count)
      .slice(0, MAX_GROUPS);

    return {
      id: LEGEND_PANEL_ID,
      title: "Legend",
      placement: "bottom",
      order: 10,
      defaultOpen: false,
      preferredWidth: 320,
      preferredHeight: 220,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphLegendEyebrow}>Semantic groups</div>
          {items.length ? (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.id} className={graphLegendRow}>
                  <span className={graphLegendSwatch} style={graphSemanticSwatchStyle(item.color)} />
                  <div className="min-w-0 flex-1">
                    <div className={graphLegendTitle}>{item.group}</div>
                    <div className={graphLegendMeta}>{item.count.toLocaleString()} nodes</div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={graphLegendEmpty}>Legend will populate when the graph metadata is available.</div>
          )}
        </div>
      ),
    };
  },
};
