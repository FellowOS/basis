"""Platform authentication: password session and federated login (OAuth, OIDC, SAML, magic link)."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.platform.auth.bootstrap import router as bootstrap_router
from basis.api.http.routes.v1.platform.auth.magic_link import router as magic_link_router
from basis.api.http.routes.v1.platform.auth.oidc import router as oidc_router
from basis.api.http.routes.v1.platform.auth.saml import router as saml_router
from basis.api.http.routes.v1.platform.auth.session import router as session_router
from basis.api.http.routes.v1.platform.auth.social import router as social_router

router = APIRouter(tags=["auth"])
router.include_router(session_router)
router.include_router(bootstrap_router)
router.include_router(social_router)
router.include_router(oidc_router)
router.include_router(saml_router)
router.include_router(magic_link_router)

__all__ = ["router"]
