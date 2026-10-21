"""Register v1 API routers (optional duplicate legacy prefix)."""

from __future__ import annotations

from fastapi import FastAPI

from basis.api.http.routes.v1 import users
from basis.api.http.routes.v1.kb import alerts as kb_alerts
from basis.api.http.routes.v1.kb import connectors as kb_connectors
from basis.api.http.routes.v1.kb import e2e_helpers as kb_e2e_helpers
from basis.api.http.routes.v1.kb import governance as kb_governance
from basis.api.http.routes.v1.kb import mappings as kb_mappings
from basis.api.http.routes.v1.kb import reasoning_rules as kb_reasoning_rules
from basis.api.http.routes.v1.kb.workspace import kbs
from basis.api.http.routes.v1.kb.workspace import tokens as kb_tokens
from basis.api.http.routes.v1.kb import documents as kb_documents
from basis.api.http.routes.v1.kb import explorer as kb_explorer_query
from basis.api.http.routes.v1.kb.explorer import governance as kb_explorer_governance
from basis.api.http.routes.v1.kb.explorer import staging as kb_explorer_staging
from basis.api.http.routes.v1.kb.explorer import temporal as kb_explorer_temporal
from basis.api.http.routes.v1.kb import graph as kb_graph
from basis.api.http.routes.v1.kb import ledger as kb_ledger
from basis.api.http.routes.v1.kb import ontology as kb_ontology
from basis.api.http.routes.v1.kb import review as kb_review
from basis.api.http.routes.v1.kb import sources as kb_sources
from basis.api.http.routes.v1.platform import audit
from basis.api.http.routes.v1.platform import auth
from basis.api.http.routes.v1.platform import mcp
from basis.api.http.routes.v1.platform import model_providers
from basis.api.http.routes.v1.platform import models as models_routes
from basis.api.http.routes.v1.platform import oauth
from basis.api.http.routes.v1.platform import organizations
from basis.api.http.routes.v1.platform import platform
from basis.api.http.routes.v1.platform import realtime
from basis.api.http.routes.v1.platform import reasoning
from basis.api.http.routes.v1.platform import settings as settings_routes

_KB_ROUTERS = (
    kbs.router,
    kb_graph.router,
    kb_documents.router,
    mcp.router,
    kb_tokens.router,
    kb_explorer_temporal.router,
    kb_explorer_staging.router,
    kb_explorer_governance.router,
    kb_explorer_query.router,
    kb_ontology.router,
    kb_review.router,
    kb_ledger.router,
    kb_mappings.router,
    kb_reasoning_rules.router,
    kb_alerts.router,
    kb_sources.router,
    kb_connectors.router,
    kb_governance.router,
    realtime.router,
)


def register_v1_api_routers(
    app: FastAPI,
    *,
    legacy_api_enabled: bool,
    include_e2e_helpers: bool = False,
) -> None:
    roots = ["/api/v1"]
    if legacy_api_enabled:
        roots.append("/api")

    for root in roots:
        app.include_router(auth.router, prefix=f"{root}/auth")
        app.include_router(oauth.router, prefix=f"{root}/auth")
        app.include_router(platform.router, prefix=f"{root}/platform")
        app.include_router(organizations.router, prefix=f"{root}/orgs")
        app.include_router(users.router, prefix=root)
        app.include_router(settings_routes.router, prefix=f"{root}/settings")
        app.include_router(model_providers.router, prefix=f"{root}/model-providers")
        app.include_router(models_routes.router, prefix=f"{root}/models")
        app.include_router(audit.router, prefix=f"{root}/audit")
        app.include_router(reasoning.router, prefix=f"{root}/reason")
        for kb_router in _KB_ROUTERS:
            app.include_router(kb_router, prefix=f"{root}/kbs")

    if include_e2e_helpers:
        for root in roots:
            app.include_router(kb_e2e_helpers.router, prefix=f"{root}/kbs")
