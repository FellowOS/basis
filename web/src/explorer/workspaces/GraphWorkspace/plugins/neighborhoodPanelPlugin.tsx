import {
  graphLegendMeta,
  graphLegendPanel,
  graphLegendSwatch,
  graphLegendTitle,
  graphNeighborBtn,
  graphPanelControlBtn,
  graphPanelSummary,
  graphPanelTitle,
  graphSemanticSwatchStyle,
} from "@/lib/graph/graph-ui-classes.js";

import type { GraphPlugin } from "./types";

const NEIGHBORHOOD_PANEL_ID = "neighborhood-panel";
const MAX_NEIGHBORS = 10;

function maxWeightBetween(graphRef: any, sourceId: string, targetId: string): number {
  let weight = 0;
  graphRef.forEachDirectedEdge(sourceId, targetId, (_edgeId: string, attrs: { weight?: number }) => {
    weight = Math.max(weight, Number(attrs.weight ?? 0));
  });
  return weight;
}

function formatNeighborMeta(neighbor: { nodeType: string; degree: number; weight: number }) {
  const parts = [neighbor.nodeType, `degree ${neighbor.degree}`];
  if (neighbor.weight > 0) {
    parts.push(`weight ${neighbor.weight.toFixed(2)}`);
  }
  return parts.join(" · ");
}

export const neighborhoodPanelPlugin: GraphPlugin = {
  id: "neighborhood-panel",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "neighborhood-toggle",
      label: "Neighbors",
      title: "Toggle neighborhood panel",
      active: context.isPanelOpen(NEIGHBORHOOD_PANEL_ID),
      order: 30,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: NEIGHBORHOOD_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(NEIGHBORHOOD_PANEL_ID)) {
      return null;
    }

    const selected = context.getSelectedNodeState();
    const displayState = context.getDisplayState();
    if (!selected) {
      return {
        id: NEIGHBORHOOD_PANEL_ID,
        title: "Neighborhood",
        placement: "bottom",
        order: 20,
        defaultOpen: false,
        preferredWidth: 360,
        preferredHeight: 260,
        content: (
          <div className={graphPanelSummary}>Select a node to inspect its local neighborhood.</div>
        ),
      };
    }

    const neighbors = context.graph
      .neighbors(selected.id)
      .map((neighborId) => {
        const attrs = context.graph.getNodeAttributes(neighborId);
        const weight = Math.max(
          maxWeightBetween(context.graph, selected.id, neighborId),
          maxWeightBetween(context.graph, neighborId, selected.id),
        );
        return {
          id: neighborId,
          label: String(attrs.label || neighborId),
          nodeType: String(attrs.nodeType || "Entity"),
          color: String(attrs.baseColor || attrs.color || context.theme.palette.semantic[0]),
          weight,
          degree: context.graph.degree(neighborId),
        };
      })
      .sort((left, right) => {
        if (right.weight !== left.weight) {
          return right.weight - left.weight;
        }
        if (right.degree !== left.degree) {
          return right.degree - left.degree;
        }
        return left.label.localeCompare(right.label);
      })
      .slice(0, MAX_NEIGHBORS);
    const hiddenNeighborCount = displayState.selectedCollapsedNeighborIds.length;
    const aggregatedEdgeCount = context.displayGraph
      .edges()
      .map((edgeId) => context.displayGraph.getEdgeAttributes(edgeId) as { isAggregated?: boolean })
      .filter((attrs) => attrs.isAggregated).length;

    return {
      id: NEIGHBORHOOD_PANEL_ID,
      title: "Neighborhood",
      placement: "bottom",
      order: 20,
      defaultOpen: false,
      preferredWidth: 360,
      preferredHeight: 260,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphPanelTitle}>{selected.label}</div>
          <div className={graphPanelSummary}>
            {selected.neighborCount.toLocaleString()} direct neighbors in the full graph
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => context.dispatchAction({ type: "collapseNeighborhood" })}
              disabled={!selected.canCollapseNeighborhood || selected.isNeighborhoodCollapsed}
              className={graphPanelControlBtn}
            >
              Collapse Neighborhood
            </button>
            <button
              type="button"
              onClick={() => context.dispatchAction({ type: "expandNeighborhood" })}
              disabled={!selected.isNeighborhoodCollapsed}
              className={graphPanelControlBtn}
            >
              Expand Neighborhood
            </button>
          </div>
          {hiddenNeighborCount > 0 ? (
            <div className={graphPanelSummary}>
              {hiddenNeighborCount.toLocaleString()} lower-priority neighbors are collapsed in the current view.
            </div>
          ) : null}
          {aggregatedEdgeCount > 0 ? (
            <div className={graphPanelSummary}>
              {aggregatedEdgeCount.toLocaleString()} aggregated structural bundle{aggregatedEdgeCount === 1 ? "" : "s"} visible.
            </div>
          ) : null}
          {neighbors.length ? (
            <div className="flex flex-col gap-2">
              {neighbors.map((neighbor) => (
                <button
                  key={neighbor.id}
                  type="button"
                  onClick={() => context.dispatchAction({ type: "selectNode", nodeId: neighbor.id })}
                  className={graphNeighborBtn}
                >
                  <span className={graphLegendSwatch} style={graphSemanticSwatchStyle(neighbor.color)} />
                  <div className="min-w-0 flex-1">
                    <div className={graphLegendTitle}>{neighbor.label}</div>
                    <div className={graphLegendMeta}>{formatNeighborMeta(neighbor)}</div>
                  </div>
                </button>
              ))}
            </div>
          ) : (
            <div className={graphPanelSummary}>No direct neighbors are available for this node.</div>
          )}
        </div>
      ),
    };
  },
};
