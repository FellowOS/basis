"""Register v1 API routers (optional duplicate legacy prefix)."""

from __future__ import annotations

from fastapi import FastAPI

from basis.interface.http import users
from basis.interface.http.kb_config_alerts import router as kb_alerts_router
from basis.interface.http.kb_config_governance import router as kb_governance_router
from basis.interface.http.kb_config_mappings import router as kb_mappings_router
from basis.interface.http.kb_config_reasoning_rules import router as kb_reasoning_rules_router
from basis.interface.http.kb_connectors import router as kb_connectors_router
from basis.interface.http.kb_documents import router as kb_documents_router
from basis.interface.http.kb_e2e_helpers import router as kb_e2e_helpers_router
from basis.interface.http.kb_graph_session_routes import router as kb_graph_session_query_router
from basis.interface.http.kb_graph_enrich import router as kb_graph_enrich_router
from basis.interface.http.kb_graph_staging import router as kb_graph_staging_router
from basis.interface.http.kb_graph_temporal import router as kb_graph_temporal_router
from basis.interface.http.kb_graph import router as kb_graph_router
from basis.interface.http.kb_ledger import router as kb_ledger_router
from basis.interface.http.kb_ontology import router as kb_ontology_router
from basis.interface.http.kb_review import router as kb_review_router
from basis.interface.http.kb_sources import router as kb_sources_router
from basis.interface.http.kb_kbs import router as kb_kbs_router
from basis.interface.http.kb_tokens import router as kb_tokens_router
from basis.interface.http.platform_audit import router as audit_router
from basis.interface.http.platform_auth import router as auth_router
from basis.interface.http.platform_mcp import router as mcp_router
from basis.interface.http.platform_model_providers import router as model_providers_router
from basis.interface.http.platform_models import router as models_router
from basis.interface.http.platform_organizations import router as organizations_router
from basis.interface.http.platform_platform import router as platform_router
from basis.interface.http.platform_realtime import router as realtime_router
from basis.interface.http.platform_reasoning import router as reasoning_router
from basis.interface.http.platform_settings import router as settings_router

_KB_ROUTERS = (
    kb_kbs_router,
    kb_graph_router,
    kb_documents_router,
    mcp_router,
    kb_tokens_router,
    kb_graph_temporal_router,
    kb_graph_staging_router,
    kb_graph_enrich_router,
    kb_graph_session_query_router,
    kb_ontology_router,
    kb_review_router,
    kb_ledger_router,
    kb_mappings_router,
    kb_reasoning_rules_router,
    kb_alerts_router,
    kb_sources_router,
    kb_connectors_router,
    kb_governance_router,
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
        for kb_router in _KB_ROUTERS:
            app.include_router(kb_router, prefix=f"{root}/kbs")

    if include_e2e_helpers:
        for root in roots:
            app.include_router(kb_e2e_helpers_router, prefix=f"{root}/kbs")
