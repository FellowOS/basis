"""KB-scoped realtime tickets and graph update WebSocket."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Depends, Request, WebSocket, WebSocketDisconnect

from basis.admin.errors import AdminError
from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_knowledge_store, get_store, get_kb_for_viewer

router = APIRouter(prefix="/api/kbs", tags=["realtime"])

_ALLOWED_WS_ORIGINS = frozenset(
    {
        "http://127.0.0.1:5173",
        "http://localhost:5173",
    }
)


def _check_ws_origin(websocket: WebSocket) -> None:
    origin = websocket.headers.get("origin")
    if origin is None:
        return
    if origin not in _ALLOWED_WS_ORIGINS:
        raise AdminError(403, "forbidden_origin", "来源不被允许")


@router.post("/{kb_id}/realtime-ticket")
async def create_realtime_ticket(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    ticket, expires_at = request.app.state.realtime_tickets.issue(kb_id, user.id)
    revision = get_knowledge_store(request).get_projection_state(kb_id)["revision"]
    return {
        "ticket": ticket,
        "expires_at": expires_at,
        "kb_id": kb_id,
        "projection_revision": revision,
    }


@router.websocket("/{kb_id}/ws/graph-updates")
async def graph_updates_ws(
    websocket: WebSocket,
    kb_id: str,
    ticket: str,
) -> None:
    app = websocket.app
    try:
        _check_ws_origin(websocket)
        user_id = app.state.realtime_tickets.consume(kb_id, ticket)
        store: AdminStore = app.state.store
        user = await asyncio.to_thread(store.get_user_by_id, user_id)
        if user is None:
            raise AdminError(401, "unauthorized", "用户无效")
        await asyncio.to_thread(store.get_kb_for, user, kb_id, "viewer")
    except AdminError:
        await websocket.close(code=4401)
        return

    hub = app.state.ws_hub
    knowledge = app.state.knowledge_store
    revision = knowledge.get_projection_state(kb_id)["revision"]

    await hub.connect(kb_id, websocket, user.id)
    try:
        await websocket.send_json(
            {
                "type": "connected",
                "kb_id": kb_id,
                "projection_revision": revision,
            }
        )
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        pass
    finally:
        await hub.disconnect(kb_id, websocket)
