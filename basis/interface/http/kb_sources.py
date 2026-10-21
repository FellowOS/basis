"""KB ingest source connectors — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_sources_crud import router as crud_router
from basis.interface.http.kb_sources_ingest import router as ingest_router
from basis.interface.http.kb_sources_models import (
    CreateIngestSourceRequest,
    SyncIngestSourceRequest,
    UpdateIngestSourceRequest,
    WebhookIngestRequest,
)

router = APIRouter(tags=["knowledge-bases"])
router.include_router(crud_router)
router.include_router(ingest_router)

__all__ = [
    "CreateIngestSourceRequest",
    "SyncIngestSourceRequest",
    "UpdateIngestSourceRequest",
    "WebhookIngestRequest",
    "router",
]
