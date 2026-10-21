"""Workspace-scoped vocabulary and ontology-hub — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_ontology_hub import register_kb_ontology_hub_routes
from basis.interface.http.kb_ontology_alignments import router as alignments_router
from basis.interface.http.kb_ontology_vocabulary import router as vocabulary_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(vocabulary_router)
router.include_router(alignments_router)
register_kb_ontology_hub_routes(router)

__all__ = ["router"]
