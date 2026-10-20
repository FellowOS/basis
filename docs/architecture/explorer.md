# semantica Explorer integration

This document defines how Basis reuses semantica Knowledge Explorer in a multi-KB, JWT-authenticated,
persisted product. It is an implementation contract, not a statement that Explorer is already
mounted.

Related decision: [0001 — Evidence ledger is canonical](0001-canonical-knowledge-model.md).

## 1. Decision summary

Basis reuses Explorer at two levels:

1. **Python (Basis-owned)**: `basis.core.explorer.*` and `BasisKbGraphSession` over
   `semantica.context.ContextGraph` (see [explorer-session-registry.md](explorer-session-registry.md)).
2. **React workspace components**: vendored `web/src/explorer/*` (Graph, Ontology, SPARQL, …) with
   injected KB API client and capabilities.

Basis does **not**:

- run `semantica-explorer` as a second product process;
- mount Explorer's `create_app()` unchanged;
- expose Explorer's `X-API-Key` authentication;
- let Explorer mutations bypass Basis's ledger, authorization, audit, or persistence;
- treat Explorer's frontend Registry store as an audit database.

## 2. Why unchanged mounting is not viable

Explorer is a single-graph application:

- `create_app()` stores one `GraphSession` in `app.state.session`;
- `get_session()` has no `kb_id`;
- routers already own prefixes such as `/api/graph` and `/api/ontology`;
- protected routes use `X-API-Key`;
- WebSocket is `/ws/graph-updates` and accepts an API key;
- the React app calls root-relative `/api/*` and `/ws/graph-updates`;
- graph mutation broadcasts do not persist Basis's graph snapshot;
- Registry is a browser-side store, not a durable mutation REST API.

Therefore `include_router(explorer_router, prefix="/api/kbs/{kb_id}")` is not the integration:
it would produce incorrect paths, keep a single session, and apply the wrong security model.

## 3. Target component architecture

```text
Basis endpoint
  → JWT/session authentication
  → KB role authorization
  → Basis domain service / ledger transaction
  → ExplorerSessionRegistry(kb_id)
      ├─ BasisKbGraphSession (read/search/temporal/ontology mutations)
      ├─ basis.core.projection.GraphSession / ContextGraph projection
      ├─ per-KB WebSocket hub
      └─ projection persistence/rebuild
```

### 3.1 Session ownership

Introduce a Basis-owned `ExplorerSessionRegistry`:

```python
class ExplorerSessionRegistry:
    def get(self, kb_id: str) -> KbExplorerRuntime: ...
    def invalidate(self, kb_id: str) -> None: ...
    def evict_idle(self) -> None: ...
```

`KbExplorerRuntime` contains:

- `basis` — canonical `basis.core.projection.GraphSession`;
- `explorer` — `BasisKbGraphSession` adapter (same `ContextGraph` as `basis`);
- the current projection revision;
- last-access time for cache eviction.

The registry loads the active graph projection via `graph_for` and builds the adapter with
`explorer_session_probe.build_kb_graph_adapter`. It must never return one KB's runtime for another KB.

### 3.2 Canonical writes

Per ADR 0001, a user action writes to the evidence ledger first. After commit, the affected graph
projection is updated or rebuilt. Explorer route logic may be reused for reads and calculations;
write handlers that directly mutate `ContextGraph` must be wrapped or replaced.

The mutation callback is useful for:

- rebuilding Explorer search indexes;
- broadcasting a KB-local event;
- marking a projection dirty.

It is **not** the transaction boundary and is **not** sufficient durability. Basis services save the
projection only after the canonical transaction succeeds.

Source storage and processing are separate operations:

1. `POST /api/kbs/{kb_id}/documents` or `/documents/upload` stores the original blob and creates an
   `uploaded` document version;
2. `POST /api/kbs/{kb_id}/processing/jobs` snapshots chunk/extraction options and starts processing;
3. successful processing writes the canonical ledger, rebuilds the projection, then broadcasts the
   new revision.

The Web IA keeps documents and their processing state together under **Sources**, followed by
**Knowledge → Explore → Governance → Settings**. The document table is the operational view for
starting/configuring processing and inspecting the latest job status. “Upload then process” is a
client-side convenience sequence, not an implicit server transaction.

### 3.3 Persistence

Initial projection persistence remains `data/graphs/{kb_id}.json`, with these changes:

- save atomically: write temporary file, `fsync`, rename;
- serialize concurrent writes per KB;
- include or store separately a projection revision;
- rebuild from the ledger when revision/schema is stale;
- cache eviction saves only a clean, committed projection;
- KB deletion removes graph snapshot, vector/search index, provenance data, uploads, review/chat
  rows, and WebSocket runtime after the ledger transaction commits.

Explorer-only state needs an explicit policy:

| State | Policy |
| --- | --- |
| Graph search index | rebuildable, not persisted |
| Embedding cache | rebuildable / vector store owns durable copy |
| Annotations | persist in Basis DB before exposing write UI |
| Markdown resources | persist per KB or keep disabled |
| Provenance | derive from ledger; optional per-KB cache |
| Agent Memory | disabled unless F-MEM is enabled |

## 4. Authentication and authorization

### 4.1 HTTP

All Explorer-backed HTTP endpoints use Basis's existing authentication:

1. `get_current_user`;
2. `store.get_kb_for(user, kb_id, minimum_role)`;
3. Basis error envelope `{detail: {code, message?}}`.

Explorer's `require_auth` dependency is not mounted. `semantica_ALLOW_ANONYMOUS` must not control
Basis routes.

### 4.2 Role policy

| Operation | Minimum role |
| --- | --- |
| stats, nodes, edges, search, path, analytics, temporal reads | viewer |
| SPARQL SELECT/ASK/CONSTRUCT/DESCRIBE | viewer |
| graph annotations/markdown edits | editor |
| import, entity merge, graph mutation | editor |
| ontology/mapping/rule mutation | editor by default; KB may require admin |
| member/governance policy changes | admin |
| KB deletion | owner |

SPARQL UPDATE is disabled. Arbitrary server-side file paths and network ontology imports are never
accepted from untrusted requests without allowlisting and SSRF/path validation.

### 4.3 WebSocket

Browser WebSocket clients cannot attach Basis's normal `Authorization` header portably. Use a
short-lived one-time ticket:

1. `POST /api/kbs/{kb_id}/realtime-ticket` with normal Bearer auth;
2. server authorizes viewer access and returns an opaque ticket expiring in at most 60 seconds;
3. client connects to
   `/api/kbs/{kb_id}/ws/graph-updates?ticket=...`;
4. ticket is consumed once; the accepted connection remains bound to user + KB;
5. role/KB deletion closes matching sockets.

After ingest or `POST .../graph/rebuild`, the hub broadcasts
`{"type":"projection_updated","kb_id":"...","projection_revision":N}`. The embedded
`GraphWorkspace` treats this as a full graph reload (same path as manual reload), with revision
dedup so duplicate events are ignored. Contract tests: `tests/test_realtime_ws.py` (server) and
`graphRealtimeMessages.test.ts` + `graphProjectionRefresh.test.ts` (web).

Do not put a reusable JWT or API token in a WebSocket query string.

## 5. Basis HTTP and WebSocket contract

Basis owns these public paths. Adapter handlers may call Explorer internals but preserve these paths
across semantica upgrades.

### 5.1 Graph

| Method | Basis path | Explorer source | Role |
| --- | --- | --- | --- |
| GET | `/api/kbs/{kb_id}/graph/stats` | graph stats | viewer |
| GET | `/api/kbs/{kb_id}/graph/projection` | ledger projection revision/status + live counts | viewer |
| POST | `/api/kbs/{kb_id}/graph/rebuild` | rebuild Explorer session from ledger (audited) | editor |
| GET | `/api/kbs/{kb_id}/audit/graph-mutations` | KB-scoped graph audit (`action_prefix`, default `kb.graph.`) | viewer |
| GET | `/api/kbs/{kb_id}/graph/nodes` | graph nodes | viewer |
| GET | `/api/kbs/{kb_id}/graph/edges` | graph edges | viewer |
| POST | `/api/kbs/{kb_id}/graph/search` | graph search | viewer |
| GET | `/api/kbs/{kb_id}/graph/nodes/{node_id}/neighbors` | neighbors | viewer |
| GET | `/api/kbs/{kb_id}/graph/path` | path | viewer |
| POST | `/api/kbs/{kb_id}/graph/distance-matrix` | hop/weighted/semantic matrix for `node_ids` (`DistanceMatrixRequest`) | viewer |

Graph workspace: when the loaded graph exceeds **2500** nodes, ego/heatmap/structural distance overlays fetch hop distances from this endpoint (capped batch of node ids) instead of client BFS; smaller graphs still use in-memory `buildStructuralDistanceSnapshot`.
| GET | `/api/kbs/{kb_id}/graph/analytics/*` | analytics | viewer |
| WS | `/api/kbs/{kb_id}/ws/graph-updates` | adapted WS hub | viewer |

Nodes/edges use cursor pagination and enforce server limits. IDs are opaque path/query values and
are never interpolated into a filesystem path.

### 5.2 Temporal and decisions

| Prefix | Purpose |
| --- | --- |
| `/api/kbs/{kb_id}/temporal/*` | temporal bounds, snapshot (`at`), diff (`from`/`to` query) |
| `/api/kbs/{kb_id}/graph/diff` | whole-graph diff at two instants (nodes/edges/properties; F-DIFF-01) |
| `/api/kbs/{kb_id}/graph/staging` | diff + staging manifest (`session_key`, governance relpaths, focus ids; F-DIFF-01) |
| `POST /api/kbs/{kb_id}/graph/staging/entity-merge` | Gate D entity-merge proposal from staging studio |

**Product mapping (F-TIM-03):**

- **Graph point-in-time:** Graph workspace scrubber calls `GET .../temporal/snapshot?at=<ISO>` (Basis prefers `session.graph.state_at` when it returns nodes, same engine as `GET .../graph/diff`) and overlays node/edge emphasis; bounds from `GET .../temporal/bounds` (ledger fallback for missing min/max).
- **Chunk search point-in-time:** `GET .../search` accepts `as_of` (alias for `created_before` when omitted) plus `created_after` / `created_before` on **document ingest** timestamps — not graph `valid_from` on entities.
- **Graph text search:** `POST .../graph/search` accepts optional `at` in the JSON body for client correlation; results still use the **current** projection (response may include `warnings: ["graph_search_uses_current_projection"]`).
- **Consistency contract (F-TIM-01–03, partial):** Graph instants use ledger `recorded_at` → projected `valid_from` on nodes/edges (`state_at` / `GET .../graph/diff`). Chunk search instants use **document version / ingest** timestamps. Clients must not assume a single `as_of` query parameter applies the same filter to both surfaces unless documented on the specific operation. `GET .../temporal/bounds` merges graph bounds with `get_ledger_temporal_bounds` for scrubber UI.
- **Document timeline (F-TIM-02):** `GET /api/v1/kbs/{kb_id}/documents/{document_id}/timeline` returns ledger events (`version_created`, `processing_job`, `statement_recorded`, `time_mention`) for one document; use with graph/temporal APIs, not as a substitute for chunk `as_of` search.
- **Graph diff preview (F-DIFF-01, partial):** `GET .../graph/diff` drives the console preview bar and Explorer node emphasis (added/modified vs dimmed) at the **end** instant (`?at=` + `diff_to`). Removed nodes are listed on `/graph-diff` but absent from the end-time canvas.
- **Ontology proposals (F-ONT-05):** Web deep link `/kbs/{kb_id}/ontology?ontologyTab=versions&ontologyProposal={id}` opens the Versions tab review modal; audit timeline links use the same query params.
| `/api/kbs/{kb_id}/decisions/*` | decision list/detail/causal chain |
| `/api/kbs/{kb_id}/provenance` | PROV-O lineage graph (`node_id` query) |
| `/api/kbs/{kb_id}/provenance/report` | downloadable provenance report |

Basis web: `/kbs/{kb_id}/lineage` (`KbLineageWorkspace`), linked from graph inspector, entity list,
and graph toolbar when `capabilities.provenance` is true.

Decision has no dedicated WebSocket. Changes arrive through the graph-update stream or client
refetch notification.

### 5.3 Ontology, vocabulary, and SPARQL

| Prefix | Purpose |
| --- | --- |
| `/api/kbs/{kb_id}/ontology/*` | ontology load/read/edit/validation |
| `/api/kbs/{kb_id}/vocabulary/*` | SKOS vocabulary |
| `/api/kbs/{kb_id}/sparql` | SPARQL query over selected projection |
| `/api/kbs/{kb_id}/reasoning/*` | KB-scoped reasoning |

Global `/api/reason` returns **410**; use `POST /api/kbs/{kb_id}/reasoning/run` only.
It is not aliased to Explorer's standalone `/api/reason`.

Explorer's current SPARQL implementation uses an RDFLib in-memory projection. Oxigraph is an
optional future backend, not a requirement for initial Explorer SPARQL reuse.

### 5.4 Review/enrichment and import/export

| Prefix | Purpose |
| --- | --- |
| `/api/kbs/{kb_id}/review/*` | Basis review state machine |
| `/api/kbs/{kb_id}/enrich/*` | candidate generation/calculations |
| `/api/kbs/{kb_id}/import` | controlled graph/ontology import |
| `/api/kbs/{kb_id}/export` | ledger-backed JSON/RDF export |

Explorer entity-resolution calculations may propose candidates. Applying a merge always uses
Basis's review/domain service so it remains reversible, audited, persisted, and reflected in the
ledger.

### 5.5 Ledger browse (Sources / Search)

| Route | Purpose |
| --- | --- |
| `GET /api/kbs/{kb_id}/ledger/entities` | Search by label/description, or list recent entities when `query` is omitted |
| `GET /api/kbs/{kb_id}/ledger/entities/{entity_id}/facts` | Open statements where the entity is subject |
| `GET /api/kbs/{kb_id}/ledger/documents/{doc_ref}` | Document title/status (`external_key` or ledger id) |
| `GET /api/kbs/{kb_id}/ledger/documents/{doc_ref}/chunks` | Chunks for a document (`external_key` or ledger id) |
| `GET /api/kbs/{kb_id}/ledger/chunks/{chunk_id}` | Chunk text plus statements linked via evidence |

Web: **Knowledge → Entities & statements** owns ledger entity/fact browse; **Search → Chunks** and
**Sources** (`?doc=` / `?chunk=`) open the evidence inspector; labels use
`POST /api/kbs/{kb_id}/graph/resolve-labels` where needed.

### 5.6 Registry

There is no public `/registry` claim based on Explorer. Basis provides durable mutation history via:

- platform/KB audit events;
- decision records;
- ledger history.

The UI Registry view reads an Basis endpoint such as
`GET /api/audit?kb_id=...&category=graph_mutation` or a later dedicated read model. Explorer's
`registryStore` may be used only as a transient live-event view.

## 6. Dependency injection strategy

Do not import Explorer routers unchanged. Their route prefixes and dependencies are single-app
assumptions.

Preferred implementation:

1. Build Basis routers with the stable paths in §5.
2. Inject `kb_id`, authorized user, and `KbExplorerRuntime`.
3. Reuse Explorer schemas and session methods.
4. Extract pure handler/service functions upstream in semantica where a route currently contains
   valuable logic that cannot be called cleanly.
5. Keep a compatibility test against the pinned semantica version.

Avoid monkey-patching `request.app.state.session`, request path rewriting, or temporarily swapping a
global session. Those approaches can leak data between concurrent KB requests.

## 7. Frontend integration

### 7.1 Chosen approach

The long-term integration is **workspace component reuse with dependency injection**, not iframe.

Add an upstream-compatible UI seam:

```ts
type ExplorerClient = {
  fetch(path: string, init?: RequestInit): Promise<Response>;
  websocket(path: string): Promise<WebSocket>;
  capabilities(): Promise<ExplorerCapabilities>;
};
```

Workspace components obtain this client through `ExplorerProvider`. The Basis implementation:

- prefixes requests with `/api/kbs/${kbId}`;
- uses Basis's authenticated API wrapper;
- obtains a realtime ticket before opening WS;
- maps Basis error codes to localized UI;
- reports only enabled capabilities.

All root-relative `fetch('/api/...')` and direct `new WebSocket('/ws/...')` calls in reused
workspaces must move behind this client before consumption.

### 7.2 Packaging (Basis)

**Basis 产品决策**：图/本体等工作区 UI 以 **semantica Explorer 源码为基础在仓库内演进**（`web/src/explorer`，见 `web/src/explorer/README.md`），**不**发布或依赖独立的 npm Explorer 包。与上游同步以 **选择性 cherry-pick / 按提交或按文件移植** 为主，保留 Basis 补丁（`host/explorerHttp`、KB API 前缀、主题/WS）；避免整树 `rsync --delete`。

仍须遵守：

- 不引入 standalone Explorer `App.tsx` 作为 Basis 入口；由 `kb-*-workspace` 懒加载工作区。
- HTTP/WS 经 `ExplorerHostProvider` / `ExplorerClient` 注入，不写死全局 `/api/graph`。
- 可选：semantica 上游仍可维护自己的 SPA 与包入口；Basis 不以此作为交付前提。

（历史草案：将 upstream 打成 npm 包再由 `web` 消费——**对 Basis 为非目标**，progress **M5-02 `excluded`**。）

### 7.3 Shell and visual ownership

- Basis owns routing, sidebar, account, theme, locale, loading, and error boundaries.
- Explorer owns canvas and workspace-specific interaction.
- Workspace CSS must use scoped classes/tokens; it must not reset Basis global styles.
- Data colors may follow the semantica/Utopia graph palette; chrome follows Basis tokens.

## 8. Realtime event contract

```json
{
  "event": "graph_mutation",
  "kb_id": "uuid",
  "revision": 42,
  "data": {
    "event_type": "edge_added",
    "entity_id": "opaque-id",
    "payload": {}
  },
  "timestamp": "RFC3339"
}
```

Required events:

- `connection_ack`;
- `graph_mutation`;
- `projection_rebuilt`;
- `refetch_required`;
- `job_progress` (optional for ingest/import).

Clients compare `revision`; a gap triggers refetch. Payloads must not include secrets or content the
connected viewer could not retrieve over HTTP.

## 9. Error, concurrency, and consistency contract

- Explorer exceptions are translated to Basis error codes; raw Python exception text is not exposed.
- Graph reads include `revision` where consistency matters.
- Writes use a per-KB lock plus ledger transaction; review/mapping writes use optimistic versioning.
- Duplicate retried writes require an idempotency key.
- A projection update failure after ledger commit marks the projection stale and enqueues rebuild;
  it does not roll back canonical knowledge.
- A stale projection response is either rebuilt before serving or includes a defined
  `projection_stale` error; it never silently serves cross-revision data for mutation decisions.

## 10. Cache and scale policy

- Runtime cache is bounded by configurable KB count and idle TTL.
- Loading the same KB is single-flight.
- Node/edge endpoints are paginated; the browser does not load an unbounded graph.
- Graph workspace starts with a bounded overview or neighborhood for large KBs.
- Analytics with material cost run as jobs and cache by projection revision.
- Multi-process deployment cannot rely on process-local locks or WebSocket managers; before that
  deployment mode is enabled, use a shared lock/event backend or constrain Basis API to one writer
  process.

## 11. Security requirements

- KB authorization occurs before runtime lookup to avoid side-channel existence leaks.
- Imported files and ontology URLs are size-limited and validated against path traversal/SSRF.
- SPARQL execution has timeout, result-row limit, and query-form allowlist.
- WebSocket Origin is checked against Basis's configured origins.
- Realtime tickets are hashed at rest, single-use, scoped to user + KB, and short-lived.
- Export is audited and streamed; temporary archives are deleted.

## 12. Capability rollout

Basis exposes a KB capability endpoint:

`GET /api/kbs/{kb_id}/capabilities`

Example:

```json
{
  "graph": true,
  "graph_write": false,
  "temporal": false,
  "decisions": false,
  "ontology": true,
  "sparql": true,
  "vocabulary": false,
  "agent_memory": false
}
```

The frontend renders a workspace only when the capability is true. A missing optional dependency
must disable a capability with a stable diagnostic; it must not fail application startup.

## 13. Implementation sequence and acceptance gates

### Gate A — runtime adapter

- one Explorer `GraphSession` per authorized KB;
- no cross-KB leakage under concurrent tests;
- search index rebuild after reload;
- atomic projection persistence.

### Gate B — read-only Graph workspace

- nodes/edges/stats/search work under Basis JWT;
- viewer allowed, unauthenticated denied;
- frontend uses injected client, no root-relative Explorer API calls in imported Graph workspace;
- restart yields the same graph.

### Gate C — realtime

- one-time ticket authentication;
- mutation only broadcasts to sockets for that KB;
- revision gap causes refetch.

### Gate D — controlled mutations

- merge/ontology/mapping writes go through ledger service;
- `reasoning/run` with `apply_to_graph` persists derived facts to the ledger and rebuilds the graph projection when new derived rows are created;
- audit and Decision records exist;
- projection rebuild reproduces the visible result.

### Gate E — additional workspaces

- Ontology, SPARQL, Decision, Timeline, Vocabulary, and Lineage each pass their role, persistence,
  capability, and cross-KB isolation tests before being enabled.

## 14. Required tests

- two users × two KBs concurrent HTTP and WS isolation;
- viewer/editor/admin route matrix;
- load/evict/reload projection equality;
- ledger commit followed by projection failure/rebuild;
- concurrent writes to one KB;
- semantica upgrade compatibility for reused schemas/session calls;
- SPARQL timeout/row limit and no UPDATE;
- import path traversal and ontology URL SSRF cases;
- WebSocket expired/reused/wrong-KB ticket rejection;
- frontend test proving API base includes the current `kbId`.

For a product-level checklist of what the Basis graph UI wires today, see
[graph-ui-closure.md](features.md).
