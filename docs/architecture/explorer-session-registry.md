# Explorer session registry

**最后更新：** 2026-10-20

## 职责

`basis.core.explorer.session.registry.ExplorerSessionRegistry` 为每个 KB 缓存：

| 组件 | 类型 | 作用 |
| --- | --- | --- |
| `basis` | `basis.core.projection.GraphSession` | **Canonical** 可变图（持久化、投影、账本 rebuild） |
| `explorer` | `BasisKbGraphSession` | Explorer HTTP 适配：`get_neighbors`、时态、`search`、本体写入等 |

加载：`graph_for(request, kb_id)` → 同一 `ContextGraph` → `build_kb_graph_adapter` → `BasisKbGraphSession`。

## HTTP 接线

- 路由：`kb_explorer.py`、`kb_ontology.py`、`api/http/kb_ontology_hub.py` 等调用 `basis/core/explorer/<subpackage>/`。
- 会话：`require_explorer_graph_session(runtime)` → `runtime.explorer`（`BasisKbGraphSession`）。
- 图读辅助：`graph/read.py`（`get_node`、邻域、搜索、边分页）。

## 域模块索引（示例）

| API | 域实现 |
| --- | --- |
| `GET /kbs/{id}/temporal/bounds` | `temporal.read.get_temporal_bounds` |
| `GET /kbs/{id}/temporal/snapshot` | `temporal.read.get_temporal_snapshot` |
| `GET /kbs/{id}/decisions` | `governance.decisions_read.list_decisions` |
| `POST /kbs/{id}/sparql` | `sparql.read` |
| `POST /kbs/{id}/export` | `graph.export_read.export_graph` |
| `GET/POST …/vocabulary/*` | `vocabulary.read` / `vocabulary.write` |
| Ontology Hub | `kb_ontology_hub` → `ontology/*` |

完整列表见 [explorer.md](explorer.md)。

## 相关

- [semantica-base-sdk-plan.md](semantica-base-sdk-plan.md) — SDK 边界与 CI 护栏
- [explorer.md](explorer.md) — 多 KB 路由与 WS
