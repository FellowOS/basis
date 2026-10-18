# Basis 功能设计与开发计划

**阅读顺序**：先 **第一篇（完整功能设计）** 判断范围是否齐全；再 **第二篇（分期交付）** 决定实现顺序。能力条目用 **`F-域-序号`** 编号，分期表只引用编号，不在域章节里写 P0/P1。

实现原则：**知识能力在 Basis API 内通过 semantica Python SDK 组装**；**体验与信息架构对标 Utopia（`fellowos/onto`）**；**图谱/本体/分析工作台在可行处复用 semantica Knowledge Explorer 的 UI 与 API 契约**；**不**以独立 `semantica server start` / `semantica-explorer` 进程作为产品入口。

已接受的基础决策：

- [0001 — 证据账本为主存，ContextGraph 为投影](architecture/0001-canonical-knowledge-model.md)
- [数据模型与迁移契约](architecture/data-model.md)
- [Explorer 多 KB 集成设计](architecture/explorer.md)
- 实现状态见 [progress.md](progress.md)（§0.1 `done` · §0.2 API 基线 · §3.1/§3.2 gap）

---

# 第一篇：完整功能设计

## 1. 产品边界

| | Basis | 非目标 |
| --- | --- | --- |
| 产品形态 | 多 KB 企业知识台：文库 → 图 → 搜/问 → 审 → 本体/映射 | semantica 官方通用 HTTP 服务；Utopia Rust 代码复刻 |
| 客户端 | Basis Web + 经 Token/MCP 的集成方 | Explorer 独立站点作为默认入口 |
| 引擎 | `semantica.*` SDK +（可选）`semantica.explorer` 路由 | 在 Basis 外再暴露一套 semantica API |

**北极星体验（Utopia）**：KB 内 **图谱 · 搜索 · 对话 · 文库 · 审核 · 本体 · 映射 · 设置**；平台级 **库 · 令牌 · 用户 · 模型 · 审计 · 系统设置**。

**引擎与工作台（semantica）**：解析/抽取/图/向量/LLM/本体/推理；Explorer 提供 Graph、Timeline、Decision、Registry、Entity Resolution、KG Overview、Ontology Hub、Lineage、SPARQL、Vocabulary、Import/Export、Reasoning、Diff/Merge、Agent Memory 等 Workspace——Basis **按域纳入或明确排除**，见 §3。

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

对齐 Utopia 十二域 + Explorer Workspace + Basis 落点（文档索引见 [docs/README.md](../README.md)）。

| Utopia 域 | Explorer / SDK（主要） | Basis 能力 ID 前缀 | 纳入 Basis |
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
| operational ontology（对标 Palantir） | —（Basis 组装） | `F-OPS` | **可选模块**（与 `F-LAKE` 同批；见 §5.18） |

| Explorer Workspace | Basis 落点（UI） | 纳入 |
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

每节：**能力清单** → **主要 API** → **界面** → **验收要点**。**实现状态只维护 [progress.md](progress.md)** — 同一 F-* 在 progress 标 `partial` 时，可能仅缺 **§3.1 产品化**（REST/MCP 已在 **§0.2**）；本文不逐条写 done/partial。

> **API 路径**：KB 面以 **`/api/v1/kbs/{id}/…`** 为准；完整索引见 §8。表中仍用 `.../` 处均指该前缀。

### 5.1 平台：身份与审计 `F-ACC`

| ID | 能力 | API（目标） |
| --- | --- | --- |
| F-ACC-01 | 注册、登录、登出、session | `POST /api/v1/auth/*`, `GET /api/v1/auth/me` |
| F-ACC-02 | 首用户为平台 admin | 已有逻辑 |
| F-ACC-03 | 平台用户 CRUD、停用 | `/api/v1/admin/users` |
| F-ACC-04 | 个人/服务 API Token，scope（单 KB read/write） | `/api/v1/kbs/{id}/tokens` |
| F-ACC-05 | 审计日志查询、按 KB/用户/动作过滤 | `/api/v1/audit` |
| F-ACC-06 | 稳定错误 `code`（无服务端自然语言给用户） | 全局 |
| F-ACC-07 | 组织 / SSO / Magic link | `/api/v1/orgs`、OAuth、magic link（企业 OIDC **部分**；见 progress） |

**界面**：`/login`；`/users`；`/tokens`；`/audit`。

**验收**：viewer 无法调 editor API；Token 仅能访问授权 KB；审计含 KB 删除与成员变更。

---

### 5.2 平台：系统与模型 `F-PLAT`

| ID | 能力 | API |
| --- | --- | --- |
| F-PLAT-01 | 系统设置（站点名、注册开关等） | `/api/v1/settings` |
| F-PLAT-02 | 全局 Chat/Embed 模型与 API Key（服务端仅存） | `/api/v1/settings` models 段 |
| F-PLAT-03 | 健康检查 | `/health` |

**界面**：`/settings`；`/models`。

**验收**：摄入/对话/嵌入读取模型配置；审计记录模型调用但不写 key。

---

### 5.3 知识库与成员 `F-KB`

| ID | 能力 | API |
| --- | --- | --- |
| F-KB-01 | 列表、创建、读、改、删 KB | `/api/v1/kbs` |
| F-KB-02 | visibility：public / restricted | patch KB |
| F-KB-03 | 成员列表、设角色、移除 | `/api/v1/kbs/{id}/members` |
| F-KB-04 | KB 级：governance、default_locale、ontology_lang、抽取 profile | patch KB settings |
| F-KB-05 | 删除 KB 时删图与附属数据 | delete KB |
| F-KB-06 | KB 导出（图 RDF/JSON、审计包） | `POST /api/v1/kbs/{id}/export` |

**界面**：`/kbs`；`/kbs/:id/settings`。

---

### 5.4 来源与文库 `F-SRC` + `F-EXT`

| ID | 能力 | API |
| --- | --- | --- |
| F-SRC-01 | 文本写入 | `POST /api/v1/kbs/{id}/documents` |
| F-SRC-02 | 文件上传、解析（Office/PDF/文本） | `POST /api/v1/kbs/{id}/documents/upload` |
| F-SRC-03 | 文档列表、单文档元数据、删除/重处理 | `GET/DELETE /api/v1/kbs/{id}/documents/{doc_id}` |
| F-SRC-04 | 分块策略（size/overlap/token） | ingest 选项 + KB 默认 |
| F-SRC-05 | 抽取：pattern / ml / llm，关系/三元组开关 | ingest 选项 |
| F-SRC-06 | 连接器 CRUD（**当前产品**：webhook、HTTP poll、GitHub raw；不扩新 kind） | `/api/v1/kbs/{id}/sources` |
| F-SRC-07 | 同步任务、状态、历史 | `/api/v1/kbs/{id}/sources/{source_id}/sync` |
| F-SRC-08 | 异步大文件 ingest job | `/api/v1/kbs/{id}/ingest/jobs` |
| F-EXT-01 | normalize → GraphBuilder → 入图 | pipeline |
| F-EXT-02 | 解析后去重（DuplicateDetector） | 解析阶段 |

**界面**：`/kbs/:id/library`（上传、粘贴、表）；来源配置在 settings 或 library 侧栏。

**验收**：DOCX/PDF 可解析；重启后文档与图一致；LLM 抽取使用 Models 配置。

---

### 5.5 向量与检索 `F-SRCH`

| ID | 能力 | API |
| --- | --- | --- |
| F-SRCH-01 | 摄入时嵌入 chunk | pipeline |
| F-SRCH-02 | 混合检索：向量 + 全文 | `GET /api/v1/kbs/{id}/search` |
| F-SRCH-03 | 按文档/实体/时间过滤 | search/graph query params（`as_of`、`at` 等） |
| F-SRCH-04 | 重建索引 | `POST /api/v1/kbs/{id}/search/reindex` |
| F-SRCH-05 | 图内搜索（实体） | `/api/v1/kbs/{id}/graph/search`（Explorer） |

**界面**：`/kbs/:id/search`。

---

### 5.6 图谱与界面 `F-UI` / `F-GRAPH`

| ID | 能力 | API / WS |
| --- | --- | --- |
| F-GRAPH-01 | 统计 | `GET /api/v1/kbs/{id}/graph/stats` |
| F-GRAPH-02 | 分页 nodes/edges、bbox、游标 | Explorer graph routes |
| F-GRAPH-03 | 邻居、路径、语义距离、社区 | Explorer |
| F-GRAPH-04 | 图内搜索、聚焦、ego | Explorer |
| F-GRAPH-05 | 实时更新 | `WS /api/v1/kbs/{id}/graph-updates` |
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
[ADR 0001](architecture/0001-canonical-knowledge-model.md)。`F-LDG-01` 仅描述当前兼容状态；
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
| F-GOV-03 | 人工决定：approve/reject + rationale | `POST .../review/items/{item_id}/approve` · `.../reject` |
| F-GOV-04 | Agent governor（批量聚类、置信门控） | 后台 job |
| F-GOV-05 | 影响门控、熔断 governance.tripped | 告警 |
| F-GOV-06 | Registry：图变更流水 | Basis audit/ledger 持久读模；Explorer store 仅实时视图 |
| F-GOV-07 | Decision：决策列表与因果链 | `GET .../decisions`、`GET .../decisions/{decision_id}/chain`；变更通过通用 WS/refetch |

**界面**：`/kbs/:id/review`（含决策追溯子视图）。

---

### 5.10 本体、词汇、映射 `F-ONT`

| ID | 能力 | API / UI |
| --- | --- | --- |
| F-ONT-01 | 创建/导入本体（OWL/TTL、from_text） | `POST /api/v1/kbs/{id}/ontology` 等 |
| F-ONT-02 | 类/属性/个体可视化编辑 | Ontology Hub |
| F-ONT-03 | SHACL 校验与报告 | SHACL Studio |
| F-ONT-04 | SKOS 词表 | Vocabulary WS |
| F-ONT-05 | 版本、提案评审 | Ontology Hub |
| F-ONT-06 | 对齐（cross-ontology） | alignments tab |
| F-ONT-07 | 映射：开放短语 → 属性/类 | `/kbs/:id/mappings` |
| F-ONT-08 | SPARQL 查询工作台 | `/api/v1/kbs/{id}/sparql` |
| F-ONT-09 | 推理工作台（规则试跑） | Reasoning WS + `POST /api/v1/kbs/{id}/reasoning/run` |

**界面**：`/kbs/:id/ontology`；`/kbs/:id/mappings`；SPARQL/Reasoning 为子路由或 tab。

---

### 5.11 规则与推理 `F-RUL`

| ID | 能力 | API |
| --- | --- | --- |
| F-RUL-01 | KB 级规则集 CRUD | `/api/v1/kbs/{id}/rules` |
| F-RUL-02 | 对当前图运行推理 | `POST /api/v1/kbs/{id}/reasoning/run` |
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

Basis **不在 API 层提供** Utopia 式「服务端 Chat 会话 + SSE LLM」；Playground 在 **Web** 编排：**浏览器直连** OpenAI 兼容 Chat API + **同域 MCP**（`basis/integration` 与 OpenAPI 对齐）。

| ID | 能力 | 实现落点 |
| --- | --- | --- |
| F-CHAT-01 | KB 内多轮对话、流式 | Web Playground（`/kbs/:id/chat`）；模型配置 **localStorage**（非 Basis OpenAPI） |
| F-CHAT-02 | RAG：检索引用 | Playground 调 MCP `search_chunks` 等 |
| F-CHAT-03 | 工具子集 | MCP **13 工具**（读图 + `propose_remember` + 审核读/批）；见 [openapi-v1.md §6.1](architecture/openapi-v1.md) |
| F-CHAT-04 | remember → pending 审核 | **服务端：** `POST /api/v1/kbs/{id}/remember/proposals`、MCP `propose_remember`、review get/approve（`statement_remember`）。**控制台：** Playground 与 Review 互跳（见 progress） |
| F-CHAT-05 | MCP over HTTP（JSON-RPC） | `GET/POST /api/v1/kbs/{id}/mcp` + KB API token；**无** 平台级 `/api/mcp` |
| F-CHAT-06 | 停止生成、并发、上下文裁剪 | Playground 客户端 abort + 消息裁剪（无服务端 token 预算） |

**界面**：`/kbs/:id/chat`（Playground）。

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
| F-LAKE-01 | 挂载表/Parquet（含 Semantica `ingest-parquet`、`db-*` extras 能力） |
| F-LAKE-02 | 语义层 / Ontology2SQL（类与列/表映射、受控查询） |
| F-LAKE-03 | Declared actions（与 **F-OPS-01** 同一产品面：声明式写回/副作用） |

**纳入策略**：企业扩展包，**不阻塞**核心 KB 闭环；与 Utopia lakehouse 域对齐时才启用对应 `semantica` db extras。运营语义层（Actions、对象—数据集绑定）的完整契约见 **§5.18**。

---

### 5.17 Agent Memory（可选）`F-MEM`

Explorer Memory Workspace：长期 Agent 记忆图。**纳入策略**：当 F-CHAT 做多 Agent / 长期记忆时启用；否则排除。

---

### 5.18 运营语义层扩展（Palantir Foundry Ontology 对标）`F-OPS`

在 [ADR 0001](architecture/0001-canonical-knowledge-model.md) 的 **证据 KB** 之上，可选的第二轨道：**运营本体**（对象类型、受控写回、与数仓/湖对齐）。对标 Palantir Foundry Ontology 的「可执行语义层」，**不**替代默认的文库 → 抽取 → 陈述 → 审核 → 图投影闭环。

**双轨（产品叙事）**

| 轨道 | 主存与体验 | 典型用户问题 |
| --- | --- | --- |
| **A — 证据 KB**（默认） | 证据账本 + 投影图/向量/RDF | 这份材料说了什么？谁审过？冲突怎么决？ |
| **B — 运营语义层**（企业可选） | `F-LAKE` 挂载 + `F-OPS` 对象/动作 | 业务对象状态是什么？谁能改？如何写回外部系统？ |

轨道 B 依赖 Semantica SDK 的 lakehouse extras（`ingest-parquet`、`db-*` 等），由 Basis API 统一鉴权、审计与 KB 边界；**不**以独立 semantica HTTP 服务为产品入口。

**与 Palantir 概念对照（差距 → 规划落点）**

| Palantir / Foundry | Basis 现状（2026-10） | 规划 `F-*` |
| --- | --- | --- |
| **Object types** + 属性 | 图节点/实体 + OWL 类 + ledger 陈述 | 继续 **F-ONT** / **F-LDG**；运营对象绑定见 **F-OPS-04** |
| **Actions**（参数、校验、执行） | 写路径以审核队列 + ledger 为主；无声明式 action 类型 | **F-OPS-01**、**F-LAKE-03** |
| **Functions**（派生属性、批算） | **F-RUL** 为规则/推理与证明链，非业务函数沙箱 | **F-OPS-03**（与 F-RUL 分工：RUL=逻辑推导，OPS=可调用函数运行时） |
| **Object ↔ dataset** 物化 | 无表/Parquet 挂载；图为投影 | **F-LAKE-01**、**F-OPS-04**、**F-OPS-05** |
| **Interfaces** / 共享属性 | OWL/SKOS 已有；无「接口类型」一等公民 | **F-ONT** 深化 + **F-OPS-04** 映射层 |
| **细粒度本体 ACL** | KB 级 `owner/admin/editor/viewer` | **F-OPS-02** |
| **Workshop** / **OSDK** | Basis Web + MCP 工具子集 | **F-OPS-06**（集成 SDK / OpenAPI）；**F-OPS-07**（低代码壳，按需） |

| ID | 能力 |
| --- | --- |
| F-OPS-01 | **Declared Actions**：action 类型、参数 schema、服务端校验、经 ledger/审计执行（可与外部 webhook/DB 写回组合） |
| F-OPS-02 | **Action / 对象类型级权限**（超越 KB member role；与平台审计对齐） |
| F-OPS-03 | **Ontology Functions**：派生属性、批处理求值运行时（语言/沙箱 TBD；非 SPARQL/Reasoner 替代品） |
| F-OPS-04 | **对象类型 ↔ 数据集绑定**（表/Parquet/语义层列；依赖 **F-LAKE-01**） |
| F-OPS-05 | **物化与同步作业**：从绑定源刷新运营侧投影或缓存（作业状态、告警与 **F-ALT** 深链） |
| F-OPS-06 | **集成 SDK（OSDK-lite）**：由 ontology + actions 暴露稳定 OpenAPI 或 codegen 客户端 |
| F-OPS-07 | **Workshop-lite**（可选）：可配置对象/动作面板，非 Phase 5 阻塞项 |

**纳入策略**：与 **F-LAKE-*** 同属 **Phase 5+ 企业扩展**；实现顺序建议 **F-LAKE-01 → F-OPS-04/05 → F-OPS-01/02 → F-OPS-03/06**；**F-OPS-07** 仅在有明确应用构建需求时立项。核心 KB 的 P1 仍优先 **F-GOV**、**F-ONT**、**F-RUL**、**F-TIM**（见 [progress.md](progress.md)）。

---

## 6. 目标系统架构

```
Basis Web
  ├─ Platform routes（§5.1–5.2）
  └─ /kbs/:id/*（§5.3–5.15）
        ▼ Bearer + KB role
Basis API
  ├─ AdminStore（SQLite）
  ├─ Per-KB GraphSession（semantica.explorer.session + ContextGraph）
  ├─ Per-KB VectorIndex / SearchIndex
  ├─ Per-KB ReviewStore / ledger（SQLite 表）
  └─ Mounted explorer routers: graph, sparql, ontology, decisions, registry, …
        ▼
semantica SDK（parse, kg, ontology, reasoning, embeddings, …）
```

开发代理：Web `:5173` → API `:8090`。

---

## 7. 与设计范围的对照（非状态表）

**逐条实现状态（done / partial / P0）只维护 [progress.md](progress.md)**，勿在本节或 §5 表格里写状态列。

**如何读 progress 里的 `partial`**（与 §5 能力 ID 对照）：

| progress | 含义 |
| --- | --- |
| **§0.1** | 该 F-*（或组）**整条**可视为基线交付 |
| **§0.2** | 服务端/OpenAPI/MCP **已有**；F-* 在路线图里仍可能不完整 |
| **§3.1** | 上表 F-* 的 **UI、深链、可分享 URL、运维叙事** 等缺口 |
| **§3.2** | **Pipeline、新 API 或体验** 均未闭环（含 P0 Playground polish） |

例：**F-GOV-07** — decisions/chain 在 §0.2；Decisions 页与 `?decision=` 在 §3.1。**F-CHAT-04** — remember MCP/HTTP 在 §0.1；Playground↔Review 在 §3.1。**F-CHAT-01–03** P0 拆验收见 progress **§6**。

**完整性结论（设计层）**：§5 覆盖 Utopia 十二域 + Explorer 主要 Workspace。**实现层**已打通纵向主干：文库 → 处理 → 图/搜 → Playground+MCP → 审核闭环 → 本体/SPARQL/映射/连接器 MVP；独立 Explorer 产品壳已移除。差距与 **§4 排期** 见 progress。

---

## 8. 目标 API 路由索引（汇总）

**Normative 契约**：`/api/v1/...`（[`openapi/basis-v1.json`](../openapi/basis-v1.json)、live `/openapi/v1.json`）。下表为逻辑分组；`.../` = `/api/v1/kbs/{id}/`（同 §5 说明）。

| 前缀 | 域 |
| --- | --- |
| `/api/v1/auth`, `/api/v1/admin/users`, `/api/v1/orgs` | F-ACC |
| `/api/v1/settings`, `/api/v1/kbs/{id}/tokens`, `/api/v1/audit` | F-PLAT, F-ACC |
| `/api/v1/kbs`, `/api/v1/kbs/{id}/members` | F-KB |
| `/api/v1/kbs/{id}/documents`, `.../sources`, `.../ingest`, `.../processing` | F-SRC, F-EXT |
| `/api/v1/kbs/{id}/search` | F-SRCH |
| `/api/v1/kbs/{id}/graph/*` | F-GRAPH, F-UI |
| `/api/v1/kbs/{id}/review`, `.../decisions`, `.../ledger` | F-GOV, F-IDN, F-LDG |
| `/api/v1/kbs/{id}/ontology`, `.../mappings`, `.../sparql` | F-ONT |
| `/api/v1/kbs/{id}/rules`, `.../reasoning/run` | F-RUL |
| `/api/v1/kbs/{id}/remember/proposals`, `.../mcp` | F-CHAT |
| `/api/v1/kbs/{id}/export`, graph import（经 review） | F-IO |
| WS `/api/v1/kbs/{id}/graph-updates`, SSE alerts | F-GRAPH, F-ALT |

（Explorer 子路径与 `semantica/explorer/routes` 对齐，统一 KB 前缀与鉴权；见 [explorer.md](architecture/explorer.md)。）

---

## 9. 目标界面路由索引

| 路径 | 能力 ID |
| --- | --- |
| `/kbs` | F-KB-01 |
| `/kbs/:id/graph` | F-GRAPH, F-UI, F-TIM-04 |
| `/kbs/:id/search` | F-SRCH |
| `/kbs/:id/chat` | F-CHAT |
| `/kbs/:id/library` | F-SRC |
| `/kbs/:id/review` | F-GOV, F-IDN |
| `/kbs/:id/decisions` | F-GOV-07 |
| `/kbs/:id/graph-diff` | F-DIFF-01 |
| `/kbs/:id/sources` | F-SRC-06–08, processing |
| `/kbs/:id/lineage` | F-LIN-01 |
| `/kbs/:id/ontology` | F-ONT（含 vocabulary、shacl 子 tab） |
| `/kbs/:id/mappings` | F-ONT-07 |
| `/kbs/:id/settings` | F-KB-03–04 |
| `/kbs/:id/analyze/sparql` | F-ONT-08（或合入 ontology） |
| `/tokens`, `/users`, `/models`, `/audit`, `/settings` | F-ACC, F-PLAT |

---

## 10. Explorer 集成（实现约束）

完整实施契约见 [explorer.md](architecture/explorer.md)。关键约束：

1. **后端**：计划依赖 `semantica[explorer]`；Basis 为每 KB 管理独立
   `semantica.explorer.session.GraphSession`；不直接挂载 Explorer 的单 session routers，而是
   以 Basis adapter routes 复用 schemas/session/service 逻辑。
2. **路径与鉴权**：公共 URL 为 **`/api/v1/kbs/{kb_id}/...`**；HTTP 使用 Basis JWT + KB
   role；WebSocket 使用短时、一次性 realtime ticket，不使用 Explorer API Key。
3. **写路径**：写入先经过 Basis 证据账本和领域服务，再更新/重建图投影；Explorer
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
| Explorer | **已决策**：Basis 多 KB adapter + JWT/role + workspace client 注入；不直接挂单 session 应用 |
| SPARQL | **已决策前置条件**：读取稳定 RDF 投影；初版 RDFLib，Oxigraph 非必需 |
| Lakehouse | 开放：标准产品或 `heavy`/企业扩展；与 **F-OPS** 同为企业语义层包 |
| 运营语义层（Palantir 对标） | **已纳入设计**：§5.18 **F-OPS**；默认产品不启用，不阻塞证据 KB |
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

F-CHAT-01–03（Playground + MCP 工具）, F-GOV-02–03, F-GOV-07（简版）, F-IDN-01–02, F-KB-04, F-ONT-01（只读浏览）, F-GOV-06（简版 registry）。

验收：Playground 带检索引用；editor 完成一次合并；决策/审核可追踪。

### Phase 3 — 本体、查询、来源

F-ONT-02–08, F-GOV-07（完整）, F-SRC-06–07, F-LDG-02, F-IO-01, F-DIFF-01（按需）.

验收：SHACL + SPARQL + 映射 UI；Git 连接器至少一种。

### Phase 4 — 平台化与深度

F-ACC-04, F-CHAT-04–05（remember API/MCP + Playground 深链）, F-RUL-01–03, F-TIM-01–04, F-ALT-01–02, F-KB-06, F-GOV-04–05.

### Phase 5+ — 可选（企业语义层与平台）

F-LAKE-01–03, F-OPS-01–06（建议顺序见 §5.18）, F-MEM-*, F-ACC-07, Neo4j 同步等；F-OPS-07 按需。

---

## 依赖与风险

| 项 | 说明 |
| --- | --- |
| Python / extras | 见 README；Explorer 集成时增加 `semantica[explorer]`；初版 SPARQL 使用 RDFLib，Oxigraph 仅作可选后端 |
| 图 JSON 规模 | F-GRAPH-02 分页与索引优先 |
| 许可证 | Explorer 与 semantica 同源 |

## 文档维护

- 新增能力：在 §5 增加 **F-* 行**；**状态**只改 [progress.md](progress.md)（`done` → §0/§0.1；API 基线 → §0.2；gap → §3.1 或 §3.2）。
- 分期调整：只改 **第二篇** 各 Phase 的 ID 列表。
- ADR：`architecture/0001`、`0002`。
- 数据字段/约束： [data-model.md](architecture/data-model.md) + 迁移。
- Explorer 契约： [explorer.md](architecture/explorer.md)。

---

*修订：2026-10-17 — §7 对齐 progress §0.1/§0.2/§3.1/§3.2；§5 API v1 路径；状态只在 progress。*

*修订：2026-10-15 — §5.18 F-OPS / F-LAKE 双轨。*

*修订：2026-10-13 — 完整功能设计 → 分期；ADR 0001；Explorer 多 KB 集成。*
