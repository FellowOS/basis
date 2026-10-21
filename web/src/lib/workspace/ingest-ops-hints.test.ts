import { describe, expect, it } from 'vitest';

import { messagesForLocale } from '@/i18n/pick-locale.js';
import { buildIngestLimitsHint, buildIngestOpsQueueHint } from '@/lib/workspace/ingest-ops-hints.js';
import type { ProcessingJob } from '@/lib/workspace/processing-job.js';

describe('kb-ingest-ops-hints', () => {
  const copy = messagesForLocale('en').processing.jobs;

  it('buildIngestLimitsHint formats caps', () => {
    const hint = buildIngestLimitsHint(
      {
        upload_max_bytes: 50 * 1024 * 1024,
        ingest_max_inflight: 4,
        ingest_max_pending: 32,
        processing_job_timeout_seconds: 600,
      },
      'en',
      copy,
    );
    expect(hint).toContain('50');
    expect(hint).toContain('10');
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
      copy,
    );
    expect(hint).toContain('1 running');
    expect(hint).toContain('1 waiting');
  });
});
