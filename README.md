# Sema

对标 Utopia 思路的企业知识台：**Sema API（Python + Semantica SDK）** + **Sema Web（React）**，两个进程。

完整功能设计与分阶段路线见 **[docs/design/product-and-roadmap.md](docs/design/product-and-roadmap.md)**（对照 Utopia 领域设计与 Semantica Explorer/SDK）。

## 和 `semantica server start` 的区别

| | `semantica server start` | **Sema（本项目）** |
|---|---|---|
| 是什么 | Semantica 自带的通用 HTTP 服务 | 你的产品 API |
| 知识能力 | Explorer 路由 | 在 API 里 `import semantica`，调 SDK |
| 谁调它 | 任意 HTTP 客户端 | **只有 Sema Web**（以及你自己的集成） |
| 要不要起 | **不需要** | 起 **`uv run sema`** |

你要的是：**用 Semantica 当 Python 库写 Sema 的后端**，前端只打 Sema 的 `/api/*`，不是再开一个 Semantica 官方服务。

## 两个进程怎么跑

**终端 1 — Sema API**

```bash
cd fellowos/sema
uv sync --extra dev
uv run sema
```

默认 `http://127.0.0.1:8090`，`/docs` 可看接口。

**终端 2 — 管理界面**

```bash
cd fellowos/sema
pnpm install
pnpm dev
```

打开 `http://127.0.0.1:5173`。Vite 把 `/api` 和 `/health` 代理到上面的 Sema API。

前端 monorepo 与 `fellowos/fellow/console` 对齐：`packages/web`（`@sema/web`）、Tailwind 4 + shadcn、`@/` 别名、`app.tsx` + `lazy-pages.ts` + `SemaSessionProvider` + 侧栏布局。

## 分层

```
Sema Web (5173)
    │  fetch /api/*
    ▼
Sema API (8090)  FastAPI
    ├─ 管理：用户、知识库、成员、设置、审计（SQLite / PostgreSQL）
    └─ 知识：ContextGraph、本体、推理、文档写入 … → semantica.* SDK
```

## 已实现（相对 Utopia 的骨架）

- 注册 / 登录、首用户管理员、公开库
- 多知识库、成员角色（owner / admin / editor / viewer）
- 按库隔离的内存图（SDK `ContextGraph`）
- 文档写入（Semantica normalize → GraphBuilder 抽取 → ContextGraph）、按库 JSON 持久化、文件上传解析
- 创建本体、规则推理
- 管理台页面：库、成员、设置、用户、审计、知识能力页

已实现（集成）：**API 访问令牌**（知识库设置 → MCP）、`POST/GET /api/kbs/{id}/mcp`（JSON-RPC 工具：`search_chunks`、`find_entities`、`neighbors`、`paths`、`entity_facts` 等）。

已实现 SQLite FTS5 + sqlite-vec 与 PostgreSQL pg_trgm + pgvector 混合检索。Web 对话、双时态、Ontology2SQL 等仍需继续迭代。

## PostgreSQL 部署

SQLite 仍是零配置默认值。生产部署可使用 PostgreSQL 17、`pg_trgm` 和
`pgvector`：

```bash
docker compose -f compose.postgres.yml up -d
export SEMA_DATABASE_URL=postgresql://sema:sema@127.0.0.1:5432/sema
uv run sema
```

连接池通过 `SEMA_DB_POOL_SIZE`、`SEMA_DB_MAX_OVERFLOW` 和
`SEMA_DB_POOL_TIMEOUT_SECONDS` 调整。MCP 并发通过
`SEMA_MCP_MAX_INFLIGHT` 与 `SEMA_MCP_TIMEOUT_SECONDS` 保护。

把现有 SQLite canonical ledger 迁移到 PostgreSQL：

```bash
uv run sema migrate-postgres \
  --database-url postgresql://sema:sema@127.0.0.1:5432/sema
```

迁移会校验表行数与 chunk hash；向量索引不复制，切换后在知识库设置中重建。

## 开发

```bash
uv run pytest tests/
```

发布门禁子集：`uv run pytest tests/test_release_gate.py tests/test_runtime_limits.py -q`。可调上限与环境变量见 [docs/ops/runtime-limits.md](docs/ops/runtime-limits.md)。

本地 Semantica 源码：`pyproject.toml` 里 `tool.uv.sources` 指向 `../../semantica`。

## Semantica 依赖

默认 `uv sync` 会安装 **Sema 运行时推荐** 的 Semantica extras（不是整个 `semantica[all]`，避免无关的 DB 连接器与巨型可选包）：

| Extra | 用途 |
| --- | --- |
| `documents` | Word / Excel / HTML 等文库解析 |
| `parse-pdf` | PDF（pdfplumber） |
| `nlp-spacy` | `ner_method=ml` 本地实体识别 |
| `nlp-langdetect` | 正文语言检测 |
| `llm-openai` | OpenAI 兼容 Chat / LLM 抽取 |
| `embeddings-local` | 本地向量（sentence-transformers / fastembed） |
| `vectorstore-faiss` / `vectorstore-sqlite` | 混合检索（开发期内存/SQLite） |
| `shacl` | 本体 SHACL 校验 |
| `split-tiktoken` | 按 token 分块 |
| `ingest-git` | Git 仓库摄入（后续连接器） |

安装后若要用 **spaCy NER**，还需下载语言模型（一次性）：

```bash
uv run python -m spacy download en_core_web_sm
```

扫描件 / 复杂版式 PDF、Postgres 向量、Neo4j 等可选：

```bash
uv sync --extra dev --extra heavy
```

管理台里配置的 **Chat / Embed API Key** 只在走 LLM 抽取或对话/嵌入时需要；默认 `pattern` 抽取与纯文本上传不依赖 Key。

## 测试

```bash
uv sync --extra dev
uv run pytest -q
```

图谱 Explorer 相关 UI 闭环与手测清单见 [docs/design/graph-workspace-closure.md](docs/design/graph-workspace-closure.md)。

```bash
pnpm install
pnpm --filter @sema/web build
pnpm --filter @sema/web test
```

推送 `main` 时 GitHub Actions 会跑 pytest 与 web build/test（`.github/workflows/ci.yml`）。
