# ADR 0007: KB graph activity feed & canvas merge studio (F-GOV-06 / F-DIFF-01)

**Status:** accepted (2026-10) — **decision + phased delivery**; not all phases implemented yet  
**Context:** [ADR 0001](0001-canonical-knowledge-model.md) requires graph writes to flow through the evidence ledger and Review where governance applies. [explorer.md](explorer.md) documents KB-scoped Explorer workspaces. Progress §1 marks standalone Explorer **Registry** as `replaced` and **full-page DiffMerge** as `not`, while **F-GOV-06** and **F-DIFF-01** are **`done`** via audit, Review, `graph/diff`, and `graph/staging`. Operators still ask for (a) one KB screen for “what changed on the graph?” and (b) spatial merge UI when diff is large. Vendored `registryStore` is **session-only** and must not become a second source of truth.

## Problem

| Ask | Risk if implemented naïvely |
| --- | --- |
| **Single-page graph operation stream** | Duplicates platform `/audit` and Review; diverges from `audit_kb_graph`; revives ephemeral `registryStore` as authority |
| **Canvas merge of two versions** | Bypasses Review; direct projection write; parallel merge state vs `kb_graph_staging_sessions` |

This ADR defines **read aggregation** and **proposal-only canvas writes** so new UI **extends** existing pipes, not replaces them.

## Decision (summary)

1. **Graph Activity Feed** — one **read-only** KB console route backed by a **server-composed timeline** (audit + review/decision pointers). No new mutation log store in v1.
2. **Canvas Merge Studio** — optional **editor** UX on top of `GET graph/diff` + `graph/staging`; all commits are **`staging` draft updates** and **Review items** (same semantics as today). **No** API that writes canonical graph or ledger without approve.

## Part A — Graph Activity Feed (F-GOV-06+)

### Rationale

| Source today | Role |
| --- | --- |
| `GET /api/v1/kbs/{kb_id}/audit/graph-mutations` | KB-scoped `kb.graph.*` audit rows (`list_audit_for_kb`) |
| Platform `GET /api/v1/audit` | Cross-resource audit; KB admins may use Links from settings |
| Review queue + timeline | Pending / resolved graph-related items |
| `GET .../decisions` | Post-approve narrative and chain |
| `registryStore` (browser) | Debug/session UX only; **not** persisted |

The feed **normalizes** the first three (plus optional decision links on approve) into one sorted list for `/kbs/:id/graph/activity` (name TBD). Settings **Recent graph audit** should **reuse** the same component or API slice to avoid two “recent changes” UIs.

### API (phased)

| Phase | Deliverable |
| --- | --- |
| **A1** | Extend or alias existing `audit/graph-mutations`: stable `event_kind`, `occurred_at`, `actor`, `summary`, `review_item_id?`, `decision_id?`, deep-link targets. Cursor/`before` pagination. |
| **A2** | `GET /api/v1/kbs/{kb_id}/graph/activity` merges graph audit events with **recent** review items whose kinds are graph-related (`entity_merge`, import, mapping, `connector_writeback`, …) without duplicating rows (link audit row → review when `review_item_id` present). |
| **A3** | Optional SSE or poll hint `revision` / `projection_updated` **only as “refresh feed”**, not as authoritative events. |

**Auth:** same as graph read — `get_kb_for_viewer` + KB token read scope.

### UI

- Route: `/kbs/:id/graph/activity` (sidebar under Graph or Governance).
- Rows: icon by kind, time, actor, one-line summary, actions **Open in Review** / **Open in audit** / **Open decision**.
- **Do not** show raw `registryStore` entries as rows unless clearly labeled “this session only (not persisted)” in a dev collapsible — default off in production builds.

### Non-goals (Part A)

- Replacing platform audit for compliance export.
- Logging every Explorer canvas click or WS frame.
- Real-time OTEL-style tracing of graph layout edits that never hit the API.

## Part B — Canvas Merge Studio (F-DIFF-01+)

### Rationale

`GET graph/diff` + `/graph-diff` answer **what changed** between `from` and `to`. `graph/staging` + `PUT .../staging/{session_key}/draft` + `POST .../staging/entity-merge` answer **how to propose** merges under governance. The gap is **topology-scale** choice on the canvas, not missing backend merge logic.

### Decision

- **Read path:** Reuse `graph/diff` and temporal graph load (`build_temporal_graph_from_ledger`) for both endpoints of the compare. Canvas layers **added / removed / modified** nodes and edges from diff payload (same rules as graph-diff preview bar).
- **Write path:** User gestures on canvas **only** update:
  - `PUT .../graph/staging/{session_key}/draft` (merge pick slots, focus ids), and/or
  - `POST .../review/items/entity-merge` / `POST .../graph/staging/entity-merge` with the same bodies as today.
- **Session:** `manifest.session_key` from `GET graph/staging` is the **single** server draft key; browser `readGraphStagingDraft` remains a cache, not a second merge engine.
- **Publish:** There is **no** “Apply entire diff to production” button. Bulk proposals may enqueue **multiple** review items or one structured item only if Review schema is extended in a follow-up ADR.

### UI (phased)

| Phase | Deliverable |
| --- | --- |
| **B1** | `/kbs/:id/graph-diff` embeds or links **Open canvas merge** when `change_total` &gt; threshold; canvas is read-only diff overlay (parity with preview bar). |
| **B2** | Editor mode: pick primary/duplicate clusters on canvas → updates staging draft → existing **Propose merge** → Review. |
| **B3** | Optional edge/property merge kinds **only** after Review kinds and approve handlers exist (out of B1/B2). |

### Non-goals (Part B)

- Cloning semantica **full-page DiffMerge** SPA as a separate app entry.
- Direct `ContextGraph` mutation from the canvas.
- Merging without `from`/`to` instants (ad-hoc two JSON files) — use import/export + Review instead.

## Conflicts avoided

| Pitfall | Rule |
| --- | --- |
| Two truths for “what happened” | Feed rows **must** be reconstructible from `audit_events` + `review_items` (+ decisions), not client-only logs |
| Two merge states | Canvas **must** read/write `session_key` draft on server; conflict → 409 with `current_revision` pattern if extended |
| Bypass Review | Any canvas “save” creates or updates **review queue** items; approve path unchanged |
| Duplicate nav | Retire or fold **Recent graph audit** widget into Activity when Activity ships |

## Relationship to Explorer / semantica

- **Registry workspace:** not revived; Activity feed is the Basis-native equivalent **with persistence**.
- **DiffMerge workspace:** not ported 1:1; Canvas studio is a **view** on F-DIFF-01 staging.
- Upstream cherry-picks from semantica Explorer **must not** reintroduce standalone Registry routes or direct-merge handlers without this ADR.

## Implementation anchors (current codebase)

| Concern | Location |
| --- | --- |
| Graph audit write | `basis/domain/kb/graph_audit.py` · `audit_kb_graph` |
| Graph audit list | `GET .../audit/graph-mutations` · `kb_review.py` |
| Diff / staging | `kb_explorer.py` · `knowledge.graph_staging_at` · `kb_graph_staging_sessions` |
| Entity merge propose | `POST .../graph/staging/entity-merge` · `propose_entity_merge` |
| Web diff / staging | `kb-graph-diff-workspace.tsx` · `kb-graph-diff-preview-bar.tsx` · `graph-staging-draft.ts` |
| Settings audit strip | `settings-graph-audit` · E2E `settings-graph-audit.spec.ts` |
| Ephemeral client log | `web/src/explorer/store/registryStore.ts` — do not promote to product API |

## Progress / features

- **F-GOV-06** remains `done` for audit + Review surfaces; Activity is an **optional Phase A** productization layer (track in [progress.md](../progress.md) when A1 ships).
- **F-DIFF-01** remains `done` for diff + list staging; Canvas studio is **optional Phase B** (track when B1 ships).
- Progress §1 rows **Registry dedicated page** / **Full-page DiffMerge** stay `replaced` / `not`; this ADR is the **approved** way to address underlying user needs without reversing those rows.

## Open questions (defer to implementation PRs)

- Exact review kinds included in Activity feed pagination join.
- Whether Activity needs KB **editor** vs **viewer** row redaction (payload snippets).
- Canvas B3 property/edge merge: new review kinds vs generalizing `entity_merge`.
