import { Navigate, useParams } from 'react-router-dom';
import { workspaceConnectorPanelPath } from '@/lib/nav/nav-config.js';

/** Legacy route: onboarding wizard merged into connectors → mappings suggest flow. */
export function DataOnboardingRedirect() {
  const { id: workspaceId } = useParams();
  if (!workspaceId) {
    return null;
  }
  return (
    <Navigate
      to={`${workspaceConnectorPanelPath(workspaceId, 'mappings')}?suggest=1`}
      replace
    />
  );
}
