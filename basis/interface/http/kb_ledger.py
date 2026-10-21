"""Ledger helpers for workspace manage console — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_ledger_models import RememberProposalRequest
from basis.interface.http.kb_ledger_mutations import router as mutations_router
from basis.interface.http.kb_ledger_read import router as read_router
from basis.interface.http.kb_ledger_remember import router as remember_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(remember_router)
router.include_router(read_router)
router.include_router(mutations_router)

__all__ = ["RememberProposalRequest", "router"]
