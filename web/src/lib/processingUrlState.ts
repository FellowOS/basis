import { kbPath } from '@/lib/nav-config.js';

const JOB_PARAM = 'job';

export function parseProcessingUrlState(search: string): { jobId?: string } {
  const jobId = new URLSearchParams(search).get(JOB_PARAM)?.trim();
  return { jobId: jobId || undefined };
}

/** Deep-link to Sources job history with a specific processing job expanded (F-SRC-08). */
export function kbProcessingJobPath(kbId: string, jobId: string): string {
  const params = new URLSearchParams({ [JOB_PARAM]: jobId });
  return `${kbPath(kbId, 'sources')}?${params.toString()}`;
}
