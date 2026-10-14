"""KB review queue (entity merge proposals, Gate D slice)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, Query, Request, UploadFile
from pydantic import BaseModel, Field

from sema.admin.errors import AdminError
from sema.admin.store import AdminStore, User
from sema.api.deps import (
    get_blob_store,
    get_current_user,
    get_explorer_registry,
    get_knowledge_store,
    get_store,
    rebuild_kb_projection,
    save_graph,
)
from sema.explorer.session_guard import require_explorer_graph_session
from sema.knowledge.graph_audit import audit_kb_graph
from sema.knowledge.import_review import discard_staged_import, stage_import_blob, upload_file_from_staged
from sema.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class CreateEntityMergeReviewRequest(BaseModel):
    primary_id: str = Field(min_length=1)
    duplicate_ids: list[str] = Field(min_length=1)


class ResolveReviewRequest(BaseModel):
    rationale: str | None = None


def _ledger_entity_merge_ids(
    knowledge: KnowledgeStore,
    kb_id: str,
    primary_id: str,
    duplicate_ids: list[str],
) -> bool:
    if not primary_id or not duplicate_ids:
        return False
    if not knowledge.ledger_entity_exists(kb_id, primary_id):
        return False
    return all(knowledge.ledger_entity_exists(kb_id, dup) for dup in duplicate_ids)


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
    store.get_kb_for(user, kb_id, "viewer")
    items = knowledge.list_review_items(kb_id, status=status, kind=kind, limit=limit)
    return {"items": items}


@router.post("/{kb_id}/review/items/entity-merge")
async def propose_entity_merge(
    kb_id: str,
    body: CreateEntityMergeReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
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
    file: UploadFile = File(...),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
    blob_store=Depends(get_blob_store),  # noqa: B008
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
    raw = await file.read()
    staged = stage_import_blob(blob_store, kb_id, raw, file.filename or "import.json")
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


@router.post("/{kb_id}/review/items/{item_id}/approve")
async def approve_review_item(
    kb_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
    item = knowledge.get_review_item(kb_id, item_id)
    if item["status"] != "open":
        raise AdminError(409, "review_closed", "审核项已处理")

    merge_result: dict[str, Any] | None = None
    import_result: dict[str, Any] | None = None
    approve_action = "kb.graph.merge_approved"
    if item["kind"] == "entity_merge":
        payload = item["payload"]
        primary_id = str(payload.get("primary_id") or "")
        duplicate_ids = [str(d) for d in payload.get("duplicate_ids") or []]

        if _ledger_entity_merge_ids(knowledge, kb_id, primary_id, duplicate_ids):
            ledger_merges = [
                knowledge.record_entity_merge(
                    kb_id,
                    source_entity_id=dup,
                    target_entity_id=primary_id,
                    actor_id=user.id,
                    why=body.rationale,
                )
                for dup in duplicate_ids
            ]
            projection = rebuild_kb_projection(request, kb_id)
            merge_result = {
                "mode": "ledger_rebuild",
                "ledger_merges": ledger_merges,
                "projection": projection,
            }
        else:
            from semantica.explorer.routes.enrich import merge_nodes
            from semantica.explorer.schemas import MergeRequest

            merge_body = MergeRequest.model_validate(payload)
            runtime = get_explorer_registry(request).get(request, kb_id)
            session = require_explorer_graph_session(runtime)
            result = await merge_nodes(merge_body, session=session)
            save_graph(request, kb_id)
            merge_result = result.model_dump() if hasattr(result, "model_dump") else dict(result)
            ledger_merges: list[dict[str, Any]] = []
            for dup in duplicate_ids:
                if (
                    primary_id
                    and knowledge.ledger_entity_exists(kb_id, dup)
                    and knowledge.ledger_entity_exists(kb_id, primary_id)
                ):
                    ledger_merges.append(
                        knowledge.record_entity_merge(
                            kb_id,
                            source_entity_id=dup,
                            target_entity_id=primary_id,
                            actor_id=user.id,
                            why=body.rationale,
                        )
                    )
            if ledger_merges:
                merge_result = {**merge_result, "ledger_merges": ledger_merges}
            elif duplicate_ids:
                merge_result = {
                    **merge_result,
                    "ledger_notice": "graph_only_merge",
                    "ledger_skipped_ids": duplicate_ids,
                }
            partial = [
                dup
                for dup in duplicate_ids
                if primary_id
                and knowledge.ledger_entity_exists(kb_id, primary_id)
                and not knowledge.ledger_entity_exists(kb_id, dup)
            ]
            if ledger_merges and partial:
                merge_result = {
                    **merge_result,
                    "ledger_notice": "partial_ledger",
                    "ledger_skipped_ids": partial,
                }
    elif item["kind"] == "graph_import":
        from semantica.explorer.routes.export_import import import_file

        approve_action = "kb.graph.import"
        runtime = get_explorer_registry(request).get(request, kb_id)
        session = require_explorer_graph_session(runtime)
        upload = upload_file_from_staged(get_blob_store(request), kb_id, item["payload"])
        result = await import_file(file=upload, session=session)
        save_graph(request, kb_id)
        import_result = result.model_dump() if hasattr(result, "model_dump") else dict(result)
        discard_staged_import(get_blob_store(request), kb_id, item["payload"])
    else:
        raise AdminError(422, "unsupported_review_kind", f"不支持的审核类型: {item['kind']}")

    resolved = knowledge.resolve_review_item(
        kb_id,
        item_id,
        status="approved",
        resolved_by=user.id,
        rationale=body.rationale,
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        approve_action,
        review_item_id=item_id,
        extra={
            "merge": merge_result,
            "import": import_result,
            "rationale": body.rationale,
            **(
                {
                    "ledger_notice": merge_result.get("ledger_notice"),
                    "ledger_skipped_ids": merge_result.get("ledger_skipped_ids"),
                }
                if isinstance(merge_result, dict) and merge_result.get("ledger_notice")
                else {}
            ),
        },
    )
    return {"item": resolved, "merge": merge_result, "import": import_result}


@router.post("/{kb_id}/review/items/{item_id}/reject")
async def reject_review_item(
    kb_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "editor")
    item = knowledge.get_review_item(kb_id, item_id)
    if item.get("kind") == "graph_import":
        discard_staged_import(get_blob_store(request), kb_id, item.get("payload") or {})
    resolved = knowledge.resolve_review_item(
        kb_id,
        item_id,
        status="rejected",
        resolved_by=user.id,
        rationale=body.rationale,
    )
    reject_action = (
        "kb.graph.import_rejected"
        if item.get("kind") == "graph_import"
        else "kb.graph.merge_rejected"
    )
    audit_kb_graph(
        store,
        user,
        kb_id,
        reject_action,
        review_item_id=item_id,
        extra={"rationale": body.rationale, "payload": item.get("payload")},
    )
    return {"item": resolved}


@router.get("/{kb_id}/audit/graph-mutations")
async def list_kb_graph_audit(
    kb_id: str,
    limit: int = Query(50, ge=1, le=200),
    action_prefix: str = Query("kb.graph."),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    store.get_kb_for(user, kb_id, "viewer")
    prefix = action_prefix.strip() or "kb.graph."
    events = store.list_audit_for_kb(kb_id, action_prefix=prefix, limit=limit)
    return {"events": events}
