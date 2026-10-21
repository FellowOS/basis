"""BOCP connector routes — writeback outbox and run history."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.domain.errors import AdminError
from basis.domain.tenancy.admin.store import AdminStore, User
from basis.interface.http.deps import (
    get_current_user,
    get_workspace_for_editor,
    get_workspace_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.domain.knowledge.store import KnowledgeStore
from basis.interface.http.kb_connectors_models import ProposeEntityWritebackRequest
from basis.interface.http.kb_connectors_support import sync_service_for

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{workspace_id}/connectors/outbox")
async def list_kb_sync_outbox(
    workspace_id: str,
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List outbound entity writeback items in `entity_sync_outbox`."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    svc = sync_service_for(knowledge)
    outbox_ids = knowledge.list_entity_sync_outbox_ids(workspace_id, status=status, limit=limit)
    items = [svc.get_outbox_item(workspace_id, outbox_id) for outbox_id in outbox_ids]
    return {"items": items}


@router.post("/{workspace_id}/connectors/outbox/propose")
async def propose_kb_entity_writeback(
    workspace_id: str,
    body: ProposeEntityWritebackRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Propose an outbound writeback of ledger entity attributes to its external connector stream."""
    get_workspace_for_editor(request, user, workspace_id, store)
    svc = sync_service_for(knowledge)
    try:
        outbox = svc.propose_entity_writeback(
            workspace_id,
            entity_id=body.entity_id,
            field_updates=body.field_updates,
            created_by=user.id,
        )
        return {"outbox": outbox}
    except LookupError as exc:
        raise AdminError(404, "external_ref_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "writeback_not_permitted", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "writeback_propose_failed", str(exc)) from exc


@router.get("/{workspace_id}/connectors/runs")
async def list_connector_runs(
    workspace_id: str,
    request: Request,
    service: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List recent BOCP connector execution audit logs (`connector_runs`)."""
    get_workspace_for_viewer(request, user, workspace_id, store)
    runs = knowledge.list_connector_runs(workspace_id, service=service, limit=limit)
    return {"runs": runs}
