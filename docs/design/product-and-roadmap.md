# Sema 功能设计与开发计划

**阅读顺序**：先 **第一篇（完整功能设计）** 判断范围是否齐全；再 **第二篇（分期交付）** 决定实现顺序。能力条目用 **`F-域-序号`** 编号，分期表只引用编号，不在域章节里写 P0/P1。

实现原则：**知识能力在 Sema API 内通过 Semantica Python SDK 组装**；**体验与信息架构对标 Utopia（`fellowos/onto`）**；**图谱/本体/分析工作台在可行处复用 Semantica Knowledge Explorer 的 UI 与 API 契约**；**不**以独立 `semantica server start` / `semantica-explorer` 进程作为产品入口。

已接受的基础决策：

- [0001 — 证据账本为主存，ContextGraph 为投影](../decisions/0001-canonical-knowledge-model.md)
- [数据模型与迁移契约](data-model.md)
- [Explorer 多 KB 集成设计](explorer-integration.md)
- [首个纵向切片实施任务](implementation-backlog.md)

---

# 第一篇：完整功能设计

## 1. 产品边界

| | Sema | 非目标 |
| --- | --- | --- |
| 产品形态 | 多 KB 企业知识台：文库 → 图 → 搜/问 → 审 → 本体/映射 | Semantica 官方通用 HTTP 服务；Utopia Rust 代码复刻 |
| 客户端 | Sema Web + 经 Token/MCP 的集成方 | Explorer 独立站点作为默认入口 |
| 引擎 | `semantica.*` SDK +（可选）`semantica.explorer` 路由 | 在 Sema 外再暴露一套 Semantica API |

**北极星体验（Utopia）**：KB 内 **图谱 · 搜索 · 对话 · 文库 · 审核 · 本体 · 映射 · 设置**；平台级 **库 · 令牌 · 用户 · 模型 · 审计 · 系统设置**。

**引擎与工作台（Semantica）**：解析/抽取/图/向量/LLM/本体/推理；Explorer 提供 Graph、Timeline、Decision、Registry、Entity Resolution、KG Overview、Ontology Hub、Lineage、SPARQL、Vocabulary、Import/Export、Reasoning、Diff/Merge、Agent Memory 等 Workspace——Sema **按域纳入或明确排除**，见 §3。

---

## 2. 角色与权限（目标态）

| 能力类 | owner | admin | editor | viewer | 平台 admin |
| --- | --- | --- | --- | --- | --- |
| 创建/删除 KB | ✓ | — | — | — | ✓ |
| KB 设置、成员、治理开关 | ✓ | ✓ | — | — | — |
| 上传/连接器/重处理 | ✓ | ✓ | ✓ | — | — |
| 图谱编辑、合并实体 | ✓ | ✓ | ✓ | — | — |
| 审核决定 | ✓ | ✓ | ✓ | — | — |
| 本体/映射编辑 | ✓ | ✓ | ✓* | — | — |
| SPARQL 执行 | ✓ | ✓ | ✓* | 只读* | — |
| 搜索、读图、对话 | ✓ | ✓ | ✓ | ✓ | — |
| 平台用户/模型/审计 | — | — | — | — | ✓ |
| API Token（自己的） | ✓ | ✓ | ✓ | ✓ | — |

\*可配置为仅 admin。所有 KB 路由经 `get_kb_for(user, kb_id, min_role)`。

---

## 3. 领域与参考映射（完整性索引）

对齐 Utopia `docs/design/` 十二域 + Explorer Workspace + Sema 落点。

| Utopia 域 | Explorer / SDK（主要） | Sema 能力 ID 前缀 | 纳入 Sema |
| --- | --- | --- | --- |
| access-and-audit | — | `F-ACC` | **全量** |
| sources | parse, ingest-*, ImportExport | `F-SRC` | **全量**（连接器可分期实现） |
| extraction | GraphBuilder, normalize | `F-EXT` | **全量** |
| ledger | —（图/陈述） | `F-LDG` | **证据账本 + 开放/类型化双层（已决策）** |
| identity | Entity Resolution | `F-IDN` | **全量**（合并在审核域） |
| governance | Decision, Registry | `F-GOV` | **全量** |
| ontology | Ontology Hub, SHACL, Vocabulary | `F-ONT` | **全量** |
| rules | Reasoner, Reasoning WS | `F-RUL` | **全量** |
| time | Timeline | `F-TIM` | **全量** |
| interface | GraphWorkspace | `F-UI` | **全量** |
| chat-and-mcp | LLM extras | `F-CHAT` | **全量** |
| lakehouse-and-actions | db-*, ingest-parquet… | `F-LAKE` | **可选模块**（企业扩展） |

| Explorer Workspace | Sema 落点（UI） | 纳入 |
| --- | --- | --- |
| Graph + Timeline | `/kbs/:id/graph` | ✓ |
| KG Overview | graph 子页或 Manage 摘要 | ✓ |
| Decision | review 子页 + 图侧栏 | ✓ |
| Registry | audit / graph 变更流 | ✓ |
| Entity Resolution | `/kbs/:id/review` | ✓ |
| Ontology Hub | `/kbs/:id/ontology` | ✓ |
| Vocabulary (SKOS) | ontology 子 tab | ✓ |
| SPARQL | ontology 或 `/kbs/:id/analyze/sparql` | ✓ |
| Reasoning | ontology/rules 或 analyze | ✓ |
| Lineage (PROV) | 实体面板 / ontology | ✓ |
| Import/Export | library + 设置导出 | ✓ |
| Diff/Merge | review 或 ontology 高级 | ✓（治理场景） |
| Agent Memory | chat 或平台扩展 | 可选（有 Agent 会话时） |

---

## 4. 核心数据对象（目标态）

| 对象 | 作用 | 存储（演进） |
| --- | --- | --- |
| User, Session | 登录与身份 | Admin SQLite |
| KnowledgeBase | 库元数据、visibility、governance、locale | Admin SQLite |
| KbMember | 角色 | Admin SQLite |
| ApiToken | 集成/MCP 鉴权 | Admin SQLite |
| ModelSettings | Chat/Embed provider、model、密钥引用 | Admin SQLite |
| AuditEvent | 平台与 KB 操作审计 | Admin SQLite |
| AlertEpisode | 同步失败、LLM、治理熔断等（Utopia 0005） | SQLite + SSE |
| ContextGraph | 实体、关系、文档节点、本体节点 | 每 KB JSON → 日后 DB |
| Document / Version | 文库版本、blob、sha256 | SQLite + blob；图为投影 |
| Chunk | 分块文本、heading、offset | SQLite |
| ChunkEmbedding | 向量 | faiss/sqlite-vec 每 KB |
| Statement / Evidence | 开放陈述、证据、限定词、时间词 | SQLite 主存 |
| Typed / Derived Fact | 映射后的事实、规则派生与证明 | SQLite 主存；图/RDF 为投影 |
| ReviewItem | 审核队列项 | SQLite |
| AgentDecision | 机器提议与状态 | SQLite + 图 decision 节点 |
| ChatSession / Message | 对话与引用 | SQLite |
| OntologyArtifact | OWL/TTL、SHACL 形状 | 图 + 文件 |
| Mapping | 短语/开放边 → 类型化属性/类 | SQLite |
| Rule | 业务规则/公理引用 | SQLite 或图 |
| IngestSource | 连接器配置 | SQLite |
| IngestJob | 异步任务 | SQLite |

---

## 5. 功能规格（按域）

每节：**能力清单** → **主要 API** → **界面** → **验收要点**。实现状态在 §7 总表维护。

### 5.1 平台：身份与审计 `F-ACC`

| ID | 能力 | API（目标） |
| --- | --- | --- |
| F-ACC-01 | 注册、登录、登出、session | `POST /api/auth/*`, `GET /api/auth/me` |
| F-ACC-02 | 首用户为平台 admin | 已有逻辑 |
| F-ACC-03 | 平台用户 CRUD、停用 | `/api/admin/users` |
| F-ACC-04 | 个人/服务 API Token，scope（单 KB read/write） | `/api/kbs/{id}/tokens` |
| F-ACC-05 | 审计日志查询、按 KB/用户/动作过滤 | `/api/audit` |
| F-ACC-06 | 稳定错误 `code`（无服务端自然语言给用户） | 全局 |
| F-ACC-07 | SSO / OIDC | 扩展 |

**界面**：`/login`；`/users`；`/tokens`；`/audit`。

**验收**：viewer 无法调 editor API；Token 仅能访问授权 KB；审计含 KB 删除与成员变更。

---

### 5.2 平台：系统与模型 `F-PLAT`

| ID | 能力 | API |
| --- | --- | --- |
| F-PLAT-01 | 系统设置（站点名、注册开关等） | `/api/settings` |
| F-PLAT-02 | 全局 Chat/Embed 模型与 API Key（服务端仅存） | `/api/settings` models 段 |
| F-PLAT-03 | 健康检查 | `/health` |

**界面**：`/settings`；`/models`。

**验收**：摄入/对话/嵌入读取模型配置；审计记录模型调用但不写 key。

---

### 5.3 知识库与成员 `F-KB`

| ID | 能力 | API |
| --- | --- | --- |
| F-KB-01 | 列表、创建、读、改、删 KB | `/api/kbs` |
| F-KB-02 | visibility：public / restricted | patch KB |
| F-KB-03 | 成员列表、设角色、移除 | `/api/kbs/{id}/members` |
| F-KB-04 | KB 级：governance、default_locale、ontology_lang、抽取 profile | patch KB settings |
| F-KB-05 | 删除 KB 时删图与附属数据 | delete KB |
| F-KB-06 | KB 导出（图 RDF/JSON、审计包） | `POST .../export` |

**界面**：`/kbs`；`/kbs/:id/settings`。

---

### 5.4 来源与文库 `F-SRC` + `F-EXT`

| ID | 能力 | API |
| --- | --- | --- |
| F-SRC-01 | 文本写入 | `POST .../documents` |
| F-SRC-02 | 文件上传、解析（Office/PDF/文本） | `POST .../documents/upload` |
| F-SRC-03 | 文档列表、单文档元数据、删除/重处理 | `GET/DELETE .../documents/{doc_id}` |
| F-SRC-04 | 分块策略（size/overlap/token） | ingest 选项 + KB 默认 |
| F-SRC-05 | 抽取：pattern / ml / llm，关系/三元组开关 | ingest 选项 |
| F-SRC-06 | 连接器 CRUD：Git、Webhook、对象存储… | `/api/kbs/{id}/sources` |
| F-SRC-07 | 同步任务、状态、历史 | `.../sources/{id}/sync` |
| F-SRC-08 | 异步大文件 ingest job | `.../ingest/jobs` |
| F-EXT-01 | normalize → GraphBuilder → 入图 | pipeline |
| F-EXT-02 | 解析后去重（DuplicateDetector） | 解析阶段 |

**界面**：`/kbs/:id/library`（上传、粘贴、表）；来源配置在 settings 或 library 侧栏。

**验收**：DOCX/PDF 可解析；重启后文档与图一致；LLM 抽取使用 Models 配置。

---

### 5.5 向量与检索 `F-SRCH`

| ID | 能力 | API |
| --- | --- | --- |
| F-SRCH-01 | 摄入时嵌入 chunk | pipeline |
| F-SRCH-02 | 混合检索：向量 + 全文 | `GET .../search` |
| F-SRCH-03 | 按文档/实体/时间过滤 | query params |
| F-SRCH-04 | 重建索引 | `POST .../search/reindex` |
| F-SRCH-05 | 图内搜索（实体） | `.../graph/search`（Explorer） |

**界面**：`/kbs/:id/search`。

---

### 5.6 图谱与界面 `F-UI` / `F-GRAPH`

| ID | 能力 | API / WS |
| --- | --- | --- |
| F-GRAPH-01 | 统计 | `GET .../graph/stats` |
| F-GRAPH-02 | 分页 nodes/edges、bbox、游标 | Explorer graph routes |
| F-GRAPH-03 | 邻居、路径、语义距离、社区 | Explorer |
| F-GRAPH-04 | 图内搜索、聚焦、ego | Explorer |
| F-GRAPH-05 | 实时更新 | `WS .../graph-updates` |
| F-GRAPH-06 | 编辑：增删改节点/边（editor+） | Explorer mutation |
| F-GRAPH-07 | KG Overview（中心性、社区摘要） | Explorer / manage |
| F-GRAPH-08 | Timeline 时态 scrubber | Explorer temporal |
| F-UI-01 | 未类型实体灰显、争议边、派生边样式 | 前端 graphVisuals 对标 Utopia |
| F-UI-02 | 实体面板：名称、事实、证据跳转文库 | graph 侧栏 |
| F-UI-03 | 主题、i18n、无障碍焦点 | 全局 |

**界面**：`/kbs/:id/graph`（主画布 + 子视图）。

---

### 5.7 账本与陈述 `F-LDG`

| ID | 能力 | 说明 |
| --- | --- | --- |
| F-LDG-01 | 图作为事实载体（当前） | 节点/边属性 |
| F-LDG-02 | 开放陈述 + 证据 offset（目标主存） | 对齐 Utopia 开放层 |
| F-LDG-03 | pending → nod → 写入 | 与 review、chat remember 联动 |
| F-LDG-04 | 无效化、supersedes、导出 RDF | API + 审计 |

**界面**：审核卡片「原句在上」；实体面板证据链。

具体语义、最小 schema、状态机与迁移见
[ADR 0001](../decisions/0001-canonical-knowledge-model.md)。`F-LDG-01` 仅描述当前兼容状态；
迁移完成后 ContextGraph 是可重建投影，不再是事实主存。

---

### 5.8 身份解析 `F-IDN`

| ID | 能力 | API / UI |
| --- | --- | --- |
| F-IDN-01 | 重复候选检测 | 摄入 + 定时任务 |
| F-IDN-02 | 合并/保持/撤销合并 | review API + Explorer resolve |
| F-IDN-03 | 合并影响预览（功能谓词冲突） | review 详情 |

---

### 5.9 治理与审核 `F-GOV`

| ID | 能力 | 队列/来源 |
| --- | --- | --- |
| F-GOV-01 | governance 开关 | KB settings |
| F-GOV-02 | 队列：重复、冲突、低置信、对齐未定、agent、违规 | review |
| F-GOV-03 | 人工决定：merge/keep/reject + rationale | `POST .../review/{id}/decide` |
| F-GOV-04 | Agent governor（批量聚类、置信门控） | 后台 job |
| F-GOV-05 | 影响门控、熔断 governance.tripped | 告警 |
| F-GOV-06 | Registry：图变更流水 | Sema audit/ledger 持久读模；Explorer store 仅实时视图 |
| F-GOV-07 | Decision：决策列表与因果链 | `.../decisions` REST；变更通过通用 WS/refetch |

**界面**：`/kbs/:id/review`（含决策追溯子视图）。

---

### 5.10 本体、词汇、映射 `F-ONT`

| ID | 能力 | API / UI |
| --- | --- | --- |
| F-ONT-01 | 创建/导入本体（OWL/TTL、from_text） | `POST .../ontology` 等 |
| F-ONT-02 | 类/属性/个体可视化编辑 | Ontology Hub |
| F-ONT-03 | SHACL 校验与报告 | SHACL Studio |
| F-ONT-04 | SKOS 词表 | Vocabulary WS |
| F-ONT-05 | 版本、提案评审 | Ontology Hub |
| F-ONT-06 | 对齐（cross-ontology） | alignments tab |
| F-ONT-07 | 映射：开放短语 → 属性/类 | `/kbs/:id/mappings` |
| F-ONT-08 | SPARQL 查询工作台 | `.../sparql` |
| F-ONT-09 | 推理工作台（规则试跑） | Reasoning WS + `.../reasoning/run` |

**界面**：`/kbs/:id/ontology`；`/kbs/:id/mappings`；SPARQL/Reasoning 为子路由或 tab。

---

### 5.11 规则与推理 `F-RUL`

| ID | 能力 | API |
| --- | --- | --- |
| F-RUL-01 | KB 级规则集 CRUD | `.../rules` |
| F-RUL-02 | 对当前图运行推理 | `POST .../reasoning/run` |
| F-RUL-03 | 派生事实与证明链展示 | 图 + 实体面板 |
| F-RUL-04 | 矛盾检测 | governance 队列 |

---

### 5.12 时态 `F-TIM`

| ID | 能力 |
| --- | --- |
| F-TIM-01 | 事实/边 valid_from / valid_to |
| F-TIM-02 | 事件与时间提及（文档级） |
| F-TIM-03 | 检索与图 `as_of` / `at` |
| F-TIM-04 | Timeline 回放 |

---

### 5.13 对话与 MCP `F-CHAT`

| ID | 能力 | API |
| --- | --- | --- |
| F-CHAT-01 | KB 内多轮对话、SSE 流式 | `.../chat/sessions`, `.../messages` |
| F-CHAT-02 | RAG：混合检索引用 | 工具内部 |
| F-CHAT-03 | 工具：search_chunks、find_entities、neighbors、paths、entity_facts | 同 Utopia 工具集（子集可裁剪） |
| F-CHAT-04 | remember → pending 审核 | 写陈述 |
| F-CHAT-05 | MCP Streamable HTTP，Token 鉴权 | `/api/kbs/{id}/mcp` 或 `/api/mcp` |
| F-CHAT-06 | 停止生成、409 并发、上下文裁剪 | 同 Utopia 0063/0042 思路 |

**界面**：`/kbs/:id/chat`。

---

### 5.14 导入导出与血缘 `F-IO` / `F-LIN`

| ID | 能力 |
| --- | --- |
| F-IO-01 | 图 JSON/RDF/TTL 导入导出 |
| F-IO-02 | 批量文档导出 |
| F-LIN-01 | PROV 血缘图（Lineage） |
| F-DIFF-01 | 图 diff/merge（DiffMerge，治理/发布用） |

**界面**：library 导入；KB 设置导出；lineage 在实体/ontology。

---

### 5.15 告警与横切 `F-ALT` / `F-IF`

| ID | 能力 |
| --- | --- |
| F-ALT-01 | 告警种类：sync_failed、llm.*、governance.tripped… |
| F-ALT-02 | SSE 通知客户端 refetch |
| F-IF-01 | UI 语言 bundle；用户 locale |
| F-IF-02 | 主题 dark/light/system |
| F-IF-03 | 页副标题一句话说明动作（Utopia interface） |

**界面**：顶栏 AlertBell（规划）。

---

### 5.16 数据湖与动作（可选）`F-LAKE`

| ID | 能力 |
| --- | --- |
| F-LAKE-01 | 挂载表/Parquet |
| F-LAKE-02 | 语义层 / Ontology2SQL |
| F-LAKE-03 | Declared actions |

**纳入策略**：企业扩展包，**不阻塞**核心 KB 闭环；与 Utopia lakehouse 域对齐时才启用对应 `semantica` db extras。

---

### 5.17 Agent Memory（可选）`F-MEM`

Explorer Memory Workspace：长期 Agent 记忆图。**纳入策略**：当 F-CHAT 做多 Agent / 长期记忆时启用；否则排除。

---

## 6. 目标系统架构

```
Sema Web
  ├─ Platform routes（§5.1–5.2）
  └─ /kbs/:id/*（§5.3–5.15）
        ▼ Bearer + KB role
Sema API
  ├─ AdminStore（SQLite）
  ├─ Per-KB GraphSession（semantica.explorer.session + ContextGraph）
  ├─ Per-KB VectorIndex / SearchIndex
  ├─ Per-KB ReviewStore / ChatStore（SQLite 表）
  └─ Mounted explorer routers: graph, sparql, ontology, decisions, registry, …
        ▼
semantica SDK（parse, kg, ontology, reasoning, embeddings, …）
```

开发代理：Web `:5173` → API `:8090`。

---

## 7. 实现状态总表（相对完整设计）

| ID 范围 | 摘要 | 状态（2026-10 快照） |
| --- | --- | --- |
| F-ACC-01–03 | 登录、用户 | **已有** |
| F-ACC-04–07 | Token、SSO | **部分**（KB API 令牌 + Chat「连接」页 MCP 配置；SSO **未**） |
| F-PLAT-01–02 | 设置、模型 | **部分**（设置页；模型配置与 pipeline/chat 部分接通） |
| F-KB-01–03,05 | KB、成员 | **已有** |
| F-KB-04,06 | KB 扩展设置、导出 | **部分**（设置/图投影；全量导出 **未**） |
| F-SRC-01–02, F-EXT-01 | 上传、抽取 | **已有**（资料 + 处理任务） |
| F-SRC-03–08, F-EXT-02 | 文档详情、连接器、job | **部分**（处理 job；连接器 **三种冻结**：webhook/http_poll/GitHub raw；告警深链；**不**扩新 kind / git clone） |
| F-SRCH-* | 检索 | **部分**（混合检索、重建；chunk `as_of`/`created_*`；图谱搜索为当前投影；Graph 页时点说明 + e2e） |
| F-GRAPH-01–05 | 图读/WS | **已有**（Explorer 适配 + 图页） |
| F-GRAPH-06–08, F-UI-* | 图写/Overview/Timeline UI | **部分**（读为主；合并走审核；设置页图概览；Timeline 在 GraphWorkspace） |
| F-LDG-* | 账本 | **部分**（陈述/映射/typed facts；图仍为投影） |
| F-GOV-*, F-IDN-* | 审核/决策 | **部分**（合并/导入/映射队列；Decision/Agent governor **未**） |
| F-ONT-01–09 | 本体/SPARQL/映射 | **部分**（KB Hub、SPARQL/推理、SKOS、映射+审核；`VersionsTab` 提案+深链；与 ledger 审核队列分工） |
| F-RUL-* | KB 规则 | **部分**（`reasoning/run` + `proof_chains` + `.../rules` CRUD；账本派生事实 + 投影边；`statement_conflict` 审核 MVP） |
| F-TIM-* | 时态 | **部分**（图谱 scrubber + `temporal/*`；chunk 与图谱时点文档化；playback 无独立路由） |
| F-CHAT-* | 对话/MCP | **部分**（playground SSE/停生成/裁剪提示；MCP 工具集；remember→审核；**不**做 token 预算深化） |
| F-IO-*, F-LIN-*, F-DIFF-* | 导入导出/血缘 | **部分**（图 import 审核；lineage；`GET .../graph/diff` + Graph diff 页；画布合并工作室 **未**） |
| F-ALT-*, F-IF-* | 告警、interface | **部分**（`sync_failed`/`llm.*`/`governance.*`、铃铛 SSE+深链；KB 页副标题 **已有**） |
| F-LAKE-*, F-MEM-* | 可选 | **未** |

**完整性结论（设计层）**：§5 仍覆盖 Utopia 十二域 + Explorer 主要 Workspace。**实现层**已完成 **纵向切片主干**：文库 → 处理 → 图/搜/聊 → 审核闭环 → 本体/SPARQL/映射/连接器 MVP；独立 Explorer 产品壳已移除，能力以 KB 路由挂载。待深化项见 [capability-gap-checklist.md](capability-gap-checklist.md)、`graph-workspace-closure.md` 与 §9 发布门。

---

## 8. 目标 API 路由索引（汇总）

| 前缀 | 域 |
| --- | --- |
| `/api/auth`, `/api/admin/users` | F-ACC |
| `/api/settings`, `/api/kbs/{id}/tokens`, `/api/audit` | F-PLAT, F-ACC |
| `/api/kbs`, `/api/kbs/{id}/members` | F-KB |
| `/api/kbs/{id}/documents`, `.../sources`, `.../ingest` | F-SRC, F-EXT |
| `/api/kbs/{id}/search` | F-SRCH |
| `/api/kbs/{id}/graph/*` | F-GRAPH, F-UI |
| `/api/kbs/{id}/review`, `.../decisions`, `.../registry` | F-GOV, F-IDN |
| `/api/kbs/{id}/ontology`, `.../mappings`, `.../sparql` | F-ONT |
| `/api/kbs/{id}/rules` (CRUD), `.../reasoning/run` | F-RUL |
| `/api/kbs/{id}/chat`, `.../mcp` | F-CHAT |
| `/api/kbs/{id}/export`, `.../import` | F-IO |
| WS `/api/kbs/{id}/graph-updates`, SSE alerts | F-GRAPH, F-ALT |

（Explorer 具体子路径在集成时与 `semantica/explorer/routes` 对齐，统一加 KB 前缀与鉴权。）

---

## 9. 目标界面路由索引

| 路径 | 能力 ID |
| --- | --- |
| `/kbs` | F-KB-01 |
| `/kbs/:id/graph` | F-GRAPH, F-UI, F-TIM-04 |
| `/kbs/:id/search` | F-SRCH |
| `/kbs/:id/chat` | F-CHAT |
| `/kbs/:id/library` | F-SRC |
| `/kbs/:id/review` | F-GOV, F-IDN, F-GOV-07 |
| `/kbs/:id/lineage` | F-LIN-01 |
| `/kbs/:id/ontology` | F-ONT（含 vocabulary、shacl 子 tab） |
| `/kbs/:id/mappings` | F-ONT-07 |
| `/kbs/:id/settings` | F-KB-03–04 |
| `/kbs/:id/analyze/sparql` | F-ONT-08（或合入 ontology） |
| `/tokens`, `/users`, `/models`, `/audit`, `/settings` | F-ACC, F-PLAT |

---

## 10. Explorer 集成（实现约束）

完整实施契约见 [explorer-integration.md](explorer-integration.md)。关键约束：

1. **后端**：计划依赖 `semantica[explorer]`；Sema 为每 KB 管理独立
   `semantica.explorer.session.GraphSession`；不直接挂载 Explorer 的单 session routers，而是
   以 Sema adapter routes 复用 schemas/session/service 逻辑。
2. **路径与鉴权**：公共 URL 为 **`/api/kbs/{kb_id}/...`**；HTTP 使用 Sema JWT + KB
   role；WebSocket 使用短时、一次性 realtime ticket，不使用 Explorer API Key。
3. **写路径**：写入先经过 Sema 证据账本和领域服务，再更新/重建图投影；Explorer
   mutation callback 不是持久化事务。
4. **前端**：通过注入 `ExplorerClient` 复用 workspace 组件，集中处理 `apiBase`、JWT、
   WS ticket 与 capabilities；不直接保留 root-relative `/api/*` 调用。
5. **禁止**：生产默认依赖独立 `semantica-explorer` 进程；Registry 不虚构为 Explorer
   REST API；Decision 不虚构专用 WebSocket。

---

## 11. 决策状态

| 话题 | 状态 |
| --- | --- |
| 知识主存 | **已决策**：证据账本主存；开放陈述 → 映射 → 类型化事实；图/RDF/向量为投影（ADR 0001） |
| Explorer | **已决策**：Sema 多 KB adapter + JWT/role + workspace client 注入；不直接挂单 session 应用 |
| SPARQL | **已决策前置条件**：读取稳定 RDF 投影；初版 RDFLib，Oxigraph 非必需 |
| Lakehouse | 开放：标准产品或 `heavy`/企业扩展 |
| Agent Memory | 开放：是否与 Chat 同批 |

---

# 第二篇：分期交付（引用第一篇 ID）

> 分期只决定 **先做哪些 F-* 编号**；不改变第一篇范围。估时为粗粒度。

### Phase 0 — 基线巩固

F-ACC-01–02, F-KB-01–03, F-SRC-01–02, F-EXT-01, F-GRAPH-01, F-PLAT-01（部分）, F-IF-01–02（部分）。

验收：上传 → 文库 → 图 JSON 持久化 → 重启一致。

### Phase 1 — 知识闭环

F-GRAPH-02–04, F-SRCH-01–02, F-SRC-04–05, F-PLAT-02, F-UI-01（图只读）, F-SRCH-05。

验收：看图、搜段落、LLM/分块/嵌入可配置。

### Phase 2 — 问与审

F-CHAT-01–03, F-GOV-02–03, F-GOV-07（简版）, F-IDN-01–02, F-KB-04, F-ONT-01（只读浏览）, F-GOV-06（简版 registry）。

验收：对话带引用；editor 完成一次合并；决策/审核可追踪。

### Phase 3 — 本体、查询、来源

F-ONT-02–08, F-GOV-07（完整）, F-SRC-06–07, F-LDG-02, F-IO-01, F-DIFF-01（按需）.

验收：SHACL + SPARQL + 映射 UI；Git 连接器至少一种。

### Phase 4 — 平台化与深度

F-ACC-04, F-CHAT-04–05, F-RUL-01–03, F-TIM-01–04, F-ALT-01–02, F-KB-06, F-GOV-04–05.

### Phase 5+ — 可选

F-LAKE-*, F-MEM-*, F-ACC-07, Neo4j 同步等。

---

## 依赖与风险

| 项 | 说明 |
| --- | --- |
| Python / extras | 见 README；Explorer 集成时增加 `semantica[explorer]`；初版 SPARQL 使用 RDFLib，Oxigraph 仅作可选后端 |
| 图 JSON 规模 | F-GRAPH-02 分页与索引优先 |
| 许可证 | Explorer 与 Semantica 同源 |

## 文档维护

- 新增能力：在 §5 增加 **F-* 行**，并更新 §7 状态表。
- 分期调整：只改 **第二篇** 各 Phase 的 ID 列表。
- ADR：`docs/decisions/`。
- 数据字段/约束变更：更新 [data-model.md](data-model.md) 并通过迁移落地。
- Explorer 契约变更：更新 [explorer-integration.md](explorer-integration.md)。

---

*修订：2026-10-13 — 结构改为「完整功能设计 → 分期」；接受证据账本知识模型；补充 Explorer 多 KB 集成契约。*
