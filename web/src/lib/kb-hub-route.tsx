import { Navigate, useLocation, useParams } from 'react-router-dom';
import { kbPath } from '@/lib/nav-config.js';

export type OntologyHubTab = 'model' | 'versions' | 'shacl' | 'alignments';
export type AnalyzeHubTab = 'sparql' | 'reasoning';

export const ONTOLOGY_HUB_TABS: OntologyHubTab[] = ['model', 'versions', 'shacl', 'alignments'];
export const ANALYZE_HUB_TABS: AnalyzeHubTab[] = ['sparql', 'reasoning'];

/** Legacy ontology sub-routes still used in bookmarks and alerts. */
export const KB_ONTOLOGY_HUB_LEGACY_SEGMENTS = [
  'ontology-versions',
  'shacl',
  'alignments',
] as const;

export const KB_ANALYZE_HUB_LEGACY_SEGMENTS = ['sparql', 'reasoning'] as const;

export function kbOntologyHubPath(
  kbId: string,
  tab: OntologyHubTab = 'model',
  extra?: URLSearchParams,
): string {
  const params = new URLSearchParams(extra);
  if (tab !== 'model') {
    params.set('tab', tab);
  } else {
    params.delete('tab');
  }
  const q = params.toString();
  return q ? `${kbPath(kbId, 'ontology')}?${q}` : kbPath(kbId, 'ontology');
}

export function kbAnalyzeHubPath(kbId: string, tab: AnalyzeHubTab = 'sparql'): string {
  if (tab === 'sparql') {
    return kbPath(kbId, 'analyze');
  }
  return `${kbPath(kbId, 'analyze')}?tab=${tab}`;
}

export function KbOntologyHubTabRedirect({ tab }: { tab: OntologyHubTab }) {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return null;
  const params = new URLSearchParams(location.search);
  params.set('tab', tab);
  params.delete('ontologyTab');
  const q = params.toString();
  return <Navigate to={`${kbPath(id, 'ontology')}${q ? `?${q}` : ''}`} replace />;
}

export function KbAnalyzeHubTabRedirect({ tab }: { tab: AnalyzeHubTab }) {
  const { id } = useParams();
  if (!id) return null;
  return <Navigate to={kbAnalyzeHubPath(id, tab)} replace />;
}
