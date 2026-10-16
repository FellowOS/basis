# Initial implementation backlog

This backlog converts the accepted knowledge model and Explorer integration design into the first
implementable vertical slice:

> Upload a document → persist source/evidence → build a graph projection → browse the graph through
> Basis-authenticated Explorer-compatible APIs → restart without losing data.

It is deliberately narrower than the complete product roadmap. Each task has dependencies and
acceptance gates so it can become an issue without rediscovering architecture.

References:

- [Product and roadmap](product-and-roadmap.md)
- [Capability gap checklist](capability-gap-checklist.md) — post–Explorer migration inventory (excluded vs partial vs P0/P1)
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
**Touches:** `basis/admin/store.py`, new `basis/admin/migrations/`, tests

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

**Status:** done (`basis/knowledge/blob_store.py`, wired on `app.state`)  
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

**Status:** partial — `graph/projector.py` full rebuild from documents/entities/statements/typed/derived facts; ingest ends with `apply_rebuild_to_session`; `POST .../graph/rebuild`; `projection_state` revision bump; ontology nodes preserved. Incremental rebuild not done.

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

**Status:** done — `basis migrate-legacy-graphs [--dry-run] [--rebuild] [--kb-id …]`; `legacy_import` statements without fabricated offsets; graph JSON files untouched; JSON report on stdout.

## 5. Milestone M4 — Explorer runtime adapter

### M4-01 — Add optional Explorer runtime dependency

**Depends on:** M3-01

Work:

- add `semantica[explorer]` to the appropriate Basis extra/runtime bundle;
- verify supported semantica version;
- add a capability probe so missing optional pieces disable workspaces without breaking startup.

Acceptance:

- clean `uv sync` provides Explorer Python modules;
- Basis starts with expected graph capability;
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

**Status:** done (baseline) — registry + idle eviction; WS tickets; `access_revoked` on member removal, role change, and user deactivation; ledger merge revert rebuilds projection, invalidates Explorer cache, and re-wraps Explorer when `basis.graph` is replaced (`test_revert_entity_merge_refreshes_explorer_nodes`).

### M4-03 — Add Basis graph read adapters

**Depends on:** M4-02  
**Maps to:** F-GRAPH-01–04, F-SRCH-05

Work:

- implement stats, paginated nodes/edges, graph search, neighbors, path;
- reuse Explorer schemas/session methods;
- translate errors to Basis codes;
- enforce viewer role before runtime lookup.

Acceptance:

- OpenAPI documents concrete request/response models;
- pagination has deterministic cursor behavior and server maximum;
- unauthorized and wrong-KB requests do not reveal graph existence;
- compatibility tests compare representative responses with Explorer semantics.

**Status:** partial — read/search/temporal/enrich/`GET .../provenance` + report/semantic-neighborhood; `sparql`, `reasoning/run`, `decisions`; merge/import `409` → review; global `/api/reason` → 410; ontology hub (`ontology_kb_hub`) load/create/publish/remove + `POST .../ontology` audited (`kb.graph.ontology_*`). Web: KB-only ontology/vocabulary paths (`ontologyKb` / `vocabularyKb`); standalone Explorer `App.tsx` removed. Remaining: optional `distance-matrix` adapter if UI enables structural matrix API.

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

**Status:** partial (single-process) — ticketed `WS .../ws/graph-updates`; `projection_updated` on save/ingest/rebuild; revoke on member removal and user deactivation; tests in `test_ws_hub.py` / `test_realtime_ws.py`. Ops: `docs/ops/realtime-websocket.md`. **Deferred:** Redis / cross-instance WS pub/sub (use one API worker or LB sticky sessions instead).

## 6. Milestone M5 — Graph workspace in Basis Web

### M5-01 — Introduce injectable Explorer client

**Depends on:** M4-03  
**Maps to:** F-UI-01

Work:

- define `ExplorerClient` and provider;
- route HTTP through Basis API auth wrapper;
- prefix current KB;
- centralize capabilities and error mapping;
- remove direct API usage from the first reused Graph modules.

Acceptance:

- unit test proves every request includes current KB ID and authorization;
- switching KB cancels/invalidates previous queries;
- no reused Graph module performs root-relative Explorer fetch directly.

**Status:** partial — `explorerHttp` + `ExplorerHostProvider`; zone shells incl. `KbVocabularyHubWorkspace` (SKOS + Alignments), mappings page; capabilities gate nav. Remaining: full package entry from semantica (M5-02).

### M5-02 — Package/refactor reusable Graph workspace

**Depends on:** M5-01

Work:

- expose Graph workspace from semantica Explorer through a supported package entry;
- isolate workspace styles;
- inject client and theme tokens;
- avoid importing full Explorer `App.tsx`.

Acceptance:

- semantica's own Explorer build still works;
- Basis build consumes the supported entry;
- no global CSS reset leaks into Basis;
- dependency versions are pinned/compatible.

### M5-03 — Replace Basis graph placeholder

**Depends on:** M5-02, M4-04  
**Maps to:** F-GRAPH-02–05, F-UI-01–02

Work:

- render loading, empty, error, and graph states;
- show node/edge stats and bounded initial graph;
- search/focus/entity inspector;
- connect realtime updates and revision refetch;
- respect viewer permissions.

**Status:** partial — Explorer `GraphWorkspace` embedded when `explorer_runtime`; timeline + search/focus; `projection_updated` WS triggers full graph reload + dock notice; KB switch remounts workspace (`key={kbId}`); inspector evidence links resolve ledger `chunk_id` / document neighbors; merge/import gated via review with property diff in resolve + review queue; `/kbs/:id/lineage` PROV viewer + graph overview in KB settings; backend WS/viewer tests; graph read-only UX; unit tests for projection refresh. Manual gate: `docs/ops/smoke-test.md`. Playwright: `e2e/shell.spec.ts`, `e2e/onboarding.spec.ts`, `e2e/lineage.spec.ts`, `e2e/governance.spec.ts` (provenance API + lineage shell after ingest; governance/search deep links).

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

**Status:** partial — coded API errors on KB + Explorer routes; `explorerFetch` / `explorerFetchJson` (auth, `X-Request-ID`, KB path rewrite) used across Basis KB workspaces; legacy `/api/graph` strings rewrite only under `ExplorerHostProvider` (no standalone `/api/...` fallback). Ingest limit codes localized.

### X-02 — Request IDs and structured logging

- request/job/projection IDs in logs and audit;
- redact authorization, API keys, document content, and model secrets.

**Status:** done (baseline) — `X-Request-ID` middleware; `detail.request_id` on API errors; Web correlation headers + user-facing reference IDs; `record_audit` + ingest logs use `correlation_log_extra`; async ingest threads bind `trigger_request_id`; processing jobs store `options.request_id`; `BASIS_LOG_JSON=1` enables JSON on `basis.*` and uvicorn access/error (`UvicornAccessJsonFormatter`); `redact_for_log` / `redact_string` for secrets and bulky text. Follow-up: cancel in-flight LLM work on extract timeout.

### X-03 — Backup/recovery baseline

- consistent SQLite + blob + projection backup procedure;
- restore test;
- projections may rebuild, canonical DB/blobs may not.

**Status:** done — SQLite: `scripts/backup_basis_data.sh`, `test_backup_tar_roundtrip_preserves_ledger`. PostgreSQL: `backup_basis_postgres.sh` / `restore_basis_postgres.sh`, `tests/test_postgres_backup_restore.py` (CI job `postgres` with `BASIS_TEST_POSTGRES_URL`).

### X-04 — Limits

- configure upload bytes, extracted characters, chunk count, graph page size, worker concurrency,
  parse/LLM timeout;
- reject before allocating unbounded memory where possible.

**Status:** done (baseline) — `RuntimeLimits` + `BASIS_*` for graph/search/import/upload/ingest; ingest thread pool + `BASIS_INGEST_MAX_PENDING` backpressure (`ingest_overloaded`); job wait timeout; ingest size/chunk caps; extract wall-clock timeout (`run_sync_with_timeout` releases the pool without waiting on timeout). Ops: `docs/ops/runtime-limits.md`. Follow-up: cooperative LLM abort inside semantica, per-model timeouts.

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
6. the Basis graph page uses the injected Explorer client;
7. migration of existing JSON graphs is dry-runnable and non-destructive;
8. backup and restore reproduce the canonical ledger, after which projections rebuild.

Review, mappings, SPARQL, Decision, chat, and ontology editing follow this foundation and must not
introduce a second source of truth.

**Automated coverage (partial):** `tests/test_release_gate.py`, `tests/test_m6_smoke.py`,
`tests/test_kb_alerts.py`, `tests/test_kb_sources.py`, `tests/test_kb_reasoning_rules.py`,
`tests/test_graph_page_limits.py`, `tests/test_runtime_limits.py`, `tests/test_observability.py`,
`tests/test_request_id.py`, `tests/test_legacy_graph_migration.py`, `tests/test_entity_merges.py`,
`tests/test_explorer_registry.py`, `tests/test_ws_hub.py`, `tests/test_realtime_ws.py`,
`web/src/lib/kb-alert-actions.test.ts`, `web/src/lib/reviewUrlState.test.ts`,
`web/src/explorer/host/explorerHttp.test.ts`, and `web/e2e` (`onboarding`, `lineage`, `governance`, `graph-diff`, `graph-at`, `search-graph-at`, `processing-job`, `reasoning-derived`, `shell`; CI `e2e`).
Manual M6: [smoke-test.md](../ops/smoke-test.md) § M6 deepening.

## 10. Milestone M6 — post–Explorer migration deepening

Tracks [capability-gap-checklist.md](capability-gap-checklist.md) **P0/P1** after M5 graph closure. Each item should become a GitHub issue with tests and `F-*` status updates.

### M6-01 — Ingest connectors (F-SRC-06/07)

**Status:** **GA slice met** for three kinds (`webhook`, `http_poll`, GitHub raw `git`) — scheduler tick, dialog, sync-history, alert deep links, audit tests. **No new connector kinds** until product reopens (S3 / private git / SaaS OAuth explicitly out of scope for now).

Work:

- document connector limits (no full `git clone` yet) — **met** in `docs/ops/ingest-connectors*.md`;
- optional: sync run history API + UI beyond `config.sync_events` tail — **deferred**;
- Sources `?job=` processing history deep link + `ingest.listJobs` client (**done**);
- second connector kind — **deferred** (product decision).

Acceptance:

- editor can create/disable/sync without leaking secrets in audit logs — **met** (`test_ingest_source_audit_never_contains_token`);
- two-KB isolation on sources and webhook paths — **met** (`test_sources_kb_isolation`).

### M6-02 — Chat + MCP hardening (F-CHAT-01/05/06)

**Status:** partial — playground + SSE stream; client `AbortController`; async stream checks `is_disconnected` + closes OpenAI stream; `chat_in_flight` 409; server message trim with SSE `context_trimmed` + non-stream `context_trim`; MCP filters on `search_chunks`; tests for `mcp_busy` / `mcp_timeout`; `POST .../chat/remember` → `statement_remember` queue covered by `tests/test_remember.py` + `test_m6_smoke.py` and Playwright `reviewItem` deep link.

Work (playground **not** a focus — current char/msg trim + `context_trimmed` is enough for KB GA):

- **Deferred:** token-accurate context budget; cooperative OpenAI HTTP cancel (today: client abort + stop yielding + close stream handle).
- Only revisit if operators hit context-window errors or runaway tool payloads in production.

Acceptance:

- Cursor example from `GET .../mcp` works against local stack with API token;
- no unauthenticated KB leakage on MCP errors.

### M6-03 — Ontology proposal workflow UI (F-ONT-05)

**Status:** partial — `VersionsTab` list + review modal (impact/SHACL summary, in-modal approve/reject/publish).

Work:

- deep link `kbOntologyProposalPath` + audit/review links (**done**); modal SHACL gate banner + copyable `proposal_id` (**done**);
- dedicated ontology-only **review queue row** — **won't do** (proposals stay in Versions tab);
- larger ProposalReview layout restore — **deferred** (inline modal summaries sufficient for GA).

Acceptance:

- editor proposes, admin publishes; audit records ontology mutations.

### M6-04 — KB rules library (F-RUL-01–03)

**Status:** partial — rules CRUD API + Reasoning WS; `proof_chains` + persist to `derived_facts`/`fact_derivations` on `apply_to_graph`; `GET .../ledger/derived-facts` (+ optional `entity_id`); Entities summary panel + per-entity Facts; Playwright `reasoning-derived.spec.ts`.

Work:

- `kb_reasoning_rules` persistence + `GET/POST/PATCH/DELETE .../rules` (**done**);
- Reasoning workspace rule library UX (**done** baseline);
- proof chain UI + API field `proof_chains` (**done** for fallback IF/THEN rules); persist to `derived_facts` (**done** on `apply_to_graph` + mutated).

Acceptance:

- rules isolated per KB; viewer cannot mutate rules.

### M6-04b — Statement conflicts (F-RUL-04)

**Status:** partial — `conflict_review.scan_statement_conflicts`; review kind `statement_conflict`; scan after remember/mapping approve; queue UI acknowledge/dismiss; `governance.statement_conflict` KB alert + bell → `reviewItem=` (**done**); Playwright `governance.spec.ts` via `POST .../_e2e/statement-conflict` (**done** on `data-e2e`).

Work:

- negation / SHACL-aware contradiction detection — **deferred**;
- ingest-time scan after `ledger_statements_written` — **done**;
- manual `POST .../review/scan-statement-conflicts` — **done**;
- Explorer `governance.tripped` on conflict — **deferred** (alerts use dedicated kind instead).

### M6-05 — Temporal + alerts product surfaces (F-TIM-*, F-ALT-*)

**Status:** partial — temporal diff + graph scrubber; chunk search `as_of` / `created_*` + search page copy; alerts + bell SSE/poll + deep links (**done** for MVP kinds); `governance.tripped` records Explorer `decision_id` when graph loaded (`governance_decision.py`); Playwright `governance.spec.ts` (review/ontology, connectors query, bell → Decisions, search graph hint).

Work:

- graph search tied to temporal snapshot (today: API `at` + search URL `?tab=graph&as_of=`; scrubber on graph);
- richer valid_from/to on ledger entities (beyond ingest-time chunk filters).

Doc: [search-storage-architecture.md](search-storage-architecture.md) § temporal filters (**done** for MVP clarity).

Acceptance:

- at least one alert type end-to-end in dev with automated test — **met** (`tests/test_kb_alerts.py`, `processing.failed` → `?job=` in `tests/test_processing_failed_alert.py` + `kb-alert-actions.test.ts`).

### M6-06 — Optional graph adapters (F-DIFF-01, distance-matrix)

**Status:** partial — `POST .../graph/distance-matrix` adapter; `GET .../graph/diff` + **Graph diff** page (shareable `from`/`to`, links → graph `focus`+`at`); graph `?at=` deep link sets scrubber; whole-graph canvas merge studio **not**.

Work:

- tune `GRAPH_STRUCTURAL_DISTANCE_LOCAL_MAX_NODES` / matrix batch cap if operators hit limits;
- whole-graph diff API + UI only if release engineering requests it.

Acceptance:

- documented in `explorer-integration.md`; capability-gated in web.

---

## 12. Milestone M7 — enterprise operational ontology (`F-LAKE` / `F-OPS`)

**Status:** not started — **Phase 5+**; does not block M6 KB GA or evidence-track closure.

Product design: [product-and-roadmap.md §5.16–5.18](product-and-roadmap.md). Sequencing matches
[capability-gap-checklist.md §4](capability-gap-checklist.md): **F-LAKE-01 → F-OPS-04/05 → F-OPS-01/02 →
F-OPS-03/06**; **F-OPS-07** only on demand.

**Principles (non-negotiable for M7)**

- Operational writes go through Basis API + audit; Semantica lakehouse SDK is invoked from Basis services, not a second public HTTP surface.
- Evidence KB ledger remains source of truth for document-derived knowledge; operational bindings/materializations are an **optional projection lane** (ADR 0001 dual-track), not a silent overwrite of reviewed statements.
- Every M7 route is KB-scoped, role-checked, and covered by two-KB isolation tests.

### M7-00 — Lakehouse capability gate

**Depends on:** M4-01 (Explorer optional extra pattern)  
**Maps to:** platform packaging for `F-LAKE-*`, `F-OPS-*`

Work:

- add Basis extra (e.g. `lakehouse`) pulling `semantica` db / parquet extras with version pin;
- expose `capabilities.lakehouse` (and per-KB `kb.capabilities.operational_ontology`) on settings/API;
- document env/install in README ops; startup probe fails soft when extra missing (workspaces hidden).

Acceptance:

- install without extra: no M7 routes registered (or `503` with stable `lakehouse_unavailable`);
- install with extra: probe passes; no import-time crash on default `uv sync`;
- KB A cannot enable mounts using KB B credentials.

### M7-01 — Dataset mounts (F-LAKE-01)

**Depends on:** M7-00, M1-03  
**Maps to:** F-LAKE-01

Work:

- persist mount definitions per KB (connection kind, URI/path, credentials ref, table/collection id, schema snapshot metadata);
- CRUD API `.../lake/mounts` (admin+); secrets via existing token/secret storage patterns, never in audit payload;
- read path: sample rows / schema introspection via Semantica ingest-parquet or `db-*` adapter;
- validate mount before save (timeout, auth, reachable).

Acceptance:

- create/list/disable mount; restart preserves mounts;
- unauthorized roles cannot read credentials or run introspection;
- introspection errors return stable codes, not driver tracebacks;
- forward migration + fresh DB tests.

### M7-02 — Semantic layer queries (F-LAKE-02)

**Depends on:** M7-01, F-ONT baseline (class/property IRIs)  
**Maps to:** F-LAKE-02

Work:

- store mapping from OWL class/property IRIs to mount columns (versioned, auditable);
- `POST .../lake/query` (or SPARQL extension) executing **declared** Ontology2SQL templates only — no arbitrary SQL from clients;
- enforce row/timeout/result-size limits (`RuntimeLimits` extension);
- viewer may run read-only queries; editor+ may propose mapping changes via review or ontology workflow (product choice documented in PR).

Acceptance:

- injection-style SQL from user input is impossible by construction;
- query audit record: mount id, template id, actor, row count, duration;
- mapping change does not break unrelated KB mounts.

### M7-03 — Object type ↔ dataset bindings (F-OPS-04)

**Depends on:** M7-01, M7-02 (or read-only mount without O2SQL if deferred)  
**Maps to:** F-OPS-04

Work:

- define **operational object types** (link to OWL class IRI + primary key column + property column map);
- API `.../ops/object-types` CRUD; binding references mount + mapping revision;
- document relationship to graph entities (optional link `entity_id`, no automatic merge without governance).

Acceptance:

- binding validates against live mount schema or stored schema revision;
- deleting mount blocks new executes until bindings updated;
- two object types on same mount remain isolated by KB.

### M7-04 — Materialization and sync jobs (F-OPS-05)

**Depends on:** M7-03, M2-03 (job pattern)  
**Maps to:** F-OPS-05, F-ALT-*

Work:

- job model analogous to processing jobs: `ops_sync_jobs` with stages, `result_json`, retry;
- `POST .../ops/sync-jobs` refresh operational projection/cache from binding (full or incremental TBD);
- emit `ops.sync_failed` / `ops.sync_succeeded` KB alerts with deep links (`?syncJob=`);
- schedule optional tick (reuse connector scheduler patterns) — **defer** cron until one manual path is solid.

Acceptance:

- failed sync leaves prior materialization readable and marks job failed with stable code;
- concurrent sync on same binding is single-flight or explicitly queued;
- alert + audit entries include job id; Playwright or API test for deep link optional.

### M7-05 — Declared actions (F-OPS-01, F-LAKE-03)

**Depends on:** M7-03, X-01  
**Maps to:** F-OPS-01, F-LAKE-03

Work:

- action type registry: JSON Schema (or Pydantic-exported schema) for parameters, target object type, side-effect kind (`ledger_patch`, `mount_write`, `webhook`);
- `POST .../ops/actions/{action_id}/execute` with validation, idempotency key, synchronous or async job;
- every execute writes audit + optional ledger row typed as **operational** (distinct from evidence statements);
- webhook actions: allowlist hosts, signed outbound, timeout.

Acceptance:

- invalid parameters → validation error without partial side effects;
- idempotent replay returns same outcome reference;
- execute denied for viewer; editor+ per **M7-06** when ACL lands (until then: admin-only documented);
- no action can bypass KB id in repository calls.

### M7-06 — Action and object-type ACL (F-OPS-02)

**Depends on:** M7-05, M1-02  
**Maps to:** F-OPS-02

Work:

- policy rows: `(action_id | object_type_id) × role/principal × allow/deny`;
- enforce in execute and in OSDK routes before runtime lookup;
- admin UI in KB settings (operational tab) or API-only first slice.

Acceptance:

- editor denied on restricted action while admin succeeds;
- policy change audited;
- default deny for new actions until policy grants.

### M7-07 — Ontology functions runtime (F-OPS-03)

**Depends on:** M7-03  
**Maps to:** F-OPS-03

Work:

- register functions (name, object type, input/output schema, implementation ref: embedded expression TBD vs external worker);
- **v1 scope:** read-only functions over materialized operational rows + graph read APIs; no arbitrary network;
- batch endpoint `POST .../ops/functions/{id}/evaluate` with timeout and row cap;
- document boundary vs **F-RUL** (`reasoning/run` stays logical inference on graph/ledger).

Acceptance:

- function timeout kills run without wedging worker pool;
- functions cannot read another KB's mounts;
- evaluation logged with correlation id.

### M7-08 — Integration surface (F-OPS-06)

**Depends on:** M7-05, M7-06  
**Maps to:** F-OPS-06

Work:

- generate OpenAPI fragment for KB operational surface (object types, actions, read queries) under `.../ops/openapi.json`;
- optional codegen script in `scripts/` for TypeScript/Python clients;
- API tokens scoped to `ops:execute` / `ops:read` (extend `api_tokens` scopes).

Acceptance:

- OpenAPI matches live routes; breaking change requires version bump field;
- token without scope cannot execute actions;
- documented example: curl execute with idempotency key.

### M7-09 — Workshop-lite UI (F-OPS-07)

**Depends on:** M7-05, M7-08  
**Maps to:** F-OPS-07  
**Status:** deferred — issue only when a customer needs configurable ops apps.

Work:

- KB route `/kbs/:id/ops` or embedded panels: object table, detail, action forms from schema;
- capability-gated; reuse Basis form components.

Acceptance:

- same auth as API; no direct mount credentials in browser.

### M7 dependency graph

```text
M7-00 ─ M7-01 ─ M7-02 ─ M7-03 ─ M7-04
                    └────────────┴─ M7-05 ─ M7-06 ─ M7-08 ─ M7-09 (optional)
                              └─ M7-07
```

Before cutting M7-01, extend [data-model.md](data-model.md) with mount/binding/job/action tables and ADR if operational ledger rows need a new fact kind.

---

## 11. Engineering debt (post graph-closure)

| Item | Notes |
| --- | --- |
| Web strict indexed access | `noUncheckedIndexedAccess` disabled in `web/tsconfig.json` for Explorer graph code; re-enable incrementally if desired. |
| `vitest` for `web` | Wired in CI (`npm run test` in `web/`). |
| Ingest slot tuning | `BASIS_INGEST_MAX_PENDING` semaphore; raise if operators see frequent `ingest_overloaded`. |
