# Runtime limits and observability (API process)

Sema reads these from the environment (see `.env.example`). Defaults match `sema.limits.RuntimeLimits` and `Settings.from_env()`.

## Request and ingest bounds (X-04)

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEMA_GRAPH_PAGE_MAX_NODES` | 200 | Cap `graph/nodes` and snapshot node pages |
| `SEMA_GRAPH_PAGE_MAX_EDGES` | 400 | Cap graph edge pages and snapshot edges |
| `SEMA_CHUNK_SEARCH_MAX_LIMIT` | 50 | Cap `GET .../search` result size |
| `SEMA_GRAPH_NODE_SEARCH_MAX_LIMIT` | 50 | Cap Explorer graph node search |
| `SEMA_EXPLORER_DECISIONS_MAX_LIMIT` | 200 | Cap decisions list |
| `SEMA_IMPORT_MAX_BYTES` | 52428800 | Graph import review upload |
| `SEMA_UPLOAD_MAX_BYTES` | 52428800 | Document upload / JSON text ingest |
| `SEMA_INGEST_MAX_INFLIGHT` | 4 | Background ingest thread pool size |
| `SEMA_INGEST_MAX_PENDING` | 32 | Max concurrent + queued ingest jobs (`ingest_overloaded` when full) |
| `SEMA_PROCESSING_JOB_TIMEOUT_SECONDS` | 600 | Idempotent `wait=true` job poll timeout |
| `SEMA_INGEST_MAX_EXTRACT_CHARS` | 2000000 | Parsed text length before chunking |
| `SEMA_INGEST_MAX_CHUNKS` | 2000 | Chunks per version after split |
| `SEMA_INGEST_EXTRACT_TIMEOUT_SECONDS` | 300 | Per-segment `GraphBuilder.build` wall clock (`0` = off) |

Failed ingest jobs surface codes such as `upload_too_large`, `extract_text_too_large`, `too_many_chunks`, and `extract_timeout` (API `detail.code`; Web maps them in `api-error-message.ts`).

## Correlation and logs (X-02)

| Variable | Default | Purpose |
| --- | --- | --- |
| `SEMA_LOG_JSON` | off | JSON log lines on `sema.*` loggers |

HTTP responses include `X-Request-ID`; processing jobs may store `options.request_id` from the triggering request.

## Verification

```bash
uv run pytest tests/test_runtime_limits.py tests/test_graph_page_limits.py tests/test_observability.py -q
```
