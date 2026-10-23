"""Workspace governance governor (F-GOV-04 Phase A)."""

from __future__ import annotations

from typing import Any

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.domain.graph.session.guard import require_graph_session
from basis.domain.knowledge.services.governor import run_governor_pass
from basis.domain.knowledge.services.governor_graph_dedup import (
    DEFAULT_GOVERNOR_DEDUP_THRESHOLD,
    scan_graph_semantic_dedup_clusters,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.shared.deps import (
    get_current_user,
    graph_runtime_for,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
)

router = APIRouter(tags=["workspaces"])


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
    dedup_threshold: float | None = Field(
        default=None,
        ge=0.0,
        le=1.0,
        description="Graph semantic dedup similarity threshold (default 0.8).",
    )


@router.post("/{workspace_id}/governance/governor/run")
async def governance_governor_run(
    workspace_id: str,
    request: Request,
    body: GovernorRunRequest | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Governance Governor Run. Batch conflict scan and low-confidence review enqueue (F-GOV-04). Requires workspace editor+.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    confidence_min = body.confidence_min if body else None
    dedup_threshold = (
        body.dedup_threshold if body and body.dedup_threshold is not None else DEFAULT_GOVERNOR_DEDUP_THRESHOLD
    )
    result = run_governor_pass(knowledge, workspace_id, confidence_min=confidence_min)
    graph_dedup: dict[str, Any] = {"created": 0, "skipped": 0}
    try:
        runtime = graph_runtime_for(request, workspace_id)
        session = require_graph_session(runtime)
        graph_dedup = await scan_graph_semantic_dedup_clusters(
            knowledge,
            workspace_id,
            session,
            threshold=dedup_threshold,
        )
    except AdminError as exc:
        if exc.code == "graph_runtime_unavailable":
            graph_dedup = {**graph_dedup, "unavailable": True}
        else:
            raise
    result = {**result, "graph_dedup_clusters": graph_dedup, "dedup_threshold": dedup_threshold}
    knowledge.touch_governor_last_run(workspace_id, datetime.now(timezone.utc).isoformat())
    return result


@router.get("/{workspace_id}/governance/config")
async def get_governance_config(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Governance Config. Per-workspace governor schedule and confidence threshold (F-GOV-04). Requires workspace viewer+.
    """
    get_workspace_for_viewer(request, user, workspace_id, store)
    config = knowledge.get_governance_config(workspace_id)
    return {"config": config.public_dict()}


@router.put("/{workspace_id}/governance/config")
async def update_governance_config(
    workspace_id: str,
    request: Request,
    body: GovernanceConfigRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """
Governance Config Update. Enable scheduled governor passes (requires BASIS_GOVERNOR_TICK_SECONDS). Requires workspace admin.
    """
    get_workspace_for_editor(request, user, workspace_id, store)
    config = knowledge.update_governance_config(
        workspace_id,
        governor_enabled=body.governor_enabled,
        governor_interval_minutes=body.governor_interval_minutes,
        governor_confidence_min=body.governor_confidence_min,
    )
    return {"config": config.public_dict()}
