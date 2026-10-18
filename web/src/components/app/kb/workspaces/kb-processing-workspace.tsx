import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { PublicIcon } from '@/components/app/shared/primitives/public-icon.js';
import {
  DataPanel,
  DataPanelBody,
  DataPanelToolbar,
  EmptyState,
  ToolbarSearch,
} from '@/components/app/shared/console/index.js';
import { ConsolePageLayout } from '@/components/app/shared/console/index.js';
import { Button } from '@/components/ui/button.js';
import { Spinner } from '@/components/ui/spinner.js';
import { Tabs, TabsList, TabsTrigger } from '@/components/ui/tabs.js';
import {
  KbProcessingJobsList,
  type ProcessingJobFilter,
} from '@/components/app/kb/widgets/kb-processing-jobs-list.js';
import { useI18n } from '@/i18n/context.js';
import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import { formatByteSize } from '@/lib/format-byte-size.js';
import type { Locale } from '@/i18n/locale.js';
import { formatUserFacingApiError } from '@/lib/api-error-message.js';
import { useExplorerClient } from '@/lib/explorer-context.js';
import { useKbCatalog } from '@/lib/kb-context.js';
import { useKbCapabilities } from '@/lib/kb-capabilities.js';
import {
  type ProcessingJob,
  jobIsActive,
  sortProcessingJobs,
} from '@/lib/kb-processing-job.js';
import { kbPath } from '@/lib/nav-config.js';
import { kbProcessingPath } from '@/lib/processingUrlState.js';

export function KbProcessingWorkspace({
  kbId,
  jobFocusId,
  initialFilter = 'all',
}: {
  kbId: string;
  jobFocusId?: string;
  initialFilter?: ProcessingJobFilter;
}) {
  const [, setSearchParams] = useSearchParams();
  const client = useExplorerClient();
  const { t, locale } = useI18n();
  const { getKb } = useKbCatalog();
  const { caps } = useKbCapabilities();
  const jobStatusRef = useRef<Record<string, string>>({});

  const [jobs, setJobs] = useState<ProcessingJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [busyVersionId, setBusyVersionId] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<ProcessingJobFilter>(initialFilter);

  useEffect(() => {
    setFilter(initialFilter);
  }, [initialFilter]);

  const onFilterChange = useCallback(
    (value: ProcessingJobFilter) => {
      setFilter(value);
      setSearchParams(
        (prev) => {
          const next = new URLSearchParams(prev);
          if (value === 'all') {
            next.delete('filter');
          } else {
            next.set('filter', value);
          }
          return next;
        },
        { replace: true },
      );
    },
    [setSearchParams],
  );

  const k = t.kbSources;
  const p = t.kbProcessing;
  const apiErrorMessage = useCallback(
    (err: unknown) => formatUserFacingApiError(err, locale as Locale),
    [locale],
  );
  const canEdit = caps?.graph_write !== false;
  const graphEnabled = caps?.graph === true;
  const kbName = getKb(kbId)?.name ?? kbId;

  const sortedJobs = useMemo(() => sortProcessingJobs(jobs), [jobs]);

  const activeJobCount = useMemo(
    () => jobs.filter((job) => jobIsActive(job.status)).length,
    [jobs],
  );
  const failedJobCount = useMemo(
    () => jobs.filter((job) => job.status === 'failed').length,
    [jobs],
  );

  const limitsHint = useMemo(() => {
    const upload = caps?.upload_max_bytes;
    if (!upload) return null;
    const timeoutSec = caps.processing_job_timeout_seconds ?? 600;
    return fmt(p.limitsHint, {
      upload: formatByteSize(upload),
      inflight: formatLocaleNumber(locale as Locale, caps.ingest_max_inflight ?? 0),
      pending: formatLocaleNumber(locale as Locale, caps.ingest_max_pending ?? 0),
      timeoutMin: formatLocaleNumber(locale as Locale, Math.max(1, Math.round(timeoutSec / 60))),
    });
  }, [caps, locale, p.limitsHint]);

  const refresh = useCallback(
    async (silent = false) => {
      if (!silent) setRefreshing(true);
      try {
        const taskData = await client.processing.list();
        setJobs(taskData.jobs as ProcessingJob[]);
      } catch (err) {
        toast.error(apiErrorMessage(err));
      } finally {
        if (!silent) setRefreshing(false);
      }
    },
    [apiErrorMessage, client],
  );

  useEffect(() => {
    setLoading(true);
    void refresh(true)
      .catch(() => undefined)
      .finally(() => setLoading(false));
  }, [refresh]);

  useEffect(() => {
    if (!jobs.some((job) => jobIsActive(job.status))) return;
    const timer = window.setInterval(() => void refresh(true), 2000);
    return () => window.clearInterval(timer);
  }, [jobs, refresh]);

  useEffect(() => {
    if (!graphEnabled) return;
    for (const job of jobs) {
      const prev = jobStatusRef.current[job.id];
      jobStatusRef.current[job.id] = job.status;
      if (prev && prev !== 'succeeded' && job.status === 'succeeded' && job.doc_id) {
        toast.success(k.toastProcessingComplete, {
          description: job.document_title || job.doc_id,
        });
      }
    }
  }, [graphEnabled, jobs, k.toastProcessingComplete]);

  async function retry(job: ProcessingJob) {
    setBusyVersionId(job.version_id);
    try {
      await client.processing.retry(job.id);
      toast.success(k.toastRetryQueued);
      await refresh(true);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  async function retryAllFailed() {
    const failed = jobs.filter((job) => job.status === 'failed');
    if (failed.length === 0) return;
    setBusyVersionId('bulk');
    try {
      await Promise.allSettled(failed.map((job) => client.processing.retry(job.id)));
      toast.success(p.retryAllQueued);
      await refresh(true);
    } catch (err) {
      toast.error(apiErrorMessage(err));
    } finally {
      setBusyVersionId(null);
    }
  }

  async function copyJobDeepLink(jobId: string) {
    const url = `${window.location.origin}${kbPath(kbId, 'processing')}?job=${encodeURIComponent(jobId)}`;
    try {
      await navigator.clipboard.writeText(url);
      toast.success(t.common.copySuccess);
    } catch {
      toast.error(t.common.copy);
    }
  }

  const showEmpty = !loading && jobs.length === 0;

  return (
    <div
      className="kb-processing-workspace w-full"
      data-kb-id={kbId}
      data-testid="kb-processing-workspace"
    >
      <ConsolePageLayout
        crumbs={[
          { label: t.menu.platform.kbs, to: '/kbs' },
          { label: kbName, to: kbPath(kbId, 'graph') },
          { label: t.menu.kb.processing },
        ]}
        subtitle={
          <div className="space-y-1">
            <p>{t.pages.kbSubtitles.processing}</p>
            {limitsHint ? (
              <p className="text-xs text-muted-foreground" data-testid="processing-limits-hint">
                {limitsHint}
              </p>
            ) : null}
          </div>
        }
        className="gap-6 [&>:last-child]:min-h-0 [&>:last-child]:flex-none"
      >
        <DataPanel>
          <DataPanelToolbar
            className="flex-col items-stretch gap-3 sm:flex-row sm:items-center"
            search={
              <ToolbarSearch
                className="min-w-0 w-full max-w-md flex-1"
                placeholder={p.searchPlaceholder}
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                disabled={showEmpty}
              />
            }
            actions={
              <div className="flex flex-wrap items-center gap-2">
                {activeJobCount > 0 ? (
                  <span
                    className="inline-flex items-center gap-1.5 rounded-md bg-primary/15 px-2 py-1 text-xs font-medium text-primary"
                    data-testid="processing-active-jobs-badge"
                  >
                    <Spinner className="size-3" />
                    {formatLocaleNumber(locale as Locale, activeJobCount)}
                  </span>
                ) : failedJobCount > 0 ? (
                  <Link
                    to={kbProcessingPath(kbId, { filter: 'failed' })}
                    className="inline-flex min-w-[1.25rem] items-center justify-center rounded-md bg-destructive/15 px-2 py-1 text-xs font-medium tabular-nums text-destructive underline-offset-2 hover:underline"
                    data-testid="processing-failed-jobs-badge"
                  >
                    {formatLocaleNumber(locale as Locale, failedJobCount)}
                  </Link>
                ) : null}
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={loading || refreshing}
                  onClick={() => void refresh()}
                >
                  <PublicIcon
                    name="arrow-refresh-01"
                    className={`mr-1.5 size-3.5 ${refreshing ? 'animate-spin' : ''}`}
                  />
                  {p.refresh}
                </Button>
                {canEdit && failedJobCount > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={busyVersionId !== null}
                    data-testid="processing-retry-all-failed"
                    onClick={() => void retryAllFailed()}
                  >
                    {p.retryAllFailed}
                  </Button>
                ) : null}
                <Button type="button" variant="outline" size="sm" asChild>
                  <Link to={kbPath(kbId, 'sources')}>{t.menu.kb.sources}</Link>
                </Button>
              </div>
            }
          />
          <DataPanelBody padded={false} className="mt-2">
            {!showEmpty ? (
              <div className="border-b border-border px-3 py-2 sm:px-4">
                <Tabs
                  value={filter}
                  onValueChange={(value) => onFilterChange(value as ProcessingJobFilter)}
                >
                  <TabsList className="h-8">
                    <TabsTrigger value="all" className="px-3 text-xs">
                      {p.filterAll}
                    </TabsTrigger>
                    <TabsTrigger value="active" className="px-3 text-xs">
                      {p.filterActive}
                      {activeJobCount > 0 ? (
                        <span className="ml-1 tabular-nums text-muted-foreground">
                          ({formatLocaleNumber(locale as Locale, activeJobCount)})
                        </span>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="failed" className="px-3 text-xs">
                      {p.filterFailed}
                      {failedJobCount > 0 ? (
                        <span className="ml-1 tabular-nums text-muted-foreground">
                          ({formatLocaleNumber(locale as Locale, failedJobCount)})
                        </span>
                      ) : null}
                    </TabsTrigger>
                    <TabsTrigger value="succeeded" className="px-3 text-xs">
                      {p.filterSucceeded}
                    </TabsTrigger>
                  </TabsList>
                </Tabs>
              </div>
            ) : null}
            {loading && jobs.length === 0 ? (
              <div className="flex justify-center py-16">
                <Spinner className="size-6" />
              </div>
            ) : showEmpty ? (
              <div className="p-4">
                <EmptyState
                  title={k.noJobs}
                  description={k.emptyDescription}
                  action={
                    <Button type="button" size="sm" asChild>
                      <Link to={kbPath(kbId, 'sources')}>{k.addDocument}</Link>
                    </Button>
                  }
                />
              </div>
            ) : (
              <KbProcessingJobsList
                kbId={kbId}
                jobs={sortedJobs}
                jobFocusId={jobFocusId}
                canEdit={canEdit}
                busyVersionId={busyVersionId}
                graphEnabled={graphEnabled}
                search={search}
                filter={filter}
                onRetry={(job) => void retry(job)}
                onCopyLink={(jobId) => void copyJobDeepLink(jobId)}
              />
            )}
          </DataPanelBody>
        </DataPanel>
      </ConsolePageLayout>
    </div>
  );
}
