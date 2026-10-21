"""Remember proposal route (integration core)."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import get_current_user, get_store
from basis.interface.http.kb_core_context import build_kb_core_context
from basis.application.operation_http import http_response_from_payload
from basis.application.registry import run
from basis.interface.http.kb_ledger_models import RememberProposalRequest

router = APIRouter(tags=["knowledge-bases"])

@router.post("/{kb_id}/remember/proposals")
async def create_remember_proposal(
    kb_id: str,
    body: RememberProposalRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """Propose a canonical fact for human review (integration core `propose_remember`)."""
    ctx = build_kb_core_context(
        request,
        kb_id=kb_id,
        user=user,
        store=store,
        require_editor=True,
    )
    payload = await asyncio.to_thread(
        run,
        ctx,
        "propose_remember",
        {"content": body.content, "source": "api"},
    )
    return http_response_from_payload(payload)

