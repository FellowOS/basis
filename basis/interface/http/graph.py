"""Workspace projected graph read API and chunk search — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.graph_models import (
    GraphSearchRequest,
    ResolveNodeLabelsRequest,
    SearchConfigRequest,
    SearchReindexRequest,
)
from basis.interface.http.graph_read import router as read_router
from basis.interface.http.graph_search import router as search_router

router = APIRouter(tags=["workspaces"])
router.include_router(read_router)
router.include_router(search_router)

__all__ = [
    "GraphSearchRequest",
    "ResolveNodeLabelsRequest",
    "SearchConfigRequest",
    "SearchReindexRequest",
    "router",
]
