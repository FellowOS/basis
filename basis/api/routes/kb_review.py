"""KB review queue (entity merge proposals, Gate D slice)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, Field

from basis.admin.errors import AdminError
from basis.admin.store import AdminStore, User
from basis.api.deps import (
    get_blob_store,
    get_current_user,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_runtime_limits,
    get_store,
    rebuild_kb_projection,
    save_graph,
)
from basis.api.explorer_route_errors import admin_error_from_explorer_http
from basis.explorer.governance_decision import emit_governance_tripped_for_kb
from basis.limits import RuntimeLimits
from basis.explorer.session_guard import require_explorer_graph_session
from basis.knowledge.graph_audit import audit_kb_graph
from basis.knowledge.import_review import discard_staged_import, stage_import_blob, upload_file_from_staged
from basis.knowledge.mapping_service import (
    MAPPING_REVIEW_KIND,
    apply_mapping_status_change,
)
from basis.knowledge.conflict_review import STATEMENT_CONFLICT_KIND, scan_statement_conflicts
from basis.knowledge.remember_service import STATEMENT_REVIEW_KIND
from basis.knowledge.store import KnowledgeStore

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
    get_kb_for_viewer(request, user, kb_id, store)
    items = knowledge.list_review_items(kb_id, status=status, kind=kind, limit=limit)
    return {"items": items}


@router.post("/{kb_id}/review/items/entity-merge")
async def propose_entity_merge(
    kb_id: str,
    request: Request,
    body: CreateEntityMergeReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
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
    get_kb_for_editor(request, user, kb_id, store)
    item = knowledge.get_review_item(kb_id, item_id)
    if item["status"] != "open":
        raise AdminError(409, "review_closed", "审核项已处理")

    merge_result: dict[str, Any] | None = None
    import_result: dict[str, Any] | None = None
    mapping_result: dict[str, Any] | None = None
    approve_action = "kb.graph.merge_approved"
    _skip_governance_alert = frozenset(
        {"review_closed", "not_found", "forbidden", "unsupported_review_kind"},
    )

    try:
        if item["kind"] == MAPPING_REVIEW_KIND:
            approve_action = "kb.mapping.approved"
            payload = item["payload"] or {}
            mapping_id = str(payload.get("mapping_id") or item["subject_id"])
            mapping_result = apply_mapping_status_change(
                request,
                kb_id,
                mapping_id,
                user,
                store,
                knowledge,
                status="confirmed",
                why=body.rationale,
                sync_review=False,
            )
            mapping_result = {
                **mapping_result,
                "conflicts": scan_statement_conflicts(knowledge, kb_id),
            }
        elif item["kind"] == "entity_merge":
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
        elif item["kind"] == STATEMENT_REVIEW_KIND:
            approve_action = "kb.statement.remember_approved"
            payload = item.get("payload") or {}
            statement_id = str(payload.get("statement_id") or item["subject_id"])
            knowledge.set_statement_status(kb_id, statement_id, "confirmed")
            rebuild_kb_projection(request, kb_id)
            merge_result = {
                "statement_id": statement_id,
                "status": "confirmed",
                "conflicts": scan_statement_conflicts(knowledge, kb_id),
            }
        elif item["kind"] == STATEMENT_CONFLICT_KIND:
            approve_action = "kb.statement.conflict_acknowledged"
            merge_result = {"status": "acknowledged", "payload": item.get("payload")}
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
        return {
            "item": resolved,
            "merge": merge_result,
            "import": import_result,
            "mapping": mapping_result,
        }
    except HTTPException as exc:
        mapped = admin_error_from_explorer_http(exc, context="enrich")
        if mapped.code not in _skip_governance_alert:
            emit_governance_tripped_for_kb(
                request,
                kb_id,
                knowledge,
                message=mapped.message,
                detail={
                    "code": mapped.code,
                    "item_id": item_id,
                    "kind": item.get("kind"),
                    "source": "review_approve",
                },
                actor_id=user.id,
            )
        raise mapped
    except AdminError as exc:
        if exc.code not in _skip_governance_alert:
            emit_governance_tripped_for_kb(
                request,
                kb_id,
                knowledge,
                message=exc.message,
                detail={
                    "code": exc.code,
                    "item_id": item_id,
                    "kind": item.get("kind"),
                    "source": "review_approve",
                },
                actor_id=user.id,
            )
        raise


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
    get_kb_for_editor(request, user, kb_id, store)
    item = knowledge.get_review_item(kb_id, item_id)
    if item.get("kind") == "graph_import":
        discard_staged_import(get_blob_store(request), kb_id, item.get("payload") or {})
    elif item.get("kind") == MAPPING_REVIEW_KIND:
        payload = item.get("payload") or {}
        mapping_id = str(payload.get("mapping_id") or item["subject_id"])
        apply_mapping_status_change(
            request,
            kb_id,
            mapping_id,
            user,
            store,
            knowledge,
            status="rejected",
            why=body.rationale,
            sync_review=False,
        )
    elif item.get("kind") == STATEMENT_REVIEW_KIND:
        payload = item.get("payload") or {}
        statement_id = str(payload.get("statement_id") or item["subject_id"])
        knowledge.set_statement_status(kb_id, statement_id, "rejected")
    resolved = knowledge.resolve_review_item(
        kb_id,
        item_id,
        status="rejected",
        resolved_by=user.id,
        rationale=body.rationale,
    )
    if item.get("kind") == "graph_import":
        reject_action = "kb.graph.import_rejected"
    elif item.get("kind") == MAPPING_REVIEW_KIND:
        reject_action = "kb.mapping.rejected"
    elif item.get("kind") == STATEMENT_REVIEW_KIND:
        reject_action = "kb.statement.remember_rejected"
    elif item.get("kind") == STATEMENT_CONFLICT_KIND:
        reject_action = "kb.statement.conflict_dismissed"
    else:
        reject_action = "kb.graph.merge_rejected"
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
    request: Request,
    limit: int = Query(50, ge=1, le=200),
    action_prefix: str = Query("kb.graph."),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    prefix = action_prefix.strip() or "kb.graph."
    events = store.list_audit_for_kb(kb_id, action_prefix=prefix, limit=limit)
    return {"events": events}
