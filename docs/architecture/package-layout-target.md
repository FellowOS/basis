# Basis package layout (target)

**Status:** complete (Phases 1–3, 2026-10-20)  
**Canonical detail:** [package-layout.md](package-layout.md)

Normative HTTP/MCP contract unchanged ([openapi-v1.md](openapi-v1.md)).

## Top level

| Path | Role |
| --- | --- |
| `basis/cli.py` | CLI entry |
| `basis/api/` | FastAPI (`api/http/`), MCP (`api/mcp/`) |
| `basis/application/` | `KbCoreContext`, operations registry, OpenAPI/MCP bridge |
| `basis/core/` | Ledger, pipeline, projection, explorer, connectors |
| `basis/control/` | Admin, identity, catalog, realtime |
| `basis/runtime/` | Config, DB, capabilities, observability |
| `basis/tooling/` | Migrations, Alembic, test support |

## `core/`

- `ledger/`, `pipeline/`, `projection/` (+ `legacy_ontology/`), `explorer/`, `connectors/`, `errors.py`

## `control/`

- `admin/`, `identity/` (OAuth/SAML clients), `catalog/` (models), `realtime/`

## `api/http/routes/v1/`

- `platform/` — auth, oauth, orgs, settings, models, audit, mcp, …
- `kb/` — workspace (`kbs`, `tokens`), `graph/`, `documents/`, `sources/`, `connectors/`, `ledger/`, `review/`, `explorer/`, `ontology/` (+ `hub/`), plus top-level `mappings`, `alerts`, …
- `users.py`, `mount.py` at `v1/` root

## Import rules

See `importlinter.ini`. CI also runs `audit-legacy-package-imports.py` (no `basis.transport`, `basis.domain`, `basis.control.auth`, …).

## Migration scripts (historical)

- `scripts/migrate_package_layout_v2.py` — Phase 1 import rewrites  
- `scripts/reorganize_api_routes_v2.py` — Phase 2 route moves (one-shot)

## Related

- [package-layout.md](package-layout.md)  
- [semantica-base-sdk-plan.md](semantica-base-sdk-plan.md)  
- [helix-foundry-adoption.md](helix-foundry-adoption.md)
