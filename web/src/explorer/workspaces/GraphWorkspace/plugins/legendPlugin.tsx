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
import { fmt } from "@/i18n/format.js";

import { buildGraphColorLegend } from "../graphColorLegend";
import { graphFormatNumber, graphPluginCopy } from "../graphWorkspaceCopy";
import type { GraphPlugin } from "./types";

const LEGEND_PANEL_ID = "legend-panel";
const MAX_GROUPS = 8;

export const legendPlugin: GraphPlugin = {
  id: "legend",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => {
    const legend = graphPluginCopy(context.locale).legend;
    return [
      {
        id: "legend-toggle",
        label: legend.toolbarLabel,
        title: legend.toggleTitle,
        active: context.isPanelOpen(LEGEND_PANEL_ID),
        order: 20,
        onClick: () => context.dispatchAction({ type: "togglePanel", panelId: LEGEND_PANEL_ID }),
      },
    ];
  },
  renderPanel: (context) => {
    if (!context.isPanelOpen(LEGEND_PANEL_ID)) {
      return null;
    }

    const legend = graphPluginCopy(context.locale).legend;
    const items = buildGraphColorLegend(context.graph, context.theme)
      .sort((left, right) => right.count - left.count)
      .slice(0, MAX_GROUPS);

    return {
      id: LEGEND_PANEL_ID,
      title: legend.panelTitle,
      placement: "bottom",
      order: 10,
      defaultOpen: false,
      preferredWidth: 320,
      preferredHeight: 220,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphLegendEyebrow}>{legend.eyebrow}</div>
          {items.length ? (
            <div className="flex flex-col gap-2">
              {items.map((item) => (
                <div key={item.id} className={graphLegendRow}>
                  <span className={graphLegendSwatch} style={graphSemanticSwatchStyle(item.color)} />
                  <div className="min-w-0 flex-1">
                    <div className={graphLegendTitle}>{item.group}</div>
                    <div className={graphLegendMeta}>
                      {fmt(legend.nodeCount, { count: graphFormatNumber(context.locale, item.count) })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className={graphLegendEmpty}>{legend.empty}</div>
          )}
        </div>
      ),
    };
  },
};
