# Sema 设计文档

| 文档 | 内容 |
| --- | --- |
| [product-and-roadmap.md](product-and-roadmap.md) | **第一篇**：完整功能设计（F-* 能力、数据模型、API/UI 总表、实现状态）；**第二篇**：分期交付 |
| [data-model.md](data-model.md) | SQLite、blob、账本、审核、Chat、图投影的数据结构与迁移约束 |
| [explorer-integration.md](explorer-integration.md) | Explorer 多 KB Session、路由、JWT/角色、WS、持久化与前端组件复用契约 |
| [implementation-backlog.md](implementation-backlog.md) | 首个「证据摄入 → 图投影 → Explorer 图页面」纵向切片的任务、依赖与验收 |

## 已接受决策

| ADR | 决策 |
| --- | --- |
| [0001](../decisions/0001-canonical-knowledge-model.md) | 证据账本为主存；开放陈述 → 映射 → 类型化事实；ContextGraph/RDF/向量为投影 |

运行与依赖说明见仓库根目录 [README.md](../../README.md)。
