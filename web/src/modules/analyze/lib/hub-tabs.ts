import type { AnalyzeHubTab, OntologyHubTab } from '@/modules/analyze/lib/hub-route.js';
import { ANALYZE_HUB_TABS, ONTOLOGY_HUB_TABS } from '@/modules/analyze/lib/hub-route.js';
import type { WorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { workspaceNavSegmentEnabled } from '@/lib/workspace/capabilities.js';

const ONTOLOGY_INTERIOR_TABS = new Set<OntologyHubTab>(['registry', 'editor', 'health']);

const ONTOLOGY_TAB_SEGMENT: Record<OntologyHubTab, string> = {
  registry: 'ontology',
  editor: 'ontology',
  health: 'ontology',
  versions: 'ontology-versions',
  shacl: 'shacl',
  alignments: 'alignments',
};

const ANALYZE_TAB_SEGMENT: Record<AnalyzeHubTab, string> = {
  sparql: 'sparql',
  reasoning: 'reasoning',
};

export function ontologyHubTabEnabled(tab: OntologyHubTab, caps: WorkspaceCapabilities | null): boolean {
  return workspaceNavSegmentEnabled(ONTOLOGY_TAB_SEGMENT[tab], caps);
}

export function analyzeHubTabEnabled(tab: AnalyzeHubTab, caps: WorkspaceCapabilities | null): boolean {
  return workspaceNavSegmentEnabled(ANALYZE_TAB_SEGMENT[tab], caps);
}

export function firstEnabledOntologyHubTab(caps: WorkspaceCapabilities | null): OntologyHubTab {
  return ONTOLOGY_HUB_TABS.find((tab) => ontologyHubTabEnabled(tab, caps)) ?? 'registry';
}

export function firstEnabledAnalyzeHubTab(caps: WorkspaceCapabilities | null): AnalyzeHubTab {
  return ANALYZE_HUB_TABS.find((tab) => analyzeHubTabEnabled(tab, caps)) ?? 'sparql';
}

/** Maps legacy `ontologyTab` / `tab=model` values to canonical hub tabs. */
export function normalizeOntologyHubTabId(raw: string | null | undefined): OntologyHubTab | null {
  if (!raw) return null;
  if (raw === 'model') return 'registry';
  if (ONTOLOGY_HUB_TABS.includes(raw as OntologyHubTab)) {
    return raw as OntologyHubTab;
  }
  return null;
}

export function isOntologyInteriorTab(tab: OntologyHubTab): boolean {
  return ONTOLOGY_INTERIOR_TABS.has(tab);
}

export function resolveOntologyHubTab(
  tabParam: string | null,
  legacyOntologyTabParam: string | null,
  hasOntologyProposal: boolean,
  hasOntologyEntity: boolean,
  caps: WorkspaceCapabilities | null,
): OntologyHubTab {
  const fromLegacy = normalizeOntologyHubTabId(legacyOntologyTabParam);
  if (fromLegacy && ontologyHubTabEnabled(fromLegacy, caps)) {
    return fromLegacy;
  }
  const fromTab = normalizeOntologyHubTabId(tabParam);
  if (fromTab && ontologyHubTabEnabled(fromTab, caps)) {
    return fromTab;
  }
  if (hasOntologyProposal && ontologyHubTabEnabled('versions', caps)) {
    return 'versions';
  }
  if (hasOntologyEntity && ontologyHubTabEnabled('editor', caps)) {
    return 'editor';
  }
  return firstEnabledOntologyHubTab(caps);
}

export function resolveAnalyzeHubTab(tabParam: string | null, caps: WorkspaceCapabilities | null): AnalyzeHubTab {
  if (
    tabParam &&
    ANALYZE_HUB_TABS.includes(tabParam as AnalyzeHubTab) &&
    analyzeHubTabEnabled(tabParam as AnalyzeHubTab, caps)
  ) {
    return tabParam as AnalyzeHubTab;
  }
  return firstEnabledAnalyzeHubTab(caps);
}
