"""Register v1 API routers (optional duplicate legacy prefix)."""

from __future__ import annotations

from fastapi import FastAPI

from basis.transport.http.routes.v1 import (
    audit,
    auth,
    kb_alerts,
    kb_connectors,
    kb_governance,
    kb_e2e_helpers,
    kb_explorer,
    kb_ledger,
    kb_mappings,
    kb_ontology,
    kb_reasoning_rules,
    kb_review,
    kb_sources,
    kb_tokens,
    kbs,
    mcp,
    model_providers,
    models as models_routes,
    oauth,
    organizations,
    platform,
    realtime,
    reasoning,
    settings as settings_routes,
    users,
)

_KB_ROUTERS = (
    kbs.router,
    mcp.router,
    kb_tokens.router,
    kb_explorer.router,
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
