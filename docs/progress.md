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
| F-LAKE-01–03 | Lakehouse: mount tables/Parquet, Ontology2SQL, declared actions | `not` | P2 | Pairs with **F-OPS**; not required for document→graph KB loop |
| F-OPS-01–07 | Operational ontology (Palantir-style actions, functions, object↔dataset, OSDK-lite) | `not` | P2 | Second product track on ADR 0001; see [features.md §5.18](features.md) |
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
| F-DIFF-01 | 全图画布合并工作室（publish/staging） | `partial` | P1 | diff 读 + 对比页 **as_of/at 说明** + 治理 callout + 复制链接；全画布 staging **not**；E2E `graph-diff-cross-link.spec.ts` |
| F-ONT-05 | 本体提案评审全流程 UI | `done` | P1 | `VersionsTab` 审批/发布 + `?ontologyProposal=` 高亮/弹窗 + 复制评审链接；E2E `ontology-proposal-url.spec.ts` |
| F-GOV-06 | Registry 可读产品面（非 Explorer 专页） | `done` | P1 | Review timeline + 设置 **Recent graph audit** 深链；**平台 `/admin/audit` Links 列**；管理员 → 平台审计（本库）；E2E `settings-graph-audit.spec.ts` |
| F-RUL-03 | Entities / 证明链 UI | `done` | P1 | Entities + derived 侧栏；前提/主客体深链（statement→entities、实体→graph）；E2E/单测 `derived-fact-premise-link` |
| F-ONT-09 | 推理工作台（规则试跑） | `done` | P1 | **Analyze** hub + legacy `/reasoning`；试跑 → 派生深链 **Entities**；Integration OpenAPI 提示；E2E `analyze-hub.spec.ts`、`reasoning-derived.spec.ts` |
| F-SRC-08 | 超大文件 / 队列运维 UX | `partial` | P1 | 上传前校验 + capabilities **upload-only** 提示；processing↔资料深链；E2E `processing-job.spec.ts` |
| F-CHAT-05 | 集成控制台（OpenAPI + MCP） | `done` | P1 | `/kbs/:id/integration` 三 tab：**MCP** / **OpenAPI** / **访问令牌**；legacy `/mcp`、`chat?tab=connect` 重定向；E2E `mcp-integration.spec.ts` |
| F-KB-06 | 导出 pack 控制台入口与文档 | `partial` | P2 | 设置 Graph **导出** ↔ 集成 **OpenAPI** 互链（`POST .../export`）；E2E `settings-graph-audit.spec.ts` |

### 3.2 端到端缺口（pipeline / 能力仍 partial 或 not）

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-GOV-04 | Agent governor（batch clustering, gates） | `not` | P2 | Scale governance automation |
| F-GOV-05 | Impact gates + `governance.tripped` alerts | `partial` | P1 | review（`maybe_emit_governance_tripped_on_review_approve`）+ 本体 approve/publish（AdminError + **SHACL 结果**）；merge/import `invoke_explorer`；E2E `governance.spec.ts` |
| F-SRC-05 | Extract pattern / ml / llm 作业选项与可观测 | `partial` | P1 | spaCy + Models Chat for `llm` NER |
| F-RUL-04 | Contradiction → governance queue | `partial` | P2 | `statement_conflict` queue + scan API |
| F-TIM-01–03 | valid_from/to, doc events, ingest vs graph 时态一致 | `partial` | P1 | 检索 + 图谱 scrubber + **graph-diff `temporalCompareHint`**；引擎/API 仍 partial |
| F-TIM-04 | Timeline playback（产品导航） | `partial` | P1 | 底部 scrubber↔URL **`at`** + 回放说明；检索无「打开时间轴」；dock `timeline=1`；E2E `graph-at.spec.ts` |
| — | `POST .../graph/distance-matrix` | `partial` | P2 | Server hop matrix when graph &gt; 2500 nodes |
| F-CHAT-01–03 | Web KB Playground | `replaced` | — | 控制台问答已移除；智能体用 MCP（§0.1 **F-CHAT-04–05**） |
| F-CHAT-06 | Playground 客户端控制 | `replaced` | — | 随 Playground 移除 |
| F-ALT-01–02 | Alert episodes + SSE refetch | `partial` | P1 | unread + mark-all-read + dismiss-all；**processing.failed**→`/processing?job=`；E2E `governance.spec.ts` |
| F-ACC-07 | Enterprise SSO / org | `partial` | P1 | Orgs + magic link/OAuth；full OIDC SSO TBD |
| F-IO-01 | Graph import/export | `partial` | — | Import via review；export 面不全 |
| — | Markdown node resources persistence | `open` | P2 | Policy TBD |
| M5-02 | semantica package entry for Graph workspace | `not` | P2 | Still vendored `web/src/explorer` |
| M4-04 | Cross-instance WS (Redis pub/sub) | `deferred` | P1 | Single worker or sticky sessions |

---

## 4. Suggested sequencing (KB-first product)

| Phase | Focus | Checklist rows |
| --- | --- | --- |
| **Now** | Operational KB loop | §3.2 F-TIM（F-SRCH-03 done）；§3.1 治理/本体（F-ONT-05、F-GOV-07） |
| **Next** | Time + ops | §3.2 F-GOV-05、F-TIM；§3.1 F-DIFF-01 工作室、F-SRC-08 ingest UX |
| **Then** | Time + ops visibility | §3.2 F-TIM-01–04, F-ALT-01–02 |
| **On demand** | Release engineering | §3.1 F-DIFF-01 工作室；§3.2 distance-matrix |
| **Enterprise option** | Data platform + operational ontology | F-LAKE-01–03 → F-OPS-* |
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

_Last updated: 2026-10-18 — processing.failed 告警 E2E 深链。_
