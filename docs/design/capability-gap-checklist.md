# Capability gap checklist

Post–Explorer-shell migration inventory: what is **done**, **replaced**, **excluded by design**, or **still open** on the Basis product roadmap.

References: [Product and roadmap](product-and-roadmap.md), [Explorer integration](explorer-integration.md), [Implementation backlog](implementation-backlog.md).

**Legend**

| Column | Meaning |
| --- | --- |
| **F-*** | Roadmap feature ID in `product-and-roadmap.md` |
| **Status** | `done` · `partial` · `not` · `excluded` (intentional) · `replaced` (different Basis surface) |
| **Priority** | `P0` must for KB GA slice · `P1` high value for enterprise/multi-user · `P2` optional / niche · `—` not applicable |
| **Migrate?** | Whether this was an Explorer→Basis **shell** migration item |

---

## 1. Explorer shell migration (historical)

| Item | Status | Migrate? | Basis today |
| --- | --- | --- | --- |
| Standalone Explorer `App.tsx` / global `/api/graph` | `excluded` | N/A | Removed; only `/api/kbs/{id}/...` |
| Graph / Ontology / Vocabulary / SPARQL / Reasoning workspaces | `done` | Yes | Vendored `web/src/explorer/*` via `kb-*-workspace` + `explorerHttp` |
| Pure KB ontology & vocabulary paths | `done` | Yes | `ontologyKb` / `vocabularyKb` |
| Lineage (`F-LIN-01`) | `done` | Yes | `GET .../provenance` + `/kbs/:id/lineage` |
| KG overview (Manage tab) | `replaced` | Partial | KB settings → Graph tab stats |
| Entity merge property diff | `done` | Partial | Review + entity resolution UI |
| Memory Workspace | `excluded` | Was in shell | No UI/API; `agent_memory: false` |
| Registry **dedicated page** | `replaced` | Was in shell | Audit/ledger + review timeline; `registryStore` = session-only |
| Full-screen `ProposalReview` | `replaced` | Was in shell | `VersionsTab` inline approve/reject/publish only |
| Full-page **DiffMerge** studio | `not` | Was in shell | No whole-graph diff UI |
| X-API-Key / anonymous Explorer auth | `excluded` | N/A | JWT + KB roles |

---

## 2. Excluded or optional by product strategy

| F-* | Capability | Status | Priority | Value (when it matters) |
| --- | --- | --- | --- | --- |
| F-LAKE-01–03 | Lakehouse: mount tables/Parquet, Ontology2SQL, declared actions | `not` | P2 | Unified semantic layer over warehouse/lake; **not** required for document→graph KB loop |
| F-MEM-* | Agent Memory browser + `/api/memories` | `excluded` | P2 | Long-lived agent notes separate from canonical KB; enable with multi-agent / F-CHAT memory story |
| — | Direct graph merge/import (Explorer-style) | `excluded` | — | `409` → review queue by design |
| — | SPARQL UPDATE | `excluded` | — | Disabled by design |
| — | Global `/api/reason` | `excluded` | — | `410`; use `POST .../reasoning/run` |

---

## 3. Roadmap gaps (useful for Basis; not “failed migration”)

### 3.1 Governance & ontology

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-DIFF-01 | Whole-graph diff/merge (publish/staging) | `partial` | P1 | `GET .../graph/diff` + graph-diff UI (shareable `?from=&to=`, node/edge → graph `?focus=&at=to`); no canvas merge studio |
| F-ONT-05 | Full ontology proposal workflow (UI) | `partial` | P1 | `VersionsTab` + proposal deep links; review UI points to Versions (no duplicate queue row) |
| F-GOV-04 | Agent governor (batch clustering, gates) | `not` | P2 | Scale governance automation |
| F-GOV-05 | Impact gates + `governance.tripped` alerts | `partial` | P1 | Emit on review/ontology; records graph `decision_id` when Explorer loaded; bell → decisions / review item |
| F-GOV-06 | Durable registry read model | `partial` | P1 | Audit exists; no duplicate Explorer Registry page |
| F-GOV-07 | Decision / causal chain (full) | `partial` | P1 | `.../decisions/{id}/chain` + Review Decisions tab; `?decision=` deep link |

### 3.2 Rules, time, graph adapters

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-RUL-01 | KB ruleset CRUD (`.../rules`) | `partial` | P1 | API + Reasoning WS enable/delete; enabled rules merged on run |
| F-RUL-02 | Run inference on current graph | `partial` | — | `POST .../reasoning/run` |
| F-RUL-03 | Derived facts + proof chain in UI | `partial` | P1 | `proof_chains` + persist; ledger APIs; Entities UI; projector emits `projection_layer=derived` edges on rebuild |
| F-RUL-04 | Contradiction → governance queue | `partial` | P2 | `statement_conflict` queue; scan on ingest / remember / mapping / manual API; `governance.statement_conflict` alert → `reviewItem=` deep link |
| F-TIM-01–03 | valid_from/to, doc events, search/graph `as_of` | `partial` | P1 | Documented split: chunk ingest filters vs graph `temporal/snapshot`; graph search = current projection |
| F-TIM-04 | Timeline playback (product nav) | `partial` | P1 | Scrubber in `GraphWorkspace`; search/graph deep links `?at=` set scrubber + temporal panel |
| — | `POST .../graph/distance-matrix` | `partial` | P2 | KB adapter + graph UI server hop matrix when loaded graph &gt; 2500 nodes; local BFS below threshold |

### 3.3 Sources, search, chat, alerts

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-SRC-05 | Extract pattern / ml / llm per processing job | `partial` | P1 | `ner_method` + `ner_model` (spaCy); `llm` uses Models Chat; UI selectors + `extract_kwargs` → GraphBuilder |
| F-SRC-06–07 | Connectors CRUD + sync jobs | `partial` | P0 | **Frozen:** webhook / http_poll / GitHub raw only; no new kinds; git clone & SaaS OAuth deferred |
| F-SRC-08 | Large async ingest jobs | `partial` | P1 | `GET .../ingest/jobs` + client `ingest.listJobs`; Sources `?job=` opens job history; detail at `.../ingest/jobs/{id}` |
| F-SRCH-03 | Advanced time filters on search | `partial` | P1 | Chunk `as_of`; graph `at`; shareable `?tab=graph&q=&as_of=` deep links + graph-diff → search shortcut |
| F-CHAT-01–03 | KB chat + RAG + tool subset | `partial` | P0 | Playground + SSE; client abort + server disconnect stops stream frames |
| F-CHAT-04 | `remember` → pending review | `partial` | P1 | `POST .../chat/remember` + MCP `propose_remember`; review kind `statement_remember`; `reviewItem=` deep link + M6 smoke |
| F-CHAT-05 | MCP Streamable HTTP | `partial` | P0 | `GET/POST /api/kbs/{id}/mcp` + 7 read tools; no platform `/api/mcp` |
| F-CHAT-06 | Stop gen, 409 concurrency, context trim | `partial` | P1 | Sufficient for GA: abort, 409, char/msg trim + `context_trimmed`; token budget **deferred** |
| F-ALT-01–02 | Alert episodes + SSE refetch | `partial` | P1 | Bell SSE + 5m poll; deep links → connectors, `processing.failed` → Sources `?job=`, chat, review, ontology, conflicts |
| F-IF-03 | Page subtitles (interface copy) | `done` | P2 | `KbPageSubtitle` on KB explore/governance/sources/settings pages |

### 3.4 IO, resources, engineering

| F-* | Capability | Status | Priority | Notes |
| --- | --- | --- | --- | --- |
| F-IO-01 | Graph import/export | `partial` | — | Import via review |
| — | Markdown node resources persistence | `open` | P2 | Policy: per-KB persist vs disable |
| M5-02 | semantica package entry for Graph workspace | `not` | P2 | Still vendored `src/explorer` |
| M4-04 | Cross-instance WS (Redis pub/sub) | `deferred` | P1 | Single worker or sticky sessions today |

---

## 4. Suggested sequencing (KB-first product)

| Phase | Focus | Checklist rows |
| --- | --- | --- |
| **Now** | Operational KB loop | F-SRC-06/07 **baseline shipped** (no new connector kinds); F-CHAT MCP slice; governance/ontology/rules as needed |
| **Next** | Multi-editor governance | F-ONT-05 proposal UX, F-RUL-01–03, F-CHAT-04 |
| **Then** | Time + ops visibility | F-TIM-01–04 product surfaces, F-ALT-01–02, F-SRCH-03 |
| **On demand** | Release engineering | F-DIFF-01, distance-matrix adapter |
| **Enterprise option** | Data platform | F-LAKE-* |
| **If agents are first-class** | Memory separate from KB | F-MEM-* |

---

## 5. How to use this doc

- Tick **Status** in [product-and-roadmap.md §7](product-and-roadmap.md) when an `F-*` row ships.
- Split **P0/P1** rows into backlog tasks (§6–9 in `implementation-backlog.md`) with acceptance tests.
- Do **not** reopen Explorer shell items marked `excluded` or `replaced` unless product explicitly reverses ADR/design.

_Last updated: 2026-10-15 (entities derived-facts panel, governance alert `decision_id`, reasoning-derived e2e)._
