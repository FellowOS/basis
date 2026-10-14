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

type IngestSource = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  webhook_path?: string;
  config?: {
    url?: string;
    sync_events?: { at: string; status: string; mode?: string; doc_id?: string }[];
    last_sync_at?: string;
    last_sync_status?: string;
  };
};

type CreateResponse = {
  source: IngestSource;
  ingest_token?: string;
  webhook_path?: string;
};

type SourceKind = 'webhook' | 'http_poll';

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
  const [createdSecret, setCreatedSecret] = useState<CreateResponse | null>(null);
  const [rotatedSecret, setRotatedSecret] = useState<CreateResponse | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<{ sources: IngestSource[] }>(`/api/kbs/${kbId}/sources`);
      setSources(data.sources);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '加载失败' : 'Load failed');
    } finally {
      setLoading(false);
    }
  }, [kbId, zh]);

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
        toast.success(zh ? '已创建 URL 拉取来源' : 'HTTP poll source created');
      }
      setName('');
      setPollUrl('');
      setPollIntervalMinutes('');
      await load();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '创建失败' : 'Create failed');
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
      toast.error(err instanceof Error ? err.message : zh ? '更新失败' : 'Update failed');
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
      toast.error(err instanceof Error ? err.message : zh ? '轮换失败' : 'Rotate failed');
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
      toast.error(err instanceof Error ? err.message : zh ? '同步失败' : 'Sync failed');
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
              ? 'Webhook 推送或 HTTP 拉取文本，进入资料与处理流水线。'
              : 'Webhook push or HTTP URL pull into documents and processing.'}
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
            <>
              <div className="space-y-2">
                <Label htmlFor="poll-url">URL</Label>
                <Input
                  id="poll-url"
                  value={pollUrl}
                  onChange={(e) => setPollUrl(e.target.value)}
                  placeholder="https://…"
                />
              </div>
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
            </>
          ) : null}
          <Button type="button" onClick={() => void createSource()} disabled={loading || !name.trim()}>
            {loading ? <Spinner className="size-4" /> : zh ? '创建' : 'Create'}
          </Button>
        </div>

        <div className="max-h-56 space-y-2 overflow-y-auto text-sm">
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
                      {last ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {zh ? '最近同步' : 'Last sync'}: {last.status} · {last.at}
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
                        <Button
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={!s.enabled || loading}
                          onClick={() => void runSync(s.id)}
                        >
                          {zh ? '立即拉取' : 'Sync now'}
                        </Button>
                      )}
                    </div>
                  </div>
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
