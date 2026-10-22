<h1 align="center">Basis: Let agents understand real business</h1>

<div align="center">

**Ontology-driven enterprise business semantics layer.**

[![CI](https://github.com/FellowOS/basis/actions/workflows/ci.yml/badge.svg)](https://github.com/FellowOS/basis/actions/workflows/ci.yml)
[![License](https://img.shields.io/badge/License-Apache%202.0-blue.svg)](LICENSE)
[![Python](https://img.shields.io/badge/python-3.10--3.13-blue.svg)](pyproject.toml)
[![Node](https://img.shields.io/badge/node-%3E%3D22-green.svg)](web/package.json)

**English** · [简体中文](./README.zh-CN.md)

</div>

Map documents, databases, and SaaS to **entities, types, and governed facts**. That is the shared meaning layer above raw systems. Run on desktop, self-hosted, or cloud with **OpenAPI v1** and **MCP**. State changes go through review, not silent API calls.

Basis is an open-source stack built on the [Semantica](https://github.com/semantica-agi/semantica) Python SDK. **Business semantics** include mappings, ontologies, rules, and SHACL. They sit on a canonical **evidence ledger**. Graph and search are **rebuildable projections**.

> **Status:** Under active development. APIs may change. Use a pinned release in production.

<p align="center">
  <img src="assets/graph.png" alt="Basis graph workspace: force-directed ledger projection, ontology navigation, temporal scrubber" width="900" style="border-radius: 12px;" />
</p>
<p align="center"><sub>Graph workspace in the Basis studio.</sub></p>

## Table of contents

- [Features](#features)
- [Why Basis](#why-basis)
- [Quick start](#quick-start)
  - [Prerequisites](#prerequisites)
  - [1. Clone and configure API](#1-clone-and-configure-api)
  - [2. Run Web](#2-run-web)
  - [3. Smoke-test in the UI](#3-smoke-test-in-the-ui)
- [Configuration (essentials)](#configuration-essentials)
- [Agent integration (MCP)](#agent-integration-mcp)
- [Semantica dependency](#semantica-dependency)
- [Development](#development)
- [Deployment](#deployment)
  - [Desktop app](#desktop-app)
  - [Self-hosted](#self-hosted)
  - [Managed cloud](#managed-cloud)
- [Community](#community)
- [License](#license)

## Features

- **Business semantics:** Entities, typed facts, mappings, and ontologies. The unit of meaning is not “another chunk.”
- **Evidence ledger:** Canonical statements and provenance. Graph and vectors are projections you can rebuild.
- **Workspaces:** Document ingest, chunk search (lexical + embeddings), processing jobs, and a review queue.
- **Graph & ontology:** Explorer-style graph UI, vocabulary, SHACL, SPARQL, and ontology hub workflows.
- **Connectors (BOCP):** Shipped providers (e.g. postgres, mysql, github, slack) with inbound sync and governed writeback.
- **Agent APIs:** Workspace-scoped **OpenAPI v1** and **MCP** (`search_chunks`, `find_entities`, connector tools, review ops).
- **Platform:** Users, org SSO (OIDC/SAML optional), workspace roles, API tokens, and audit.

## Why Basis

| | Typical “RAG + raw tools” | **Basis** |
| --- | --- | --- |
| **Read path** | Unverified chunks / ad hoc SQL | Ledger and entities. Graph and search rebuild from the ledger. |
| **Write path** | Ungoverned API calls | Review gates (`remember`, connector writeback, conflicts) |
| **Business semantics** | Prompt labels | Shared entities & types, mappings, ontologies, rules, SHACL, SPARQL |
| **Connectivity** | Per-system glue | BOCP manifests, OpenAPI v1, MCP |
| **Ops** | Many services | API and Web. SQLite for dev, PostgreSQL for production. |

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

Open `http://127.0.0.1:5173` and register. The **first user** becomes platform admin.

In-app product docs: **`http://127.0.0.1:5173/docs`** · API explorer: **`http://127.0.0.1:8090/swagger`** · live spec: **`http://127.0.0.1:8090/openapi/v1.json`**.

### 3. Smoke-test in the UI

1. Create a workspace.
2. In **Sources**, paste or upload a short text file and wait for processing.
3. Open **Graph** or **Search** for that workspace.

This path is **self-hosted** dev. For the **desktop app** or **managed cloud**, see [Deployment](#deployment).

## Configuration (essentials)

| Variable | Default | Purpose |
| --- | --- | --- |
| `BASIS_HOST` / `BASIS_PORT` | `127.0.0.1` / `8090` | API bind |
| `BASIS_DATA_DIR` | `./data` | SQLite, blobs, graph JSON |
| `BASIS_DATABASE_URL` | *(unset → SQLite)* | PostgreSQL for production |
| `BASIS_API_URL` | `http://127.0.0.1:8090` | Web dev proxy (`web/.env`) |

Full list: [.env.example](.env.example).

**PostgreSQL:** `docker compose -f compose.postgres.yml up -d`, then  
`BASIS_DATABASE_URL=postgresql://basis:basis@127.0.0.1:5432/basis` (host port **5432**).

**Backups:** `./scripts/backup_basis_data.sh` (SQLite) or `./scripts/backup_basis_postgres.sh` (Postgres).

## Agent integration (MCP)

Create a **workspace API token** (workspace settings → Tokens). MCP endpoint:

`POST /api/v1/workspaces/{workspace_id}/mcp` with `Authorization: Bearer <token>`.

Example `tools/call` (after `tools/list`):

```bash
curl -sS "http://127.0.0.1:8090/api/v1/workspaces/YOUR_WORKSPACE_ID/mcp" \
  -H "Authorization: Bearer YOUR_WORKSPACE_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","id":1,"method":"tools/call","params":{"name":"describe_workspace","arguments":{}}}'
```

Tool names and HTTP paths share the same operation catalog. See live **`/openapi/v1/workspaces.json`** when the API is running.

## Semantica dependency

`semantica` resolves from **PyPI** (see `uv.lock`). `uv sync` installs Basis runtime extras (document parse, embeddings, SHACL, OpenAI-compatible LLM, etc.). Optional groups are `dev`, `heavy`, `explorer`, and `saml`. See [pyproject.toml](pyproject.toml).

Do not add a local `[tool.uv.sources]` override for `semantica`. A gitignored `uv.toml` would still take precedence over defaults. Leave it unset to use PyPI.

For ML NER in processing jobs:

```bash
uv run python -m spacy download en_core_web_sm
```

Chat/embeddings in the console need provider API keys only when you use LLM-backed features.

## Development

```bash
uv run pytest -q
uv run lint-imports --config importlinter.ini
cd web && npm run typecheck && npm test
cd web && CI=1 npm run test:e2e   # optional, Playwright + API
```

Layout for contributors is `basis/interface`, `application`, `domain`, and `infra`. See [AGENTS.md](AGENTS.md).

## Deployment

One product stack (API + studio). Pick **where** it runs. The **OpenAPI v1** and **MCP** contracts are the same across modes.

### Desktop app

**Local client** (Electron) for a single machine: API sidecar + studio, data under `~/.basis`, optional **no-login** desktop profile for personal use.

- **Develop:** `cd desktop && npm install && npm run dev`. See [desktop/README.md](desktop/README.md) for packaging and macOS/Windows builds.
- **Profile:** `BASIS_DEPLOYMENT_PROFILE=desktop` (see `profiles/profile.desktop.yaml`).

Do not run a dev API and an installed desktop app at once. They share `~/.basis/basis.db`.

### Self-hosted

**You operate** the stack on your network or cloud VM (air-gapped OK). You control platform login, org SSO, workspaces, and backups under your policies.

- **Try locally:** [Quick start](#quick-start) (`uv run basis` + `npm run dev`, SQLite).
- **Production:** PostgreSQL (`compose.postgres.yml`), set `BASIS_DATABASE_URL`, TLS in front of API/Web, and pin a release. See [Configuration (essentials)](#configuration-essentials).

### Managed cloud

**FellowOS-hosted SaaS** provides multi-tenant signup with operations and upgrades on our side. Integrate agents against the same workspace **HTTP/MCP** endpoints with your issued tokens.

Hosted availability is rolling out. For access or pilots, open a [GitHub Issue](https://github.com/FellowOS/basis/issues) and describe your use case.

## Community

- **Bug reports & features:** [GitHub Issues](https://github.com/FellowOS/basis/issues)
- **Security vulnerabilities:** [SECURITY.md](SECURITY.md) (please do not file public issues)
- **Contributing:** [CONTRIBUTING.md](CONTRIBUTING.md) · [CODE_OF_CONDUCT.md](CODE_OF_CONDUCT.md)

## License

[Apache License 2.0](LICENSE).
