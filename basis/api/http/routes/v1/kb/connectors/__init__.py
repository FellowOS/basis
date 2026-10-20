"""KB Basis Open Connector Protocol (BOCP) routes — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.connectors.catalog import router as catalog_router
from basis.api.http.routes.v1.kb.connectors.connections import router as connections_router
from basis.api.http.routes.v1.kb.connectors.mappings import router as mappings_router
from basis.api.http.routes.v1.kb.connectors.oauth import router as oauth_router
from basis.api.http.routes.v1.kb.connectors.outbox import router as outbox_router
from basis.api.http.routes.v1.kb.connectors.tools import router as tools_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(catalog_router)
router.include_router(connections_router)
router.include_router(mappings_router)
router.include_router(outbox_router)
router.include_router(oauth_router)
router.include_router(tools_router)

__all__ = ["router"]
