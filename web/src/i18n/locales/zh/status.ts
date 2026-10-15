export const status = {
  running: '运行中',
  stopped: '已停止',
  failed: '失败',
  starting: '启动中',
  stopping: '正在停止',
  adoptKind: '已有实例',
  provisionKindLocal: '本机部署',
  provisionKindSsh: 'SSH 部署',
  provisionKindK8s: 'K8s 部署',
  failedState: '状态为失败',
} as const;
