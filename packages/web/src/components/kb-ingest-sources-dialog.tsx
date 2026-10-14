import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select.js';
import { Spinner } from '@/components/ui/spinner.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';

type IngestSource = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  webhook_path?: string;
  config?: {
    url?: string;
    repo_url?: string;
    branch?: string;
    paths?: string[];
    title?: string;
    external_key_prefix?: string;
    sync_events?: { at: string; status: string; mode?: string; doc_id?: string; error?: string }[];
    last_sync_at?: string;
    last_sync_status?: string;
  };
};

type CreateResponse = {
  source: IngestSource;
  ingest_token?: string;
  webhook_path?: string;
};

type SourceKind = 'webhook' | 'http_poll' | 'git';

export function KbIngestSourcesDialog({
  kbId,
  open,
  onOpenChange,
  zh,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  zh: boolean;
}) {
  const [loading, setLoading] = useState(false);
  const [sources, setSources] = useState<IngestSource[]>([]);
  const [name, setName] = useState('');
  const [kind, setKind] = useState<SourceKind>('webhook');
  const [pollUrl, setPollUrl] = useState('');
  const [pollIntervalMinutes, setPollIntervalMinutes] = useState('');
  const [gitRepoUrl, setGitRepoUrl] = useState('');
  const [gitBranch, setGitBranch] = useState('main');
  const [gitPaths, setGitPaths] = useState('');
  const [docTitle, setDocTitle] = useState('');
  const [externalKeyPrefix, setExternalKeyPrefix] = useState('');
  const [createdSecret, setCreatedSecret] = useState<CreateResponse | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<CreateResponse | null>(null);
  const [editingSyncId, setEditingSyncId] = useState<string | null>(null);
  const [editSyncTitle, setEditSyncTitle] = useState('');
  const [editSyncPrefix, setEditSyncPrefix] = useState('');

  const apiError = useCallback(
    (err: unknown) => formatUserFacingApiError(err, zh ? 'zh' : 'en'),
    [zh],
  );

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ sources: IngestSource[] }>(`/api/kbs/${kbId}/sources`);
      setSources(data.sources);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  }, [apiError, kbId]);

  useEffect(() => {
    if (open) {
      setCreatedSecret(null);
      setRotatedSecret(null);
      void load();
    }
  }, [open, load]);

  const createSource = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (kind === 'http_poll' && !pollUrl.trim().startsWith('http')) {
      toast.error(zh ? '请输入有效的 URL' : 'Enter a valid URL');
      return;
    }
    if (kind === 'git') {
      if (!gitRepoUrl.trim().includes('github.com')) {
        toast.error(zh ? '请输入 GitHub 仓库 HTTPS URL' : 'Enter a GitHub HTTPS repo URL');
        return;
      }
      if (!gitPaths.trim()) {
        toast.error(zh ? '请输入至少一个文件路径' : 'Enter at least one file path');
        return;
      }
    }
    const syncExtras: Record<string, string> = {};
    const titleTrim = docTitle.trim();
    const prefixTrim = externalKeyPrefix.trim();
    if (titleTrim) syncExtras.title = titleTrim;
    if (prefixTrim) syncExtras.external_key_prefix = prefixTrim;

    setLoading(true);
    try {
      const data = await api<CreateResponse>(`/api/kbs/${kbId}/sources`, {
        method: 'POST',
        body: JSON.stringify({
          kind,
          name: trimmed,
          config:
            kind === 'http_poll'
              ? {
                  url: pollUrl.trim(),
                  ...syncExtras,
                  ...(pollIntervalMinutes.trim()
                    ? { poll_interval_minutes: Number(pollIntervalMinutes) }
                    : {}),
                }
              : kind === 'git'
                ? {
                    repo_url: gitRepoUrl.trim(),
                    branch: gitBranch.trim() || 'main',
                    paths: gitPaths
                      .split(/[\n,]+/)
                      .map((p) => p.trim())
                      .filter(Boolean),
                    ...syncExtras,
                    ...(pollIntervalMinutes.trim()
                      ? { poll_interval_minutes: Number(pollIntervalMinutes) }
                      : {}),
                  }
                : {},
        }),
      });
      if (data.ingest_token) {
        setCreatedSecret(data);
      } else {
        toast.success(
          kind === 'git'
            ? zh
              ? '已创建 Git 来源'
              : 'Git source created'
            : zh
              ? '已创建 URL 拉取来源'
              : 'HTTP poll source created',
        );
      }
      setName('');
      setPollUrl('');
      setPollIntervalMinutes('');
      setGitRepoUrl('');
      setGitBranch('main');
      setGitPaths('');
      setDocTitle('');
      setExternalKeyPrefix('');
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const toggleEnabled = async (source: IngestSource) => {
    try {
      await api(`/api/kbs/${kbId}/sources/${source.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ enabled: !source.enabled }),
      });
      await load();
    } catch (err) {
      toast.error(apiError(err));
    }
  };

  const rotateToken = async (sourceId: string) => {
    setLoading(true);
    try {
      const data = await api<CreateResponse>(`/api/kbs/${kbId}/sources/${sourceId}/rotate-token`, {
        method: 'POST',
      });
      setRotatedSecret({
        ...data,
        source: { id: sourceId, kind: 'webhook', name: '', enabled: true },
      });
      toast.success(zh ? '已轮换令牌' : 'Token rotated');
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const beginEditSyncOptions = (source: IngestSource) => {
    setEditingSyncId(source.id);
    setEditSyncTitle(source.config?.title ?? '');
    setEditSyncPrefix(source.config?.external_key_prefix ?? '');
  };

  const cancelEditSyncOptions = () => {
    setEditingSyncId(null);
  };

  const saveSyncOptions = async (sourceId: string) => {
    setLoading(true);
    try {
      await api(`/api/kbs/${kbId}/sources/${sourceId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          config: {
            title: editSyncTitle.trim(),
            external_key_prefix: editSyncPrefix.trim(),
          },
        }),
      });
      toast.success(zh ? '已保存同步选项' : 'Sync options saved');
      setEditingSyncId(null);
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const runSync = async (sourceId: string) => {
    setLoading(true);
    try {
      await api(`/api/kbs/${kbId}/sources/${sourceId}/sync`, { method: 'POST', body: '{}' });
      toast.success(zh ? '已拉取并入队处理' : 'Fetched and queued');
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const secretBlock = createdSecret?.ingest_token
    ? createdSecret
    : rotatedSecret?.ingest_token
      ? rotatedSecret
      : null;

  const webhookUrl = secretBlock?.webhook_path
    ? `${window.location.origin}${secretBlock.webhook_path}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{zh ? '摄入来源（连接器）' : 'Ingest sources'}</DialogTitle>
          <DialogDescription>
            {zh
              ? 'Webhook、HTTP 或 GitHub 文件拉取，进入资料与处理流水线。'
              : 'Webhook, HTTP URL, or GitHub file pull into documents and processing.'}
          </DialogDescription>
        </DialogHeader>

        {secretBlock?.ingest_token ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{zh ? '请保存令牌（仅显示一次）' : 'Save token (shown once)'}</p>
            <div>
              <Label className="text-xs text-muted-foreground">URL</Label>
              <p className="break-all font-mono text-xs">{webhookUrl}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Authorization</Label>
              <p className="break-all font-mono text-xs">Bearer {secretBlock.ingest_token}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-3">
          <div className="space-y-2">
            <Label>{zh ? '类型' : 'Kind'}</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="webhook">Webhook</SelectItem>
                <SelectItem value="http_poll">{zh ? 'HTTP 拉取' : 'HTTP poll'}</SelectItem>
                <SelectItem value="git">{zh ? 'Git（GitHub）' : 'Git (GitHub)'}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="source-name">{zh ? '名称' : 'Name'}</Label>
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={zh ? '例如：工单系统' : 'e.g. Ticket system'}
            />
          </div>
          {kind === 'http_poll' ? (
            <div className="space-y-2">
              <Label htmlFor="poll-url">URL</Label>
              <Input
                id="poll-url"
                value={pollUrl}
                onChange={(e) => setPollUrl(e.target.value)}
                placeholder="https://…"
              />
            </div>
          ) : null}
          {kind === 'git' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="git-repo">{zh ? '仓库 URL' : 'Repository URL'}</Label>
                <Input
                  id="git-repo"
                  value={gitRepoUrl}
                  onChange={(e) => setGitRepoUrl(e.target.value)}
                  placeholder="https://github.com/org/repo"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git-branch">{zh ? '分支' : 'Branch'}</Label>
                <Input
                  id="git-branch"
                  value={gitBranch}
                  onChange={(e) => setGitBranch(e.target.value)}
                  placeholder="main"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="git-paths">{zh ? '文件路径（逗号或换行）' : 'File paths (comma or newline)'}</Label>
                <Input
                  id="git-paths"
                  value={gitPaths}
                  onChange={(e) => setGitPaths(e.target.value)}
                  placeholder="README.md, docs/guide.md"
                />
              </div>
            </>
          ) : null}
          {kind === 'http_poll' || kind === 'git' ? (
            <>
              <div className="space-y-2">
                <Label htmlFor="sync-doc-title">
                  {zh ? '同步资料标题（可选）' : 'Document title on sync (optional)'}
                </Label>
                <Input
                  id="sync-doc-title"
                  value={docTitle}
                  onChange={(e) => setDocTitle(e.target.value)}
                  placeholder={zh ? '留空则使用来源名称' : 'Leave empty to use source name'}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="sync-doc-prefix">
                  {zh ? 'doc_id 前缀（可选）' : 'doc_id prefix (optional)'}
                </Label>
                <Input
                  id="sync-doc-prefix"
                  value={externalKeyPrefix}
                  onChange={(e) => setExternalKeyPrefix(e.target.value)}
                  placeholder={kind === 'git' ? 'git' : 'poll'}
                />
                <p className="text-[10px] text-muted-foreground">
                  {zh
                    ? '每次同步新建一篇资料，ID 形如「前缀-随机串」。Webhook 请在请求体里用 external_key。'
                    : 'Each sync creates a new document as «prefix-random». For webhooks use external_key in the POST body.'}
                </p>
              </div>
            </>
          ) : null}
          {kind === 'http_poll' || kind === 'git' ? (
            <div className="space-y-2">
              <Label htmlFor="poll-interval">
                {zh ? '自动拉取间隔（分钟，0=仅手动）' : 'Auto poll interval (minutes, 0=manual)'}
              </Label>
              <Input
                id="poll-interval"
                type="number"
                min={0}
                value={pollIntervalMinutes}
                onChange={(e) => setPollIntervalMinutes(e.target.value)}
                placeholder="0"
              />
              <p className="text-[10px] text-muted-foreground">
                {zh
                  ? '服务端需设置 SEMA_HTTP_POLL_TICK_SECONDS>0 才会定时执行。'
                  : 'Set SEMA_HTTP_POLL_TICK_SECONDS>0 on the server to enable scheduling.'}
              </p>
            </div>
          ) : null}
          <Button type="button" onClick={() => void createSource()} disabled={loading || !name.trim()}>
            {loading ? <Spinner className="size-4" /> : zh ? '创建' : 'Create'}
          </Button>
        </div>

        <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {loading && sources.length === 0 ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-4" />
            </div>
          ) : sources.length === 0 ? (
            <p className="text-muted-foreground">{zh ? '暂无来源' : 'No sources yet'}</p>
          ) : (
            sources.map((s) => {
              const last = s.config?.sync_events?.[0];
              return (
                <div key={s.id} className="space-y-2 rounded border border-border px-3 py-2">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.kind}
                        {!s.enabled ? (zh ? ' · 已停用' : ' · disabled') : ''}
                      </div>
                      {s.kind === 'webhook' && s.webhook_path ? (
                        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">
                          {window.location.origin}
                          {s.webhook_path}
                        </p>
                      ) : null}
                      {s.kind === 'http_poll' && s.config?.url ? (
                        <p className="mt-1 break-all text-[10px] text-muted-foreground">{s.config.url}</p>
                      ) : null}
                      {s.kind === 'git' && s.config?.repo_url ? (
                        <p className="mt-1 break-all text-[10px] text-muted-foreground">
                          {s.config.repo_url}
                          {s.config.branch ? `@${s.config.branch}` : ''}
                          {s.config.paths?.length ? ` · ${s.config.paths.join(', ')}` : ''}
                        </p>
                      ) : null}
                      {(s.kind === 'http_poll' || s.kind === 'git') &&
                      editingSyncId !== s.id &&
                      (s.config?.title || s.config?.external_key_prefix) ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {s.config.title ? (
                            <span>
                              {zh ? '标题' : 'Title'}: {s.config.title}
                            </span>
                          ) : null}
                          {s.config.title && s.config.external_key_prefix ? ' · ' : null}
                          {s.config.external_key_prefix ? (
                            <span>
                              {zh ? '前缀' : 'Prefix'}: {s.config.external_key_prefix}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      {last ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {zh ? '最近同步' : 'Last sync'}: {last.status} · {last.at}
                          {last.error ? ` · ${last.error}` : ''}
                        </p>
                      ) : null}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => void toggleEnabled(s)}>
                        {s.enabled ? (zh ? '停用' : 'Disable') : zh ? '启用' : 'Enable'}
                      </Button>
                      {s.kind === 'webhook' ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void rotateToken(s.id)}>
                          {zh ? '轮换令牌' : 'Rotate token'}
                        </Button>
                      ) : (
                        <>
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            disabled={!s.enabled || loading}
                            onClick={() => void runSync(s.id)}
                          >
                            {zh ? '立即拉取' : 'Sync now'}
                          </Button>
                          {editingSyncId === s.id ? (
                            <>
                              <Button
                                type="button"
                                variant="secondary"
                                size="sm"
                                disabled={loading}
                                onClick={() => void saveSyncOptions(s.id)}
                              >
                                {zh ? '保存' : 'Save'}
                              </Button>
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={cancelEditSyncOptions}
                              >
                                {zh ? '取消' : 'Cancel'}
                              </Button>
                            </>
                          ) : (
                            <Button
                              type="button"
                              variant="ghost"
                              size="sm"
                              onClick={() => beginEditSyncOptions(s)}
                            >
                              {zh ? '同步选项' : 'Sync options'}
                            </Button>
                          )}
                        </>
                      )}
                    </div>
                  </div>
                  {(s.kind === 'http_poll' || s.kind === 'git') && editingSyncId === s.id ? (
                    <div className="grid gap-2 border-t border-border pt-2">
                      <div className="space-y-1">
                        <Label className="text-xs">{zh ? '同步资料标题' : 'Document title'}</Label>
                        <Input
                          value={editSyncTitle}
                          onChange={(e) => setEditSyncTitle(e.target.value)}
                          placeholder={zh ? '留空则使用来源名称' : 'Empty = source name'}
                          className="h-8 text-xs"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs">{zh ? 'doc_id 前缀' : 'doc_id prefix'}</Label>
                        <Input
                          value={editSyncPrefix}
                          onChange={(e) => setEditSyncPrefix(e.target.value)}
                          placeholder={s.kind === 'git' ? 'git' : 'poll'}
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {zh ? '关闭' : 'Close'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
