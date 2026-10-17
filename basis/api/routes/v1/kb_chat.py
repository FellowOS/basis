"""Knowledge-base chat playground (MCP-backed tools)."""

from __future__ import annotations

import asyncio
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_kb_for_editor, get_kb_for_viewer, get_knowledge_store, get_store
from basis.api.kb_core_context import build_kb_core_context
from basis.chat.playground import iter_kb_playground_sse, run_kb_playground
from basis.core.errors import CoreError
from basis.core.http import http_exception_from_core, http_response_from_payload
from basis.core.registry import run as core_run
from basis.knowledge.store import KnowledgeStore

router = APIRouter(tags=["knowledge-bases"])


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
) -> dict[str, Any]:
    ctx = build_kb_core_context(
        request,
        kb_id=kb_id,
        user=user,
        store=store,
        require_editor=True,
    )
    try:
        payload = await asyncio.to_thread(
            core_run,
            ctx,
            "propose_remember",
            {"content": body.content, "source": "chat"},
        )
    except CoreError as exc:
        raise http_exception_from_core(exc) from exc
    return http_response_from_payload(payload)
