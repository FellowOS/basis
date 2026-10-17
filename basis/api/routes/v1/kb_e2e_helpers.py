"""Playwright-only helpers (disabled unless BASIS_DATA_DIR is the e2e data dir)."""

from __future__ import annotations

from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from basis.admin.errors import AdminError
from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_kb_for_editor, get_knowledge_store, get_store
from basis.config import Settings
from basis.explorer.governance_decision import emit_governance_tripped_for_kb
from basis.knowledge.conflict_review import scan_statement_conflicts
from basis.knowledge.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


def _e2e_helpers_enabled(request: Request) -> bool:
    settings: Settings = request.app.state.settings
    return settings.data_dir.name == "data-e2e"


@router.post("/{kb_id}/_e2e/governance-trip")
async def e2e_governance_trip(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, str | None]:
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_kb_for_editor(request, user, kb_id, store)
    decision_id = emit_governance_tripped_for_kb(
        request,
        kb_id,
        knowledge,
        message="E2E governance gate trip",
        detail={"source": "e2e_governance_trip"},
        actor_id=user.id,
    )
    return {"decision_id": decision_id}


@router.post("/{kb_id}/_e2e/statement-conflict")
async def e2e_statement_conflict(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, object]:
    """Seed conflicting ledger statements and run conflict scan (Playwright / data-e2e only)."""
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_kb_for_editor(request, user, kb_id, store)

    _, version_id, _, _ = knowledge.store_upload_bytes(
        kb_id,
        title="e2e-conflict.txt",
        mime_type="text/plain",
        data=b"e2e",
        created_by=user.id,
        external_key=f"e2e-conflict-{uuid4().hex}",
    )
    chunk_id = knowledge.create_chunk(kb_id, version_id, ordinal=0, text="e2e evidence")
    knowledge.set_version_status(kb_id, version_id, "ready")

    subject_id = knowledge.create_entity(kb_id, canonical_label="E2E conflict subject")
    object_a = knowledge.create_entity(kb_id, canonical_label="E2E conflict object A")
    object_b = knowledge.create_entity(kb_id, canonical_label="E2E conflict object B")
    surface = f"e2e_predicate_{uuid4().hex[:10]}"
    for obj_id in (object_a, object_b):
        knowledge.add_open_statement(
            kb_id,
            subject_id=subject_id,
            surface_phrase=surface,
            object_entity_id=obj_id,
            object_value=None,
            status="confirmed",
            proposed_by=user.id,
            chunk_id=chunk_id,
            quote=surface,
        )

    scan = scan_statement_conflicts(knowledge, kb_id)
    item_ids = scan.get("item_ids") or []
    review_item_id = item_ids[0] if item_ids else None
    return {
        "review_item_id": review_item_id,
        "surface_phrase": surface,
        "scan": scan,
    }
