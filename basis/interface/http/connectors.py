"""Workspace Basis Open Connector Protocol (BOCP) routes — aggregates sub-routers."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.connectors_catalog import router as catalog_router
from basis.interface.http.connectors_connections import router as connections_router
from basis.interface.http.connectors_mappings import router as mappings_router
from basis.interface.http.connectors_oauth import router as oauth_router
from basis.interface.http.connectors_outbox import router as outbox_router
from basis.interface.http.connectors_tools import router as tools_router
from basis.interface.http.connectors_integration import router as connectors_integration_router

router = APIRouter(tags=["workspaces"])
router.include_router(catalog_router)
router.include_router(connectors_integration_router)
router.include_router(connections_router)
router.include_router(mappings_router)
router.include_router(outbox_router)
router.include_router(oauth_router)
router.include_router(tools_router)

__all__ = ["router"]
