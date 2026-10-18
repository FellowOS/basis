"""KB alert episodes (F-ALT MVP)."""

from __future__ import annotations

import asyncio
import json
from typing import Any

from fastapi import APIRouter, Depends, Query, Request
from fastapi.responses import StreamingResponse

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_kb_for_editor, get_kb_for_viewer, get_knowledge_store, get_store
from basis.domain.kb.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


@router.get("/{kb_id}/alerts")
async def list_kb_alerts(
    kb_id: str,
    request: Request,
    limit: int = Query(30, ge=1, le=100),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """List KB alert episodes with unread count (viewer+)."""
    get_kb_for_viewer(request, user, kb_id, store)
    alerts = knowledge.list_kb_alerts(kb_id, limit=limit)
    unread = knowledge.count_kb_alerts(kb_id, include_dismissed=False)
    return {"alerts": alerts, "unread_count": unread}


@router.post("/{kb_id}/alerts/{alert_id}/dismiss")
async def dismiss_kb_alert(
    kb_id: str,
    alert_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    """Dismiss a single alert episode (editor+)."""
    get_kb_for_editor(request, user, kb_id, store)
    alert = knowledge.dismiss_kb_alert(kb_id, alert_id)
    return {"alert": alert}


@router.get("/{kb_id}/alerts/stream")
async def stream_kb_alerts(
    kb_id: str,
    request: Request,
    since: str | None = Query(
        None,
        description="Only emit alerts with created_at strictly after this ISO timestamp.",
    ),
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> StreamingResponse:
    """Stream new alert episodes via SSE (viewer+)."""
    get_kb_for_viewer(request, user, kb_id, store)

    async def event_stream():
        cursor: str | None = since
        yield f"data: {json.dumps({'type': 'ready', 'kb_id': kb_id})}\n\n"
        while True:
            if await request.is_disconnected():
                break
            alerts = await asyncio.to_thread(
                knowledge.list_kb_alerts_since,
                kb_id,
                since_created_at=cursor,
                limit=20,
            )
            for alert in alerts:
                cursor = alert["created_at"]
                yield f"data: {json.dumps({'type': 'alert', 'alert': alert}, ensure_ascii=False)}\n\n"
            await asyncio.sleep(2)

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )
