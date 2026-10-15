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
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

export function UsersPage() {
  const apiError = useApiErrorMessage();
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [createOpen, setCreateOpen] = useState(false);
  const [creating, setCreating] = useState(false);

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
          is_admin: form.get('is_admin') === 'on',
        }),
      });
      event.currentTarget.reset();
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
      { key: 'name', header: '显示名', render: (u) => u.display_name },
      { key: 'email', header: '邮箱', render: (u) => u.email },
      { key: 'admin', header: '管理员', render: (u) => (u.is_admin ? '是' : '否') },
    ],
    [],
  );

  const countLabel = `共 ${users.length} 位用户`;

  return (
    <ConsolePageLayout
      crumbs={[{ label: '用户' }]}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          创建用户
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
              title="暂无用户"
              description="代开账号后用户可登录系统。"
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  创建用户
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

      <Dialog open={createOpen} onOpenChange={setCreateOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={onCreate}>
            <DialogHeader>
              <DialogTitle>创建用户</DialogTitle>
              <DialogDescription>代开账号；密码至少 8 位。</DialogDescription>
            </DialogHeader>
            <div className="grid gap-4 py-4">
              <div className="space-y-2">
                <Label htmlFor="email">邮箱</Label>
                <Input id="email" name="email" type="email" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="display_name">显示名</Label>
                <Input id="display_name" name="display_name" required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">密码</Label>
                <Input id="password" name="password" type="password" minLength={8} required />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="is_admin" />
                系统管理员
              </label>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={creating}>
                {creating ? '创建中…' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
