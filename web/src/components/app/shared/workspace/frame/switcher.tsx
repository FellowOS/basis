import { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { WorkspaceCreateDialog } from '@/components/app/shared/workspace/frame/create-dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import { SidebarMenuButton, useSidebar } from '@/components/ui/sidebar.js';
import { useI18n } from '@/i18n/context.js';
import { writeActiveWorkspaceId } from '@/lib/workspace/active-id.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspacePath, parseWorkspaceIdFromPath } from '@/lib/nav-config.js';

export function WorkspaceSwitcher() {
  const { t } = useI18n();
  const { state } = useSidebar();
  const navigate = useNavigate();
  const { workspaces, loading, refresh, getWorkspace } = useWorkspaceCatalog();
  const location = useLocation();
  const workspaceId = parseWorkspaceIdFromPath(location.pathname);
  const current = workspaceId ? getWorkspace(workspaceId) : undefined;
  const createLabel = t.admin_workspaces.page.create_workspace;
  const emptyCatalog = !loading && workspaces.length === 0;
  const label = emptyCatalog ? createLabel : (current?.name ?? t.core.workspace_nav.workspace_switcher.label);
  const [createOpen, setCreateOpen] = useState(false);

  async function onCreated(kb: { id: string }) {
    writeActiveWorkspaceId(kb.id);
    await refresh();
    navigate(workspacePath(kb.id, 'graph'));
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <SidebarMenuButton
            tooltip={label}
            className="h-9 justify-between border border-sidebar-border bg-muted/30 font-medium data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground group-data-[collapsible=icon]:justify-center"
          >
            <span className="min-w-0 flex-1 truncate text-left group-data-[collapsible=icon]:hidden">
              {loading && !current && !emptyCatalog ? t.core.workspace_nav.workspace_switcher.loading : label}
            </span>
            <PublicIcon
              name="chevron-down"
              size={14}
              className="ml-auto shrink-0 text-muted-foreground group-data-[collapsible=icon]:ml-0"
            />
          </SidebarMenuButton>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          side={state === 'collapsed' ? 'right' : 'bottom'}
          className="max-h-[min(24rem,70vh)] w-56 overflow-y-auto"
        >
          {emptyCatalog ? (
            <DropdownMenuItem
              onSelect={() => {
                setCreateOpen(true);
              }}
            >
              <PublicIcon name="plus-01" size={16} />
              {createLabel}
            </DropdownMenuItem>
          ) : (
            workspaces.map((kb) => (
              <DropdownMenuItem key={kb.id} asChild>
                <Link to={workspacePath(kb.id, 'graph')}>{kb.name}</Link>
              </DropdownMenuItem>
            ))
          )}
          {!emptyCatalog ? (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onSelect={() => {
                  setCreateOpen(true);
                }}
              >
                <PublicIcon name="plus-01" size={16} />
                {createLabel}
              </DropdownMenuItem>
            </>
          ) : null}
        </DropdownMenuContent>
      </DropdownMenu>
      <WorkspaceCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </>
  );
}
