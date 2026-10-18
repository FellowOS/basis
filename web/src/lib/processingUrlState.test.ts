import { describe, expect, it } from 'vitest';
import { kbProcessingJobPath, parseProcessingUrlState } from '@/lib/processingUrlState.js';

describe('processingUrlState', () => {
  it('parses job id', () => {
    expect(parseProcessingUrlState('?job=job-9').jobId).toBe('job-9');
  });

  it('builds processing job deep link', () => {
    expect(kbProcessingJobPath('kb-1', 'job-9')).toBe('/kbs/kb-1/processing?job=job-9');
  });
});
