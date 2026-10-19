"""KB governance governor (F-GOV-04 Phase A)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_knowledge_store,
    get_store,
)
from basis.domain.kb.governor import run_governor_pass
from basis.domain.kb.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


class GovernorRunRequest(BaseModel):
    confidence_min: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Override default governor confidence threshold (0.75).",
    )


@router.post("/{kb_id}/governance/governor/run")
async def kb_governance_governor_run(
    kb_id: str,
    request: Request,
    body: GovernorRunRequest | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Kb Governance Governor Run. Batch conflict scan and low-confidence review enqueue (F-GOV-04). Requires KB editor+.
    """
    get_kb_for_editor(request, user, kb_id, store)
    confidence_min = body.confidence_min if body else None
    return run_governor_pass(knowledge, kb_id, confidence_min=confidence_min)
