/** DEPRECATED — graph lives at `web/src/modules/graph/`. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const graphDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../src/pages/kb/graph',
);

const manual = {
  'behaviors/types': 'behavior-types',
  'behaviors/clickSelectionBehavior': 'behavior-click-selection-behavior',
  'behaviors/hoverActivationBehavior': 'behavior-hover-activation-behavior',
  'behaviors/focusCameraBehavior': 'behavior-focus-camera-behavior',
  'behaviors/searchFocusBehavior': 'behavior-search-focus-behavior',
  'behaviors/pathHighlightBehavior': 'behavior-path-highlight-behavior',
  'behaviors/fitViewBehavior': 'behavior-fit-view-behavior',
  'behaviors/viewModeSwitchBehavior': 'behavior-view-mode-switch-behavior',
  'plugins/types': 'plugin-types',
  'plugins/explorationEffectsPluginPhaseC': 'plugin-exploration-effects-plugin-phase-c',
  'plugins/legendPlugin': 'plugin-legend-plugin',
  'plugins/neighborhoodPanelPlugin': 'plugin-neighborhood-panel-plugin',
  'plugins/temporalOverlayPlugin': 'plugin-temporal-overlay-plugin',
  graphSceneState: 'graph-scene-state',
  graphKeywordFilter: 'graph-keyword-filter',
  graphEdgeTypes: 'graph-edge-types',
  graphNodeTypes: 'graph-node-types',
  graphInspectorCopy: 'graph-inspector-copy',
  graphLoading: 'graph-loading',
  graphProjectionRefresh: 'graph-projection-refresh',
  graphRealtimeMessages: 'graph-realtime-messages',
  graphLoadBudget: 'graph-load-budget',
  useGraphCatalogStats: 'use-graph-catalog-stats',
  graphEffectsPersistence: 'graph-effects-persistence',
  graphViewCopy: 'graph-view-copy',
  localGraphTransition: 'local-graph-transition',
  graphDistanceMatrix: 'graph-distance-matrix',
  pluginRegistryPredicates: 'plugin-registry-predicates',
  temporalLifecyclePredicates: 'temporal-lifecycle-predicates',
  temporalSnapshotGuards: 'temporal-snapshot-guards',
  smallGraphLayout: 'small-graph-layout',
  realtimeGraphAttributes: 'realtime-graph-attributes',
  GraphInspectorPanel: 'graph-inspector-panel',
  markdownResourceClient: 'markdown-resource-client',
  nodeMarkdownSync: 'node-markdown-sync',
  SigmaSceneAdapter: 'sigma-scene-adapter',
  useLoadGraph: 'use-load-graph',
  GraphLoadingOverlay: 'graph-loading-overlay',
  GraphSearchDock: 'graph-search-dock',
  GraphStatusDock: 'graph-status-dock',
  GraphNodeTypeFilterDock: 'graph-node-type-filter-dock',
  GraphPluginPanelDialog: 'graph-plugin-panel-dialog',
  GraphToolbarRail: 'graph-toolbar-rail',
  graphAnalytics: 'graph-analytics',
  GraphCanvas: 'graph-canvas',
  GraphInspectorDecisions: 'graph-inspector-decisions',
  MarkdownContentViewer: 'markdown-content-viewer',
  TimelinePanel: 'timeline-panel',
  GraphLoadBudgetControl: 'graph-load-budget-control',
  graphStructureLayer: 'graph-structure-layer',
  graphSceneLayers: 'graph-scene-layers',
  graphConfig: 'graph-config',
  graphColorLegend: 'graph-color-legend',
  semanticGroupColor: 'semantic-group-color',
  sigmaNativeRendering: 'sigma-native-rendering',
  timelineAxisFormat: 'timeline-axis-format',
  graphEntityShape: 'graph-entity-shape',
  useMarkdownEditor: 'use-markdown-editor',
  markdownEditorState: 'markdown-editor-state',
  markdownUrlSafety: 'markdown-url-safety',
};

const filesOnDisk = new Set(
  fs.readdirSync(graphDir).filter((f) => /\.tsx?$/.test(f)).map((f) => f.replace(/\.(tsx?)$/, '')),
);

function applyReplacements(text) {
  let out = text;
  for (const [oldPath, newPath] of Object.entries(manual)) {
    if (!filesOnDisk.has(newPath)) continue;
    for (const q of [`"./${oldPath}"`, `'./${oldPath}'`]) {
      const nq = q[0] + `./${newPath}` + q[q.length - 1];
      out = out.split(q).join(nq);
    }
  }
  out = out.replaceAll('from "../types"', 'from "./types"');
  out = out.replaceAll("from '../types'", "from './types'");
  return out;
}

for (const name of fs.readdirSync(graphDir)) {
  if (!/\.tsx?$/.test(name)) continue;
  const fp = path.join(graphDir, name);
  let text = fs.readFileSync(fp, 'utf8');
  const next = applyReplacements(text);
  if (name.startsWith('behavior-') && next.includes('from "./types"')) {
    const fixed = next.replace(
      /import type \{ GraphBehavior[^}]*\} from "\.\/types"/g,
      'import type { GraphBehavior } from "./behavior-types"',
    );
    fs.writeFileSync(fp, fixed);
    continue;
  }
  if (next !== text) fs.writeFileSync(fp, next);
}

// Behavior modules: GraphBehavior from ./types -> ./behavior-types
for (const name of fs.readdirSync(graphDir)) {
  if (!name.startsWith('behavior-') || !name.endsWith('.ts')) continue;
  const fp = path.join(graphDir, name);
  let text = fs.readFileSync(fp, 'utf8');
  if (text.includes('GraphBehavior') && text.includes('from "./types"')) {
    text = text.replace('from "./types"', 'from "./behavior-types"');
    fs.writeFileSync(fp, text);
  }
}

console.log('graph imports patched');
