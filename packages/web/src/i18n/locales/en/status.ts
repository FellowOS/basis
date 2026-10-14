export const status = {
  running: 'Running',
  stopped: 'Stopped',
  failed: 'Failed',
  starting: 'Starting…',
  stopping: 'Stopping…',
  adoptKind: 'Existing',
  provisionKindLocal: 'Local deploy',
  provisionKindSsh: 'SSH deploy',
  provisionKindK8s: 'K8s deploy',
  failedState: 'Failed',
} as const;
