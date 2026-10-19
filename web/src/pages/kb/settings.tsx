import { zodResolver } from '@hookform/resolvers/zod';
import { type FormEvent, useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { z } from 'zod';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ConfirmAlertDialog } from '@/components/app/shared/console/ConfirmAlertDialog.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
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
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form.js';
import { Input } from '@/components/ui/input.js';
import {
  NativeSelect,
  NativeSelectOption,
} from '@/components/ui/native-select.js';
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
import { fmt } from '@/i18n/format.js';
import { KbGraphOverviewStats } from '@/components/app/kb/widgets/kb-graph-overview-stats.js';
import { KbGovernanceConfigPanel } from '@/components/app/kb/widgets/kb-governance-config-panel.js';
import { KbGraphProjectionPanel } from '@/components/app/kb/widgets/kb-graph-projection-panel.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { kbMemberRoleLabel, kbVisibilityLabel } from '@/lib/kb-settings-labels.js';
import {
  kbOpenApiDELETE,
  kbOpenApiGET,
  kbOpenApiPATCH,
  kbOpenApiPOST,
  kbOpenApiPUT,
  openApiGET,
} from '@/lib/openapi-client.js';
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
  const { t } = useI18n();
  const emptyCell = t.common.emptyCell;
  const ks = t.kbSettings;

  function defaultModeLabel(mode: SearchConfig['default_mode']): string {
    if (mode === 'keyword') return ks.modeKeyword;
    if (mode === 'semantic') return ks.modeSemantic;
    return ks.modeHybrid;
  }

  function vectorStateLabel(state: SearchConfigResponse['status']['vector_state']): string {
    return ks.vectorState[state] ?? state;
  }
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

  const generalFormSchema = z.object({
    name: z.string().min(1),
    description: z.string(),
    visibility: z.enum(['restricted', 'open']),
  });

  type GeneralFormValues = z.infer<typeof generalFormSchema>;

  const generalForm = useForm<GeneralFormValues>({
    resolver: zodResolver(generalFormSchema),
    defaultValues: { name: '', description: '', visibility: 'restricted' },
  });
  const [searchEditOpen, setSearchEditOpen] = useState(false);
  const [memberAddOpen, setMemberAddOpen] = useState(false);
  const [addingMember, setAddingMember] = useState(false);

  const catalogKb = id ? getKb(id) : undefined;
  const name = catalogKb?.name ?? kb?.name ?? id ?? t.common.ellipsis;

  useEffect(() => {
    if (!id) return;
    Promise.all([
      kbOpenApiGET<KbRow>(id, ''),
      kbOpenApiGET<{ members: Member[] }>(id, 'members'),
      openApiGET<{ users: UserRow[] }>('/api/v1/users'),
      kbOpenApiGET<SearchConfigResponse>(id, 'search/config'),
    ])
      .then(([kbBody, membersBody, usersBody, searchBody]) => {
        setKb(kbBody);
        setMembers(membersBody.members);
        setUsers(usersBody.users);
        setSearchConfig(searchBody);
      })
      .catch((err) => setError(apiError(err)));
  }, [apiError, id]);

  useEffect(() => {
    if (generalEditOpen && kb) {
      generalForm.reset({
        name: kb.name,
        description: kb.description,
        visibility: kb.visibility === 'open' ? 'open' : 'restricted',
      });
    }
  }, [generalEditOpen, kb, generalForm]);

  async function saveGeneral(values: GeneralFormValues) {
    if (!id) return;
    setError(null);
    try {
      const body = await kbOpenApiPATCH<KbRow>(id, '', {
        body: {
          name: values.name,
          description: values.description,
          visibility: values.visibility,
        },
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
      await kbOpenApiPUT(id, `members/${targetUser}`, { body: { role } });
      const body = await kbOpenApiGET<{ members: Member[] }>(id, 'members');
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
      await kbOpenApiDELETE(id, '');
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
    setError(null);
    try {
      const body = await kbOpenApiPUT<{
        config: SearchConfig;
        status: SearchConfigResponse['status'];
        reindex_required: boolean;
      }>(id, 'search/config', {
        body: {
          chunk_backend: searchConfig.config.chunk_backend,
          vector_backend: searchConfig.config.vector_backend,
          embedding_model_id: searchConfig.config.embedding_model_id,
          keyword_enabled: searchConfig.config.keyword_enabled,
          semantic_enabled: searchConfig.config.semantic_enabled,
          default_mode: searchConfig.config.default_mode,
          auto_index: searchConfig.config.auto_index,
        },
      });
      setSearchConfig((current) =>
        current
          ? { ...current, config: body.config, status: body.status }
          : current,
      );
      toast.success(
        body.reindex_required ? ks.toastSearchSavedReindex : ks.toastSearchSaved,
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
      await kbOpenApiPOST(id, 'search/reindex', { body: {} });
      const current = await kbOpenApiGET<SearchConfigResponse>(id, 'search/config');
      setSearchConfig(current);
      toast.success(ks.toastReindexDone);
    } catch (err) {
      setError(apiError(err));
    } finally {
      setReindexing(false);
    }
  }

  if (!kb) return <p className="text-sm text-muted-foreground">{t.common.loading}</p>;

  const canManageMembers = ['owner', 'admin'].includes(kb.my_role);
  const canEditGeneral = ['owner', 'admin'].includes(kb.my_role);
  const canEditSearch = ['owner', 'admin'].includes(kb.my_role);
  const canEditGovernance = ['owner', 'admin'].includes(kb.my_role);
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
      meta={fmt(ks.myRoleMeta, { role: kbMemberRoleLabel(ks, kb.my_role) })}
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
            {graphEnabled ? t.menu.kbSettings.explorerGraph : ks.explorerTab}
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
                  {ks.edit}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <span className="text-muted-foreground">{ks.fields.name}{ks.labelSuffix}</span>
                {kb.name}
              </p>
              <p>
                <span className="text-muted-foreground">{ks.fields.description}{ks.labelSuffix}</span>
                {kb.description || emptyCell}
              </p>
              <p>
                <span className="text-muted-foreground">{ks.fields.visibility}{ks.labelSuffix}</span>
                {kbVisibilityLabel(ks, kb.visibility)}
              </p>
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
              <KbGovernanceConfigPanel kbId={id} canEdit={canEditGovernance} />
            </>
          ) : null}
        </TabsContent>

        <TabsContent value="search" className="mt-4">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <CardTitle className="text-base">{t.menu.kbSettings.search}</CardTitle>
              {canEditSearch && searchConfig ? (
                <Button type="button" size="sm" variant="outline" onClick={() => setSearchEditOpen(true)}>
                  {ks.configureSearch}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent>
              {!searchConfig ? (
                <p className="text-sm text-muted-foreground">{t.common.loading}</p>
              ) : (
                <div className="space-y-4 text-sm">
                  <p>
                    <span className="text-muted-foreground">{ks.vectorStore}{ks.labelSuffix}</span>
                    {searchConfig.config.vector_backend === 'pgvector'
                      ? 'PostgreSQL (pgvector)'
                      : 'SQLite (sqlite-vec)'}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{ks.embeddingModel}{ks.labelSuffix}</span>
                    {searchConfig.config.embedding_model_id ?? ks.platformDefaultEmbedding}
                  </p>
                  <p>
                    <span className="text-muted-foreground">{ks.defaultMode}{ks.labelSuffix}</span>
                    {defaultModeLabel(searchConfig.config.default_mode)}
                  </p>
                  <div className="rounded-md border p-3">
                    <div>
                      {ks.statusStorage}{ks.labelSuffix}
                      {searchConfig.status.storage_ready ? ks.storageReady : ks.storageNotReady}
                    </div>
                    <div>
                      {ks.statusVectorIndex}{ks.labelSuffix}
                      {vectorStateLabel(searchConfig.status.vector_state)}
                    </div>
                    <div>
                      {ks.statusEmbedding}{ks.labelSuffix}
                      {searchConfig.status.embedding_configured
                        ? ks.embeddingConfigured
                        : ks.embeddingFallback}
                    </div>
                  </div>
                  {canEditSearch ? (
                    <Button
                      type="button"
                      variant="outline"
                      onClick={reindexSearch}
                      disabled={reindexing || !searchConfig.config.semantic_enabled}
                    >
                      {reindexing ? ks.reindexing : ks.reindexVector}
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
                  {ks.addMember}
                </Button>
              ) : null}
            </CardHeader>
            <CardContent className="space-y-4">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{ks.colUser}</TableHead>
                    <TableHead>{ks.colEmail}</TableHead>
                    <TableHead>{ks.colRole}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {members.map((m) => (
                    <TableRow key={m.user_id}>
                      <TableCell>{m.display_name}</TableCell>
                      <TableCell>{m.email}</TableCell>
                      <TableCell>{kbMemberRoleLabel(ks, m.role)}</TableCell>
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
          <Form {...generalForm}>
            <form className="space-y-4" onSubmit={generalForm.handleSubmit(saveGeneral)}>
              <DialogHeader>
                <DialogTitle>{t.menu.kbSettings.general}</DialogTitle>
                <DialogDescription>{ks.generalEditDesc}</DialogDescription>
              </DialogHeader>
              <div className="space-y-4 py-2">
                <FormField
                  control={generalForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ks.fields.name}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={generalForm.control}
                  name="description"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ks.fields.description}</FormLabel>
                      <FormControl>
                        <Input {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={generalForm.control}
                  name="visibility"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>{ks.fields.visibility}</FormLabel>
                      <FormControl>
                        <div className="native-select--full">
                          <NativeSelect value={field.value} onChange={field.onChange}>
                            <NativeSelectOption value="restricted">
                              {ks.visibilityLabels.restricted}
                            </NativeSelectOption>
                            <NativeSelectOption value="open">{ks.visibilityLabels.open}</NativeSelectOption>
                          </NativeSelect>
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setGeneralEditOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit">{t.common.save}</Button>
              </DialogFooter>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      {searchConfig ? (
        <Dialog open={searchEditOpen} onOpenChange={setSearchEditOpen}>
          <DialogContent className="sm:max-w-lg">
            <form className="space-y-5" onSubmit={saveSearchConfig}>
              <DialogHeader>
                <DialogTitle>{t.menu.kbSettings.search}</DialogTitle>
                <DialogDescription>{ks.searchEditDesc}</DialogDescription>
              </DialogHeader>
              <div className="max-h-[min(60vh,24rem)] space-y-5 overflow-y-auto py-2">
                <div className="space-y-2">
                  <Label>{ks.vectorStore}</Label>
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
                  <Label>{ks.embeddingModel}</Label>
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
                      <SelectItem value="__default__">{ks.defaultEmbeddingOption}</SelectItem>
                      {searchConfig.available.embedding_models
                        .filter((model) => model.enabled)
                        .map((model) => (
                          <SelectItem key={model.id} value={model.id}>
                            {model.display_name || model.model}
                          </SelectItem>
                        ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="search-keyword-enabled"
                      checked={searchConfig.config.keyword_enabled}
                      onCheckedChange={(checked) =>
                        setSearchConfig((current) =>
                          current
                            ? {
                                ...current,
                                config: {
                                  ...current.config,
                                  keyword_enabled: checked === true,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <Label htmlFor="search-keyword-enabled" className="cursor-pointer font-normal">
                      {ks.keywordSearch}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id="search-semantic-enabled"
                      checked={searchConfig.config.semantic_enabled}
                      onCheckedChange={(checked) =>
                        setSearchConfig((current) =>
                          current
                            ? {
                                ...current,
                                config: {
                                  ...current.config,
                                  semantic_enabled: checked === true,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <Label htmlFor="search-semantic-enabled" className="cursor-pointer font-normal">
                      {ks.semanticSearch}
                    </Label>
                  </div>
                  <div className="flex items-center gap-2 sm:col-span-2">
                    <Checkbox
                      id="search-auto-index"
                      checked={searchConfig.config.auto_index}
                      onCheckedChange={(checked) =>
                        setSearchConfig((current) =>
                          current
                            ? {
                                ...current,
                                config: {
                                  ...current.config,
                                  auto_index: checked === true,
                                },
                              }
                            : current,
                        )
                      }
                    />
                    <Label htmlFor="search-auto-index" className="cursor-pointer font-normal">
                      {ks.autoIndexOnUpload}
                    </Label>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>{ks.defaultSearchMode}</Label>
                  <Select
                    value={searchConfig.config.default_mode}
                    onValueChange={(value: SearchConfig['default_mode']) =>
                      setSearchConfig((current) =>
                        current
                          ? {
                              ...current,
                              config: { ...current.config, default_mode: value },
                            }
                          : current,
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="keyword">{ks.modeKeyword}</SelectItem>
                      <SelectItem value="semantic">{ks.modeSemantic}</SelectItem>
                      <SelectItem value="hybrid">{ks.modeHybrid}</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="outline" onClick={() => setSearchEditOpen(false)}>
                  {t.common.cancel}
                </Button>
                <Button type="submit">{t.common.save}</Button>
              </DialogFooter>
            </form>
          </DialogContent>
        </Dialog>
      ) : null}

      <Dialog open={memberAddOpen} onOpenChange={setMemberAddOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>{ks.addMemberTitle}</DialogTitle>
            <DialogDescription>{ks.addMemberDesc}</DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-2">
            <div className="space-y-2">
              <Label>{ks.colUser}</Label>
              <Select value={targetUser} onValueChange={setTargetUser}>
                <SelectTrigger>
                  <SelectValue placeholder={ks.selectUser} />
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
              <Label>{ks.role}</Label>
              <Select value={role} onValueChange={setRole}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="viewer">{ks.roleLabels.viewer}</SelectItem>
                  <SelectItem value="editor">{ks.roleLabels.editor}</SelectItem>
                  <SelectItem value="admin">{ks.roleLabels.admin}</SelectItem>
                  <SelectItem value="owner">{ks.roleLabels.owner}</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setMemberAddOpen(false)}>
              {t.common.cancel}
            </Button>
            <Button type="button" disabled={!targetUser || addingMember} onClick={() => void addMember()}>
              {addingMember ? t.common.processing : t.common.save}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </ConsolePageLayout>
  );
}
