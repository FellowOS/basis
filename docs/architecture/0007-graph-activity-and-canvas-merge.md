# ADR 0007: KB graph audit surfaces & canvas merge studio (F-GOV-06 / F-DIFF-01)

**Status:** accepted (2026-10) — Part A **shipped**（设置 Recent graph audit + Review，无侧栏活动流）；**Part B（画布合并）`deferred`** — 产品暂缓，无排期；现有 graph-diff + staging + Review 为闭环  
**Context:** [ADR 0001](0001-canonical-knowledge-model.md) requires graph writes to flow through the evidence ledger and Review where governance applies. [explorer.md](explorer.md) documents KB-scoped Explorer workspaces. Progress §1 marks standalone Explorer **Registry** as `replaced` and **full-page DiffMerge** as `not`, while **F-GOV-06** and **F-DIFF-01** are **`done`** via audit, Review, `graph/diff`, and `graph/staging`. Operators still ask for (a) “what changed on the graph?” and (b) spatial merge UI when diff is large. Vendored `registryStore` is **session-only** and must not become a second source of truth.

## Problem

| Ask | Risk if implemented naïvely |
| --- | --- |
| **Single-page graph operation stream** | Duplicates platform `/audit` and Review; diverges from `audit_kb_graph`; revives ephemeral `registryStore` as authority |
| **Canvas merge of two versions** | Bypasses Review; direct projection write; parallel merge state vs `kb_graph_staging_sessions` |

This ADR defines **read surfaces** and **proposal-only canvas writes** so new UI **extends** existing pipes, not replaces them.

## Decision (summary)

1. **Graph change visibility (F-GOV-06)** — **no** dedicated KB sidebar “activity” route. Operators use **Settings → Recent graph audit** (`GET .../audit/graph-mutations`) and **Review** (timeline + queue). Platform audit remains the cross-KB compliance view.
2. **Canvas Merge Studio (Part B)** — **deferred**; when resumed: optional **editor** UX on top of `GET graph/diff` + `graph/staging`; all commits remain **`staging` draft updates** and **Review items**. **No** direct canonical write without approve.

## Part A — Graph audit read surfaces (F-GOV-06)

### Rationale

| Source today | Role |
| --- | --- |
| `GET /api/v1/kbs/{kb_id}/audit/graph-mutations` | KB-scoped `kb.graph.*` audit rows (`list_audit_for_kb`) |
| Platform `GET /api/v1/audit` | Cross-resource audit; KB admins may use Links from settings |
| Review queue + timeline | Pending / resolved graph-related items |
| `GET .../decisions` | Post-approve narrative and chain |
| `registryStore` (browser) | Debug/session UX only; **not** persisted |

**Product (2026-10):** Do **not** add `/kbs/:id/graph-activity` or a Govern sidebar item. Avoid a second “timeline” that merges audit + review in one feed unless a future ADR reopens the question.

### API

| Deliverable | Status |
| --- | --- |
| `GET .../audit/graph-mutations` with stable fields, pagination, links to Review / decisions | **Shipped** |
| Dedicated `GET .../graph/activity` merge endpoint | **Rejected** — use audit list + Review APIs separately |

**Auth:** same as graph read — `get_kb_for_viewer` + KB token read scope.

### UI

- **Settings → Graph** tab: **Recent graph audit** widget (`kb-graph-audit-recent.tsx`) — last N `kb.graph.*` events, links to Review and platform audit.
- **Review** workspace: primary workflow for pending graph governance items and timeline.
- **Do not** show raw `registryStore` entries as product rows unless clearly labeled “this session only (not persisted)” in a dev collapsible — default off in production builds.

**Part B (canvas merge)** does **not** add a sidebar item; entry stays **Graph** / **Graph diff** only (see below).

### Non-goals (Part A)

- KB sidebar “graph activity” or unified audit+review feed page.
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
| Two truths for “what happened” | Product rows **must** be reconstructible from `audit_events` + `review_items` (+ decisions), not client-only logs |
| Two merge states | Canvas **must** read/write `session_key` draft on server; conflict → 409 with `current_revision` pattern if extended |
| Bypass Review | Any canvas “save” creates or updates **review queue** items; approve path unchanged |
| Duplicate nav | **No** second Govern feed; Settings recent audit + Review only |

## Relationship to Explorer / semantica

- **Registry workspace:** not revived; Basis-native visibility is **audit API + Review**.
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
| Settings audit strip | `kb-graph-audit-recent.tsx` · E2E `settings-graph-audit.spec.ts` |
| Ephemeral client log | `web/src/explorer/store/registryStore.ts` — do not promote to product API |

## Progress / features

- **F-GOV-06** `done`: Settings **Recent graph audit** + Review; no KB activity sidebar.
- **F-DIFF-01** `done` for diff + staging + list/form merge → Review; **Part B canvas studio deferred** (see [progress.md](../progress.md) §3.2).
- Progress §1 rows **Registry dedicated page** / **Full-page DiffMerge** stay `replaced` / `not`; this ADR is the **approved** way to address underlying user needs without reversing those rows.

## Open questions (defer to implementation PRs)

- Canvas B3 property/edge merge: new review kinds vs generalizing `entity_merge`.
