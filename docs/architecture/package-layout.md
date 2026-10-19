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
