# 0001 — Evidence ledger is canonical; ContextGraph is a projection

- Status: accepted
- Date: 2026-10-13
- Deciders: Basis maintainers
- Affects: ingest, graph, search, review, mappings, ontology, reasoning, chat, SPARQL, export

## Context

Basis currently parses a document, runs semantica `GraphBuilder`, and merges the resulting entities
and relationships directly into a per-KB `ContextGraph` JSON file. This is sufficient for an early
graph demo, but it cannot reliably answer:

- which exact document passage supports a relationship;
- whether a relation label came from the document or an ontology;
- what was believed before a correction, merge, or review decision;
- how a typed triple was derived from a source statement;
- what SPARQL, chat citations, review, and Decision lineage should read.

Utopia solves this with an append-only evidence ledger and separates open statements from typed
facts. semantica provides the extraction, graph, ontology, reasoning, and Explorer primitives, but
does not prescribe Basis's multi-KB source-of-truth model.

The previous product design left three alternatives open: graph-only, a lightweight statements
table, or an Utopia-style open graph. That ambiguity blocks implementation of review, mappings,
`remember`, Decision, temporal queries, and RDF export.

## Decision

Basis adopts an **evidence-first, two-layer knowledge model**:

1. The **evidence ledger in SQLite is canonical**.
2. Extraction first writes **open statements in the document's own wording**.
3. Mapping/alignment produces **typed facts** in the ontology vocabulary.
4. `ContextGraph` is a **rebuildable materialized projection**, not the source of truth.
5. Vector indexes, Explorer search indexes, and RDF views are also rebuildable projections.
6. Mutations never silently overwrite knowledge. Corrections, invalidations, mappings, merges, and
   derivations produce explicit records and audit events.

This adopts the essential Utopia model without requiring Basis to copy every Utopia heuristic,
queue, or table on day one.

## Layer semantics

### Source layer

`DocumentVersion` and `Chunk` preserve what was ingested. A chunk stores text, source offsets,
heading, language, and origin. The original blob remains addressable by its version.

### Open layer

An open statement records what the source says:

```text
subject --[surface_phrase]--> object
```

- `surface_phrase` is verbatim or a faithful surface relation, not an ontology predicate.
- Evidence points to one chunk and a quote span.
- Qualifiers use the source's role words.
- Time mentions remain verbatim until interpreted.
- An open statement may be pending, confirmed, rejected, invalidated, or superseded.
- LLM extraction, pattern extraction, manual paste, connectors, and chat `remember` all enter
  through this layer. The extractor implementation may differ; the write contract does not.

### Typed layer

A typed fact uses an ontology class/property and records `from_statement_id` or an explicit trusted
import source. A mapping specifies:

- source phrase or signature;
- target class/property;
- direction;
- optional datatype/unit conversion;
- status and human/agent provenance.

Typed facts are recomputed when a mapping, statement, entity merge, or ontology version changes.
They are never accepted merely because the extractor emitted a predicate-like string.

### Derived layer

Reasoner output is stored separately from asserted typed facts and carries a proof/derivation.
Derived facts can be rebuilt and must not overwrite asserted facts.

### Projection layer

The active graph shown by Basis and Explorer contains:

- entities and document/chunk nodes needed for navigation;
- open edges when no active typed projection exists;
- typed edges when alignment exists;
- derived edges marked as derived;
- evidence/provenance identifiers needed to open the source.

For one source assertion, the canvas shows one effective edge per selected view/layer; it does not
show duplicate open and typed edges by default.

## Minimum persistent schema

Names are conceptual; migrations may use equivalent names. All KB-owned rows include `kb_id`.

### Documents and chunks

| Object | Required fields |
| --- | --- |
| `documents` | `id`, `kb_id`, `external_key`, `title`, `mime_type`, `current_version_id`, `created_at`, `deleted_at` |
| `document_versions` | `id`, `document_id`, `sha256`, `blob_path`, `source_time`, `source_time_kind`, `created_at`, `status`, `error_code` |
| `chunks` | `id`, `version_id`, `ordinal`, `text`, `heading`, `char_start`, `char_end`, `origin`, `language` |
| `extraction_drops` | `id`, `chunk_id`, `code`, `detail_json`, `created_at` |

`external_key` is unique within `(kb_id, source_id)` when a connector supplies one. Content hash
deduplication does not erase version history.

### Entities and names

| Object | Required fields |
| --- | --- |
| `entities` | `id`, `kb_id`, `canonical_label`, `description`, `created_at`, `invalidated_at` |
| `entity_names` | `id`, `entity_id`, `value`, `language`, `evidence_id`, `recorded_at`, `invalidated_at` |
| `entity_merges` | `id`, `kb_id`, `source_entity_id`, `target_entity_id`, `actor_id`, `created_at`, `reverted_at`, `why` |

Names are values, not graph nodes. Same-name entities are permitted. A merge is reversible and does
not delete the source entity's history.

### Statements and evidence

| Object | Required fields |
| --- | --- |
| `statements` | `id`, `kb_id`, `subject_id`, `surface_phrase`, `object_entity_id` or `object_value`, `confidence`, `status`, `recorded_at`, `invalidated_at`, `supersedes_id`, `proposed_by` |
| `statement_evidence` | `id`, `statement_id`, `chunk_id`, `quote`, `quote_start`, `quote_end`, `origin` |
| `statement_qualifiers` | `id`, `statement_id`, `role`, `value` or `entity_id` |
| `time_mentions` | `id`, `statement_id`, `chunk_id`, `text`, `char_start`, `char_end` |

Invariant: exactly one of `object_entity_id` and `object_value` is set. Quote offsets are computed
by the server. Failed or dropped extraction items are rows, not silent omissions.

### Mapping, typed, and derived facts

| Object | Required fields |
| --- | --- |
| `mappings` | `id`, `kb_id`, `signature`, `target_uri`, `target_kind`, `direction`, `status`, `actor_id`, `created_at`, `supersedes_id` |
| `typed_facts` | `id`, `kb_id`, `subject_id`, `predicate_uri`, `object_entity_id` or `object_value`, `from_statement_id`, `mapping_id`, `recorded_at`, `invalidated_at` |
| `derived_facts` | `id`, `kb_id`, fact shape, `rule_id`, `recorded_at`, `invalidated_at` |
| `fact_derivations` | `derived_fact_id`, `premise_kind`, `premise_id`, `ordinal` |

An explicit RDF import may create typed facts without `from_statement_id`, but must carry import
provenance. Mappings and facts are append/supersede records rather than in-place semantic rewrites.

## State machines

### Document version

```text
queued → parsing → chunking → embedding → extracting → ready
   └──────────────────────────────→ failed
ready → stale (a newer version becomes current)
```

Every transition writes an audit event. Retrying a failed version creates a new job attempt; it does
not erase the failure.

### Open statement

```text
pending → confirmed → invalidated
   └────→ rejected
confirmed → superseded
```

- Normal document ingestion may create `confirmed` statements after deterministic validation.
- Chat `remember` and policy-gated sources create `pending` statements.
- Review is the only path from `pending` to `confirmed` or `rejected`.

### Mapping

```text
proposed → confirmed → superseded
        └→ rejected
```

Only confirmed mappings produce typed facts. Recomputing a signature invalidates the prior
projection and writes new typed rows.

### Entity merge

```text
proposed → applied → reverted
        └→ rejected/kept-apart
```

Graph nodes are projected from the effective merge state at the selected record time.

## Read contracts

| Consumer | Canonical read |
| --- | --- |
| Library | documents, versions, chunks, extraction drops |
| Search | chunks + embeddings; results carry document/version/chunk IDs |
| Review | statements, entity pairs, conflicts, mappings, decisions |
| Chat | search results and ledger reads; citations resolve to evidence |
| Graph | materialized projection with ledger IDs on nodes/edges |
| Decision/Lineage | audit/decision records + evidence/derivation links |
| SPARQL | RDF projection of active open/typed/derived view selected by request |
| Export | canonical ledger serialized with provenance; never graph JSON alone |

## API consequences

- Ingest endpoints become job-producing writes for non-trivial files. A successful upload means
  accepted, not necessarily fully indexed.
- Graph mutation endpoints call ledger/domain services; they do not mutate `ContextGraph` directly.
- Review decisions require optimistic concurrency (`version` or `If-Match`) and an idempotency key.
- Search and chat citations use stable `chunk_id`/`evidence_id`, never graph array positions.
- SPARQL defaults to active typed facts; callers may request open or derived layers explicitly.
- Deleting a document invalidates statements for which it is the last live evidence and rebuilds
  affected projections. It does not erase history.

## Migration from the current implementation

1. Keep existing ContextGraph JSON readable during migration.
2. Introduce ledger tables and write new ingests to both ledger and graph projection.
3. Record the current GraphBuilder relationship label as `surface_phrase`; do not claim it is an
   ontology predicate unless a confirmed mapping exists.
4. Backfill existing graph nodes/edges as `legacy_import` provenance with no fabricated quote.
5. Build and verify graph projection from the ledger.
6. Stop treating graph JSON as canonical; retain it as a cache/snapshot.
7. Remove dual-write after projection rebuild and export tests pass.

No evidence may be invented during backfill. Legacy edges without source offsets remain explicitly
marked `legacy_import`.

## Consequences

### Benefits

- Review, chat citations, mappings, Decision, temporal history, and RDF export share one source of
  truth.
- Explorer remains a projection/workbench rather than becoming Basis's database.
- Graph and vector indexes can be rebuilt after corruption or SDK upgrades.
- Automated decisions are explainable and reversible.

### Costs

- More schema and pipeline work than graph-only storage.
- Projection invalidation and rebuild logic is required.
- Some semantica Explorer mutation endpoints cannot be exposed directly; they need Basis domain
  adapters.

## Rejected alternatives

### ContextGraph JSON as the only source of truth

Rejected because it cannot provide append-only history, stable evidence citations, reversible
review, or reliable Decision lineage.

### Add only a generic `statements` table while typed graph remains canonical

Rejected because mappings and corrections could diverge from the graph and two sources of truth
would exist.

### Copy the entire Utopia schema and behavior

Rejected because Basis uses semantica primitives and can adopt the semantic invariants without
copying Utopia's implementation, thresholds, or every connector.

## Follow-up documents

- [explorer.md](explorer-integration.md)
- [data-model.md](data-model.md) (SQLite migrations)
- [0003-lakehouse-datasets.md](0003-lakehouse-datasets.md) (structured sources & bidirectional entity sync on the unified ledger)
- Future: dedicated state-machines doc (review/governance transitions); not yet written
