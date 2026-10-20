"""BOCP connector routes — writeback outbox and run history."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Query, Request

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import (
    get_current_user,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
)
from basis.core.ledger.store import KnowledgeStore
from basis.api.http.routes.v1.kb.connectors.models import ProposeEntityWritebackRequest
from basis.api.http.routes.v1.kb.connectors.support import sync_service_for

router = APIRouter(tags=["knowledge-bases"])

@router.get("/{kb_id}/connectors/outbox")
async def list_kb_sync_outbox(
    kb_id: str,
    request: Request,
    status: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List outbound entity writeback items in `entity_sync_outbox`."""
    get_kb_for_viewer(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    outbox_ids = knowledge.list_entity_sync_outbox_ids(kb_id, status=status, limit=limit)
    items = [svc.get_outbox_item(kb_id, outbox_id) for outbox_id in outbox_ids]
    return {"items": items}


@router.post("/{kb_id}/connectors/outbox/propose")
async def propose_kb_entity_writeback(
    kb_id: str,
    body: ProposeEntityWritebackRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Propose an outbound writeback of ledger entity attributes to its external connector stream."""
    get_kb_for_editor(request, user, kb_id, store)
    svc = sync_service_for(knowledge)
    try:
        outbox = svc.propose_entity_writeback(
            kb_id,
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


@router.get("/{kb_id}/connectors/runs")
async def list_kb_connector_runs(
    kb_id: str,
    request: Request,
    service: str | None = Query(default=None),
    limit: int = Query(default=50, ge=1, le=200),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List recent BOCP connector execution audit logs (`kb_connector_runs`)."""
    get_kb_for_viewer(request, user, kb_id, store)
    runs = knowledge.list_kb_connector_runs(kb_id, service=service, limit=limit)
    return {"runs": runs}

