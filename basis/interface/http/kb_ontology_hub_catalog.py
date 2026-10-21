"""Ontology hub catalog, graph, SKOS, SHACL, and registry routes."""

from __future__ import annotations

import asyncio
from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic_core import PydanticUndefined

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_kb_for_role,
    get_store,
    save_graph,
)
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.ontology.hub.create_write import create_ontology as create_ontology_write
from basis.domain.ontology.browse.graph_read import (
    get_entity_detail as get_entity_detail_read,
    get_ontology_graph as get_ontology_graph_read,
    search_entities as search_entities_read,
)
from basis.domain.ontology.hub.load_write import load_ontology as load_ontology_write
from basis.domain.ontology.browse.preview_read import preview_ontology as preview_ontology_read
from basis.domain.ontology.browse.health_read import ontology_health as ontology_health_read
from basis.domain.ontology.hub.refresh_write import refresh_ontology as refresh_ontology_write
from basis.domain.ontology.hub.registry_write import (
    remove_ontology as remove_ontology_write,
    toggle_ontology as toggle_ontology_write,
)
from basis.domain.ontology.shacl.shacl_read import (
    generate_shacl as generate_shacl_read,
    list_shacl_shapes as list_shacl_shapes_read,
    validate_shacl as validate_shacl_read,
)
from basis.domain.ontology.browse.skos_read import (
    get_skos_concept as get_skos_concept_read,
    list_skos_schemes as list_skos_schemes_read,
    search_skos_concepts as search_skos_concepts_read,
)
from basis.domain.ontology.hub.hub_models import (
    CreateOntologyRequest,
    LoadOntologyRequest,
    PreviewOntologyRequest,
    ShaclGenerateRequest,
    ShaclValidateRequest,
    SKOSConceptSearchRequest,
)
from basis.domain.ontology.rdf_io import (
    content_likely_owl_schema,
    convert_ontology_to_graph,
    fetch_ontology_url_bytes,
    parse_rdf_sync_for_basis,
)
from basis.interface.http.kb_ontology_hub_support import (
    audit_ontology_graph_write,
    min_role,
    ontology_session,
)


def register_kb_ontology_hub_catalog_routes(router: APIRouter) -> None:
    async def _kb_ont_1_preview_ontology(
        kb_id: str,
        request: Request,
        body: PreviewOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 1 Preview Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        with KbOntologyState(request, kb_id):
            return await asyncio.to_thread(
                preview_ontology_read,
                url=body.url,
                content=body.content,
                format=body.format,
                fetch_url_bytes=fetch_ontology_url_bytes,
                parse_rdf_sync=parse_rdf_sync_for_basis,
            )

    router.add_api_route("/{kb_id}/ontology/preview", _kb_ont_1_preview_ontology, methods=["POST"], name="_kb_ont_1_preview_ontology")

    async def _kb_ont_2_load_ontology(
        kb_id: str,
        request: Request,
        body: LoadOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 2 Load Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(
                load_ontology_write,
                session,
                registry,
                url=body.url,
                content=body.content,
                format=body.format,
                name=body.name,
                description=body.description,
                tags=list(body.tags) if body.tags else None,
                fetch_url_bytes=fetch_ontology_url_bytes,
                parse_rdf_sync=parse_rdf_sync_for_basis,
                content_likely_owl=content_likely_owl_schema,
                convert_ontology_to_graph=convert_ontology_to_graph,
            )
            save_graph(request, kb_id, sync_ledger=False)
            audit_ontology_graph_write(store, user, kb_id, "kb.graph.ontology_load", result)
            return result

    router.add_api_route("/{kb_id}/ontology/load", _kb_ont_2_load_ontology, methods=["POST"], name="_kb_ont_2_load_ontology")

    async def _kb_ont_3_create_ontology(
        kb_id: str,
        request: Request,
        body: CreateOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 3 Create Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(
                create_ontology_write,
                session,
                registry,
                namespace=body.namespace,
                name=body.name,
                description=body.description,
                tags=list(body.tags) if body.tags else None,
                mode=body.mode,
                sample_data=body.sample_data,
                schema_text=body.schema_text,
                provider=body.provider,
                model=body.model,
            )
            save_graph(request, kb_id, sync_ledger=False)
            audit_ontology_graph_write(store, user, kb_id, "kb.graph.ontology_create", result)
            return result

    router.add_api_route("/{kb_id}/ontology/create", _kb_ont_3_create_ontology, methods=["POST"], name="_kb_ont_3_create_ontology")

    async def _kb_ont_4_search_entities(
        kb_id: str,
        request: Request,
        q: str = Query(PydanticUndefined),
        entity_type: Optional[str] = Query(None),
        limit: int = Query(50),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 4 Search Entities. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            return await asyncio.to_thread(
                search_entities_read,
                session,
                q=q,
                entity_type=entity_type,
                limit=limit,
            )

    router.add_api_route("/{kb_id}/ontology/search", _kb_ont_4_search_entities, methods=["GET"], name="_kb_ont_4_search_entities")

    async def _kb_ont_5_get_ontology_graph(
        kb_id: str,
        request: Request,
        uri: str = Query(PydanticUndefined),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 5 Get Ontology Graph. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            return await asyncio.to_thread(
                get_ontology_graph_read,
                session,
                registry,
                uri=uri,
            )

    router.add_api_route("/{kb_id}/ontology/graph", _kb_ont_5_get_ontology_graph, methods=["GET"], name="_kb_ont_5_get_ontology_graph")

    async def _kb_ont_6_get_entity_detail(
        kb_id: str,
        request: Request,
        entity_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 6 Get Entity Detail. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            return await asyncio.to_thread(
                get_entity_detail_read,
                session,
                registry,
                entity_uri=entity_uri,
            )

    router.add_api_route("/{kb_id}/ontology/entity/{entity_uri:path}", _kb_ont_6_get_entity_detail, methods=["GET"], name="_kb_ont_6_get_entity_detail")

    async def _kb_ont_7_list_skos_schemes(
        kb_id: str,
        request: Request,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 7 List Skos Schemes. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            return await asyncio.to_thread(list_skos_schemes_read, session)

    router.add_api_route("/{kb_id}/ontology/skos/schemes", _kb_ont_7_list_skos_schemes, methods=["GET"], name="_kb_ont_7_list_skos_schemes")

    async def _kb_ont_8_search_skos_concepts(
        kb_id: str,
        request: Request,
        body: SKOSConceptSearchRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 8 Search Skos Concepts. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await asyncio.to_thread(
                search_skos_concepts_read,
                session,
                query=body.query,
                scheme_uri=body.scheme_uri,
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/skos/search", _kb_ont_8_search_skos_concepts, methods=["POST"], name="_kb_ont_8_search_skos_concepts")

    async def _kb_ont_9_get_skos_concept(
        kb_id: str,
        request: Request,
        concept_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 9 Get Skos Concept. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            return await asyncio.to_thread(get_skos_concept_read, session, concept_uri)

    router.add_api_route("/{kb_id}/ontology/skos/concept/{concept_uri:path}", _kb_ont_9_get_skos_concept, methods=["GET"], name="_kb_ont_9_get_skos_concept")

    async def _kb_ont_10_ontology_health(
        kb_id: str,
        request: Request,
        uri: str = Query(PydanticUndefined),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 10 Ontology Health. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            alignments = request.app.state.kb_ontology_alignments[kb_id]
            return await ontology_health_read(session, registry, alignments, uri=uri)

    router.add_api_route("/{kb_id}/ontology/health", _kb_ont_10_ontology_health, methods=["GET"], name="_kb_ont_10_ontology_health")

    async def _kb_ont_11_generate_shacl(
        kb_id: str,
        request: Request,
        body: ShaclGenerateRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 11 Generate Shacl. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await generate_shacl_read(
                session,
                registry,
                uri=body.uri,
                quality_tier=body.quality_tier,
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/shacl/generate", _kb_ont_11_generate_shacl, methods=["POST"], name="_kb_ont_11_generate_shacl")

    async def _kb_ont_12_list_shacl_shapes(
        kb_id: str,
        request: Request,
        uri: str = Query(PydanticUndefined),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 12 List Shacl Shapes. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            return await list_shacl_shapes_read(session, registry, uri=uri)

    router.add_api_route("/{kb_id}/ontology/shacl/shapes", _kb_ont_12_list_shacl_shapes, methods=["GET"], name="_kb_ont_12_list_shacl_shapes")

    async def _kb_ont_13_validate_shacl(
        kb_id: str,
        request: Request,
        body: ShaclValidateRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 13 Validate Shacl. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await validate_shacl_read(
                session,
                registry,
                uri=body.uri,
                shacl_turtle=body.shacl_turtle,
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/shacl/validate", _kb_ont_13_validate_shacl, methods=["POST"], name="_kb_ont_13_validate_shacl")

    async def _kb_ont_14_remove_ontology(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 14 Remove Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("DELETE"))
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(remove_ontology_write, registry, ontology_uri)
            save_graph(request, kb_id, sync_ledger=False)
            audit_ontology_graph_write(
                store, user, kb_id, "kb.graph.ontology_remove", {"ontology_uri": ontology_uri}
            )
            return result

    router.add_api_route("/{kb_id}/ontology/{ontology_uri:path}", _kb_ont_14_remove_ontology, methods=["DELETE"], name="_kb_ont_14_remove_ontology")

    async def _kb_ont_15_toggle_ontology(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 15 Toggle Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("PATCH"))
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(toggle_ontology_write, registry, ontology_uri)
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/{ontology_uri:path}/toggle", _kb_ont_15_toggle_ontology, methods=["PATCH"], name="_kb_ont_15_toggle_ontology")

    async def _kb_ont_16_refresh_ontology(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 16 Refresh Ontology. Ontology hub (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            registry = request.app.state.kb_ontology_registries[kb_id]
            result = await asyncio.to_thread(
                refresh_ontology_write,
                session,
                registry,
                ontology_uri,
                fetch_url_bytes=fetch_ontology_url_bytes,
                parse_rdf_sync=parse_rdf_sync_for_basis,
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/{ontology_uri:path}/refresh", _kb_ont_16_refresh_ontology, methods=["POST"], name="_kb_ont_16_refresh_ontology")

