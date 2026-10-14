import { type FormEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/console-ui/index.js';
import { DataTable, type DataTableColumn } from '@/components/console-ui/DataTable.js';
import { PageHeader } from '@/components/console-ui/PageHeader.js';
import { Badge } from '@/components/ui/badge.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog.js';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu.js';
import { Input } from '@/components/ui/input.js';
import { Label } from '@/components/ui/label.js';
import { PublicIcon } from '@/components/ui/public-icon.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { Textarea } from '@/components/ui/textarea.js';
import { useI18n } from '@/i18n/context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useExplorerClient } from '@/lib/explorer-context.js';
import { KbIngestSourcesDialog } from '@/components/kb-ingest-sources-dialog.js';
import { kbPath } from '@/lib/nav-config.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { processingStartIdempotencyKey } from '@/lib/processing-idempotency.js';

const PAGE_SIZE = 10;

type DocRow = {
  doc_id: string;
  document_id?: string;
  preview: string;
  char_count: number;
  version_status?: string | null;
  version_id?: string | null;
  version_no?: number | null;
};

type ProcessingJob = {
  id: string;
  version_id: string;
  doc_id: string;
  document_title: string;
  status: string;
  version_status: string;
  attempt: number;
  error_code: string | null;
  options: Record<string, unknown>;
  created_at: string;
};

function versionStatusLabel(status: string | null | undefined, zh: boolean): string {
  const labels: Record<string, [string, string]> = {
    uploaded: ['待处理', 'Pending'],
    queued: ['排队中', 'Queued'],
    parsing: ['解析中', 'Parsing'],
    chunking: ['切分中', 'Chunking'],
    embedding: ['向量化中', 'Embedding'],
    extracting: ['抽取中', 'Extracting'],
    ready: ['就绪', 'Ready'],
    failed: ['失败', 'Failed'],
    stale: ['已归档', 'Stale'],
  };
  if (!status) return '—';
  return labels[status]?.[zh ? 0 : 1] ?? status;
}

function statusBadgeVariant(
  status: string | null | undefined,
): 'success' | 'destructive' | 'secondary' | 'warning' | 'outline' {
  switch (status) {
    case 'ready':
      return 'success';
    case 'failed':
      return 'destructive';
    case 'uploaded':
    case 'stale':
      return 'secondary';
    case 'queued':
    case 'parsing':
    case 'chunking':
    case 'embedding':
    case 'extracting':
      return 'warning';
    default:
      return 'outline';
  }
}

function docReadyForGraph(doc: DocRow, job?: ProcessingJob): boolean {
  if (doc.version_status === 'ready') return true;
  return job?.status === 'succeeded';
}

export function KnowledgePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const client = useExplorerClient();
  const { t, locale } = useI18n();
  const { getKb } = useKbCatalog();
  const { caps } = useKbCapabilities();
  const fileRef = useRef<HTMLInputElement>(null);
  const updateFileRef = useRef<HTMLInputElement>(null);
  const jobStatusRef = useRef<Record<string, string>>({});

  const [documents, setDocuments] = useState<DocRow[]>([]);
  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const [addOpen, setAddOpen] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  const [updateTarget, setUpdateTarget] = useState<{
    document_id: string;
    doc_id: string;
  } | null>(null);

  const [docId, setDocId] = useState('');
  const [docText, setDocText] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processImmediately, setProcessImmediately] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [configVersionId, setConfigVersionId] = useState(searchParams.get('version') ?? '');
  const [chunk, setChunk] = useState(true);
  const [chunkSize, setChunkSize] = useState(1800);
  const [chunkOverlap, setChunkOverlap] = useState(250);
  const [extract, setExtract] = useState(true);
  const [nerMethod, setNerMethod] = useState('pattern');
  const [relationMethod, setRelationMethod] = useState('pattern');
  const [extractRelations, setExtractRelations] = useState(true);
  const [extractTriplets, setExtractTriplets] = useState(false);

  const zh = locale === 'zh';
  const apiErrorMessage = useCallback(
    (err: unknown) => formatUserFacingApiError(err, zh ? 'zh' : 'en'),
    [zh],
  );
  const canEdit = caps?.graph_write !== false;
  const graphEnabled = caps?.graph === true;
  const kbName = id ? getKb(id)?.name : undefined;

  const graphFocusPath = useCallback(
    (docId: string) =>
      id ? `${kbPath(id, 'graph')}?focus=${encodeURIComponent(docId)}` : '#',
    [id],
  );

  const latestJobByVersion = useMemo(() => {
    const result: Record<string, ProcessingJob> = {};
    for (const job of jobs) {
      if (!result[job.version_id]) result[job.version_id] = job;
    }
    return result;
  }, [jobs]);

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return documents;
    return documents.filter(
      (doc) =>
        doc.doc_id.toLowerCase().includes(q) ||
        (doc.preview ?? '').toLowerCase().includes(q) ||
        (doc.document_id ?? '').toLowerCase().includes(q),
    );
  }, [documents, search]);

  const totalPages = Math.max(1, Math.ceil(filteredDocuments.length / PAGE_SIZE));

  const pageDocuments = useMemo(() => {
    const safePage = Math.min(page, totalPages);
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredDocuments.slice(start, start + PAGE_SIZE);
  }, [filteredDocuments, page, totalPages]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  const refresh = useCallback(async () => {
    if (!id) return;
    const [docs, taskData] = await Promise.all([
      client.documents.list(),
      client.processing.list(),
    ]);
    setDocuments(docs.documents as DocRow[]);
    setJobs(taskData.jobs as ProcessingJob[]);
  }, [id, client]);

  useEffect(() => {
    setLoading(true);
    void refresh()
      .catch((err) => toast.error(apiErrorMessage(err)))
      .finally(() => setLoading(false));
  }, [apiErrorMessage, refresh]);

  useEffect(() => {
    if (!jobs.some((job) => job.status === 'queued' || job.status === 'running')) return;
    const timer = window.setInterval(() => void refresh(), 2000);
    return () => window.clearInterval(timer);
  }, [jobs, refresh]);

  useEffect(() => {
    if (!id || !graphEnabled) return;
    for (const job of jobs) {
      const prev = jobStatusRef.current[job.id];
      jobStatusRef.current[job.id] = job.status;
      if (prev && prev !== 'succeeded' && job.status === 'succeeded' && job.doc_id) {
        const path = graphFocusPath(job.doc_id);
        toast.success(zh ? '处理完成' : 'Processing complete', {
          description: job.document_title || job.doc_id,
          action: {
            label: zh ? '在图谱中查看' : 'View in graph',
            onClick: () => navigate(path),
          },
        });
      }
    }
  }, [graphFocusPath, graphEnabled, id, jobs, navigate, zh]);

  useEffect(() => {
    const version = searchParams.get('version');
    if (version) setConfigVersionId(version);
  }, [searchParams]);

  function resetAddForm() {
    setDocId('');
    setDocText('');
    if (fileRef.current) fileRef.current.value = '';
  }

  function closeUpdate() {
    setUpdateTarget(null);
    setUpdateText('');
    if (updateFileRef.current) updateFileRef.current.value = '';
  }

  function openAdd() {
    resetAddForm();
    setAddOpen(true);
  }

  async function afterStore(
    created: { version_id: string; unchanged?: boolean },
    close: () => void,
  ) {
    if (created.unchanged) {
      toast.info(
        zh
          ? '内容与当前版本相同，未创建新版本。'
          : 'Content is unchanged; no new version was created.',
      );
      return;
    }
    if (processImmediately) {
      await client.processing.start({
        version_id: created.version_id,
        wait: false,
        idempotency_key: processingStartIdempotencyKey(created.version_id),
      });
      toast.success(zh ? '已保存并加入处理队列' : 'Saved and queued for processing');
    } else {
      toast.success(zh ? '已保存' : 'Saved');
    }
    close();
    await refresh();
  }

  async function saveText(event: FormEvent) {
    event.preventDefault();
    if (!id) return;
    setUploading(true);
    try {
      const created = await client.documents.ingestText({
        doc_id: docId.trim() || `text-${Date.now()}`,
        text: docText,
      });
      await afterStore(created, () => {
        resetAddForm();
        setAddOpen(false);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '保存失败' : 'Save failed');
    } finally {
      setUploading(false);
    }
  }

  async function uploadFile(event: FormEvent) {
    event.preventDefault();
    if (!id || !fileRef.current?.files?.[0]) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', fileRef.current.files[0]);
      if (docId.trim()) form.append('doc_id', docId.trim());
      const data = await client.documents.upload(form);
      await afterStore(data, () => {
        resetAddForm();
        setAddOpen(false);
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '上传失败' : 'Upload failed');
    } finally {
      setUploading(false);
    }
  }

  async function saveUpdateText(event: FormEvent) {
    event.preventDefault();
    if (!updateTarget?.document_id || !updateText.trim()) return;
    setUploading(true);
    try {
      const created = await client.documents.appendTextVersion(updateTarget.document_id, {
        text: updateText,
      });
      await afterStore(created, () => {
        setUpdateText('');
        closeUpdate();
      });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '更新失败' : 'Update failed');
    } finally {
      setUploading(false);
    }
  }

  async function uploadUpdateFile(event: FormEvent) {
    event.preventDefault();
    if (!updateTarget?.document_id || !updateFileRef.current?.files?.[0]) return;
    setUploading(true);
    try {
      const form = new FormData();
      form.append('file', updateFileRef.current.files[0]);
      const data = await client.documents.uploadVersion(updateTarget.document_id, form);
      await afterStore(data, () => closeUpdate());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : zh ? '更新失败' : 'Update failed');
    } finally {
      setUploading(false);
    }
  }

  async function startDefault(versionId: string) {
    setBusyVersionId(versionId);
    try {
      await client.processing.start({
        version_id: versionId,
        wait: false,
        idempotency_key: processingStartIdempotencyKey(versionId),
      });
      toast.success(zh ? '已加入处理队列' : 'Queued for processing');
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  async function startConfigured(event: FormEvent) {
    event.preventDefault();
    if (!configVersionId) return;
    setBusyVersionId(configVersionId);
    try {
      const processingOptions = {
        chunk,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        extract,
        ner_method: nerMethod,
        relation_method: relationMethod,
        extract_relations: extractRelations,
        extract_triplets: extractTriplets,
      };
      await client.processing.start({
        version_id: configVersionId,
        wait: false,
        ...processingOptions,
        idempotency_key: processingStartIdempotencyKey(configVersionId, processingOptions),
      });
      closeConfig();
      toast.success(zh ? '已按配置加入处理队列' : 'Queued with custom options');
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  async function retry(job: ProcessingJob) {
    setBusyVersionId(job.version_id);
    try {
      await client.processing.retry(job.id);
      toast.success(zh ? '已重试' : 'Retry queued');
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  function openConfig(versionId: string) {
    setConfigVersionId(versionId);
    const next = new URLSearchParams(searchParams);
    next.set('version', versionId);
    setSearchParams(next, { replace: true });
  }

  function closeConfig() {
    setConfigVersionId('');
    const next = new URLSearchParams(searchParams);
    next.delete('version');
    setSearchParams(next, { replace: true });
  }

  function openUpdate(doc: DocRow) {
    if (!doc.document_id) return;
    setUpdateText('');
    if (updateFileRef.current) updateFileRef.current.value = '';
    setUpdateTarget({ document_id: doc.document_id, doc_id: doc.doc_id });
  }

  const columns: DataTableColumn<DocRow>[] = useMemo(() => {
    const documentCol = zh ? '文档' : 'Document';
    const statusCol = zh ? '状态' : 'Status';
    const charsCol = zh ? '字数' : 'Chars';
    const previewCol = zh ? '预览' : 'Preview';
    const actionsCol = zh ? '操作' : 'Actions';

    return [
      {
        key: 'doc',
        header: documentCol,
        render: (doc) => (
          <div className="min-w-0">
            {id ? (
              <Link
                className="font-medium text-primary hover:underline"
                to={`${kbPath(id, 'sources')}?doc=${encodeURIComponent(doc.doc_id)}`}
              >
                {doc.doc_id}
              </Link>
            ) : (
              <span className="font-medium">{doc.doc_id}</span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {doc.version_no ? <span>v{doc.version_no}</span> : null}
              {doc.version_id ? (() => {
                const rowJob = latestJobByVersion[doc.version_id];
                if (!rowJob) return null;
                return (
                  <span>
                    attempt {rowJob.attempt}
                    {rowJob.error_code ? ` · ${rowJob.error_code}` : ''}
                  </span>
                );
              })() : null}
              {id && graphEnabled && docReadyForGraph(doc, doc.version_id ? latestJobByVersion[doc.version_id] : undefined) ? (
                <Link
                  className="text-primary hover:underline"
                  to={graphFocusPath(doc.doc_id)}
                >
                  {zh ? '图谱' : 'Graph'}
                </Link>
              ) : null}
            </div>
          </div>
        ),
      },
      {
        key: 'status',
        header: statusCol,
        width: '7rem',
        render: (doc) => {
          const job = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const status =
            job?.status === 'running' ? job.version_status : doc.version_status ?? job?.status;
          return (
            <Badge variant={statusBadgeVariant(status)}>
              {versionStatusLabel(status, zh)}
            </Badge>
          );
        },
      },
      {
        key: 'chars',
        header: charsCol,
        width: '5rem',
        hideBelow: 'md',
        render: (doc) => doc.char_count,
      },
      {
        key: 'preview',
        header: previewCol,
        hideBelow: 'lg',
        render: (doc) => (
          <span className="line-clamp-2 text-muted-foreground">{doc.preview || '—'}</span>
        ),
      },
      {
        key: 'actions',
        header: actionsCol,
        align: 'right',
        width: '5rem',
        render: (doc) => {
          const job = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const busy = busyVersionId === doc.version_id;
          const canProcess =
            canEdit && doc.version_id && doc.version_status === 'uploaded';
          const canRetry = canEdit && job?.status === 'failed';
          const canUpdate = canEdit && doc.document_id;
          const rowJob = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const canGraph =
            graphEnabled && docReadyForGraph(doc, rowJob);

          if (!canProcess && !canRetry && !canUpdate && !canGraph) {
            return <span className="text-muted-foreground">—</span>;
          }

          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type="button" variant="ghost" size="icon-sm" disabled={busy}>
                  <PublicIcon name="dot-horizontal" size={16} />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                {canProcess ? (
                  <>
                    <DropdownMenuItem onClick={() => void startDefault(doc.version_id!)}>
                      {zh ? '默认处理' : 'Process (defaults)'}
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openConfig(doc.version_id!)}>
                      {zh ? '配置并处理' : 'Configure & process'}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canRetry ? (
                  <DropdownMenuItem onClick={() => void retry(job!)}>
                    {zh ? '重试任务' : 'Retry job'}
                  </DropdownMenuItem>
                ) : null}
                {canUpdate ? (
                  <>
                    {canProcess || canRetry ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem onClick={() => openUpdate(doc)}>
                      {zh ? '更新内容' : 'Update content'}
                    </DropdownMenuItem>
                  </>
                ) : null}
                {canGraph && id ? (
                  <>
                    {canProcess || canRetry || canUpdate ? <DropdownMenuSeparator /> : null}
                    <DropdownMenuItem asChild>
                      <Link to={graphFocusPath(doc.doc_id)}>
                        {zh ? '在图谱中查看' : 'View in graph'}
                      </Link>
                    </DropdownMenuItem>
                  </>
                ) : null}
              </DropdownMenuContent>
            </DropdownMenu>
          );
        },
      },
    ];
  }, [
    zh,
    id,
    canEdit,
    busyVersionId,
    latestJobByVersion,
    startDefault,
    openConfig,
    retry,
    openUpdate,
    graphEnabled,
    graphFocusPath,
    latestJobByVersion,
  ]);

  const documentCountLabel = zh
    ? `共 ${filteredDocuments.length} 篇`
    : `${filteredDocuments.length} document${filteredDocuments.length === 1 ? '' : 's'}`;

  return (
    <div className="space-y-4">
      <PageHeader
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: kbName ?? id ?? '…', to: id ? kbPath(id, 'graph') : '/kbs' },
          { label: t.menu.kb.sources },
        ]}
      />

      <DataPanel>
        <DataPanelToolbar
          search={
            <ToolbarSearch
              className="w-full min-w-[12rem] max-w-md sm:w-72"
              placeholder={zh ? '搜索 doc_id 或预览…' : 'Search doc_id or preview…'}
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          }
          actions={
            <>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setHistoryOpen(true)}
          >
            {zh ? '任务历史' : 'Job history'}
          </Button>
          {canEdit ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSourcesOpen(true)}
            >
              {zh ? '连接器' : 'Sources'}
            </Button>
          ) : null}
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void refresh()}
            disabled={loading}
          >
            {loading ? <Spinner className="size-4" /> : null}
            {zh ? '刷新' : 'Refresh'}
          </Button>
          {canEdit ? (
            <Button type="button" size="sm" onClick={openAdd}>
              {zh ? '添加文档' : 'Add document'}
            </Button>
          ) : null}
            </>
          }
        />

        <DataPanelBody padded={false} className="mt-2">
          {loading && documents.length === 0 ? (
            <div className="flex justify-center py-16">
              <Spinner className="size-6" />
            </div>
          ) : filteredDocuments.length === 0 ? (
            <EmptyState
              title={zh ? '暂无文档' : 'No documents yet'}
              description={
                zh
                  ? '添加文件或粘贴文本作为来源，再启动处理任务。'
                  : 'Add a file or paste text, then start a processing job.'
              }
              action={
                canEdit ? (
                  <Button type="button" size="sm" onClick={openAdd}>
                    {zh ? '添加文档' : 'Add document'}
                  </Button>
                ) : undefined
              }
            />
          ) : (
            <>
              <DataTable
                columns={columns}
                data={pageDocuments}
                rowKey={(doc) => doc.document_id ?? doc.doc_id}
                className="border-0"
              />
              <DataPanelTableFooter
                countLabel={documentCountLabel}
                page={page}
                totalPages={totalPages}
                onPageChange={setPage}
              />
            </>
          )}
        </DataPanelBody>
      </DataPanel>

      <Dialog open={addOpen} onOpenChange={(open) => {
        setAddOpen(open);
        if (!open) resetAddForm();
      }}>
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{zh ? '添加文档' : 'Add document'}</DialogTitle>
            <DialogDescription>
              {zh
                ? '保存为来源（待处理）。可选 doc_id；重复 doc_id 将创建新版本。'
                : 'Store as a source (pending). Optional doc_id; reusing doc_id creates a new version.'}
            </DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                {zh ? '上传文件' : 'Upload file'}
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                {zh ? '粘贴文本' : 'Paste text'}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <form className="space-y-4 pt-2" onSubmit={uploadFile}>
                <div className="space-y-2">
                  <Label htmlFor="add-doc-id">doc_id（{zh ? '可选' : 'optional'}）</Label>
                  <Input
                    id="add-doc-id"
                    value={docId}
                    onChange={(event) => setDocId(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-file">{zh ? '文件' : 'File'}</Label>
                  <Input
                    id="add-file"
                    ref={fileRef}
                    type="file"
                    accept=".txt,.md,.pdf,.docx,.html,.json,.csv"
                    required
                  />
                </div>
                <DialogFooter className="px-0">
                  <Button type="submit" disabled={uploading}>
                    {uploading ? (zh ? '上传中…' : 'Uploading…') : zh ? '上传' : 'Upload'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="text">
              <form className="space-y-4 pt-2" onSubmit={saveText}>
                <div className="space-y-2">
                  <Label htmlFor="add-text-doc-id">doc_id（{zh ? '可选' : 'optional'}）</Label>
                  <Input
                    id="add-text-doc-id"
                    value={docId}
                    onChange={(event) => setDocId(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-text">{zh ? '文本' : 'Text'}</Label>
                  <Textarea
                    id="add-text"
                    rows={6}
                    value={docText}
                    onChange={(event) => setDocText(event.target.value)}
                    required
                  />
                </div>
                <DialogFooter className="px-0">
                  <Button type="submit" disabled={uploading}>
                    {zh ? '保存' : 'Save'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={processImmediately}
              onCheckedChange={(checked) => setProcessImmediately(checked === true)}
            />
            {zh ? '保存后立即使用默认方案处理' : 'Process immediately with defaults after save'}
          </label>
        </DialogContent>
      </Dialog>

      <Dialog
        open={updateTarget !== null}
        onOpenChange={(open) => {
          if (!open) closeUpdate();
        }}
      >
        <DialogContent className="sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{zh ? '更新文档' : 'Update document'}</DialogTitle>
            <DialogDescription>{updateTarget?.doc_id}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                {zh ? '新文件' : 'New file'}
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                {zh ? '新正文' : 'New text'}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <form className="space-y-4 pt-2" onSubmit={uploadUpdateFile}>
                <Input ref={updateFileRef} type="file" required />
                <DialogFooter className="px-0">
                  <Button type="submit" disabled={uploading}>
                    {uploading ? (zh ? '上传中…' : 'Uploading…') : zh ? '上传新版本' : 'Upload version'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="text">
              <form className="space-y-4 pt-2" onSubmit={saveUpdateText}>
                <Textarea
                  rows={6}
                  value={updateText}
                  onChange={(event) => setUpdateText(event.target.value)}
                  required
                />
                <DialogFooter className="px-0">
                  <Button type="submit" disabled={uploading || !updateText.trim()}>
                    {zh ? '保存新版本' : 'Save version'}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
          </Tabs>
          <label className="flex items-center gap-2 text-sm text-muted-foreground">
            <Checkbox
              checked={processImmediately}
              onCheckedChange={(checked) => setProcessImmediately(checked === true)}
            />
            {zh ? '新版本保存后立即处理' : 'Process new version immediately after save'}
          </label>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(configVersionId)} onOpenChange={(open) => !open && closeConfig()}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{zh ? '配置处理' : 'Configure processing'}</DialogTitle>
            <DialogDescription>
              {zh ? '选项将写入任务记录，处理时不可静默修改切分结果。' : 'Options are snapshotted on the job; chunk text cannot change silently.'}
            </DialogDescription>
          </DialogHeader>
          <form className="grid gap-4 sm:grid-cols-2" onSubmit={startConfigured}>
            <div className="space-y-2 sm:col-span-2">
              <Label>{zh ? '版本 ID' : 'Version ID'}</Label>
              <Input value={configVersionId} readOnly className="font-mono text-xs" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chunk-size">{zh ? '块大小' : 'Chunk size'}</Label>
              <Input
                id="chunk-size"
                type="number"
                min={200}
                max={100000}
                value={chunkSize}
                disabled={!chunk}
                onChange={(event) => setChunkSize(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="chunk-overlap">{zh ? '重叠' : 'Overlap'}</Label>
              <Input
                id="chunk-overlap"
                type="number"
                min={0}
                value={chunkOverlap}
                disabled={!chunk}
                onChange={(event) => setChunkOverlap(Number(event.target.value))}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ner-method">NER</Label>
              <Input
                id="ner-method"
                value={nerMethod}
                onChange={(event) => setNerMethod(event.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="relation-method">{zh ? '关系' : 'Relations'}</Label>
              <Input
                id="relation-method"
                value={relationMethod}
                onChange={(event) => setRelationMethod(event.target.value)}
              />
            </div>
            <div className="flex flex-col gap-3 text-sm sm:col-span-2">
              <label className="flex items-center gap-2">
                <Checkbox checked={chunk} onCheckedChange={(c) => setChunk(c === true)} />
                {zh ? '切分' : 'Chunk'}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox checked={extract} onCheckedChange={(c) => setExtract(c === true)} />
                {zh ? '抽取' : 'Extract'}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={extractRelations}
                  disabled={!extract}
                  onCheckedChange={(c) => setExtractRelations(c === true)}
                />
                {zh ? '关系' : 'Relations'}
              </label>
              <label className="flex items-center gap-2">
                <Checkbox
                  checked={extractTriplets}
                  disabled={!extract}
                  onCheckedChange={(c) => setExtractTriplets(c === true)}
                />
                {zh ? '三元组' : 'Triplets'}
              </label>
            </div>
            <DialogFooter className="sm:col-span-2">
              <Button type="button" variant="outline" onClick={closeConfig}>
                {zh ? '取消' : 'Cancel'}
              </Button>
              <Button type="submit" disabled={busyVersionId === configVersionId}>
                {zh ? '开始处理' : 'Start processing'}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{zh ? '处理任务历史' : 'Processing history'}</DialogTitle>
            <DialogDescription>
              {zh ? '每次处理尝试及快照选项。' : 'Each processing attempt and its option snapshot.'}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,24rem)] space-y-2 overflow-y-auto pr-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {zh ? '暂无任务' : 'No jobs yet'}
              </p>
            ) : (
              jobs.map((job) => (
                <details key={job.id} className="rounded-md border border-border p-3 text-sm">
                  <summary className="cursor-pointer font-medium">
                    {job.document_title || job.doc_id} · {job.status} · attempt {job.attempt}
                  </summary>
                  {graphEnabled && id && job.status === 'succeeded' && job.doc_id ? (
                    <div className="mt-2">
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link to={graphFocusPath(job.doc_id)}>
                          {zh ? '在图谱中查看' : 'View in graph'}
                        </Link>
                      </Button>
                    </div>
                  ) : null}
                  <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                    {JSON.stringify(job.options, null, 2)}
                  </pre>
                </details>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>

      {id ? (
        <KbIngestSourcesDialog
          kbId={id}
          open={sourcesOpen}
          onOpenChange={setSourcesOpen}
          zh={zh}
        />
      ) : null}
    </div>
  );
}
