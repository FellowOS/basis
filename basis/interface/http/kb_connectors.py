"""KB Basis Open Connector Protocol (BOCP) routes — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_connectors_catalog import router as catalog_router
from basis.interface.http.kb_connectors_connections import router as connections_router
from basis.interface.http.kb_connectors_mappings import router as mappings_router
from basis.interface.http.kb_connectors_oauth import router as oauth_router
from basis.interface.http.kb_connectors_outbox import router as outbox_router
from basis.interface.http.kb_connectors_tools import router as tools_router

router = APIRouter(tags=["knowledge-bases"])
router.include_router(catalog_router)
router.include_router(connections_router)
router.include_router(mappings_router)
router.include_router(outbox_router)
router.include_router(oauth_router)
router.include_router(tools_router)

__all__ = ["router"]
