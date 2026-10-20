"""KB projected graph read API and chunk search — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.graph.models import (
    GraphSearchRequest,
    ResolveNodeLabelsRequest,
    SearchConfigRequest,
    SearchReindexRequest,
)
from basis.api.http.routes.v1.kb.graph.read import router as read_router
from basis.api.http.routes.v1.kb.graph.search import router as search_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(read_router)
router.include_router(search_router)

__all__ = [
    "GraphSearchRequest",
    "ResolveNodeLabelsRequest",
    "SearchConfigRequest",
    "SearchReindexRequest",
    "router",
]
