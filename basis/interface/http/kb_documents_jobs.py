"""Workspace document processing and ingest job routes."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
    graph_for,
    save_graph,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.ingest_helpers import respond_ingest
from basis.domain.knowledge.pipeline.file_ingest import FileParseError
from basis.domain.knowledge.pipeline.extract_timeout import ExtractionTimeoutError
from basis.domain.knowledge.pipeline.version_ingest import ExtractTextTooLargeError, TooManyChunksError
from basis.infra.runtime.observability.request_context import current_request_id
from basis.interface.http.kb_documents_models import (
    RetryProcessingRequest,
    StartProcessingRequest,
)
from basis.interface.http.kb_documents_processing_support import (
    processing_options,
    respond_idempotent_processing_job,
)

router = APIRouter(tags=["knowledge-bases"])


@router.get("/{workspace_id}/processing/jobs")
async def list_processing_jobs(
    workspace_id: str,
    request: Request,
    status: str | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Processing Jobs. Document processing jobs (extract, chunk, project). Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    if status and status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
        raise AdminError(422, "bad_status", "任务状态无效")
    return {
        "jobs": knowledge.list_processing_jobs(
            workspace_id,
            status=status,
            limit=min(max(1, limit), 200),
        )
    }


@router.post("/{workspace_id}/processing/jobs", response_model=None)
async def start_processing_job(
    workspace_id: str,
    body: StartProcessingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """
Start Processing Job. Document processing jobs (extract, chunk, project). Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    context = knowledge.get_processing_context(workspace_id, body.version_id)
    options, options_payload = processing_options(
        body, store, filename=context["filename"]
    )
    trigger_rid = current_request_id()
    if trigger_rid:
        options_payload = {**options_payload, "request_id": trigger_rid}
    job, created = knowledge.create_processing_job(
        workspace_id,
        version_id=body.version_id,
        options=options_payload,
        idempotency_key=body.idempotency_key,
    )
    job_timeout = float(request.app.state.limits.processing_job_timeout_seconds)
    if not created:
        return await respond_idempotent_processing_job(
            knowledge,
            workspace_id,
            job,
            body,
            context,
            timeout_sec=job_timeout,
        )
    session = graph_for(request, workspace_id) if body.wait else None

    def _run() -> Any:
        return respond_ingest(
            request.app,
            workspace_id,
            body.version_id,
            job["id"],
            context["document_id"],
            wait=body.wait,
            filename=context["filename"],
            graph_doc_id=context["doc_id"],
            options=options,
            graph_session=session,
            trigger_request_id=trigger_rid,
        )

    try:
        result = await asyncio.to_thread(_run)
    except FileParseError as exc:
        raise AdminError(422, "parse_failed", exc.message) from exc
    except ExtractTextTooLargeError as exc:
        raise AdminError(413, "extract_text_too_large", exc.message) from exc
    except TooManyChunksError as exc:
        raise AdminError(413, "too_many_chunks", exc.message) from exc
    except ExtractionTimeoutError as exc:
        raise AdminError(504, "extract_timeout", exc.message) from exc
    if body.wait:
        save_graph(request, workspace_id)
    return result


@router.get("/{workspace_id}/processing/jobs/{job_id}")
async def get_processing_job(
    workspace_id: str,
    request: Request,
    job_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Get Processing Job. Document processing jobs (extract, chunk, project). Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    job = knowledge.get_job(workspace_id, job_id)
    return {
        "job": {
            "id": job.id,
            "workspace_id": job.workspace_id,
            "kind": job.kind,
            "subject_type": job.subject_type,
            "version_id": job.subject_id,
            "status": job.status,
            "attempt": job.attempt,
            "progress": job.progress,
            "error_code": job.error_code,
            "error_detail": job.error_detail,
            "options": job.options,
            "result": job.result,
            "created_at": job.created_at,
            "started_at": job.started_at,
            "finished_at": job.finished_at,
        }
    }


@router.post("/{workspace_id}/processing/jobs/{job_id}/retry", response_model=None)
async def retry_processing_job(
    workspace_id: str,
    job_id: str,
    body: RetryProcessingRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> Any:
    """
Retry Processing Job. Document processing jobs (extract, chunk, project). Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    previous = knowledge.get_job(workspace_id, job_id)
    if previous.status not in {"failed", "cancelled"}:
        raise AdminError(409, "job_not_retryable", "仅失败或已取消任务可重试")
    request_body = StartProcessingRequest(
        version_id=previous.subject_id,
        wait=body.wait,
        **previous.options,
    )
    return await start_processing_job(
        workspace_id=workspace_id,
        body=request_body,
        request=request,
        user=user,
        store=store,
        knowledge=knowledge,
    )


@router.get("/{workspace_id}/ingest/jobs")
async def list_ingest_jobs(
    workspace_id: str,
    request: Request,
    status: str | None = None,
    limit: int = 100,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """F-SRC-08: document ingest jobs (alias of ``GET .../processing/jobs``)."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    if status and status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
        raise AdminError(422, "bad_status", "任务状态无效")
    return {
        "jobs": knowledge.list_processing_jobs(
            workspace_id,
            status=status,
            limit=min(max(1, limit), 200),
        ),
        "processing_jobs_path": f"/api/workspaces/{workspace_id}/processing/jobs",
    }


@router.get("/{workspace_id}/ingest/jobs/{job_id}")
async def get_ingest_job(
    workspace_id: str,
    job_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Get Ingest Job. Requires workspace membership (session) or workspace API token with read/write scope. All paths are scoped to `{workspace_id}`.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    knowledge = get_knowledge_store(request)
    job = knowledge.get_job(workspace_id, job_id)
    payload: dict[str, Any] = {
        "id": job.id,
        "workspace_id": job.workspace_id,
        "kind": job.kind,
        "subject_type": job.subject_type,
        "subject_id": job.subject_id,
        "status": job.status,
        "attempt": job.attempt,
        "progress": job.progress,
        "error_code": job.error_code,
        "error_detail": job.error_detail,
        "options": job.options,
        "result": job.result,
        "created_at": job.created_at,
        "started_at": job.started_at,
        "finished_at": job.finished_at,
    }
    version_payload: dict[str, Any] | None = None
    if job.subject_type == "document_version":
        version = knowledge.get_version(workspace_id, job.subject_id)
        version_payload = {
            "id": version.id,
            "document_id": version.document_id,
            "status": version.status,
            "sha256": version.sha256,
            "byte_size": version.byte_size,
        }
    return {"job": payload, "version": version_payload}
