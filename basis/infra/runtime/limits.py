"""Server-side bounds for unbounded client requests (X-04)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING

if TYPE_CHECKING:
    from basis.infra.runtime.config import Settings

_DEFAULT_GRAPH_PAGE_MAX_NODES = 200
_DEFAULT_GRAPH_PAGE_MAX_EDGES = 400
_DEFAULT_CHUNK_SEARCH_MAX_LIMIT = 50
_DEFAULT_EXPLORER_DECISIONS_MAX_LIMIT = 200
_DEFAULT_GRAPH_NODE_SEARCH_MAX_LIMIT = 50
_DEFAULT_IMPORT_MAX_BYTES = 50 * 1024 * 1024
_DEFAULT_UPLOAD_MAX_BYTES = 50 * 1024 * 1024
_DEFAULT_INGEST_MAX_INFLIGHT = 4
_DEFAULT_INGEST_MAX_PENDING = 32
_DEFAULT_PROCESSING_JOB_TIMEOUT_SECONDS = 600
_DEFAULT_INGEST_MAX_EXTRACT_CHARS = 2_000_000
_DEFAULT_INGEST_MAX_CHUNKS = 2_000
_DEFAULT_INGEST_EXTRACT_TIMEOUT_SECONDS = 300


@dataclass(frozen=True)
class RuntimeLimits:
    graph_page_max_nodes: int = _DEFAULT_GRAPH_PAGE_MAX_NODES
    graph_page_max_edges: int = _DEFAULT_GRAPH_PAGE_MAX_EDGES
    chunk_search_max_limit: int = _DEFAULT_CHUNK_SEARCH_MAX_LIMIT
    explorer_decisions_max_limit: int = _DEFAULT_EXPLORER_DECISIONS_MAX_LIMIT
    graph_node_search_max_limit: int = _DEFAULT_GRAPH_NODE_SEARCH_MAX_LIMIT
    import_max_bytes: int = _DEFAULT_IMPORT_MAX_BYTES
    upload_max_bytes: int = _DEFAULT_UPLOAD_MAX_BYTES
    ingest_max_inflight: int = _DEFAULT_INGEST_MAX_INFLIGHT
    ingest_max_pending: int = _DEFAULT_INGEST_MAX_PENDING
    processing_job_timeout_seconds: int = _DEFAULT_PROCESSING_JOB_TIMEOUT_SECONDS
    ingest_max_extract_chars: int = _DEFAULT_INGEST_MAX_EXTRACT_CHARS
    ingest_max_chunks: int = _DEFAULT_INGEST_MAX_CHUNKS
    ingest_extract_timeout_seconds: int = _DEFAULT_INGEST_EXTRACT_TIMEOUT_SECONDS

    @classmethod
    def from_settings(cls, settings: Settings) -> RuntimeLimits:
        return cls(
            graph_page_max_nodes=settings.graph_page_max_nodes,
            graph_page_max_edges=settings.graph_page_max_edges,
            chunk_search_max_limit=settings.chunk_search_max_limit,
            explorer_decisions_max_limit=settings.explorer_decisions_max_limit,
            graph_node_search_max_limit=settings.graph_node_search_max_limit,
            import_max_bytes=settings.import_max_bytes,
            upload_max_bytes=settings.upload_max_bytes,
            ingest_max_inflight=settings.ingest_max_inflight,
            ingest_max_pending=settings.ingest_max_pending,
            processing_job_timeout_seconds=settings.processing_job_timeout_seconds,
            ingest_max_extract_chars=settings.ingest_max_extract_chars,
            ingest_max_chunks=settings.ingest_max_chunks,
            ingest_extract_timeout_seconds=settings.ingest_extract_timeout_seconds,
        )


DEFAULT_LIMITS = RuntimeLimits()

# Backward-compatible module constants (default deployment caps).
GRAPH_PAGE_MAX_NODES = DEFAULT_LIMITS.graph_page_max_nodes
GRAPH_PAGE_MAX_EDGES = DEFAULT_LIMITS.graph_page_max_edges
CHUNK_SEARCH_MAX_LIMIT = DEFAULT_LIMITS.chunk_search_max_limit
EXPLORER_DECISIONS_MAX_LIMIT = DEFAULT_LIMITS.explorer_decisions_max_limit
GRAPH_NODE_SEARCH_MAX_LIMIT = DEFAULT_LIMITS.graph_node_search_max_limit
IMPORT_MAX_BYTES = DEFAULT_LIMITS.import_max_bytes
UPLOAD_MAX_BYTES = DEFAULT_LIMITS.upload_max_bytes
