import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
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

  useEffect(() => {
    void refresh().catch((err) => setError(apiError(err)));
  }, [refresh, apiError]);

  async function onCreate(event: FormEvent) {
    event.preventDefault();
    setError(null);
    try {
      await api('/api/kbs', {
        method: 'POST',
        body: JSON.stringify({ name, visibility: 'restricted' }),
      });
      setName('');
      await refresh();
    } catch (err) {
      setError(apiError(err));
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
    <div className="space-y-4">
      <PageHeader crumbs={[{ label: '知识库' }]} />

      <DataPanel>
        <form onSubmit={onCreate}>
          <DataPanelToolbar
            search={
              <div className="flex min-w-[12rem] max-w-md flex-1 items-end gap-2 sm:w-80">
                <div className="min-w-0 flex-1 space-y-1.5">
                  <Label htmlFor="kb-name" className="text-xs text-muted-foreground">
                    新建知识库
                  </Label>
                  <Input
                    id="kb-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="名称"
                    required
                  />
                </div>
              </div>
            }
            actions={
              <Button type="submit" size="sm" disabled={!name.trim()}>
                创建
              </Button>
            }
          />
        </form>
        {error ? <p className="text-sm text-destructive">{error}</p> : null}

        <DataPanelBody padded={false} className="mt-2">
          {kbs.length === 0 ? (
            <EmptyState title="暂无知识库" description="创建第一个知识库以开始管理文档与图谱。" />
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
    </div>
  );
}
