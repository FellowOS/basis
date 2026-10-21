export const kbDataOnboarding = {
  title: '数据与本体向导',
  subtitle:
    '连接外部系统、采纳跨 stream 的连接器映射建议，并完成首次同步写入账本（不包含 OWL 发布）。',
  steps: {
    connections: '连接',
    suggest: '建议映射',
    done: '首次同步',
  },
  connectionsTitle: '已配置连接',
  connectionsSubtitle: '若列表为空，请先在目录中添加连接。',
  loadingConnections: '正在加载连接…',
  noConnections: '尚无连接。请先连接数据库或 SaaS 数据源。',
  openCatalog: '打开连接器目录',
  sqlTablesLabel: 'SQL 表（可选）',
  sqlTablesPlaceholder: 'accounts\ncustomers\npostgres:orders',
  sqlTablesHint:
    '每行一张表。多个 SQL 连接时可用服务名前缀（例如 postgres:public.users）。',
  continueToSuggest: '生成映射建议',
  suggestTitle: '跨 stream 实体建议',
  suggestSubtitle: '按推断实体类型分组审阅草稿，保存并同步。',
  suggestHint: '打开建议面板，基于 DISCOVER 为已保存连接生成映射草稿。',
  reopenSuggest: '打开建议面板',
  doneTitle: '映射已保存',
  doneSubtitle: '已创建 {count} 条连接器映射并完成首次同步。',
  viewMappings: '查看连接器映射',
  viewEntities: '查看实体',
};
