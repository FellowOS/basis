"""KB graph workspace query surface — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_graph_workspace_decisions import router as decisions_router
from basis.interface.http.kb_graph_workspace_graph_io import router as graph_io_router
from basis.interface.http.kb_graph_workspace_reasoning import router as reasoning_router
from basis.interface.http.kb_graph_workspace_semantic import router as semantic_router
from basis.interface.http.kb_graph_workspace_sparql import router as sparql_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(sparql_router)
router.include_router(semantic_router)
router.include_router(decisions_router)
router.include_router(reasoning_router)
router.include_router(graph_io_router)

__all__ = ["router"]
