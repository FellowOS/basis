export const kbGraphProjection = {
  title: 'Explorer 图谱投影',
  unavailableDesc: '当前环境未启用 Explorer 运行时。',
  description: '画布数据来自账本投影。重建会用账本覆盖当前 Explorer 会话并写入审计。',
  openGraph: '打开图谱',
  ledgerRevision: '账本修订',
  projectionStatus: '投影状态',
  nodesEdges: '节点 / 边',
  lastBuilt: '上次构建',
  lastError: '最近错误',
  editorRequired: '需要编辑者角色才能重建投影。',
  auditNote: '操作记入平台审计（kb.graph.projection_rebuild）。',
  viewAuditGraph: '在审计日志中查看图谱事件',
} as const;
