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
| **Agent 面** | MCP **20** 工具（图闭环 13 + 连接器 7）+ JSON-RPC（`test_mcp_basic_graph_closed_loop`）、**remember 闭环**（propose + review approve） |
| **连接器** | Sources CRUD + sync（**F-SRC-06–07**）；**BOCP 1,060+ 声明式连接器 + 账本双向同步**（**F-LAKE-01–03** / **F-OPS-01–07**，`/kbs/:id/connectors`） |
| **其它** | Lineage、告警 SSE、图 import 经审核、KB 页副标题（**F-IF-03**） |

**§0.1 基线 `done`（F-ID）** — 不在 §3 重复：`F-RUL-01`–`04`、`F-SRC-06`–`07`、`F-LAKE-01`–`03`、`F-OPS-01`–`07`、`F-CHAT-04`（MCP/HTTP remember）、`F-CHAT-05`、`F-GOV-05`（影响门控 + `governance.tripped` 告警）、`F-GOV-06`（Registry 读面）、`F-GOV-07`（Review 决策叙事）、`F-ONT-05`（本体提案评审 UI）、`F-IF-03`、`F-SRCH-03`（Search↔Graph 时态 URL/深链）。**F-CHAT-01–03 / F-CHAT-06**（Web Playground）已 **`replaced`** — 见 **§6**。

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
| F-GOV-05 | `GET .../alerts`（`governance.tripped` detail）；Review approve 门控 | `tests/test_kb_alerts_emit.py`、`tests/test_kb_review.py`；`web/e2e/governance.spec.ts` |
| F-RUL-04 | `POST …/review/scan-statement-conflicts`；approve `keeper_statement_id` | `tests/test_conflict_review.py`；`web/e2e/governance.spec.ts` |
| F-RUL-03 | `GET .../ledger/derived-facts`、实体 facts 含 derived | `tests/test_derived_facts.py`；投影 `tests/test_graph_projector.py` |
| F-ACC-07 | `GET .../auth/org-sso-options`、`org-sso-hint`；`GET .../auth/oidc/{slug}/start` | `tests/test_organizations_sso.py`；`web/e2e/org-sso-login.spec.ts` |

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
| F-LAKE-01–03 (`F-CONN`) | Basis Open Connector Protocol (DB + 1,060+ SaaS) & stream-to-entity mapping | `done` | P1 | Unified ledger ([ADR 0003](architecture/0003-lakehouse-datasets.md)); see §3.3 |
| F-OPS-01–07 | Bidirectional entity sync (write-back) & Outbox review governance | `done` | P1 | Dedicated `/kbs/:id/connectors` workspace + Review write-back diff; see §3.3 |
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
| F-DIFF-01 | 全图画布合并工作室（publish/staging） | `done` | P1 | **`GET graph/staging`**（`manifest.session_key` + `manifest.draft`）+ 服务端 `kb_graph_staging_sessions` 持久化（`PUT .../graph/staging/{session_key}/draft`）与浏览器草稿双写同步 + 点选/列表填表 → `POST graph/staging/entity-merge`；单测 `tests/test_graph_staging.py`、E2E `graph-diff.spec.ts` |
| F-ONT-05 | 本体提案评审全流程 UI | `done` | P1 | `VersionsTab` 审批/发布 + `?ontologyProposal=` 高亮/弹窗 + 复制评审链接；E2E `ontology-proposal-url.spec.ts` |
| F-GOV-06 | Registry 可读产品面（非 Explorer 专页） | `done` | P1 | Review timeline + 设置 **Recent graph audit** 深链；**平台 `/admin/audit` Links 列**；管理员 → 平台审计（本库）；E2E `settings-graph-audit.spec.ts` |
| F-RUL-03 | Entities / 证明链 UI | `done` | P1 | Entities + derived 侧栏；前提/主客体深链（statement→entities、实体→graph）；E2E/单测 `derived-fact-premise-link` |
| F-ONT-09 | 推理工作台（规则试跑） | `done` | P1 | **Analyze** hub + legacy `/reasoning`；试跑 → 派生深链 **Entities**；Integration OpenAPI 提示；E2E `analyze-hub.spec.ts`、`reasoning-derived.spec.ts` |
| F-SRC-08 | 超大文件 / 队列运维 UX | `done` | P1 | **Sources/Processing 共用** `kb-ingest-ops-hints` + E2E 文案一致（`processing-job.spec.ts`）；上传超限客户端校验 + extract 上限提示；**Sources→failed filter**、job **episode 告警深链**；行内 job 错误一致；`scripts/bocp_pg_smoke.py` |
| F-CHAT-05 | 集成控制台（OpenAPI + MCP） | `done` | P1 | Integration OpenAPI：**导出** + **告警 REST** 提示；告警页 → OpenAPI 互链；E2E `mcp-integration.spec.ts` |
| F-KB-06 | 导出 pack 控制台入口与文档 | `done` | P2 | 设置 Graph **导出** ↔ 集成 **OpenAPI**；graph-diff **导出包**深链；E2E `settings-graph-audit.spec.ts` |

### 3.2 端到端缺口（pipeline / 能力仍 partial 或 not）

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-GOV-04 | Agent governor（batch clustering, gates） | `done` | P2 | **Phase A–D**：`governor/run`（冲突 + 低置信 + 标签聚类 + **图语义 dedup** → `entity_cluster`）；config + 调度 + Review UI；`tests/test_governor*.py`、`test_governor_graph_dedup.py`；[ADR 0005](architecture/0005-agent-governor.md) |
| F-SRC-05 | Extract pattern / ml / llm 作业选项与可观测 | `done` | P1 | 共用 **`KbProcessingOptionsSnapshot`**（Sources 处理对话框 + Processing job 展开：摘要、`optionsSnapshotRaw` 标签、JSON testid）；E2E `processing-job.spec.ts` |
| F-TIM-01–03 | valid_from/to, doc events, ingest vs graph 时态一致 | `done` | P1 | **`GET documents/{id}/timeline`** + **Sources `?doc=` 时间线面板**（F-TIM-02）；`build_temporal_graph_from_ledger` 将 `invalidated_at` 投影为节点/边 `valid_until`，驱动 `temporal/snapshot`、`temporal/diff`、`graph/diff` 与 `graph/staging` 时态区间过滤（`tests/test_graph_projector.py`） |
| F-TIM-04 | Timeline playback（产品导航） | `done` | P1 | scrubber↔URL **`at`**；Search/graph **timeline=1**；**graph-diff 终点→timeline 回放**；`temporal/snapshot` 返回精确 `active_node_ids`/`active_node_count`；E2E `graph-at.spec.ts` / `graph-diff.spec.ts` |
| — | `POST .../graph/distance-matrix` | `done` | P2 | Graph &gt; **2500** 节点时 ego/heatmap 走服务端 hop 矩阵（`graphDistanceMatrix.ts` + `GraphWorkspace`）；单测 `graphDistanceMatrix.test.ts`、`tests/test_kb_explorer_routes.py` |
| F-CHAT-01–03 | Web KB Playground | `replaced` | — | 控制台问答已移除；智能体用 MCP（§0.1 **F-CHAT-04–05**） |
| F-CHAT-06 | Playground 客户端控制 | `replaced` | — | 随 Playground 移除 |
| F-ALT-01–02 | Alert episodes + SSE refetch | `done` | P1 | SSE + episode 分组 + **`?episode=` 高亮**；Processing/Review → 告警 episode 互链 + 告警页 **复制 episode 链接**；E2E `governance.spec.ts` / `processing-job.spec.ts` |
| F-ACC-07 | Enterprise SSO / org | `partial` | P1 | **OIDC** + **SAML 2.0**（`org_saml_configs`、`GET|PUT …/saml`、SP metadata/ACS/start；`uv sync --extra saml`）；**OrgSsoPanel** + **OrgSamlPanel**；登录发现含 `protocol`；[ADR 0006](architecture/0006-org-saml.md)；**Logto/生产 IdP 签收**仍 open |
| F-IO-01 | Graph import/export | `done` | — | Import JSON/CSV → review；Export：**全图/子图 `node_ids`** + RDF/GraphML；**审计包**（图 JSON + 图审计 + projection；graph-diff 含 staging）；`tests/test_kb_explorer_routes.py` |
| — | Markdown node resources persistence | `open` | P2 | Policy TBD |
| — | Desktop profile（ADR 0004） | `deferred` | P2 | `main` 上 Phase A 可忽略（不设 `BASIS_DEPLOYMENT_PROFILE=desktop`）；Electron / Phase B+ 暂缓，优先 Server 能力 |
| M5-02 | semantica package entry for Graph workspace | `not` | P2 | Still vendored `web/src/explorer` |
| M4-04 | Cross-instance WS (Redis pub/sub) | `deferred` | P1 | Single worker or sticky sessions |

### 3.3 Basis Open Connector Protocol (BOCP) ↔ 本体账本双向同步跟踪（`F-LAKE` / `F-OPS`）

> **注**：原 `F-LAKE`（独立 Parquet 数据湖 / DuckDB 沙箱）及跨进程调用 Node.js TS 代码方案均已否定并废止；现统一为 **100% 纯 Python 原生的 Basis Open Connector Protocol (BOCP)**（融合 **Nango** 的 17 种声明式认证/增量状态机与 **Airbyte** 的 `DeclarativeSource` YAML 流抽取/`DISCOVER` 动态 Schema 发现 + **SQLAlchemy 2.0** 关系库适配器）↔ **证据账本（`entities` + `statements` + `typed_facts`）双向同步**；KB 侧栏 **连接器** 独立分区（`/kbs/:kbId/connectors/{catalog,mappings,policy,runs}`），平台 **系统管理 → 连接器**（`/admin/connectors`）配置实例级 Provider 上限。详见 [ADR 0003](architecture/0003-lakehouse-datasets.md)、[data-model §18](architecture/data-model.md)、[helix-foundry-adoption.md](architecture/helix-foundry-adoption.md)。

| 项 | Status | Notes |
| --- | --- | --- |
| 统一声明式连接器（BOCP）与账本双向同步架构（[ADR 0003](architecture/0003-lakehouse-datasets.md)） | `done` | 四大声明式原语（`Auth` / `Stream & Discover` / `Retriever & Sync` / `Mutation & Tool`）；入向 `Stream READ` 进账本，出向经 `Review` 调 `Stream MUTATE` 写回 |
| **Phase 1**：数据库迁移 `0011_entity_external_sync.sql`（**7 张表**）+ BOCP Manifest 契约与跨仓合成脚本 | `done` | 迁移 `0011` + PG `version 12`、实体删除级联清理、`basis/domain/connectors/manifest_schema.py` & `catalog.py`、`basis/domain/kb/structured_models.py`、`scripts/build_connector_manifests.py`（合成 1,060 个 Provider Manifest）；单测 `tests/test_bocp_phase1.py` |
| **Phase 2**：纯 Python 全模式认证引擎 + 双内核声明式流执行器（`sql_adapter` + `rest_declarative_adapter`） | `done` | `auth_vault.py`（AES-256-GCM 凭据加密、OAuth2 PKCE URL 生成、策略门禁）、`sql_adapter.py`（SQLAlchemy 2.0 反射 + 参数化读写）、`rest_declarative_adapter.py`（`DynamicSchemaLoader`、自动分页与字段展开）、`runtime.py`；单测 `tests/test_bocp_phase2.py` |
| **Phase 3**：证据账本双向同步引擎（`connector_sync.py` + `entity_sync_outbox`） | `done` | `basis/domain/kb/connector_sync.py`（入向 `row_hash` 四路分流 `ADDED`/`UNCHANGED`/`UPDATED`/`DELETED`、外键关系解析、出向 `propose_entity_writeback` → `review_items` 门禁 → `approve_and_execute_outbox` 写回与防回环 `row_hash` 重算）；单测 `tests/test_bocp_phase3.py` |
| **Phase 4**：OpenAPI / 唯一 Python MCP 暴露 + 独立「连接器 (`/kbs/:kbId/connectors`)」前端工作台 | `done` | `basis/transport/http/routes/v1/kb_connectors.py`（12 个 OpenAPI v1 端点）、`basis/integration/ops_connectors.py`（MCP：`list_connector_catalog`、`describe_connector_service`、`list_connector_connections`、`list_connector_table_mappings`、`sync_connector_table_mapping`、`propose_entity_writeback`、`execute_connector_tool`）、`kb_review.py` 写回审批闭环；前端连接器工作台 + Review Diff；单测 `tests/test_bocp_phase4_api.py`、`tests/test_ops_connectors.py` |
| **Phase 4+**：平台双层 Provider 治理 + 管理台 | `done` | 迁移 `0012_platform_connector_allowlist.sql`（PG v13）+ `settings.connector_allowed_providers`；`GET|PUT /api/v1/settings/connectors`、`GET …/catalog`、`GET …/catalog/stats`、`GET …/catalog/{service}`、`POST …/validate`；KB `connectors/policy` 返回 `platform_allowed_providers` / `effective_allowed_providers`；控制台 `/admin/connectors`（侧栏 **管理** 导航 + 面包屑、目录浏览、分类统计、JSON/CSV 导入导出、Manifest 详情）；KB 侧栏独立 **连接器** 分区四路由（`catalog` / `mappings` / `policy` / `runs`）；映射 `poll_interval_minutes` + 与 `BASIS_HTTP_POLL_TICK_SECONDS` 共用的后台入向同步调度（`connector_poll_scheduler.py`）；单测 `tests/test_connector_allowlist.py`、`tests/test_connector_poll_scheduler.py`、`web/e2e/connectors.spec.ts` |
| **Live PG 验收** | `done` | `scripts/bocp_pg_smoke.py`：`public.customers` 入向 sync + `tier` 写回（`propose` → `connector_writeback` approve → outbox `synced` → 再 sync `unchanged`）；实体 `ent_7639…` / `ent_ee36…` |

---

## 4. Suggested sequencing (KB-first product)

| Phase | Focus | Checklist rows |
| --- | --- | --- |
| **Now** | Operational KB loop | §3.2 F-TIM（F-SRCH-03 done）；§3.1 治理/本体（F-ONT-05、F-GOV-07） |
| **Next** | Ops + scale | §3.1 **F-ACC-07**（生产 IdP 签收、SAML 加固：签名 AuthnRequest / SLO） |
| **Deferred** | Desktop | ADR 0004 Phase B+（Electron）；不设 desktop env 即可 |
| **Then** | Graph scale + I/O | §3.2 distance-matrix、F-IO-01；M5-02 Explorer 打包 |
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
