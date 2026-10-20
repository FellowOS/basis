# Semantica SDK 边界（线 1）

**状态：** 已完成（2026-10）；日常维护见 [progress.md §3.4](../progress.md)  
**最后更新：** 2026-10-20

Basis 后端以 **Semantica 核心 SDK**（`context`、`ingest`、`ontology`、`reasoning`、`kg` 等）承载图与领域能力；**KB Explorer HTTP** 由 `basis/core/explorer/*` 与 `BasisKbGraphSession` 实现，对接 vendored `web/src/explorer` 的 OpenAPI 契约。

**不在范围：** 企业 OWL（如 FIBO）导入后画布节点/边「更满」——不作为 Basis 交付项（产品决定 2026-10）。

相关：[explorer-session-registry.md](explorer-session-registry.md)、[explorer.md](explorer.md)、[package-layout.md](package-layout.md)、[0001-canonical-knowledge-model.md](0001-canonical-knowledge-model.md)。

---

## 1. 运行时栈

```text
semantica.context.ContextGraph
        ↑
basis.core.projection.GraphSession          ← canonical 可变图
        ↑
持久化 / projector / ledger
        ↑
basis.core.explorer.BasisKbGraphSession
        ↑
basis/core/explorer/* + api kb_* 路由
```

| 能力 | 实现位置 |
| --- | --- |
| 图会话 | `explorer_session_probe.build_kb_graph_adapter` → `BasisKbGraphSession` |
| RDF / SKOS 解析 | `basis/core/explorer/io/rdf_parse.py` |
| 本体 Hub 状态 | `KbOntologyState` + `graphs/{kb}.ontology-hub.json` |
| 向量 / 文库搜索 | `basis/core/ledger/search/*`（非 Explorer 图 scan） |

---

## 2. 原则（维护期）

1. **单一图真相：** 读写经 `graph_for` / 域服务进入同一 `ContextGraph`。
2. **契约稳定：** 对 `web/src/explorer` 的 HTTP 路径与 JSON 以 OpenAPI snapshot + e2e 为准。
3. **新逻辑放 `basis/core`：** 不引入对已废弃 Python 边界的依赖；CI import 审计见下表。
4. **Ontology `load_ontology`：** 产品语义不变；实现位于 `basis/core/explorer/ontology_*`。

---

## 3. CI 护栏

| 脚本 | 作用 |
| --- | --- |
| `scripts/audit-semantica-explorer-imports.py` | 禁止恢复旧 Explorer 路由 import |
| `scripts/audit-semantica-explorer-session-imports.py` | 禁止旧 Explorer session import |
| `scripts/audit-semantica-explorer-package-imports.py` | 禁止旧 Explorer 包路径静态 import |
| `scripts/audit-explorer-shim-imports.py` | `basis/`、`tests/` 禁止经顶层 explorer 兼容 shim import（应走子包路径；旧 shim 文件已删） |
| `scripts/audit-compat-shim-imports.py` | 禁止经 platform/transport 兼容 re-export import（migrations、openapi、ingest_tasks 等） |
| `scripts/audit-kb-http-aggregators.py` | `kb_*` 聚合路由模块不得再定义 `@router` handler（须 `include_router` 子模块） |
| `uv run lint-imports --config importlinter.ini` | `domain` 不得 import `transport` / `integration` / `platform`；`integration.mcp_openapi` 不得 import `transport` |

Explorer 审计 allowlist 均为空；新增违规 import 时 CI 失败。

---

## 4. 阶段历史

Phase 0–4（护栏、域服务迁出、本体 Hub、`BasisKbGraphSession`、`rdf_parse`）已于 2026-10 完成。细节见 git 历史与本文件旧版修订记录。

---

## 5. 修订记录

| 日期 | 说明 |
| --- | --- |
| 2026-10-20 | 初稿（迁移计划） |
| 2026-10-20 | 线 1 完成后收束为维护文档 |
