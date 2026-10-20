"""KB ingest source connectors — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.sources.crud import router as crud_router
from basis.api.http.routes.v1.kb.sources.ingest import router as ingest_router
from basis.api.http.routes.v1.kb.sources.models import (
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
