export const kbProcessing = {
  searchPlaceholder: 'Search document or job id…',
  filterAll: 'All',
  filterActive: 'In progress',
  filterFailed: 'Failed',
  filterSucceeded: 'Succeeded',
  colDocument: 'Document',
  colStatus: 'Status',
  colAttempt: 'Attempt',
  colCreated: 'Created',
  colActions: 'Actions',
  refresh: 'Refresh',
  optionsSnapshot: 'Option snapshot',
  noMatches: 'No jobs match your filters.',
  openInSources: 'Open in sources',
  viewAlerts: 'View alerts',
  limitsHint:
    'Server limits: upload ≤ {upload}; up to {inflight} jobs at once, {pending} queued; timeout {timeoutMin} min.',
  opsQueueHint:
    'Queue now: {inflight} running (max {inflightMax}), {queued} waiting (max {pendingMax}).',
  jobsApiLink: 'Ingest jobs API (OpenAPI)',
  retryAllFailed: 'Retry all failed',
  retryAllQueued: 'Retry queued for all failed jobs',
} as const;
