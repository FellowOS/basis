import { type FormEvent, useEffect, useMemo, useState } from 'react';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
} from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { Spinner } from '@/components/ui/spinner.js';
import { api } from '@/lib/api.js';

type UserRow = {
  id: string;
  email: string;
  display_name: string;
  is_admin: boolean;
};

export function UsersPage() {
  const [users, setUsers] = useState<UserRow[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

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
    load().catch((err) => setError(err instanceof Error ? err.message : '加载失败'));
  }, []);

  async function onCreate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
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
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : '创建失败');
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
    <div className="space-y-4">
      <PageHeader crumbs={[{ label: '用户' }]} />
      <DataPanel>
        <form onSubmit={onCreate}>
          <DataPanelToolbar
            actions={
              <div className="flex w-full flex-wrap items-end gap-3">
                <div className="min-w-[10rem] space-y-1.5">
                  <Label htmlFor="email" className="text-xs text-muted-foreground">邮箱</Label>
                  <Input id="email" name="email" type="email" required />
                </div>
                <div className="min-w-[10rem] space-y-1.5">
                  <Label htmlFor="display_name" className="text-xs text-muted-foreground">显示名</Label>
                  <Input id="display_name" name="display_name" required />
                </div>
                <div className="min-w-[10rem] space-y-1.5">
                  <Label htmlFor="password" className="text-xs text-muted-foreground">密码</Label>
                  <Input id="password" name="password" type="password" minLength={8} required />
                </div>
                <label className="flex items-center gap-2 pb-2 text-sm">
                  <input type="checkbox" name="is_admin" />
                  系统管理员
                </label>
                <Button type="submit" size="sm">创建</Button>
              </div>
            }
          />
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}
        <DataPanelBody padded={false} className="mt-2">
          {loading ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : users.length === 0 ? (
            <EmptyState title="暂无用户" description="代开账号后用户可登录系统。" />
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
    </div>
  );
}
