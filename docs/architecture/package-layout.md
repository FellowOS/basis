# Basis Python package layout

Physical layout for the `basis` installable package (repo `basis/`). Integration contract: [openapi-v1.md](openapi-v1.md).

**Target tree:** [package-layout-target.md](package-layout-target.md). Deprecated import prefixes are blocked by `scripts/audit-legacy-package-imports.py`.

## Layers

| Layer | Path | Role |
| --- | --- | --- |
| API | `basis/api/http/`, `basis/api/mcp/` | FastAPI routes, middleware, MCP JSON-RPC — thin adapters |
| Application | `basis/application/` | KB operations (`KbCoreContext`, `registry` + `registry_catalog`); OpenAPI export |
| Core | `basis/core/*/` | Ledger, pipeline, projection, Explorer, connectors |
| Control | `basis/control/*/` | Admin store, auth, realtime, model catalog |
| Runtime | `basis/runtime/` | Config, database pool, limits, capabilities, observability |
| Tooling | `basis/tooling/` | Migrations, test helpers, Alembic storage schema |

Entry: `basis/cli.py` → Uvicorn `basis.api.http.app:create_app`.

## Core packages

| Package | Former path |
| --- | --- |
| `basis.core.ledger` | `basis.knowledge`, `basis.domain.kb` |
| `basis.core.pipeline` | `basis.pipeline`, `basis.domain.ingest` |
| `basis.core.projection` | `basis.graph`, `basis.domain.graph` |
| `basis.core.explorer` | `basis.explorer`, `basis.domain.explorer` |
| `basis.core.connectors` | `basis.domain.connectors` |

KB canonical SQL lives under `basis/core/ledger/persistence/` (caller often holds `KnowledgeStore._lock`; use raw `conn` inside an existing lock block to avoid nested lock deadlocks). `KnowledgeStore` (`store.py`) is a thin façade: DB handle, scope guards (`persistence/guards.py`), and `setattr` delegates to `basis/core/ledger/access/*` (connector, documents, processing, ingest_ledger, review, mappings, projection, facts, entity_merges, ingest_sources, reasoning_rules, kb_alerts, governance, search, ledger, …). Row DTOs: `ledger_rows.py`. Core services (e.g. `connector_sync.py`) call persistence via the store or `LockedCanonicalConn`.

| `basis.core.projection.ontology_legacy` | 旧图会话 `POST …/ontology`（非 Explorer hub） |
| `basis.core.explorer.reasoning` | 图推理 HTTP / Explorer（无顶层 `basis.core.reasoning` 包） |

### `basis/core/ledger` layout

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

### `basis/core/explorer` layout

Server-side adapters for vendored `web/src/explorer` — **not** a second ledger. Graph writes still go through Review / ledger APIs.

| Subpackage | Role |
| --- | --- |
| `session/` | Registry, guard, probe, `BasisKbGraphSession` |
| `graph/` | Projection reads, diff, staging payloads, import/export, semantic neighborhood |
| `ontology/` | Hub catalog, RDF I/O, SHACL, proposals, per-KB hub stores (`kb_scoped_state`) |
| `governance/` | Decisions, enrich, provenance, governance trip side effects |
| `vocabulary/` | SKOS browse + import |
| `temporal/` / `sparql/` | Temporal bounds; read-only SPARQL |
| `reasoning/` | Forward reasoning run + Explorer helpers |
| `io/` | RDF parse helpers; Explorer HTTP error mapping |
| `api/http/kb_ontology_hub*.py` | Ontology Hub HTTP (`_catalog` / `_governance` + `_support`; core logic in `ontology/`) |

**Imports:** use `basis.core.explorer.<subpackage>.<module>` only (flat `graph_read` / `registry` shims were removed). CI runs `scripts/audit-explorer-shim-imports.py` on `basis/` + `tests/` to prevent new root-level shim files.

See [explorer.md](explorer.md), [explorer-session-registry.md](explorer-session-registry.md), [ADR 0007](0007-graph-activity-and-canvas-merge.md).

**线 1：** 新后端逻辑在 `basis/core/*`；Explorer HTTP 用 `basis/core/explorer/<subpackage>/`（[README](../../basis/core/explorer/README.md)）。Import 护栏见 [semantica-base-sdk-plan.md](semantica-base-sdk-plan.md) §3。

### Other core packages

| Package | Notes |
| --- | --- |
| `graph/snapshot_store.py` | On-disk ContextGraph JSON per KB — **not** SQL `persistence/` |
| `graph/persistence.py` | Deprecated re-export of `snapshot_store` |
| `explorer/graph/staging.py` | Staging **payload**; SQL in `kb/persistence/graph_staging.py` |
| `connectors/` | BOCP runtime, vault crypto, `adapters/{sql,rest}/` — no ledger SQL |

### BOCP: `connectors/` vs `kb/connector_sync`

| Layer | Path | Responsibility |
| --- | --- | --- |
| **Engine** | `core/connectors/` | Manifest schema, `ConnectorRuntime`, `adapters/sql` + `adapters/rest`, vault crypto (`auth_vault`), shipped `providers/{service}/` bundles |
| **Ledger** | `core/ledger/services/connector_sync.py` + `ledger/persistence/connector_*.py` | Map streams ↔ `entities` / `statements` / outbox; row-hash sync; writeback via review; SQL on canonical DB |
| **Bridge** | `core/connectors/canonical_db.py` | `LockedCanonicalConn` — run ledger SQL under an existing `KnowledgeStore` lock |

HTTP/MCP entry: routes and `application/ops_connectors.py` compose engine + `KnowledgeStore` connector access. Do not add canonical connector table SQL under `core/connectors/`.

KB HTTP surface is split under `api/http/routes/v1/kb/` (paths/operationIds unchanged; aggregator `__init__.py` modules `include_router`):

| Aggregator (`kb/…`) | Sub-routers |
|------------|-------------|
| `kbs.py` | KB CRUD + members |
| `graph/` | `{read,search,models}` |
| `documents/` | `{crud,jobs,ontology,models,processing_support}` |
| `explorer/` | `{sparql,semantic,decisions,reasoning,graph_io,temporal,staging,governance,shared}` |
| `ontology/` | `{vocabulary,alignments,session}` + `hub/` (`register_kb_ontology_hub_routes`) |
| `review/` | `{models,queue,audit}`; `resolve` → `{approve,reject}` |
| `connectors/` | `{catalog,connections,mappings,outbox,oauth,tools,models,support}` |
| `ledger/` | `{read,remember,mutations,models}` |
| `sources/` | `{crud,ingest,models,support}` |

Other KB modules under `kb/`: `mappings.py`, `alerts.py`, `governance.py`, `e2e_helpers.py`, `reasoning_rules.py`, `tokens.py`.

`basis/core/explorer/graph/` — projection adapters. `ontology/` — hub logic; HTTP in `api/http/kb_ontology_hub.py`. `session/`, `governance/`, `vocabulary/`, `temporal/`, `sparql/`, `reasoning/`, `io/` — see [explorer README](../../basis/core/explorer/README.md).

KB core services that need audit or embedding settings take `basis.core.ledger.ports` protocols (`KbAuditStore`, `EmbedSettingsStore`); `api` passes `AdminStore` at the edge.

## Import rules

1. **Core** must not import `basis.api`.
2. **Application** may import core + control + runtime.
3. **API** may import all lower layers.
4. Prefer injecting callables into core over importing HTTP `deps` (legacy cleanup in progress).

CI enforces these with [import-linter](https://import-linter.readthedocs.io/) (`importlinter.ini` at repo root): core must not import `api`, `application`, or `control`; MCP OpenAPI bridge must not import `api`.

Canonical SQL migrations live under `basis/ops/db/migrations/` (`sqlite_migrations.py`, `postgres_migrations.py`).

Shared API/core errors: `basis.core.errors.AdminError` (control re-exports from `basis.control.admin.errors` for backward compatibility). Code under `basis/core/` should import `AdminError` from `basis.core.errors`.

## Control admin store

Canonical admin SQL lives under `basis/control/admin/persistence/` (caller holds `AdminStore._lock`; persistence functions take raw `conn` only). `AdminStore` (`store.py`) is a thin façade: DB handle, internal helpers (`_setting`, `_put_setting`, `_audit`, `_insert_kb`, …), and `setattr` delegates to `basis/control/admin/access/*` (auth, users, api_tokens, knowledge_bases, models, settings, audit, organizations, desktop). Row DTOs and mappers: `admin_types.py`.

## Tooling

- SQL migrations ship with `basis.tooling.db` (`migrations/*.sql`); BOCP provider YAML and synthesis batch assets ship with `basis.core.connectors` / `basis.core.connectors.synthesis` (`pyproject.toml` `package-data`).
- Alembic for `basis.tooling.db` storage baseline: repo-root `alembic.ini` → `basis/tooling/db/alembic` (override URL via `BASIS_DATABASE_URL`).
- Normative OpenAPI export: `basis.application.openapi_v1_export` / `openapi_spec`; committed snapshots under `openapi/`; web types via `npm run gen:openapi-types`.
