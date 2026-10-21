# Basis

## Let agents understand real business

**Ontology-driven enterprise business semantics layer.**

Map documents, databases, and SaaS to **entities, types, and governed facts**—the shared meaning layer above raw systems. Expose **OpenAPI v1** and **MCP** on desktop, self-hosted, or cloud; state changes go through review, not silent API calls.

Basis is an open-source stack on the [Semantica](https://github.com/semantica-agi/semantica) Python SDK: a **FastAPI** backend (`basis`) and a **React studio** (`@basis/web`). **Business semantics**—mappings, ontologies, rules, SHACL—sit on a canonical **evidence ledger**; graph and search are **rebuildable projections**.

[简体中文](./README.zh-CN.md)

[![CI](https://github.com/FellowOS/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/FellowOS/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10--3.13-blue.svg)](pyproject.toml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](web/package.json)

> **Status:** Early development (`0.1.x`). HTTP and MCP surfaces are stabilizing; pin releases for production pilots.

---

## Features

- **Business semantics** — entities, typed facts, mappings, and ontologies; the unit of meaning is not “another chunk.”
- **Evidence ledger** — canonical statements, provenance; graph and vectors are projections you can rebuild.
- **Knowledge bases** — document ingest, chunk search (lexical + embeddings), processing jobs, review queue.
- **Graph & ontology** — Explorer-style graph UI, vocabulary, SHACL, SPARQL, ontology hub workflows.
- **Connectors (BOCP)** — shipped providers (e.g. postgres, mysql, github, slack); inbound sync and governed writeback.
- **Agent APIs** — KB-scoped **OpenAPI v1** and **MCP** (`search_chunks`, `find_entities`, connector tools, review ops).
- **Platform** — users, org SSO (OIDC/SAML optional), KB roles, API tokens, audit.

---

## Architecture

```mermaid
flowchart LR
  WEB["Basis Web<br/>:5173"]
  WEB -->|proxy /api| INT

  subgraph API["Basis API :8090 · FastAPI"]
    direction TB
    INT["interface/<br/>HTTP + MCP wire"]
    APP["application/<br/>shared agent operations"]
    DOM["domain/<br/>ledger, graph, connectors, tenancy"]
    SDK["semantica SDK<br/>parse, graph, LLM, vectors…"]
    INT --> APP --> DOM --> SDK
  end
```

Integrations should call **Basis** (`/api/v1/...` and KB MCP), not Semantica directly.

---

## Quick start

### Prerequisites

- **Python** 3.10–3.13 and [uv](https://docs.astral.sh/uv/)
- **Node.js** ≥ 22 and npm

The **Semantica** SDK installs from **PyPI** when you run `uv sync` (pinned in `uv.lock`).

### 1. Clone and configure API

```bash
git clone https://github.com/FellowOS/basis.git
cd basis
cp .env.example .env
uv sync --extra dev
uv run basis
```

API listens on `http://127.0.0.1:8090` by default.

### 2. Run Web

```bash
cp web/.env.example web/.env
cd web && npm install && npm run dev
```

Open `http://127.0.0.1:5173` · register — the **first user** becomes platform admin.

In-app product docs: **`http://127.0.0.1:5173/docs`** · API explorer: **`http://127.0.0.1:8090/swagger`** · live spec: **`http://127.0.0.1:8090/openapi/v1.json`**.

### 3. Smoke-test in the UI

1. Create a knowledge base.
2. **Sources** — paste or upload a short text file; wait for processing.
3. Open **Graph** or **Search** for that KB.

### Desktop (optional, no login)

See [desktop/README.md](desktop/README.md): `BASIS_DEPLOYMENT_PROFILE=desktop`, `npm run dev:desktop`, or Electron via `cd desktop && npm run dev`.

---

## Agent integration (MCP)

Create a **KB API token** (KB settings → Tokens). MCP endpoint:

`POST /api/v1/kbs/{kb_id}/mcp` with `Authorization: Bearer <token>`.

Example `tools/call` (after `tools/list`):

```bash
curl -sS "http://127.0.0.1:8090/api/v1/kbs/YOUR_KB_ID/mcp" \
  -H "Authorization: Bearer YOUR_KB_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_kb","arguments":{}}}'
```

Tool names and HTTP paths share the same operation catalog; see live **`/openapi/v1/kb.json`** when the API is running.

---

## Why Basis

| | Typical “RAG + raw tools” | **Basis** |
| --- | --- | --- |
| **Read path** | Unverified chunks / ad hoc SQL | Ledger + entities; graph/search rebuilt from ledger |
| **Write path** | Ungoverned API calls | Review gates (`remember`, connector writeback, conflicts) |
| **Business semantics** | Prompt labels | Shared entities & types, mappings, ontologies, rules, SHACL, SPARQL |
| **Connectivity** | Per-system glue | BOCP manifests, OpenAPI v1, MCP |
| **Ops** | Many services | API + Web; SQLite dev, PostgreSQL for production |

---

## Configuration (essentials)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API bind |
| `BASIS_DATA_DIR` | `./data` | SQLite, blobs, graph JSON |
| `BASIS_DATABASE_URL` | *(unset → SQLite)* | PostgreSQL for production |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Web dev proxy (`web/.env`) |

Full list: [.env.example](.env.example).

**PostgreSQL:** `docker compose -f compose.postgres.yml up -d`, then  
`BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5433/basis` (host port **5433**).

**Backups:** `./scripts/backup_basis_data.sh` (SQLite) or `./scripts/backup_basis_postgres.sh` (Postgres).

---

## Semantica dependency

`semantica` resolves from **PyPI** (see `uv.lock`). `uv sync` installs Basis runtime extras (document parse, embeddings, SHACL, OpenAI-compatible LLM, etc.). Optional groups: `dev`, `heavy`, `explorer`, `saml` — see [pyproject.toml](pyproject.toml).

Do not add a local `[tool.uv.sources]` override for `semantica` (a gitignored `uv.toml` would still take precedence over defaults — leave it unset for PyPI).

For ML NER in processing jobs:

```bash
uv run python -m spacy download en_core_web_sm
```

Chat/embeddings in the console need provider API keys only when you use LLM-backed features.

---

## Development

```bash
uv run pytest -q
uv run lint-imports --config importlinter.ini
cd web && npm run typecheck && npm test
cd web && CI=1 npm run test:e2e   # optional; Playwright + API
```

Layout for contributors: `basis/interface`, `application`, `domain`, `infra` — see [AGENTS.md](AGENTS.md).

---

## Community

- **Bug reports & features:** [GitHub Issues](https://github.com/FellowOS/basis/issues)
- **Security vulnerabilities:** [SECURITY.md](SECURITY.md) (please do not file public issues)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

---

## License

[Apache License 2.0](LICENSE).
