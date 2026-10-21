import type { ReactNode } from 'react';
import { Navigate, useLocation, useParams } from 'react-router-dom';
import { Spinner } from '@/components/ui/spinner.js';
import { isSetupWorkspaceId, WORKSPACE_SETUP_ID } from '@/lib/workspace/active-id.js';
import { workspacePath } from '@/lib/nav/nav-config.js';
import { useBasisSession } from '@/lib/session/basis-session.js';
import { useI18n } from '@/i18n/context.js';
import { useSettingsAccess } from '@/lib/shell/use-settings-access.js';

export function AdminOnly({ children }: { children: ReactNode }) {
  const { t } = useI18n();
  const { ready, user, homePath, isAdmin } = useBasisSession();
  if (!ready) {
    return (
      <div className="flex flex-1 items-center justify-center gap-2 text-sm text-muted-foreground">
        <Spinner className="size-4" />
        {t.core.common.loading}
      </div>
    );
  }
  if (!user || !isAdmin) return <Navigate to={homePath} replace />;
  return children;
}

export function SettingsAccess({ children }: { children: ReactNode }) {
  const { ready, user, homePath } = useBasisSession();
  const allowed = useSettingsAccess();

  if (!ready) return children;
  if (!user) return <Navigate to="/login" replace />;
  if (allowed === null) return null;
  if (!allowed) return <Navigate to={homePath} replace />;
  return children;
}

export function WorkspaceDefaultRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/workspaces" replace />;
  if (isSetupWorkspaceId(id)) return <Navigate to={workspacePath(WORKSPACE_SETUP_ID, 'graph')} replace />;
  return <Navigate to={`/workspaces/${id}/graph`} replace />;
}

export function LegacyKnowledgeRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/workspaces" replace />;
  return <Navigate to={`/workspaces/${id}/sources`} replace />;
}

export function LegacyLibraryRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/workspaces" replace />;
  return <Navigate to={`/workspaces/${id}/sources`} replace />;
}

/** Legacy Playground URL; F-CHAT-01–03 removed from console (see progress §6). */
export function LegacyChatRedirect() {
  const { id } = useParams();
  const location = useLocation();
  if (!id) return <Navigate to="/workspaces" replace />;
  const params = new URLSearchParams(location.search);
  if (params.get('tab') === 'connect') {
    return <Navigate to={`${workspacePath(id, 'integration')}?tab=mcp`} replace />;
  }
  return <Navigate to={workspacePath(id, 'search')} replace />;
}

export function LegacyMcpRedirect() {
  const { id } = useParams();
  if (!id) return <Navigate to="/workspaces" replace />;
  return <Navigate to={`${workspacePath(id, 'integration')}?tab=mcp`} replace />;
}
