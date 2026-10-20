"""KB review queue list and proposal routes."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile

from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_blob_store,
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_runtime_limits,
    get_store,
)
from basis.runtime.limits import RuntimeLimits
from basis.core.ledger.services.graph_audit import audit_kb_graph
from basis.core.ledger.services.conflict_review import scan_statement_conflicts
from basis.core.ledger.services.import_review import stage_import_blob
from basis.core.ledger.store import KnowledgeStore
from basis.application.http import http_response_from_payload
from basis.application.registry import run
from basis.api.http.kb_core_context import build_kb_core_context
from basis.api.http.routes.v1.kb.review.models import CreateEntityMergeReviewRequest

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/review/scan-statement-conflicts")
async def scan_statement_conflicts_route(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Re-scan ledger statements and enqueue `statement_conflict` review items (F-RUL-04)."""
    get_kb_for_editor(request, user, kb_id, store)
    return scan_statement_conflicts(knowledge, kb_id)


@router.get("/{kb_id}/review/items")
async def list_review_items(
    kb_id: str,
    request: Request,
    status: str | None = Query("open"),
    kind: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
List Review Items. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    items = knowledge.list_review_items(kb_id, status=status, kind=kind, limit=limit)
    return {"items": items}


@router.get("/{kb_id}/review/items/{item_id}")
async def get_review_item_route(
    kb_id: str,
    item_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Get Review Item. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    ctx = build_kb_core_context(request, kb_id=kb_id, user=user, store=store)
    payload = await asyncio.to_thread(run, ctx, "get_review_item", {"item_id": item_id})
    return http_response_from_payload(payload)


@router.post("/{kb_id}/review/items/entity-merge")
async def propose_entity_merge(
    kb_id: str,
    request: Request,
    body: CreateEntityMergeReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Propose Entity Merge. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    subject_id = KnowledgeStore.merge_review_subject_key(body.primary_id, body.duplicate_ids)
    item = knowledge.create_review_item(
        kb_id,
        kind="entity_merge",
        subject_type="graph_nodes",
        subject_id=subject_id,
        payload={
            "primary_id": body.primary_id,
            "duplicate_ids": body.duplicate_ids,
        },
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.merge_proposed",
        review_item_id=item["id"],
        extra={
            "primary_id": body.primary_id,
            "duplicate_ids": body.duplicate_ids,
        },
    )
    return {"item": item}


@router.post("/{kb_id}/review/items/graph-import")
async def propose_graph_import(
    kb_id: str,
    request: Request,
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    blob_store=Depends(get_blob_store),  # noqa: B008
    limits: RuntimeLimits = Depends(get_runtime_limits),
) -> dict[str, Any]:
    """
Propose Graph Import. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    raw = await file.read()
    staged = stage_import_blob(
        blob_store,
        kb_id,
        raw,
        file.filename or "import.json",
        max_bytes=limits.import_max_bytes,
    )
    subject_id = f"import:{staged['sha256']}"
    item = knowledge.create_review_item(
        kb_id,
        kind="graph_import",
        subject_type="import_blob",
        subject_id=subject_id,
        payload=staged,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        "kb.graph.import_proposed",
        review_item_id=item["id"],
        extra=staged,
    )
    return {"item": item}


