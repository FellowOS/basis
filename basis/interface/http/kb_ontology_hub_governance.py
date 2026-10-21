"""Ontology hub drafts, proposals, and version routes."""

from __future__ import annotations

from typing import Any, Optional

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    graph_workspace_runtime_for,
    get_kb_for_role,
    get_knowledge_store,
    get_store,
    save_graph,
)
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.ontology.hub.governance import (
    add_proposal_comment,
    approve_proposal,
    compare_versions,
    get_draft,
    get_proposal,
    list_drafts,
    list_proposals,
    list_versions,
    publish_proposal,
    reject_proposal,
    save_draft,
    submit_proposal,
)
from basis.domain.ontology.hub.hub_models import (
    CommentRequest,
    DraftRequest,
    ProposalRequest,
    VersionCompareRequest,
)
from basis.domain.graph.governance.decision import (
    maybe_emit_governance_tripped_for_admin_error,
)
from basis.domain.errors import AdminError
from basis.domain.knowledge.services.kb_alerts_emit import emit_governance_proposal_proposed_alert
from basis.interface.http.kb_ontology_hub_support import (
    audit_ontology_graph_write,
    governance_alert_from_proposal_result,
    min_role,
    ontology_session,
)


def register_kb_ontology_hub_governance_routes(router: APIRouter) -> None:
    async def _kb_ont_17_save_draft(
        kb_id: str,
        payload: DraftRequest,
        request: Request,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 17 Save Draft. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("PATCH"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            drafts = request.app.state.kb_ontology_drafts[kb_id]
            result = await save_draft(drafts, payload)
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
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            drafts = request.app.state.kb_ontology_drafts[kb_id]
            result = await list_drafts(drafts, ontology_uri)
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
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            drafts = request.app.state.kb_ontology_drafts[kb_id]
            result = await get_draft(drafts, draft_id)
            return result

    router.add_api_route("/{kb_id}/ontology/draft/{draft_id}", _kb_ont_19_get_draft, methods=["GET"], name="_kb_ont_19_get_draft")

    async def _kb_ont_20_submit_proposal(
        kb_id: str,
        request: Request,
        body: ProposalRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 20 Submit Proposal. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            drafts = request.app.state.kb_ontology_drafts[kb_id]
            proposals = request.app.state.kb_ontology_proposals[kb_id]
            result = await submit_proposal(session, drafts, proposals, body)
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
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            proposals = request.app.state.kb_ontology_proposals[kb_id]
            result = await list_proposals(proposals, ontology_uri=ontology_uri, state=state)
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
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            proposals = request.app.state.kb_ontology_proposals[kb_id]
            result = await get_proposal(proposals, proposal_id)
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
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        ontology_session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            try:
                proposals = request.app.state.kb_ontology_proposals[kb_id]
                result = await approve_proposal(proposals, proposal_id)
            except AdminError as exc:
                maybe_emit_governance_tripped_for_admin_error(
                    kb_id,
                    knowledge,
                    exc,
                    detail={"proposal_id": proposal_id, "source": "ontology_approve"},
                    actor_id=user.id,
                    runtime_loader=lambda: graph_workspace_runtime_for(request, kb_id),
                    persist_graph=lambda kid: save_graph(request, kid),
                )
                raise
            save_graph(request, kb_id, sync_ledger=False)
            governance_alert_from_proposal_result(
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
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            proposals = request.app.state.kb_ontology_proposals[kb_id]
            result = await reject_proposal(proposals, proposal_id)
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
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        knowledge = get_knowledge_store(request)
        with KbOntologyState(request, kb_id):
            try:
                proposals = request.app.state.kb_ontology_proposals[kb_id]
                drafts = request.app.state.kb_ontology_drafts[kb_id]
                versions = request.app.state.kb_ontology_versions[kb_id]
                result = await publish_proposal(session, proposals, drafts, versions, proposal_id)
            except AdminError as exc:
                maybe_emit_governance_tripped_for_admin_error(
                    kb_id,
                    knowledge,
                    exc,
                    detail={"proposal_id": proposal_id, "source": "ontology_publish"},
                    actor_id=user.id,
                    runtime_loader=lambda: graph_workspace_runtime_for(request, kb_id),
                    persist_graph=lambda kid: save_graph(request, kid),
                )
                raise
            save_graph(request, kb_id, sync_ledger=False)
            governance_alert_from_proposal_result(
                request,
                kb_id,
                knowledge,
                proposal_id,
                result,
                actor_id=user.id,
            )
            audit_ontology_graph_write(
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
        body: CommentRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 26 Add Comment. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            proposals = request.app.state.kb_ontology_proposals[kb_id]
            result = await add_proposal_comment(proposals, proposal_id, body)
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
        get_kb_for_role(request, user, kb_id, store, min_role("GET"))
        ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            versions = request.app.state.kb_ontology_versions[kb_id]
            result = await list_versions(versions, ontology_uri)
            return result

    router.add_api_route("/{kb_id}/ontology/versions/{ontology_uri:path}", _kb_ont_27_list_versions, methods=["GET"], name="_kb_ont_27_list_versions")

    async def _kb_ont_28_compare_versions(
        kb_id: str,
        request: Request,
        ontology_uri: str,
        body: VersionCompareRequest,
        user: User = Depends(get_current_user),
        store: AdminStore = Depends(get_store),
    ) -> Any:
        """
Kb Ont 28 Compare Versions. Ontology workspace (SKOS, alignments) via Explorer. Requires KB membership (session) or KB API token with read/write scope. All paths are scoped to `{kb_id}`.
        """
        get_kb_for_role(request, user, kb_id, store, min_role("POST"))
        session = ontology_session(request, kb_id)
        with KbOntologyState(request, kb_id):
            versions = request.app.state.kb_ontology_versions[kb_id]
            result = await compare_versions(session, versions, ontology_uri, body)
            save_graph(request, kb_id, sync_ledger=False)
            return result

    router.add_api_route("/{kb_id}/ontology/versions/{ontology_uri:path}/compare", _kb_ont_28_compare_versions, methods=["POST"], name="_kb_ont_28_compare_versions")

