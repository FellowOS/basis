import { type FormEvent, useEffect, useMemo, useState } from 'react';
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
import { Checkbox } from '@/components/ui/checkbox.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

export function UsersPage() {
  const { t, locale } = useI18n();
  const p = t.pages.basisUsers;
  const apiError = useApiErrorMessage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createIsAdmin, setCreateIsAdmin] = useState(false);

  async function load() {
    setLoading(true);
    try {
      const body = await api<{ users: UserRow[] }>('/api/admin/users');
      setUsers(body.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(apiError(err)));
  }, [apiError]);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    setCreating(true);
    setError(null);
    try {
      await api('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: form.get('email'),
          password: form.get('password'),
          display_name: form.get('display_name'),
          is_admin: createIsAdmin,
        }),
      });
      event.currentTarget.reset();
      setCreateIsAdmin(false);
      setCreateOpen(false);
      await load();
    } catch (err) {
      setError(apiError(err));
    } finally {
      setCreating(false);
    }
  }

  const columns = useMemo<DataTableColumn<UserRow>[]>(
    () => [
      { key: 'name', header: p.colDisplayName, render: (u) => u.display_name },
      { key: 'email', header: p.colEmail, render: (u) => u.email },
      {
        key: 'admin',
        header: p.colAdmin,
        render: (u) => (u.is_admin ? p.yes : p.no),
      },
    ],
    [p],
  );

  const countLabel = fmt(
    pickCountForm(locale, users.length, p.countOne, p.count),
    { count: formatLocaleNumber(locale, users.length) },
  );

  return (
    <ConsolePageLayout
      crumbs={[{ label: t.menu.platform.users }]}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          {p.createUser}
        </Button>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <DataPanel>
        <DataPanelBody padded={false}>
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState
              title={p.emptyTitle}
              description={p.emptyDescription}
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  {p.createUser}
                </Button>
              }
            />
          ) : (
            <>
              <DataTable columns={columns} data={users} rowKey={(u) => u.id} className="border-0" />
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

      <Dialog
        open={createOpen}
        onOpenChange={(open) => {
          setCreateOpen(open);
          if (!open) setCreateIsAdmin(false);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>{p.createDialogTitle}</DialogTitle>
              <DialogDescription>{p.createDialogDesc}</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">{p.emailLabel}</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">{p.displayNameLabel}</Label>
                <Input id="display_name" name="display_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">{p.passwordLabel}</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="create-is-admin"
                  checked={createIsAdmin}
                  onCheckedChange={(checked) => setCreateIsAdmin(checked === true)}
                />
                <Label htmlFor="create-is-admin" className="cursor-pointer font-normal">
                  {p.systemAdmin}
                </Label>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? p.creating : p.create}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
