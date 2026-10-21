import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { WorkspaceCreateDialog } from '@/components/app/shared/workspace/frame/create-dialog.js';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  EmptyState,
} from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { Button } from '@/components/ui/button.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import { writeActiveWorkspaceId } from '@/lib/workspace/active-id.js';
import { useWorkspaceCatalog } from '@/lib/workspace/context.js';
import { workspacePath } from '@/lib/nav/nav-config.js';
import { usePlatformAdminCrumbs } from '@/lib/admin/use-platform-admin-crumbs.js';
import { workspaceMemberRoleLabel, workspaceVisibilityLabel } from '@/modules/settings/lib/settings-labels.js';
import { useApiErrorMessage } from '@/lib/errors/use-api-error-message.js';

type Kb = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

export function WorkspacesPage() {
  const { t, locale } = useI18n();
  const p = t.admin_workspaces.page;
  const ks = t.settings.panel;
  const apiError = useApiErrorMessage();
  const navigate = useNavigate();
  const { workspaces, refresh } = useWorkspaceCatalog();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void refresh().catch((err) => setError(apiError(err)));
  }, [refresh, apiError]);

  async function onCreated(kb: { id: string }) {
    writeActiveWorkspaceId(kb.id);
    await refresh();
    navigate(workspacePath(kb.id, 'graph'));
  }

  const columns = useMemo<DataTableColumn<Kb>[]>(
    () => [
      { key: 'name', header: p.col_name, render: (kb) => <span className="font-medium">{kb.name}</span> },
      {
        key: 'visibility',
        header: p.col_visibility,
        render: (kb) => workspaceVisibilityLabel(ks, kb.visibility),
      },
      { key: 'role', header: p.col_my_role, render: (kb) => workspaceMemberRoleLabel(ks, kb.my_role) },
      {
        key: 'actions',
        header: p.col_actions,
        align: 'right',
        render: (kb) => (
          <div className="text-sm">
            <Link className="text-primary hover:underline" to={`/workspaces/${kb.id}/graph`}>
              {p.open}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" to={`/workspaces/${kb.id}/settings`}>
              {p.settings}
            </Link>
          </div>
        ),
      },
    ],
    [ks, p],
  );

  const countLabel = fmt(
    pickCountForm(locale, workspaces.length, p.count_one, p.count),
    { count: formatLocaleNumber(locale, workspaces.length) },
  );
  const crumbs = usePlatformAdminCrumbs(t.core.workspace_nav.platform.workspaces);

  return (
    <ConsolePageLayout
      crumbs={crumbs}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          {p.create_workspace}
        </Button>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DataPanel>
        <DataPanelBody padded={false}>
          {workspaces.length === 0 ? (
            <EmptyState
              title={p.empty_title}
              description={p.empty_description}
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  {p.create_workspace}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable columns={columns} data={workspaces} rowKey={(kb) => kb.id} className="border-0" />
              <DataPanelTableFooter
                countLabel={countLabel}
                page={1}
                totalPages={1}
                onPageChange={() => {}}
              />
            </>
          )}
        </DataPanelBody>
      </DataPanel>

      <WorkspaceCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </ConsolePageLayout>
  );
}
