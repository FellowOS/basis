# Basis Python package layout

Physical layout for the `basis` installable package (repo `basis/`). Integration contract: [openapi-v1.md](openapi-v1.md).

## Layers

| Layer | Path | Role |
| --- | --- | --- |
| Transport | `basis/transport/http/`, `basis/transport/mcp/` | FastAPI routes, middleware, MCP JSON-RPC — thin adapters |
| Integration | `basis/integration/` | KB operations shared by OpenAPI, MCP, chat (`KbCoreContext`, registry) |
| Domain | `basis/domain/*/` | Ledger, ingest, graph projection, Explorer runtime, ontology, reasoning |
| Platform | `basis/platform/*/` | Admin store, auth, realtime, model catalog |
| Infra | `basis/infra/` | Config, database pool, limits, capabilities, observability |
| Ops | `basis/ops/` | One-off migrations, test helpers, Alembic storage schema |

Entry: `basis/cli.py` → Uvicorn `basis.transport.http.app:create_app`.

## Domain packages

| Package | Former path |
| --- | --- |
| `basis.domain.kb` | `basis.knowledge` |

KB canonical SQL lives under `basis/domain/kb/persistence/` (caller often holds `KnowledgeStore._lock`; use raw `conn` inside an existing lock block to avoid nested lock deadlocks). `KnowledgeStore` (`store.py`) is a thin façade: DB handle, scope guards (`persistence/guards.py`), and `setattr` delegates to `basis/domain/kb/access/*` (connector, documents, processing, ingest_ledger, review, mappings, projection, facts, entity_merges, ingest_sources, reasoning_rules, kb_alerts, governance, search, ledger, …). Row DTOs: `ledger_rows.py`. Domain services (e.g. `connector_sync.py`) call persistence via the store or `LockedCanonicalConn`.
| `basis.domain.ingest` | `basis.pipeline` |
| `basis.domain.graph` | `basis.graph` |
| `basis.domain.explorer` | `basis.explorer` |
| `basis.domain.ontology` | `basis.ontology` |
| `basis.domain.reasoning` | `basis.reasoning` |

### `basis/domain/kb` layout

| Location | Purpose |
| --- | --- |
| `store.py` | `KnowledgeStore` façade (lock, blob store, delegates) |
| `persistence/` | Canonical ledger SQL (`conn` only; caller holds `_lock`) |
| `access/` | Lock + validation + orchestration per slice |
| `ledger_rows.py` | Row DTOs returned by store APIs |
| `services/` | Workflows, audit side-effects (`graph_audit`), KB alerts (`kb_alerts_emit`), governor/review |
| `schedulers/` | `*_poll_scheduler.py` ticks and `*_poll_due.py` schedule predicates |
| `search/` | Hybrid chunk search (`ChunkSearchService`), embeddings, vector indexes, `search_config` |
| `services/connector_sync.py` | Ledger-side BOCP sync orchestration (`ConnectorLedgerSyncService`) |
| `connector_sync.py` | Re-export of `services.connector_sync` (stable import path) |
| `structured_models.py` | BOCP mapping / outbox DTOs shared with connector services |
| `governance_config.py` | KB governor config types + validation (SQL in `persistence/governance_config`) |

### `basis/domain/explorer` layout

Server-side adapters for vendored `web/src/explorer` — **not** a second ledger. Graph writes still go through Review / ledger APIs.

| Module | Role |
| --- | --- |
| `registry.py` | Per-KB Explorer session registry (`ExplorerSessionRegistry`, `KbExplorerRuntime`) |
| `session_guard.py` | AuthZ helpers for Explorer HTTP/WS |
| `graph_read.py` | Read paths over projected graph + ledger pointers |
| `temporal_read.py` | Temporal bounds / snapshot (no `semantica.explorer.routes`) |
| `decisions_read.py` | Decision list + causal chain (no `semantica.explorer.routes`) |
| `provenance_read.py` | Provenance lineage + exportable reports |
| `graph_semantic_read.py` | Semantic neighborhood + distance matrix |
| `sparql_read.py` | Read-only SPARQL (rdflib projection) |
| `graph_export_read.py` | Graph export (json/csv/rdf/graphml) |
| `enrich_read.py` | Link prediction + dedup scan |
| `enrich_write.py` | Approved entity merge on graph session |
| `reasoning_run.py` | Forward reasoning + optional graph apply |
| `graph_import_write.py` | Approved graph file import (json/csv) |
| `vocabulary_read.py` / `vocabulary_write.py` | SKOS scheme browse + import |
| `ontology_catalog.py` | Registry listing + alignments + suggestions |
| `ontology_route_bridge.py` | **Only** allowlisted import of `semantica.explorer.routes.ontology` (hub + e2e) |
| `graph_diff.py` | Diff payloads for `GET graph/diff` |
| `graph_staging.py` | **Stateless** staging payload builders (persist via `KnowledgeStore` + `kb/persistence/graph_staging`) |
| `ontology_kb_hub.py` | Ontology workspace ↔ KB hub orchestration |
| `kb_scoped_ontology_state.py` | KB-scoped ontology editor state |
| `forward_reasoning.py` | Explorer-triggered reasoning helpers |
| `governance_decision.py` | Governance trip / proposal side effects (alerts, review hooks) |

See [explorer.md](explorer.md), [explorer-session-registry.md](explorer-session-registry.md), [ADR 0007](0007-graph-activity-and-canvas-merge.md).

**线 1：** 新 Python 代码勿新增 `semantica.explorer.routes` import；见 `scripts/audit-semantica-explorer-imports.py`。

### Other domain packages

| Package | Notes |
| --- | --- |
| `graph/snapshot_store.py` | On-disk ContextGraph JSON per KB — **not** SQL `persistence/` |
| `graph/persistence.py` | Deprecated re-export of `snapshot_store` |
| `explorer/graph_staging.py` | Staging **payload**; SQL in `kb/persistence/graph_staging.py` |
| `connectors/` | BOCP runtime, vault crypto, `adapters/{sql,rest}/` — no ledger SQL |

### BOCP: `connectors/` vs `kb/connector_sync`

| Layer | Path | Responsibility |
| --- | --- | --- |
| **Engine** | `domain/connectors/` | Manifest schema, `ConnectorRuntime`, `adapters/sql` + `adapters/rest`, vault crypto (`auth_vault`), shipped `providers/{service}/` bundles |
| **Ledger** | `domain/kb/services/connector_sync.py` + `kb/persistence/connector_*.py` | Map streams ↔ `entities` / `statements` / outbox; row-hash sync; writeback via review; SQL on canonical DB |
| **Bridge** | `domain/connectors/canonical_db.py` | `LockedCanonicalConn` — run ledger SQL under an existing `KnowledgeStore` lock |

HTTP/MCP entry: routes and `integration/ops_connectors.py` compose engine + `KnowledgeStore` connector access. Do not add canonical connector table SQL under `domain/connectors/`.

## Import rules

1. **Domain** must not import `basis.transport`.
2. **Integration** may import domain + platform + infra.
3. **Transport** may import all lower layers.
4. Prefer injecting callables into domain over importing HTTP `deps` (legacy cleanup in progress).

## Platform admin store

Canonical admin SQL lives under `basis/platform/admin/persistence/` (caller holds `AdminStore._lock`; persistence functions take raw `conn` only). `AdminStore` (`store.py`) is a thin façade: DB handle, internal helpers (`_setting`, `_put_setting`, `_audit`, `_insert_kb`, …), and `setattr` delegates to `basis/platform/admin/access/*` (auth, users, api_tokens, knowledge_bases, models, settings, audit, organizations, desktop). Row DTOs and mappers: `admin_types.py`.

## Tooling

- SQL migrations ship with `basis.platform.admin` (`pyproject.toml` `package-data`).
- OpenAPI YAML paths resolve from repo root via `basis.transport.http.openapi_spec` (`__file__` depth 3).
