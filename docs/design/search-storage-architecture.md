# Search and storage architecture

## Status

- Decision: accepted for SQLite and PostgreSQL implementations
- Scope: canonical chunks, embedding records, vector indexes, and retrieval policy

## Boundaries

Basis separates source-of-truth storage from rebuildable search projections:

1. **Canonical chunk store** — documents, versions, chunks, statements, and evidence live in one
   deployment-level ledger: SQLite (`data/basis.db`) or PostgreSQL. `kb_id` is the tenant boundary.
2. **Blob store** — original uploaded bytes live under the configured data directory and are
   addressed from document versions.
3. **Vector index** — embeddings are a rebuildable projection: sqlite-vec stores one database per
   KB; pgvector stores vectors in a shared table partitioned and indexed by embedding dimension.
4. **Embedding records** — `embedding_records` in the ledger records model, dimension, content
   hash, and vector key. It does not store vector bytes.

Deleting or rebuilding a vector index must not delete canonical chunks. A vector backend is never
the source of truth for document text.

## Per-KB retrieval policy

`kb_search_configs` stores a versioned policy:

- `chunk_backend`: `sqlite_ledger` or `postgres_ledger`, fixed by deployment;
- `vector_backend`: `sqlite_vec` or `pgvector`;
- `embedding_model_id`: optional reference to the platform model catalog;
- `keyword_enabled`, `semantic_enabled`;
- `default_mode`: `keyword`, `semantic`, or `hybrid`;
- `auto_index`: whether ingest embeds new chunks.

Every KB receives defaults matching its deployment on first access. Upload requires the canonical
store to be ready, but does not require a remote embedding service. Without one, the development
fallback embedder is used. Disabling semantic search still permits upload and keyword search.

## Backend contract

Retrieval orchestration depends on `VectorIndexBackend`, not sqlite-vec directly. A backend owns:

- manifest/model/dimension inspection;
- vector upsert;
- filtered nearest-neighbor search;
- complete reset for reindex.

`SQLiteVectorIndex` and `PgVectorIndex` implement the contract. The PostgreSQL implementation uses
dimension partitions and HNSW cosine indexes, so KBs may use embedding models with different
dimensions. Milvus or Qdrant can implement the same contract later without changing canonical
chunk storage or the public search API.

## Temporal filters (F-TIM-03)

Chunk search and graph exploration use **different clocks**. Do not assume one `as_of` applies to both.

`POST .../graph/search` accepts optional `at` (ISO): results are intersected with nodes active at that instant (`find_active_nodes`), aligned with `GET .../temporal/snapshot?at=`.

| Surface | API | What time means |
| --- | --- | --- |
| **Chunk search** | `GET /api/kbs/{id}/search` | Filters on **document version ingest** time: `created_after`, `created_before`, and `as_of` (alias for `created_before` when the latter is omitted). Restricts which chunks are eligible; does not rewind the graph. |
| **Graph workspace** | `GET /api/kbs/{id}/temporal/bounds`, `.../temporal/snapshot?at=` | **Explorer projection** emphasis at a point in time (scrubber UI). Separate from ledger ingest timestamps on chunks. |
| **Graph node search** | `POST /api/kbs/{id}/graph/search` | Always searches the **current** loaded projection. Optional body field `at` is accepted for forward compatibility but returns `warnings: ["graph_search_uses_current_projection"]` — use the graph timeline for point-in-time exploration. |

Product copy lives in KB Search subtitles and the Search page chunk filters. See also [explorer-integration.md](./explorer-integration.md) §5.2.

## Search behavior

- `keyword`: SQLite uses FTS5 trigram/BM25 (and a short-query `LIKE` fallback); PostgreSQL uses
  `pg_trgm` GIN matching plus GiST nearest-neighbor ranking.
- `semantic`: embed the query and search the configured vector backend.
- `hybrid`: run both channels and merge ranks with reciprocal-rank fusion.
- graph node search remains a separate Explorer projection and API.

If a hybrid query has no ready vector index, it degrades to keyword results and returns a warning.
An explicitly requested disabled mode returns a conflict error instead of silently changing modes.

## API and lifecycle

- `GET /api/kbs/{id}/search/config` — policy, readiness, and available implementations/models.
- `PUT /api/kbs/{id}/search/config` — update policy; admin role required.
- `GET /api/kbs/{id}/search` — execute the default or requested mode.
- `POST /api/kbs/{id}/search/reindex` — recreate the vector projection.

Changing the embedding model or vector backend marks reindex as required. Ingest writes canonical
chunks first, then indexes when semantic search and automatic indexing are enabled.

## Deployment and migration

`BASIS_DATABASE_URL` selects PostgreSQL; if unset, Basis uses SQLite. SQLAlchemy supplies the
connection pool and common execution layer, while dialect-specific search remains behind backend
interfaces. Alembic records the portable baseline; legacy SQLite migrations remain readable for
existing databases.

`basis migrate-postgres` copies canonical tables in one administrative transaction, verifies a
stable hash of all chunk IDs/text, and changes KB search configs to PostgreSQL/pgvector. Blob and
graph files remain in `BASIS_DATA_DIR`; vector bytes are rebuilt from canonical chunks.

`scripts/benchmark_search.py` measures both backends with identical data. On the development
machine with 100,000 chunks and the common query `混合检索`, SQLite measured about 63 requests/s
at concurrency 1 and 86 requests/s at concurrency 16; PostgreSQL measured about 33 requests/s and
79 requests/s respectively. These numbers are environment-specific—the relevant architectural
difference is that PostgreSQL uses pooled MVCC reads and can scale across API processes, while
SQLite requests eventually serialize on one connection.
