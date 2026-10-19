"""KB review queue (entity merge proposals, Gate D slice)."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, File, HTTPException, Query, Request, UploadFile
from pydantic import BaseModel, ConfigDict, Field

from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
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
from basis.transport.http.explorer_route_errors import admin_error_from_explorer_http, invoke_explorer
from basis.domain.explorer.governance_decision import (
    maybe_emit_governance_tripped_on_review_approve,
    record_governance_decision_for_kb,
)
from basis.infra.limits import RuntimeLimits
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.domain.kb.graph_audit import audit_kb_graph
from basis.domain.kb.import_review import discard_staged_import, stage_import_blob, upload_file_from_staged
from basis.domain.kb.mapping_service import (
    MAPPING_REVIEW_KIND,
    apply_mapping_status_change,
)
from basis.domain.kb.conflict_review import (
    STATEMENT_CONFLICT_KIND,
    resolve_statement_conflict_group,
    scan_statement_conflicts,
)
from basis.domain.kb.governor import (
    LOW_CONFIDENCE_KIND,
    resolve_low_confidence_approve,
    resolve_low_confidence_reject,
)
from basis.domain.kb.governor_cluster import ENTITY_CLUSTER_KIND
from basis.domain.kb.remember_service import STATEMENT_REVIEW_KIND
from basis.domain.kb.review_resolve import (
    approve_statement_remember_review,
    reject_statement_remember_review,
)
from basis.domain.kb.store import KnowledgeStore
from basis.integration.http import http_response_from_payload
from basis.integration.registry import run
from basis.transport.http.kb_core_context import build_kb_core_context

router = APIRouter(tags=["knowledge-bases"])


class CreateEntityMergeReviewRequest(BaseModel):
    primary_id: str = Field(min_length=1)
    duplicate_ids: list[str] = Field(min_length=1)


class ResolveReviewRequest(BaseModel):
    rationale: str | None = None
    keeper_statement_id: str | None = Field(
        default=None,
        description="For `statement_conflict` approve: keep this statement and invalidate siblings (F-RUL-04).",
    )
    primary_id: str | None = Field(
        default=None,
        description="For `entity_cluster` approve: ledger entity id to keep as primary (F-GOV-04).",
    )


class ApproveReviewItemResponse(BaseModel):
    """Approve review item (merge, import, remember, …) including optional governance decision id."""

    model_config = ConfigDict(extra="allow")

    item: dict[str, Any]
    decision_id: str | None = None


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


@router.post("/{kb_id}/review/items/{item_id}/approve")
async def approve_review_item(
    kb_id: str,
    item_id: str,
    request: Request,
    body: ResolveReviewRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> ApproveReviewItemResponse:
    """
Approve Review Item. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_editor(request, user, kb_id, store)
    item = knowledge.get_review_item(kb_id, item_id)
    if item["status"] != "open":
        raise AdminError(409, "review_closed", "审核项已处理")

    merge_result: dict[str, Any] | None = None
    import_result: dict[str, Any] | None = None
    mapping_result: dict[str, Any] | None = None
    decision_id: str | None = None
    approve_action = "kb.graph.merge_approved"

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
            graph_decision_id = record_governance_decision_for_kb(
                request,
                kb_id,
                message="Review approve: entity_merge",
                detail={
                    "item_id": item_id,
                    "primary_id": primary_id,
                    "duplicate_ids": duplicate_ids,
                },
                actor_id=user.id,
            )
            decision_id = knowledge.record_agent_decision(
                kb_id,
                action="approve_entity_merge",
                review_item_id=item_id,
                rationale=body.rationale,
                trace={
                    "primary_id": primary_id,
                    "duplicate_ids": duplicate_ids,
                    "graph_decision_id": graph_decision_id,
                },
            )

            if _ledger_entity_merge_ids(knowledge, kb_id, primary_id, duplicate_ids):
                ledger_merges = [
                    knowledge.record_entity_merge(
                        kb_id,
                        source_entity_id=dup,
                        target_entity_id=primary_id,
                        actor_id=user.id,
                        why=body.rationale,
                        decision_id=decision_id,
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

                from basis.domain.kb.graph_sync import resolve_ledger_entity_id

                merge_body = MergeRequest.model_validate(payload)
                runtime = get_explorer_registry(request).get(request, kb_id)
                session = require_explorer_graph_session(runtime)
                primary_ledger = resolve_ledger_entity_id(
                    knowledge, kb_id, runtime.basis, primary_id
                )
                ledger_merges = []
                if primary_ledger:
                    for dup in duplicate_ids:
                        if dup != primary_ledger and knowledge.ledger_entity_exists(kb_id, dup):
                            ledger_merges.append(
                                knowledge.record_entity_merge(
                                    kb_id,
                                    source_entity_id=dup,
                                    target_entity_id=primary_ledger,
                                    actor_id=user.id,
                                    why=body.rationale,
                                    decision_id=decision_id,
                                )
                            )
                result = await invoke_explorer(
                    merge_nodes(merge_body, session=session),
                    context="enrich",
                )
                save_graph(request, kb_id)
                merge_result = result.model_dump() if hasattr(result, "model_dump") else dict(result)
                if ledger_merges:
                    merge_result = {**merge_result, "ledger_merges": ledger_merges}
                elif duplicate_ids:
                    merge_result = {
                        **merge_result,
                        "ledger_notice": "graph_only_merge",
                        "ledger_skipped_ids": duplicate_ids,
                    }
                merged_sources = {row["source_entity_id"] for row in ledger_merges}
                partial = [
                    dup
                    for dup in duplicate_ids
                    if primary_ledger and dup != primary_ledger and dup not in merged_sources
                ]
                if ledger_merges and partial:
                    merge_result = {
                        **merge_result,
                        "ledger_notice": "partial_ledger",
                        "ledger_skipped_ids": partial,
                    }
        elif item["kind"] == STATEMENT_REVIEW_KIND:
            decision_id = record_governance_decision_for_kb(
                request,
                kb_id,
                message="Review approve: statement_remember",
                detail={"item_id": item_id},
                actor_id=user.id,
            )
            audit_extra = {"decision_id": decision_id} if decision_id else None
            result = approve_statement_remember_review(
                knowledge=knowledge,
                store=store,
                user=user,
                kb_id=kb_id,
                item_id=item_id,
                rationale=body.rationale,
                rebuild_projection=lambda: rebuild_kb_projection(request, kb_id),
                audit_extra=audit_extra,
            )
            return {
                "item": result["item"],
                "merge": result.get("merge"),
                "import": None,
                "mapping": None,
                "decision_id": decision_id,
            }
        elif item["kind"] == ENTITY_CLUSTER_KIND:
            payload = dict(item.get("payload") or {})
            entity_ids = list(payload.get("entity_ids") or [])
            primary_id = str(
                body.primary_id
                or payload.get("suggested_primary_id")
                or (entity_ids[0] if entity_ids else "")
            )
            duplicate_ids = [eid for eid in entity_ids if eid != primary_id]
            if not primary_id or not duplicate_ids:
                raise AdminError(422, "bad_cluster", "实体聚类无效")
            subject_id = KnowledgeStore.merge_review_subject_key(primary_id, duplicate_ids)
            merge_item = knowledge.create_review_item(
                kb_id,
                kind="entity_merge",
                subject_type="graph_nodes",
                subject_id=subject_id,
                payload={"primary_id": primary_id, "duplicate_ids": duplicate_ids},
            )
            approve_action = "kb.entity.cluster_promoted"
            merge_result = {
                "status": "promoted",
                "entity_merge_item_id": merge_item["id"],
                "payload": payload,
            }
        elif item["kind"] == LOW_CONFIDENCE_KIND:
            payload = dict(item.get("payload") or {})
            statement_id = str(payload.get("statement_id") or item["subject_id"])
            resolution = resolve_low_confidence_approve(knowledge, kb_id, statement_id)
            rebuild_kb_projection(request, kb_id)
            approve_action = "kb.statement.low_confidence_confirmed"
            merge_result = {"status": "confirmed", "resolution": resolution, "payload": payload}
        elif item["kind"] == STATEMENT_CONFLICT_KIND:
            payload = dict(item.get("payload") or {})
            statement_ids = list(payload.get("statement_ids") or [])
            if body.keeper_statement_id:
                resolution = resolve_statement_conflict_group(
                    knowledge,
                    kb_id,
                    statement_ids,
                    body.keeper_statement_id,
                )
                rebuild_kb_projection(request, kb_id)
                approve_action = "kb.statement.conflict_resolved"
                merge_result = {
                    "status": "resolved",
                    "resolution": resolution,
                    "payload": payload,
                }
            else:
                approve_action = "kb.statement.conflict_acknowledged"
                merge_result = {"status": "acknowledged", "payload": payload}
        elif item["kind"] == "connector_writeback":
            from basis.domain.connectors import ConnectorRuntime
            from basis.domain.kb.connector_sync import ConnectorLedgerSyncService

            approve_action = "kb.connector.writeback_approved"
            outbox_id = str((item.get("payload") or {}).get("outbox_id") or item["subject_id"])
            sync_svc = ConnectorLedgerSyncService(
                knowledge._conn, ConnectorRuntime(knowledge._conn)
            )
            executed_outbox = sync_svc.approve_and_execute_outbox(
                kb_id,
                outbox_id,
                actor_id=user.id,
                rationale=body.rationale or "Approved connector writeback",
            )
            rebuild_kb_projection(request, kb_id)
            decision_id = executed_outbox.get("decision_id")
            resolved_item = knowledge.get_review_item(kb_id, item_id)
            audit_kb_graph(
                store,
                user,
                kb_id,
                approve_action,
                review_item_id=item_id,
                extra={
                    "outbox_id": outbox_id,
                    "decision_id": decision_id,
                    "rationale": body.rationale,
                },
            )
            return {
                "item": resolved_item,
                "merge": None,
                "import": None,
                "mapping": None,
                "outbox": executed_outbox,
                "decision_id": decision_id,
            }
        elif item["kind"] == "graph_import":
            from semantica.explorer.routes.export_import import import_file

            approve_action = "kb.graph.import"
            runtime = get_explorer_registry(request).get(request, kb_id)
            session = require_explorer_graph_session(runtime)
            upload = upload_file_from_staged(get_blob_store(request), kb_id, item["payload"])
            result = await invoke_explorer(
                import_file(file=upload, session=session),
                context="enrich",
            )
            save_graph(request, kb_id)
            import_result = result.model_dump() if hasattr(result, "model_dump") else dict(result)
            discard_staged_import(get_blob_store(request), kb_id, item["payload"])
        else:
            raise AdminError(422, "unsupported_review_kind", f"不支持的审核类型: {item['kind']}")

        if decision_id is None:
            decision_id = record_governance_decision_for_kb(
                request,
                kb_id,
                message=f"Review approve: {item['kind']}",
                detail={"item_id": item_id, "kind": item.get("kind")},
                actor_id=user.id,
            )

        resolved = knowledge.resolve_review_item(
            kb_id,
            item_id,
            status="approved",
            resolved_by=user.id,
            rationale=body.rationale,
        )
        audit_extra: dict[str, Any] = {
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
        }
        if decision_id:
            audit_extra["decision_id"] = decision_id
        audit_kb_graph(
            store,
            user,
            kb_id,
            approve_action,
            review_item_id=item_id,
            extra=audit_extra,
        )
        return {
            "item": resolved,
            "merge": merge_result,
            "import": import_result,
            "mapping": mapping_result,
            "decision_id": decision_id,
        }
    except HTTPException as exc:
        mapped = admin_error_from_explorer_http(exc, context="enrich")
        maybe_emit_governance_tripped_on_review_approve(
            request,
            kb_id,
            knowledge,
            code=mapped.code,
            message=mapped.message,
            detail={
                "item_id": item_id,
                "kind": item.get("kind"),
                "source": "review_approve",
            },
            actor_id=user.id,
        )
        raise mapped
    except AdminError as exc:
        maybe_emit_governance_tripped_on_review_approve(
            request,
            kb_id,
            knowledge,
            code=exc.code,
            message=exc.message,
            detail={
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
    """
Reject Review Item. Human review queue for merges, imports, and conflicts. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
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
        return reject_statement_remember_review(
            knowledge=knowledge,
            store=store,
            user=user,
            kb_id=kb_id,
            item_id=item_id,
            rationale=body.rationale,
        )
    elif item.get("kind") == "connector_writeback":
        outbox_id = str((item.get("payload") or {}).get("outbox_id") or item["subject_id"])
        knowledge._conn.execute(
            "UPDATE entity_sync_outbox SET status = 'rejected' WHERE id = ? AND kb_id = ?",
            (outbox_id, kb_id),
        )
        knowledge._conn.commit()
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
    elif item.get("kind") == ENTITY_CLUSTER_KIND:
        reject_action = "kb.entity.cluster_dismissed"
    elif item.get("kind") == LOW_CONFIDENCE_KIND:
        payload = dict(item.get("payload") or {})
        statement_id = str(payload.get("statement_id") or item["subject_id"])
        resolve_low_confidence_reject(knowledge, kb_id, statement_id)
        rebuild_kb_projection(request, kb_id)
        reject_action = "kb.statement.low_confidence_rejected"
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
    """
List Kb Graph Audit. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    prefix = action_prefix.strip() or "kb.graph."
    events = store.list_audit_for_kb(kb_id, action_prefix=prefix, limit=limit)
    return {"events": events}
