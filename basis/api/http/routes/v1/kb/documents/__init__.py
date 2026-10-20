"""KB documents, processing jobs, and legacy ontology create — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.documents.crud import router as crud_router
from basis.api.http.routes.v1.kb.documents.jobs import (
    router as jobs_router,
    start_processing_job,
)
from basis.api.http.routes.v1.kb.documents.models import (
    AppendTextVersionRequest,
    CreateOntologyRequest,
    IngestTextRequest,
    RetryProcessingRequest,
    StartProcessingRequest,
)
from basis.api.http.routes.v1.kb.documents.ontology import router as ontology_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(crud_router)
router.include_router(jobs_router)
router.include_router(ontology_router)

__all__ = [
    "AppendTextVersionRequest",
    "CreateOntologyRequest",
    "IngestTextRequest",
    "RetryProcessingRequest",
    "StartProcessingRequest",
    "router",
    "start_processing_job",
]
