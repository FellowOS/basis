"""KB-scoped adapters for semantica Explorer ontology hub routes."""
from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request
from pydantic_core import PydanticUndefined

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import (
    get_current_user,
    get_explorer_registry,
    get_kb_for_role,
    get_knowledge_store,
    get_store,
    save_graph,
)
from basis.domain.explorer.kb_scoped_ontology_state import KbOntologyState
from basis.domain.explorer.ontology_route_bridge import invoke_ontology, ontology_module
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.platform.admin.errors import AdminError
from basis.domain.kb.services.graph_audit import audit_kb_graph
from basis.domain.explorer.governance_decision import (
    emit_governance_tripped_for_kb,
    maybe_emit_governance_tripped_for_admin_error,
)
from basis.domain.kb.services.kb_alerts_emit import emit_governance_proposal_proposed_alert
from basis.domain.kb.store import KnowledgeStore

WRITE_METHODS = frozenset({"POST", "PUT", "PATCH", "DELETE"})


def _session(request: Request, kb_id: str):
    runtime = get_explorer_registry(request).get(request, kb_id)
    return require_explorer_graph_session(runtime)


def _min_role(method: str) -> str:
    return "editor" if method in WRITE_METHODS else "viewer"


def _governance_alert_from_proposal_result(
    request: Request,
    kb_id: str,
    knowledge: KnowledgeStore,
    proposal_id: str,
    result: Any,
    *,
    actor_id: str | None = None,
) -> None:
    if hasattr(result, "model_dump"):
        data: Any = result.model_dump()
    elif isinstance(result, dict):
        data = result
    else:
        return
    shacl = data.get("shacl_validation")
    if isinstance(shacl, dict) and shacl.get("conforms") is False:
        emit_governance_tripped_for_kb(
            request,
            kb_id,
            knowledge,
            message=f"SHACL gate failed for proposal {proposal_id}",
            detail={
                "proposal_id": proposal_id,
                "shacl_validation": shacl,
            },
            actor_id=actor_id,
        )


def _audit_ontology_graph_write(
    store: AdminStore,
    user: User,
    kb_id: str,
    action: str,
    result: Any,
) -> None:
    extra: dict[str, Any] = {}
    if hasattr(result, "model_dump"):
        data: Any = result.model_dump()
    elif isinstance(result, dict):
        data = result
    else:
        data = {}
    for key in ("uri", "ontology_uri", "name", "namespace", "format", "source"):
        value = data.get(key)
        if value:
            extra[key] = value
    audit_kb_graph(store, user, kb_id, action, extra=extra or None)


def register_kb_ontology_hub_routes(router: APIRouter) -> None:
    ont = ontology_module()

    async def _kb_ont_1_preview_ontology(
        kb_id: str,
        request: Request,
        body: ont.PreviewOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 1 Preview Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.preview_ontology(body))
            return result

    router.add_api_route("/{kb_id}/ontology/preview", _kb_ont_1_preview_ontology, methods=["POST"], name="_kb_ont_1_preview_ontology")

    async def _kb_ont_2_load_ontology(
        kb_id: str,
        request: Request,
        body: ont.LoadOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 2 Load Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.load_ontology(request=request, session=session, body=body))
            save_graph(request, kb_id, sync_ledger=False)
            _audit_ontology_graph_write(store, user, kb_id, "kb.graph.ontology_load", result)
            return result

    router.add_api_route("/{kb_id}/ontology/load", _kb_ont_2_load_ontology, methods=["POST"], name="_kb_ont_2_load_ontology")

    async def _kb_ont_3_create_ontology(
        kb_id: str,
        request: Request,
        body: ont.CreateOntologyRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 3 Create Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.create_ontology(request=request, session=session, body=body))
            save_graph(request, kb_id, sync_ledger=False)
            _audit_ontology_graph_write(store, user, kb_id, "kb.graph.ontology_create", result)
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
Kb Ont 4 Search Entities. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.search_entities(request=request, session=session, q=q, entity_type=entity_type, limit=limit))
            return result

    router.add_api_route("/{kb_id}/ontology/search", _kb_ont_4_search_entities, methods=["GET"], name="_kb_ont_4_search_entities")

    async def _kb_ont_5_get_ontology_graph(
        kb_id: str,
        request: Request,
        uri: str = Query(PydanticUndefined),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 5 Get Ontology Graph. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.get_ontology_graph(request=request, session=session, uri=uri))
            return result

    router.add_api_route("/{kb_id}/ontology/graph", _kb_ont_5_get_ontology_graph, methods=["GET"], name="_kb_ont_5_get_ontology_graph")

    async def _kb_ont_6_get_entity_detail(
        kb_id: str,
        request: Request,
        entity_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 6 Get Entity Detail. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.get_entity_detail(request=request, session=session, entity_uri=entity_uri))
            return result

    router.add_api_route("/{kb_id}/ontology/entity/{entity_uri:path}", _kb_ont_6_get_entity_detail, methods=["GET"], name="_kb_ont_6_get_entity_detail")

    async def _kb_ont_7_list_skos_schemes(
        kb_id: str,
        request: Request,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 7 List Skos Schemes. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.list_skos_schemes(request=request, session=session))
            return result

    router.add_api_route("/{kb_id}/ontology/skos/schemes", _kb_ont_7_list_skos_schemes, methods=["GET"], name="_kb_ont_7_list_skos_schemes")

    async def _kb_ont_8_search_skos_concepts(
        kb_id: str,
        request: Request,
        body: ont.SKOSConceptSearchRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 8 Search Skos Concepts. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.search_skos_concepts(request=request, session=session, body=body))
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
Kb Ont 9 Get Skos Concept. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.get_skos_concept(request=request, session=session, concept_uri=concept_uri))
            return result

    router.add_api_route("/{kb_id}/ontology/skos/concept/{concept_uri:path}", _kb_ont_9_get_skos_concept, methods=["GET"], name="_kb_ont_9_get_skos_concept")

    async def _kb_ont_10_ontology_health(
        kb_id: str,
        request: Request,
        uri: str = Query(PydanticUndefined),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 10 Ontology Health. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.ontology_health(request=request, session=session, uri=uri))
            return result

    router.add_api_route("/{kb_id}/ontology/health", _kb_ont_10_ontology_health, methods=["GET"], name="_kb_ont_10_ontology_health")

    async def _kb_ont_11_generate_shacl(
        kb_id: str,
        request: Request,
        body: ont.ShaclGenerateRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 11 Generate Shacl. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.generate_shacl(request=request, session=session, body=body))
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
Kb Ont 12 List Shacl Shapes. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.list_shacl_shapes(request=request, session=session, uri=uri))
            return result

    router.add_api_route("/{kb_id}/ontology/shacl/shapes", _kb_ont_12_list_shacl_shapes, methods=["GET"], name="_kb_ont_12_list_shacl_shapes")

    async def _kb_ont_13_validate_shacl(
        kb_id: str,
        request: Request,
        body: ont.ShaclValidateRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 13 Validate Shacl. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.validate_shacl(request=request, session=session, body=body))
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
Kb Ont 14 Remove Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("DELETE"))
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.remove_ontology(ontology_uri=ontology_uri, request=request),
                context="ontology",
            )
            save_graph(request, kb_id, sync_ledger=False)
            _audit_ontology_graph_write(
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
Kb Ont 15 Toggle Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("PATCH"))
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.toggle_ontology(ontology_uri=ontology_uri, request=request),
                context="ontology",
            )
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
Kb Ont 16 Refresh Ontology. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.refresh_ontology(request=request, session=session, ontology_uri=ontology_uri))
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/{ontology_uri:path}/refresh", _kb_ont_16_refresh_ontology, methods=["POST"], name="_kb_ont_16_refresh_ontology")

    async def _kb_ont_17_save_draft(
        kb_id: str,
        request: Request,
        body: ont.DraftRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 17 Save Draft. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("PATCH"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.save_draft(request=request, body=body))
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/draft", _kb_ont_17_save_draft, methods=["PATCH"], name="_kb_ont_17_save_draft")

    async def _kb_ont_18_list_drafts(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 18 List Drafts. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.list_drafts(ontology_uri=ontology_uri, request=request),
                context="ontology",
            )
            return result

    router.add_api_route("/{kb_id}/ontology/drafts/{ontology_uri:path}", _kb_ont_18_list_drafts, methods=["GET"], name="_kb_ont_18_list_drafts")

    async def _kb_ont_19_get_draft(
        kb_id: str,
        request: Request,
        draft_id: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 19 Get Draft. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.get_draft(draft_id=draft_id, request=request))
            return result

    router.add_api_route("/{kb_id}/ontology/draft/{draft_id}", _kb_ont_19_get_draft, methods=["GET"], name="_kb_ont_19_get_draft")

    async def _kb_ont_20_submit_proposal(
        kb_id: str,
        request: Request,
        body: ont.ProposalRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 20 Submit Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.submit_proposal(request=request, session=session, body=body))
            save_graph(request, kb_id, sync_ledger=False)
            if hasattr(result, "model_dump"):
                data: Any = result.model_dump()
            elif isinstance(result, dict):
                data = result
            else:
                data = {}
            proposal_id = str(data.get("proposal_id") or "").strip()
            if proposal_id:
                summary = str(data.get("summary") or "").strip()
                emit_governance_proposal_proposed_alert(
                    knowledge,
                    kb_id,
                    proposal_id=proposal_id,
                    message=summary or f"Ontology proposal {proposal_id} awaiting review",
                    detail={
                        "proposal_id": proposal_id,
                        "ontology_uri": data.get("ontology_uri"),
                        "state": data.get("state"),
                    },
                )
            return result

    router.add_api_route("/{kb_id}/ontology/propose", _kb_ont_20_submit_proposal, methods=["POST"], name="_kb_ont_20_submit_proposal")

    async def _kb_ont_21_list_proposals(
        kb_id: str,
        request: Request,
        ontology_uri: Optional[str] = Query(None),
        state: Optional[str] = Query(None),
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 21 List Proposals. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.list_proposals(request=request, ontology_uri=ontology_uri, state=state),
                context="ontology",
            )
            return result

    router.add_api_route("/{kb_id}/ontology/proposals", _kb_ont_21_list_proposals, methods=["GET"], name="_kb_ont_21_list_proposals")

    async def _kb_ont_22_get_proposal(
        kb_id: str,
        request: Request,
        proposal_id: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 22 Get Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.get_proposal(proposal_id=proposal_id, request=request),
                context="ontology",
            )
            return result

    router.add_api_route("/{kb_id}/ontology/proposals/{proposal_id}", _kb_ont_22_get_proposal, methods=["GET"], name="_kb_ont_22_get_proposal")

    async def _kb_ont_23_approve_proposal(
        kb_id: str,
        request: Request,
        proposal_id: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 23 Approve Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        _session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            try:
                result = await invoke_ontology(
                    ont.approve_proposal(proposal_id=proposal_id, request=request),
                    context="ontology",
                )
            except AdminError as exc:
                maybe_emit_governance_tripped_for_admin_error(
                    request,
                    kb_id,
                    knowledge,
                    exc,
                    detail={"proposal_id": proposal_id, "source": "ontology_approve"},
                    actor_id=user.id,
                )
                raise
            save_graph(request, kb_id, sync_ledger=False)
            _governance_alert_from_proposal_result(
                request,
                kb_id,
                knowledge,
                proposal_id,
                result,
                actor_id=user.id,
            )
            return result

    router.add_api_route("/{kb_id}/ontology/proposals/{proposal_id}/approve", _kb_ont_23_approve_proposal, methods=["POST"], name="_kb_ont_23_approve_proposal")

    async def _kb_ont_24_reject_proposal(
        kb_id: str,
        request: Request,
        proposal_id: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 24 Reject Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.reject_proposal(proposal_id=proposal_id, request=request),
                context="ontology",
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/proposals/{proposal_id}/reject", _kb_ont_24_reject_proposal, methods=["POST"], name="_kb_ont_24_reject_proposal")

    async def _kb_ont_25_publish_proposal(
        kb_id: str,
        request: Request,
        proposal_id: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 25 Publish Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            try:
                result = await invoke_ontology(
                    ont.publish_proposal(proposal_id=proposal_id, request=request, session=session),
                    context="ontology",
                )
            except AdminError as exc:
                maybe_emit_governance_tripped_for_admin_error(
                    request,
                    kb_id,
                    knowledge,
                    exc,
                    detail={"proposal_id": proposal_id, "source": "ontology_publish"},
                    actor_id=user.id,
                )
                raise
            save_graph(request, kb_id, sync_ledger=False)
            _governance_alert_from_proposal_result(
                request,
                kb_id,
                knowledge,
                proposal_id,
                result,
                actor_id=user.id,
            )
            _audit_ontology_graph_write(
                store,
                user,
                kb_id,
                "kb.graph.ontology_publish",
                {"proposal_id": proposal_id, **(result.model_dump() if hasattr(result, "model_dump") else {})},
            )
            return result

    router.add_api_route("/{kb_id}/ontology/proposals/{proposal_id}/publish", _kb_ont_25_publish_proposal, methods=["POST"], name="_kb_ont_25_publish_proposal")

    async def _kb_ont_26_add_comment(
        kb_id: str,
        request: Request,
        proposal_id: str,
        body: ont.CommentRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 26 Add Comment. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.add_comment(proposal_id=proposal_id, body=body, request=request),
                context="ontology",
            )
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/proposals/{proposal_id}/comment", _kb_ont_26_add_comment, methods=["POST"], name="_kb_ont_26_add_comment")

    async def _kb_ont_27_list_versions(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 27 List Versions. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("GET"))
        _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(
                ont.list_versions(ontology_uri=ontology_uri, request=request),
                context="ontology",
            )
            return result

    router.add_api_route("/{kb_id}/ontology/versions/{ontology_uri:path}", _kb_ont_27_list_versions, methods=["GET"], name="_kb_ont_27_list_versions")

    async def _kb_ont_28_compare_versions(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        body: ont.VersionCompareRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 28 Compare Versions. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, _min_role("POST"))
        session = _session(request, kb_id)
        with KbOntologyState(request, kb_id):
            result = await invoke_ontology(ont.compare_versions(request=request, session=session, ontology_uri=ontology_uri, body=body))
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/versions/{ontology_uri:path}/compare", _kb_ont_28_compare_versions, methods=["POST"], name="_kb_ont_28_compare_versions")

