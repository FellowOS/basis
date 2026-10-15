import {
  graphDetailLabel,
  graphDetailRow,
  graphDetailValue,
  graphLegendEyebrow,
  graphLegendPanel,
  graphTemporalChip,
  graphTemporalChipAccent,
} from "@/lib/graph/graph-ui-classes.js";

import type { GraphPlugin } from "./types";

const TEMPORAL_PANEL_ID = "temporal-panel";

function formatTemporalLabel(value: Date | null) {
  if (!value) {
    return "No time selected";
  }
  return `${value.getFullYear()}/${String(value.getMonth() + 1).padStart(2, "0")}`;
}

export const temporalOverlayPlugin: GraphPlugin = {
  id: "temporal-overlay",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "temporal-toggle",
      label: "Temporal",
      title: "Toggle temporal context panel",
      active: context.isPanelOpen(TEMPORAL_PANEL_ID),
      order: 40,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: TEMPORAL_PANEL_ID }),
    },
  ],
  renderOverlay: (context) => {
    const temporal = context.getTemporalState();
    if (!temporal?.currentTime) {
      return null;
    }

    const label = formatTemporalLabel(temporal.currentTime);
    return {
      id: "temporal-overlay-chip",
      layer: 1,
      order: 10,
      element: (
        <div className={graphTemporalChip}>
          <span className={graphTemporalChipAccent}>Temporal</span>
          <span>{label}</span>
          {typeof temporal.activeNodeCount === "number" ? (
            <span className="text-muted-foreground">{temporal.activeNodeCount.toLocaleString()} active</span>
          ) : null}
        </div>
      ),
    };
  },
  renderPanel: (context) => {
    if (!context.isPanelOpen(TEMPORAL_PANEL_ID)) {
      return null;
    }

    const temporal = context.getTemporalState();
    return {
      id: TEMPORAL_PANEL_ID,
      title: "Temporal Context",
      placement: "bottom",
      order: 30,
      defaultOpen: false,
      preferredWidth: 320,
      preferredHeight: 220,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphLegendEyebrow}>Current scrubber state</div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>Current</span>
            <span className={graphDetailValue}>{formatTemporalLabel(temporal?.currentTime ?? null)}</span>
          </div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>Bounds</span>
            <span className={graphDetailValue}>
              {(temporal?.minDate ?? "1970")} → {(temporal?.maxDate ?? "now")}
            </span>
          </div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>Active nodes</span>
            <span className={graphDetailValue}>
              {typeof temporal?.activeNodeCount === "number" ? temporal.activeNodeCount.toLocaleString() : "All"}
            </span>
          </div>
        </div>
      ),
    };
  },
};
