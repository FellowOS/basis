export default {
  wizard: {
    title: "数据与本体向导",
    subtitle: "连接外部系统、采纳跨 stream 的连接器映射建议，并完成首次同步写入账本（不包含 OWL 发布）。",
    steps: {
      connections: "连接",
      suggest: "建议映射",
      done: "首次同步",
    },
    connections_title: "已配置连接",
    connections_subtitle: "若列表为空，请先在目录中添加连接。",
    loading_connections: "正在加载连接…",
    no_connections: "尚无连接。请先连接数据库或 SaaS 数据源。",
    open_catalog: "打开授权",
    sql_tables_label: "SQL 表（可选）",
    sql_tables_placeholder: "accounts\ncustomers\npostgres:orders",
    sql_tables_hint:
      "可选。留空时将对 SQL 连接自动枚举库表（最多 8 张）生成建议；也可每行指定一张表，多连接时用服务名前缀（例如 postgres:orders）。",
    continue_to_suggest: "生成映射建议",
    suggest_title: "跨 stream 实体建议",
    suggest_subtitle: "按推断实体类型分组审阅草稿，保存并同步。",
    suggest_hint: "打开建议面板，基于 DISCOVER 为已保存连接生成映射草稿。",
    reopen_suggest: "打开建议面板",
    done_title: "映射已保存",
    done_subtitle: "已创建 {count} 条连接器映射并完成首次同步。",
    view_mappings: "查看连接器映射",
    view_entities: "查看实体",
  },
  menu: {
    data_ontology_wizard: "接入向导",
  },
} as const;
