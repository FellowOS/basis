# ADR 0003: Unified ledger for structured sources and bidirectional entity sync

**Status:** accepted (design contract for `F-LAKE` / `F-OPS`; physical DDL ships when implementation starts)  
**Date:** 2026-10-18  
**Deciders:** Basis maintainers  
**Affects:** `F-SRC`, `F-LAKE`, `F-OPS`, ingest sources, ledger (`entities` / `statements`), review, jobs, OpenAPI KB slice, MCP, [data-model.md](data-model.md) §18  
**Related:** [ADR 0001 — Evidence ledger](0001-canonical-knowledge-model.md) · [connectors/product.md](connectors/product.md)

## Context

Basis’s core value is **one semantic layer** backed by an auditable evidence ledger ([ADR 0001](0001-canonical-knowledge-model.md)).
When extending Basis to structured business systems (databases, CSV/Parquet uploads, SaaS APIs — [features.md §5.16–5.18](../features.md)),
an earlier draft considered a parallel “track B” with separate Parquet dataset tables, an isolated DuckDB SQL engine, and
a second set of navigation/MCP tools.

Reviewing product and architecture showed that a parallel warehouse track splits user mental models, bloats the sidebar
and MCP surface, and creates two competing sources of truth for the same business entity.

In reality, **documents and structured databases only differ at the two edges**:

1. **Inbound (Data Sources):** how raw inputs turn into ledger entities and statements (chunking + NER/LLM extraction for
   documents vs. primary-key + column mapping for database tables).
2. **Outbound (Bidirectional Sync / Write-back):** whether an approved entity mutation or Action in Basis is written back
   to an external business database or webhook.

Everything in the middle—**navigation menu, ontology, mappings, entities, statements/facts, graph projection, search,
review queue, and MCP tools**—can and should be **100% unified**.

## Decision

### 1. One menu, one canonical ledger, one graph

Basis does **not** introduce a parallel Parquet warehouse or a second KB mode:

- **Console UI:** adds a dedicated **Connectors (`/kbs/:kbId/connectors`)** item under the existing `Data & Extraction`
  (`KB_NAV_BY_ZONE.knowledge`) sidebar group—separate from document `Sources` (`/kbs/:kbId/sources`)—housing the
  declarative provider catalog, OAuth/API-key/basic/DSN connections, stream-to-ontology mappings, mutation/tool policies,
  and run logs in one place, while sharing the existing `Ontology`, `Graph / Entities`, `Review`, and `Integration`
  workspaces. No separate “Datasets” or “SQL Analyst” product shell is added.
- **Canonical store:** structured records ingested from databases or SaaS streams are normalized directly into the
  existing **`entities`** and **`statements` / `facts`** ledger (`proposed_by = 'connector'`).
- **Entity convergence:** a single entity (e.g. a `:Supplier`) can hold attributes synced from a PostgreSQL table
  alongside risk relationships extracted from a PDF contract on the exact same graph node.

### 2. Inbound & Outbound: Basis Open Connector Protocol (BOCP — Pure Python Declarative Engine)

Instead of maintaining 1,390 imperative TypeScript provider executors across a second Node.js runtime or limiting
connectors to flat stateless RPC calls, Basis adopts the **Basis Open Connector Protocol (BOCP)**—a **100% pure Python
declarative runtime** (`basis/core/connectors/`) that synthesizes the best primitives of **Nango** (declarative
17-mode auth templates + stateful sync checkpoints & delete tracking), **Airbyte** (`DeclarativeSource` YAML streams,
`DISCOVER` dynamic schema introspection, `DefaultPaginator`, `SubstreamPartitionRouter`), and **AnyConnect** (OAuth
dialect envelopes & MCP tool annotations):

- **Four orthogonal declarative primitives per connector (`manifests/<service>.yaml`):**
  1. **`auth` & `requester`:** declarative authentication covering `OAUTH2` (with PKCE & custom token envelopes),
     `OAUTH2_CC`, `BASIC` (username/password), `TWO_STEP` (login-for-session-token), `API_KEY`, `DATABASE_DSN`, and
     `CUSTOM` (`connection_config` + encrypted `credentials`), plus `check` verification endpoints and adaptive rate-limit quotas.
  2. **`streams` & `discovery` (`DISCOVER`):** business entity streams with either static JSON Schema or dynamic runtime
     schema discovery (`sqlalchemy.inspect(engine)` for `postgres`/`mysql`, or `DynamicSchemaLoader` metadata endpoints
     for custom-field SaaS like Airtable, Notion, Feishu Bitable, HubSpot).
  3. **`retriever` & `sync` (`READ`):** zero-code record extraction (`DpathExtractor`), automatic pagination (`cursor`,
     `offset`, `page`, `link`), parent-child stream routing (`SubstreamPartitionRouter`), incremental watermarks
     (`checkpoint_json`), and soft-delete tracking (`track_deletes`).
  4. **`mutations` & `tools` (`WRITE` / `RPC`):** stream-bound write-back templates (`create`, `update`, `upsert`,
     `delete` via parameterized SQLAlchemy `update()` or Jinja2 REST templates) plus standalone agent tools annotated
     with MCP `ToolAnnotations` (`readOnlyHint`, `destructiveHint`, `idempotentHint`).

### 3. Outbound: governed bidirectional sync (Basis ↔ external DB & SaaS)

When an entity or attribute bound to an external business table or SaaS stream is modified in Basis (by a user in the
graph/console or by an agent via MCP):

- **Inbound conflict detection (External → Basis):** on scheduled or webhook-triggered pull of a mapped `stream`, if an
  external field changed and the corresponding Basis statement was not locally overridden, Basis supersedes the old
  statement. If both changed, Basis creates a **`statement_conflict` review item** in the existing `Review` queue.
- **Outbound write-back (Basis → External via Stream Mutation):** mutations or **Declared Actions (`F-OPS-01`)** on
  bound attributes create a write-back record (`entity_sync_outbox`):
  - **Governed mode (default):** enters the `Review` queue; once approved (`agent_decisions` row recorded), a job invokes
    the stream's declarative `mutation` in pure Python (`sql_adapter` for `postgres`/`mysql`, `rest_declarative_adapter`
    for SaaS providers), marks the outbox row `synced`, and recalculates `row_hash` to prevent pull-loop false conflicts.
  - **Direct mode (trusted action):** validates schema and object-level ACL (`F-OPS-02`), writes to the ledger and
    executes the stream mutation, and emits an `AuditEvent` (or `F-ALT` alert on failure).

### 4. Scope limits (entity tables, not raw event firehoses)

Because structured rows become first-class ledger entities and statements, connectors target **business entity and state
tables** (customers, vendors, orders, subscriptions, tickets) with enforced row caps—not multi-million-row telemetry logs.

## Consequences

**Positive**

- **True unified semantic layer:** zero UI split, zero duplicate MCP query tools, and seamless fusion of document
  evidence with live business records.
- **Dramatically simpler stack:** no standalone DuckDB executor container, no HelixDB, and no parallel dataset catalog.
- **Reuses existing governance:** conflicts, approvals, and audit trails work identically across PDFs and database rows.

**Negative / cost**

- High-volume analytical tables (e.g. raw clickstreams) must be aggregated upstream before syncing into Basis entities.
- Requires careful loop prevention (`row_hash` / last-writer tracking) so an outbound write-back does not trigger a
  redundant inbound conflict on the next poll.
