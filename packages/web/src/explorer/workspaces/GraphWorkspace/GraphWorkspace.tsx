import { useCallback, useEffect, useMemo, useRef, useState, type ComponentType, type ReactNode } from "react";
import {
  Activity,
  Clock3,
  Eye,
  Flame,
  Focus,
  GitBranch,
  Layers3,
  Maximize2,
  Pause,
  Play,
  Radar,
  Route,
  Sparkles,
  Users,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";

import type Graph from "graphology";
import {
  buildExplorerGraphApiPath,
  buildExplorerKbApiPath,
  explorerFetch,
  openGraphUpdatesWebSocket,
} from "../../host/explorerHttp";
import { batchMergeEdges, batchMergeNodes, graph } from "../../store/graphStore";
import { logEvent } from "../../store/registryStore";
import type { EdgeAttributes, NodeAttributes } from "../../store/graphStore";
import { InspectorPanel, SurfaceCard } from "../../ui/primitives";
import { lazy, Suspense } from "react";
import { SigmaSceneAdapter } from "./SigmaSceneAdapter";
import { useLoadGraph, useReloadGraph } from "./useLoadGraph";
import { GraphLoadingOverlay } from "./GraphLoadingOverlay";
import { GraphSearchDock, type GraphSearchResult } from "./GraphSearchDock";
import { GraphStatusDock } from "./GraphStatusDock";
import { GraphColorLegendDock } from "./GraphColorLegendDock";
import { GraphToolbarRail } from "./GraphToolbarRail";
import { createGraphLoadProgress } from "./graphLoading";
import { Badge } from "@/components/ui/badge.js";
import { Button } from "@/components/ui/button.js";
import { useTheme } from "@/lib/theme.js";
import { GRAPH_THEME, withAlpha } from "./graphTheme";
import { syncSemaGraphTheme } from "./semaGraphThemeSync";
import { buildGraphColorLegend, type GraphColorLegendItem } from "./graphColorLegend";
import { focusedUnavailableReasonText, groupedViewReasonText } from "./graphViewCopy";
import { localGraphRequiresDraftConfirm } from "./localGraphTransition";
import { buildHeatmapRenderSnapshot, buildStructuralDistanceSnapshot, checkGroupedViewAvailability, resolveDisplayGraph, resolveDisplayStateSnapshot, resolveGroupedDisplayNodeId, resolveGroupedDisplayStateSnapshot, summarizeDistanceBuckets } from "./graphSceneState";
import {
  type GraphPlugin,
  type GraphPluginActionRequest,
  type GraphPluginContext,
  type GraphPluginOverlayDescriptor,
  type GraphPluginPanelDescriptor,
  type GraphPluginToolbarItem,
} from "./plugins";
import { explorationEffectsShouldLoad, neighborhoodPanelShouldLoad, temporalOverlayShouldLoad } from "./pluginRegistryPredicates";
import { shouldFetchTemporalBounds, shouldFetchTemporalSnapshot } from "./temporalLifecyclePredicates";
import { createTemporalSnapshotGuards, type TemporalSnapshotResponse } from "./temporalSnapshotGuards";
import { SMALL_GRAPH_MAX_NODES } from "./smallGraphLayout";
import { buildRealtimeEdgeAttributes } from "./realtimeGraphAttributes";
import type { LinkPrediction, PathResponse } from "./GraphInspectorPanel";
import type { MarkdownApplyResult } from "./markdownResourceClient";
import {
  NodeMarkdownRefreshGuard,
  buildNodeMarkdownAttributeUpdate,
  readNodeMarkdownAttributeUpdate,
} from "./nodeMarkdownSync";
import type { GraphSceneHandle, GraphSceneRuntime } from "./scene";
import type {
  FocusedUnavailableReason,
  GraphAnalyticsSnapshot,
  GraphDistanceVisualMode,
  GraphDistanceVisualState,
  GraphDisplayStateSnapshot,
  GraphDiagnosticsSnapshot,
  GraphEffectToggle,
  GraphEffectsState,
  GraphInteractionState,
  GraphLayoutViewMode,
  GraphLoadProgress,
  GraphLoadSummary,
  GraphRuntimeDiagnosticsSnapshot,
  GraphSelectedNodeKind,
  GraphSelectedNodeState,
  GraphTemporalState,
  GraphViewMode,
} from "./types";

type TemporalBounds = {
  min?: string | null;
  max?: string | null;
};

type ExploreLayoutState = {
  showInspector: boolean;
  showPluginDock: boolean;
};

type ToolbarIconComponent = ComponentType<{
  size?: number;
  strokeWidth?: number;
  "aria-hidden"?: boolean;
}>;

type GraphToolbarItem = {
  id: string;
  label: string;
  title?: string;
  active?: boolean;
  disabled?: boolean;
  tone?: "primary" | "secondary";
  icon?: ToolbarIconComponent;
  ariaLabel?: string;
  compact?: boolean;
  onClick: () => void;
};

type GraphToolbarGroup = {
  id: string;
  label?: string;
  variant?: "cluster" | "segmented";
  items: GraphToolbarItem[];
};

type SemanticNeighborhoodResponse = {
  anchor_node: string;
  total: number;
  neighbors: Array<{
    id: string;
    type: string;
    content: string;
    similarity: number;
    hop_distance?: number | null;
  }>;
};

type LazyPluginRegistryEntry = {
  id: string;
  panelId: string;
  label: string;
  title: string;
  order: number;
  load: () => Promise<GraphPlugin>;
  shouldLoad: (context: {
    panelState: Record<string, boolean>;
    temporalState?: GraphTemporalState | null;
  }) => boolean;
};

const PROVENANCE_KEYS = ["source", "source_url", "pmid", "pmids", "evidence", "provenance", "confidence"] as const;
const EMPTY_DISTANCE_RECORD: Record<string, number> = {};
const STRUCTURAL_DISTANCE_MAX_HOPS = 6;
const HEATMAP_DISTANCE_MAX_HOPS = 3;
const DEFAULT_EFFECTS_STATE: GraphEffectsState = {
  pathPulseEnabled: false,
  pathFlowEnabled: false,
  lensEnabled: false,
  temporalEmphasisEnabled: false,
  semanticRegionsEnabled: false,
  contoursEnabled: false,
  pathfindingEnabled: false,
  communitiesEnabled: false,
  centralityEnabled: false,
  legendEnabled: false,
  edgeLabelsEnabled: true,
  diagnosticsEnabled: false,
  lensMode: "neighborhood",
  effectQuality: "bounded",
};
const LazyTimelinePanel = lazy(() => import("./TimelinePanel").then((module) => ({ default: module.TimelinePanel })));
const LazyGraphInspectorPanel = lazy(() => import("./GraphInspectorPanel").then((module) => ({ default: module.GraphInspectorPanel })));

const loadExplorationEffectsPlugin = () => import("./plugins/explorationEffectsPluginPhaseC").then((module) => module.explorationEffectsPluginPhaseC);
const loadNeighborhoodPanelPlugin = () => import("./plugins/neighborhoodPanelPlugin").then((module) => module.neighborhoodPanelPlugin);
const loadTemporalOverlayPlugin = () => import("./plugins/temporalOverlayPlugin").then((module) => module.temporalOverlayPlugin);
const EMPTY_PATH: string[] = [];
const DEBUG_GRAPH_WORKSPACE = import.meta.env.DEV;

function debugGraphWorkspace(message: string, payload?: Record<string, unknown>) {
  if (!DEBUG_GRAPH_WORKSPACE) {
    return;
  }
  console.debug(`[GraphWorkspace] ${message}`, payload ?? {});
}

function getGraphSummarySignature(summary: GraphLoadSummary): string {
  return [
    summary.nodeCount,
    summary.edgeCount,
    summary.layoutSource ?? "unknown",
    summary.layoutReady ? "ready" : "runtime",
    summary.loadTimeMs,
  ].join(":");
}

function useDebounce<T>(value: T, delay: number): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);
  useEffect(() => {
    const timeout = setTimeout(() => setDebouncedValue(value), delay);
    return () => clearTimeout(timeout);
  }, [delay, value]);
  return debouncedValue;
}

function iconForPluginToolbarItem(item: GraphPluginToolbarItem): ToolbarIconComponent {
  const normalized = `${item.id} ${item.label}`.toLowerCase();
  if (normalized.includes("neighbor")) {
    return Users;
  }
  if (normalized.includes("temporal") || normalized.includes("time")) {
    return Clock3;
  }
  return Activity;
}

function buildGraphHudCss(): string {
  return `
  .palantir-bg {
    background: transparent;
  }
  .explore-scene-card.sem-surface {
    background: transparent !important;
    border-color: transparent;
    box-shadow: none;
    backdrop-filter: none;
    -webkit-backdrop-filter: none;
  }
  .glass-header {
    background: ${GRAPH_THEME.ui.surface.cardSubtle};
    border-bottom: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
    backdrop-filter: blur(12px);
    -webkit-backdrop-filter: blur(12px);
  }
  .glass-hud {
    background: ${GRAPH_THEME.ui.surface.panel};
    backdrop-filter: blur(14px) saturate(1.08);
    -webkit-backdrop-filter: blur(14px) saturate(1.08);
    border-left: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
    box-shadow: ${GRAPH_THEME.ui.surface.shadow};
  }
  .hud-scrollbar::-webkit-scrollbar { width: 6px; }
  .hud-scrollbar::-webkit-scrollbar-track { background: transparent; }
  .hud-scrollbar::-webkit-scrollbar-thumb { background: rgba(215, 209, 196, 0.22); border-radius: 6px; }
  .graph-loading-overlay {
    position: absolute;
    inset: 0;
    z-index: 9;
    display: flex;
    align-items: center;
    justify-content: center;
    pointer-events: none;
  }
  .graph-loading-card {
    width: min(460px, calc(100% - 48px));
    border-radius: 20px;
    padding: 22px 22px 18px;
    background: ${GRAPH_THEME.ui.surface.cardStrong};
    border: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
    box-shadow: ${GRAPH_THEME.ui.surface.shadow};
    backdrop-filter: blur(18px);
    -webkit-backdrop-filter: blur(18px);
  }
  .graph-loading-dots {
    display: inline-flex;
    gap: 8px;
    align-items: center;
  }
  .graph-loading-dot {
    width: 10px;
    height: 10px;
    border-radius: 999px;
    background: linear-gradient(135deg, ${GRAPH_THEME.ui.timeline.playhead}, ${GRAPH_THEME.palette.accent.selected});
    box-shadow: 0 0 18px rgba(98, 226, 205, 0.28);
    animation: sem-loader-pulse 1.2s ease-in-out infinite;
  }
  .graph-loading-dot:nth-child(2) {
    animation-delay: 0.14s;
  }
  .graph-loading-dot:nth-child(3) {
    animation-delay: 0.28s;
  }
  @keyframes sem-loader-pulse {
    0%, 100% {
      transform: translateY(0) scale(0.92);
      opacity: 0.55;
    }
    50% {
      transform: translateY(-4px) scale(1.08);
      opacity: 1;
    }
  }
  .graph-loading-bar {
    width: 100%;
    height: 10px;
    border-radius: 999px;
    overflow: hidden;
    background: rgba(255, 255, 255, 0.052);
    border: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
  }
  .graph-loading-bar > span {
    display: block;
    height: 100%;
    border-radius: 999px;
    background: linear-gradient(90deg, rgba(98, 226, 205, 0.9), rgba(233, 196, 122, 0.9));
    box-shadow: 0 0 28px rgba(98, 226, 205, 0.22);
    transition: width 180ms ease;
  }
  .explore-shell {
    position: relative;
    width: 100%;
    height: 100%;
    min-height: 0;
    container-type: inline-size;
    overflow: hidden;
  }
  .explore-search-dock {
    position: absolute;
    top: 0;
    left: 0;
    z-index: 30;
    width: max-content;
    max-width: min(100% - 24px, calc(100% - 200px));
    pointer-events: none;
    padding: 10px 0 0 12px;
    overflow: visible;
  }
  .explore-search-dock > * {
    pointer-events: auto;
  }
  .explore-search-dock-toolbar {
    min-width: 0;
    max-width: 100%;
  }
  .explore-search-dock-search {
    flex: 0 0 auto;
    width: 240px;
    max-width: min(240px, 38vw);
  }
  .explore-search-dock-actions {
    flex-wrap: nowrap;
  }
  .explore-status-dock {
    position: absolute;
    top: 0;
    right: 0;
    z-index: 22;
    pointer-events: none;
    padding: 10px 12px 0 0;
    max-width: min(520px, calc(100% - 24px));
    display: flex;
    justify-content: flex-end;
  }
  .explore-shell[data-inspector="true"] .explore-status-dock {
    right: min(340px, 38vw);
  }
  .explore-status-dock > * {
    pointer-events: auto;
  }
  .explore-legend-dock {
    position: absolute;
    bottom: 12px;
    left: 0;
    z-index: 9;
    pointer-events: none;
    padding: 0 12px;
    max-width: min(520px, calc(100% - 24px));
    max-height: 28vh;
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .explore-shell[data-timeline="true"] .explore-legend-dock {
    bottom: calc(90px + 12px);
  }
  .explore-legend-dock > * {
    pointer-events: auto;
  }
  .explore-toolbar-rail {
    position: absolute;
    top: 50%;
    left: 0;
    z-index: 23;
    transform: translateY(-50%);
    pointer-events: none;
    padding-left: 12px;
    max-height: min(70vh, 100%);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .explore-toolbar-rail > * {
    pointer-events: auto;
  }
  .explore-toolbar-rail-right {
    position: absolute;
    top: 50%;
    right: 0;
    z-index: 23;
    transform: translateY(-50%);
    pointer-events: none;
    padding-right: 12px;
    max-height: min(70vh, 100%);
    overflow-y: auto;
    overscroll-behavior: contain;
  }
  .explore-shell[data-inspector="true"] .explore-toolbar-rail-right {
    right: min(340px, 38vw);
  }
  .explore-toolbar-rail-right > * {
    pointer-events: auto;
  }
  .explore-main-grid {
    position: absolute;
    inset: 0;
    z-index: 1;
    min-height: 0;
    display: flex;
    min-width: 0;
  }
  .explore-scene-stack {
    position: relative;
    min-height: 0;
    min-width: 0;
    flex: 1;
    display: flex;
    flex-direction: column;
    gap: 0;
    height: 100%;
  }
  .explore-scene-card {
    position: relative;
    min-height: 0;
    flex: 1;
    height: 100%;
    display: flex;
    flex-direction: column;
    overflow: hidden;
  }
  .explore-scene-shell {
    position: absolute;
    inset: 0;
    overflow: hidden;
    border-radius: 0;
    background: transparent;
  }
  .explore-scene-stage {
    position: relative;
    z-index: 3;
    width: 100%;
    height: 100%;
  }
  .explore-scene-footer {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 8;
    border-top: 1px solid ${GRAPH_THEME.ui.timeline.border};
    background: ${GRAPH_THEME.ui.timeline.background};
    pointer-events: auto;
  }
  .explore-plugin-dock {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    z-index: 7;
    pointer-events: auto;
  }
  .explore-scene-card:has(.explore-scene-footer) .explore-plugin-dock {
    bottom: var(--explore-timeline-height, 90px);
  }
  .explore-plugin-dock-tabs {
    display: flex;
    align-items: center;
    gap: 6px;
    flex-wrap: wrap;
  }
  .explore-plugin-dock-tab {
    border: 1px solid ${GRAPH_THEME.ui.control.defaultBorder};
    background: ${GRAPH_THEME.ui.control.defaultBg};
    color: ${GRAPH_THEME.ui.control.defaultText};
    border-radius: 999px;
    padding: 6px 10px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .explore-plugin-dock-tab[data-active="true"] {
    color: ${GRAPH_THEME.ui.control.activeText};
    background: rgba(74, 181, 166, 0.18);
    border-color: ${GRAPH_THEME.ui.control.activeBorder};
  }
  .explore-toolbar {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .explore-status-strip {
    display: flex;
    align-items: center;
    gap: 7px;
    flex-wrap: wrap;
  }
  .explore-workflow-bar {
    display: grid;
    grid-template-columns: minmax(280px, 1fr) auto;
    align-items: center;
    gap: 10px;
  }
  .explore-search-command {
    position: relative;
    min-width: 0;
    height: 43px;
    display: grid;
    grid-template-columns: auto minmax(0, 1fr) auto;
    align-items: center;
    gap: 9px;
    padding: 4px 5px 4px 13px;
    border-radius: 16px;
    border: 1px solid ${GRAPH_THEME.ui.control.inputBorder};
    background:
      linear-gradient(135deg, rgba(255,255,255,0.06), rgba(255,255,255,0.018)),
      ${GRAPH_THEME.ui.control.inputBg};
    color: ${GRAPH_THEME.ui.text.muted};
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.045), 0 14px 30px rgba(0,0,0,0.16);
  }
  .explore-search-suggestions {
    position: absolute;
    top: calc(100% + 6px);
    left: 0;
    right: 0;
    z-index: 30;
    margin: 0;
    padding: 6px;
    list-style: none;
    max-height: 288px;
    overflow-y: auto;
    border-radius: 14px;
    border: 1px solid ${GRAPH_THEME.ui.control.inputBorder};
    background: ${GRAPH_THEME.ui.surface.cardStrong};
    box-shadow: 0 18px 40px rgba(0,0,0,0.32), inset 0 1px 0 rgba(255,255,255,0.04);
  }
  .explore-search-suggestions li {
    display: flex;
    align-items: baseline;
    justify-content: space-between;
    gap: 10px;
    padding: 8px 10px;
    border-radius: 10px;
    cursor: pointer;
    color: ${GRAPH_THEME.ui.text.body};
  }
  .explore-search-suggestions li[data-highlighted="true"] {
    background: ${GRAPH_THEME.ui.control.hoverBg};
  }
  .explore-search-suggestion-label {
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 13px;
    font-weight: 600;
  }
  .explore-search-suggestion-type {
    flex-shrink: 0;
    font-size: 11px;
    color: ${GRAPH_THEME.ui.text.subtle};
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }
  .explore-search-command:focus-within {
    border-color: ${GRAPH_THEME.ui.control.activeBorder};
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.06), 0 0 0 1px ${GRAPH_THEME.ui.control.focusRing}, 0 16px 32px rgba(0,0,0,0.18);
  }
  .explore-search-command input {
    width: 100%;
    min-width: 0;
    border: 0;
    outline: 0;
    color: ${GRAPH_THEME.ui.text.strong};
    background: transparent;
    font-size: 13px;
  }
  .explore-search-command input::placeholder {
    color: ${GRAPH_THEME.ui.text.subtle};
  }
  .explore-search-command button {
    height: 33px;
    border: 1px solid ${GRAPH_THEME.ui.control.primaryBorder};
    border-radius: 12px;
    padding: 0 13px;
    background: ${GRAPH_THEME.ui.control.primaryBg};
    color: ${GRAPH_THEME.ui.control.primaryText};
    font-size: 12px;
    font-weight: 800;
    cursor: pointer;
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.08);
  }
  .explore-search-command button:disabled {
    cursor: not-allowed;
    opacity: 0.45;
  }
  .explore-mode-control {
    display: inline-grid;
    grid-template-columns: repeat(3, minmax(88px, auto));
    align-items: center;
    padding: 4px;
    border-radius: 16px;
    border: 1px solid ${GRAPH_THEME.ui.control.defaultBorder};
    background: rgba(255, 255, 255, 0.026);
    box-shadow: inset 0 1px 0 rgba(255,255,255,0.035);
  }
  .explore-mode-segment {
    min-width: 0;
    border-radius: 12px;
  }
  .explore-toolbelt {
    min-width: 0;
    display: flex;
    justify-content: flex-start;
    align-items: center;
    gap: 6px;
    overflow-x: auto;
    overscroll-behavior-inline: contain;
    scrollbar-width: thin;
    padding: 1px 0 3px;
  }
  .explore-tool-cluster {
    display: inline-flex;
    flex: 0 0 auto;
    align-items: center;
    gap: 6px;
    min-height: 38px;
    padding: 4px;
    border-radius: calc(var(--radius) + 3px);
    border: 1px solid ${GRAPH_THEME.ui.control.defaultBorder};
    background: color-mix(in oklch, var(--muted) 58%, transparent);
  }
  .explore-tool-cluster-label {
    padding: 0 4px 0 7px;
    color: ${GRAPH_THEME.ui.text.subtle};
    font-size: 10px;
    font-weight: 800;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    white-space: nowrap;
  }
  .explore-tool-cluster-items {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .explore-tool-button {
    min-height: 30px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 7px;
    border: 1px solid ${GRAPH_THEME.ui.control.defaultBorder};
    border-radius: var(--radius);
    padding: 6px 9px;
    background: ${GRAPH_THEME.ui.control.defaultBg};
    color: ${GRAPH_THEME.ui.control.defaultText};
    font-size: 12px;
    font-weight: 700;
    line-height: 1;
    cursor: pointer;
    white-space: nowrap;
    box-shadow: none;
    transition: background 140ms ease, border-color 140ms ease, color 140ms ease;
  }
  .explore-tool-button:hover:not(:disabled) {
    background: ${GRAPH_THEME.ui.control.hoverBg};
    border-color: ${GRAPH_THEME.ui.control.activeBorder};
  }
  .explore-tool-button:disabled {
    cursor: not-allowed;
    color: ${GRAPH_THEME.ui.control.disabledText};
    opacity: 0.48;
    transform: none;
  }
  .explore-tool-button[data-active="true"] {
    color: ${GRAPH_THEME.ui.control.activeText};
    background: ${GRAPH_THEME.ui.control.activeBg};
    border-color: ${GRAPH_THEME.ui.control.activeBorder};
    box-shadow: 0 0 0 1px ${GRAPH_THEME.ui.control.focusRing}, inset 0 1px 0 rgba(255,255,255,0.06);
  }
  .explore-tool-button-primary {
    color: ${GRAPH_THEME.ui.control.primaryText};
    background: ${GRAPH_THEME.ui.control.primaryBg};
    border-color: ${GRAPH_THEME.ui.control.primaryBorder};
  }
  .explore-tool-button[data-compact="true"] {
    min-width: 34px;
    padding-inline: 9px;
  }
  .explore-tool-button[data-compact="true"] .explore-tool-button-label {
    display: none;
  }
  .explore-color-legend {
    display: flex;
    align-items: baseline;
    gap: 12px;
    padding: 2px 1px 0;
    color: ${GRAPH_THEME.ui.text.subtle};
    font-size: 11px;
    font-weight: 600;
  }
  .explore-color-legend-label {
    flex-shrink: 0;
    color: ${GRAPH_THEME.ui.text.muted};
  }
  .explore-color-legend-items {
    display: flex;
    flex-wrap: wrap;
    gap: 8px 14px;
    min-width: 0;
    max-height: 76px;
    overflow-y: auto;
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .explore-color-legend-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
    max-width: 100%;
  }
  .explore-color-legend-name {
    overflow-wrap: anywhere;
  }
  .explore-color-legend-mark {
    width: 10px;
    height: 10px;
    flex-shrink: 0;
    border-radius: 50%;
    box-shadow: inset 0 0 0 1px rgba(255,255,255,0.16);
  }
  .explore-search-results {
    display: flex;
    flex-direction: column;
    gap: 8px;
    max-height: 260px;
    overflow-y: auto;
    padding-right: 4px;
  }
  .explore-inspector-shell {
    position: absolute;
    top: 0;
    right: 0;
    bottom: 0;
    width: min(360px, 100%);
    z-index: 12;
    min-height: 0;
    display: flex;
    flex-direction: column;
    pointer-events: auto;
    border-left: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
    background: ${GRAPH_THEME.ui.surface.panel};
    box-shadow: -8px 0 24px -12px rgba(0, 0, 0, 0.08);
  }
  .explore-inspector-card {
    min-height: 0;
    flex: 1;
    overflow: hidden;
    border: 0;
    border-radius: 0;
    box-shadow: none;
    background: transparent;
  }
  .explore-inspector-scroll {
    height: 100%;
    overflow-y: auto;
  }
  @container (max-width: 980px) {
    .explore-search-dock {
      max-width: calc(100% - 24px);
    }
    .explore-shell[data-inspector="true"] .explore-status-dock,
    .explore-shell[data-inspector="true"] .explore-toolbar-rail-right {
      right: 0;
    }
    .explore-inspector-shell {
      top: auto;
      left: 0;
      right: 0;
      bottom: 0;
      width: auto;
      height: min(42vh, 360px);
      border-left: 0;
      border-top: 1px solid ${GRAPH_THEME.ui.surface.panelBorder};
    }
  }
  @container (max-width: 760px) {
    .explore-search-dock {
      max-width: calc(100% - 24px);
    }
    .explore-search-dock-search {
      width: min(200px, 32vw);
      max-width: 200px;
    }
    .explore-search-dock-actions {
      gap: 4px;
    }
    .explore-search-dock-actions :is(button, a) {
      padding-left: 0.5rem;
      padding-right: 0.5rem;
    }
    .explore-status-dock {
      max-width: calc(100% - 200px);
      padding-top: 10px;
    }
    .explore-toolbar-rail {
      max-width: min(100% - 24px, 220px);
    }
    .explore-workflow-bar {
      grid-template-columns: 1fr;
    }
    .explore-mode-control {
      width: 100%;
      grid-template-columns: repeat(3, minmax(0, 1fr));
    }
    .explore-toolbelt {
      justify-content: flex-start;
    }
    .explore-tool-cluster {
      max-width: 100%;
    }
    .explore-tool-cluster-label {
      display: none;
    }
  }
  @container (max-width: 520px) {
    .explore-status-strip {
      display: none;
    }
    .explore-mode-control {
      overflow-x: auto;
    }
    .explore-tool-button-label {
      display: none;
    }
  }
`;
}

function getProvenanceCount(properties: Record<string, unknown>) {
  return PROVENANCE_KEYS.reduce(
    (count, key) => (properties[key] !== undefined && properties[key] !== null ? count + 1 : count),
    0,
  );
}

function buildRealtimeNodeAttributes(payload: {
  id: string;
  type?: string;
  properties?: Record<string, unknown>;
}): NodeAttributes {
  const properties = payload.properties || {};
  const label = String(properties.content || payload.id);
  const baseColor = GRAPH_THEME.palette.accent.path;
  const hasTemporalBounds = Boolean(properties.valid_from || properties.valid_until);
  const provenanceCount = getProvenanceCount(properties);

  return {
    label,
    x: Number(properties.x ?? Math.random() * 1000 - 500),
    y: Number(properties.y ?? Math.random() * 1000 - 500),
    nodeType: payload.type || "inferred",
    content: label,
    valid_from: (properties.valid_from as string | null | undefined) ?? null,
    valid_until: (properties.valid_until as string | null | undefined) ?? null,
    properties,
    size: 8,
    baseSize: 8,
    semanticGroup: payload.type || "inferred",
    color: baseColor,
    baseColor,
    mutedColor: withAlpha(baseColor, GRAPH_THEME.nodes.mutedAlpha),
    glowColor: withAlpha(baseColor, 0.36),
    visualPriority: 0.82,
    labelPriority: 0.82,
    strokeColor: GRAPH_THEME.palette.background.nodeBorder,
    borderColor: GRAPH_THEME.palette.background.nodeBorder,
    borderSize: 0.85,
    nodeVariant: "inferred",
    nodeShapeVariant: "inferred",
    badgeKind: hasTemporalBounds ? "temporal" : provenanceCount > 0 ? "provenance" : "inferred",
    badgeCount: provenanceCount || undefined,
    ringColor: GRAPH_THEME.nodes.selectedRing.color,
    haloColor: withAlpha(baseColor, 0.42),
    labelVisibilityPolicy: "local",
  };
}

function synchronizeRealtimeSmallGraphEdges(isSmallGraph: boolean): void {
  graph.forEachEdge((edgeId) => {
    graph.setEdgeAttribute(edgeId, "isSmallGraph", isSmallGraph);
  });
}

function buildSelectedNodeState(
  nodeId: string,
  displayState: GraphDisplayStateSnapshot,
): GraphSelectedNodeState | null {
  if (!nodeId || !graph.hasNode(nodeId)) {
    return null;
  }

  const attributes = graph.getNodeAttributes(nodeId) as {
    label?: string;
    content?: string;
    nodeType?: string;
    color?: string;
    valid_from?: string | null;
    valid_until?: string | null;
    properties?: Record<string, unknown>;
  };

  return {
    id: nodeId,
    label: String(attributes.label ?? nodeId),
    content: String(attributes.content ?? attributes.label ?? nodeId),
    nodeType: String(attributes.nodeType ?? "Entity"),
    color: typeof attributes.color === "string" ? attributes.color : undefined,
    valid_from: attributes.valid_from ?? null,
    valid_until: attributes.valid_until ?? null,
    properties: attributes.properties ?? {},
    neighborCount: graph.neighbors(nodeId).length,
    visibleNeighborCount: displayState.selectedVisibleNeighborIds.length,
    collapsedNeighborCount: displayState.selectedCollapsedNeighborIds.length,
    isNeighborhoodCollapsed: displayState.selectedCollapsedNeighborIds.length > 0,
    canCollapseNeighborhood: graph.neighbors(nodeId).length > 8,
  };
}

type FocusResolution = {
  kind: GraphSelectedNodeKind;
  resolvedNodeId: string | null;
  reason: FocusedUnavailableReason | null;
};

function collectPluginPanels(
  plugins: GraphPlugin[],
  context: GraphPluginContext,
): GraphPluginPanelDescriptor[] {
  const panels: GraphPluginPanelDescriptor[] = [];

  for (const plugin of plugins) {
    try {
      const result = plugin.renderPanel?.(context);
      if (!result) {
        continue;
      }
      if (Array.isArray(result)) {
        panels.push(...result);
      } else {
        panels.push(result);
      }
    } catch (error) {
      console.error(`[GraphPlugin:${plugin.id}] panel render failed`, error);
    }
  }

  return panels.sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
}

function collectPluginOverlays(
  plugins: GraphPlugin[],
  context: GraphPluginContext,
): GraphPluginOverlayDescriptor[] {
  const overlays: GraphPluginOverlayDescriptor[] = [];

  for (const plugin of plugins) {
    try {
      const result = plugin.renderOverlay?.(context);
      if (!result) {
        continue;
      }
      if (Array.isArray(result)) {
        overlays.push(...result);
      } else {
        overlays.push(result);
      }
    } catch (error) {
      console.error(`[GraphPlugin:${plugin.id}] overlay render failed`, error);
    }
  }

  return overlays.sort((left, right) => {
    if ((left.layer ?? 0) !== (right.layer ?? 0)) {
      return (left.layer ?? 0) - (right.layer ?? 0);
    }
    return (left.order ?? 0) - (right.order ?? 0);
  });
}

interface GraphWorkspaceProps {
  /** Sema KB id — graph list APIs use `/api/kbs/{kbId}/graph/...`. */
  kbId?: string;
  externalFocusNodeId?: string;
  externalFocusToken?: number;
  /** Increment to trigger a full graph reload (e.g. after ledger rebuild). */
  externalReloadToken?: number;
  onDirtyChange?: (dirty: boolean) => void;
  /** Rendered after the graph reload control in the search dock (e.g. import/export). */
  graphDataActions?: ReactNode;
  /** When false, node Markdown editing is hidden (Sema viewer role). */
  graphWriteEnabled?: boolean;
  decisionsEnabled?: boolean;
}

export function GraphWorkspace({
  kbId,
  externalFocusNodeId,
  externalFocusToken,
  externalReloadToken,
  onDirtyChange,
  graphDataActions,
  graphWriteEnabled = true,
  decisionsEnabled = false,
}: GraphWorkspaceProps = {}) {
  const { theme } = useTheme();
  const hudCss = useMemo(() => {
    syncSemaGraphTheme(theme);
    return buildGraphHudCss();
  }, [theme]);
  const queryClient = useQueryClient();
  const [selectedNodeId, setSelectedNodeId] = useState("");
  const [focusedNodeId, setFocusedNodeId] = useState("");
  const [lastGroupedSelectedNodeId, setLastGroupedSelectedNodeId] = useState("");
  const [selectedEdgeId, setSelectedEdgeId] = useState("");
  const [isLayoutRunning, setIsLayoutRunning] = useState(false);
  const [graphReady, setGraphReady] = useState(false);
  const [graphVersion, setGraphVersion] = useState(0);
  const [markdownDraftDirty, setMarkdownDraftDirty] = useState(false);
  const markdownRefreshGuard = useMemo(() => new NodeMarkdownRefreshGuard(), []);
  const handleMarkdownDirtyChange = useCallback((dirty: boolean) => {
    setMarkdownDraftDirty(dirty);
    onDirtyChange?.(dirty);
  }, [onDirtyChange]);
  const [viewMode, setViewMode] = useState<GraphViewMode>("full");
  const [aggregationEnabled] = useState(true);
  const [collapsedNeighborhoodNodeIds, setCollapsedNeighborhoodNodeIds] = useState<string[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<GraphSearchResult[]>([]);
  const [searchError, setSearchError] = useState("");
  const [predictionType, setPredictionType] = useState("");
  const [isRunningPredictions, setIsRunningPredictions] = useState(false);
  const [predictions, setPredictions] = useState<LinkPrediction[]>([]);
  const [pathTargetId, setPathTargetId] = useState("");
  const [pathResult, setPathResult] = useState<PathResponse | null>(null);
  const [activeNodeCount, setActiveNodeCount] = useState<number | null>(null);
  const [temporalBounds, setTemporalBounds] = useState<TemporalBounds | null>(null);
  const [scrubberTime, setScrubberTime] = useState<Date | null>(null);
  // Deduplicates setScrubberTime calls by millisecond value so that React 18
  // concurrent-mode re-renders with a new Date object for the same timestamp
  // do not churn temporalState and retrigger the diagnostics effect (issue #830).
  const lastScrubberMsRef = useRef<number | null>(null);
  const onTimeChange = useCallback((time: Date) => {
    const ms = time.getTime();
    if (ms === lastScrubberMsRef.current) {
      return;
    }
    lastScrubberMsRef.current = ms;
    setScrubberTime(time);
  }, []);
  const [loadingProgress, setLoadingProgress] = useState<GraphLoadProgress | null>(null);
  const [pluginPanelState, setPluginPanelState] = useState<Record<string, boolean>>({
    "effects-panel": false,
    "neighborhood-panel": false,
    "temporal-panel": false,
  });
  const [activeDockPanelId, setActiveDockPanelId] = useState<string | null>(null);
  const [pluginRuntimeVersion, setPluginRuntimeVersion] = useState(0);
  const [effectsState, setEffectsState] = useState<GraphEffectsState>(DEFAULT_EFFECTS_STATE);
  const [graphDiagnosticsState, setGraphDiagnosticsState] = useState<GraphRuntimeDiagnosticsSnapshot | null>(null);
  // Tracks the last accepted diagnostics outside React's state cycle, allowing
  // handleDiagnosticsChange to compare synchronously before calling setState.
  const lastDiagnosticsRef = useRef<GraphRuntimeDiagnosticsSnapshot | null>(null);
  const [graphAnalyticsState, setGraphAnalyticsState] = useState<GraphAnalyticsSnapshot | null>(null);
  const [loadedPlugins, setLoadedPlugins] = useState<Record<string, GraphPlugin>>({});

  // FR-2: Egocentric depth-of-field
  const [egoModeEnabled, setEgoModeEnabled] = useState(false);
  const [egoMaxHops] = useState(3);
  // FR-3 frontend: Distance mode overlay
  const [distanceMode, setDistanceMode] = useState<"off" | "structural" | "semantic">("off");
  // FR-5: Distance heatmap layout
  const [heatmapEnabled, setHeatmapEnabled] = useState(false);
  const [semanticDistanceState, setSemanticDistanceState] = useState<{
    anchorNodeId: string | null;
    scores: Record<string, number>;
    count: number;
    status: GraphDistanceVisualState["status"];
    error: string | null;
  }>({
    anchorNodeId: null,
    scores: EMPTY_DISTANCE_RECORD,
    count: 0,
    status: "idle",
    error: null,
  });

  const debouncedTime = useDebounce(scrubberTime, 150);
  const prevActiveIdsRef = useRef<Set<string>>(new Set());
  const sceneRef = useRef<GraphSceneHandle>(null);
  const lastExternalFocusTokenRef = useRef<number | undefined>(undefined);
  const lastExternalReloadTokenRef = useRef<number | undefined>(undefined);
  const pluginRuntimeRef = useRef<GraphSceneRuntime | null>(null);
  const appliedGraphSummarySignatureRef = useRef<string | null>(null);
  const smallGraphModeRef = useRef(false);
  const pluginInteractionStateRef = useRef<GraphInteractionState>({
    hoveredNodeId: null,
    selectedNodeId: "",
    selectedEdgeId: "",
    focusedNodeId: "",
    activePath: [],
    activePathEdgeIds: [],
    viewMode: "full",
    zoomTier: "overview",
    isLayoutRunning: false,
  });
  const reload = useReloadGraph();

  useEffect(() => {
    syncSemaGraphTheme(theme);
    setGraphVersion((version) => version + 1);
    reload();
  }, [theme]);

  const handleLoadProgress = useCallback((progress: GraphLoadProgress) => {
    setLoadingProgress(progress);
    if (progress.phase !== "ready" && progress.phase !== "stabilizing_layout") {
      setGraphReady(false);
    }
  }, []);

  const applyGraphReadySummary = useCallback((graphSummary: GraphLoadSummary) => {
    const signature = getGraphSummarySignature(graphSummary);
    if (appliedGraphSummarySignatureRef.current === signature) {
      return;
    }

    appliedGraphSummarySignatureRef.current = signature;
    smallGraphModeRef.current = Boolean(
      graphSummary.layoutReady
      && !graphSummary.hasCoordinates
      && graphSummary.nodeCount > 0
      && graphSummary.nodeCount <= SMALL_GRAPH_MAX_NODES,
    );
    setGraphReady(true);
    setGraphVersion((current) => current + 1);
    setIsLayoutRunning(!graphSummary.layoutReady);

    if (graphSummary.layoutReady) {
      setLoadingProgress(null);
      return;
    }

    setLoadingProgress(createGraphLoadProgress({
      phase: "stabilizing_layout",
      progressKind: "indeterminate",
      nodesLoaded: graphSummary.nodeCount,
      nodesTotal: graphSummary.nodeCount,
      edgesLoaded: graphSummary.edgeCount,
      edgesTotal: graphSummary.edgeCount,
      message: "Settling runtime layout",
      showGraphBehind: true,
      layoutSource: graphSummary.layoutSource,
      layoutState: "bootstrapping",
    }));
  }, []);

  const {
    data: summary,
    isLoading,
    isFetching,
    isError: isGraphLoadError,
    error: graphLoadError,
    refetch: refetchGraph,
  } = useLoadGraph({
    kbId,
    enabled: true,
    onGraphReady: applyGraphReadySummary,
    onProgress: handleLoadProgress,
  });

  const graphLoadErrorMessage = isGraphLoadError
    ? (graphLoadError instanceof Error ? graphLoadError.message : "Unknown error while loading the graph.")
    : null;

  const handleRetryGraphLoad = useCallback(() => {
    setLoadingProgress(null);
    void refetchGraph();
  }, [refetchGraph]);

  useEffect(() => {
    if (isLayoutRunning) {
      return;
    }

    setLoadingProgress((current) => (current?.phase === "stabilizing_layout" ? null : current));
  }, [isLayoutRunning]);

  useEffect(() => {
    if (!summary || graphReady) {
      return;
    }

    applyGraphReadySummary(summary);
  }, [applyGraphReadySummary, graphReady, summary]);

  const canFetchTemporalBounds = shouldFetchTemporalBounds(summary);
  const canFetchTemporalSnapshot = shouldFetchTemporalSnapshot({
    debouncedTime,
    isLoading,
    summary,
  });

  useEffect(() => {
    if (!canFetchTemporalBounds) {
      return;
    }

    let cancelled = false;
    const loadBounds = async () => {
      try {
        const response = await explorerFetch(buildExplorerKbApiPath("temporal/bounds", kbId));
        if (!response.ok || cancelled) return;
        const data: TemporalBounds = await response.json();
        if (!cancelled) {
          setTemporalBounds(data);
        }
      } catch {
        if (!cancelled) {
          setTemporalBounds(null);
        }
      }
    };
    loadBounds();
    return () => {
      cancelled = true;
    };
  }, [
    canFetchTemporalBounds,
    kbId,
    summary?.nodeCount,
    summary?.edgeCount,
  ]);

  // Guards the snapshot lifecycle: at most one in-flight request per scrubber
  // position (identical-`at` polls are deduplicated, breaking the idle/play
  // polling loop), applied snapshots are cached and re-applied on revisit, and
  // a response applies only while the scrubber is still on its position
  // (out-of-order responses cannot clobber the active-node count).
  const temporalSnapshotGuardsRef = useRef<ReturnType<typeof createTemporalSnapshotGuards> | null>(null);
  if (temporalSnapshotGuardsRef.current === null) {
    temporalSnapshotGuardsRef.current = createTemporalSnapshotGuards();
  }
  const temporalSnapshotGuards = temporalSnapshotGuardsRef.current;

  // A new graph summary means the graph data was replaced (reload/retry);
  // snapshots cached against the previous graph are stale, so reset all state.
  useEffect(() => {
    temporalSnapshotGuards.reset();
  }, [summary]);

  useEffect(() => {
    if (!canFetchTemporalSnapshot) {
      return;
    }

    if (!debouncedTime) {
      return;
    }

    const atMs = debouncedTime.getTime();
    const { seq, cached } = temporalSnapshotGuards.begin(atMs);
    if (seq === null) {
      // An identical request is already in flight: one request per position.
      return;
    }

    let cancelled = false;

    const applyData = (data: TemporalSnapshotResponse) => {
      const nextActiveIds = new Set(data.active_node_ids);
      requestAnimationFrame(() => {
        if (cancelled) return;
        if (!temporalSnapshotGuards.shouldApply(atMs, seq)) {
          // The scrubber moved on (or this request was superseded): release the
          // position so a return to it refetches instead of stalling.
          temporalSnapshotGuards.finish(atMs, seq);
          return;
        }
        const previous = prevActiveIdsRef.current;
        previous.forEach((id) => {
          if (!nextActiveIds.has(id) && graph.hasNode(id)) {
            graph.setNodeAttribute(id, "hidden", true);
          }
        });
        nextActiveIds.forEach((id) => {
          if (graph.hasNode(id)) {
            graph.setNodeAttribute(id, "hidden", false);
          }
        });
        prevActiveIdsRef.current = nextActiveIds;
        setActiveNodeCount(data.active_node_count);
        setGraphVersion((current) => current + 1);
        sceneRef.current?.getRuntime()?.requestRender();
        temporalSnapshotGuards.apply(atMs, seq, data);
      });
    };

    if (cached) {
      // Returning to a position whose snapshot was already applied: re-apply
      // the cached result without a network request.
      applyData(cached);
      return;
    }

    const applySnapshot = async () => {
      try {
        const at = debouncedTime.toISOString();
        const response = await explorerFetch(
          buildExplorerKbApiPath(`temporal/snapshot?at=${encodeURIComponent(at)}`, kbId),
        );
        if (!response.ok) {
          // A failed request must be retryable if the scrubber returns.
          if (!cancelled) temporalSnapshotGuards.finish(atMs, seq);
          return;
        }
        if (cancelled) return;

        const data: TemporalSnapshotResponse = await response.json();
        if (cancelled) return;
        applyData(data);
      } catch (fetchError) {
        temporalSnapshotGuards.finish(atMs, seq);
        if (!cancelled) {
          console.error("[Temporal] Snapshot fetch failed", fetchError);
        }
      }
    };

    applySnapshot();
    return () => {
      cancelled = true;
      // A cancelled request must be retryable when its position is revisited.
      temporalSnapshotGuards.finish(atMs, seq);
    };
  }, [
    canFetchTemporalSnapshot,
    debouncedTime,
    kbId,
  ]);

  const resolveNodeIdForFocusedMode = useCallback((
    nodeId: string,
    displayGraphCandidate?: GraphSceneRuntime["displayGraph"] | null,
  ): FocusResolution => {
    if (!nodeId) {
      return {
        kind: "none",
        resolvedNodeId: null,
        reason: { code: "no-selection" },
      };
    }

    if (graph.hasNode(nodeId)) {
      return {
        kind: "base",
        resolvedNodeId: nodeId,
        reason: null,
      };
    }

    const currentDisplayGraph = displayGraphCandidate ?? pluginRuntimeRef.current?.displayGraph ?? graph;
    if (currentDisplayGraph.hasNode(nodeId)) {
      const displayAttrs = currentDisplayGraph.getNodeAttributes(nodeId) as NodeAttributes;
      const communityGroup = displayAttrs.properties?.__communityGroup as
        | {
            anchorNodeId?: string | null;
            sampleNodeIds?: string[];
          }
        | undefined;

      const anchorNodeId = communityGroup?.anchorNodeId || communityGroup?.sampleNodeIds?.[0] || "";
      if (anchorNodeId && graph.hasNode(anchorNodeId)) {
        return {
          kind: "grouped",
          resolvedNodeId: anchorNodeId,
          reason: null,
        };
      }

      return {
        kind: "grouped",
        resolvedNodeId: null,
        reason: { code: "grouped-unresolvable" },
      };
    }

    return {
      kind: "unavailable",
      resolvedNodeId: null,
      reason: { code: "not-in-graph" },
    };
  }, []);

  const focusedSelectionResolution = useMemo(
    () => resolveNodeIdForFocusedMode(selectedNodeId, pluginRuntimeRef.current?.displayGraph),
    [pluginRuntimeVersion, resolveNodeIdForFocusedMode, selectedNodeId, viewMode],
  );
  const inspectableNodeId = focusedSelectionResolution.resolvedNodeId ?? "";
  const canActivateFocusedMode = Boolean(focusedSelectionResolution.resolvedNodeId);
  const { available: groupedViewAvailable, reason: groupedViewReason } = useMemo(
    () => checkGroupedViewAvailability(),
    [graphVersion],
  );
  const groupedDisplayCandidate = useMemo(
    () => viewMode === "grouped"
      ? resolveDisplayGraph("", EMPTY_PATH, EMPTY_PATH, "grouped", {
          aggregationEnabled,
          collapsedNeighborhoodNodeIds,
        })
      : null,
    [viewMode, aggregationEnabled, collapsedNeighborhoodNodeIds, graphVersion],
  );
  const confirmDiscardMarkdownDraft = useCallback(() => {
    if (!markdownDraftDirty) return true;
    const discard = window.confirm(
      "Discard the unapplied Markdown draft and leave this node?",
    );
    return discard;
  }, [markdownDraftDirty]);


  const enterLocalGraph = useCallback((nodeId: string) => {
    const resolution = resolveNodeIdForFocusedMode(nodeId, pluginRuntimeRef.current?.displayGraph);
    if (!resolution.resolvedNodeId) {
      return;
    }

    const nextNodeId = resolution.resolvedNodeId;
    const requiresDraftConfirm = localGraphRequiresDraftConfirm(viewMode, selectedNodeId, nextNodeId);
    if (requiresDraftConfirm && !confirmDiscardMarkdownDraft()) {
      return;
    }

    setFocusedNodeId(nextNodeId);
    setSelectedNodeId(nextNodeId);
    if (requiresDraftConfirm) {
      setSelectedEdgeId("");
      setPathResult(null);
      setSearchResults([]);
      setSearchError("");
    }
    setViewMode("focused");
    setIsLayoutRunning(false);
  }, [confirmDiscardMarkdownDraft, resolveNodeIdForFocusedMode, selectedNodeId, viewMode]);

  const setLayoutViewMode = useCallback((nextViewMode: GraphLayoutViewMode) => {
    if (nextViewMode !== viewMode && !confirmDiscardMarkdownDraft()) return;

    if (nextViewMode === "grouped") {
      if (!groupedViewAvailable) {
        debugGraphWorkspace("grouped-view-unavailable", {
          reason: groupedViewReason,
          graphVersion,
        });
        return;
      }

      const groupedDisplayGraph = groupedDisplayCandidate?.graph
        ?? resolveDisplayGraph("", EMPTY_PATH, EMPTY_PATH, "grouped", {
          aggregationEnabled,
          collapsedNeighborhoodNodeIds,
        }).graph;
      const nextGroupedSelection = [
        lastGroupedSelectedNodeId,
        selectedNodeId,
        focusedNodeId,
      ]
        .map((candidateId) => resolveGroupedDisplayNodeId(groupedDisplayGraph, candidateId))
        .find((candidateId): candidateId is string => Boolean(candidateId))
        ?? "";

      setFocusedNodeId("");
      setSelectedNodeId(nextGroupedSelection);
      if (nextGroupedSelection) {
        setLastGroupedSelectedNodeId(nextGroupedSelection);
      }
      setViewMode("grouped");
      setIsLayoutRunning(true);
      return;
    }

    setFocusedNodeId("");
    setSelectedNodeId((currentSelectedNodeId) => (
      currentSelectedNodeId && graph.hasNode(currentSelectedNodeId) ? currentSelectedNodeId : ""
    ));
    setViewMode("full");
  }, [
    confirmDiscardMarkdownDraft,
    aggregationEnabled,
    collapsedNeighborhoodNodeIds,
    focusedNodeId,
    graphVersion,
    groupedDisplayCandidate,
    groupedViewAvailable,
    groupedViewReason,
    lastGroupedSelectedNodeId,
    selectedNodeId,
    viewMode,
  ]);

  const focusNode = useCallback((nodeId: string) => {
    if (nodeId !== selectedNodeId && !confirmDiscardMarkdownDraft()) return;
    if (!nodeId) {
      setSelectedNodeId("");
      setSelectedEdgeId("");
      setPathResult(null);
      setSearchResults([]);
      setSearchError("");
      return;
    }

    const currentDisplayGraph = pluginRuntimeRef.current?.displayGraph ?? graph;
    const nextSelectedNodeId = nodeId;

    if (!graph.hasNode(nodeId) && currentDisplayGraph.hasNode(nodeId)) {
      setLastGroupedSelectedNodeId(nodeId);
    }

    setSelectedNodeId(nextSelectedNodeId);
    setSelectedEdgeId("");
    setPathResult(null);
    setSearchResults([]);
    setSearchError("");
    if (viewMode === "focused" && graph.hasNode(nextSelectedNodeId)) {
      setFocusedNodeId(nextSelectedNodeId);
      setIsLayoutRunning(false);
    }
  }, [confirmDiscardMarkdownDraft, selectedNodeId, viewMode]);  // Note: ego/heatmap/distanceMode effects re-run automatically when selectedNodeId changes

  useEffect(() => {
    if (!externalFocusNodeId || externalFocusToken == null) return;
    if (lastExternalFocusTokenRef.current === externalFocusToken) return;
    if (!graphReady || !graph.hasNode(externalFocusNodeId)) return;
    if (
      externalFocusNodeId !== selectedNodeId
      && !confirmDiscardMarkdownDraft()
    ) return;
    lastExternalFocusTokenRef.current = externalFocusToken;

    // Set state directly instead of going through focusNode(), which captures
    // a stale viewMode in its closure. setViewMode is called first so the node
    // is visible in the full graph before the scene pans to it.
    setViewMode("full");
    setSelectedNodeId(externalFocusNodeId);
    setSelectedEdgeId("");
    window.setTimeout(() => {
      sceneRef.current?.focusNode(externalFocusNodeId);
    }, 0);
  }, [
    confirmDiscardMarkdownDraft,
    externalFocusNodeId,
    externalFocusToken,
    graphReady,
    selectedNodeId,
  ]);

  useEffect(() => {
    if (externalReloadToken == null || externalReloadToken === 0) return;
    if (lastExternalReloadTokenRef.current === externalReloadToken) return;
    lastExternalReloadTokenRef.current = externalReloadToken;
    reload();
  }, [externalReloadToken, reload]);

  const handleEdgeSelect = useCallback((edgeId: string) => {
    setSelectedEdgeId(edgeId);
  }, []);

  const handleSearch = useCallback(async () => {
    if (!searchQuery.trim()) {
      setSearchResults([]);
      return;
    }
    setSearchError("");
    try {
      const response = await explorerFetch(buildExplorerGraphApiPath("search", kbId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query: searchQuery, limit: 8 }),
      });
      if (!response.ok) {
        throw new Error(`Search failed with status ${response.status}`);
      }
      const data = await response.json();
      setSearchResults(data.results || []);
    } catch (searchFetchError) {
      setSearchError(searchFetchError instanceof Error ? searchFetchError.message : "Search failed");
    }
  }, [kbId, searchQuery]);

  const handleClearSearchResults = useCallback(() => {
    setSearchResults([]);
    setSearchError("");
  }, []);

  const handleRunPredictions = useCallback(async () => {
    if (!inspectableNodeId) return;
    setIsRunningPredictions(true);
    try {
      const response = await explorerFetch(buildExplorerKbApiPath("enrich/links", kbId), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          node_id: inspectableNodeId,
          top_n: 6,
          candidate_type: predictionType || undefined,
          min_score: 0,
        }),
      });
      if (!response.ok) {
        throw new Error(`Link prediction failed with status ${response.status}`);
      }
      const data = await response.json();
      setPredictions(data.predictions || []);
    } catch (predictionError) {
      console.error("[GraphWorkspace] prediction failed", predictionError);
      setPredictions([]);
    } finally {
      setIsRunningPredictions(false);
    }
  }, [inspectableNodeId, kbId, predictionType]);

  const handleTracePath = useCallback(async () => {
    if (!inspectableNodeId || !pathTargetId.trim()) return;
    try {
      const pathParams = new URLSearchParams({
        source: inspectableNodeId,
        target: pathTargetId.trim(),
        algorithm: "dijkstra",
      });
      const response = await explorerFetch(
        buildExplorerGraphApiPath(`path?${pathParams.toString()}`, kbId),
      );
      if (!response.ok) {
        throw new Error(`Path lookup failed with status ${response.status}`);
      }
      const data: PathResponse = await response.json();
      setPathResult(data);
      if (data.path?.length) {
        const lastStep = data.path[data.path.length - 1];
        if (graph.hasNode(lastStep)) {
          sceneRef.current?.focusNode(lastStep);
        }
      }
    } catch (pathError) {
      console.error("[GraphWorkspace] path trace failed", pathError);
      setPathResult(null);
    }
  }, [inspectableNodeId, kbId, pathTargetId]);

  const handleDownloadProvenance = useCallback(async (format: "json" | "markdown") => {
    if (!inspectableNodeId) return;
    const suffix = format === "markdown" ? "markdown" : "json";
    const response = await explorerFetch(
      buildExplorerKbApiPath(
        `provenance/report?node_id=${encodeURIComponent(inspectableNodeId)}&format=${suffix}`,
        kbId,
      ),
    );
    if (!response.ok) {
      throw new Error(`Provenance report failed with status ${response.status}`);
    }
    const blob = await response.blob();
    const url = window.URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `${inspectableNodeId}_provenance.${format === "markdown" ? "md" : "json"}`;
    document.body.appendChild(anchor);
    anchor.click();
    window.URL.revokeObjectURL(url);
    document.body.removeChild(anchor);
  }, [inspectableNodeId, kbId]);

  const handleMarkdownApplied = useCallback((result: MarkdownApplyResult) => {
    if (result.resource.kind !== "context-node") return;
    if (!graph.hasNode(result.resource.id)) return;
    const syncGeneration = markdownRefreshGuard.begin(result.resource.id);
    const attributes = graph.getNodeAttributes(result.resource.id) as NodeAttributes;
    graph.mergeNodeAttributes(
      result.resource.id,
      buildNodeMarkdownAttributeUpdate(
        result.resource.id,
        result.body,
        attributes.properties ?? {},
      ),
    );
    setGraphVersion((current) => current + 1);
    sceneRef.current?.getRuntime()?.requestRender();

    void readNodeMarkdownAttributeUpdate(result.resource.id, kbId)
      .then((savedAttributes) => {
        if (
          !markdownRefreshGuard.isCurrent(result.resource.id, syncGeneration)
          || !graph.hasNode(result.resource.id)
        ) return;
        graph.mergeNodeAttributes(result.resource.id, savedAttributes);
        setGraphVersion((current) => current + 1);
        sceneRef.current?.getRuntime()?.requestRender();
      })
      .catch((syncError) => {
        console.error("[GraphWorkspace] applied node refresh failed", syncError);
      });
  }, [kbId, markdownRefreshGuard]);

  useEffect(() => {
    let socket: WebSocket | null = null;
    let cancelled = false;

    const attachSocket = (activeSocket: WebSocket) => {
      socket = activeSocket;
      activeSocket.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data);
        if (message.type === "projection_updated") {
          void queryClient.invalidateQueries({ queryKey: ["graph", "full-load"] });
          return;
        }
        if (message.type === "access_revoked") {
          activeSocket.close();
          return;
        }
        if (message.type === "connected" || message.event === "connection_ack") {
          return;
        }
        if (message.event !== "graph_mutation") {
          return;
        }
        const eventType = message.data?.event_type;
        const payload = message.data?.payload;
        if (eventType === "ADD_NODE" && payload?.id) {
          batchMergeNodes([
            {
              id: payload.id,
              attributes: buildRealtimeNodeAttributes(payload),
            },
          ]);
          if (graph.order > SMALL_GRAPH_MAX_NODES) {
            smallGraphModeRef.current = false;
          }
          synchronizeRealtimeSmallGraphEdges(smallGraphModeRef.current);
          logEvent("add-node", `Added node ${payload.label ?? payload.id}${payload.nodeType ? ` (${payload.nodeType})` : ""} via realtime ws`, { nodeId: payload.id, nodeType: payload.nodeType });
          setGraphVersion((current) => current + 1);
          sceneRef.current?.getRuntime()?.requestRender();
        }
        if (eventType === "UPDATE_NODE" && payload?.id && graph.hasNode(payload.id)) {
          markdownRefreshGuard.invalidate(payload.id);
          const properties = payload.properties ?? {};
          const current = graph.getNodeAttributes(payload.id) as NodeAttributes;
          const content = typeof properties.content === "string" ? properties.content : "";
          graph.mergeNodeAttributes(payload.id, {
            ...buildNodeMarkdownAttributeUpdate(payload.id, content, properties),
            nodeType: payload.type ?? current.nodeType,
            valid_from: properties.valid_from ?? null,
            valid_until: properties.valid_until ?? null,
          });
          logEvent(
            "update-node",
            `Updated node ${payload.id} via realtime ws`,
            { nodeId: payload.id, nodeType: payload.type },
          );
          setGraphVersion((version) => version + 1);
          sceneRef.current?.getRuntime()?.requestRender();
        }
        if (eventType === "ADD_EDGE") {
          const isSmallGraph = smallGraphModeRef.current;
          batchMergeEdges([
            {
              id: String(payload.id),
              familyId: payload.familyId ? String(payload.familyId) : String(payload.id),
              source: payload.source_id,
              target: payload.target_id,
              attributes: buildRealtimeEdgeAttributes(payload, {
                isBidirectional: graph.hasDirectedEdge(payload.target_id, payload.source_id),
                isSmallGraph,
              }),
            },
          ]);
          logEvent("add-edge", `Added edge ${payload.edgeType ?? payload.id} (${payload.source_id} → ${payload.target_id}) via realtime ws`, { edgeId: payload.id, edgeType: payload.edgeType, source: payload.source_id, target: payload.target_id });
          setGraphVersion((current) => current + 1);
          sceneRef.current?.getRuntime()?.requestRender();
        }
      } catch (socketError) {
        console.error("[GraphWorkspace] websocket update failed", socketError);
      }
      };
    };

    void openGraphUpdatesWebSocket()
      .then((activeSocket) => {
        if (cancelled) {
          activeSocket.close();
          return;
        }
        attachSocket(activeSocket);
      })
      .catch((error) => {
        console.warn("[GraphWorkspace] graph updates websocket unavailable", error);
      });

    return () => {
      cancelled = true;
      socket?.close();
    };
  }, [queryClient]);

  useEffect(() => {
    setCollapsedNeighborhoodNodeIds([]);
    setFocusedNodeId("");
    setLastGroupedSelectedNodeId("");
  }, [summary?.edgeCount, summary?.nodeCount]);

  const activeDistanceMode: GraphDistanceVisualMode = egoModeEnabled
    ? "ego"
    : heatmapEnabled
      ? "heatmap"
      : distanceMode;
  const distanceAnchorNodeId = viewMode === "full" && selectedNodeId && graph.hasNode(selectedNodeId)
    ? selectedNodeId
    : "";
  const distanceAnchorLabel = distanceAnchorNodeId
    ? String((graph.getNodeAttributes(distanceAnchorNodeId) as NodeAttributes).label || distanceAnchorNodeId)
    : null;
  const distanceMaxHops = activeDistanceMode === "ego"
    ? egoMaxHops
    : activeDistanceMode === "heatmap"
      ? HEATMAP_DISTANCE_MAX_HOPS
      : STRUCTURAL_DISTANCE_MAX_HOPS;
  const structuralDistances = useMemo(
    () => (
      distanceAnchorNodeId && activeDistanceMode !== "off"
        ? buildStructuralDistanceSnapshot(graph, distanceAnchorNodeId, distanceMaxHops)
        : EMPTY_DISTANCE_RECORD
    ),
    [activeDistanceMode, distanceAnchorNodeId, distanceMaxHops, graphVersion],
  );
  const distanceCounts = useMemo(
    () => summarizeDistanceBuckets(structuralDistances, graph.order),
    [structuralDistances, graphVersion],
  );
  const heatmapRenderSnapshot = useMemo(
    () => (
      activeDistanceMode === "heatmap" && distanceAnchorNodeId
        ? buildHeatmapRenderSnapshot(graph, distanceAnchorNodeId, structuralDistances, HEATMAP_DISTANCE_MAX_HOPS)
        : null
    ),
    [activeDistanceMode, distanceAnchorNodeId, graphVersion, structuralDistances],
  );

  useEffect(() => {
    if (viewMode === "full") {
      return;
    }
    setEgoModeEnabled(false);
    setHeatmapEnabled(false);
    setDistanceMode("off");
  }, [viewMode]);

  useEffect(() => {
    if (activeDistanceMode === "off" || !selectedNodeId || !graph.hasNode(selectedNodeId)) {
      setEgoModeEnabled(false);
      setHeatmapEnabled(false);
      setDistanceMode("off");
    }
  }, [activeDistanceMode, graphVersion, selectedNodeId]);

  useEffect(() => {
    if (distanceMode !== "semantic" || !distanceAnchorNodeId) {
      setSemanticDistanceState({
        anchorNodeId: distanceAnchorNodeId || null,
        scores: EMPTY_DISTANCE_RECORD,
        count: 0,
        status: distanceMode === "semantic" ? "unavailable" : "idle",
        error: distanceMode === "semantic" ? "Select a Full Graph node to load semantic distance." : null,
      });
      return;
    }

    let cancelled = false;
    setSemanticDistanceState({
      anchorNodeId: distanceAnchorNodeId,
      scores: EMPTY_DISTANCE_RECORD,
      count: 0,
      status: "loading",
      error: null,
    });

    const loadSemanticNeighborhood = async () => {
      try {
        const semanticParams = new URLSearchParams({
          node_id: distanceAnchorNodeId,
          top_k: "50",
        });
        const response = await explorerFetch(
          buildExplorerGraphApiPath(`semantic-neighborhood?${semanticParams.toString()}`, kbId),
        );
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          throw new Error(response.status === 503
            ? "Semantic similarity is unavailable for this graph."
            : response.status === 404
              ? "Selected node was not found by the semantic distance API."
            : `Semantic distance failed with status ${response.status}`);
        }

        const data: SemanticNeighborhoodResponse = await response.json();
        const scores = data.neighbors.reduce<Record<string, number>>((nextScores, neighbor) => {
          if (Number.isFinite(neighbor.similarity)) {
            nextScores[neighbor.id] = neighbor.similarity;
          }
          return nextScores;
        }, {});

        setSemanticDistanceState({
          anchorNodeId: distanceAnchorNodeId,
          scores,
          count: Object.keys(scores).length,
          status: Object.keys(scores).length > 0 ? "ready" : "unavailable",
          error: Object.keys(scores).length > 0 ? null : "No semantic neighbors were returned for this node.",
        });
      } catch (error) {
        if (cancelled) {
          return;
        }
        setSemanticDistanceState({
          anchorNodeId: distanceAnchorNodeId,
          scores: EMPTY_DISTANCE_RECORD,
          count: 0,
          status: "error",
          error: error instanceof Error ? error.message : "Semantic distance could not be loaded.",
        });
      }
    };

    void loadSemanticNeighborhood();
    return () => {
      cancelled = true;
    };
  }, [distanceAnchorNodeId, distanceMode, kbId]);

  const distanceVisualState = useMemo<GraphDistanceVisualState>(() => {
    if (activeDistanceMode === "off") {
      return {
        mode: "off",
        anchorNodeId: null,
        anchorLabel: null,
        maxHops: distanceMaxHops,
        structuralDistances: EMPTY_DISTANCE_RECORD,
        semanticScores: EMPTY_DISTANCE_RECORD,
        distanceCounts: undefined,
        outsideCount: 0,
        heatmapVisibleNodeIds: undefined,
        heatmapRingCounts: undefined,
        heatmapRenderedRingCounts: undefined,
        heatmapSaturationMode: undefined,
        semanticNeighborCount: 0,
        status: "idle",
        error: null,
      };
    }

    if (viewMode !== "full") {
      return {
        mode: activeDistanceMode,
        anchorNodeId: null,
        anchorLabel: null,
        maxHops: distanceMaxHops,
        structuralDistances: EMPTY_DISTANCE_RECORD,
        semanticScores: EMPTY_DISTANCE_RECORD,
        distanceCounts: undefined,
        outsideCount: graph.order,
        heatmapVisibleNodeIds: undefined,
        heatmapRingCounts: undefined,
        heatmapRenderedRingCounts: undefined,
        heatmapSaturationMode: undefined,
        semanticNeighborCount: 0,
        status: "unavailable",
        error: "Distance intelligence is available in Full Graph mode.",
      };
    }

    if (!distanceAnchorNodeId) {
      return {
        mode: activeDistanceMode,
        anchorNodeId: null,
        anchorLabel: null,
        maxHops: distanceMaxHops,
        structuralDistances: EMPTY_DISTANCE_RECORD,
        semanticScores: EMPTY_DISTANCE_RECORD,
        distanceCounts: undefined,
        outsideCount: graph.order,
        heatmapVisibleNodeIds: undefined,
        heatmapRingCounts: undefined,
        heatmapRenderedRingCounts: undefined,
        heatmapSaturationMode: undefined,
        semanticNeighborCount: 0,
        status: "unavailable",
        error: "Select a node to activate distance intelligence.",
      };
    }

    if (activeDistanceMode === "semantic") {
      return {
        mode: "semantic",
        anchorNodeId: distanceAnchorNodeId,
        anchorLabel: distanceAnchorLabel,
        maxHops: distanceMaxHops,
        structuralDistances,
        semanticScores: semanticDistanceState.anchorNodeId === distanceAnchorNodeId
          ? semanticDistanceState.scores
          : EMPTY_DISTANCE_RECORD,
        distanceCounts,
        outsideCount: distanceCounts.outside,
        heatmapVisibleNodeIds: undefined,
        heatmapRingCounts: undefined,
        heatmapRenderedRingCounts: undefined,
        heatmapSaturationMode: undefined,
        semanticNeighborCount: semanticDistanceState.anchorNodeId === distanceAnchorNodeId
          ? semanticDistanceState.count
          : 0,
        status: semanticDistanceState.anchorNodeId === distanceAnchorNodeId
          ? semanticDistanceState.status
          : "loading",
        error: semanticDistanceState.anchorNodeId === distanceAnchorNodeId
          ? semanticDistanceState.error
          : null,
      };
    }

    return {
      mode: activeDistanceMode,
      anchorNodeId: distanceAnchorNodeId,
      anchorLabel: distanceAnchorLabel,
      maxHops: distanceMaxHops,
      structuralDistances,
      semanticScores: EMPTY_DISTANCE_RECORD,
      distanceCounts,
      outsideCount: distanceCounts.outside,
      heatmapVisibleNodeIds: heatmapRenderSnapshot?.visibleNodeIds,
      heatmapRingCounts: heatmapRenderSnapshot?.ringCounts,
      heatmapRenderedRingCounts: heatmapRenderSnapshot?.renderedRingCounts,
      heatmapSaturationMode: heatmapRenderSnapshot?.saturationMode,
      semanticNeighborCount: 0,
      status: "ready",
      error: null,
    };
  }, [
    activeDistanceMode,
    distanceAnchorLabel,
    distanceAnchorNodeId,
    distanceCounts,
    distanceMaxHops,
    graph.order,
    heatmapRenderSnapshot,
    semanticDistanceState,
    structuralDistances,
    viewMode,
  ]);

  const showLoadingOverlay = !graphReady && (isLoading || isFetching || Boolean(loadingProgress) || isGraphLoadError);
  const showSettlingStatus = graphReady && loadingProgress?.phase === "stabilizing_layout";
  const hasGraphContent = Boolean(summary?.nodeCount);
  const activePath = pathResult?.path ?? EMPTY_PATH;
  const activePathEdgeIds = pathResult?.edge_ids ?? EMPTY_PATH;
  const structuralSelectedNodeId = useMemo(() => {
    if (viewMode === "focused") {
      return focusedNodeId && graph.hasNode(focusedNodeId) ? focusedNodeId : "";
    }
    if (!selectedNodeId || !graph.hasNode(selectedNodeId)) {
      return "";
    }
    return collapsedNeighborhoodNodeIds.includes(selectedNodeId) ? selectedNodeId : "";
  }, [collapsedNeighborhoodNodeIds, focusedNodeId, selectedNodeId, viewMode]);
  const structuralActivePath = structuralSelectedNodeId ? activePath : EMPTY_PATH;
  const structuralActivePathEdgeIds = structuralSelectedNodeId ? activePathEdgeIds : EMPTY_PATH;
  const displayResult = useMemo(() => {
    // The displayed graph is an aggregated clone. Rebuild it after domain
    // mutations so applied Markdown labels do not remain stale on the canvas.
    void graphVersion;
    return viewMode === "grouped"
      ? (groupedDisplayCandidate ?? resolveDisplayGraph("", EMPTY_PATH, EMPTY_PATH, "grouped", {
          aggregationEnabled,
          collapsedNeighborhoodNodeIds,
        }))
      : resolveDisplayGraph(structuralSelectedNodeId, structuralActivePath, structuralActivePathEdgeIds, viewMode, {
          aggregationEnabled,
          collapsedNeighborhoodNodeIds,
        });
  }, [
    aggregationEnabled,
    collapsedNeighborhoodNodeIds,
    graphVersion,
    groupedDisplayCandidate,
    structuralActivePath,
    structuralActivePathEdgeIds,
    structuralSelectedNodeId,
    viewMode,
  ]);
  const colorLegendItems = useMemo(() => {
    // Store mutations can preserve graph identity while changing its attributes.
    void graphVersion;
    return buildGraphColorLegend(displayResult.graph);
  }, [displayResult.graph, graphVersion]);
  const displayState = useMemo(
    () => (
      viewMode === "grouped"
        ? resolveGroupedDisplayStateSnapshot(displayResult.graph, selectedNodeId, {
            groupedViewAvailable,
            groupedViewReason,
            selectedNodeKind: focusedSelectionResolution.kind,
            resolvedFocusedNodeId: focusedSelectionResolution.resolvedNodeId,
            focusedUnavailableReason: focusedSelectionResolution.reason,
          })
        : resolveDisplayStateSnapshot(selectedNodeId, activePath, viewMode, {
            aggregationEnabled,
            collapsedNeighborhoodNodeIds,
            groupedViewAvailable,
            groupedViewReason,
            selectedNodeKind: focusedSelectionResolution.kind,
            resolvedFocusedNodeId: focusedSelectionResolution.resolvedNodeId,
            focusedUnavailableReason: focusedSelectionResolution.reason,
          })
    ),
    [
      activePath,
      aggregationEnabled,
      collapsedNeighborhoodNodeIds,
      displayResult.graph,
      focusedSelectionResolution.kind,
      focusedSelectionResolution.reason,
      focusedSelectionResolution.resolvedNodeId,
      groupedViewAvailable,
      groupedViewReason,
      selectedNodeId,
      viewMode,
    ],
  );
  const displayMeta = displayResult.meta;
  useEffect(() => {
    if (viewMode === "grouped" && !groupedViewAvailable) {
      debugGraphWorkspace("grouped-view-reset-to-full", {
        reason: groupedViewReason,
        graphVersion,
      });
      setViewMode("full");
      setFocusedNodeId("");
      setSelectedNodeId((currentSelectedNodeId) => (
        currentSelectedNodeId && graph.hasNode(currentSelectedNodeId) ? currentSelectedNodeId : ""
      ));
    }
  }, [graphVersion, groupedViewAvailable, groupedViewReason, viewMode]);
  useEffect(() => {
    if (viewMode === "focused" && (!focusedNodeId || !graph.hasNode(focusedNodeId))) {
      setViewMode("full");
      setFocusedNodeId("");
    }
  }, [focusedNodeId, graphVersion, viewMode]);
  const previousDisplayGraphRef = useRef(displayResult.graph);
  const previousDisplayStateRef = useRef(displayState);
  useEffect(() => {
    const graphRebuilt = previousDisplayGraphRef.current !== displayResult.graph;
    const displayStateChanged = previousDisplayStateRef.current !== displayState;
    debugGraphWorkspace("display-state-derived", {
      selectedNodeId,
      structuralSelectedNodeId,
      viewMode,
      graphRebuilt,
      displayStateChanged,
      aggregationEnabled,
      collapsedNeighborhoodActive: Boolean(structuralSelectedNodeId && collapsedNeighborhoodNodeIds.includes(structuralSelectedNodeId)),
    });
    previousDisplayGraphRef.current = displayResult.graph;
    previousDisplayStateRef.current = displayState;
  }, [
    aggregationEnabled,
    collapsedNeighborhoodNodeIds,
    displayResult.graph,
    displayState,
    selectedNodeId,
    structuralSelectedNodeId,
    viewMode,
  ]);
  const focusedSummary = useMemo(() => {
    if (!selectedNodeId || !graph.hasNode(selectedNodeId)) {
      if (viewMode === "grouped") {
        return displayState.groupedViewAvailable
          ? "Communities compressed into grouped structure view"
          : (groupedViewReasonText(displayState.groupedViewReason) ?? groupedViewReasonText({ code: "communities-undetected" }));
      }
      return null;
    }

    const localNeighborCount = graph.neighbors(selectedNodeId).length;
    if (viewMode === "focused") {
      const visibleNeighbors = displayState.selectedVisibleNeighborIds.length || Math.min(localNeighborCount, 16);
      return `${visibleNeighbors + 1} nodes in focused view`;
    }

    if (viewMode === "grouped") {
      return "Grouped structure view with direct community drill-in";
    }

    if (displayState.selectedCollapsedNeighborIds.length > 0) {
      return `${displayState.selectedVisibleNeighborIds.length} visible neighbors, ${displayState.selectedCollapsedNeighborIds.length} collapsed`;
    }

    return `${localNeighborCount} direct neighbors highlighted`;
  }, [displayState, selectedNodeId, viewMode]);
  const graphSummary = summary as GraphLoadSummary | null;
  const selectedNodeState = useMemo(
    () => buildSelectedNodeState(selectedNodeId, displayState),
    [displayState, selectedNodeId, summary?.nodeCount, summary?.edgeCount],
  );
  const temporalState = useMemo(
    () => ({
      currentTime: scrubberTime,
      activeNodeCount,
      minDate: temporalBounds?.min ?? undefined,
      maxDate: temporalBounds?.max ?? undefined,
    }),
    [activeNodeCount, scrubberTime, temporalBounds?.max, temporalBounds?.min],
  );

  const pluginRegistry = useMemo<LazyPluginRegistryEntry[]>(
    () => [
      {
        id: "exploration-effects",
        panelId: "effects-panel",
        label: "Effects",
        title: "Open exploration effects controls",
        order: 18,
        load: loadExplorationEffectsPlugin,
        shouldLoad: explorationEffectsShouldLoad,
      },
      {
        id: "neighborhood-panel",
        panelId: "neighborhood-panel",
        label: "Neighbors",
        title: "Toggle neighborhood panel",
        order: 30,
        load: loadNeighborhoodPanelPlugin,
        shouldLoad: neighborhoodPanelShouldLoad,
      },
      {
        id: "temporal-overlay",
        panelId: "temporal-panel",
        label: "Temporal",
        title: "Toggle temporal context panel",
        order: 40,
        load: loadTemporalOverlayPlugin,
        shouldLoad: temporalOverlayShouldLoad,
      },
    ],
    [],
  );
  const activePlugins = useMemo(
    () => pluginRegistry.map((entry) => loadedPlugins[entry.id]).filter((plugin): plugin is GraphPlugin => Boolean(plugin)),
    [loadedPlugins, pluginRegistry],
  );

  useEffect(() => {
    let cancelled = false;

    pluginRegistry.forEach((entry) => {
      if (loadedPlugins[entry.id]) {
        return;
      }

      if (!entry.shouldLoad({ panelState: pluginPanelState })) {
        return;
      }

      void entry.load()
        .then((plugin) => {
          if (cancelled) {
            return;
          }
          setLoadedPlugins((current) => (current[entry.id] ? current : { ...current, [entry.id]: plugin }));
        })
        .catch((error) => {
          console.error(`[GraphPlugin:${entry.id}] lazy load failed`, error);
        });
    });

    return () => {
      cancelled = true;
    };
  }, [loadedPlugins, pluginPanelState, pluginRegistry]);

  const setEffectToggle = useCallback((effect: GraphEffectToggle, enabled: boolean | ((current: boolean) => boolean)) => {
    setEffectsState((current) => {
      const nextValue = typeof enabled === "function" ? enabled(current[effect]) : enabled;
      if (effect === "diagnosticsEnabled" && !GRAPH_THEME.effects.diagnostics.enabledInDev) {
        return current;
      }
      if (current[effect] === nextValue) {
        return current;
      }
      return {
        ...current,
        [effect]: nextValue,
      };
    });
  }, []);

  const handlePluginAction = useCallback((action: GraphPluginActionRequest) => {
    switch (action.type) {
      case "fitView":
        sceneRef.current?.fitView();
        return;
      case "focusNode":
        sceneRef.current?.focusNode(action.nodeId);
        return;
      case "selectNode":
        focusNode(action.nodeId);
        return;
      case "setViewMode":
        setLayoutViewMode(action.viewMode);
        return;
      case "enterLocalGraph":
        enterLocalGraph(action.nodeId);
        return;
      case "collapseNeighborhood":
        if (!selectedNodeId) {
          return;
        }
        setCollapsedNeighborhoodNodeIds((current) => (
          current.includes(selectedNodeId) ? current : [...current, selectedNodeId]
        ));
        return;
      case "expandNeighborhood":
        if (!selectedNodeId) {
          return;
        }
        setCollapsedNeighborhoodNodeIds((current) => current.filter((nodeId) => nodeId !== selectedNodeId));
        return;
      case "toggleEffect":
        setEffectToggle(action.effect, (current) => !current);
        return;
      case "setEffect":
        setEffectToggle(action.effect, action.enabled);
        return;
      case "togglePanel":
        setPluginPanelState((current) => {
          const nextOpen = !current[action.panelId];
          setActiveDockPanelId((previous) => {
            if (nextOpen) {
              return action.panelId;
            }
            return previous === action.panelId ? null : previous;
          });
          return {
            ...current,
            [action.panelId]: nextOpen,
          };
        });
        return;
      case "openPanel":
        setActiveDockPanelId(action.panelId);
        setPluginPanelState((current) => ({
          ...current,
          [action.panelId]: true,
        }));
        return;
      case "closePanel":
        setPluginPanelState((current) => ({
          ...current,
          [action.panelId]: false,
        }));
        setActiveDockPanelId((previous) => (previous === action.panelId ? null : previous));
        return;
    }
  }, [enterLocalGraph, focusNode, selectedNodeId, setEffectToggle, setLayoutViewMode]);

  const diagnosticsSnapshot = useMemo<GraphDiagnosticsSnapshot | null>(() => {
    if (!GRAPH_THEME.effects.diagnostics.enabledInDev || !graphDiagnosticsState) {
      return null;
    }

    return {
      interactionState: pluginInteractionStateRef.current,
      activePluginIds: activePlugins.map((plugin) => plugin.id),
      openPanelIds: Object.entries(pluginPanelState)
        .filter(([, isOpen]) => isOpen)
        .map(([panelId]) => panelId),
      effectsState,
      edgeClasses: graphDiagnosticsState.edgeClasses,
      distanceVisual: graphDiagnosticsState.distanceVisual,
      effectAvailability: graphDiagnosticsState.effectAvailability,
    };
  }, [activePlugins, effectsState, graphDiagnosticsState, pluginPanelState]);

  const pluginContext = useMemo<GraphPluginContext>(() => ({
    get scene() {
      return pluginRuntimeRef.current;
    },
    get graph() {
      return graph;
    },
    get displayGraph() {
      return pluginRuntimeRef.current?.displayGraph ?? graph;
    },
    theme: GRAPH_THEME,
    getInteractionState: () => pluginInteractionStateRef.current,
    getSelectedNodeState: () => selectedNodeState,
    getInspectorState: () => ({
      selectedNodeId: selectedNodeId || null,
      ownsSelectionDetails: true,
    }),
    getGraphSummary: () => graphSummary,
    getTemporalState: () => temporalState,
    getEffectsState: () => effectsState,
    getDiagnosticsSnapshot: () => diagnosticsSnapshot,
    getAnalyticsSnapshot: () => graphAnalyticsState,
    getDisplayState: () => displayState,
    isPanelOpen: (panelId: string) => Boolean(pluginPanelState[panelId]),
    dispatchAction: handlePluginAction,
  }), [
    displayState,
    graphAnalyticsState,
    diagnosticsSnapshot,
    effectsState,
    graphSummary,
    handlePluginAction,
    pluginPanelState,
    selectedNodeId,
    selectedNodeState,
    temporalState,
  ]);

  const handleSceneRuntimeChange = useCallback((runtime: GraphSceneRuntime | null) => {
    pluginRuntimeRef.current = runtime;
    if (!runtime) {
      setGraphAnalyticsState(null);
    }
    setPluginRuntimeVersion((version) => version + 1);
  }, []);

  const handleInteractionStateChange = useCallback((interactionState: GraphInteractionState) => {
    pluginInteractionStateRef.current = interactionState;
    for (const plugin of activePlugins) {
      try {
        plugin.onStateChange(pluginContext, interactionState);
      } catch (error) {
        console.error(`[GraphPlugin:${plugin.id}] state update failed`, error);
      }
    }
  }, [activePlugins, pluginContext]);

  const handleDiagnosticsChange = useCallback((diagnostics: GraphRuntimeDiagnosticsSnapshot) => {
    if (!GRAPH_THEME.effects.diagnostics.enabledInDev) {
      return;
    }

    // Compare against the last accepted snapshot synchronously before calling
    // setState. buildEffectAvailability always returns a new object, so an
    // unconditional setGraphDiagnosticsState on every call created a
    // render → diagnostics effect → setState → render cycle that exceeded
    // React's max update depth in dev mode (issue #830).
    const prev = lastDiagnosticsRef.current;
    if (prev !== null) {
      const EFFECT_KEYS = [
        "pathPulse", "pathFlow", "lens", "temporalEmphasis", "semanticRegions",
        "contours", "pathfinding", "communities", "centrality", "legend", "diagnostics",
      ] as const;
      const prevEA = prev.effectAvailability;
      const nextEA = diagnostics.effectAvailability;
      const availabilityChanged = EFFECT_KEYS.some((key) => {
        const p = prevEA[key];
        const n = nextEA[key];
        return (
          p.enabled !== n.enabled ||
          p.available !== n.available ||
          p.reason !== n.reason ||
          p.detail !== n.detail ||
          p.visibleSegments !== n.visibleSegments ||
          p.segmentCap !== n.segmentCap
        );
      });

      const edgeClassesChanged =
        prev.edgeClasses?.updatedAt !== diagnostics.edgeClasses?.updatedAt;

      const structureLayerChanged =
        prev.structureLayer?.cacheKey !== diagnostics.structureLayer?.cacheKey ||
        prev.structureLayer?.lastDrawAt !== diagnostics.structureLayer?.lastDrawAt ||
        prev.structureLayer?.enabled !== diagnostics.structureLayer?.enabled ||
        prev.structureLayer?.disabledReason !== diagnostics.structureLayer?.disabledReason ||
        prev.structureLayer?.curveCount !== diagnostics.structureLayer?.curveCount ||
        prev.structureLayer?.bridgeCurveCount !== diagnostics.structureLayer?.bridgeCurveCount ||
        prev.structureLayer?.backboneCurveCount !== diagnostics.structureLayer?.backboneCurveCount;

      // distanceVisual is compared by reference: GraphCanvas passes the same
      // object when distances haven't changed.
      const distanceVisualChanged = prev.distanceVisual !== diagnostics.distanceVisual;

      if (!availabilityChanged && !edgeClassesChanged && !structureLayerChanged && !distanceVisualChanged) {
        return;
      }
    }

    lastDiagnosticsRef.current = diagnostics;
    setGraphDiagnosticsState(diagnostics);
  }, []);

  const handleAnalyticsChange = useCallback((analytics: GraphAnalyticsSnapshot | null) => {
    setGraphAnalyticsState(analytics);
  }, []);

  useEffect(() => {
    if (!pluginRuntimeRef.current) {
      return;
    }

    const mountedPlugins: GraphPlugin[] = [];
    for (const plugin of activePlugins) {
      try {
        plugin.mount(pluginContext);
        mountedPlugins.push(plugin);
      } catch (error) {
        console.error(`[GraphPlugin:${plugin.id}] mount failed`, error);
      }
    }

    return () => {
      for (const plugin of mountedPlugins.reverse()) {
        try {
          plugin.unmount(pluginContext);
        } catch (error) {
          console.error(`[GraphPlugin:${plugin.id}] unmount failed`, error);
        }
      }
    };
  }, [activePlugins, pluginContext, pluginRuntimeVersion]);

  const pluginToolbarItems = useMemo<GraphPluginToolbarItem[]>(
    () => pluginRegistry.map((entry) => ({
      id: `${entry.id}-toggle`,
      label: entry.label,
      title: entry.title,
      active: pluginContext.isPanelOpen(entry.panelId),
      order: entry.order,
      onClick: () => pluginContext.dispatchAction({ type: "togglePanel", panelId: entry.panelId }),
    })),
    [pluginContext, pluginRegistry],
  );
  const pluginPanels = useMemo(
    () => collectPluginPanels(activePlugins, pluginContext),
    [activePlugins, pluginContext],
  );
  const pluginOverlays = useMemo(
    () => collectPluginOverlays(activePlugins, pluginContext),
    [activePlugins, pluginContext],
  );
  const pendingDockPanels = useMemo<GraphPluginPanelDescriptor[]>(
    () => pluginRegistry
      .filter((entry) => pluginPanelState[entry.panelId] && !loadedPlugins[entry.id])
      .map((entry) => ({
        id: entry.panelId,
        title: entry.label,
        placement: "bottom" as const,
        order: entry.order,
        content: <div style={pluginLoadingStyle}>Loading {entry.label.toLowerCase()}…</div>,
      })),
    [loadedPlugins, pluginPanelState, pluginRegistry],
  );
  const dockPanels = [...pluginPanels, ...pendingDockPanels]
    .filter((panel) => panel.placement === "bottom" || panel.placement === "side")
    .sort((left, right) => (left.order ?? 0) - (right.order ?? 0));
  const openDockPanels = dockPanels.filter((panel) => pluginPanelState[panel.id]);
  const activeDockPanel =
    openDockPanels.find((panel) => panel.id === activeDockPanelId)
    ?? openDockPanels[0]
    ?? null;
  const layoutState: ExploreLayoutState = {
    showInspector: Boolean(selectedNodeId),
    showPluginDock: openDockPanels.length > 0,
  };

  const openDockPanelIdsString = openDockPanels.map((p) => p.id).join("|");
  const [prevOpenDockPanelIdsString, setPrevOpenDockPanelIdsString] = useState(openDockPanelIdsString);

  if (openDockPanelIdsString !== prevOpenDockPanelIdsString) {
    setPrevOpenDockPanelIdsString(openDockPanelIdsString);
    if (!openDockPanels.length) {
      if (activeDockPanelId !== null) setActiveDockPanelId(null);
    } else if (!activeDockPanelId || !openDockPanels.some((panel) => panel.id === activeDockPanelId)) {
      setActiveDockPanelId(openDockPanels[0].id);
    }
  }

  const viewModeItems = useMemo<GraphToolbarItem[]>(() => {
    if (!hasGraphContent) {
      return [];
    }

    return [
      {
        id: "view-full",
        label: "Full Graph",
        title: "Return to the full graph context",
        icon: Layers3,
        active: viewMode === "full",
        onClick: () => setLayoutViewMode("full"),
      },
      {
        id: "view-grouped",
        label: "Grouped View",
        title: displayState.groupedViewAvailable
          ? "Compress dense structure into detected communities"
          : (groupedViewReasonText(displayState.groupedViewReason)
            ?? groupedViewReasonText({ code: "communities-undetected" })
            ?? undefined),
        icon: GitBranch,
        active: viewMode === "grouped",
        disabled: !displayState.groupedViewAvailable,
        onClick: () => setLayoutViewMode("grouped"),
      },
      {
        id: "view-focused",
        label: "Focus",
        title: canActivateFocusedMode
          ? "Inspect the selected node in a focused local graph"
          : (focusedUnavailableReasonText(focusedSelectionResolution.reason) ?? undefined),
        icon: Focus,
        active: viewMode === "focused",
        disabled: viewMode !== "focused" && !canActivateFocusedMode,
        onClick: () => {
          const nodeId = focusedSelectionResolution.resolvedNodeId;
          if (nodeId) {
            enterLocalGraph(nodeId);
          }
        },
      },
    ];
  }, [
    canActivateFocusedMode,
    displayState.groupedViewAvailable,
    displayState.groupedViewReason,
    enterLocalGraph,
    focusedSelectionResolution.reason,
    focusedSelectionResolution.resolvedNodeId,
    hasGraphContent,
    setLayoutViewMode,
    viewMode,
  ]);

  const cameraToolbarItems = useMemo<GraphToolbarItem[]>(() => [
    {
      id: "zoom-in",
      label: "Zoom In",
      title: "Zoom in (or scroll up on the canvas)",
      ariaLabel: "Zoom in",
      icon: ZoomIn,
      compact: true,
      onClick: () => sceneRef.current?.zoomIn(),
    },
    {
      id: "zoom-out",
      label: "Zoom Out",
      title: "Zoom out (or scroll down on the canvas)",
      ariaLabel: "Zoom out",
      icon: ZoomOut,
      compact: true,
      onClick: () => sceneRef.current?.zoomOut(),
    },
    {
      id: "fit-view",
      label: "Fit",
      title: "Reset the camera to fit the whole graph",
      ariaLabel: "Fit view",
      icon: Maximize2,
      compact: true,
      onClick: () => sceneRef.current?.fitView(),
    },
  ], []);

  const layoutToolbarItems = useMemo<GraphToolbarItem[]>(() => [
    {
      id: "layout-toggle",
      label: isLayoutRunning ? "Pause" : "Run",
      title: "Toggle the layout worker",
      icon: isLayoutRunning ? Pause : Play,
      active: isLayoutRunning,
      disabled: showLoadingOverlay,
      onClick: () => setIsLayoutRunning((value) => !value),
    },
  ], [isLayoutRunning, showLoadingOverlay]);

  const localToolbarItems = useMemo<GraphToolbarItem[]>(() => {
    const selectNodeHint = "Select a node on the canvas first";
    if (!selectedNodeState) {
      if (!hasGraphContent) {
        return [];
      }
      return [
        {
          id: "collapse-neighborhood",
          label: "Collapse",
          title: selectNodeHint,
          icon: Eye,
          disabled: true,
          onClick: () => {},
        },
        {
          id: "expand-neighborhood",
          label: "Expand",
          title: selectNodeHint,
          icon: Users,
          disabled: true,
          onClick: () => {},
        },
      ];
    }

    return [
      {
        id: "collapse-neighborhood",
        label: "Collapse",
        title: "Hide lower-priority fanout around the selected node",
        icon: Eye,
        disabled: !selectedNodeState.canCollapseNeighborhood || selectedNodeState.isNeighborhoodCollapsed,
        onClick: () => handlePluginAction({ type: "collapseNeighborhood" }),
      },
      {
        id: "expand-neighborhood",
        label: "Expand",
        title: "Restore the collapsed local neighborhood",
        icon: Users,
        disabled: !selectedNodeState.isNeighborhoodCollapsed,
        onClick: () => handlePluginAction({ type: "expandNeighborhood" }),
      },
    ];
  }, [handlePluginAction, hasGraphContent, selectedNodeState]);

  const analysisToolbarItems = useMemo<GraphToolbarItem[]>(
    () => pluginToolbarItems.map((item) => ({
      id: item.id,
      label: item.label,
      title: item.title,
      icon: iconForPluginToolbarItem(item),
      active: item.active,
      onClick: item.onClick,
    })),
    [pluginToolbarItems],
  );

  const searchDisabled = showLoadingOverlay || !searchQuery.trim();

  const distanceToolbarItems = useMemo<GraphToolbarItem[]>(() => {
    if (!hasGraphContent || viewMode !== "full") {
      return [];
    }

    const nodeReady = Boolean(selectedNodeId && graph.hasNode(selectedNodeId));
    const selectNodeHint = "Select a node on the canvas first";

    return [
      {
        id: "ego-mode",
        label: egoModeEnabled ? `Ego (${egoMaxHops}h)` : "Ego Mode",
        icon: Radar,
        title: nodeReady
          ? egoModeEnabled
            ? `Egocentric view: ${egoMaxHops} hops depth (click to toggle off)`
            : "Show depth-of-field fading around the selected node"
          : selectNodeHint,
        active: egoModeEnabled,
        disabled: !nodeReady,
        onClick: () => {
          if (!nodeReady) return;
          setEgoModeEnabled((v) => !v);
          setHeatmapEnabled(false);
          setDistanceMode("off");
        },
      },
      {
        id: "heatmap",
        label: "Heatmap",
        icon: Flame,
        title: nodeReady
          ? heatmapEnabled
            ? "Distance heatmap active (click to toggle off)"
            : "Color nodes by hop distance from selected node"
          : selectNodeHint,
        active: heatmapEnabled,
        disabled: !nodeReady,
        onClick: () => {
          if (!nodeReady) return;
          setHeatmapEnabled((v) => !v);
          setEgoModeEnabled(false);
          setDistanceMode("off");
        },
      },
      {
        id: "dist-structural",
        label: "Structural",
        icon: Route,
        title: nodeReady ? "Color edges by structural (hop) distance" : selectNodeHint,
        active: distanceMode === "structural",
        disabled: !nodeReady,
        onClick: () => {
          if (!nodeReady) return;
          setEgoModeEnabled(false);
          setHeatmapEnabled(false);
          setDistanceMode((m) => (m === "structural" ? "off" : "structural"));
        },
      },
      {
        id: "dist-semantic",
        label: "Semantic",
        icon: Sparkles,
        title: nodeReady
          ? "Color edges by semantic similarity to selected node"
          : selectNodeHint,
        active: distanceMode === "semantic",
        disabled: !nodeReady,
        onClick: () => {
          if (!nodeReady) return;
          setEgoModeEnabled(false);
          setHeatmapEnabled(false);
          setDistanceMode((m) => (m === "semantic" ? "off" : "semantic"));
        },
      },
    ];
  }, [distanceMode, egoMaxHops, egoModeEnabled, hasGraphContent, heatmapEnabled, selectedNodeId, viewMode]);

  const leftToolbarClusters = useMemo<GraphToolbarGroup[]>(() => [
    {
      id: "camera",
      label: "Camera",
      items: cameraToolbarItems,
    },
    {
      id: "layout",
      label: "Layout",
      items: layoutToolbarItems,
    },
    {
      id: "local-structure",
      label: "Local",
      items: localToolbarItems,
    },
  ].filter((group) => group.items.length > 0), [
    cameraToolbarItems,
    layoutToolbarItems,
    localToolbarItems,
  ]);

  const rightToolbarClusters = useMemo<GraphToolbarGroup[]>(() => [
    {
      id: "distance",
      label: "Distance",
      items: distanceToolbarItems,
    },
    {
      id: "analysis",
      label: "Analysis",
      items: analysisToolbarItems,
    },
  ].filter((group) => group.items.length > 0), [analysisToolbarItems, distanceToolbarItems]);

  const sceneAdapterProps = {
    onNodeSelect: focusNode,
    onEdgeSelect: handleEdgeSelect,
    graphVersion,
    graphReady,
    displayGraph: displayResult.graph,
    displayMeta,
    displayState,
    selectedNodeId,
    focusedNodeId,
    selectedEdgeId,
    activePath,
    activePathEdgeIds,
    distanceVisualState,
    effectsState,
    temporalState,
    isLayoutRunning,
    layoutSource: graphSummary?.layoutSource,
    viewMode,
    showFitViewButton: false,
    pluginOverlays: pluginOverlays.map((overlay) => overlay.element),
    onRuntimeChange: handleSceneRuntimeChange,
    onInteractionStateChange: handleInteractionStateChange,
    onDiagnosticsChange: handleDiagnosticsChange,
    onAnalyticsChange: handleAnalyticsChange,
  } as const;
  const showDistanceStatus = distanceVisualState.mode !== "off";
  const showTimelinePanel = Boolean(temporalBounds?.min);

  return (
    <div className="palantir-bg" style={{ position: "relative", width: "100%", height: "100%", overflow: "hidden" }}>
      <style>{hudCss}</style>

      <div
        className="explore-shell"
        data-inspector={layoutState.showInspector ? "true" : "false"}
        data-timeline={showTimelinePanel ? "true" : "false"}
      >
        <div
          className="explore-main-grid"
          data-inspector={layoutState.showInspector ? "true" : "false"}
        >
          <div className="explore-scene-stack">
            <SurfaceCard padding="none" className="explore-scene-card">
              <div className="explore-scene-shell">
                <div className="explore-scene-stage">
                  <SigmaSceneAdapter
                    ref={sceneRef}
                    {...sceneAdapterProps}
                  />
                  <GraphLoadingOverlay
                    progress={loadingProgress}
                    visible={showLoadingOverlay}
                    showGraphBehind={hasGraphContent || Boolean(loadingProgress?.showGraphBehind)}
                    error={graphLoadErrorMessage}
                    onRetry={handleRetryGraphLoad}
                  />
                </div>
              </div>

              {layoutState.showPluginDock ? (
                <div className="explore-plugin-dock">
                  <SurfaceCard tone="subtle" style={{ borderRadius: 0, borderLeft: "none", borderRight: "none", borderBottom: "none" }}>
                    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}>
                        <div className="explore-plugin-dock-tabs">
                          {openDockPanels.map((panel) => (
                            <button
                              key={panel.id}
                              className="explore-plugin-dock-tab"
                              data-active={activeDockPanel?.id === panel.id}
                              onClick={() => setActiveDockPanelId(panel.id)}
                            >
                              {panel.title}
                            </button>
                          ))}
                          {activeDockPanel ? (
                            <button
                              className="explore-plugin-dock-tab"
                              onClick={() => handlePluginAction({ type: "closePanel", panelId: activeDockPanel.id })}
                            >
                              ×
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {activeDockPanel ? (
                        <div style={pluginDockContentStyle}>{activeDockPanel.content}</div>
                      ) : null}
                    </div>
                  </SurfaceCard>
                </div>
              ) : null}

              {showTimelinePanel && temporalBounds?.min ? (
                <div className="explore-scene-footer">
                  <Suspense fallback={<div style={timelineFallbackStyle}>Loading timeline…</div>}>
                    <LazyTimelinePanel
                      onTimeChange={onTimeChange}
                      minDate={temporalBounds.min}
                      maxDate={temporalBounds.max ?? undefined}
                    />
                  </Suspense>
                </div>
              ) : null}
            </SurfaceCard>
          </div>

          {layoutState.showInspector ? (
            <div className="explore-inspector-shell">
              <InspectorPanel open={layoutState.showInspector} className="explore-inspector-card">
                <div className="explore-inspector-scroll hud-scrollbar">
                  <Suspense fallback={<div style={inspectorFallbackStyle}>Loading inspector…</div>}>
                    <LazyGraphInspectorPanel
                      kbId={kbId}
                      graphWriteEnabled={graphWriteEnabled}
                      decisionsEnabled={decisionsEnabled}
                      nodeId={selectedNodeId}
                      inspectableNodeId={inspectableNodeId || null}
                      selectedNodeKind={displayState.selectedNodeKind}
                      canActivateFocused={canActivateFocusedMode}
                      focusedUnavailableReason={displayState.focusedUnavailableReason}
                      predictions={predictions}
                      predictionType={predictionType}
                      onPredictionTypeChange={setPredictionType}
                      onRunPredictions={() => void handleRunPredictions()}
                      isRunningPredictions={isRunningPredictions}
                      pathTargetId={pathTargetId}
                      onPathTargetChange={setPathTargetId}
                      onTracePath={() => void handleTracePath()}
                      pathResult={pathResult}
                      onDownloadProvenance={(format) => void handleDownloadProvenance(format)}
                      onFocusNode={focusNode}
                      onMarkdownApplied={handleMarkdownApplied}
                      onMarkdownDirtyChange={handleMarkdownDirtyChange}
                    />
                  </Suspense>
                </div>
              </InspectorPanel>
            </div>
          ) : null}
        </div>

        <section className="explore-search-dock" aria-label="Graph search">
          <GraphSearchDock
            kbId={kbId}
            query={searchQuery}
            onQueryChange={setSearchQuery}
            searchDisabled={searchDisabled}
            onSearch={() => void handleSearch()}
            onSelectSuggestion={(result) => {
              setSearchQuery("");
              focusNode(result.node.id);
            }}
            searchError={searchError}
            searchResults={searchResults}
            onClearResults={handleClearSearchResults}
            onSelectResult={(result) => {
              setSearchQuery("");
              handleClearSearchResults();
              focusNode(result.node.id);
            }}
            onReload={reload}
            reloadDisabled={showLoadingOverlay}
            trailingActions={graphDataActions}
          />
        </section>

        <section className="explore-status-dock" aria-label="Graph status">
          <GraphStatusDock
            showLoadingStatus={(showLoadingOverlay || showSettlingStatus) && Boolean(loadingProgress)}
            loadingPhase={loadingProgress?.phase}
            summary={summary ?? null}
            activeNodeCount={activeNodeCount}
            focusedSummary={focusedSummary}
          />
        </section>

        {!showDistanceStatus && colorLegendItems.length > 0 ? (
          <section className="explore-legend-dock" aria-label="Node color legend">
            <GraphColorLegendDock items={colorLegendItems} />
          </section>
        ) : null}

        <section className="explore-toolbar-rail" aria-label="Graph tools">
          <GraphToolbarRail
            groups={[
              ...(viewModeItems.length > 0
                ? [{ id: "view-mode", label: "View", items: viewModeItems }]
                : []),
              ...leftToolbarClusters,
            ]}
          />
        </section>

        {rightToolbarClusters.length > 0 ? (
          <section className="explore-toolbar-rail-right" aria-label="Distance and analysis tools">
            <GraphToolbarRail groups={rightToolbarClusters} expandLabels="left" />
          </section>
        ) : null}
      </div>
    </div>
  );
}

const pluginDockContentStyle: React.CSSProperties = {
  borderRadius: 16,
  border: `1px solid ${GRAPH_THEME.ui.surface.panelBorder}`,
  background: "rgba(255, 255, 255, 0.02)",
  padding: 14,
};

const pluginLoadingStyle: React.CSSProperties = {
  color: GRAPH_THEME.ui.text.muted,
  fontSize: 12,
  padding: 10,
};

const inspectorFallbackStyle: React.CSSProperties = {
  padding: 24,
  color: GRAPH_THEME.ui.text.muted,
  fontSize: 12,
};

const timelineFallbackStyle: React.CSSProperties = {
  height: "90px",
  display: "flex",
  alignItems: "center",
  padding: "0 18px",
  color: GRAPH_THEME.ui.text.muted,
  fontSize: 12,
  borderTop: `1px solid ${GRAPH_THEME.ui.timeline.border}`,
  background: GRAPH_THEME.ui.timeline.background,
};
