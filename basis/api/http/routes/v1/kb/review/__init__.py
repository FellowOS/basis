"""KB review queue — aggregates sub-routers (Gate D)."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.review.audit import router as audit_router
from basis.api.http.routes.v1.kb.review.queue import (
    CreateEntityMergeReviewRequest,
    propose_entity_merge,
    router as queue_router,
)
from basis.api.http.routes.v1.kb.review.resolve import router as resolve_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(queue_router)
router.include_router(resolve_router)
router.include_router(audit_router)

__all__ = ["CreateEntityMergeReviewRequest", "propose_entity_merge", "router"]
