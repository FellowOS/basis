/**
 * Sources library UI (upload, processing, document table).
 * Routed at `/kbs/:id/sources` via `kb-library-workspace`; legacy `/kbs/:id/knowledge` redirects here.
 */
import { type FormEvent, type ReactNode, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import {
  DataPanel,
  DataPanelBody,
  DataPanelTableFooter,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { DataTable, type DataTableColumn } from '@/components/app/shared/console/DataTable.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Button } from '@/components/ui/button.js';
import { Checkbox } from '@/components/ui/checkbox.js';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog.js';
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
import { Switch } from '@/components/ui/switch.js';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import { Textarea } from '@/components/ui/textarea.js';
import { cn } from '@/lib/utils.js';
import { useI18n } from '@/i18n/context.js';
import {
  compareLocaleStrings,
  fmt,
  formatLocaleDateTime,
  formatLocaleNumber,
  pickCountForm,
} from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import type { LocaleMessages } from '@/i18n/locales/en/index.js';
import { messageForApiErrorCode } from '@/lib/api-error-message.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import { useExplorerClient } from '@/lib/explorer-context.js';
import { KbIngestSourcesDialog } from '@/components/app/kb/dialogs/kb-ingest-sources-dialog.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbProcessingJobPath, parseProcessingUrlState } from '@/lib/processingUrlState.js';
import { parseSourcesUrlState } from '@/lib/sourcesUrlState.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { processingStartIdempotencyKey } from '@/lib/processing-idempotency.js';

const PAGE_SIZE = 10;

type DocRow = {
  doc_id: string;
  filename?: string | null;
  document_id?: string;
  preview: string;
  char_count: number;
  version_status?: string | null;
  version_id?: string | null;
  version_no?: number | null;
  created_at?: string | null;
  updated_at?: string | null;
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
  error_detail?: { message?: string } | null;
  options: Record<string, unknown>;
  created_at: string;
};

function versionStatusLabel(
  status: string | null | undefined,
  labels: LocaleMessages['kbSources']['versionStatus'],
  emptyCell: string,
): string {
  if (!status) return emptyCell;
  const key = status as keyof typeof labels;
  return key in labels ? labels[key] : status;
}

function processingJobStatusLabel(
  status: string | null | undefined,
  labels: LocaleMessages['kbSources']['jobStatus'],
  emptyCell: string,
): string {
  if (!status) return emptyCell;
  const key = status as keyof typeof labels;
  return key in labels ? labels[key] : status;
}

const PROCESSING_STATUSES = new Set([
  'queued',
  'running',
  'parsing',
  'chunking',
  'embedding',
  'extracting',
]);

function statusIsProcessing(status: string | null | undefined): boolean {
  return status != null && PROCESSING_STATUSES.has(status);
}

function docReadyForGraph(doc: DocRow, job?: ProcessingJob): boolean {
  if (doc.version_status === 'ready') return true;
  return job?.status === 'succeeded';
}

const DEFAULT_CHUNK_SIZE = 1800;
const DEFAULT_CHUNK_OVERLAP = 250;
const DEFAULT_CHUNK_METHOD = 'recursive';

type ProductChunkMethod =
  | 'recursive'
  | 'sentence'
  | 'paragraph'
  | 'structural'
  | 'entity_aware';

function chunkMethodForName(name: string | null | undefined): ProductChunkMethod {
  const lower = (name ?? '').trim().toLowerCase();
  if (lower.endsWith('.md') || lower.endsWith('.markdown')) return 'structural';
  return DEFAULT_CHUNK_METHOD;
}

function chunkSizeValid(size: number): boolean {
  return Number.isFinite(size) && size >= 200 && size <= 100_000;
}

function chunkOptionsValid(
  method: ProductChunkMethod,
  size: number,
  overlap: number,
): boolean {
  if (!chunkSizeValid(size)) return false;
  if (method !== 'recursive') return true;
  return (
    Number.isFinite(overlap) &&
    overlap >= 0 &&
    overlap <= 10_000 &&
    overlap < size
  );
}

function methodChoices(copy: LocaleMessages['kbSources']): { value: string; label: string }[] {
  return [
    { value: 'pattern', label: copy.methodPattern },
    { value: 'ml', label: copy.methodMl },
    { value: 'llm', label: copy.methodLlm },
  ];
}

function chunkMethodChoices(
  copy: LocaleMessages['kbSources'],
): { value: ProductChunkMethod; label: string }[] {
  return [
    { value: 'recursive', label: copy.chunkMethodRecursive },
    { value: 'sentence', label: copy.chunkMethodSentence },
    { value: 'paragraph', label: copy.chunkMethodParagraph },
    { value: 'structural', label: copy.chunkMethodStructural },
    { value: 'entity_aware', label: copy.chunkMethodEntityAware },
  ];
}

function ProcessSection({
  id,
  title,
  hint,
  checked,
  onCheckedChange,
  children,
}: {
  id: string;
  title: string;
  hint: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  children: ReactNode;
}) {
  return (
    <section className="rounded-md border border-border">
      <div className="flex items-start justify-between gap-3 px-3 py-3">
        <div className="min-w-0 space-y-0.5">
          <Label htmlFor={id} className="text-sm font-medium">
            {title}
          </Label>
          <p className="text-xs leading-relaxed text-muted-foreground">{hint}</p>
        </div>
        <Switch id={id} checked={checked} onCheckedChange={onCheckedChange} className="mt-0.5" />
      </div>
      <div
        className={cn(
          'space-y-3 border-t border-border px-3 py-3',
          !checked && 'pointer-events-none opacity-40',
        )}
      >
        {children}
      </div>
    </section>
  );
}

export function KnowledgePage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const client = useExplorerClient();
  const { t, locale } = useI18n();
  const emptyCell = t.common.emptyCell;
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
  const sourcesUrl = parseSourcesUrlState(searchParams.toString());
  const processingUrl = parseProcessingUrlState(searchParams.toString());
  const jobFocusId = processingUrl.jobId;
  const [sourcesOpen, setSourcesOpen] = useState(
    sourcesUrl.openConnectors || Boolean(sourcesUrl.ingestSourceId),
  );
  const [updateTarget, setUpdateTarget] = useState<{
    document_id: string;
    doc_id: string;
  } | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<{
    document_id: string;
    doc_id: string;
  } | null>(null);
  const [deletingDocument, setDeletingDocument] = useState(false);

  const [docId, setDocId] = useState('');
  const [docText, setDocText] = useState('');
  const [updateText, setUpdateText] = useState('');
  const [uploading, setUploading] = useState(false);
  const [processImmediately, setProcessImmediately] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [configVersionId, setConfigVersionId] = useState(searchParams.get('version') ?? '');
  const [chunk, setChunk] = useState(true);
  const [chunkMethod, setChunkMethod] = useState<ProductChunkMethod>(DEFAULT_CHUNK_METHOD);
  const [chunkSize, setChunkSize] = useState(1800);
  const [chunkOverlap, setChunkOverlap] = useState(250);
  const [extract, setExtract] = useState(true);
  const [nerMethod, setNerMethod] = useState('pattern');
  const [nerModel, setNerModel] = useState('');
  const [relationMethod, setRelationMethod] = useState('pattern');

  useEffect(() => {
    if (sourcesUrl.openConnectors || sourcesUrl.ingestSourceId) {
      setSourcesOpen(true);
    }
  }, [sourcesUrl.ingestSourceId, sourcesUrl.openConnectors]);

  useEffect(() => {
    if (!jobFocusId || jobs.length === 0) return;
    if (!jobs.some((job) => job.id === jobFocusId)) return;
    setHistoryOpen(true);
  }, [jobFocusId, jobs]);

  useEffect(() => {
    if (!historyOpen || !jobFocusId) return;
    const el = document.getElementById(`processing-job-${jobFocusId}`);
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }, [historyOpen, jobFocusId, jobs]);

  const k = t.kbSources;
  const apiErrorMessage = useCallback(
    (err: unknown) => formatUserFacingApiError(err, locale as Locale),
    [locale],
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

  const activeJobCount = useMemo(
    () => jobs.filter((job) => job.status === 'queued' || job.status === 'running').length,
    [jobs],
  );
  const failedJobCount = useMemo(
    () => jobs.filter((job) => job.status === 'failed').length,
    [jobs],
  );

  const filteredDocuments = useMemo(() => {
    const q = search.trim().toLowerCase();
    const matched = !q
      ? documents
      : documents.filter(
          (doc) =>
            doc.doc_id.toLowerCase().includes(q) ||
            (doc.filename ?? '').toLowerCase().includes(q) ||
            (doc.document_id ?? '').toLowerCase().includes(q),
        );
    return [...matched].sort((a, b) =>
      compareLocaleStrings(locale as Locale, b.created_at ?? '', a.created_at ?? ''),
    );
  }, [documents, locale, search]);

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
        toast.success(k.toastProcessingComplete, {
          description: job.document_title || job.doc_id,
          action: {
            label: k.toastViewInGraph,
            onClick: () => navigate(path),
          },
        });
      }
    }
  }, [graphFocusPath, graphEnabled, id, jobs, navigate, k]);

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
      toast.info(k.toastUnchanged);
      return;
    }
    if (processImmediately) {
      await client.processing.start({
        version_id: created.version_id,
        wait: false,
        idempotency_key: processingStartIdempotencyKey(created.version_id),
      });
      toast.success(k.toastSavedQueued);
    } else {
      toast.success(k.toastSaved);
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
      toast.error(apiErrorMessage(err));
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
      toast.error(apiErrorMessage(err));
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
      toast.error(apiErrorMessage(err));
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
      toast.error(apiErrorMessage(err));
    } finally {
      setUploading(false);
    }
  }

  async function startConfigured(event: FormEvent) {
    event.preventDefault();
    if (!configVersionId || (!chunk && !extract)) return;
    if (chunk && !chunkOptionsValid(chunkMethod, chunkSize, chunkOverlap)) return;
    setBusyVersionId(configVersionId);
    try {
      const processingOptions = {
        chunk,
        chunk_method: chunkMethod,
        chunk_size: chunkSize,
        chunk_overlap: chunkOverlap,
        extract,
        ner_method: nerMethod,
        ner_model: nerMethod === 'ml' ? nerModel.trim() || undefined : undefined,
        relation_method: relationMethod,
        extract_relations: true,
      };
      await client.processing.start({
        version_id: configVersionId,
        wait: false,
        ...processingOptions,
        idempotency_key: processingStartIdempotencyKey(configVersionId, processingOptions),
      });
      closeConfig();
      toast.success(k.toastQueuedCustom);
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
      toast.success(k.toastRetryQueued);
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  async function copyJobDeepLink(jobId: string) {
    if (!id) return;
    const url = `${window.location.origin}${kbProcessingJobPath(id, jobId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.common.copySuccess);
    } catch {
      toast.error(t.common.copy);
    }
  }

  async function confirmDeleteDocument() {
    if (!deleteTarget?.document_id) return;
    setDeletingDocument(true);
    try {
      await client.documents.delete(deleteTarget.document_id);
      toast.success(k.toastDocumentDeleted);
      setDeleteTarget(null);
      await refresh();
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setDeletingDocument(false);
    }
  }

  function openConfig(versionId: string) {
    const doc = documents.find((item) => item.version_id === versionId);
    setChunk(true);
    setChunkMethod(chunkMethodForName(doc?.filename || doc?.doc_id));
    setChunkSize(DEFAULT_CHUNK_SIZE);
    setChunkOverlap(DEFAULT_CHUNK_OVERLAP);
    setExtract(true);
    setNerMethod('pattern');
    setNerModel('');
    setRelationMethod('pattern');
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

  const openDocument = useCallback(
    (docId: string) => {
      const next = new URLSearchParams(searchParams);
      next.set('doc', docId);
      next.delete('chunk');
      setSearchParams(next, { replace: true });
    },
    [searchParams, setSearchParams],
  );

  function openUpdate(doc: DocRow) {
    if (!doc.document_id) return;
    setUpdateText('');
    if (updateFileRef.current) updateFileRef.current.value = '';
    setUpdateTarget({ document_id: doc.document_id, doc_id: doc.doc_id });
  }

  const columns: DataTableColumn<DocRow>[] = useMemo(() => {
    const documentCol = 'doc_id';
    const filenameCol = k.colFilename;
    const statusCol = k.colStatus;
    const charsCol = k.colChars;
    const createdCol = k.colCreatedAt;
    const updatedCol = k.colUpdatedAt;
    const actionsCol = k.colActions;

    return [
      {
        key: 'doc',
        header: documentCol,
        render: (doc) => (
          <div className="min-w-0">
            {id ? (
              <Button
                type="button"
                variant="link"
                className="h-auto max-w-full justify-start truncate p-0 font-medium"
                onClick={() => openDocument(doc.doc_id)}
              >
                {doc.doc_id}
              </Button>
            ) : (
              <span className="font-medium">{doc.doc_id}</span>
            )}
            <div className="mt-1 flex flex-wrap items-center gap-1.5 text-[11px] text-muted-foreground">
              {doc.version_no != null ? (
                <span>
                  {fmt(k.tableVersionNo, {
                    version: formatLocaleNumber(locale as Locale, doc.version_no),
                  })}
                </span>
              ) : null}
              {doc.version_id ? (() => {
                const rowJob = latestJobByVersion[doc.version_id];
                if (!rowJob) return null;
                return (
                  <span>
                    {fmt(k.historyAttempt, {
                      attempt: formatLocaleNumber(locale as Locale, rowJob.attempt),
                    })}
                    {rowJob.error_code
                      ? ` · ${messageForApiErrorCode(rowJob.error_code, locale) ?? rowJob.error_code}`
                      : ''}
                  </span>
                );
              })() : null}
            </div>
          </div>
        ),
      },
      {
        key: 'filename',
        header: filenameCol,
        render: (doc) => (
          <span className="text-muted-foreground">{doc.filename || emptyCell}</span>
        ),
      },
      {
        key: 'status',
        header: statusCol,
        width: '8.5rem',
        render: (doc) => {
          const job = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const status =
            job?.status === 'running'
              ? job.version_status
              : job?.status === 'queued'
                ? 'queued'
                : doc.version_status ?? job?.status;
          return (
            <span className="inline-flex items-center gap-1.5 text-xs">
              {status === 'ready' ? (
                <span className="size-1.5 shrink-0 rounded-full bg-ok" aria-hidden />
              ) : statusIsProcessing(status) ? (
                <Spinner className="size-3" />
              ) : null}
              <span className={status === 'failed' ? 'text-destructive' : undefined}>
                {versionStatusLabel(status, k.versionStatus, emptyCell)}
              </span>
            </span>
          );
        },
      },
      {
        key: 'chars',
        header: charsCol,
        width: '5rem',
        hideBelow: 'md',
        render: (doc) => formatLocaleNumber(locale as Locale, doc.char_count),
      },
      {
        key: 'created_at',
        header: createdCol,
        width: '11rem',
        render: (doc) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {doc.created_at ? formatLocaleDateTime(locale as Locale, doc.created_at) : emptyCell}
          </span>
        ),
      },
      {
        key: 'updated_at',
        header: updatedCol,
        width: '11rem',
        render: (doc) => (
          <span className="whitespace-nowrap text-muted-foreground">
            {doc.updated_at ? formatLocaleDateTime(locale as Locale, doc.updated_at) : emptyCell}
          </span>
        ),
      },
      {
        key: 'actions',
        header: actionsCol,
        align: 'right',
        render: (doc) => {
          const job = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const busy = busyVersionId === doc.version_id;
          const canProcess =
            canEdit && doc.version_id && doc.version_status === 'uploaded';
          const canRetry = canEdit && job?.status === 'failed';
          const canUpdate = canEdit && doc.document_id;
          const canDelete = canEdit && doc.document_id;
          const rowJob = doc.version_id ? latestJobByVersion[doc.version_id] : undefined;
          const canGraph =
            graphEnabled && docReadyForGraph(doc, rowJob);

          if (!canProcess && !canRetry && !canUpdate && !canGraph && !canDelete) {
            return <span className="text-muted-foreground">{emptyCell}</span>;
          }

          const actionClass = 'h-7 px-2 text-xs';
          return (
            <div className="flex flex-wrap justify-end gap-1.5">
              {canProcess ? (
                <Button
                  type="button"
                  size="sm"
                  className={actionClass}
                  disabled={busy}
                  onClick={() => openConfig(doc.version_id!)}
                >
                  {k.actionChunkExtract}
                </Button>
              ) : null}
              {canRetry ? (
                <Button
                  type="button"
                  size="sm"
                  className={actionClass}
                  disabled={busy}
                  onClick={() => void retry(job!)}
                >
                  {k.actionRetry}
                </Button>
              ) : null}
              {canUpdate ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={actionClass}
                  onClick={() => openUpdate(doc)}
                >
                  {k.actionUpdate}
                </Button>
              ) : null}
              {canGraph && id ? (
                <Button type="button" size="sm" variant="outline" className={actionClass} asChild>
                  <Link to={graphFocusPath(doc.doc_id)}>{k.actionGraph}</Link>
                </Button>
              ) : null}
              {canDelete ? (
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  className={`${actionClass} text-destructive`}
                  onClick={() =>
                    setDeleteTarget({
                      document_id: doc.document_id!,
                      doc_id: doc.doc_id,
                    })
                  }
                >
                  {k.actionDelete}
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [
    k,
    id,
    canEdit,
    busyVersionId,
    latestJobByVersion,
    openConfig,
    retry,
    openUpdate,
    graphEnabled,
    graphFocusPath,
    latestJobByVersion,
    setDeleteTarget,
    openDocument,
    locale,
    emptyCell,
  ]);

  const configDoc = documents.find((doc) => doc.version_id === configVersionId);
  const methods = methodChoices(k);
  const chunkMethods = chunkMethodChoices(k);
  const chunkOverlapEnabled = chunkMethod === 'recursive';
  const chunkReady = !chunk || chunkOptionsValid(chunkMethod, chunkSize, chunkOverlap);
  const canStartProcessing =
    Boolean(configVersionId) && (chunk || extract) && chunkReady && busyVersionId !== configVersionId;

  const documentCountLabel = fmt(
    pickCountForm(locale, filteredDocuments.length, k.documentCountOne, k.documentCount),
    { count: formatLocaleNumber(locale, filteredDocuments.length) },
  );

  return (
    <ConsolePageLayout
      crumbs={[
        { label: t.menu.platform.kbs, to: '/kbs' },
        { label: kbName ?? id ?? t.common.ellipsis, to: id ? kbPath(id, 'graph') : '/kbs' },
        { label: t.menu.kb.sources },
      ]}
      subtitle={t.pages.kbSubtitles.sources}
    >
      <DataPanel>
        <DataPanelToolbar
          className="flex-nowrap"
          search={
            <ToolbarSearch
              className="min-w-0 w-full max-w-md flex-1 sm:w-72 sm:flex-none"
              placeholder={k.searchPlaceholder}
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
                data-testid="sources-job-history"
                onClick={() => setHistoryOpen(true)}
              >
                {k.jobHistory}
                {activeJobCount > 0 ? (
                  <span
                    className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-primary/15 px-1.5 text-xs font-medium tabular-nums text-primary"
                    data-testid="sources-active-jobs-badge"
                  >
                    {formatLocaleNumber(locale as Locale, activeJobCount)}
                  </span>
                ) : failedJobCount > 0 ? (
                  <span
                    className="ml-1.5 inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-destructive/15 px-1.5 text-xs font-medium tabular-nums text-destructive"
                    data-testid="sources-failed-jobs-badge"
                  >
                    {formatLocaleNumber(locale as Locale, failedJobCount)}
                  </span>
                ) : null}
              </Button>
              {canEdit ? (
                <Button type="button" variant="outline" size="sm" onClick={() => setSourcesOpen(true)}>
                  {k.connectors}
                </Button>
              ) : null}
              {canEdit ? (
                <Button type="button" size="sm" onClick={openAdd}>
                  {k.addDocument}
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
              title={k.emptyTitle}
              description={k.emptyDescription}
              action={
                canEdit ? (
                  <Button type="button" size="sm" onClick={openAdd}>
                    {k.addDocument}
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
            <DialogTitle>{k.addDocument}</DialogTitle>
            <DialogDescription>{k.addDialogDesc}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                {k.tabUpload}
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                {k.tabPaste}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <form className="space-y-4 pt-2" onSubmit={uploadFile}>
                <div className="space-y-2">
                  <Label htmlFor="add-doc-id">{k.docIdOptional}</Label>
                  <Input
                    id="add-doc-id"
                    value={docId}
                    onChange={(event) => setDocId(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-file">{k.labelFile}</Label>
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
                    {uploading ? k.uploading : k.upload}
                  </Button>
                </DialogFooter>
              </form>
            </TabsContent>
            <TabsContent value="text">
              <form className="space-y-4 pt-2" onSubmit={saveText}>
                <div className="space-y-2">
                  <Label htmlFor="add-text-doc-id">{k.docIdOptional}</Label>
                  <Input
                    id="add-text-doc-id"
                    value={docId}
                    onChange={(event) => setDocId(event.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="add-text">{k.labelText}</Label>
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
                    {k.save}
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
            {k.processAfterSave}
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
            <DialogTitle>{k.updateDialogTitle}</DialogTitle>
            <DialogDescription>{updateTarget?.doc_id}</DialogDescription>
          </DialogHeader>
          <Tabs defaultValue="file">
            <TabsList className="w-full">
              <TabsTrigger value="file" className="flex-1">
                {k.tabNewFile}
              </TabsTrigger>
              <TabsTrigger value="text" className="flex-1">
                {k.tabNewText}
              </TabsTrigger>
            </TabsList>
            <TabsContent value="file">
              <form className="space-y-4 pt-2" onSubmit={uploadUpdateFile}>
                <Input ref={updateFileRef} type="file" required />
                <DialogFooter className="px-0">
                  <Button type="submit" disabled={uploading}>
                    {uploading ? k.uploading : k.uploadVersion}
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
                    {k.saveVersion}
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
            {k.processAfterVersionSave}
          </label>
        </DialogContent>
      </Dialog>

      <Dialog open={Boolean(configVersionId)} onOpenChange={(open) => !open && closeConfig()}>
        <DialogContent className="max-h-[min(90vh,44rem)] min-w-0 gap-4 overflow-x-hidden overflow-y-auto sm:max-w-lg">
          <DialogHeader className="min-w-0 space-y-1 pr-8">
            <DialogTitle>{k.processDialogTitle}</DialogTitle>
            {configDoc ? (
              <p className="flex min-w-0 flex-wrap items-baseline gap-x-2 gap-y-0.5 text-sm">
                <span className="min-w-0 break-all font-medium">
                  {configDoc.filename || configDoc.doc_id}
                </span>
                {configDoc.filename ? (
                  <span className="min-w-0 break-all font-mono text-xs text-muted-foreground">
                    {configDoc.doc_id}
                  </span>
                ) : null}
                {configDoc.version_no ? (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    v{configDoc.version_no}
                  </span>
                ) : null}
              </p>
            ) : null}
          </DialogHeader>
          <form className="space-y-3" onSubmit={startConfigured}>
            <div className="space-y-3">
              <ProcessSection
                id="process-chunk"
                title={k.sectionChunk}
                hint={k.sectionChunkHint}
                checked={chunk}
                onCheckedChange={setChunk}
              >
                <div className="space-y-1.5">
                  <Label>{k.chunkMethod}</Label>
                  <Select
                    value={chunkMethod}
                    onValueChange={(value) => setChunkMethod(value as ProductChunkMethod)}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {chunkMethods.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {chunkMethod === 'entity_aware' ? (
                    <p className="text-xs text-muted-foreground">{k.chunkMethodEntityAwareHint}</p>
                  ) : null}
                </div>
                <div
                  className={cn(
                    'grid gap-3',
                    chunkOverlapEnabled ? 'grid-cols-2' : 'grid-cols-1',
                  )}
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="chunk-size">{k.chunkSize}</Label>
                    <Input
                      id="chunk-size"
                      type="number"
                      min={200}
                      max={100000}
                      value={chunkSize}
                      onChange={(event) => setChunkSize(Number(event.target.value))}
                    />
                  </div>
                  {chunkOverlapEnabled ? (
                    <div className="space-y-1.5">
                      <Label htmlFor="chunk-overlap">{k.chunkOverlap}</Label>
                      <Input
                        id="chunk-overlap"
                        type="number"
                        min={0}
                        max={10000}
                        value={chunkOverlap}
                        onChange={(event) => setChunkOverlap(Number(event.target.value))}
                      />
                    </div>
                  ) : null}
                </div>
                {chunk && !chunkReady ? (
                  <p className="text-xs text-destructive">
                    {chunkOverlapEnabled && chunkOverlap >= chunkSize
                      ? k.chunkOverlapTooLarge
                      : k.chunkSizeRange}
                  </p>
                ) : null}
              </ProcessSection>
              <ProcessSection
                id="process-extract"
                title={k.sectionExtract}
                hint={k.sectionExtractHint}
                checked={extract}
                onCheckedChange={setExtract}
              >
                <div className="space-y-1.5">
                  <Label>{k.entityRecognition}</Label>
                  <Select value={nerMethod} onValueChange={setNerMethod}>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((item) => (
                        <SelectItem key={item.value} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {k.nerHint}
                  </p>
                </div>
                {nerMethod === 'ml' ? (
                  <div className="space-y-1.5">
                    <Label htmlFor="ner-model">{k.spacyModel}</Label>
                    <Input
                      id="ner-model"
                      value={nerModel}
                      placeholder={k.spacyModelPlaceholder}
                      onChange={(event) => setNerModel(event.target.value)}
                    />
                  </div>
                ) : null}
                <div className="space-y-1.5">
                  <Label>{k.relationRecognition}</Label>
                  <Select
                    value={relationMethod}
                    onValueChange={setRelationMethod}
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      {methods.map((item) => (
                        <SelectItem key={`relation-${item.value}`} value={item.value}>
                          {item.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </ProcessSection>
              {!chunk && !extract ? (
                <p className="text-xs text-muted-foreground">
                  {k.needChunkOrExtract}
                </p>
              ) : null}
            </div>
            <DialogFooter className="border-t border-border pt-4">
              <Button type="button" variant="outline" onClick={closeConfig}>
                {t.common.cancel}
              </Button>
              <Button type="submit" disabled={!canStartProcessing}>
                {busyVersionId === configVersionId ? k.queuing : k.startProcessing}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{k.historyDialogTitle}</DialogTitle>
            <DialogDescription>
              {k.historyDialogDesc}
            </DialogDescription>
          </DialogHeader>
          <div className="max-h-[min(60vh,24rem)] space-y-2 overflow-y-auto pr-1">
            {jobs.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                {k.noJobs}
              </p>
            ) : (
              jobs.map((job) => (
                <details
                  key={job.id}
                  id={`processing-job-${job.id}`}
                  className="rounded-md border border-border p-3 text-sm"
                  {...(jobFocusId === job.id ? { open: true } : {})}
                >
                  <summary className="cursor-pointer font-medium">
                    {statusIsProcessing(job.status) ? (
                      <Spinner className="mr-1.5 inline size-3 align-[-2px]" />
                    ) : null}
                    {fmt(k.historyJobSummary, {
                      title: job.document_title || job.doc_id,
                      status: processingJobStatusLabel(job.status, k.jobStatus, emptyCell),
                      attempt: fmt(k.historyAttempt, {
                        attempt: formatLocaleNumber(locale as Locale, job.attempt),
                      }),
                    })}
                  </summary>
                  {id ? (
                    <p className="mt-2 text-xs text-muted-foreground">
                      {k.jobId}:{' '}
                      <span className="font-mono">{job.id}</span>
                    </p>
                  ) : null}
                  {job.error_code ? (
                    <p className="mt-2 text-xs text-destructive">
                      {messageForApiErrorCode(job.error_code, locale) ?? job.error_code}
                    </p>
                  ) : null}
                  {typeof job.options?.request_id === 'string' && job.options.request_id ? (
                    <p className="mt-1 text-xs text-muted-foreground">
                      {k.referenceId}: {job.options.request_id}
                    </p>
                  ) : null}
                  <div className="mt-2 flex flex-wrap gap-2">
                    {canEdit && job.status === 'failed' ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        disabled={busyVersionId === job.version_id}
                        data-testid={`processing-job-retry-${job.id}`}
                        onClick={() => void retry(job)}
                      >
                        {k.historyRetry}
                      </Button>
                    ) : null}
                    {id ? (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        data-testid={`processing-job-copy-link-${job.id}`}
                        onClick={() => void copyJobDeepLink(job.id)}
                      >
                        {k.copyJobLink}
                      </Button>
                    ) : null}
                    {graphEnabled && id && job.status === 'succeeded' && job.doc_id ? (
                      <Button type="button" variant="outline" size="sm" asChild>
                        <Link to={graphFocusPath(job.doc_id)}>
                          {k.toastViewInGraph}
                        </Link>
                      </Button>
                    ) : null}
                  </div>
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
          focusSourceId={sourcesUrl.ingestSourceId}
        />
      ) : null}

      <AlertDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => {
          if (!open && !deletingDocument) setDeleteTarget(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{k.deleteTitle}</AlertDialogTitle>
            <AlertDialogDescription>
              {fmt(k.deleteDescription, { docId: deleteTarget?.doc_id ?? '' })}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={deletingDocument}>
              {t.common.cancel}
            </AlertDialogCancel>
            <AlertDialogAction
              disabled={deletingDocument}
              onClick={(event) => {
                event.preventDefault();
                void confirmDeleteDocument();
              }}
            >
              {deletingDocument ? k.deleting : k.delete}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </ConsolePageLayout>
  );
}
