# Basis OpenAPI v1 — normative HTTP contract

## Status

- **Decision:** proposed — **this document program is step zero** of [core-rest-sdk-refactor.md](core-rest-sdk-refactor.md)
- **Rule:** The server exposes **two product surfaces**: **OpenAPI (HTTP)** and **MCP**. Everything the console does must exist on OpenAPI; MCP mirrors the **integration subset** of the same **core** (see refactor doc).

## 1. Two OpenAPI audiences (platform vs knowledge-base)

HTTP OpenAPI is **one implementation**, but **two documented contracts** — different auth, different clients:

| Surface | Who uses it | Auth | Typical paths | Spec file |
| --- | --- | --- | --- | --- |
| **Platform** | Web console (admin, org settings, model catalog, user mgmt, KB create/list, token **management**) | **Session JWT** only (`POST /api/v1/auth/login`) | `/api/v1/platform/*`, `/api/v1/admin/*`, `/api/v1/settings/*`, `/api/v1/models/*`, `/api/v1/orgs/*`, `/api/v1/kbs` (collection), `/api/v1/kbs/{kb_id}/members`, `/api/v1/kbs/{kb_id}/tokens`, … | [`openapi/basis-v1-platform.yaml`](../../openapi/basis-v1-platform.yaml) |
| **Knowledge-base** | Integrations, agents, automation — **same as MCP** | **KB API token** (`read` / `write`) **or** user session with KB viewer/editor role | `/api/v1/kbs/{kb_id}/*` except session-only admin subpaths; includes `GET/POST .../mcp`, search, graph, ledger, ingest, … | [`openapi/basis-v1-kb.yaml`](../../openapi/basis-v1-kb.yaml) |

**Public** (both specs include bootstrap): `/api/v1/health`, `/api/v1/auth/*` (register/login/OAuth).

**Runtime today:** `resolve_bearer` accepts session **or** API token on many KB routes; platform routes call `require_system_admin` or `get_kb_for_admin` and **reject API tokens** where documented (e.g. creating/listing API tokens). The YAML marks each operation with extensions:

- `x-basis-surface`: `public` | `platform` | `knowledge-base`
- `x-basis-auth`: `session` | `session-or-kb-api-token` | `public-or-session`

**MCP** remains JSON-RPC on `POST /api/v1/kbs/{kb_id}/mcp` but is **documented in the KB OpenAPI** surface (same token as HTTP).

**Application SDK:** may ship `@basis/client` with `.platform` and `.kb(kbId)` namespaces matching the two specs; codegen runs separately on each YAML or on the merged `basis-v1.yaml`.

## 2. Why spec comes first

Implementation today leads the contract (`FastAPI` routes → auto `/openapi.json`). That produces a **dump of internal routes**, not a **designed API**.

**New order:**

1. **Write and review** `openapi/basis-v1.yaml` (complete, normative).
2. **`basis/core`** implements operations defined in the spec (and shared with MCP).
3. **HTTP handlers** are generated or hand-written to **match the spec** (no undocumented `/api` behavior).
4. **`web/` and `@basis/client`** consume **only** this spec (codegen types + SDK).

Until the YAML is complete and reviewed, **no new public HTTP endpoints** outside the spec.

## 3. Artifact locations

| Artifact | Path | Role |
| --- | --- | --- |
| **Full OpenAPI 3.1** | [`openapi/basis-v1.yaml`](../../openapi/basis-v1.yaml) | Merged inventory (all paths); CI diff |
| **Platform contract** | [`openapi/basis-v1-platform.yaml`](../../openapi/basis-v1-platform.yaml) | Console / admin SDK |
| **KB contract** | [`openapi/basis-v1-kb.yaml`](../../openapi/basis-v1-kb.yaml) | Integration SDK + MCP parity |
| **Served documents** (target) | `GET /openapi/v1/platform.json`, `GET /openapi/v1/kb.json` | Runtime copies; must match YAML in CI |
| **MCP tool schemas** | Derived from same operation definitions as YAML `operationId` / request bodies | No duplicate JSON Schema in Python |
| **Error codes** | `components.schemas.ApiError` + enum aligned with `web/src/i18n/locales/en/apiErrorCodes.ts` | |

**Baseline (2026-03):** [`openapi/basis-v1.yaml`](../../openapi/basis-v1.yaml) is **generated** from the live FastAPI app (`scripts/generate-openapi-v1.py`) with `/api/v1` path prefix — **153 paths**, full `components.schemas` from Pydantic. Treat this as a **complete inventory** to review and harden (operationIds, shared error shape, remove e2e-only routes from public spec if needed). Future edits may be hand-curated in YAML first, then code.

```bash
uv run python scripts/generate-openapi-v1.py
```

Writes all three YAML files and sets `x-basis-surface` / `x-basis-auth` per operation.

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

Map every **current** router module to OpenAPI **tags** and paths. Check off when paths + schemas exist in `basis-v1.yaml`.

| Tag | Current module(s) | ~Routes | In v1 YAML | Notes |
| --- | --- | ---: | --- | --- |
| `Health` | `health.py` | 1 | ☐ | |
| `Auth` | `auth.py`, `oauth.py` | 13 | ☐ | OAuth flows |
| `Users` | `users.py` | 5 | ☐ | |
| `Organizations` | `organizations.py` | 5 | ☐ | SSO / org admin |
| `Platform` | `platform.py`, `settings.py` | 5 | ☐ | |
| `Models` | `models.py`, `model_providers.py` | 7 | ☐ | |
| `KnowledgeBases` | `kbs.py` | 37 | ☐ | CRUD, search, graph search, capabilities, … |
| `Sources` | `kb_sources.py` | 9 | ☐ | Ingest, documents, jobs |
| `Ledger` | `kb_ledger.py` | 12 | ☐ | Entities, statements |
| `Explorer` | `kb_explorer.py` | 17 | ☐ | Graph session, diff, import/export, … |
| `Ontology` | `kb_ontology.py` | 9 | ☐ | |
| `Mappings` | `kb_mappings.py` | 3 | ☐ | |
| `Review` | `kb_review.py` | 7 | ☐ | Queue, graph import |
| `Alerts` | `kb_alerts.py` | 3 | ☐ | |
| `Chat` | `kb_chat.py` | 3 | ☐ | SSE stream |
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
| `neighbors` | `POST .../graph/neighbors` |
| `paths` | `POST .../graph/paths` |
| `entity_facts` | `GET .../entities/{entity_id}/facts` |
| `propose_remember` | `POST .../remember/proposals` |

`graph_search` is registered in core for HTTP only (`mcp: false`); OpenAPI: `POST .../graph/search`.

Paths above match `openapi/basis-v1-kb.yaml` (inventory locked in R1).

**Rule:** MCP `inputSchema` = OpenAPI request body schema for the linked operation.

## 7. Spec completion workflow

| Step | Owner | Deliverable |
| --- | --- | --- |
| **S1** | API | Fill §4 checklist; export current routes to appendix (script or `python -c` introspection) |
| **S2** | API + Web | For each tag, add paths + `components.schemas` to `openapi/basis-v1.yaml` |
| **S3** | Web | Map `web/src/lib/api.ts` + Explorer client calls → `operationId` list (no orphan fetch paths) |
| **S4** | Review | PR review: breaking vs v0 `/api/*`; migration table in refactor doc |
| **S5** | CI | `spectral lint` + diff fails if served `/openapi/v1.json` ≠ YAML |
| **S6** | API | Implement or refactor routes to match YAML; deprecate unversioned paths |

## 8. Relation to `basis/core`

- Every **documented** OpenAPI operation has a **core handler** (even if thin wrapper over `knowledge/` / Explorer).
- MCP **only** calls core; HTTP **only** calls core.
- **Forbidden:** business logic in route bodies that is not reachable from core (lint/rule of thumb for reviewers).

## 9. Related documents

- [core-rest-sdk-refactor.md](core-rest-sdk-refactor.md) — core, MCP, client SDK, migration phases after spec GA
