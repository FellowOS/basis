export default {
  page: {
    filter_placeholder: "按 ID、类别、结果筛选…",
    decision_count: "{count} 条决策",
    decision_count_one: "1 条决策",
    no_decisions: "无决策",
    no_matches: "无匹配",
    empty_list: "图谱中暂无决策记录。",
    adjust_filter: "请调整筛选条件。",
    partial_load_list: "警告：决策列表仅部分加载成功。",
    partial_load_chain: "警告：因果链仅部分加载成功。",
    outcome_unknown: "未知",
    outcome_labels: {
      approved: "已批准",
      rejected: "已驳回",
      deferred: "已推迟",
      pending: "待处理",
      blocked: "已阻断"
    },
    category_labels: {
      governance: "治理",
      reasoning: "推理",
      merge: "合并",
      import: "导入"
    },
    chain_arrow: "→",
    step_type_labels: {
      "prov:_activity": "活动",
      "prov:_entity": "实体",
      "prov:_agent": "主体",
      "prov:_plan": "计划"
    },
    relationship_labels: {
      was_derived_from: "派生自",
      was_generated_by: "由…生成",
      used: "使用",
      was_associated_with: "关联于",
      acted_on_behalf_of: "代表"
    },
    chain_empty_title: "无链步骤",
    chain_empty_body: "该决策未找到因果链步骤。",
    record_eyebrow: "决策记录",
    copy_deep_link: "复制深链",
    copy_deep_link_done: "已复制链接",
    causal_chain: "因果链",
    chain_step_count: "{count} 步",
    chain_step_count_one: "1 步",
    none_selected_title: "未选择决策",
    none_selected_body: "从列表中选择一条决策以查看因果链与元数据。",
    subtitle: "治理决策与因果链记录；从告警可深链到具体决策。",
    loading: "加载决策记录…"
  },
  menu: {
    decisions: "决策记录"
  }
} as const;
