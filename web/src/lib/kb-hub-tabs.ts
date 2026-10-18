import type { AnalyzeHubTab, OntologyHubTab } from '@/lib/kb-hub-route.js';
import { ANALYZE_HUB_TABS, ONTOLOGY_HUB_TABS } from '@/lib/kb-hub-route.js';
import type { KbCapabilities } from '@/lib/kb-capabilities.js';
import { kbNavSegmentEnabled } from '@/lib/kb-capabilities.js';

const ONTOLOGY_TAB_SEGMENT: Record<OntologyHubTab, string> = {
  model: 'ontology',
  versions: 'ontology-versions',
  shacl: 'shacl',
  alignments: 'alignments',
};

const ANALYZE_TAB_SEGMENT: Record<AnalyzeHubTab, string> = {
  sparql: 'sparql',
  reasoning: 'reasoning',
};

export function ontologyHubTabEnabled(tab: OntologyHubTab, caps: KbCapabilities | null): boolean {
  return kbNavSegmentEnabled(ONTOLOGY_TAB_SEGMENT[tab], caps);
}

export function analyzeHubTabEnabled(tab: AnalyzeHubTab, caps: KbCapabilities | null): boolean {
  return kbNavSegmentEnabled(ANALYZE_TAB_SEGMENT[tab], caps);
}

export function firstEnabledOntologyHubTab(caps: KbCapabilities | null): OntologyHubTab {
  return ONTOLOGY_HUB_TABS.find((tab) => ontologyHubTabEnabled(tab, caps)) ?? 'model';
}

export function firstEnabledAnalyzeHubTab(caps: KbCapabilities | null): AnalyzeHubTab {
  return ANALYZE_HUB_TABS.find((tab) => analyzeHubTabEnabled(tab, caps)) ?? 'sparql';
}

export function legacyOntologyTabFromParam(raw: string): OntologyHubTab | null {
  if (raw === 'versions') return 'versions';
  if (raw === 'shacl') return 'shacl';
  if (raw === 'alignments') return 'alignments';
  return null;
}

function legacyOntologyTab(raw: string | null): OntologyHubTab | null {
  if (!raw) return null;
  return legacyOntologyTabFromParam(raw);
}

export function resolveOntologyHubTab(
  tabParam: string | null,
  legacyOntologyTabParam: string | null,
  hasOntologyProposal: boolean,
  caps: KbCapabilities | null,
): OntologyHubTab {
  const fromLegacy = legacyOntologyTabParam ? legacyOntologyTab(legacyOntologyTabParam) : null;
  if (fromLegacy && ontologyHubTabEnabled(fromLegacy, caps)) {
    return fromLegacy;
  }
  if (hasOntologyProposal && ontologyHubTabEnabled('versions', caps)) {
    return 'versions';
  }
  if (
    tabParam &&
    ONTOLOGY_HUB_TABS.includes(tabParam as OntologyHubTab) &&
    ontologyHubTabEnabled(tabParam as OntologyHubTab, caps)
  ) {
    return tabParam as OntologyHubTab;
  }
  return firstEnabledOntologyHubTab(caps);
}

export function resolveAnalyzeHubTab(tabParam: string | null, caps: KbCapabilities | null): AnalyzeHubTab {
  if (
    tabParam &&
    ANALYZE_HUB_TABS.includes(tabParam as AnalyzeHubTab) &&
    analyzeHubTabEnabled(tabParam as AnalyzeHubTab, caps)
  ) {
    return tabParam as AnalyzeHubTab;
  }
  return firstEnabledAnalyzeHubTab(caps);
}
