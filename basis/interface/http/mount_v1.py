"""Register v1 API routers (optional duplicate legacy prefix)."""

from __future__ import annotations

from fastapi import FastAPI

from basis.interface.http import users
from basis.interface.http.workspace.config.config_alerts import router as alerts_router
from basis.interface.http.workspace.config.config_governance import router as workspace_governance_router
from basis.interface.http.workspace.config.config_mappings import router as workspace_mappings_router
from basis.interface.http.workspace.config.config_reasoning_rules import router as reasoning_rules_router
from basis.interface.http.connectors import router as workspace_connectors_router
from basis.interface.http.documents import router as workspace_documents_router
from basis.interface.http.e2e_helpers import router as workspace_e2e_helpers_router
from basis.interface.http.platform.e2e_helpers import router as platform_e2e_helpers_router
from basis.interface.http.workspace.graph.graph_session_routes import (
    router as workspace_graph_session_query_router,
)
from basis.interface.http.workspace.graph.graph_enrich import router as workspace_graph_enrich_router
from basis.interface.http.workspace.graph.graph_staging import router as workspace_graph_staging_router
from basis.interface.http.workspace.graph.graph_temporal import router as workspace_graph_temporal_router
from basis.interface.http.graph import router as workspace_graph_router
from basis.interface.http.ledger import router as workspace_ledger_router
from basis.interface.http.ontology import router as workspace_ontology_router
from basis.interface.http.review import router as workspace_review_router
from basis.interface.http.sources import router as workspace_sources_router
from basis.interface.http.resources import router as workspace_resources_router
from basis.interface.http.tokens import router as workspace_tokens_router
from basis.interface.http.platform.audit import router as audit_router
from basis.interface.http.platform_auth import router as auth_router
from basis.interface.http.platform.mcp import router as mcp_router
from basis.interface.http.platform.model_providers import router as model_providers_router
from basis.interface.http.platform.models import router as models_router
from basis.interface.http.platform.organizations import router as organizations_router
from basis.interface.http.platform.platform_info import router as platform_router
from basis.interface.http.platform.realtime import router as realtime_router
from basis.interface.http.platform.reasoning import router as reasoning_router
from basis.interface.http.platform.settings import router as settings_router
_WORKSPACE_ROUTERS = (
    workspace_resources_router,
    workspace_graph_router,
    workspace_documents_router,
    mcp_router,
    workspace_tokens_router,
    workspace_graph_temporal_router,
    workspace_graph_staging_router,
    workspace_graph_enrich_router,
    workspace_graph_session_query_router,
    workspace_ontology_router,
    workspace_review_router,
    workspace_ledger_router,
    workspace_mappings_router,
    reasoning_rules_router,
    alerts_router,
    workspace_sources_router,
    workspace_connectors_router,
    workspace_governance_router,
    realtime_router,
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
        app.include_router(auth_router, prefix=f"{root}/auth")
        app.include_router(platform_router, prefix=f"{root}/platform")
        app.include_router(organizations_router, prefix=f"{root}/orgs")
        app.include_router(users.router, prefix=root)
        app.include_router(settings_router, prefix=f"{root}/settings")
        app.include_router(model_providers_router, prefix=f"{root}/model-providers")
        app.include_router(models_router, prefix=f"{root}/models")
        app.include_router(audit_router, prefix=f"{root}/audit")
        app.include_router(reasoning_router, prefix=f"{root}/reason")
        for workspace_router in _WORKSPACE_ROUTERS:
            app.include_router(workspace_router, prefix=f"{root}/workspaces")

    if include_e2e_helpers:
        for root in roots:
            app.include_router(platform_e2e_helpers_router, prefix=root)
            app.include_router(workspace_e2e_helpers_router, prefix=f"{root}/workspaces")
