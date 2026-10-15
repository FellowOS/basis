import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/console-ui/ConfirmAlertDialog.js';
import { ConsolePageLayout } from '@/components/console-ui/index.js';
import { Button } from '@/components/ui/button.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
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
import { KbGraphOverviewStats } from '@/components/kb/widgets/kb-graph-overview-stats.js';
import { KbGraphProjectionPanel } from '@/components/kb/widgets/kb-graph-projection-panel.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { api } from '@/lib/api.js';
import { useApiErrorMessage } from '@/lib/use-api-error-message.js';

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
  const { t, locale } = useI18n();
  const zh = locale === 'zh';
  const apiError = useApiErrorMessage();
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
  const [generalEditOpen, setGeneralEditOpen] = useState(false);
  const [searchEditOpen, setSearchEditOpen] = useState(false);
  const [memberAddOpen, setMemberAddOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

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
      .catch((err) => setError(apiError(err)));
  }, [apiError, id]);

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
      setGeneralEditOpen(false);
    } catch (err) {
      setError(apiError(err));
    }
  }

  async function addMember() {
    if (!id || !targetUser || !kb) return;
    setAddingMember(true);
    setError(null);
    try {
      await api(`/api/kbs/${id}/members/${targetUser}`, {
        method: 'PUT',
        body: JSON.stringify({ role }),
      });
      const body = await api<{ members: Member[] }>(`/api/kbs/${id}/members`);
      setMembers(body.members);
      setMemberAddOpen(false);
      setTargetUser('');
      setRole('viewer');
    } catch (err) {
      setError(apiError(err));
    } finally {
      setAddingMember(false);
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
      toast.error(apiError(err));
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
      setSearchEditOpen(false);
    } catch (err) {
      setError(apiError(err));
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
      setError(apiError(err));
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
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: name, to: id ? `/kbs/${id}/graph` : '/kbs' },
        { label: t.menu.kb.settings },
      ]}
      subtitle={t.pages.kbSubtitles.settings}
      meta={`${t.menu.kbSettings.myRole}：${kb.my_role}`}
    >
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
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t.menu.kbSettings.general}</CardTitle>
              {canEditGeneral ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setGeneralEditOpen(true)}>
                  编辑
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p><span className="text-muted-foreground">名称：</span>{kb.name}</p>
              <p><span className="text-muted-foreground">描述：</span>{kb.description || '—'}</p>
              <p><span className="text-muted-foreground">可见性：</span>{kb.visibility}</p>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="graph" className="mt-4 space-y-4">
          {id ? (
            <>
              <KbGraphOverviewStats kbId={id} />
              <KbGraphProjectionPanel
                kbId={id}
                canRebuild={canRebuildGraph}
                graphEnabled={graphEnabled}
              />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">检索与索引</CardTitle>
              {canEditSearch && searchConfig ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setSearchEditOpen(true)}>
                  配置检索
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {!searchConfig ? (
                <p className="text-sm text-muted-foreground">加载中…</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">向量存储：</span>
                    {searchConfig.config.vector_backend === 'pgvector'
                      ? 'PostgreSQL (pgvector)'
                      : 'SQLite (sqlite-vec)'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">嵌入模型：</span>
                    {searchConfig.config.embedding_model_id ?? '平台默认 / 本地 fallback'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">默认模式：</span>
                    {searchConfig.config.default_mode}
                  </p>
                  <div className="rounded-md border p-3">
                    <div>存储：{searchConfig.status.storage_ready ? '可用' : '不可用'}</div>
                    <div>向量索引：{searchConfig.status.vector_state}</div>
                    <div>
                      嵌入服务：
                      {searchConfig.status.embedding_configured ? '已配置' : '使用本地 fallback'}
                    </div>
                  </div>
                  {canEditSearch ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={reindexSearch}
                      disabled={reindexing || !searchConfig.config.semantic_enabled}
                    >
                      {reindexing ? '重建中…' : '重建向量索引'}
                    </Button>
                  ) : null}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="members" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t.menu.kbSettings.members}</CardTitle>
              {canManageMembers ? (
                <Button type="button" size="sm" onClick={() => setMemberAddOpen(true)}>
                  添加成员
                </Button>
              ) : null}
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

      <Dialog open={generalEditOpen} onOpenChange={setGeneralEditOpen}>
        <DialogContent className="sm:max-w-md">
          <form className="space-y-4" onSubmit={saveGeneral}>
            <DialogHeader>
              <DialogTitle>{t.menu.kbSettings.general}</DialogTitle>
              <DialogDescription>名称、描述与可见性。</DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <div className="space-y-2">
                <Label htmlFor="kb-name">名称</Label>
                <Input id="kb-name" name="name" defaultValue={kb.name} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kb-desc">描述</Label>
                <Input id="kb-desc" name="description" defaultValue={kb.description} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="kb-vis">可见性</Label>
                <select
                  id="kb-vis"
                  name="visibility"
                  className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 text-sm"
                  defaultValue={kb.visibility}
                >
                  <option value="restricted">restricted</option>
                  <option value="open">open</option>
                </select>
              </div>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setGeneralEditOpen(false)}>
                取消
              </Button>
              <Button type="submit">保存</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {searchConfig ? (
        <Dialog open={searchEditOpen} onOpenChange={setSearchEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <form className="space-y-5" onSubmit={saveSearchConfig}>
              <DialogHeader>
                <DialogTitle>检索与索引</DialogTitle>
                <DialogDescription>向量后端、嵌入模型与默认搜索模式。</DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(60vh,24rem)] space-y-5 overflow-y-auto py-2">
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
                                embedding_model_id: value === '__default__' ? null : value,
                              },
                            }
                          : current,
                      )
                    }
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
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="keyword_enabled"
                      defaultChecked={searchConfig.config.keyword_enabled}
                    />
                    全文检索
                  </label>
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      name="semantic_enabled"
                      defaultChecked={searchConfig.config.semantic_enabled}
                    />
                    语义检索
                  </label>
                  <label className="flex items-center gap-2 text-sm sm:col-span-2">
                    <input
                      type="checkbox"
                      name="auto_index"
                      defaultChecked={searchConfig.config.auto_index}
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
                  >
                    <option value="keyword">全文检索</option>
                    <option value="semantic">语义检索</option>
                    <option value="hybrid">混合检索（推荐）</option>
                  </select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSearchEditOpen(false)}>
                  取消
                </Button>
                <Button type="submit">保存</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={memberAddOpen} onOpenChange={setMemberAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>添加成员</DialogTitle>
            <DialogDescription>选择用户并指定 KB 角色。</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>用户</Label>
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
            <div className="space-y-2">
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
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMemberAddOpen(false)}>
              取消
            </Button>
            <Button type="button" disabled={!targetUser || addingMember} onClick={() => void addMember()}>
              {addingMember ? '保存中…' : '保存'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
