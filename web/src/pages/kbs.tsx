import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  EmptyState,
} from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import { api } from '@/lib/api.js';
import { useKbCatalog } from '@/lib/kb-context.js';
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
  const { kbs, refresh } = useKbCatalog();
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    void refresh().catch((err) => setError(apiError(err)));
  }, [refresh, apiError]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      await api('/api/kbs', {
        method: 'POST',
        body: JSON.stringify({ name, visibility: 'restricted' }),
      });
      setName('');
      setCreateOpen(false);
      await refresh();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form
            onSubmit={(e) => {
              void onCreate(e);
            }}
          >
            <DialogHeader>
              <DialogTitle>{p.createDialogTitle}</DialogTitle>
              <DialogDescription>{p.createDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="kb-name">{p.nameLabel}</Label>
                <Input
                  id="kb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={p.namePlaceholder}
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? p.creating : p.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
