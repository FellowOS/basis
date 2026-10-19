# Basis

**面向智能体的业务上下文与状态服务（The Business Context & State Service for Agents）** — 让智能体读懂企业真实上下文，并在审批边界内安全改写业务状态。

Basis 是基于 [Semantica](https://github.com/semantica-agi/semantica) Python SDK 构建的智能体上下文与状态服务底座：**FastAPI 后端**（`basis`）+ **React 建模与治理工作台**（`@basis/web`）。它将企业散乱的文档、关系型数据库（`postgres`/`mysql`）与 1,000+ SaaS 系统（通过声明式 **BOCP** 引擎）统一对齐为**证据账本与业务对象**，并向智能体暴露标准的 **OpenAPI v1 与 MCP 服务接口**——实现读取可溯源、状态写回必经审批。

[English](./README.md) · [文档索引](./docs/README.md) · [接口参考](http://127.0.0.1:5173/swagger)（web dev：`/swagger`；规范 `/openapi/v1.json`）

[![CI](https://github.com/fellowos/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/fellowos/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)

---

## 产品定位

| | 常见「RAG + 裸调 API」方案 | **Basis（上下文与状态服务）** |
| --- | --- | --- |
| **上下文读取（Context）** | 碎片向量切片 / 裸查数据库表 | **证据账本与业务对象**（陈述、映射、溯源）；图与向量为**可重建投影** |
| **状态变更（State）** | 仅停留在聊天记录，或直接裸写生产库 | **受控状态写回**（`remember` 提案与 `entity_sync_outbox` 审批闸口） |
| **业务语义** | 提示词临时硬编码 | **业务本体**、映射、规则推理、SHACL 校验、SPARQL |
| **系统连接与接口** | 每个项目手写胶水代码 | **BOCP** 声明式数据库与 1,000+ SaaS 连接器，统一暴露 **OpenAPI v1** 与 **MCP** |
| **部署运维** | 多套组件拼装 | 默认 **两个进程**：Basis API + Basis Web（SQLite 零配置，生产支持 PostgreSQL） |

架构决策：[ADR 0001 — 证据账本为主存](docs/architecture/0001-canonical-knowledge-model.md)。

---

## 能力概览

**平台**

- 用户与会话、角色（owner / admin / editor / viewer）、审计
- 多知识库、成员、可见性、对话/嵌入模型配置
- API 访问令牌与 MCP（智能体与自动化）

**单库**

- **文库** — 上传与解析（PDF、Office、HTML 等，semantica 管线）
- **图谱** — ContextGraph 工作台（对齐 Explorer 交互契约）
- **搜索** — 词法 + 向量混合（SQLite FTS5 + sqlite-vec，或 PostgreSQL `pg_trgm` + `pgvector`）
- **审核** — 治理队列、实体合并、陈述冲突（`statement_conflict`）
- **本体与映射** — OWL/TTL、词表、开放陈述到类型化事实；推理规则与证明链
- **对话** — 带引用的问答（在控制台配置模型与 Key）
- **账本** — 开放层 / 类型化层、推理派生事实与证据链
- **告警** — 同步失败、治理熔断、`governance.tripped` 等深链至审核/决策

文档：[功能清单](docs/features.md) · [开发进展](docs/progress.md) · [架构](docs/architecture/package-layout.md)。项目仍在积极迭代。

---

## 架构

```
Basis Web (5173)  ──/api──▶  Basis API (8090)  FastAPI
                              ├─ 管理：用户、库、令牌、审计 → SQLite / PostgreSQL
                              ├─ 知识：账本、blob、分块、任务 → SQLite / PostgreSQL
                              ├─ 图投影（每库 JSON，可重建）
                              └─ semantica.* SDK（解析、图、本体、LLM、向量…）
```

后端在进程内 `import semantica`；前端与集成方只访问 **Basis** 的 `/api/*`。

---

## 快速开始

### 环境

- **Python** 3.10–3.13、[uv](https://docs.astral.sh/uv/)
- **Node.js** ≥ 22、npm（随 Node 自带）
- **semantica SDK** — 由 `uv sync` 安装（见下文「semantica 依赖」）

### 1. 克隆与配置

```bash
git clone https://github.com/fellowos/basis.git
cd basis
cp .env.example .env
cp web/.env.example web/.env
```

### 2. 启动 API

```bash
uv sync --extra dev
uv run basis
```

默认 API `http://127.0.0.1:8090`；交互式 OpenAPI 见 web `http://127.0.0.1:5173/swagger`（规范 `/openapi/v1.json`）。

### 3. 启动 Web

```bash
cd web
npm install
npm run dev
```

浏览器打开 `http://127.0.0.1:5173`。首个注册用户为平台管理员。

---

## 配置说明

| 变量 | 默认 | 说明 |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API 监听 |
| `BASIS_DATA_DIR` | `./data` | SQLite、blob、图 JSON |
| `BASIS_DATABASE_URL` | 空则 SQLite | 生产建议 PostgreSQL |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Web 代理目标（`web/.env`） |

详见 [.env.example](.env.example)。

### PostgreSQL 部署

```bash
docker compose -f compose.postgres.yml up -d
export BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis
uv run basis
```

从 SQLite 迁移账本：`uv run basis migrate-postgres --database-url postgresql://…`

---

## 运维

**备份（SQLite 开发）：** `./scripts/backup_basis_data.sh` → `backups/basis-data-*.tar.gz`。恢复：停 API → 解压到 `BASIS_DATA_DIR` → 启动；若未含 `graphs/` 需对每个 KB 执行 `POST .../graph/rebuild`。

**备份（PostgreSQL）：** `./scripts/backup_basis_postgres.sh`（需 `pg_dump` 与 `BASIS_DATABASE_URL`）。

**限流与背压：** `BASIS_UPLOAD_MAX_BYTES`、`BASIS_INGEST_MAX_INFLIGHT` / `BASIS_INGEST_MAX_PENDING`、`BASIS_INGEST_EXTRACT_TIMEOUT_SECONDS`、`BASIS_CHUNK_SEARCH_MAX_LIMIT`、`BASIS_MCP_*`、`BASIS_REST_V1_MAX_INFLIGHT`；`BASIS_LOG_JSON=1` 输出 JSON 日志。

**连接器（当前固定种类）：** webhook、HTTP 轮询、GitHub raw — 在 KB **Sources** 配置。

**实时：** 图投影变更 WebSocket `projection_updated`（单 API 进程，无 Redis 多实例）。

**冒烟：** `uv run pytest tests/test_release_gate.py tests/test_m6_smoke.py -q`。

**自 Sema 更名：** 环境变量 `SEMA_*` → `BASIS_*`；库文件 `basis.db`；前端 token 键 `basis_token`；部署后需重新登录。

---

## 集成

- **REST** — `/api/*` 平台与知识库接口。
- **API 令牌** — 知识库设置中创建，用于自动化与 MCP。
- **MCP** — `POST/GET /api/kbs/{id}/mcp`（如 `search_chunks`、`find_entities`、`neighbors` 等）。

可通过 `BASIS_MCP_MAX_INFLIGHT`、`BASIS_MCP_TIMEOUT_SECONDS` 限制并发与超时。

---

## 开发

```bash
uv run pytest -q
uv run pytest tests/test_release_gate.py tests/test_runtime_limits.py -q

cd web && npm run build
cd web && npm test
```

CI 见 [`.github/workflows/ci.yml`](.github/workflows/ci.yml)。

---

## semantica 依赖

默认 `uv sync` 安装 Basis **运行时推荐** 的 extras（非完整 `semantica[all]`）：

| 组合 | 用途 |
| --- | --- |
| 默认 | 文档解析、抽取、向量、SHACL、OpenAI 兼容 LLM 等 |
| `dev` | pytest、httpx |
| `heavy` | Docling、pgvector、LiteLLM、Neo4j 等大可选包 |
| `explorer` | 调试 Explorer 集成 |

spaCy NER 需额外下载模型，例如：

```bash
uv run python -m spacy download en_core_web_sm
# 中文实体抽取（处理任务 NER=ml）：
uv run python -m spacy download zh_core_web_sm
```

资料页「配置处理」可选 **pattern / ml / llm**；`llm` 使用「模型」页的 Chat 配置；中文推荐 **ml + `zh_core_web_sm`** 或 **llm**。

本地调试 semantica：`cp uv.toml.example uv.toml` 并修改路径后 `uv sync`；无 `uv.toml` 时从 PyPI 安装（见 `uv.lock`）。

控制台配置的 **Chat / Embed Key** 仅在 LLM 抽取或对话/嵌入时需要；默认 pattern 抽取与纯文本上传可不配置 Key。

---

---

## 参与贡献

详见 [CONTRIBUTING.md](CONTRIBUTING.md)、[行为准则](CODE_OF_CONDUCT.md)、[安全报告](SECURITY.md)。

---

## 许可证

[Apache License 2.0](LICENSE)。
