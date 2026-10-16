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
import { useI18n } from '@/i18n/context.js';
import { fmt } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import { api } from '@/lib/api.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { cn } from '@/lib/utils.js';

type SyncEvent = {
  at: string;
  status: string;
  mode?: string;
  doc_id?: string;
  error?: string;
};

type IngestSourceConfig = {
  url?: string;
  repo_url?: string;
  branch?: string;
  paths?: string[];
  title?: string;
  external_key_prefix?: string;
  sync_events?: SyncEvent[];
  last_sync_at?: string;
  last_sync_status?: string;
};

type IngestSource = {
  id: string;
  kind: string;
  name: string;
  enabled: boolean;
  webhook_path?: string;
  config?: IngestSourceConfig;
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
  focusSourceId,
}: {
  kbId: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  focusSourceId?: string;
}) {
  const { t, locale } = useI18n();
  const i = t.kbIngestSources;
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
  const [createOpen, setCreateOpen] = useState(false);
  const [syncOptionsSourceId, setSyncOptionsSourceId] = useState<string | null>(null);
  const [editSyncTitle, setEditSyncTitle] = useState('');
  const [editSyncPrefix, setEditSyncPrefix] = useState('');
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [syncHistory, setSyncHistory] = useState<
    Record<string, { events: SyncEvent[]; loading?: boolean }>
  >({});
  const [highlightSourceId, setHighlightSourceId] = useState<string | null>(null);

  const apiError = useCallback(
    (err: unknown) => formatUserFacingApiError(err, locale as Locale),
    [locale],
  );

  const copyText = useCallback(
    async (text: string, okMessage: string) => {
      try {
        await navigator.clipboard.writeText(text);
        toast.success(okMessage);
      } catch {
        toast.error(i.copyFailed);
      }
    },
    [i.copyFailed],
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

  const resetCreateForm = () => {
    setName('');
    setKind('webhook');
    setPollUrl('');
    setPollIntervalMinutes('');
    setGitRepoUrl('');
    setGitBranch('main');
    setGitPaths('');
    setDocTitle('');
    setExternalKeyPrefix('');
  };

  const openCreateDialog = () => {
    resetCreateForm();
    setCreateOpen(true);
  };

  const createSource = async () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    if (kind === 'http_poll' && !pollUrl.trim().startsWith('http')) {
      toast.error(i.enterValidUrl);
      return;
    }
    if (kind === 'git') {
      if (!gitRepoUrl.trim().includes('github.com')) {
        toast.error(i.enterGithubRepoUrl);
        return;
      }
      if (!gitPaths.trim()) {
        toast.error(i.enterFilePaths);
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
        toast.success(kind === 'git' ? i.gitSourceCreated : i.httpPollSourceCreated);
      }
      resetCreateForm();
      setCreateOpen(false);
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
      toast.success(i.tokenRotated);
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const openSyncOptionsDialog = (source: IngestSource) => {
    setSyncOptionsSourceId(source.id);
    setEditSyncTitle(source.config?.title ?? '');
    setEditSyncPrefix(source.config?.external_key_prefix ?? '');
  };

  const closeSyncOptionsDialog = () => {
    setSyncOptionsSourceId(null);
  };

  const saveSyncOptions = async () => {
    const sourceId = syncOptionsSourceId;
    if (!sourceId) return;
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
      toast.success(i.syncOptionsSaved);
      closeSyncOptionsDialog();
      await load();
    } catch (err) {
      toast.error(apiError(err));
    } finally {
      setLoading(false);
    }
  };

  const loadSyncHistory = async (sourceId: string) => {
    setSyncHistory((prev) => ({ ...prev, [sourceId]: { ...prev[sourceId], loading: true, events: [] } }));
    try {
      const data = await api<{ events: SyncEvent[] }>(
        `/api/kbs/${kbId}/sources/${sourceId}/sync-history`,
      );
      setSyncHistory((prev) => ({ ...prev, [sourceId]: { loading: false, events: data.events ?? [] } }));
    } catch (err) {
      toast.error(apiError(err));
      setSyncHistory((prev) => ({ ...prev, [sourceId]: { loading: false, events: [] } }));
    }
  };

  const toggleSyncHistory = (sourceId: string) => {
    if (expandedHistoryId === sourceId) {
      setExpandedHistoryId(null);
      return;
    }
    setExpandedHistoryId(sourceId);
    void loadSyncHistory(sourceId);
  };

  useEffect(() => {
    if (!open || !focusSourceId || loading) {
      return;
    }
    const source = sources.find((s) => s.id === focusSourceId);
    if (!source) {
      return;
    }
    if (source.kind === 'http_poll' || source.kind === 'git') {
      setExpandedHistoryId(focusSourceId);
      void loadSyncHistory(focusSourceId);
    }
    setHighlightSourceId(focusSourceId);
    const timer = window.setTimeout(() => {
      document.getElementById(`ingest-source-${focusSourceId}`)?.scrollIntoView({
        block: 'nearest',
        behavior: 'smooth',
      });
    }, 0);
    const clearHighlight = window.setTimeout(() => setHighlightSourceId(null), 4000);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(clearHighlight);
    };
  }, [focusSourceId, loading, open, sources]);

  const runSync = async (sourceId: string) => {
    setLoading(true);
    try {
      await api(`/api/kbs/${kbId}/sources/${sourceId}/sync`, { method: 'POST', body: '{}' });
      toast.success(i.fetchedAndQueued);
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

  const syncOptionsSource =
    syncOptionsSourceId != null ? sources.find((s) => s.id === syncOptionsSourceId) : undefined;

  const createFormFields = (
    <div className="space-y-3">
      <div className="space-y-2">
        <Label>{i.kind}</Label>
        <Select value={kind} onValueChange={(v) => setKind(v as SourceKind)}>
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="webhook">Webhook</SelectItem>
            <SelectItem value="http_poll">{i.httpPoll}</SelectItem>
            <SelectItem value="git">{i.gitGithub}</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div className="space-y-2">
        <Label htmlFor="source-name">{i.name}</Label>
        <Input
          id="source-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={i.namePlaceholder}
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
            <Label htmlFor="git-repo">{i.repositoryUrl}</Label>
            <Input
              id="git-repo"
              value={gitRepoUrl}
              onChange={(e) => setGitRepoUrl(e.target.value)}
              placeholder="https://github.com/org/repo"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-branch">{i.branch}</Label>
            <Input
              id="git-branch"
              value={gitBranch}
              onChange={(e) => setGitBranch(e.target.value)}
              placeholder="main"
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="git-paths">
              {i.filePaths}
            </Label>
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
              {i.syncDocTitleOptional}
            </Label>
            <Input
              id="sync-doc-title"
              value={docTitle}
              onChange={(e) => setDocTitle(e.target.value)}
              placeholder={i.emptyUsesSourceName}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="sync-doc-prefix">
              {i.docIdPrefixOptional}
            </Label>
            <Input
              id="sync-doc-prefix"
              value={externalKeyPrefix}
              onChange={(e) => setExternalKeyPrefix(e.target.value)}
              placeholder={kind === 'git' ? 'git' : 'poll'}
            />
            <p className="text-[10px] text-muted-foreground">{i.prefixHint}</p>
          </div>
        </>
      ) : null}
      {kind === 'http_poll' || kind === 'git' ? (
        <div className="space-y-2">
          <Label htmlFor="poll-interval">
            {i.pollInterval}
          </Label>
          <Input
            id="poll-interval"
            type="number"
            min={0}
            value={pollIntervalMinutes}
            onChange={(e) => setPollIntervalMinutes(e.target.value)}
            placeholder="0"
          />
          <p className="text-[10px] text-muted-foreground">{i.pollTickHint}</p>
        </div>
      ) : null}
    </div>
  );

  return (
    <>
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{i.dialogTitle}</DialogTitle>
          <DialogDescription>{i.dialogDesc}</DialogDescription>
        </DialogHeader>

        {secretBlock?.ingest_token ? (
          <div className="space-y-2 rounded-md border border-border bg-muted/40 p-3 text-sm">
            <p className="font-medium">{i.saveTokenOnce}</p>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground">URL</Label>
                <p className="break-all font-mono text-xs">{webhookUrl}</p>
              </div>
              {webhookUrl ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="shrink-0 text-xs"
                  onClick={() =>
                    void copyText(webhookUrl, i.webhookUrlCopied)
                  }
                >
                  {t.common.copy}
                </Button>
              ) : null}
            </div>
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <Label className="text-xs text-muted-foreground">Authorization</Label>
                <p className="break-all font-mono text-xs">Bearer {secretBlock.ingest_token}</p>
              </div>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="shrink-0 text-xs"
                onClick={() =>
                  void copyText(
                    `Bearer ${secretBlock.ingest_token}`,
                    i.authorizationCopied,
                  )
                }
              >
                {t.common.copy}
              </Button>
            </div>
          </div>
        ) : null}

        <div className="max-h-72 space-y-2 overflow-y-auto text-sm">
          {loading && sources.length === 0 ? (
            <div className="flex justify-center py-4">
              <Spinner className="size-4" />
            </div>
          ) : sources.length === 0 ? (
            <p className="text-muted-foreground">{i.noSources}</p>
          ) : (
            sources.map((s) => {
              const last = s.config?.sync_events?.[0];
              return (
                <div
                  key={s.id}
                  id={`ingest-source-${s.id}`}
                  className={cn(
                    'space-y-2 rounded border border-border px-3 py-2',
                    highlightSourceId === s.id && 'ring-2 ring-primary ring-offset-2 ring-offset-background',
                  )}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="font-medium">{s.name}</div>
                      <div className="text-xs text-muted-foreground">
                        {s.kind}
                        {!s.enabled ? i.disabledSuffix : ''}
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
                      (s.config?.title || s.config?.external_key_prefix) ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {s.config.title ? (
                            <span>
                              {i.titleLabel}: {s.config.title}
                            </span>
                          ) : null}
                          {s.config.title && s.config.external_key_prefix ? ' · ' : null}
                          {s.config.external_key_prefix ? (
                            <span>
                              {i.prefixLabel}: {s.config.external_key_prefix}
                            </span>
                          ) : null}
                        </p>
                      ) : null}
                      {last ? (
                        <p className="mt-1 text-[10px] text-muted-foreground">
                          {i.lastSync}: {last.status} · {last.at}
                          {last.error ? ` · ${last.error}` : ''}
                        </p>
                      ) : null}
                      {(s.kind === 'http_poll' || s.kind === 'git') && (
                        <Button
                          type="button"
                          variant="link"
                          className="h-auto p-0 text-[10px]"
                          onClick={() => toggleSyncHistory(s.id)}
                        >
                          {expandedHistoryId === s.id ? i.hideSyncHistory : i.viewSyncHistory}
                        </Button>
                      )}
                    </div>
                    <div className="flex shrink-0 flex-col gap-1">
                      <Button type="button" variant="outline" size="sm" onClick={() => void toggleEnabled(s)}>
                        {s.enabled ? i.disable : i.enable}
                      </Button>
                      {s.kind === 'webhook' ? (
                        <Button type="button" variant="outline" size="sm" onClick={() => void rotateToken(s.id)}>
                          {i.rotateToken}
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
                            {i.syncNow}
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="sm"
                            onClick={() => openSyncOptionsDialog(s)}
                          >
                            {i.syncOptions}
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  {expandedHistoryId === s.id && (s.kind === 'http_poll' || s.kind === 'git') ? (
                    <div className="border-t border-border pt-2 text-[10px] text-muted-foreground">
                      {syncHistory[s.id]?.loading ? (
                        <div className="flex justify-center py-2">
                          <Spinner className="size-3" />
                        </div>
                      ) : (syncHistory[s.id]?.events?.length ?? 0) === 0 ? (
                        <p>{i.noSyncRuns}</p>
                      ) : (
                        <ul className="max-h-32 space-y-1 overflow-y-auto font-mono">
                          {(syncHistory[s.id]?.events ?? []).map((ev: SyncEvent, idx: number) => (
                            <li key={`${ev.at}-${idx}`}>
                              {ev.at} · {ev.status}
                              {ev.mode ? ` · ${ev.mode}` : ''}
                              {ev.doc_id ? ` · ${ev.doc_id}` : ''}
                              {ev.error ? ` · ${ev.error}` : ''}
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  ) : null}
                </div>
              );
            })
          )}
        </div>

        <DialogFooter className="gap-2 sm:justify-between">
          <Button type="button" onClick={openCreateDialog} disabled={loading}>
            {i.addSource}
          </Button>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            {i.close}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog open={createOpen} onOpenChange={setCreateOpen}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>{i.addDialogTitle}</DialogTitle>
          <DialogDescription>
            {i.addDialogDesc}
          </DialogDescription>
        </DialogHeader>
        {createFormFields}
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setCreateOpen(false)}>
            {t.common.cancel}
          </Button>
          <Button type="button" onClick={() => void createSource()} disabled={loading || !name.trim()}>
            {loading ? <Spinner className="size-4" /> : i.create}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>

    <Dialog
      open={syncOptionsSourceId != null}
      onOpenChange={(next) => {
        if (!next) closeSyncOptionsDialog();
      }}
    >
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{i.syncOptions}</DialogTitle>
          <DialogDescription>
            {syncOptionsSource?.name
              ? fmt(i.syncOptionsSource, { name: syncOptionsSource.name })
              : null}
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3">
          <div className="space-y-2">
            <Label>{i.syncDocTitle}</Label>
            <Input
              value={editSyncTitle}
              onChange={(e) => setEditSyncTitle(e.target.value)}
              placeholder={i.emptySourceName}
            />
          </div>
          <div className="space-y-2">
            <Label>{i.docIdPrefix}</Label>
            <Input
              value={editSyncPrefix}
              onChange={(e) => setEditSyncPrefix(e.target.value)}
              placeholder={syncOptionsSource?.kind === 'git' ? 'git' : 'poll'}
            />
          </div>
        </div>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={closeSyncOptionsDialog}>
            {t.common.cancel}
          </Button>
          <Button type="button" disabled={loading} onClick={() => void saveSyncOptions()}>
            {loading ? <Spinner className="size-4" /> : t.common.save}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
