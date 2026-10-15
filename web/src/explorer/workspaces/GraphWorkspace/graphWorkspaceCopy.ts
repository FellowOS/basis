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
  viewFullGraph: { zh: "全图", en: "Full Graph" },
  viewFullGraphTitle: { zh: "返回全图上下文", en: "Return to the full graph context" },
  viewGrouped: { zh: "分组", en: "Grouped View" },
  viewGroupedTitle: {
    zh: "将密集结构压缩为检测到的社区",
    en: "Compress dense structure into detected communities",
  },
  viewFocus: { zh: "聚焦", en: "Focus" },
  viewFocusTitle: {
    zh: "在局部子图中查看所选节点",
    en: "Inspect the selected node in a focused local graph",
  },
  zoomIn: { zh: "放大", en: "Zoom In" },
  zoomInTitle: { zh: "放大（或在画布上向上滚动）", en: "Zoom in (or scroll up on the canvas)" },
  zoomOut: { zh: "缩小", en: "Zoom Out" },
  zoomOutTitle: { zh: "缩小（或在画布上向下滚动）", en: "Zoom out (or scroll down on the canvas)" },
  fitView: { zh: "适配", en: "Fit" },
  fitViewTitle: { zh: "重置相机以适配整张图", en: "Reset the camera to fit the whole graph" },
  layoutPause: { zh: "暂停", en: "Pause" },
  layoutRun: { zh: "运行", en: "Run" },
  layoutToggleTitle: { zh: "切换布局计算", en: "Toggle the layout worker" },
  collapse: { zh: "折叠", en: "Collapse" },
  expand: { zh: "展开", en: "Expand" },
  collapseNeighborhoodTitle: {
    zh: "隐藏所选节点周围较低优先级的扇出",
    en: "Hide lower-priority fanout around the selected node",
  },
  expandNeighborhoodTitle: {
    zh: "恢复已折叠的局部邻域",
    en: "Restore the collapsed local neighborhood",
  },
  pluginEffects: { zh: "效果", en: "Effects" },
  pluginEffectsTitle: { zh: "打开探索效果控制", en: "Open exploration effects controls" },
  pluginNeighbors: { zh: "邻域", en: "Neighbors" },
  pluginNeighborsTitle: { zh: "切换邻域面板", en: "Toggle neighborhood panel" },
  pluginTemporal: { zh: "时间", en: "Temporal" },
  pluginTemporalTitle: { zh: "切换时间上下文面板", en: "Toggle temporal context panel" },
  timelineDiffLink: {
    zh: "对比时间范围内的图变更 →",
    en: "Compare graph changes over time →",
  },
  toolbarCamera: { zh: "视图", en: "Camera" },
  toolbarLayout: { zh: "布局", en: "Layout" },
  toolbarLocal: { zh: "局部", en: "Local" },
  toolbarDistance: { zh: "距离", en: "Distance" },
  toolbarAnalysis: { zh: "分析", en: "Analysis" },
  egoMode: { zh: "自我中心", en: "Ego Mode" },
  egoModeActive: { zh: "自我中心", en: "Ego" },
  egoModeTitleOff: {
    zh: "以所选节点为中心显示景深淡化",
    en: "Show depth-of-field fading around the selected node",
  },
  heatmap: { zh: "热力图", en: "Heatmap" },
  heatmapActiveTitle: { zh: "距离热力图已开启（点击关闭）", en: "Distance heatmap active (click to toggle off)" },
  heatmapTitleOff: {
    zh: "按跳数距离为节点着色",
    en: "Color nodes by hop distance from selected node",
  },
  distStructural: { zh: "结构", en: "Structural" },
  distStructuralTitle: { zh: "按结构（跳数）距离为边着色", en: "Color edges by structural (hop) distance" },
  distSemantic: { zh: "语义", en: "Semantic" },
  distSemanticTitle: {
    zh: "按与所选节点的语义相似度为边着色",
    en: "Color edges by semantic similarity to selected node",
  },
  searchPlaceholder: { zh: "搜索节点", en: "Search nodes" },
  searchReloadTitle: { zh: "重新加载图谱数据", en: "Reload graph data" },
  searchDismiss: { zh: "关闭", en: "Dismiss" },
  searchDismissAria: { zh: "关闭搜索结果", en: "Dismiss search results" },
  apiSearchFailed: { zh: "搜索失败", en: "Search failed" },
  apiLinkPredictionFailed: { zh: "链路预测失败", en: "Link prediction failed" },
  apiPathLookupFailed: { zh: "路径查询失败", en: "Path lookup failed" },
  apiProvenanceReportFailed: { zh: "溯源报告失败", en: "Provenance report failed" },
  projectionRefreshed: {
    zh: "图谱投影已更新，正在重新加载…",
    en: "Graph projection updated — reloading…",
  },
  viewerReadOnly: {
    zh: "只读浏览",
    en: "View only",
  },
} satisfies Record<string, CopyPair>;

export function graphEgoModeLabel(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoMode");
  }
  return locale === "zh" ? `自我中心 (${hops}跳)` : `Ego (${hops}h)`;
}

export function graphEgoModeTitle(
  locale: GraphWorkspaceLocale,
  enabled: boolean,
  hops: number,
): string {
  if (!enabled) {
    return graphCopy(locale, "egoModeTitleOff");
  }
  return locale === "zh"
    ? `自我中心视图：${hops} 跳深度（点击关闭）`
    : `Egocentric view: ${hops} hops depth (click to toggle off)`;
}

export function graphStatusCounts(
  locale: GraphWorkspaceLocale,
  nodes: number,
  edges: number,
): string {
  const n = nodes.toLocaleString();
  const e = edges.toLocaleString();
  return locale === "zh" ? `${n} 节点 · ${e} 边` : `${n} nodes · ${e} edges`;
}

export function graphActiveCountLabel(locale: GraphWorkspaceLocale, count: number): string {
  const formatted = count.toLocaleString();
  return locale === "zh" ? `${formatted} 活跃` : `${formatted} active`;
}

export function graphSearchResultsLabel(locale: GraphWorkspaceLocale, count: number): string {
  if (locale === "zh") {
    return `${count} 条结果`;
  }
  return `${count} result${count === 1 ? "" : "s"}`;
}

export function graphFocusedViewSummary(
  locale: GraphWorkspaceLocale,
  visibleNeighbors: number,
): string {
  const total = visibleNeighbors + 1;
  return locale === "zh"
    ? `聚焦视图中有 ${total} 个节点`
    : `${total} nodes in focused view`;
}

export function graphGroupedSummaryAvailable(locale: GraphWorkspaceLocale): string {
  return locale === "zh"
    ? "社区已压缩为分组结构视图"
    : "Communities compressed into grouped structure view";
}

export function graphGroupedSummaryDrillIn(locale: GraphWorkspaceLocale): string {
  return locale === "zh"
    ? "分组结构视图，可直接钻取社区"
    : "Grouped structure view with direct community drill-in";
}

export function graphNeighborSummary(
  locale: GraphWorkspaceLocale,
  visible: number,
  collapsed: number,
): string {
  return locale === "zh"
    ? `${visible} 个可见邻居，${collapsed} 个已折叠`
    : `${visible} visible neighbors, ${collapsed} collapsed`;
}

export function graphDirectNeighborsSummary(
  locale: GraphWorkspaceLocale,
  count: number,
): string {
  return locale === "zh"
    ? `已高亮 ${count} 个直接邻居`
    : `${count} direct neighbors highlighted`;
}

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
