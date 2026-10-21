import { Navigate, useLocation, useParams } from 'react-router-dom';
import { workspacePath } from '@/lib/nav/nav-config.js';

export type OntologyHubTab =
  | 'registry'
  | 'editor'
  | 'health'
  | 'versions'
  | 'shacl'
  | 'alignments';

export type AnalyzeHubTab = 'sparql' | 'reasoning';

export const ONTOLOGY_HUB_TABS: OntologyHubTab[] = [
  'registry',
  'editor',
  'health',
  'versions',
  'shacl',
  'alignments',
];

export const ANALYZE_HUB_TABS: AnalyzeHubTab[] = ['sparql', 'reasoning'];

/** Legacy ontology sub-routes still used in bookmarks and alerts. */
export const ONTOLOGY_HUB_LEGACY_SEGMENTS = [
  'ontology-versions',
  'shacl',
  'alignments',
] as const;

export const ANALYZE_HUB_LEGACY_SEGMENTS = ['sparql', 'reasoning'] as const;

export function workspaceOntologyHubPath(
  workspaceId: string,
  tab: OntologyHubTab = 'registry',
  extra?: URLSearchParams,
): string {
  const params = new URLSearchParams(extra);
  params.delete('ontologyTab');
  if (tab !== 'registry') {
    params.set('tab', tab);
  } else {
    params.delete('tab');
  }
  const q = params.toString();
  return q ? `${workspacePath(workspaceId, 'ontology')}?${q}` : workspacePath(workspaceId, 'ontology');
}

export function workspaceAnalyzeHubPath(workspaceId: string, tab: AnalyzeHubTab = 'sparql'): string {
  if (tab === 'sparql') {
    return workspacePath(workspaceId, 'analyze');
  }
  return `${workspacePath(workspaceId, 'analyze')}?tab=${tab}`;
}

export function OntologyHubTabRedirect({ tab }: { tab: OntologyHubTab }) {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return null;
  const params = new URLSearchParams(location.search);
  params.delete('ontologyTab');
  if (tab === 'registry') {
    params.delete('tab');
  } else {
    params.set('tab', tab);
  }
  const q = params.toString();
  return <Navigate to={`${workspacePath(id, 'ontology')}${q ? `?${q}` : ''}`} replace />;
}

export function AnalyzeHubTabRedirect({ tab }: { tab: AnalyzeHubTab }) {
  const { id } = useParams();
  if (!id) return null;
  return <Navigate to={workspaceAnalyzeHubPath(id, tab)} replace />;
}
