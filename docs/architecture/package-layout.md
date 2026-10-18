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

## Tooling

- SQL migrations ship with `basis.platform.admin` (`pyproject.toml` `package-data`).
- OpenAPI YAML paths resolve from repo root via `basis.transport.http.openapi_spec` (`__file__` depth 3).
