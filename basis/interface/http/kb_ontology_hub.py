"""KB-scoped adapters for Explorer ontology hub routes."""

from __future__ import annotations

from fastapi import APIRouter

from basis.interface.http.kb_ontology_hub_catalog import register_kb_ontology_hub_catalog_routes
from basis.interface.http.kb_ontology_hub_governance import register_kb_ontology_hub_governance_routes


def register_kb_ontology_hub_routes(router: APIRouter) -> None:
    register_kb_ontology_hub_catalog_routes(router)
    register_kb_ontology_hub_governance_routes(router)
