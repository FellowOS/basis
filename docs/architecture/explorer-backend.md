# Explorer 后端（会话、线 1、Hub 持久化）

**最后更新：** 2026-10-20  
**相关：** [explorer-integration.md](explorer-integration.md)（多 KB 产品与 WS）· [package-layout.md](package-layout.md) · [ADR 0001](adrs/0001-canonical-knowledge-model.md)

Basis 以 **Semantica 核心 SDK** 承载图能力；**KB Explorer HTTP** 由 `basis/core/explorer/*` 与 `BasisKbGraphSession` 实现，对接 vendored `web/src/explorer` 的 OpenAPI 契约。线 1 迁移已于 2026-10 完成；日常状态见 [progress.md §3.4](../progress.md)。

**不在范围：** 企业 OWL（如 FIBO）导入后画布节点/边「更满」——不作为 Basis 交付项。

---

## 会话注册表

`basis.core.explorer.session.registry.ExplorerSessionRegistry` 为每个 KB 缓存：

| 组件 | 类型 | 作用 |
| --- | --- | --- |
| `basis` | `basis.core.projection.GraphSession` | **Canonical** 可变图（持久化、投影、账本 rebuild） |
| `explorer` | `BasisKbGraphSession` | Explorer HTTP 适配：邻域、时态、`search`、本体写入等 |

加载：`graph_for(request, kb_id)` → 同一 `ContextGraph` → `build_kb_graph_adapter` → `BasisKbGraphSession`。

### HTTP 接线

- 路由：`api/http/routes/v1/kb/explorer/*`、`kb/ontology/*`（含 `ontology/hub/`）→ `basis/core/explorer/<subpackage>/`。
- 会话：`require_explorer_graph_session(runtime)` → `runtime.explorer`。
- 图读：`explorer/graph/read.py`（节点、邻域、搜索、边分页）。

### 域模块索引（示例）

| API | 实现 |
| --- | --- |
| `GET /kbs/{id}/temporal/bounds` | `temporal.read.get_temporal_bounds` |
| `GET /kbs/{id}/decisions` | `governance.decisions_read.list_decisions` |
| `POST /kbs/{id}/sparql` | `sparql.read` |
| `POST /kbs/{id}/export` | `graph.export_read.export_graph` |
| `GET/POST …/vocabulary/*` | `vocabulary.read` / `vocabulary.write` |
| Ontology Hub | `ontology/*` + hub 注册路由 |

完整路由表见 [explorer-integration.md](explorer-integration.md)。

---

## 线 1：运行时栈

```text
semantica.context.ContextGraph
        ↑
basis.core.projection.GraphSession
        ↑
持久化 / projector / ledger
        ↑
basis.core.explorer.BasisKbGraphSession
        ↑
basis/core/explorer/* + api/http/routes/v1/kb/*
```

| 能力 | 实现位置 |
| --- | --- |
| 图会话 | `session.probe.build_kb_graph_adapter` → `BasisKbGraphSession` |
| RDF / SKOS | `core/explorer/io/rdf_parse.py` |
| 本体 Hub 元数据 | `ontology/*` + sidecar（见下节） |
| 向量 / 文库搜索 | `core/ledger/search/*`（非 Explorer 图 scan） |

### 维护原则

1. **单一图真相：** 读写经 `graph_for` / 域服务进入同一 `ContextGraph`。
2. **契约稳定：** 对 `web/src/explorer` 的 HTTP 以 OpenAPI snapshot + e2e 为准。
3. **新逻辑在 `basis/core`：** 禁止恢复已删除的兼容 shim 路径；CI 见下表。
4. **`load_ontology` 产品语义不变；** 实现位于 `core/explorer/ontology/`。

### CI 护栏

| 脚本 | 作用 |
| --- | --- |
| `audit-semantica-explorer-imports.py` | 禁止旧 Explorer 路由 import |
| `audit-semantica-explorer-session-imports.py` | 禁止旧 Explorer session import |
| `audit-semantica-explorer-package-imports.py` | 禁止旧 Explorer 包路径 |
| `audit-explorer-shim-imports.py` | 禁止顶层 explorer 兼容 shim |
| `audit-compat-shim-imports.py` | 禁止已删 platform/transport 兼容 re-export |
| `audit-kb-http-aggregators.py` | KB 聚合模块不得定义 `@router` handler |
| `audit-legacy-package-imports.py` | 禁止 `basis.transport` / `basis.domain` 等旧包名 |
| `lint-imports` (`importlinter.ini`) | `core` ↛ `api` / `application` / `control`；`application.mcp_openapi` ↛ `api` |

---

## Ontology Hub 持久化

**状态：** Accepted（2026-10）

1. **运行时：** `app.state` 按 `kb_id` 缓存 registry / alignments / drafts / proposals / versions（见 `ontology/hub_models.py`）。
2. **持久化（当前）：** `{data_dir}/graphs/{kb_id}.ontology-hub.json`（`hub_persistence.py`），与图快照同生命周期；`drop_graph` 时删除 sidecar。
3. **Postgres（可选后续）：** 多实例 API 时再考虑表结构；单节点自托管 sidecar 足够。
4. **非目标：** 在 Postgres 存完整 OWL；KB scoping 不 monkey-patch `semantica` registry。

RDF 入图仍走 `GraphSession` / 账本 Review；registry 行仅为 Hub 元数据。
