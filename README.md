# Basis

**Ontology-driven agent context service** — give AI agents verifiable enterprise context and governed state mutations across documents, databases, and 1,000+ business systems.

Basis is an open-source **ontology-driven agent context service** built on the [Semantica](https://github.com/semantica-agi/semantica) Python SDK: a **FastAPI backend** (`basis`) plus a **React studio** (`@basis/web`). It connects unstructured documents, relational databases (`postgres`/`mysql`), and 1,000+ SaaS apps (via the declarative **BOCP** engine), aligns them through business ontologies into a canonical **evidence ledger**, and exposes high-semantic read/write interfaces to agents via **OpenAPI v1** and **MCP**—with human-in-the-loop review gates for every state mutation.

[简体中文](./README.zh-CN.md) · [Documentation](./docs/README.md) · [API reference](http://127.0.0.1:5173/swagger) (web dev: `/swagger`; spec at `/openapi/v1.json`)

[![CI](https://github.com/fellowos/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/fellowos/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10--3.13-blue.svg)](pyproject.toml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](web/package.json)

---

## Quick start

```bash
git clone https://github.com/fellowos/basis.git
cd basis
cp .env.example .env
cp web/.env.example web/.env

uv sync --extra dev && uv run basis   # API :8090
cd web && npm install && npm run dev  # Web  :5173
```

The first registered user becomes the platform administrator.

---

## Why Basis

| | Typical “RAG + Raw Tool” stack | **Basis (Context & State Service)** |
| --- | --- | --- |
| **Agent Context (Read)** | Unverified vector chunks & raw SQL tables | **Evidence ledger** & business objects; graph and vectors are **rebuildable projections** |
| **Agent State (Write)** | Direct, ungoverned API calls or stateless chat | **Governed state mutations** (`remember` & `entity_sync_outbox` review gates) |
| **Semantics** | Ad-hoc prompt labels | **Ontologies**, mappings, rules, SHACL, SPARQL |
| **Connectivity** | Custom glue code per system | **BOCP** declarative DB & 1,000+ SaaS connectors, **OpenAPI v1**, and **MCP** |
| **Operations** | Many services | **Two processes** (API + Web), SQLite by default, PostgreSQL for production |

Design rationale: [ADR 0001 — Evidence ledger is canonical](docs/architecture/0001-canonical-knowledge-model.md).

Documentation: [features](docs/features.md) · [progress](docs/progress.md) · [architecture](docs/architecture/package-layout.md).

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API bind |
| `BASIS_DATA_DIR` | `./data` | SQLite, blobs, graph JSON |
| `BASIS_DATABASE_URL` | *(unset → SQLite)* | PostgreSQL for production |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Vite dev proxy target (`web/.env`) |
| `VITE_BASIS_API_URL` | *(unset → same-origin)* | Browser fetch base when not using the dev proxy |
| `BASIS_LEGACY_API_ENABLED` | `0` | Set `1` to allow unversioned `/api/*` (deprecated) |
| `BASIS_REST_V1_MAX_INFLIGHT` | `64` | Concurrent `/api/v1/*` requests (503 `api_busy`) |

PostgreSQL: `docker compose -f compose.postgres.yml up -d`, then set `BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis`.

Migrate SQLite → Postgres: `uv run basis migrate-postgres --database-url postgresql://…`

---

## Operations

**Backup (SQLite dev):** `./scripts/backup_basis_data.sh` → `backups/basis-data-*.tar.gz` (`basis.db`, `blobs/`, `graphs/`). Restore: stop API, extract into `BASIS_DATA_DIR`, restart; run `POST /api/v1/kbs/{kb_id}/graph/rebuild` per KB if graphs were omitted.

**Backup (PostgreSQL):** `./scripts/backup_basis_postgres.sh` (needs `pg_dump` + `BASIS_DATABASE_URL`).

**Ingest / API limits** (see `.env.example`): `BASIS_UPLOAD_MAX_BYTES`, `BASIS_INGEST_MAX_INFLIGHT` / `BASIS_INGEST_MAX_PENDING`, `BASIS_INGEST_EXTRACT_TIMEOUT_SECONDS`, `BASIS_CHUNK_SEARCH_MAX_LIMIT`, `BASIS_MCP_MAX_INFLIGHT`, `BASIS_MCP_TIMEOUT_SECONDS`, `BASIS_REST_V1_MAX_INFLIGHT`. Set `BASIS_LOG_JSON=1` for JSON logs; responses include `X-Request-ID`.

**Connectors (frozen set):** webhook, HTTP poll, GitHub raw — configure in KB **Sources**; no git clone / SaaS OAuth yet.

**Realtime:** KB WebSocket `projection_updated` on graph save / rebuild / ingest (single API worker; no Redis pub/sub).

**Smoke checks:** `uv run pytest tests/test_release_gate.py tests/test_m6_smoke.py -q`; manual UI path in CI-equivalent flows (register → upload → process → graph).

**Renamed from Sema:** env `SEMA_*` → `BASIS_*`; DB file `basis.db`; web token key `basis_token`; users re-login after deploy.

---

## Development

```bash
uv run pytest -q
cd web && npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md).

---

## License

[Apache License 2.0](LICENSE).
