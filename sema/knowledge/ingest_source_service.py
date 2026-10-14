"""Shared ingest-source helpers (webhook, URL pull)."""

from __future__ import annotations

from typing import Any

from fastapi import Request

from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions

_DEFAULT_PROCESSING_OPTIONS = {
    "chunk": True,
    "chunk_size": 1800,
    "chunk_overlap": 250,
    "extract": True,
    "ner_method": "pattern",
    "relation_method": "pattern",
    "extract_relations": True,
    "extract_triplets": False,
}


def record_ingest_source_event(
    knowledge: KnowledgeStore,
    kb_id: str,
    source_id: str,
    event: dict[str, Any],
    *,
    max_events: int = 30,
) -> None:
    source = knowledge.get_ingest_source(kb_id, source_id)
    config = dict(source.get("config") or {})
    events = list(config.get("sync_events") or [])
    events.insert(0, event)
    config["sync_events"] = events[:max_events]
    config["last_sync_at"] = event.get("at")
    config["last_sync_status"] = event.get("status")
    knowledge.update_ingest_source(kb_id, source_id, config=config)


def enqueue_text_from_source(
    request: Request,
    knowledge: KnowledgeStore,
    kb_id: str,
    source_id: str,
    *,
    title: str,
    text: str,
    doc_id: str,
    auto_process: bool,
) -> dict[str, Any]:
    from sema.api.routes.ingest_helpers import enqueue_version_ingest, ingest_accept_payload

    filename = f"{doc_id}.txt"
    outcome = knowledge.store_document_bytes(
        kb_id,
        title=title,
        mime_type="text/plain",
        data=text.encode("utf-8"),
        created_by=None,
        original_filename=filename,
        external_key=doc_id,
        source_id=source_id,
    )
    if not auto_process:
        return {
            "accepted": True,
            "document_id": outcome.document_id,
            "version_id": outcome.version_id,
            "doc_id": doc_id,
            "status": "uploaded",
        }
    options = TextIngestOptions(**_DEFAULT_PROCESSING_OPTIONS)
    job = knowledge.create_processing_job(
        kb_id,
        version_id=outcome.version_id,
        options=_DEFAULT_PROCESSING_OPTIONS,
    )
    enqueue_version_ingest(
        request.app,
        kb_id,
        outcome.version_id,
        job["id"],
        filename=filename,
        graph_doc_id=doc_id,
        options=options,
    )
    return ingest_accept_payload(
        job_id=job["id"],
        version_id=outcome.version_id,
        ledger_document_id=outcome.document_id,
        doc_id=doc_id,
        filename=filename,
    )
