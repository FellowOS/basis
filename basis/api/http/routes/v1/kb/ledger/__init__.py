"""Ledger helpers for KB manage workspaces — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.ledger.models import RememberProposalRequest
from basis.api.http.routes.v1.kb.ledger.mutations import router as mutations_router
from basis.api.http.routes.v1.kb.ledger.read import router as read_router
from basis.api.http.routes.v1.kb.ledger.remember import router as remember_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(remember_router)
router.include_router(read_router)
router.include_router(mutations_router)

__all__ = ["RememberProposalRequest", "router"]
