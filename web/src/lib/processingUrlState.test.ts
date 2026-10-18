import { describe, expect, it } from 'vitest';
import {
  kbProcessingJobPath,
  kbProcessingPath,
  parseProcessingUrlState,
} from '@/lib/processingUrlState.js';

describe('processingUrlState', () => {
  it('parses job id', () => {
    expect(parseProcessingUrlState('?job=job-9').jobId).toBe('job-9');
  });

  it('parses filter', () => {
    expect(parseProcessingUrlState('?filter=failed').filter).toBe('failed');
  });

  it('builds processing job deep link', () => {
    expect(kbProcessingJobPath('kb-1', 'job-9')).toBe('/kbs/kb-1/processing?job=job-9');
  });

  it('builds processing list with filter', () => {
    expect(kbProcessingPath('kb-1', { filter: 'failed' })).toBe(
      '/kbs/kb-1/processing?filter=failed',
    );
  });
});
