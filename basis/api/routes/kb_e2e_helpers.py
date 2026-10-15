"""Playwright-only helpers (disabled unless BASIS_DATA_DIR is the e2e data dir)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Request

from basis.admin.errors import AdminError
from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_kb_for_editor, get_knowledge_store, get_store
from basis.config import Settings
from basis.explorer.governance_decision import emit_governance_tripped_for_kb
from basis.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


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
