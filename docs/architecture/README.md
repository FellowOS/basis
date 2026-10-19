# 架构文档

| 文件 | 内容 |
| --- | --- |
| [0001-canonical-knowledge-model.md](0001-canonical-knowledge-model.md) | ADR：证据账本主存，图为投影 |
| [0002-organization-tenant-sso.md](0002-organization-tenant-sso.md) | ADR：组织租户与 SSO |
| [0003-lakehouse-datasets.md](0003-lakehouse-datasets.md) | ADR：统一账本下的 Basis Connector（数据库 + AnyConnect SaaS）接入与实体双向同步 |
| [data-model.md](data-model.md) | 持久化：账本、blob、审核、迁移、Basis Connector 与实体双向同步（§18） |
| [package-layout.md](package-layout.md) | `basis/` 分层与 `integration/` |
| [search-and-vectors.md](search-and-vectors.md) | 分块、向量、检索策略 |
| [openapi-v1.md](openapi-v1.md) | OpenAPI 两面 + MCP §6 |
| [explorer.md](explorer.md) | Explorer 多 KB Session、路由、WS |
| [helix-foundry-adoption.md](helix-foundry-adoption.md) | Basis Connector 架构、表/Action 本体映射、双向写回与 AnyConnect 代码迁移方案 |

功能范围：[features.md](../features.md)（F-* 定义）。进展：[progress.md](../progress.md)（§0 已交付 · §0.1/§0.2 基线 · §3 gap）。
