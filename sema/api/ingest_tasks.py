"""Background version ingest with per-KB graph locking."""

from __future__ import annotations

import logging
import threading
from typing import Any

logger = logging.getLogger(__name__)

from fastapi import FastAPI

from sema.graph.persistence import GraphPersistence
from sema.knowledge.chunk_search import ChunkSearchService
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions
from sema.pipeline.file_ingest import FileParseError
from sema.observability.log_context import correlation_log_extra
from sema.pipeline.version_ingest import run_version_ingest

_kb_locks: dict[str, threading.Lock] = {}
_lock_guard = threading.Lock()


def _kb_lock(kb_id: str) -> threading.Lock:
    with _lock_guard:
        lock = _kb_locks.get(kb_id)
        if lock is None:
            lock = threading.Lock()
            _kb_locks[kb_id] = lock
        return lock


def run_version_ingest_for_app(
    app: FastAPI,
    kb_id: str,
    version_id: str,
    job_id: str,
    *,
    filename: str,
    graph_doc_id: str,
    options: TextIngestOptions,
) -> dict[str, Any] | None:
    """Load graph, run ingest, persist. Returns result dict or None if parse failed."""
    knowledge: KnowledgeStore = app.state.knowledge_store
    chunk_search: ChunkSearchService = app.state.chunk_search
    persistence: GraphPersistence = app.state.graph_persistence
    graphs: dict[str, Any] = app.state.graphs

    with _kb_lock(kb_id):
        session = graphs.get(kb_id)
        if session is None:
            session = persistence.load(kb_id)
            graphs[kb_id] = session
        try:
            result = run_version_ingest(
                knowledge,
                session,
                kb_id,
                version_id,
                job_id,
                filename=filename,
                graph_doc_id=graph_doc_id,
                options=options,
                chunk_search=chunk_search,
            )
        except FileParseError:
            return None
        except Exception:
            logger.exception(
                "version ingest failed kb_id=%s version_id=%s job_id=%s",
                kb_id,
                version_id,
                job_id,
                extra=correlation_log_extra(
                    kb_id=kb_id,
                    version_id=version_id,
                    job_id=job_id,
                ),
            )
            return None
        ledger = knowledge.get_projection_state(kb_id)
        logger.info(
            "version ingest completed kb_id=%s version_id=%s job_id=%s projection_revision=%s",
            kb_id,
            version_id,
            job_id,
            ledger["revision"],
            extra=correlation_log_extra(
                kb_id=kb_id,
                version_id=version_id,
                job_id=job_id,
                projection_revision=ledger["revision"],
            ),
        )
        persistence.save(
            kb_id,
            session,
            projection_revision=ledger["revision"],
            schema_version=ledger["schema_version"],
        )
        app.state.explorer_registry.invalidate(kb_id)
        app.state.ws_hub.try_broadcast(
            kb_id,
            {
                "type": "projection_updated",
                "kb_id": kb_id,
                "projection_revision": ledger["revision"],
            },
        )
        return result


def enqueue_version_ingest(
    app: FastAPI,
    kb_id: str,
    version_id: str,
    job_id: str,
    *,
    filename: str,
    graph_doc_id: str,
    options: TextIngestOptions,
) -> None:
    """Fire-and-forget ingest on a worker thread (same process)."""

    def _work() -> None:
        run_version_ingest_for_app(
            app,
            kb_id,
            version_id,
            job_id,
            filename=filename,
            graph_doc_id=graph_doc_id,
            options=options,
        )

    if getattr(app.state.settings, "ingest_inline", False):
        _work()
        return
    threading.Thread(target=_work, name=f"ingest-{job_id[:8]}", daemon=True).start()
