"""Shared ingest request/response helpers for KB document routes."""

from __future__ import annotations

from typing import Any

from fastapi import FastAPI
from fastapi.responses import JSONResponse

from sema.api.ingest_tasks import enqueue_version_ingest, run_version_ingest_for_app
from sema.graph.session import GraphSession
from sema.knowledge.store import KnowledgeStore
from sema.pipeline.document import TextIngestOptions
from sema.pipeline.file_ingest import FileParseError
from sema.pipeline.version_ingest import run_version_ingest


def ingest_accept_payload(
    *,
    job_id: str,
    version_id: str,
    ledger_document_id: str,
    doc_id: str,
    filename: str,
) -> dict[str, Any]:
    return {
        "accepted": True,
        "status": "queued",
        "job_id": job_id,
        "version_id": version_id,
        "document_id": ledger_document_id,
        "doc_id": doc_id,
        "filename": filename,
    }


def run_ingest_blocking(
    app: FastAPI,
    kb_id: str,
    version_id: str,
    job_id: str,
    *,
    filename: str,
    graph_doc_id: str,
    options: TextIngestOptions,
    graph_session: GraphSession | None = None,
) -> dict[str, Any]:
    knowledge: KnowledgeStore = app.state.knowledge_store
    if graph_session is not None:
        return run_version_ingest(
            knowledge,
            graph_session,
            kb_id,
            version_id,
            job_id,
            filename=filename,
            graph_doc_id=graph_doc_id,
            options=options,
            chunk_search=app.state.chunk_search,
        )
    result = run_version_ingest_for_app(
        app,
        kb_id,
        version_id,
        job_id,
        filename=filename,
        graph_doc_id=graph_doc_id,
        options=options,
    )
    if result is None:
        raise FileParseError("parse_failed")
    return result


def respond_ingest(
    app: FastAPI,
    kb_id: str,
    version_id: str,
    job_id: str,
    ledger_document_id: str,
    *,
    wait: bool,
    filename: str,
    graph_doc_id: str,
    options: TextIngestOptions,
    graph_session: GraphSession | None = None,
) -> JSONResponse | dict[str, Any]:
    if not wait:
        enqueue_version_ingest(
            app,
            kb_id,
            version_id,
            job_id,
            filename=filename,
            graph_doc_id=graph_doc_id,
            options=options,
        )
        return JSONResponse(
            status_code=202,
            content=ingest_accept_payload(
                job_id=job_id,
                version_id=version_id,
                ledger_document_id=ledger_document_id,
                doc_id=graph_doc_id,
                filename=filename,
            ),
        )
    result = run_ingest_blocking(
        app,
        kb_id,
        version_id,
        job_id,
        filename=filename,
        graph_doc_id=graph_doc_id,
        options=options,
        graph_session=graph_session,
    )
    return {
        **result,
        "filename": filename,
        "doc_id": graph_doc_id,
        "document_id": ledger_document_id,
        "version_id": version_id,
        "job_id": job_id,
    }
