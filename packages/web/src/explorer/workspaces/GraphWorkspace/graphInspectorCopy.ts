import type { GraphWorkspaceLocale } from "./graphWorkspaceCopy";

type Pair = { zh: string; en: string };

const MESSAGES = {
  emptyHint: {
    zh: "搜索节点或点击画布上的节点以查看属性。",
    en: "Search for a node or click one in the canvas to inspect its properties.",
  },
  selection: { zh: "选中项", en: "Selection" },
  notInspectableTitle: {
    zh: "当前图谱中无法直接检查所选对象。",
    en: "Selected item is not directly inspectable in the current graph.",
  },
  useFocusHint: {
    zh: "使用「聚焦」将分组选择解析为规范节点。",
    en: "Use Focus to resolve this grouped selection to its canonical node.",
  },
  groupedSelection: { zh: "分组选择", en: "Grouped Selection" },
  entityDefault: { zh: "实体", en: "Entity" },
  groupedDisplayTitle: {
    zh: "分组项在显式进入聚焦模式前仅作展示。",
    en: "This grouped item stays display-level until you explicitly enter Focused mode.",
  },
  knowledgeLinks: { zh: "知识库跳转", en: "Knowledge links" },
  continueInChat: { zh: "在对话中继续", en: "Continue in chat" },
  openLineage: { zh: "查看 PROV 血缘", en: "Open PROV lineage" },
  evidenceSourcesDoc: { zh: "在资料中打开文档", en: "Open document in Sources" },
  evidenceSourcesChunk: { zh: "在资料中打开片段", en: "Open chunk in Sources" },
  evidenceSearch: { zh: "在检索中搜索", en: "Search in KB" },
  content: { zh: "内容", en: "Content" },
  actions: { zh: "操作", en: "Actions" },
  runPrediction: { zh: "运行链路预测", en: "Run Link Prediction" },
  running: { zh: "运行中…", en: "Running…" },
  provenanceJson: { zh: "溯源 JSON", en: "Provenance JSON" },
  provenanceMd: { zh: "溯源 Markdown", en: "Provenance MD" },
  predictionTypePlaceholder: {
    zh: "可选候选类型过滤，例如 disease",
    en: "Optional candidate type filter, e.g. disease",
  },
  tracePath: { zh: "路径追踪", en: "Trace Path" },
  pathTargetPlaceholder: { zh: "目标节点 ID", en: "Target node ID" },
  traceCausalPath: { zh: "追踪因果路径", en: "Trace Causal Path" },
  pathEmptyHint: {
    zh: "选择目标或点击候选预测以准备路径追踪。",
    en: "Choose a target or click a candidate prediction to prepare a path trace.",
  },
  candidateLinks: { zh: "候选关系", en: "Candidate Links" },
  computingCandidates: { zh: "正在计算候选关系…", en: "Computing candidate links…" },
  runPredictionHint: {
    zh: "运行链路预测以显示可能的下一跳关系。",
    en: "Run link prediction to surface likely next-hop relationships.",
  },
  sourceAttribution: { zh: "来源归因", en: "Source Attribution" },
  noAttribution: {
    zh: "此节点没有显式归因元数据。",
    en: "No explicit attribution metadata was found on this node.",
  },
  properties: { zh: "属性", en: "Properties" },
  noProperties: {
    zh: "此节点没有附加属性。",
    en: "No additional properties are attached to this node.",
  },
  temporalBadge: { zh: "时间", en: "temporal" },
  sourceFieldsBadge: { zh: "个来源字段", en: "source fields" },
  candidateLinksBadge: { zh: "条候选关系", en: "candidate links" },
  validFrom: { zh: "起", en: "from" },
  validUntil: { zh: "止", en: "until" },
  confidenceDecay: { zh: "置信衰减", en: "Confidence Decay" },
  semanticSim: { zh: "语义相似", en: "Semantic Sim." },
  pathCoherence: { zh: "路径连贯", en: "Path Coherence" },
  bottleneck: { zh: "瓶颈", en: "Bottleneck" },
  noPathFound: {
    zh: "所选节点之间未找到路径。",
    en: "No path found between the selected nodes.",
  },
  totalWeight: { zh: "总权重", en: "Total weight" },
  loadingInspector: { zh: "加载检查器…", en: "Loading inspector…" },
  relatedDecisions: { zh: "相关决策", en: "Related decisions" },
  decisionsLoading: { zh: "加载中…", en: "Loading…" },
  noDecisions: {
    zh: "未找到引用此节点的决策记录。",
    en: "No decision records mention this node.",
  },
  openDecisionsReview: { zh: "在审核工作台查看决策", en: "Open in review · Decisions" },
  decisionsLoadFailed: { zh: "加载决策失败", en: "Failed to load decisions" },
} satisfies Record<string, Pair>;

export function inspectorCopy(
  locale: GraphWorkspaceLocale,
  key: keyof typeof MESSAGES,
): string {
  return MESSAGES[key][locale];
}

export function inspectorCanonicalNodeLine(
  locale: GraphWorkspaceLocale,
  nodeId: string,
): string {
  return locale === "zh"
    ? `可用规范节点：${nodeId}`
    : `Canonical node available: ${nodeId}`;
}

export function inspectorPathBandBadge(
  locale: GraphWorkspaceLocale,
  band: string,
  hops: number,
): string {
  const bandLabel =
    locale === "zh"
      ? ({ direct: "直接", near: "近", "mid-range": "中距", distant: "远" } as Record<string, string>)[band] ?? band
      : band;
  const hopPart =
    locale === "zh"
      ? `${hops} 跳`
      : `${hops} hop${hops === 1 ? "" : "s"}`;
  return `${bandLabel} · ${hopPart}`;
}

export function inspectorAltPathsBadge(locale: GraphWorkspaceLocale, count: number): string {
  return locale === "zh" ? `${count} 条备选路径` : `${count} alt path${count === 1 ? "" : "s"}`;
}

export function inspectorHopsSummary(locale: GraphWorkspaceLocale, hops: number): string {
  return locale === "zh" ? `${hops} 跳` : `${hops} hops`;
}

export function inspectorBadgeCount(
  locale: GraphWorkspaceLocale,
  count: number,
  kind: "sourceFields" | "candidateLinks",
): string {
  if (kind === "sourceFields") {
    return locale === "zh"
      ? `${count} ${MESSAGES.sourceFieldsBadge.zh}`
      : `${count} ${MESSAGES.sourceFieldsBadge.en}`;
  }
  return locale === "zh"
    ? `${count} ${MESSAGES.candidateLinksBadge.zh}`
    : `${count} ${MESSAGES.candidateLinksBadge.en}`;
}

export function inspectorFocusTitle(
  locale: GraphWorkspaceLocale,
  nodeId: string,
  isBottleneck: boolean,
): string {
  if (isBottleneck) {
    return locale === "zh" ? `瓶颈：${nodeId}` : `Bottleneck: ${nodeId}`;
  }
  return locale === "zh" ? `聚焦：${nodeId}` : `Focus: ${nodeId}`;
}
