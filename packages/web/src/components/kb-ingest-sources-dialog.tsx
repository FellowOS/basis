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
import { Spinner } from '@/components/ui/spinner.js';
import { api } from '@/lib/api.js';

type IngestSource = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
};

type CreateResponse = {
  source: IngestSource;
  ingest_token?: string;
  webhook_path?: string;
};

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
  const [createdSecret, setCreatedSecret] = useState<CreateResponse | null>(null);

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
      void load();
    }
  }, [open, load]);

  const createWebhook = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    setLoading(true);
    try {
      const data = await api<CreateResponse>(`/api/kbs/${kbId}/sources`, {
        method: 'POST',
        body: JSON.stringify({ kind: 'webhook', name: trimmed }),
      });
      setCreatedSecret(data);
      setName('');
      await load();
      toast.success(zh ? '已创建 Webhook 来源' : 'Webhook source created');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '创建失败' : 'Create failed');
    } finally {
      setLoading(false);
    }
  };

  const webhookUrl = createdSecret?.webhook_path
    ? `${window.location.origin}${createdSecret.webhook_path}`
    : null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{zh ? '摄入来源（连接器）' : 'Ingest sources'}</DialogTitle>
          <DialogDescription>
            {zh
              ? 'Webhook 可在无登录的情况下推送文本，并自动进入处理队列。'
              : 'Webhooks push text without a user session and enqueue processing.'}
          </DialogDescription>
        </DialogHeader>

        {createdSecret?.ingest_token ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{zh ? '请保存以下信息（仅显示一次）' : 'Save these credentials (shown once)'}</p>
            <div>
              <Label className="text-xs text-muted-foreground">URL</Label>
              <p className="break-all font-mono text-xs">{webhookUrl}</p>
            </div>
            <div>
              <Label className="text-xs text-muted-foreground">Authorization</Label>
              <p className="break-all font-mono text-xs">Bearer {createdSecret.ingest_token}</p>
            </div>
          </div>
        ) : null}

        <div className="space-y-2">
          <Label htmlFor="source-name">{zh ? '新建 Webhook' : 'New webhook'}</Label>
          <div className="flex gap-2">
            <Input
              id="source-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={zh ? '例如：工单系统' : 'e.g. Ticket system'}
            />
            <Button type="button" onClick={() => void createWebhook()} disabled={loading || !name.trim()}>
              {loading ? <Spinner className="size-4" /> : zh ? '创建' : 'Create'}
            </Button>
          </div>
        </div>

        <div className="max-h-48 space-y-2 overflow-y-auto text-sm">
          {loading && sources.length === 0 ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-4" />
            </div>
          ) : sources.length === 0 ? (
            <p className="text-muted-foreground">{zh ? '暂无来源' : 'No sources yet'}</p>
          ) : (
            sources.map((s) => (
              <div key={s.id} className="flex items-center justify-between rounded border border-border px-3 py-2">
                <span>{s.name}</span>
                <span className="text-xs text-muted-foreground">
                  {s.kind}
                  {!s.enabled ? (zh ? ' · 已停用' : ' · disabled') : ''}
                </span>
              </div>
            ))
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
