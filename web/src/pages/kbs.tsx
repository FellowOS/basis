import { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { KbCreateDialog } from '@/components/app/kb/explorer-shell/kb-create-dialog.js';
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
import { writeActiveKbId } from '@/lib/kb-active-id.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbMemberRoleLabel, kbVisibilityLabel } from '@/lib/kb-settings-labels.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type Kb = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

export function KbsPage() {
  const { t, locale } = useI18n();
  const p = t.pages.basisKbs;
  const ks = t.kbSettings;
  const apiError = useApiErrorMessage();
  const navigate = useNavigate();
  const { kbs, refresh } = useKbCatalog();
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);

  useEffect(() => {
    void refresh().catch((err) => setError(apiError(err)));
  }, [refresh, apiError]);

  async function onCreated(kb: { id: string }) {
    writeActiveKbId(kb.id);
    await refresh();
    navigate(kbPath(kb.id, 'graph'));
  }

  const columns = useMemo<DataTableColumn<Kb>[]>(
    () => [
      { key: 'name', header: p.colName, render: (kb) => <span className="font-medium">{kb.name}</span> },
      {
        key: 'visibility',
        header: p.colVisibility,
        render: (kb) => kbVisibilityLabel(ks, kb.visibility),
      },
      { key: 'role', header: p.colMyRole, render: (kb) => kbMemberRoleLabel(ks, kb.my_role) },
      {
        key: 'actions',
        header: p.colActions,
        align: 'right',
        render: (kb) => (
          <div className="text-sm">
            <Link className="text-primary hover:underline" to={`/kbs/${kb.id}/graph`}>
              {p.open}
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" to={`/kbs/${kb.id}/settings`}>
              {p.settings}
            </Link>
          </div>
        ),
      },
    ],
    [ks, p],
  );

  const countLabel = fmt(
    pickCountForm(locale, kbs.length, p.countOne, p.count),
    { count: formatLocaleNumber(locale, kbs.length) },
  );

  return (
    <ConsolePageLayout
      crumbs={[{ label: t.menu.platform.kbs }]}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          {p.createKb}
        </Button>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DataPanel>
        <DataPanelBody padded={false}>
          {kbs.length === 0 ? (
            <EmptyState
              title={p.emptyTitle}
              description={p.emptyDescription}
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  {p.createKb}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable columns={columns} data={kbs} rowKey={(kb) => kb.id} className="border-0" />
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

      <KbCreateDialog open={createOpen} onOpenChange={setCreateOpen} onCreated={onCreated} />
    </ConsolePageLayout>
  );
}
