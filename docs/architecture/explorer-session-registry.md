# Explorer session registry（线 1 参考）

**状态：** 与 [semantica-base-sdk-plan.md](semantica-base-sdk-plan.md) Phase 1 同步  
**最后更新：** 2026-10-20

## 职责

`basis.domain.explorer.registry.ExplorerSessionRegistry` 为每个 KB 缓存：

| 组件 | 类型 | 作用 |
| --- | --- | --- |
| `basis` | `basis.domain.graph.GraphSession` | **Canonical** 可变图（持久化、投影、账本 rebuild 均写这里） |
| `explorer` | `semantica.explorer.session.GraphSession`（可选） | **适配层**：search index、`get_neighbors` / path、**`get_temporal_bounds`** 等 Explorer 约定 |

加载路径：`graph_for(request, kb_id)` → 同一 `ContextGraph` → 若安装 `semantica[explorer]` 则包装并 `rebuild_search_index()`。

## 线 1 迁移原则

1. **HTTP 路由**（`kb_explorer.py` 等）应逐步调用 `basis/domain/explorer/*_read.py`（或 `graph_read.py`），在域内 `session.method()`，**避免** `invoke_explorer(semantica.explorer.routes.*)`。
2. **不复制** Explorer 未使用的能力；以 OpenAPI + e2e 为准。
3. **Ontology Hub 导入** 仍经 `ontology_kb_hub` → Explorer `load_ontology`（产品默认，见线 1 计划 §3.5）。实现经 **`ontology_route_bridge`**（唯一 allowlisted `semantica.explorer.routes` import）。

## 已迁出 Explorer 路由（示例）

| API | 域实现 |
| --- | --- |
| `GET /kbs/{id}/temporal/bounds` | `temporal_read.get_temporal_bounds` |
| `GET /kbs/{id}/temporal/snapshot` | `temporal_read.get_temporal_snapshot` (+ ledger `state_at` 回退仍在路由) |
| `GET /kbs/{id}/decisions` | `decisions_read.list_decisions` |
| `GET /kbs/{id}/decisions/{id}/chain` | `decisions_read.get_causal_chain` |
| `GET /kbs/{id}/provenance` | `provenance_read.get_provenance_lineage` |
| `GET /kbs/{id}/provenance/report` | `provenance_read.export_provenance_report` |
| `GET /kbs/{id}/graph/semantic-neighborhood` | `graph_semantic_read.semantic_neighborhood` |
| `POST /kbs/{id}/graph/distance-matrix` | `graph_semantic_read.distance_matrix` |
| `POST /kbs/{id}/sparql` | `sparql_read`（preflight + rdflib 投影） |
| `POST /kbs/{id}/export` | `graph_export_read.export_graph` |
| `POST /kbs/{id}/enrich/links` | `enrich_read.predict_links` |
| `POST /kbs/{id}/enrich/dedup` | `enrich_read.detect_duplicates` |
| `POST /kbs/{id}/reasoning/run` | `reasoning_run.run_reasoning` (+ `forward_reasoning.proof_chains`) |
| Review 批准 entity-merge（图路径） | `enrich_write.merge_nodes` |
| Review 批准 graph-import | `graph_import_write.import_graph_file` |
| `GET/POST …/vocabulary/*` | `vocabulary_read` / `vocabulary_write` |
| `GET …/ontology/registry`、alignments、suggest | `ontology_catalog` |

## 仍依赖 Explorer 包装、非 routes 的调用

- `require_explorer_graph_session(runtime)` → `runtime.explorer`
- `kbs.py` 图读：`graph_read.get_node` / `list_neighbors`（ContextGraph 或 explorer 双路径）

## 相关

- [explorer.md](explorer.md) — 多 KB 路由与 WS  
- `scripts/audit-semantica-explorer-imports.py` — `semantica.explorer.routes` allowlist
