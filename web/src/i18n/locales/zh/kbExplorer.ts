export const kbExplorer = {
  loadingOntology: '加载本体工作台…',
  loadingAlignments: '加载本体对齐…',
  loadingSparql: '加载 SPARQL 工作台…',
  loadingOntologyVersions: '加载本体版本…',
  loadingDecisions: '加载决策记录…',
  loadOntology: '加载本体',
  loadingGraph: '加载图谱…',
  loadingShacl: '加载 SHACL 工作台…',
  loadingReasoning: '加载推理工作台…',
  loadingReview: '加载审核队列…',
  kbContextRequired:
    'Explorer API 需要知识库上下文（传入 kbId，或通过 ExplorerHostProvider 配置 apiRoot）。',
  graphUpdatesWebSocketRequired:
    '图谱实时更新需要 ExplorerHostProvider（KB 实时 ticket）。',
  ontologyKbRequired: '本体工作台需要 kbId（OntologyKbProvider）。',
  vocabularyKbRequired: '词汇表工作台需要 kbId（VocabularyKbProvider）。',
  realtimeTicketFailed: '实时 ticket 失败（{status}）',
} as const;
