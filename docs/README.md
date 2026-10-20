# 文档

## 产品与交付

| 文档 | 说明 |
| --- | --- |
| [features.md](features.md) | 功能清单（F-* 定义与分期） |
| [progress.md](progress.md) | 开发进展、§0 基线、§3 gap、验收清单 |

## 架构

[architecture/README.md](architecture/README.md) — ADR、包布局、数据模型、OpenAPI/MCP、Explorer、BOCP。

常用入口：

| 主题 | 文档 |
| --- | --- |
| Python 包结构 | [architecture/package-layout.md](architecture/package-layout.md) |
| 证据账本与表 | [architecture/data-model.md](architecture/data-model.md) |
| HTTP / MCP 契约 | [architecture/openapi-v1.md](architecture/openapi-v1.md) · live `/openapi/v1.json` · `openapi/basis-v1*.json` |
| Explorer 后端 | [architecture/explorer-backend.md](architecture/explorer-backend.md) |
| 连接器 | [architecture/connectors/bocp.md](architecture/connectors/bocp.md) · [architecture/connectors/product.md](architecture/connectors/product.md) |

面向用户的安装与概念说明见 Web **`/docs/*`**（`web/content/docs/`，部分页 symlink 到 `docs/architecture/` 的 BOCP/连接器文档）。

## 运维

| 文档 | 说明 |
| --- | --- |
| [operations/enterprise-sso.md](operations/enterprise-sso.md) | 企业 SSO 签收与 IdP 配置 |
| [operations/logto-oidc-dev.md](operations/logto-oidc-dev.md) | 本地 Logto OIDC 联调 |
| [operations/enterprise-sso-signoff-record.md](operations/enterprise-sso-signoff-record.md) | SSO 签收记录模板 |

部署与备份见根目录 [README.md](../README.md#operations)。
