import { fmt, formatLocaleNumber } from '@/i18n/format.js';
import type { Locale } from '@/i18n/locale.js';
import type { WorkspaceCapabilities } from '@/lib/workspace/capabilities.js';
import { formatByteSize } from '@/lib/format-byte-size.js';
import { jobIsActive, type ProcessingJob } from '@/lib/workspace/processing-job.js';

type LimitsCopy = {
  limits_hint: string;
  ops_queue_hint: string;
};

export function buildIngestLimitsHint(
  caps: WorkspaceCapabilities | null | undefined,
  locale: Locale,
  copy: LimitsCopy,
): string | null {
  const upload = caps?.upload_max_bytes;
  if (!upload) return null;
  const timeoutSec = caps.processing_job_timeout_seconds ?? 600;
  return fmt(copy.limits_hint, {
    upload: formatByteSize(upload),
    inflight: formatLocaleNumber(locale, caps.ingest_max_inflight ?? 0),
    pending: formatLocaleNumber(locale, caps.ingest_max_pending ?? 0),
    timeoutMin: formatLocaleNumber(locale, Math.max(1, Math.round(timeoutSec / 60))),
  });
}

export function buildIngestOpsQueueHint(
  caps: WorkspaceCapabilities | null | undefined,
  jobs: ProcessingJob[],
  locale: Locale,
  copy: LimitsCopy,
): string | null {
  const inflightMax = caps?.ingest_max_inflight;
  const pendingMax = caps?.ingest_max_pending;
  if (inflightMax == null && pendingMax == null) return null;
  const queuedJobCount = jobs.filter((job) => job.status === 'queued').length;
  const inflightJobCount = jobs.filter(
    (job) => jobIsActive(job.status) && job.status !== 'queued',
  ).length;
  return fmt(copy.ops_queue_hint, {
    inflight: formatLocaleNumber(locale, inflightJobCount),
    inflightMax: formatLocaleNumber(locale, inflightMax ?? 0),
    queued: formatLocaleNumber(locale, queuedJobCount),
    pendingMax: formatLocaleNumber(locale, pendingMax ?? 0),
  });
}
