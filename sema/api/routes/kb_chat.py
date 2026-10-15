"""Knowledge-base chat playground (MCP-backed tools)."""

from __future__ import annotations

import asyncio
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_kb_for_editor, get_kb_for_viewer, get_knowledge_store, get_store
from sema.chat.playground import iter_kb_playground_sse, run_kb_playground
from sema.knowledge.remember_service import propose_remember
from sema.knowledge.store import KnowledgeStore

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class PlaygroundMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class PlaygroundRequest(BaseModel):
    messages: list[PlaygroundMessage] = Field(min_length=1)


class RememberRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)


def _next_playground_sse_frame(gen):
    try:
        return next(gen)
    except StopIteration:
        return None


@router.post("/{kb_id}/chat/playground")
async def kb_chat_playground(
    kb_id: str,
    body: PlaygroundRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    get_kb_for_viewer(request, user, kb_id, store)
    payload = [{"role": m.role, "content": m.content} for m in body.messages]
    return await asyncio.to_thread(run_kb_playground, request, kb_id, user, payload)


@router.post("/{kb_id}/chat/playground/stream")
async def kb_chat_playground_stream(
    kb_id: str,
    body: PlaygroundRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> StreamingResponse:
    get_kb_for_viewer(request, user, kb_id, store)
    payload = [{"role": m.role, "content": m.content} for m in body.messages]

    async def event_stream():
        loop = asyncio.get_running_loop()
        gen = iter_kb_playground_sse(request, kb_id, user, payload)
        try:
            while True:
                if await request.is_disconnected():
                    gen.close()
                    break
                frame = await loop.run_in_executor(None, _next_playground_sse_frame, gen)
                if frame is None:
                    break
                yield frame
        finally:
            gen.close()

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-cache", "X-Accel-Buffering": "no"},
    )


@router.post("/{kb_id}/chat/remember")
async def kb_chat_remember(
    kb_id: str,
    body: RememberRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    knowledge: KnowledgeStore = Depends(get_knowledge_store),
) -> dict[str, Any]:
    get_kb_for_editor(request, user, kb_id, store)
    return propose_remember(
        knowledge,
        kb_id,
        user.id,
        body.content,
        source="chat",
    )
