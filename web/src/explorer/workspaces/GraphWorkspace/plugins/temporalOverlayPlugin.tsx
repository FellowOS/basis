import {
  graphDetailLabel,
  graphDetailRow,
  graphDetailValue,
  graphLegendEyebrow,
  graphLegendPanel,
  graphTemporalChip,
  graphTemporalChipAccent,
} from "@/lib/ui-classes/graph-ui.js";
import { fmt } from "@/i18n/format.js";

import {
  graphCopy,
  graphFormatNumber,
  graphFormatTemporalInstant,
  graphFormatYearMonth,
  graphPluginCopy,
} from "../graphWorkspaceCopy";
import type { GraphPlugin } from "./types";

const TEMPORAL_PANEL_ID = "temporal-panel";

export const temporalOverlayPlugin: GraphPlugin = {
  id: "temporal-overlay",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "temporal-toggle",
      label: graphCopy(context.locale, "pluginTemporal"),
      title: graphCopy(context.locale, "pluginTemporalTitle"),
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

    const p = graphPluginCopy(context.locale).temporal;
    const label = temporal.currentTime
      ? graphFormatYearMonth(context.locale, temporal.currentTime)
      : p.noTimeSelected;
    return {
      id: "temporal-overlay-chip",
      layer: 1,
      order: 10,
      element: (
        <div className={graphTemporalChip}>
          <span className={graphTemporalChipAccent}>{graphCopy(context.locale, "pluginTemporal")}</span>
          <span>{label}</span>
          {typeof temporal.activeNodeCount === "number" ? (
            <span className="text-muted-foreground">
              {fmt(p.activeChip, { count: graphFormatNumber(context.locale, temporal.activeNodeCount) })}
            </span>
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
    const p = graphPluginCopy(context.locale).temporal;
    return {
      id: TEMPORAL_PANEL_ID,
      title: p.panelTitle,
      placement: "bottom",
      order: 30,
      defaultOpen: false,
      preferredWidth: 320,
      preferredHeight: 220,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphLegendEyebrow}>{p.scrubberEyebrow}</div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>{p.current}</span>
            <span className={graphDetailValue}>
              {temporal?.currentTime
                ? graphFormatYearMonth(context.locale, temporal.currentTime)
                : p.noTimeSelected}
            </span>
          </div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>{p.bounds}</span>
            <span className={graphDetailValue}>
              {graphFormatTemporalInstant(context.locale, temporal?.minDate, p.boundsEpoch)}
              {' → '}
              {graphFormatTemporalInstant(context.locale, temporal?.maxDate, p.boundsNow)}
            </span>
          </div>
          <div className={graphDetailRow}>
            <span className={graphDetailLabel}>{p.activeNodes}</span>
            <span className={graphDetailValue}>
              {typeof temporal?.activeNodeCount === "number"
                ? graphFormatNumber(context.locale, temporal.activeNodeCount)
                : p.allNodes}
            </span>
          </div>
        </div>
      ),
    };
  },
};
