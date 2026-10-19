"""KB governance governor (F-GOV-04 Phase A)."""

from __future__ import annotations

from typing import Any

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.domain.kb.governor import run_governor_pass
from basis.domain.kb.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


class GovernanceConfigRequest(BaseModel):
    governor_enabled: bool = False
    governor_interval_minutes: int = Field(default=1440, ge=0, le=10_080)
    governor_confidence_min: float = Field(default=0.75, ge=0.0, le=1.0)


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
    result = run_governor_pass(knowledge, kb_id, confidence_min=confidence_min)
    knowledge.touch_governor_last_run(kb_id, datetime.now(timezone.utc).isoformat())
    return result


@router.get("/{kb_id}/governance/config")
async def get_kb_governance_config(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Kb Governance Config. Per-KB governor schedule and confidence threshold (F-GOV-04). Requires KB viewer+.
    """
    get_kb_for_viewer(request, user, kb_id, store)
    config = knowledge.get_governance_config(kb_id)
    return {"config": config.public_dict()}


@router.put("/{kb_id}/governance/config")
async def update_kb_governance_config(
    kb_id: str,
    request: Request,
    body: GovernanceConfigRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Kb Governance Config Update. Enable scheduled governor passes (requires BASIS_GOVERNOR_TICK_SECONDS). Requires KB admin.
    """
    get_kb_for_editor(request, user, kb_id, store)
    config = knowledge.update_governance_config(
        kb_id,
        governor_enabled=body.governor_enabled,
        governor_interval_minutes=body.governor_interval_minutes,
        governor_confidence_min=body.governor_confidence_min,
    )
    return {"config": config.public_dict()}
