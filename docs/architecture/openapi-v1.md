# Basis OpenAPI v1 — normative HTTP contract

## Status

- **Decision:** accepted — normative narrative for OpenAPI v1 + MCP (snapshots in `openapi/basis-v1*.json`)
- **Rule:** The server exposes **OpenAPI (HTTP)** and **MCP**. **Core / integration** capabilities live in the KB OpenAPI slice + MCP; **console application** HTTP may exist at runtime and in the **full** export but is **excluded** from the KB integration contract (`x-basis-audience: console`).

## 1. Two OpenAPI audiences (platform vs knowledge-base)

HTTP OpenAPI is **one implementation**, but **two documented contracts** — different auth, different clients:

| Surface | Who uses it | Auth | Typical paths | Spec file |
| --- | --- | --- | --- | --- |
| **Platform** | Web console (admin, org settings, model catalog, user mgmt, KB create/list, token **management**) | **Session JWT** only (`POST /api/v1/auth/login`) | `/api/v1/platform/*`, `/api/v1/admin/*`, `/api/v1/settings/*`, `/api/v1/models/*`, `/api/v1/orgs/*`, `/api/v1/kbs` (collection), `/api/v1/kbs/{kb_id}/members`, `/api/v1/kbs/{kb_id}/tokens`, … | `GET /openapi/v1/platform.json` |
| **Knowledge-base** | Integrations, agents, automation — **same as MCP** | **KB API token** (`read` / `write`) **or** user session with KB viewer/editor role | `/api/v1/kbs/{kb_id}/*` except session-only admin subpaths; includes `GET/POST .../mcp`, search, graph, ledger, ingest, … | `GET /openapi/v1/kb.json` |

**Public** (both specs include bootstrap): `/api/v1/health`, `/api/v1/auth/*` (register/login/OAuth).

**Runtime today:** `resolve_bearer` accepts session **or** API token on many KB routes; platform routes call `require_system_admin` or `get_kb_for_admin` and **reject API tokens** where documented (e.g. creating/listing API tokens). The export marks each operation with extensions:

- `x-basis-surface`: `public` | `platform` | `knowledge-base`
- `x-basis-auth`: `session` | `session-or-kb-api-token` | `public-or-session`
- `x-basis-audience`: `console` on application-layer routes (omitted from KB slice export)
- `x-basis-integration-contract`: `false` when not part of the agent/integration SDK surface

**MCP** remains JSON-RPC on `POST /api/v1/kbs/{kb_id}/mcp` but is **documented in the KB OpenAPI** surface (same token as HTTP).

**Application client:** the web app embeds OpenAPI types under `web/src/lib/basis-openapi/`; a standalone npm SDK is optional later.

## 2. Why spec comes first

Implementation today leads the contract (`FastAPI` routes → auto `/openapi.json`). That produces a **dump of internal routes**, not a **designed API**.

**Current order (implemented):**

1. **Normative export** — live `GET /openapi/v1.json` from `app.openapi()` + handler docstrings (`basis/integration/openapi_v1_export.py`); snapshots [`openapi/basis-v1*.json`](../../openapi/basis-v1.json) for CI and web typegen.
2. **`basis/integration/`** — operations shared by HTTP and MCP (`KbCoreContext`, registry).
3. **HTTP handlers** — thin wrappers calling integration; new public ops need docstrings + OpenAPI export update.
4. **`web/`** — `web/src/lib/basis-openapi/` types from JSON snapshots.

New integration-facing operations should appear in the KB slice export and (when agent-relevant) MCP registry.

## 3. Artifact locations

| Artifact | Path | Role |
| --- | --- | --- |
| **Served documents** | `GET /openapi/v1.json`, `GET /openapi/v1/platform.json`, `GET /openapi/v1/kb.json` | Live `app.openapi()` export (+ Basis extensions) |
| **JSON snapshots** (optional) | [`openapi/basis-v1.json`](../../openapi/basis-v1.json), platform/kb slices | CI drift check + `web` `gen:openapi-types` |
| **MCP tool schemas** | Derived from KB OpenAPI slice via `basis/integration/mcp_openapi.py` (`MCP_TOOL_OPERATIONS`) | Path/query params + JSON body merged into one flat `inputSchema`; `describe_kb` → `GET .../kbs/{kb_id}` (empty args; `kb_id` from MCP session) |
| **Error codes** | `components.schemas.ApiError` + enum aligned with `web/src/i18n/locales/en/apiErrorCodes.ts` | |

**Baseline:** OpenAPI is **generated from code** (`app.openapi()` + export helpers). Handler docstrings → `description`. Snapshots: `uv run python scripts/generate-openapi-v1.py` → `openapi/*.json` (CI drift + web typegen; fails if any operation lacks `description`). One-off backfill: `uv run python scripts/backfill_route_docstrings.py` (reads `openapi/basis-v1.json`).

## 4. Global conventions (v1)

### 4.1 Base URL and versioning

- **Prefix:** `/api/v1` for all HTTP operations (single tree; drop ad-hoc unversioned `/api/...` at cutover).
- **Breaking changes:** new major `/api/v2` + new YAML file; v1 frozen for 12 months minimum once GA.

### 4.2 Auth

- **Header:** `Authorization: Bearer <token>` on protected operations.
- **`sessionAuth`:** platform surface; login session JWT.
- **`kbApiTokenAuth`:** KB surface; token scoped to one or more `kb_id`, `read` or `write` (see `POST .../tokens` on platform surface only).

### 4.3 Errors

HTTP status + body:

```yaml
ApiError:
  type: object
  required: [code, message]
  properties:
    code: { type: string }
    message: { type: string }
    details: { type: object, additionalProperties: true }
```

`code` values must exist in i18n `apiErrorCodes` (en/zh).

### 4.4 KB tenancy

- KB-scoped paths: `/api/v1/kbs/{kb_id}/...`
- Platform-scoped: `/api/v1/platform/...`, `/api/v1/orgs/...`, etc.

### 4.5 Pagination / lists

Standard query params where applicable: `limit`, `cursor` (or `offset` — **pick one in YAML** and use everywhere).

### 4.6 Non-HTTP protocols

| Protocol | Documented in OpenAPI? | Notes |
| --- | --- | --- |
| **MCP** JSON-RPC | Separate section in this doc + link from YAML `description` | `POST /api/v1/kbs/{kb_id}/mcp` |
| **Graph WebSocket** | `webhooks` / extension `x-basis-websocket` | Path today: `/api/kbs/{kb_id}/graph/ws` → v1 path TBD in YAML |
| **SSE (chat, alerts)** | `text/event-stream` operations documented with `@fastapi` response class | |

## 5. Domain inventory (checklist)

Map every **current** router module to OpenAPI **tags** and paths. Check off when paths appear in the live export and snapshots under `openapi/basis-v1*.json`.

| Tag | Current module(s) | ~Routes | In v1 YAML | Notes |
| --- | --- | ---: | --- | --- |
| `Health` | `health.py` | 1 | ☐ | |
| `Auth` | `auth.py`, `oauth.py` | 13 | ☐ | OAuth flows |
| `Users` | `users.py` | 5 | ☐ | |
| `Organizations` | `organizations.py` | 5 | ☐ | SSO / org admin |
| `Platform` | `platform.py`, `settings.py` | 5 | ☐ | |
| `Models` | `models.py`, `model_providers.py` | 7 | ☐ | |
| `KnowledgeBases` | `kbs.py`, `kb_graph.py`, `kb_documents.py` | 37 | ☐ | CRUD (`kbs`); graph/search (`kb_graph`); documents/jobs (`kb_documents`) |
| `Sources` | `kb_sources.py` | 9 | ☐ | Ingest, documents, jobs |
| `Ledger` | `kb_ledger.py` | 12 | ☐ | Entities, statements |
| `Explorer` | `kb_explorer.py` | 17 | ☐ | Graph session, diff, import/export, … |
| `Ontology` | `kb_ontology.py` | 9 | ☐ | |
| `Mappings` | `kb_mappings.py` | 3 | ☐ | |
| `Review` | `kb_review.py` | 7 | ☐ | Queue, graph import |
| `Alerts` | `kb_alerts.py` | 3 | ☐ | |
| `Remember` | `kb_ledger.py` | 1 | ☐ | `POST .../remember/proposals` = core `propose_remember` (MCP parity). Playground LLM is browser-local config + direct upstream calls; not Basis OpenAPI. |
| `Tokens` | `kb_tokens.py` | 3 | ☐ | API tokens for MCP/OpenAPI |
| `Reasoning` | `reasoning.py`, `kb_reasoning_rules.py` | 5 | ☐ | |
| `Audit` | `audit.py` | 1 | ☐ | |
| `Realtime` | `realtime.py` | 1 | ☐ | WS ticket |
| `MCP` | `mcp.py` | 2 | ☐ | Discovery GET + JSON-RPC POST |
| `E2E` | `kb_e2e_helpers.py` | 2 | ☐ | **Exclude** from public spec or `x-internal: true` (omitted unless `data-e2e`) |

Generated baseline includes all routes registered in a default app instance (typically **without** e2e helpers).

**Total:** ~150 HTTP route handlers to normalize (excluding e2e helpers from public contract if desired).

## 6. MCP ↔ OpenAPI alignment

MCP tools are a **named subset** of core operations. Each tool:

| MCP tool | OpenAPI operation (target) |
| --- | --- |
| `describe_kb` | `GET /api/v1/kbs/{kb_id}` or dedicated `.../describe` |
| `search_chunks` | `GET` or `POST .../search/chunks` |
| `get_chunk` | `GET .../chunks/{chunk_id}` |
| `find_entities` | `GET .../entities/find` |
| `neighbors` | `GET .../graph/nodes/{node_id}/neighbors` |
| `paths` | `GET .../graph/path` |
| `entity_facts` | `GET .../entities/{entity_id}/facts` |
| `propose_remember` | `POST .../remember/proposals` |
| `graph_search` | `POST .../graph/search` |
| `list_review_items` | `GET .../review/items` |
| `get_review_item` | `GET .../review/items/{item_id}` |
| `approve_statement_remember_review` | `POST .../review/items/{item_id}/approve` *(statement_remember only; legacy tool name)* |
| `reject_statement_remember_review` | `POST .../review/items/{item_id}/reject` *(statement_remember only; legacy tool name)* |
| `approve_review_item` | `POST .../review/items/{item_id}/approve` *(all review kinds; same HTTP handler)* |
| `reject_review_item` | `POST .../review/items/{item_id}/reject` *(all review kinds)* |
| `list_connector_catalog` | `GET .../connectors/catalog` |
| `describe_connector_service` | `GET .../connectors/catalog/{service_id}` |
| `list_connector_connections` | `GET .../connectors/connections` |
| `list_connector_table_mappings` | `GET .../connectors/table-mappings` |
| `sync_connector_table_mapping` | `POST .../connectors/table-mappings/{mapping_id}/sync` |
| `execute_connector_tool` | `POST .../connectors/connections/{connection_id}/tools/{tool_name}` |
| `propose_entity_writeback` | `POST .../connectors/writeback/proposals` |

`list_processing_jobs` is **HTTP/core only** (`mcp: false`) — ingest ops, not part of the minimal graph loop.

### 6.1 Minimal graph closed loop (MCP)

Agent/automation **baseline** — no entity-merge, import, or mapping tools:

1. **Read:** `describe_kb`, `search_chunks`, `get_chunk`, `find_entities`, `graph_search`, `neighbors`, `paths`, `entity_facts`
2. **Write (governed):** `propose_remember` → `list_review_items` / `get_review_item` → `approve_statement_remember_review` (or `reject_…`)
3. **Verify:** `entity_facts` / `search_chunks` on the confirmed statement

Ingest and processing jobs stay on OpenAPI (`POST .../documents`, `GET .../processing/jobs`); not exposed as MCP tools until needed.

**Parity principle:** console-capable KB read/write flows that agents need should land in core + MCP. Full review approve/reject (`approve_review_item` / `reject_review_item`) call the same domain services as HTTP; statement-only tool names remain for backward compatibility.

Paths above match the KB OpenAPI slice (`openapi/basis-v1-kb.json` export). Implementation map: `MCP_TOOL_OPERATIONS` in `basis/integration/mcp_openapi.py` (method + path per tool).

**Rule:** MCP `inputSchema` = merged OpenAPI **parameters** (path/query, with aliases such as `q` → `query`) **plus** `requestBody` JSON schema when present. Example: `approve_statement_remember_review` exposes flat `{ item_id, rationale? }` from `.../items/{item_id}/approve` + `ResolveReviewRequest`; `describe_kb` maps to `GET .../kbs/{kb_id}` (no tool args). HTTP approve review returns `ApproveReviewItemResponse` (`item`, optional `decision_id`, plus merge/import fields). MCP response shapes are validated in `basis/integration/models.py`, not re-exported as MCP output schemas.

Tests: `tests/test_mcp_openapi_schemas.py`, closed loop `tests/test_mcp.py::test_mcp_basic_graph_closed_loop`.

## 7. Spec completion workflow

| Step | Owner | Deliverable |
| --- | --- | --- |
| **S1** | API | Fill §4 checklist; export current routes to appendix (script or `python -c` introspection) |
| **S2** | API + Web | Routes + docstrings; regenerate `openapi/basis-v1*.json` |
| **S3** | Web | Map `web/src/lib/api.ts` + Explorer client calls → `operationId` list (no orphan fetch paths) |
| **S4** | Review | PR review: breaking vs v0 `/api/*`; migration table in refactor doc |
| **S5** | CI | Drift check: served export vs committed `openapi/basis-v1*.json` |
| **S6** | API | Deprecate unversioned `/api/*` unless `BASIS_LEGACY_API_ENABLED` |

## 8. Relation to `basis/integration/`

- Integration-facing OpenAPI operations have a **registry handler** (or deliberate HTTP-only exception documented in [progress.md](../progress.md)).
- MCP **only** calls integration; HTTP handlers should call the same ops where parity is required.
- **Forbidden:** agent-critical business logic only in route bodies with no integration entry (reviewer rule of thumb).

## 9. Related documents

- [package-layout.md](package-layout.md) — `basis/integration/` operation registry
