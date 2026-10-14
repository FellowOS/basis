"""Knowledge-base chat playground (MCP-backed tools)."""

from __future__ import annotations

import asyncio
from typing import Any, Literal

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_store, get_kb_for_viewer
from sema.chat.playground import run_kb_playground

router = APIRouter(prefix="/api/kbs", tags=["knowledge-bases"])


class PlaygroundMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str = Field(min_length=1)


class PlaygroundRequest(BaseModel):
    messages: list[PlaygroundMessage] = Field(min_length=1)


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
