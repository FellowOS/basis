import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect, useMemo, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import {
  ConsolePageLayout,
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  EmptyState,
} from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import { Spinner } from '@/components/ui/spinner.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber, pickCountForm } from '@/i18n/format.js';
import { openApiGET, openApiPOST } from '@/lib/openapi-client.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

const createUserSchema = z.object({
  email: z.string().email(),
  display_name: z.string().min(1),
  password: z.string().min(8),
  is_admin: z.boolean(),
});

type CreateUserValues = z.infer<typeof createUserSchema>;

export function UsersPage() {
  const { t, locale } = useI18n();
  const p = t.pages.basisUsers;
  const apiError = useApiErrorMessage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

  const createForm = useForm<CreateUserValues>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      display_name: '',
      password: '',
      is_admin: false,
    },
  });

  async function load() {
    setLoading(true);
    try {
      const body = await openApiGET<{ users: UserRow[] }>('/api/v1/admin/users');
      setUsers(body.users);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load().catch((err) => setError(apiError(err)));
  }, [apiError]);

  async function onCreate(values: CreateUserValues) {
    setCreating(true);
    setError(null);
    try {
      await openApiPOST('/api/v1/admin/users', { body: values });
      createForm.reset();
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
          if (!open) createForm.reset();
        }}
      >
        <DialogContent className="sm:max-w-md">
          <Form {...createForm}>
            <form onSubmit={createForm.handleSubmit(onCreate)}>
              <DialogHeader>
                <DialogTitle>{p.createDialogTitle}</DialogTitle>
                <DialogDescription>{p.createDialogDesc}</DialogDescription>
              </DialogHeader>
              <div className="grid gap-4 py-4">
                <FormField
                  control={createForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p.emailLabel}</FormLabel>
                      <FormControl>
                        <Input type="email" autoComplete="email" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="display_name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p.displayNameLabel}</FormLabel>
                      <FormControl>
                        <Input autoComplete="name" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{p.passwordLabel}</FormLabel>
                      <FormControl>
                        <Input type="password" autoComplete="new-password" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={createForm.control}
                  name="is_admin"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center gap-2 space-y-0">
                      <FormControl>
                        <Checkbox
                          checked={field.value}
                          onCheckedChange={(checked) => field.onChange(checked === true)}
                        />
                      </FormControl>
                      <FormLabel className="cursor-pointer font-normal">{p.systemAdmin}</FormLabel>
                    </FormItem>
                  )}
                />
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
          </Form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
