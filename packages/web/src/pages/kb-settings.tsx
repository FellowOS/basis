import { type FormEvent, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Button } from '@/components/ui/button.js';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { useI18n } from '@/i18n/context.js';
import { KbGraphProjectionPanel } from '@/components/kb-graph-projection-panel.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { api } from '@/lib/api.js';

type Member = {
  user_id: string;
  email: string;
  display_name: string;
  role: string;
};

type UserRow = { id: string; email: string; display_name: string };

type KbRow = {
  name: string;
  description: string;
  visibility: string;
  my_role: string;
};

type SearchConfig = {
  chunk_backend: 'sqlite_ledger' | 'postgres_ledger';
  vector_backend: 'sqlite_vec' | 'pgvector';
  embedding_model_id: string | null;
  keyword_enabled: boolean;
  semantic_enabled: boolean;
  default_mode: 'keyword' | 'semantic' | 'hybrid';
  auto_index: boolean;
};

type SearchConfigResponse = {
  config: SearchConfig;
  status: {
    storage_ready: boolean;
    keyword_ready: boolean;
    vector_state: 'disabled' | 'not_indexed' | 'stale' | 'ready';
    embedding_configured: boolean;
    model_ref?: string | null;
    dimension?: number | null;
  };
  available: {
    chunk_backends: SearchConfig['chunk_backend'][];
    vector_backends: SearchConfig['vector_backend'][];
    embedding_models: Array<{
      id: string;
      display_name: string;
      model: string;
      enabled: boolean;
    }>;
  };
};

export function KbSettingsPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { t } = useI18n();
  const { getKb, refresh: refreshKbs } = useKbCatalog();
  const { caps } = useKbCapabilities();
  const tab = searchParams.get('tab') ?? 'general';

  const [kb, setKb] = useState<KbRow | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [targetUser, setTargetUser] = useState('');
  const [role, setRole] = useState('viewer');
  const [error, setError] = useState<string | null>(null);
  const [searchConfig, setSearchConfig] = useState<SearchConfigResponse | null>(null);
  const [reindexing, setReindexing] = useState(false);

  const catalogKb = id ? getKb(id) : undefined;
  const name = catalogKb?.name ?? kb?.name ?? id ?? '…';

  useEffect(() => {
    if (!id) return;
    Promise.all([
      api<KbRow>(`/api/kbs/${id}`),
      api<{ members: Member[] }>(`/api/kbs/${id}/members`),
      api<{ users: UserRow[] }>('/api/users'),
      api<SearchConfigResponse>(`/api/kbs/${id}/search/config`),
    ])
      .then(([kbBody, membersBody, usersBody, searchBody]) => {
        setKb(kbBody);
        setMembers(membersBody.members);
        setUsers(usersBody.users);
        setSearchConfig(searchBody);
      })
      .catch((err) => setError(err instanceof Error ? err.message : '加载失败'));
  }, [id]);

  async function saveGeneral(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const body = await api<KbRow>(`/api/kbs/${id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          name: String(form.get('name') ?? ''),
          description: String(form.get('description') ?? ''),
          visibility: String(form.get('visibility') ?? 'restricted'),
        }),
      });
      setKb(body);
      await refreshKbs();
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function addMember() {
    if (!id || !targetUser || !kb) return;
    setError(null);
    try {
      await api(`/api/kbs/${id}/members/${targetUser}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      const body = await api<{ members: Member[] }>(`/api/kbs/${id}/members`);
      setMembers(body.members);
    } catch (err) {
      setError(err instanceof Error ? err.message : '更新失败');
    }
  }

  async function deleteKb() {
    if (!id) return;
    setError(null);
    try {
      await api(`/api/kbs/${id}`, { method: 'DELETE' });
      await refreshKbs();
      toast.success(t.common.deleteSuccess);
      navigate('/kbs');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t.common.deleteFailed);
    }
  }

  async function saveSearchConfig(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!id || !searchConfig) return;
    const form = new FormData(event.currentTarget);
    setError(null);
    try {
      const body = await api<{
        config: SearchConfig;
        status: SearchConfigResponse['status'];
        reindex_required: boolean;
      }>(`/api/kbs/${id}/search/config`, {
        method: 'PUT',
        body: JSON.stringify({
          chunk_backend: searchConfig.config.chunk_backend,
          vector_backend: searchConfig.config.vector_backend,
          embedding_model_id:
            String(form.get('embedding_model_id') ?? '') || null,
          keyword_enabled: form.get('keyword_enabled') === 'on',
          semantic_enabled: form.get('semantic_enabled') === 'on',
          default_mode: String(form.get('default_mode') ?? 'hybrid'),
          auto_index: form.get('auto_index') === 'on',
        }),
      });
      setSearchConfig((current) =>
        current
          ? { ...current, config: body.config, status: body.status }
          : current,
      );
      toast.success(
        body.reindex_required ? '检索设置已保存，请重建向量索引' : '检索设置已保存',
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : '保存失败');
    }
  }

  async function reindexSearch() {
    if (!id) return;
    setReindexing(true);
    setError(null);
    try {
      await api(`/api/kbs/${id}/search/reindex`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const current = await api<SearchConfigResponse>(`/api/kbs/${id}/search/config`);
      setSearchConfig(current);
      toast.success('向量索引已重建');
    } catch (err) {
      setError(err instanceof Error ? err.message : '重建失败');
    } finally {
      setReindexing(false);
    }
  }

  if (!kb) return <p className="text-sm text-muted-foreground">加载中…</p>;

  const canManageMembers = ['owner', 'admin'].includes(kb.my_role);
  const canEditGeneral = ['owner', 'admin'].includes(kb.my_role);
  const canEditSearch = ['owner', 'admin'].includes(kb.my_role);
  const canRebuildGraph = caps?.graph_write === true;
  const graphEnabled = caps?.graph === true;

  return (
    <div className="space-y-6">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: name, to: id ? `/kbs/${id}/graph` : '/kbs' },
          { label: t.menu.kb.settings },
        ]}
      />
      <p className="text-sm text-muted-foreground">
        {t.menu.kbSettings.myRole}：{kb.my_role}
      </p>
      {error && <p className="text-sm text-destructive">{error}</p>}

      <Tabs
        value={tab}
        onValueChange={(value) => setSearchParams({ tab: value }, { replace: true })}
      >
        <TabsList>
          <TabsTrigger value="general">{t.menu.kbSettings.general}</TabsTrigger>
          <TabsTrigger value="search">{t.menu.kbSettings.search}</TabsTrigger>
          <TabsTrigger value="graph">
            {graphEnabled ? t.menu.kbSettings.explorerGraph : 'Explorer'}
          </TabsTrigger>
          <TabsTrigger value="members">{t.menu.kbSettings.members}</TabsTrigger>
          <TabsTrigger value="danger">{t.menu.kbSettings.danger}</TabsTrigger>
        </TabsList>

        <TabsContent value="general" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.menu.kbSettings.general}</CardTitle>
            </CardHeader>
            <CardContent>
              <form className="space-y-4" onSubmit={saveGeneral}>
                <div className="space-y-2">
                  <Label htmlFor="kb-name">名称</Label>
                  <Input
                    id="kb-name"
                    name="name"
                    defaultValue={kb.name}
                    disabled={!canEditGeneral}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-desc">描述</Label>
                  <Input id="kb-desc" name="description" defaultValue={kb.description} disabled={!canEditGeneral} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="kb-vis">可见性</Label>
                  <select
                    id="kb-vis"
                    name="visibility"
                    className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                    defaultValue={kb.visibility}
                    disabled={!canEditGeneral}
                  >
                    <option value="restricted">restricted</option>
                    <option value="open">open</option>
                  </select>
                </div>
                {canEditGeneral && <Button type="submit">保存</Button>}
              </form>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="mt-4">
          {id ? (
            <KbGraphProjectionPanel
              kbId={id}
              canRebuild={canRebuildGraph}
              graphEnabled={graphEnabled}
            />
          ) : null}
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">检索与索引</CardTitle>
            </CardHeader>
            <CardContent>
              {!searchConfig ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : (
                <form className="space-y-5" onSubmit={saveSearchConfig}>
                  <div className="grid gap-4 md:grid-cols-2">
                    <div className="space-y-2">
                      <Label>Chunk 存储</Label>
                      <Input
                        value={
                          searchConfig.config.chunk_backend === 'postgres_ledger'
                            ? 'PostgreSQL ledger'
                            : 'SQLite ledger'
                        }
                        disabled
                      />
                      <p className="text-xs text-muted-foreground">
                        文档、版本、chunk 与证据的权威存储。
                      </p>
                    </div>
                    <div className="space-y-2">
                      <Label>向量存储</Label>
                      <Select
                        value={searchConfig.config.vector_backend}
                        onValueChange={(value: SearchConfig['vector_backend']) =>
                          setSearchConfig((current) =>
                            current
                              ? {
                                  ...current,
                                  config: { ...current.config, vector_backend: value },
                                }
                              : current,
                          )
                        }
                        disabled={!canEditSearch}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          {searchConfig.available.vector_backends.map((backend) => (
                            <SelectItem key={backend} value={backend}>
                              {backend === 'pgvector'
                                ? 'PostgreSQL (pgvector)'
                                : 'SQLite (sqlite-vec)'}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-muted-foreground">
                        每个知识库独立、可重建的向量索引。
                      </p>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label>嵌入模型</Label>
                    <Select
                      value={searchConfig.config.embedding_model_id ?? '__default__'}
                      onValueChange={(value) =>
                        setSearchConfig((current) =>
                          current
                            ? {
                                ...current,
                                config: {
                                  ...current.config,
                                  embedding_model_id:
                                    value === '__default__' ? null : value,
                                },
                              }
                            : current,
                        )
                      }
                      disabled={!canEditSearch}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="__default__">平台默认模型 / 本地 fallback</SelectItem>
                        {searchConfig.available.embedding_models
                          .filter((model) => model.enabled)
                          .map((model) => (
                            <SelectItem key={model.id} value={model.id}>
                              {model.display_name || model.model}
                            </SelectItem>
                          ))}
                      </SelectContent>
                    </Select>
                    <input
                      type="hidden"
                      name="embedding_model_id"
                      value={searchConfig.config.embedding_model_id ?? ''}
                    />
                  </div>

                  <div className="grid gap-3 sm:grid-cols-3">
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="keyword_enabled"
                        defaultChecked={searchConfig.config.keyword_enabled}
                        disabled={!canEditSearch}
                      />
                      全文检索
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="semantic_enabled"
                        defaultChecked={searchConfig.config.semantic_enabled}
                        disabled={!canEditSearch}
                      />
                      语义检索
                    </label>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        name="auto_index"
                        defaultChecked={searchConfig.config.auto_index}
                        disabled={!canEditSearch}
                      />
                      上传后自动建立向量索引
                    </label>
                  </div>

                  <div className="space-y-2">
                    <Label>默认搜索模式</Label>
                    <select
                      name="default_mode"
                      className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                      defaultValue={searchConfig.config.default_mode}
                      disabled={!canEditSearch}
                    >
                      <option value="keyword">全文检索</option>
                      <option value="semantic">语义检索</option>
                      <option value="hybrid">混合检索（推荐）</option>
                    </select>
                  </div>

                  <div className="rounded-md border p-3 text-sm">
                    <div>存储：{searchConfig.status.storage_ready ? '可用' : '不可用'}</div>
                    <div>向量索引：{searchConfig.status.vector_state}</div>
                    <div>
                      嵌入服务：
                      {searchConfig.status.embedding_configured
                        ? '已配置'
                        : '使用本地 fallback'}
                    </div>
                  </div>

                  {canEditSearch && (
                    <div className="flex gap-2">
                      <Button type="submit">保存</Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={reindexSearch}
                        disabled={reindexing || !searchConfig.config.semantic_enabled}
                      >
                        {reindexing ? '重建中…' : '重建向量索引'}
                      </Button>
                    </div>
                  )}
                </form>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.menu.kbSettings.members}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>用户</TableHead>
                    <TableHead>邮箱</TableHead>
                    <TableHead>角色</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell>{m.display_name}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{m.role}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
              {canManageMembers && (
                <div className="flex flex-wrap items-end gap-4 border-t pt-4">
                  <div className="min-w-[12rem] space-y-2">
                    <Label>添加成员</Label>
                    <Select value={targetUser} onValueChange={setTargetUser}>
                      <SelectTrigger>
                        <SelectValue placeholder="选择用户" />
                      </SelectTrigger>
                      <SelectContent>
                        {users.map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.display_name} ({u.email})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="min-w-[8rem] space-y-2">
                    <Label>角色</Label>
                    <Select value={role} onValueChange={setRole}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="viewer">viewer</SelectItem>
                        <SelectItem value="editor">editor</SelectItem>
                        <SelectItem value="admin">admin</SelectItem>
                        <SelectItem value="owner">owner</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <Button type="button" onClick={addMember}>保存角色</Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="danger" className="mt-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">{t.menu.kbSettings.danger}</CardTitle>
            </CardHeader>
            <CardContent>
              {(kb.my_role === 'owner' || kb.my_role === 'admin') && (
                <ConfirmAlertDialog
                  title={t.menu.kbSettings.deleteKb}
                  description={t.menu.kbSettings.deleteConfirm}
                  destructive
                  onConfirm={() => deleteKb()}
                  trigger={
                    <Button type="button" variant="destructive">
                      {t.menu.kbSettings.deleteKb}
                    </Button>
                  }
                />
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
