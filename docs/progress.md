# 开发进展

各 F-* 能力的 **done / partial / P0** 快照。能力定义见 [features.md](features.md)（**不在 features 里写状态**）。

| 章节 | 用途 |
| --- | --- |
| **§0** | 已交付主干（叙事摘要） |
| **§0.1** | F-* **整条**基线 `done` |
| **§0.2** | F-* **API 基线**已有；features 层仍可能 `partial` → gap 在 **§3.1** |
| **§3.1** | 产品化缺口（深链、UX、运维叙事） |
| **§3.2** | 端到端缺口（pipeline / 新 API / 全链路体验） |
| **§6** | P0 可执行验收（如 F-CHAT-01–03） |
| **§1–§2** | Explorer 迁移史、战略排除项 |

参考：[Explorer 集成](architecture/explorer.md)、[OpenAPI / MCP](architecture/openapi-v1.md) §6。

**Legend**

| Column | Meaning |
| --- | --- |
| **F-*** | Roadmap feature ID in [features.md](features.md) |
| **Status** | `done` · `partial` · `not` · `excluded` · `replaced` — **`done`** = 基线可交付（常含 REST/MCP；UI/企业化仍可不足）；**`partial`** = 仍有明确缺口 |
| **Priority** | `P0` must for KB GA slice · `P1` high value for enterprise/multi-user · `P2` optional / niche · `—` not applicable |
| **Migrate?** | Whether this was an Explorer→Basis **shell** migration item |
| **§0.2 / §3.1** | API 已交付但 F-* 在 features 层仍可能标 `partial` → API 记 §0.2，缺 UI/深链记 **§3.1** |
| **§3.2** | Pipeline、新 API 或体验均未闭环 |

---

## 0. 已交付主干（摘要）

| 域 | 已具备（2026-10） |
| --- | --- |
| **平台** | 注册/登录/session、用户管理、KB CRUD/成员/角色、KB API token、平台设置与模型目录、审计 |
| **文库与处理** | 文本/文件 ingest、processing jobs、chunk/抽取 pipeline；连接器 **webhook / http_poll / GitHub raw**（冻结种类） |
| **检索与图读** | 混合 chunk 搜索、graph search/neighbors/paths、Explorer 图页 + WS `projection_updated`、投影 rebuild |
| **账本与审核** | 开放陈述、review 队列（合并/导入/映射/remember/冲突）、ledger 读 API |
| **本体与推理** | Ontology Hub、SPARQL、映射；**rules REST CRUD**、`POST /api/v1/kbs/{id}/reasoning/run`；derived facts 投影 |
| **治理读 API** | Decisions list + chain（**F-GOV-07**）；Review 内嵌 + Decisions 页深链 |
| **Diff / 时态 / 任务** | `GET .../graph/diff` + 对比页（**F-DIFF-01** 读路径）；search/graph 时间 query（**F-SRCH-03**）；`GET .../ingest/jobs`（**F-SRC-08**） |
| **Agent 面** | MCP 13 工具 + JSON-RPC（`test_mcp_basic_graph_closed_loop`）、**remember 闭环**（propose + review approve） |
| **连接器** | Sources CRUD + sync（**F-SRC-06–07**，冻结 kind：webhook / http_poll / GitHub raw） |
| **其它** | Lineage、告警 SSE、图 import 经审核、KB 页副标题（**F-IF-03**） |

**§0.1 基线 `done`（F-ID）** — 不在 §3 重复：`F-RUL-01`–`03`、`F-SRC-06`–`07`、`F-CHAT-04`（MCP/HTTP remember）、`F-CHAT-05`、`F-GOV-06`（Registry 读面）、`F-GOV-07`（Review 决策叙事）、`F-ONT-05`（本体提案评审 UI）、`F-IF-03`、`F-SRCH-03`（Search↔Graph 时态 URL/深链）。**F-CHAT-01–03 / F-CHAT-06**（Web Playground）已 **`replaced`** — 见 **§6**。

**§0.2 API 基线（F-* 仍可能有 §3.1 产品化 gap）**

| F-* | 已具备（服务端 / 读路径） |
| --- | --- |
| F-GOV-07 | `GET .../decisions`、`GET .../decisions/{id}/chain` |
| F-DIFF-01 | `GET .../graph/diff` + Graph diff 对比页 |
| F-SRCH-03 | Chunk `as_of` / `created_*`；graph `at`；Web `searchUrlState` + `web/e2e/search-temporal-url.spec.ts` |
| F-SRC-08 | `GET .../ingest/jobs`、Sources `?job=` 深链 |
| F-RUL-03 | Derived facts 投影边 + ledger 读 API |

**§0.2 验收锚点（2026-10 代码对照）**

| F-* | OpenAPI / 路由 | 测试或 E2E |
| --- | --- | --- |
| F-GOV-07 | `GET .../decisions`、`GET .../decisions/{id}/chain` | `tests/test_kb_explorer_routes.py` |
| F-DIFF-01 | `GET .../graph/diff` | `tests/test_kb_explorer_routes.py`；`web/e2e/graph-diff.spec.ts` |
| F-SRCH-03 | search：`as_of`、`created_after`/`created_before`；graph read：`at` | `tests/test_chunk_search.py`（`as_of`） |
| F-SRC-08 | `GET .../ingest/jobs`、`GET .../ingest/jobs/{job_id}` | `tests/test_version_ingest.py`、`tests/test_m6_smoke.py`；Sources `?job=` → `web/e2e/processing-job.spec.ts` |
| F-CHAT-04 | MCP `approve_statement_remember_review` → `decision_id` | `tests/test_mcp.py` · `test_mcp_basic_graph_closed_loop` |
| F-ONT-05 | OWL 提案深链 | `kbOntologyProposalPath` · `web/src/lib/nav-config.test.ts`；Explorer `VersionsTab` |
| F-GOV-07 | Decisions `?decision=` 双向 + 复制深链 | `web/e2e/decisions-deep-link.spec.ts`（§3.1 UX） |
| F-RUL-03 | `GET .../ledger/derived-facts`、实体 facts 含 derived | `tests/test_derived_facts.py`；投影 `tests/test_graph_projector.py` |

§3：**§3.1** = 产品化（§0/§0.2 已有后端）；**§3.2** = 端到端仍缺 pipeline/API/体验。**完全 `done`** 只改 §0 / §0.1（及必要时 §0.2）。

---

## 1. Explorer shell migration (historical)

| Item | Status | Migrate? | Basis today |
| --- | --- | --- | --- |
| Standalone Explorer `App.tsx` / global `/api/graph` | `excluded` | N/A | Removed; only `/api/kbs/{id}/...` |
| Graph / Ontology / Vocabulary / SPARQL / Reasoning workspaces | `done` | Yes | Vendored `web/src/explorer/*` via `kb-*-workspace` + `explorerHttp` |
| Pure KB ontology & vocabulary paths | `done` | Yes | `ontologyKb` / `vocabularyKb` |
| Lineage (`F-LIN-01`) | `done` | Yes | `GET .../provenance` + `/kbs/:id/lineage` |
| KG overview (Manage tab) | `replaced` | Partial | KB settings → Graph tab stats |
| Entity merge property diff | `done` | Partial | Review + entity resolution UI |
| Memory Workspace | `excluded` | Was in shell | No UI/API; `agent_memory: false` |
| Registry **dedicated page** | `replaced` | Was in shell | Audit/ledger + review timeline; `registryStore` = session-only |
| Full-screen `ProposalReview` | `replaced` | Was in shell | `VersionsTab` inline approve/reject/publish only |
| Full-page **DiffMerge** studio | `not` | Was in shell | No whole-graph diff UI |
| X-API-Key / anonymous Explorer auth | `excluded` | N/A | JWT + KB roles |

---

## 2. Excluded or optional by product strategy

| F-* | Capability | Status | Priority | Value (when it matters) |
| --- | --- | --- | --- | --- |
| F-LAKE-01–03 (`F-CONN`) | Basis Connector (DB + AnyConnect 1,390+ SaaS) & table/action-to-entity mapping | `not` | P1 | Unified ledger ([ADR 0003](architecture/0003-lakehouse-datasets.md)); no separate Parquet/SQL warehouse |
| F-OPS-01–07 | Bidirectional entity sync (write-back) & AnyConnect 10,000+ declared actions | `not` | P1 | Dedicated `/kbs/:id/connectors` menu + unified ledger; see [features.md §5.16–5.18](features.md) + [adoption doc](architecture/helix-foundry-adoption.md) |
| F-MEM-* | Agent Memory browser + `/api/memories` | `excluded` | P2 | Long-lived agent notes separate from canonical KB |
| — | Direct graph merge/import (Explorer-style) | `excluded` | — | `409` → review queue by design |
| — | SPARQL UPDATE | `excluded` | — | Disabled by design |
| — | Global `/api/reason` | `excluded` | — | `410`; use `POST .../reasoning/run` |
| — | Server-side KB Chat API (`.../chat/sessions`) | `excluded` | — | MCP + Review（见 features §5.13；Web Playground 已 **replaced** §6） |

---

## 3. Roadmap gaps（`partial` · `not` · `deferred` · `open`）

不含 §0.1 **完全 done** 的 F-*。§0.2 所列 F-* 若仍在本节出现，通常只在 **§3.1**（缺 UI/深链/运维叙事）。

### 3.1 产品化缺口（API / MCP 见 §0、§0.2）

| F-* | 仍缺 | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-GOV-07 | 审核项详情内嵌决策叙事 | `done` | P1 | 主栏 **embedded** `review-item-decision-narrative`（批准横幅、已关闭深链、聚焦项）+ 侧栏 chain；E2E `governance.spec.ts` |
| F-DIFF-01 | 全图画布合并工作室（publish/staging） | `partial` | P1 | **`GET graph/staging`**（`manifest.session_key`）+ 浏览器 **merge 草稿**（对比页/画布预览共享）+ 点选/列表填表 → `POST graph/staging/entity-merge`；服务端 staging 仓仍 partial；E2E `graph-diff.spec.ts` |
| F-ONT-05 | 本体提案评审全流程 UI | `done` | P1 | `VersionsTab` 审批/发布 + `?ontologyProposal=` 高亮/弹窗 + 复制评审链接；E2E `ontology-proposal-url.spec.ts` |
| F-GOV-06 | Registry 可读产品面（非 Explorer 专页） | `done` | P1 | Review timeline + 设置 **Recent graph audit** 深链；**平台 `/admin/audit` Links 列**；管理员 → 平台审计（本库）；E2E `settings-graph-audit.spec.ts` |
| F-RUL-03 | Entities / 证明链 UI | `done` | P1 | Entities + derived 侧栏；前提/主客体深链（statement→entities、实体→graph）；E2E/单测 `derived-fact-premise-link` |
| F-ONT-09 | 推理工作台（规则试跑） | `done` | P1 | **Analyze** hub + legacy `/reasoning`；试跑 → 派生深链 **Entities**；Integration OpenAPI 提示；E2E `analyze-hub.spec.ts`、`reasoning-derived.spec.ts` |
| F-SRC-08 | 超大文件 / 队列运维 UX | `partial` | P1 | limits/queue + 选文件校验；**Sources→failed filter**、job **episode 告警深链**；error→sources 一致；E2E `processing-job.spec.ts` |
| F-CHAT-05 | 集成控制台（OpenAPI + MCP） | `done` | P1 | Integration OpenAPI：**导出** + **告警 REST** 提示；告警页 → OpenAPI 互链；E2E `mcp-integration.spec.ts` |
| F-KB-06 | 导出 pack 控制台入口与文档 | `done` | P2 | 设置 Graph **导出** ↔ 集成 **OpenAPI**；graph-diff **导出包**深链；E2E `settings-graph-audit.spec.ts` |

### 3.2 端到端缺口（pipeline / 能力仍 partial 或 not）

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-GOV-04 | Agent governor（batch clustering, gates） | `not` | P2 | Scale governance automation |
| F-GOV-05 | Impact gates + `governance.tripped` alerts | `partial` | P1 | emit + detail；**`?episode=` 告警深链**（processing/review）；E2E tripped→decisions；Review 相关告警 |
| F-SRC-05 | Extract pattern / ml / llm 作业选项与可观测 | `partial` | P1 | 处理对话框 **摘要+JSON 预览**；job 展开摘要与 raw JSON 标签对齐 |
| F-RUL-04 | Contradiction → governance queue | `partial` | P2 | `statement_conflict` queue + scan API |
| F-TIM-01–03 | valid_from/to, doc events, ingest vs graph 时态一致 | `partial` | P1 | **`GET documents/{id}/timeline`** + **Sources `?doc=` 时间线面板**（F-TIM-02）；snapshot↔diff 对齐；`valid_until` 投影仍 partial |
| F-TIM-04 | Timeline playback（产品导航） | `partial` | P1 | scrubber↔URL **`at`**；Search/graph **timeline=1**；**graph-diff 终点→timeline 回放**；E2E `graph-at.spec.ts` / `graph-diff.spec.ts` |
| — | `POST .../graph/distance-matrix` | `partial` | P2 | Server hop matrix when graph &gt; 2500 nodes |
| F-CHAT-01–03 | Web KB Playground | `replaced` | — | 控制台问答已移除；智能体用 MCP（§0.1 **F-CHAT-04–05**） |
| F-CHAT-06 | Playground 客户端控制 | `replaced` | — | 随 Playground 移除 |
| F-ALT-01–02 | Alert episodes + SSE refetch | `partial` | P1 | SSE + episode 分组 + **`?episode=` 高亮/深链**（processing/review）；E2E `governance.spec.ts` / `processing-job.spec.ts` |
| F-ACC-07 | Enterprise SSO / org | `partial` | P1 | Orgs + magic link/OAuth；full OIDC SSO TBD |
| F-IO-01 | Graph import/export | `partial` | — | Import via review；export 面不全 |
| — | Markdown node resources persistence | `open` | P2 | Policy TBD |
| M5-02 | semantica package entry for Graph workspace | `not` | P2 | Still vendored `web/src/explorer` |
| M4-04 | Cross-instance WS (Redis pub/sub) | `deferred` | P1 | Single worker or sticky sessions |

### 3.3 Basis Open Connector Protocol (BOCP) ↔ 本体账本双向同步跟踪（`F-LAKE` / `F-OPS`，未编码）

> **注**：原 `F-LAKE`（独立 Parquet 数据湖 / DuckDB 沙箱）及跨进程调用 Node.js TS 代码方案均已否定并废止；现统一为 **100% 纯 Python 原生的 Basis Open Connector Protocol (BOCP)**（融合 **Nango** 的 17 种声明式认证/增量状态机与 **Airbyte** 的 `DeclarativeSource` YAML 流抽取/`DISCOVER` 动态 Schema 发现 + **SQLAlchemy 2.0** 关系库适配器）↔ **证据账本（`entities` + `statements` + `typed_facts`）双向同步**，并在左侧栏「数据与抽取」下新增独立的 **「连接器 (`/kbs/:kbId/connectors`)」** 菜单。详见 [ADR 0003](architecture/0003-lakehouse-datasets.md)、[data-model §18](architecture/data-model.md)、[helix-foundry-adoption.md](architecture/helix-foundry-adoption.md)。

| 项 | Status | Notes |
| --- | --- | --- |
| 统一声明式连接器（BOCP）与账本双向同步架构（[ADR 0003](architecture/0003-lakehouse-datasets.md)） | `done` | 四大声明式原语（`Auth` / `Stream & Discover` / `Retriever & Sync` / `Mutation & Tool`）；入向 `Stream READ` 进账本，出向经 `Review` 调 `Stream MUTATE` 写回 |
| **Phase 1**：数据库迁移 `0011_entity_external_sync.sql`（**7 张表**）+ BOCP Manifest 契约与跨仓合成脚本 | `open` | [data-model §18](architecture/data-model.md) Planned DDL（4 张连接/OAuth/策略/日志表 + 3 张映射/外部键/Outbox 表）；`scripts/build_connector_manifests.py` 合成 Nango + Airbyte + AnyConnect 目录 |
| **Phase 2**：纯 Python 全模式认证引擎 + 双内核声明式流执行器（`sql_adapter` + `rest_declarative_adapter`） | `open` | 支持 `oauth2`/`oauth2_cc`/`basic`/`two_step`/`api_key`/`database_dsn`/`custom` + `CHECK` 自检；支持 SQLAlchemy `inspect` 与 Airbyte 风格 `DynamicSchemaLoader`、4 种自动分页器与父子流路由 |
| **Phase 3**：证据账本双向同步引擎（`connector_sync.py` + `entity_sync_outbox`） | `open` | 入向 `row_hash` 四路分流（`UNCHANGED` / `ADDED` / `UPDATED` / `DELETED`）与 `checkpoint_json` 水位线；出向经 `Review` 审批后执行写回并重算 `row_hash` 防回环 |
| **Phase 4**：OpenAPI / 唯一 Python MCP 暴露 + 独立「连接器 (`/kbs/:kbId/connectors`)」前端工作台 | `open` | 左侧栏「数据与抽取」新增「连接器」菜单（含连接目录、本体映射向导、动作策略、运行日志 4 个 Tab），`review.tsx` 展示 `Before → After` 字段级 Diff |

---

## 4. Suggested sequencing (KB-first product)

| Phase | Focus | Checklist rows |
| --- | --- | --- |
| **Now** | Operational KB loop | §3.2 F-TIM（F-SRCH-03 done）；§3.1 治理/本体（F-ONT-05、F-GOV-07） |
| **Next** | Time + ops | §3.2 F-GOV-05、F-TIM；§3.1 F-DIFF-01 工作室、F-SRC-08 ingest UX |
| **Then** | Time + ops visibility | §3.2 F-TIM-01–04, F-ALT-01–02 |
| **On demand** | Release engineering | §3.1 F-DIFF-01 工作室；§3.2 distance-matrix |
| **Enterprise option** | Basis Connector (BOCP) + operational ontology | §3.3 Phase 1–4（`F-LAKE-01–03` / `F-OPS-*`）；见 [adoption §6–§7](architecture/helix-foundry-adoption.md) |
| **If agents are first-class** | Memory separate from KB | F-MEM-* |

---

## 5. How to use this doc

- 能力定义变更 → [features.md](features.md)；**实现状态只改本文件**（`done` → §0 + §0.1；API 基线 → §0.2；gap → §3.1/§3.2）。
- P0/P1 项拆 GitHub issue，附 **§0.2 验收锚点** 或 **§6** 条目。
- Do **not** reopen Explorer shell items marked `excluded` or `replaced` unless product explicitly reverses ADR/design.

---

## 6. Web Playground（F-CHAT-01–03）— `replaced`

控制台 KB 问答 Playground（`/kbs/:id/chat`、浏览器 LLM + MCP 编排）已移除。产品内 agent 集成保留 **MCP + Review**（**F-CHAT-04–05**，§0.1）。

闭环 **agent** 路径：`tests/test_mcp.py` · `test_mcp_basic_graph_closed_loop`；MCP `approve_statement_remember_review` 与 HTTP 同返回 **`decision_id`**；控制台 **`/kbs/:id/integration`**（E2E `mcp-integration.spec.ts`）。

---

_Last updated: 2026-10-19 — §3.3 Basis Connector（数据库 + AnyConnect 融合）↔ 本体账本双向同步路线图；[helix-foundry-adoption.md](architecture/helix-foundry-adoption.md) 补全。_
