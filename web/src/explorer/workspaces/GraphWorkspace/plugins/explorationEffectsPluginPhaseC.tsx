import { cn } from "@/lib/utils.js";
import {
  graphEffectsDetails,
  graphEffectsDetailsSummary,
  graphEffectsPre,
  graphEffectsRowDesc,
  graphEffectsRowMeta,
  graphEffectsSection,
  graphEffectsSectionTitle,
  graphEffectsSignalBadge,
  graphEffectsSignalRow,
  graphEffectsSubsectionTitle,
  graphEffectsToggleBtn,
  graphEffectsToggleBtnOn,
  graphEffectsToggleRow,
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
import type {
  GraphAnalyticsSnapshot,
  GraphDiagnosticsSnapshot,
  GraphEffectAvailability,
  GraphEffectToggle,
} from "../types";
import type { GraphPlugin } from "./types";

const EFFECTS_PANEL_ID = "effects-panel";

type EffectRowConfig = {
  key: GraphEffectToggle;
  label: string;
  description: string;
};

const SCENE_EFFECT_ROWS: EffectRowConfig[] = [
  {
    key: "pathPulseEnabled",
    label: "Path Pulse",
    description: "Animated pulse on the active selected path.",
  },
  {
    key: "pathFlowEnabled",
    label: "Path Flow",
    description: "Directional flow accents along the active selected path.",
  },
  {
    key: "lensEnabled",
    label: "Neighborhood Lens",
    description: "Local emphasis around the hovered or selected node.",
  },
  {
    key: "temporalEmphasisEnabled",
    label: "Temporal Emphasis",
    description: "Subtle glow around temporally relevant nodes in the active time window.",
  },
  {
    key: "semanticRegionsEnabled",
    label: "Semantic Regions",
    description: "Quiet semantic hulls around the strongest visible topic clusters.",
  },
  {
    key: "contoursEnabled",
    label: "Contours",
    description: "Low-contrast density halos around the strongest visible anchors.",
  },
  {
    key: "edgeLabelsEnabled",
    label: "Edge Labels",
    description: "Draw the relationship type on graph edges. Off restores label-free edges on dense graphs.",
  },
  {
    key: "legendEnabled",
    label: "Regions Summary",
    description: "Keep the regions and signals summary visible in the Effects panel.",
  },
];

const INTELLIGENCE_EFFECT_ROWS: EffectRowConfig[] = [
  {
    key: "pathfindingEnabled",
    label: "Directed Pathfinding",
    description: "Compare the traced path against a strict local directed shortest path.",
  },
  {
    key: "communitiesEnabled",
    label: "Community Regions",
    description: "Detect stable Louvain communities for orientation and scene grouping.",
  },
  {
    key: "centralityEnabled",
    label: "Centrality Ranking",
    description: "Rank the strongest graph anchors for labels, regions, and navigation.",
  },
];

const AVAILABILITY_KEYS: Record<GraphEffectToggle, keyof GraphDiagnosticsSnapshot["effectAvailability"]> = {
  pathPulseEnabled: "pathPulse",
  pathFlowEnabled: "pathFlow",
  lensEnabled: "lens",
  temporalEmphasisEnabled: "temporalEmphasis",
  semanticRegionsEnabled: "semanticRegions",
  contoursEnabled: "contours",
  pathfindingEnabled: "pathfinding",
  communitiesEnabled: "communities",
  centralityEnabled: "centrality",
  legendEnabled: "legend",
  edgeLabelsEnabled: "edgeLabels",
  diagnosticsEnabled: "diagnostics",
};

function renderAvailabilityText(availability: GraphEffectAvailability) {
  if (availability.available) {
    if (typeof availability.visibleSegments === "number" && typeof availability.segmentCap === "number") {
      return `${availability.reason} - ${availability.visibleSegments}/${availability.segmentCap} segments`;
    }
    return availability.reason;
  }

  return availability.detail ? `${availability.reason} - ${availability.detail}` : availability.reason;
}

function collectFallbackLegendItems(context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0]) {
  return buildGraphColorLegend(context.graph, context.theme)
    .sort((left, right) => right.count - left.count)
    .slice(0, context.theme.effects.legend.maxGroups);
}

function resolveAvailability(
  availabilityMap: GraphDiagnosticsSnapshot["effectAvailability"] | undefined,
  key: GraphEffectToggle,
  enabled: boolean,
): GraphEffectAvailability {
  return availabilityMap?.[AVAILABILITY_KEYS[key]] ?? {
    enabled,
    available: false,
    reason: "Waiting for graph runtime",
  };
}

function EffectToggleRow({
  label,
  description,
  checked,
  availability,
  onToggle,
}: {
  label: string;
  description: string;
  checked: boolean;
  availability: GraphEffectAvailability;
  onToggle: () => void;
}) {
  return (
    <div className={graphEffectsToggleRow}>
      <div className="min-w-0 flex-1">
        <div className={graphLegendTitle}>{label}</div>
        <div className={graphEffectsRowDesc}>{description}</div>
        <div className={graphEffectsRowMeta}>{renderAvailabilityText(availability)}</div>
      </div>
      <button
        type="button"
        onClick={onToggle}
        className={cn(graphEffectsToggleBtn, checked && graphEffectsToggleBtnOn)}
      >
        {checked ? "On" : "Off"}
      </button>
    </div>
  );
}

function renderRegionsAndSignals(
  context: Parameters<NonNullable<GraphPlugin["renderPanel"]>>[0],
  analytics: GraphAnalyticsSnapshot | null,
) {
  const fallbackLegendItems = collectFallbackLegendItems(context);
  const semanticRegions = analytics?.semanticRegions.summaries ?? [];
  const communities = analytics?.communities.summaries ?? [];
  const centrality = analytics?.centrality.topNodes ?? [];
  const directedPath = analytics?.directedPath ?? null;

  if (!semanticRegions.length && !communities.length && !centrality.length && !fallbackLegendItems.length && !directedPath) {
    return <div className={graphLegendEmpty}>Regions and intelligence summaries will populate when graph analytics are ready.</div>;
  }

  return (
    <div className="flex flex-col gap-2.5">
      {semanticRegions.length ? (
        <div className="flex flex-col gap-2">
          <div className={graphEffectsSubsectionTitle}>Semantic regions</div>
          {semanticRegions.map((region) => (
            <div key={region.semanticGroup} className={graphLegendRow}>
              <span className={graphLegendSwatch} style={graphSemanticSwatchStyle(region.color)} />
              <div className="min-w-0 flex-1">
                <div className={graphLegendTitle}>{region.semanticGroup}</div>
                <div className={graphLegendMeta}>
                  {region.visibleNodeCount.toLocaleString()} visible / {region.nodeCount.toLocaleString()} total
                </div>
              </div>
              <div className={graphEffectsSignalBadge}>{region.anchorLabel}</div>
            </div>
          ))}
        </div>
      ) : null}

      {communities.length ? (
        <div className="flex flex-col gap-2">
          <div className={graphEffectsSubsectionTitle}>Community anchors</div>
          {communities.slice(0, 3).map((community) => (
            <div key={community.communityId} className={graphEffectsSignalRow}>
              <div className="min-w-0 flex-1">
                <div className={graphLegendTitle}>{community.anchorLabel}</div>
                <div className={graphLegendMeta}>
                  Community {community.communityId} - {community.visibleNodeCount} visible / {community.nodeCount} total
                </div>
              </div>
              <div className={graphEffectsSignalBadge}>{community.dominantSemanticGroup}</div>
            </div>
          ))}
        </div>
      ) : null}

      {centrality.length ? (
        <div className="flex flex-col gap-2">
          <div className={graphEffectsSubsectionTitle}>Centrality leaders</div>
          {centrality.slice(0, 3).map((node) => (
            <div key={node.id} className={graphEffectsSignalRow}>
              <div className="min-w-0 flex-1">
                <div className={graphLegendTitle}>{node.label}</div>
                <div className={graphLegendMeta}>
                  {node.semanticGroup} - score {node.score.toFixed(3)}
                </div>
              </div>
              <div className={graphEffectsSignalBadge}>deg {node.degree.toFixed(3)}</div>
            </div>
          ))}
        </div>
      ) : null}

      {directedPath ? (
        <div className="flex flex-col gap-2">
          <div className={graphEffectsSubsectionTitle}>Directed pathfinding</div>
          <div className={graphEffectsSignalRow}>
            <div className="min-w-0 flex-1">
              <div className={graphLegendTitle}>{directedPath.ready ? "Local directed path ready" : "Waiting for path context"}</div>
              <div className={graphLegendMeta}>{directedPath.reason}</div>
            </div>
            {directedPath.ready ? (
              <div className={graphEffectsSignalBadge}>
                {directedPath.length} hops{directedPath.verifiedAgainstActivePath ? " - match" : ""}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {!semanticRegions.length && !communities.length && !centrality.length && fallbackLegendItems.length ? (
        <div className="flex flex-col gap-2">
          <div className={graphEffectsSubsectionTitle}>Fallback semantic legend</div>
          {fallbackLegendItems.map((item) => (
            <div key={item.id} className={graphLegendRow}>
              <span className={graphLegendSwatch} style={graphSemanticSwatchStyle(item.color)} />
              <div className="min-w-0 flex-1">
                <div className={graphLegendTitle}>{item.group}</div>
                <div className={graphLegendMeta}>{item.count.toLocaleString()} nodes</div>
              </div>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export const explorationEffectsPluginPhaseC: GraphPlugin = {
  id: "exploration-effects",
  mount: () => {},
  unmount: () => {},
  onStateChange: () => {},
  toolbarItems: (context) => [
    {
      id: "effects-toggle",
      label: "Effects",
      title: "Open exploration effects controls",
      active: context.isPanelOpen(EFFECTS_PANEL_ID),
      order: 18,
      onClick: () => context.dispatchAction({ type: "togglePanel", panelId: EFFECTS_PANEL_ID }),
    },
  ],
  renderPanel: (context) => {
    if (!context.isPanelOpen(EFFECTS_PANEL_ID)) {
      return null;
    }

    const effectsState = context.getEffectsState();
    const diagnosticsSnapshot = context.getDiagnosticsSnapshot();
    const analyticsSnapshot = context.getAnalyticsSnapshot();
    const availability = diagnosticsSnapshot?.effectAvailability;
    const showSignalsSection =
      effectsState.legendEnabled
      || effectsState.semanticRegionsEnabled
      || effectsState.communitiesEnabled
      || effectsState.centralityEnabled
      || effectsState.pathfindingEnabled;

    return {
      id: EFFECTS_PANEL_ID,
      title: "Effects",
      placement: "bottom",
      order: 8,
      defaultOpen: false,
      preferredWidth: 460,
      preferredHeight: 360,
      content: (
        <div className={graphLegendPanel}>
          <div className={graphLegendEyebrow}>Exploration effects</div>

          <div className={graphEffectsSection}>
            <div className={graphEffectsSectionTitle}>Scene effects</div>
            {SCENE_EFFECT_ROWS.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          <div className={graphEffectsSection}>
            <div className={graphEffectsSectionTitle}>Graph intelligence</div>
            {INTELLIGENCE_EFFECT_ROWS.map((row) => (
              <EffectToggleRow
                key={row.key}
                label={row.label}
                description={row.description}
                checked={effectsState[row.key]}
                availability={resolveAvailability(availability, row.key, effectsState[row.key])}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: row.key })}
              />
            ))}
          </div>

          {showSignalsSection ? (
            <div className={graphEffectsSection}>
              <div className={graphEffectsSectionTitle}>Regions and signals</div>
              {renderRegionsAndSignals(context, analyticsSnapshot)}
            </div>
          ) : null}

          {import.meta.env.DEV ? (
            <div className={graphEffectsSection}>
              <div className={graphEffectsSectionTitle}>Diagnostics</div>
              <EffectToggleRow
                label="Dev Diagnostics"
                description="Inspect plugin, interaction, and effect gating state."
                checked={effectsState.diagnosticsEnabled}
                availability={resolveAvailability(availability, "diagnosticsEnabled", effectsState.diagnosticsEnabled)}
                onToggle={() => context.dispatchAction({ type: "toggleEffect", effect: "diagnosticsEnabled" })}
              />
              {effectsState.diagnosticsEnabled && diagnosticsSnapshot ? (
                <details className={graphEffectsDetails}>
                  <summary className={graphEffectsDetailsSummary}>Runtime snapshot</summary>
                  <pre className={graphEffectsPre}>
                    {JSON.stringify({ diagnostics: diagnosticsSnapshot, analytics: analyticsSnapshot }, null, 2)}
                  </pre>
                </details>
              ) : null}
            </div>
          ) : null}
        </div>
      ),
    };
  },
};
