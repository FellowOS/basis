"""Agent governor batch pass (F-GOV-04 Phase A)."""

from __future__ import annotations

from typing import Any

from basis.platform.admin.errors import AdminError
from basis.domain.kb.services.conflict_review import scan_statement_conflicts
from basis.domain.kb.governance_config import DEFAULT_GOVERNOR_CONFIDENCE_MIN
from basis.domain.kb.services.governor_cluster import scan_entity_label_clusters
from basis.domain.kb.store import KnowledgeStore

LOW_CONFIDENCE_KIND = "low_confidence"
LOW_CONFIDENCE_SUBJECT_TYPE = "statement"


def scan_low_confidence_statements(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    confidence_min: float,
) -> dict[str, Any]:
    """Enqueue open review items for active statements below ``confidence_min``."""
    if not 0.0 <= confidence_min <= 1.0:
        raise AdminError(422, "bad_confidence_min", "confidence_min 须在 0–1 之间")
    created: list[str] = []
    skipped = 0
    for row in knowledge.list_active_statements_below_confidence(kb_id, confidence_min):
        statement_id = str(row["statement_id"])
        try:
            item = knowledge.create_review_item(
                kb_id,
                kind=LOW_CONFIDENCE_KIND,
                subject_type=LOW_CONFIDENCE_SUBJECT_TYPE,
                subject_id=statement_id,
                payload={
                    "statement_id": statement_id,
                    "subject_id": row.get("subject_id"),
                    "surface_phrase": row.get("surface_phrase"),
                    "confidence": row.get("confidence"),
                    "confidence_min": confidence_min,
                    "status": row.get("status"),
                },
                priority=3,
            )
            created.append(item["id"])
        except AdminError as exc:
            if exc.code == "review_exists":
                skipped += 1
                continue
            raise
    return {"created": len(created), "skipped": skipped, "item_ids": created}


def run_governor_pass(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    confidence_min: float | None = None,
) -> dict[str, Any]:
    """Run conflict scan + low-confidence enqueue (on-demand governor)."""
    if confidence_min is None:
        threshold = knowledge.get_governance_config(kb_id).governor_confidence_min
    else:
        threshold = confidence_min
    conflicts = scan_statement_conflicts(knowledge, kb_id)
    low_confidence = scan_low_confidence_statements(
        knowledge,
        kb_id,
        confidence_min=threshold,
    )
    entity_clusters = scan_entity_label_clusters(knowledge, kb_id)
    return {
        "confidence_min": threshold,
        "conflicts": {
            "created": conflicts.get("created", 0),
            "skipped": conflicts.get("skipped", 0),
        },
        "low_confidence": {
            "created": low_confidence.get("created", 0),
            "skipped": low_confidence.get("skipped", 0),
        },
        "entity_clusters": {
            "created": entity_clusters.get("created", 0),
            "skipped": entity_clusters.get("skipped", 0),
        },
    }


def resolve_low_confidence_approve(
    knowledge: KnowledgeStore,
    kb_id: str,
    statement_id: str,
) -> dict[str, Any]:
    """Accept a low-confidence statement (confirm if still pending)."""
    row = knowledge.get_statement_browse(kb_id, statement_id=statement_id)
    if row is None:
        raise AdminError(404, "not_found", "陈述不存在或已失效")
    if row.get("status") == "pending":
        knowledge.set_statement_status(kb_id, statement_id, "confirmed")
    return {"statement_id": statement_id, "action": "confirmed"}


def resolve_low_confidence_reject(
    knowledge: KnowledgeStore,
    kb_id: str,
    statement_id: str,
) -> dict[str, Any]:
    """Reject a low-confidence statement."""
    knowledge.invalidate_statement(kb_id, statement_id)
    return {"statement_id": statement_id, "action": "invalidated"}
