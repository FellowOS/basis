# Basis

**Ontology-driven agent context service** — verifiable enterprise context and governed state mutations for AI agents across documents, databases, and business systems.

Basis is an open-source stack on the [Semantica](https://github.com/semantica-agi/semantica) Python SDK: a **FastAPI** backend (`basis`) and a **React studio** (`@basis/web`). Unstructured files, SQL databases, and SaaS apps (via the declarative **BOCP** connector engine) align to a canonical **evidence ledger**; graph and search are **rebuildable projections**. Agents integrate through **OpenAPI v1** and **MCP**, with human-in-the-loop review for state-changing operations.

[简体中文](./README.zh-CN.md)

[![CI](https://github.com/FellowOS/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/FellowOS/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10--3.13-blue.svg)](pyproject.toml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](web/package.json)

> **Status:** Early development (`0.1.x`). HTTP and MCP surfaces are stabilizing; pin releases for production pilots.

---

## Features

- **Evidence ledger** — canonical statements, entities, provenance; graph and vectors are projections you can rebuild.
- **Knowledge bases** — document ingest, chunk search (lexical + embeddings), processing jobs, review queue.
- **Graph & ontology** — Explorer-style graph UI, vocabulary, SHACL, SPARQL, ontology hub workflows.
- **Connectors (BOCP)** — shipped providers (e.g. postgres, mysql, github, slack); inbound sync and governed writeback.
- **Agent APIs** — KB-scoped **OpenAPI v1** and **MCP** (`search_chunks`, `find_entities`, connector tools, review ops).
- **Platform** — users, org SSO (OIDC/SAML optional), KB roles, API tokens, audit.

After `npm run dev`, in-app product docs: **`http://127.0.0.1:5173/docs`** · API explorer: **`/swagger`** · live spec: **`/openapi/v1.json`**.

---

## Architecture

```text
Basis Web (:5173)  ──proxy /api──▶  Basis API (:8090)  FastAPI
                                     ├─ interface/  HTTP + MCP wire
                                     ├─ application/  shared agent operations
                                     ├─ domain/  ledger, graph, connectors, tenancy
                                     └─ semantica SDK  parse, graph, LLM, vectors…
```

Integrations should call **Basis** (`/api/v1/...` and KB MCP), not Semantica directly.

---

## Quick start

### Prerequisites

- **Python** 3.10–3.13 and [uv](https://docs.astral.sh/uv/)
- **Node.js** ≥ 22 and npm
- **Semantica** — this repo expects a sibling checkout (see below)

### 1. Clone repositories

`pyproject.toml` points `semantica` at `../../semantica` (editable). Use a common parent directory:

```bash
mkdir -p ~/src && cd ~/src
git clone https://github.com/FellowOS/basis.git
git clone https://github.com/semantica-agi/semantica.git
# ~/src/semantica and ~/src/basis
```

Optional: `cp basis/uv.toml.example basis/uv.toml` if your Semantica path differs.

### 2. Configure and run API

```bash
cd basis
cp .env.example .env
uv sync --extra dev
uv run basis
```

API listens on `http://127.0.0.1:8090` by default.

### 3. Run Web

```bash
cp web/.env.example web/.env
cd web && npm install && npm run dev
```

Open `http://127.0.0.1:5173` · register — the **first user** becomes platform admin.

### 4. Smoke-test in the UI

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
| **Semantics** | Prompt labels | Ontologies, mappings, rules, SHACL, SPARQL |
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

`uv sync` installs Basis runtime extras (document parse, embeddings, SHACL, OpenAI-compatible LLM, etc.). Optional groups: `dev`, `heavy`, `explorer`, `saml` — see [pyproject.toml](pyproject.toml).

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
