import { Navigate } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { isSetupWorkspaceId, WORKSPACE_SETUP_ID, pickDefaultWorkspaceId } from '@/lib/workspace/active-id.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspacePath } from '@/lib/nav/nav-config.js';

export function WorkspacesLandingRedirect() {
  const { t } = useI18n();
  const { workspaces, loading } = useWorkspaceCatalog();

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.core.common.loading}
      </div>
    );
  }

  const defaultId = pickDefaultWorkspaceId(workspaces);
  if (defaultId && !isSetupWorkspaceId(defaultId)) {
    return <Navigate to={workspacePath(defaultId, 'graph')} replace />;
  }

  return <Navigate to={workspacePath(WORKSPACE_SETUP_ID, 'graph')} replace />;
}
