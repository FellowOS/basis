export type GraphWorkspaceLocale = "zh" | "en";

type CopyPair = { zh: string; en: string };

const MESSAGES = {
  semanticSelectFullGraphNode: {
    zh: "请在全图模式下选中一个节点以加载语义距离。",
    en: "Select a Full Graph node to load semantic distance.",
  },
  semanticNoNeighbors: {
    zh: "该节点没有返回语义邻居。",
    en: "No semantic neighbors were returned for this node.",
  },
  semanticNodeNotFound: {
    zh: "语义距离接口未找到所选节点。",
    en: "Selected node was not found by the semantic distance API.",
  },
  semanticUnavailable: {
    zh: "当前图谱不支持语义相似度。",
    en: "Semantic similarity is unavailable for this graph.",
  },
  distanceFullGraphOnly: {
    zh: "距离分析仅在全图模式下可用。",
    en: "Distance intelligence is available in Full Graph mode.",
  },
  distanceSelectNode: {
    zh: "请先选中一个节点以启用距离分析。",
    en: "Select a node to activate distance intelligence.",
  },
  graphLoadTruncated: {
    zh: "当前仅展示前 200 个节点与 400 条边。可重建投影或使用搜索聚焦实体。",
    en: "Showing the first 200 nodes and 400 edges for this knowledge base. Rebuild or use search to focus on specific entities.",
  },
  emptyGraphTitle: {
    zh: "图谱尚无节点",
    en: "No graph nodes yet",
  },
  emptyGraphBody: {
    zh: "上传资料并运行处理，必要时在设置中重建投影。",
    en: "Upload documents and run processing, then rebuild the projection if needed.",
  },
  emptyGraphLink: {
    zh: "前往资料库",
    en: "Go to library",
  },
  discardMarkdownDraft: {
    zh: "放弃未保存的 Markdown 草稿并离开此节点？",
    en: "Discard the unapplied Markdown draft and leave this node?",
  },
  selectNodeFirst: {
    zh: "请先在画布上选择一个节点",
    en: "Select a node on the canvas first",
  },
  loadErrorTitle: {
    zh: "无法加载图谱",
    en: "Could not load the graph",
  },
  loadErrorBody: {
    zh: "Explorer 接口未返回图谱数据。请确认后端已启动并可访问，然后重试。",
    en: "The Explorer API did not return graph data. Check that the backend is running and reachable, then try again.",
  },
  loadRetry: {
    zh: "重试",
    en: "Retry",
  },
  timelineLoading: {
    zh: "加载时间轴…",
    en: "Loading timeline…",
  },
  loadApplyingStyling: {
    zh: "应用语义颜色、大小与结构样式",
    en: "Applying semantic color, sizing, and structural styling",
  },
  loadHydratingScene: {
    zh: "准备渲染并灌入图谱场景",
    en: "Preparing renderer and hydrating graph scene",
  },
  loadSettlingLayout: {
    zh: "稳定运行时布局",
    en: "Settling runtime layout",
  },
} satisfies Record<string, CopyPair>;

export function graphCopy(
  locale: GraphWorkspaceLocale,
  key: keyof typeof MESSAGES,
): string {
  return MESSAGES[key][locale];
}

export function graphLoadPhaseTitle(
  locale: GraphWorkspaceLocale,
  phase: string,
): string {
  const titles: Record<string, CopyPair> = {
    bootstrapping: { zh: "准备图谱会话", en: "Preparing graph session" },
    fetching_nodes: { zh: "加载节点", en: "Loading nodes" },
    fetching_edges: { zh: "加载关系", en: "Loading relationships" },
    computing_styling: { zh: "计算节点样式", en: "Computing node styling" },
    hydrating_scene: { zh: "渲染图谱场景", en: "Hydrating graph scene" },
    stabilizing_layout: { zh: "稳定布局", en: "Stabilizing layout" },
    ready: { zh: "图谱就绪", en: "Graph ready" },
  };
  return titles[phase]?.[locale] ?? titles.bootstrapping[locale];
}

export function graphLoadStageLabel(
  locale: GraphWorkspaceLocale,
  phase: string,
): string {
  const labels: Record<string, CopyPair> = {
    bootstrapping: { zh: "准备", en: "Prepare" },
    fetching_nodes: { zh: "节点", en: "Nodes" },
    fetching_edges: { zh: "关系", en: "Relations" },
    computing_styling: { zh: "样式", en: "Styling" },
    hydrating_scene: { zh: "场景", en: "Scene" },
    stabilizing_layout: { zh: "布局", en: "Layout" },
  };
  return labels[phase]?.[locale] ?? (locale === "zh" ? "阶段" : "Stage");
}

export function graphLoadNodesProgressMessage(
  locale: GraphWorkspaceLocale,
  loaded: number,
  total: number | null,
): string {
  if (total) {
    return locale === "zh"
      ? `正在加载节点 ${loaded.toLocaleString()} / ${total.toLocaleString()}`
      : `Loading nodes ${loaded.toLocaleString()} of ${total.toLocaleString()}`;
  }
  return locale === "zh"
    ? `正在加载节点 ${loaded.toLocaleString()}`
    : `Loading nodes ${loaded.toLocaleString()}`;
}

export function graphLoadEdgesProgressMessage(
  locale: GraphWorkspaceLocale,
  loaded: number,
  total: number | null,
): string {
  if (total) {
    return locale === "zh"
      ? `正在加载关系 ${loaded.toLocaleString()} / ${total.toLocaleString()}`
      : `Loading relationships ${loaded.toLocaleString()} of ${total.toLocaleString()}`;
  }
  return locale === "zh"
    ? `正在加载关系 ${loaded.toLocaleString()}`
    : `Loading relationships ${loaded.toLocaleString()}`;
}
