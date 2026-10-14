# Initial implementation backlog

This backlog converts the accepted knowledge model and Explorer integration design into the first
implementable vertical slice:

> Upload a document → persist source/evidence → build a graph projection → browse the graph through
> Sema-authenticated Explorer-compatible APIs → restart without losing data.

It is deliberately narrower than the complete product roadmap. Each task has dependencies and
acceptance gates so it can become an issue without rediscovering architecture.

References:

- [Product and roadmap](product-and-roadmap.md)
- [Data model](data-model.md)
- [Explorer integration](explorer-integration.md)
- [ADR 0001](../decisions/0001-canonical-knowledge-model.md)

## 1. Definition of done for every task

- API behavior has automated tests for success, authorization, validation, and failure.
- A schema change includes forward migration and fresh-database tests.
- User-visible errors have a stable code.
- No secret or raw exception is logged or returned.
- KB-owned operations have a two-KB isolation test.
- New persistence behavior survives process restart.
- Frontend changes compile, lint, and include a focused component/integration test.
- The relevant `F-*` status in `product-and-roadmap.md` is updated.

## 2. Milestone M1 — persistence foundation

### M1-01 — Introduce ordered SQLite migrations

**Status:** done (0001 baseline + 0002 knowledge ledger schema; runner + tests)  
**Depends on:** none  
**Touches:** `sema/admin/store.py`, new `sema/admin/migrations/`, tests

Work:

- implement `schema_migrations` with version/checksum;
- move current DDL into a baseline migration without losing existing local databases;
- execute migrations transactionally at startup;
- fail startup on changed applied migration or partial failure.

Acceptance:

- empty database reaches latest schema;
- a fixture matching today's database upgrades without losing users/KBs/sessions/audit;
- applying migrations twice is a no-op;
- checksum mismatch produces a clear startup failure.

### M1-02 — Separate login sessions from API tokens

**Depends on:** M1-01  
**Maps to:** F-ACC-01, F-ACC-04

Work:

- preserve existing `tokens` rows as login sessions;
- add expiry-ready session schema and `api_tokens`;
- do not expose API-token CRUD yet unless needed by tests;
- introduce repository methods that make session/API-token semantics unambiguous.

Acceptance:

- current login/logout tests still pass;
- API-token hashes cannot authenticate as browser sessions;
- deactivating a user revokes both categories.

### M1-03 — Add canonical document/ledger schema

**Status:** partial (`KnowledgeStore`: upload/version/job, chunk, entity, open statement + KB guards)  
**Depends on:** M1-01  
**Maps to:** F-SRC-01–04, F-LDG-02

**Note:** DDL in `0002_knowledge_ledger.sql`. Done: mappings, typed facts, review queue, `entity_merges` with projector redirect + revert rebuild, ledger read routes. Remaining: Explorer-only graph merges vs ledger parity, full governance state machine.

Work:

- implement typed repository methods rather than exposing raw SQL to routes;
- enforce KB ownership in repository calls.

Acceptance:

- constraints from `data-model.md` are tested;
- same-name entities coexist;
- invalid object/evidence shapes are rejected;
- repository cannot return a row from another KB when IDs are mixed.

### M1-04 — Add atomic content-addressed blob storage

**Status:** done (`sema/knowledge/blob_store.py`, wired on `app.state`)  
**Depends on:** M1-03  
**Maps to:** F-SRC-02

Work:

- store upload bytes below `data/blobs/{kb_id}/` by SHA-256;
- use temp file + fsync + rename;
- validate filename only as metadata;
- provide get/delete-reference APIs; physical dedup is allowed inside one KB.

Acceptance:

- path traversal filename cannot escape data directory;
- interrupted write leaves no visible partial blob;
- same bytes create one blob but distinct document versions;
- unauthorized KB cannot read another KB's blob.

## 3. Milestone M2 — evidence-first ingest

### M2-01 — Define parser output contract

**Depends on:** M1-03, M1-04  
**Maps to:** F-SRC-02–04

Work:

- replace “parser returns one text string” with document blocks/chunks plus metadata;
- retain DOCX/PDF/text support;
- record document/version/job transitions;
- keep parser invocation in worker thread.

Acceptance:

- DOCX paragraphs/tables produce deterministic chunk order;
- parse failure leaves version `failed` with stable code;
- original upload remains available;
- successful parse reaches `extracting` or `ready`.

**Status:** done — source upload and processing are separate: upload creates an `uploaded` version;
`POST .../processing/jobs` snapshots per-version options and starts parse/chunk/embed/extract.
Processing jobs expose stage via version status and persist result/error summaries.

### M2-02 — Convert extraction output to open statements

**Depends on:** M2-01  
**Maps to:** F-EXT-01, F-LDG-02

Work:

- adapt pattern/ml/llm outputs to one open-statement write contract;
- save `surface_phrase`, subject/object, confidence, and evidence;
- verify quote offsets where available;
- record drops/signals instead of silently discarding invalid output;
- do not treat relationship type as ontology URI without a confirmed mapping.

Acceptance:

- an extracted relation has a statement ID and evidence that opens its chunk;
- malformed output creates an extraction-drop row;
- retry with the same idempotency key does not duplicate statements;
- no graph mutation occurs before the canonical transaction commits.

**Status:** partial — `ledger_extract` + per-chunk writes on upload ingest; ingest marks projection `dirty` on failure (except `build_failed`) and rebuilds before version `ready`; processing jobs support `idempotency_key`; full ledger txn ordering still deferred.

### M2-03 — Separate source upload from processing

**Depends on:** M2-01, M2-02  
**Maps to:** F-SRC-01–03

Work:

- source upload creates document/version/blob only;
- processing is started explicitly through a KB-scoped job endpoint;
- snapshot chunk/extraction options on each job and support retry attempts;
- retain compatibility for legacy requests that explicitly send old processing fields.

Acceptance:

- existing text and file upload flows remain usable;
- clients can distinguish upload accepted from indexing complete;
- job polling is role-protected and KB-isolated.

**Status:** done — source-only text/file upload; `GET/POST .../processing/jobs`; immutable
`options_json` and `result_json`; active-job conflict guard; retry creates a new attempt. Web keeps
documents and processing together in Sources, with status/actions in the document list; remaining
top-level groups are Knowledge / Explore / Governance / Settings.

## 4. Milestone M3 — graph projection

### M3-01 — Implement ledger-to-ContextGraph projector

**Depends on:** M1-03, M2-02  
**Maps to:** F-GRAPH-01, F-LDG-01–02

Work:

- project active entities, documents, open statements, typed facts, and derived facts;
- use UUID-backed node identity, not labels;
- attach ledger/evidence IDs and layer metadata;
- increment `projection_state.revision`;
- support full rebuild first; incremental update may follow.

Acceptance:

- rebuilding twice yields semantically identical graph JSON;
- same-name entities remain distinct;
- invalidated statements disappear from current projection but remain in ledger;
- projection failure marks state dirty/failed without losing ledger rows.

**Status:** partial — `graph/projector.py` full rebuild from documents/entities/statements; ingest ends with `apply_rebuild_to_session`; `POST .../graph/rebuild`; `projection_state` revision bump; ontology nodes preserved. Typed/derived facts and incremental rebuild not done.

### M3-02 — Make graph snapshot persistence atomic

**Depends on:** M3-01  
**Maps to:** F-GRAPH-01

Work:

- temp + fsync + rename;
- per-KB write serialization;
- projection schema/revision metadata;
- load rejects or rebuilds stale snapshots.

Acceptance:

- simulated interrupted save preserves previous valid snapshot;
- concurrent same-KB saves do not corrupt JSON;
- process restart loads or rebuilds the same revision.

**Status:** done — atomic graph + `.json.meta` writes, per-KB lock, `graph_for` rebuilds when snapshot revision lags ledger; saves stamp `projection_revision`.

### M3-03 — Build legacy graph migration command

**Depends on:** M1-03, M3-01  
**Maps to:** ADR migration

Work:

- dry-run current `data/graphs/*.json`;
- create legacy documents/entities/statements without invented evidence;
- retain old graph files until verification;
- emit migration report.

Acceptance:

- command is idempotent;
- counts and sampled labels/edges reconcile;
- unmappable records are reported, not silently dropped;
- rollback restores use of untouched old snapshot.

**Status:** done — `sema migrate-legacy-graphs [--dry-run] [--rebuild] [--kb-id …]`; `legacy_import` statements without fabricated offsets; graph JSON files untouched; JSON report on stdout.

## 5. Milestone M4 — Explorer runtime adapter

### M4-01 — Add optional Explorer runtime dependency

**Depends on:** M3-01

Work:

- add `semantica[explorer]` to the appropriate Sema extra/runtime bundle;
- verify supported Semantica version;
- add a capability probe so missing optional pieces disable workspaces without breaking startup.

Acceptance:

- clean `uv sync` provides Explorer Python modules;
- Sema starts with expected graph capability;
- compatibility smoke test imports schemas/session and constructs a runtime.

**Status:** partial — optional `uv sync --extra explorer`; `capabilities.explorer_runtime` probe; tests when extra installed.

### M4-02 — Implement `ExplorerSessionRegistry`

**Depends on:** M3-02, M4-01  
**Maps to:** F-GRAPH-02–05

Work:

- one `semantica.explorer.session.GraphSession` per active KB projection;
- single-flight load, bounded cache, idle eviction;
- rebuild Explorer search index after load;
- per-KB lock and WebSocket manager;
- invalidate runtime on projection revision change.

Acceptance:

- concurrent requests to two KBs cannot see each other's nodes;
- same KB concurrent load creates one runtime;
- eviction/reload preserves graph and search;
- memory/cache limits are configurable.

**Status:** partial — registry + idle eviction; WS tickets; `access_revoked` on member removal, role change, and user deactivation. Pending: graph split on merge revert.

### M4-03 — Add Sema graph read adapters

**Depends on:** M4-02  
**Maps to:** F-GRAPH-01–04, F-SRCH-05

Work:

- implement stats, paginated nodes/edges, graph search, neighbors, path;
- reuse Explorer schemas/session methods;
- translate errors to Sema codes;
- enforce viewer role before runtime lookup.

Acceptance:

- OpenAPI documents concrete request/response models;
- pagination has deterministic cursor behavior and server maximum;
- unauthorized and wrong-KB requests do not reveal graph existence;
- compatibility tests compare representative responses with Explorer semantics.

**Status:** partial — read/search/temporal/enrich/provenance/semantic-neighborhood; `sparql`, `reasoning/run`, `decisions`; merge/import `409` → review; global `/api/reason` → 410. Remaining: ontology load/graph write adapters beyond enrich.

### M4-04 — Add KB-scoped realtime ticket and WebSocket

**Depends on:** M4-02  
**Maps to:** F-GRAPH-05

Work:

- issue hashed, one-time, ≤60-second ticket via authenticated HTTP;
- implement KB-bound WS endpoint and Origin check;
- include projection revision in events;
- close sockets when user/KB access is revoked.

Acceptance:

- expired, reused, wrong-user, and wrong-KB tickets fail;
- mutation in KB A never reaches KB B;
- revision gap event causes documented refetch behavior.

**Status:** partial — `POST .../realtime-ticket` (60s, one-time, hashed); `WS .../ws/graph-updates`; Origin allowlist; `projection_updated` on graph save/ingest; graph page auto-refresh. Revoke-on-role-delete and multi-process hub not done.

## 6. Milestone M5 — Graph workspace in Sema Web

### M5-01 — Introduce injectable Explorer client

**Depends on:** M4-03  
**Maps to:** F-UI-01

Work:

- define `ExplorerClient` and provider;
- route HTTP through Sema API auth wrapper;
- prefix current KB;
- centralize capabilities and error mapping;
- remove direct API usage from the first reused Graph modules.

Acceptance:

- unit test proves every request includes current KB ID and authorization;
- switching KB cancels/invalidates previous queries;
- no reused Graph module performs root-relative Explorer fetch directly.

**Status:** partial — `explorerHttp` + `ExplorerHostProvider`; zone shells incl. `KbVocabularyHubWorkspace` (SKOS + Alignments), mappings page; capabilities gate nav. Remaining: full package entry from Semantica (M5-02).

### M5-02 — Package/refactor reusable Graph workspace

**Depends on:** M5-01

Work:

- expose Graph workspace from Semantica Explorer through a supported package entry;
- isolate workspace styles;
- inject client and theme tokens;
- avoid importing full Explorer `App.tsx`.

Acceptance:

- Semantica's own Explorer build still works;
- Sema build consumes the supported entry;
- no global CSS reset leaks into Sema;
- dependency versions are pinned/compatible.

### M5-03 — Replace Sema graph placeholder

**Depends on:** M5-02, M4-04  
**Maps to:** F-GRAPH-02–05, F-UI-01–02

Work:

- render loading, empty, error, and graph states;
- show node/edge stats and bounded initial graph;
- search/focus/entity inspector;
- connect realtime updates and revision refetch;
- respect viewer permissions.

**Status:** partial — Explorer `GraphWorkspace` embedded when `explorer_runtime`; timeline + search/focus; `projection_updated` WS triggers full graph reload + dock notice; KB switch remounts workspace (`key={kbId}`); inspector evidence links resolve ledger `chunk_id` / document neighbors; merge/import gated via review. Remaining: viewer write gates on graph mutations, KB-switch audit in E2E.

Acceptance:

- uploaded document's projected entities/relations appear after job completion;
- selecting evidence opens the Library document/chunk;
- KB switch leaves no prior KB data on screen;
- large graph does not request unbounded nodes/edges.

## 7. Cross-cutting tasks required before M5 release

### X-01 — Stable API error registry

- define codes for auth, validation, parse, job, projection, capability, conflict;
- localize messages in Web;
- stop exposing raw server strings.

**Status:** partial — AdminError `detail.code` on KB routes; Explorer/ontology adapters use `invoke_explorer`; Web `api-error-message` covers processing, graph, mappings, auth, members, models, and realtime tickets; login uses coded errors. Remaining: audit remaining shell pages for raw `err.message`.

### X-02 — Request IDs and structured logging

- request/job/projection IDs in logs and audit;
- redact authorization, API keys, document content, and model secrets.

### X-03 — Backup/recovery baseline

- consistent SQLite + blob + projection backup procedure;
- restore test;
- projections may rebuild, canonical DB/blobs may not.

### X-04 — Limits

- configure upload bytes, extracted characters, chunk count, graph page size, worker concurrency,
  parse/LLM timeout;
- reject before allocating unbounded memory where possible.

**Status:** partial — graph nodes/edges/snapshot capped via `sema.limits` (200/400); import blob 50MB;
entity/chunk ledger reads bounded. Remaining: env tuning, chunk search limits, worker concurrency.

## 8. Task dependency graph

```text
M1-01
 ├─ M1-02
 └─ M1-03 ─ M1-04 ─ M2-01 ─ M2-02 ─ M2-03
              └──────────────── M3-01 ─ M3-02 ─ M4-01 ─ M4-02
                                      └─ M3-03            ├─ M4-03 ─ M5-01 ─ M5-02 ─ M5-03
                                                         └─ M4-04 ─────────────────────┘
```

X-01 and X-02 begin with M1; X-03 and X-04 must pass before M5 release.

## 9. Vertical-slice release gate

The slice is complete only when:

1. a DOCX upload creates a canonical document/version/chunks/statements;
2. every visible extracted relation carries a stable statement/evidence reference;
3. graph projection rebuild is deterministic and survives restart;
4. a viewer can browse but not mutate;
5. two KBs remain isolated under concurrent HTTP and WS tests;
6. the Sema graph page uses the injected Explorer client;
7. migration of existing JSON graphs is dry-runnable and non-destructive;
8. backup and restore reproduce the canonical ledger, after which projections rebuild.

Review, mappings, SPARQL, Decision, chat, and ontology editing follow this foundation and must not
introduce a second source of truth.

**Automated coverage (partial):** `tests/test_release_gate.py`, `tests/test_graph_page_limits.py`,
`tests/test_legacy_graph_migration.py`, `tests/test_ws_hub.py`, `tests/test_realtime_ws.py`, and
`packages/web/src/explorer/host/explorerHttp.test.ts`.

## 10. Engineering debt (post graph-closure)

| Item | Notes |
| --- | --- |
| Web strict indexed access | `noUncheckedIndexedAccess` disabled in `packages/web/tsconfig.json` for Explorer graph code; re-enable incrementally if desired. |
| `vitest` for `packages/web` | Wired in CI (`pnpm --filter @sema/web test`). |
| Git remote | Local `main` has CI workflow; push after `git remote add origin …`. |
