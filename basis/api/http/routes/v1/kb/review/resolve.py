"""KB review approve / reject — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.review.resolve_approve import router as approve_router
from basis.api.http.routes.v1.kb.review.resolve_reject import router as reject_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(approve_router)
router.include_router(reject_router)

__all__ = ["router"]
