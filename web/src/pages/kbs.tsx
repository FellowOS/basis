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
import { api } from '@/lib/api.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

type Kb = {
  id: string;
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

export function KbsPage() {
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
      { key: 'name', header: '名称', render: (kb) => <span className="font-medium">{kb.name}</span> },
      { key: 'visibility', header: '可见性', render: (kb) => kb.visibility },
      { key: 'role', header: '我的角色', render: (kb) => kb.my_role },
      {
        key: 'actions',
        header: '操作',
        align: 'right',
        render: (kb) => (
          <div className="text-sm">
            <Link className="text-primary hover:underline" to={`/kbs/${kb.id}/graph`}>
              打开
            </Link>
            {' · '}
            <Link className="text-primary hover:underline" to={`/kbs/${kb.id}/settings`}>
              设置
            </Link>
          </div>
        ),
      },
    ],
    [],
  );

  const countLabel = `共 ${kbs.length} 个知识库`;

  return (
    <ConsolePageLayout
      crumbs={[{ label: '知识库' }]}
      actions={
        <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
          新建知识库
        </Button>
      }
    >
      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <DataPanel>
        <DataPanelBody padded={false}>
          {kbs.length === 0 ? (
            <EmptyState
              title="暂无知识库"
              description="创建第一个知识库以开始管理文档与图谱。"
              action={
                <Button type="button" size="sm" onClick={() => setCreateOpen(true)}>
                  新建知识库
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
              <DialogTitle>新建知识库</DialogTitle>
              <DialogDescription>创建后可在设置中调整可见性与成员。</DialogDescription>
            </DialogHeader>
            <div className="py-4">
              <div className="space-y-2">
                <Label htmlFor="kb-name">名称</Label>
                <Input
                  id="kb-name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="名称"
                  required
                />
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
                取消
              </Button>
              <Button type="submit" disabled={creating || !name.trim()}>
                {creating ? '创建中…' : '创建'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
