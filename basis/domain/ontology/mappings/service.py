"""Mapping proposals, materialization, and review-queue integration."""

from __future__ import annotations

from typing import Any, Literal

from basis.domain.errors import AdminError
from basis.domain.graph.projection.projection_lifecycle import GraphProjectionBindings, rebuild_kb_projection
from basis.domain.knowledge.ports.platform import KbAuditActor, KbAuditStore
from basis.domain.knowledge.services.graph_audit import audit_kb_graph
from basis.domain.knowledge.store import KnowledgeStore

MAPPING_REVIEW_KIND = "ontology_mapping"
MAPPING_REVIEW_SUBJECT_TYPE = "mapping"


def mapping_review_payload(mapping: dict[str, Any]) -> dict[str, Any]:
    return {
        "mapping_id": mapping["id"],
        "signature": mapping["signature"],
        "target_uri": mapping.get("target_uri"),
        "target_kind": mapping.get("target_kind"),
        "direction": mapping.get("direction"),
        "status": mapping.get("status"),
    }


def ensure_mapping_review_item(knowledge: KnowledgeStore, kb_id: str, mapping: dict[str, Any]) -> None:
    if mapping.get("status") != "proposed":
        return
    try:
        knowledge.create_review_item(
            kb_id,
            kind=MAPPING_REVIEW_KIND,
            subject_type=MAPPING_REVIEW_SUBJECT_TYPE,
            subject_id=mapping["id"],
            payload=mapping_review_payload(mapping),
        )
    except AdminError as exc:
        if exc.code != "review_exists":
            raise


def close_mapping_review_if_open(
    knowledge: KnowledgeStore,
    kb_id: str,
    mapping_id: str,
    *,
    resolved_by: str,
    review_status: Literal["approved", "rejected"],
    rationale: str | None = None,
) -> None:
    item = knowledge.find_open_review_item(
        kb_id,
        kind=MAPPING_REVIEW_KIND,
        subject_type=MAPPING_REVIEW_SUBJECT_TYPE,
        subject_id=mapping_id,
    )
    if item is None:
        return
    knowledge.resolve_review_item(
        kb_id,
        item["id"],
        status=review_status,
        resolved_by=resolved_by,
        rationale=rationale,
    )


def apply_mapping_status_change(
    kb_id: str,
    mapping_id: str,
    actor: KbAuditActor,
    store: KbAuditStore,
    knowledge: KnowledgeStore,
    *,
    status: Literal["confirmed", "rejected", "superseded"],
    why: str | None = None,
    sync_review: bool = True,
    projection_bindings: GraphProjectionBindings | None = None,
) -> dict[str, Any]:
    mapping = knowledge.update_mapping_status(
        kb_id,
        mapping_id,
        actor.id,
        status=status,
        why=why,
    )
    materialized: dict[str, Any] | None = None
    projection: dict[str, Any] | None = None
    if status == "confirmed":
        materialized = knowledge.materialize_mapping_facts(kb_id, mapping_id)
        if materialized.get("created", 0) > 0 and projection_bindings is not None:
            projection = rebuild_kb_projection(projection_bindings, kb_id)
    if sync_review and status in {"confirmed", "rejected"}:
        close_mapping_review_if_open(
            knowledge,
            kb_id,
            mapping_id,
            resolved_by=actor.id,
            review_status="approved" if status == "confirmed" else "rejected",
            rationale=why,
        )
    audit_kb_graph(
        store,
        actor,
        kb_id,
        "kb.mapping.status",
        extra={
            "mapping_id": mapping_id,
            "status": status,
            "materialized": materialized,
        },
    )
    return {"mapping": mapping, "materialized": materialized, "projection": projection}
