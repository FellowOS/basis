"""KB-scoped adapters for Explorer ontology hub routes."""

from __future__ import annotations

from fastapi import APIRouter

from basis.api.http.routes.v1.kb.ontology.hub.catalog import register_kb_ontology_hub_catalog_routes
from basis.api.http.routes.v1.kb.ontology.hub.governance import register_kb_ontology_hub_governance_routes


def register_kb_ontology_hub_routes(router: APIRouter) -> None:
    register_kb_ontology_hub_catalog_routes(router)
    register_kb_ontology_hub_governance_routes(router)
