"""Detect conflicting open statements and enqueue governance review (F-RUL-04 MVP)."""

from __future__ import annotations

import hashlib
from collections import defaultdict
from typing import Any

from basis.platform.admin.errors import AdminError
from basis.domain.kb.services.kb_alerts_emit import emit_statement_conflict_alert
from basis.domain.kb.store import KnowledgeStore

STATEMENT_CONFLICT_KIND = "statement_conflict"
STATEMENT_CONFLICT_SUBJECT_TYPE = "statement_group"


def _normalize_surface(phrase: str) -> str:
    return " ".join((phrase or "").strip().lower().split())


def _object_key(row: dict[str, Any]) -> str:
    if row.get("object_entity_id"):
        return f"entity:{row['object_entity_id']}"
    return f"value:{row.get('object_value')}"


def find_statement_conflict_groups(knowledge: KnowledgeStore, kb_id: str) -> list[dict[str, Any]]:
    rows = knowledge.list_active_statements(kb_id)
    buckets: dict[tuple[str, str], list[dict[str, Any]]] = defaultdict(list)
    for row in rows:
        key = (row["subject_id"], _normalize_surface(row["surface_phrase"]))
        buckets[key].append(row)

    groups: list[dict[str, Any]] = []
    for (subject_id, surface_norm), members in buckets.items():
        object_keys = {_object_key(m) for m in members}
        if len(object_keys) < 2:
            continue
        statement_ids = sorted(m["statement_id"] for m in members)
        groups.append(
            {
                "subject_id": subject_id,
                "surface_phrase": members[0]["surface_phrase"],
                "surface_normalized": surface_norm,
                "statement_ids": statement_ids,
                "objects": [
                    {
                        "statement_id": m["statement_id"],
                        "object_entity_id": m.get("object_entity_id"),
                        "object_value": m.get("object_value"),
                        "status": m.get("status"),
                    }
                    for m in members
                ],
            }
        )
    return groups


def scan_statement_conflicts(knowledge: KnowledgeStore, kb_id: str) -> dict[str, Any]:
    """Enqueue open review items for each conflicting statement group."""
    created: list[str] = []
    skipped = 0
    for group in find_statement_conflict_groups(knowledge, kb_id):
        subject_id = hashlib.sha256(
            ":".join(group["statement_ids"]).encode()
        ).hexdigest()[:32]
        try:
            item = knowledge.create_review_item(
                kb_id,
                kind=STATEMENT_CONFLICT_KIND,
                subject_type=STATEMENT_CONFLICT_SUBJECT_TYPE,
                subject_id=subject_id,
                payload=group,
                priority=5,
            )
            created.append(item["id"])
            emit_statement_conflict_alert(
                knowledge,
                kb_id,
                review_item_id=item["id"],
                surface_phrase=str(group.get("surface_phrase") or ""),
                statement_ids=list(group.get("statement_ids") or []),
            )
        except AdminError as exc:
            if exc.code == "review_exists":
                skipped += 1
                continue
            raise
    return {"created": len(created), "skipped": skipped, "item_ids": created}


def resolve_statement_conflict_group(
    knowledge: KnowledgeStore,
    kb_id: str,
    statement_ids: list[str],
    keeper_statement_id: str,
) -> dict[str, Any]:
    """Keep one open statement and invalidate the rest in a conflict group."""
    if not statement_ids:
        raise AdminError(422, "bad_conflict_group", "冲突组缺少陈述 id")
    if keeper_statement_id not in statement_ids:
        raise AdminError(422, "bad_keeper", "keeper_statement_id 不在冲突组内")
    invalidated: list[str] = []
    for statement_id in statement_ids:
        if statement_id == keeper_statement_id:
            continue
        knowledge.invalidate_statement(kb_id, statement_id)
        invalidated.append(statement_id)
    return {
        "keeper_statement_id": keeper_statement_id,
        "invalidated_statement_ids": invalidated,
    }
