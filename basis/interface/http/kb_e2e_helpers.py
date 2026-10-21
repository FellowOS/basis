"""Playwright-only helpers (disabled unless BASIS_DATA_DIR is the e2e data dir)."""

from __future__ import annotations

import asyncio
from uuid import uuid4

from fastapi import APIRouter, Depends, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import get_current_user, get_workspace_for_editor, get_knowledge_store, get_store
from basis.infra.runtime.config import Settings
from basis.domain.graph.governance.decision import emit_governance_tripped_for_kb
from basis.domain.ontology.hub.kb_scoped_state import KbOntologyState
from basis.domain.graph.session.guard import require_kb_graph_session
from basis.domain.knowledge.services.conflict_review import scan_statement_conflicts
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.deps import kb_graph_runtime_for, save_graph
from basis.domain.ontology.hub.create_write import create_ontology as create_ontology_write
from basis.domain.ontology.hub.governance import save_draft, submit_proposal
from basis.domain.ontology.hub.hub_models import DraftDiff, DraftRequest, ProposalRequest
from basis.infra.tooling.test_support.playwright_e2e import is_playwright_e2e_data_dir

router = APIRouter(tags=["knowledge-bases"])


def _e2e_helpers_enabled(request: Request) -> bool:
    settings: Settings = request.app.state.settings
    return is_playwright_e2e_data_dir(settings.data_dir)


@router.post("/{workspace_id}/_e2e/governance-trip")
async def e2e_governance_trip(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, str | None]:
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_workspace_for_editor(request, user, workspace_id, store)
    decision_id = emit_governance_tripped_for_kb(
        workspace_id,
        knowledge,
        message="E2E governance gate trip",
        detail={"source": "e2e_governance_trip"},
        actor_id=user.id,
        runtime_loader=lambda: kb_graph_runtime_for(request, workspace_id),
        persist_graph=lambda kid: save_graph(request, kid),
    )
    return {"decision_id": decision_id}


@router.post("/{workspace_id}/_e2e/statement-conflict")
async def e2e_statement_conflict(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, object]:
    """Seed conflicting ledger statements and run conflict scan (Playwright / data-e2e only)."""
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_workspace_for_editor(request, user, workspace_id, store)

    _, version_id, _, _ = knowledge.store_upload_bytes(
        workspace_id,
        title="e2e-conflict.txt",
        mime_type="text/plain",
        data=b"e2e",
        created_by=user.id,
        external_key=f"e2e-conflict-{uuid4().hex}",
    )
    chunk_id = knowledge.create_chunk(workspace_id, version_id, ordinal=0, text="e2e evidence")
    knowledge.set_version_status(workspace_id, version_id, "ready")

    subject_id = knowledge.create_entity(workspace_id, canonical_label="E2E conflict subject")
    object_a = knowledge.create_entity(workspace_id, canonical_label="E2E conflict object A")
    object_b = knowledge.create_entity(workspace_id, canonical_label="E2E conflict object B")
    surface = f"e2e_predicate_{uuid4().hex[:10]}"
    for obj_id in (object_a, object_b):
        knowledge.add_open_statement(
            workspace_id,
            subject_id=subject_id,
            surface_phrase=surface,
            object_entity_id=obj_id,
            object_value=None,
            status="confirmed",
            proposed_by=user.id,
            chunk_id=chunk_id,
            quote=surface,
        )

    scan = scan_statement_conflicts(knowledge, workspace_id)
    item_ids = scan.get("item_ids") or []
    review_item_id = item_ids[0] if item_ids else None
    return {
        "review_item_id": review_item_id,
        "surface_phrase": surface,
        "scan": scan,
    }


def _ontology_payload_id(payload: object, key: str) -> str | None:
    if hasattr(payload, "model_dump"):
        data = payload.model_dump()
    elif isinstance(payload, dict):
        data = payload
    else:
        return None
    value = data.get(key)
    return str(value).strip() if value else None


@router.post("/{workspace_id}/_e2e/ontology-proposal")
async def e2e_ontology_proposal(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, str]:
    """Create ontology + draft + proposed change (Playwright / data-e2e only)."""
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_workspace_for_editor(request, user, workspace_id, store)

    runtime = kb_graph_runtime_for(request, workspace_id)
    session = require_kb_graph_session(runtime)
    namespace = f"http://example.org/e2e-{uuid4().hex}"
    ontology_uri = f"{namespace}#ontology"
    class_uri = f"{namespace}#E2EClass"
    summary = f"E2E ontology proposal {uuid4().hex[:8]}"

    with KbOntologyState(request, workspace_id):
        registry = request.app.state.kb_ontology_registries[workspace_id]
        await asyncio.to_thread(
            create_ontology_write,
            session,
            registry,
            namespace=namespace,
            name="E2E Ontology",
            mode="scratch",
        )
        drafts = request.app.state.kb_ontology_drafts[workspace_id]
        draft = await save_draft(
            drafts,
            DraftRequest(
                ontology_uri=ontology_uri,
                diff=DraftDiff(added_classes=[class_uri]),
                author=user.email,
                summary="E2E draft",
            ),
        )
        draft_id = _ontology_payload_id(draft, "draft_id")
        if not draft_id:
            raise AdminError(500, "e2e_seed_failed", "未能创建 ontology draft")

        proposals = request.app.state.kb_ontology_proposals[workspace_id]
        proposed = await submit_proposal(
            session,
            drafts,
            proposals,
            ProposalRequest(
                draft_id=draft_id,
                ontology_uri=ontology_uri,
                summary=summary,
            ),
        )
        save_graph(request, workspace_id)

    proposal_id = _ontology_payload_id(proposed, "proposal_id")
    if not proposal_id:
        raise AdminError(500, "e2e_seed_failed", "未能提交 ontology proposal")

    return {
        "proposal_id": proposal_id,
        "ontology_uri": ontology_uri,
        "summary": summary,
    }


@router.post("/{workspace_id}/_e2e/processing-failed")
async def e2e_processing_failed(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, str]:
    """Fail a synthetic processing job and emit processing.failed alert (Playwright / data-e2e only)."""
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_workspace_for_editor(request, user, workspace_id, store)

    doc_id = f"e2e-fail-{uuid4().hex[:10]}"
    outcome = knowledge.store_document_bytes(
        workspace_id,
        title=f"{doc_id}.txt",
        mime_type="text/plain",
        data=b"e2e processing fail seed",
        created_by=user.id,
        external_key=doc_id,
    )
    job, _ = knowledge.create_processing_job(
        workspace_id,
        version_id=outcome.version_id,
        options={"chunk": False, "extract": False},
    )
    knowledge.fail_job(workspace_id, job["id"], "parse_failed", "E2E simulated processing failure")
    return {
        "job_id": job["id"],
        "doc_id": doc_id,
        "version_id": outcome.version_id,
        "document_id": outcome.document_id,
    }


@router.post("/{workspace_id}/_e2e/sync-failed")
async def e2e_sync_failed(
    workspace_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, str]:
    """Emit sync_failed alert for an ingest source (Playwright / data-e2e only)."""
    if not _e2e_helpers_enabled(request):
        raise AdminError(404, "not_found", "资源不存在")
    get_workspace_for_editor(request, user, workspace_id, store)

    source, _ = knowledge.create_ingest_source(
        workspace_id,
        user.id,
        kind="http_poll",
        name=f"E2E sync fail {uuid4().hex[:6]}",
        config={"url": "https://example.com/e2e-feed.txt"},
    )
    source_id = source["id"]
    knowledge.create_workspace_alert(
        workspace_id,
        kind="sync_failed",
        message="E2E ingest sync failed",
        severity="warning",
        detail={"source_id": source_id},
    )
    return {"source_id": source_id}
