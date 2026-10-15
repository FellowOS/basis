# Basis

**One semantic layer for enterprise knowledge** — ontology-driven knowledge bases, evidence-backed facts, and a self-hosted console for teams and AI.

Basis is an open-source knowledge platform built on the [Semantica](https://github.com/semantica-agi/semantica) Python SDK: a **FastAPI API** (`basis`) plus a **React console** (`@basis/web`). Ingest documents, explore graphs, search with hybrid retrieval, govern changes, and expose knowledge to agents via HTTP and MCP—**without** running Semantica’s standalone `semantica server` as a separate product entrypoint.

[简体中文](./README.zh-CN.md) · [Design docs](./docs/design/README.md) · [API docs](http://127.0.0.1:8090/docs) (when the API is running)

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

| | Typical “graph + RAG” stack | **Basis** |
| --- | --- | --- |
| Source of truth | Graph / vector store | **Evidence ledger**; graph and vectors are **rebuildable projections** |
| Semantics | Ad-hoc labels | **Ontologies**, mappings, rules, SHACL, SPARQL |
| Operations | Many services | **Two processes** (API + Web), SQLite by default |
| Integrations | Custom glue | **REST**, per-KB **API tokens**, **MCP** |

Design rationale: [ADR 0001 — Evidence ledger is canonical](docs/decisions/0001-canonical-knowledge-model.md).

Full capability map: [product-and-roadmap.md](docs/design/product-and-roadmap.md).

---

## Configuration

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API bind |
| `BASIS_DATA_DIR` | `./data` | SQLite, blobs, graph JSON |
| `BASIS_DATABASE_URL` | *(unset → SQLite)* | PostgreSQL for production |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Web → API (`web/.env`) |

PostgreSQL: `docker compose -f compose.postgres.yml up -d`, then set `BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis`.

---

## Development

```bash
uv run pytest -q
cd web && npm test
```

See [CONTRIBUTING.md](CONTRIBUTING.md), [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md), [SECURITY.md](SECURITY.md). Upgrading from the pre-release **Sema** name: [docs/ops/migrating-from-sema.md](docs/ops/migrating-from-sema.md).

---

## License

[Apache License 2.0](LICENSE).
