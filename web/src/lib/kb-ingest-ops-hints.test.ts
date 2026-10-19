import { describe, expect, it } from 'vitest';

import { kbProcessing as enProcessing } from '@/i18n/locales/en/kbProcessing.js';
import { buildIngestLimitsHint, buildIngestOpsQueueHint } from '@/lib/kb-ingest-ops-hints.js';
import type { ProcessingJob } from '@/lib/kb-processing-job.js';

describe('kb-ingest-ops-hints', () => {
  it('buildIngestLimitsHint formats caps', () => {
    const hint = buildIngestLimitsHint(
      {
        upload_max_bytes: 50 * 1024 * 1024,
        ingest_max_inflight: 4,
        ingest_max_pending: 32,
        processing_job_timeout_seconds: 600,
      },
      'en',
      enProcessing,
    );
    expect(hint).toContain('50');
    expect(hint).toContain('10 min');
  });

  it('buildIngestOpsQueueHint counts queued and running jobs', () => {
    const jobs: ProcessingJob[] = [
      {
        id: 'j1',
        status: 'running',
        version_id: 'v1',
        doc_id: 'd1',
        document_title: 'Doc 1',
        version_status: 'processing',
        attempt: 1,
        error_code: null,
        options: {},
        created_at: '2026-01-01T00:00:00Z',
      },
      {
        id: 'j2',
        status: 'queued',
        version_id: 'v2',
        doc_id: 'd2',
        document_title: 'Doc 2',
        version_status: 'queued',
        attempt: 1,
        error_code: null,
        options: {},
        created_at: '2026-01-01T00:00:01Z',
      },
    ];
    const hint = buildIngestOpsQueueHint(
      { ingest_max_inflight: 4, ingest_max_pending: 32 },
      jobs,
      'en',
      enProcessing,
    );
    expect(hint).toContain('1 running');
    expect(hint).toContain('1 waiting');
  });
});
