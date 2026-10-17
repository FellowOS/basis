"""Per-KB MCP over HTTP (JSON-RPC)."""

from __future__ import annotations

import asyncio
from typing import Any

from fastapi import APIRouter, Header, HTTPException, Request

from basis.admin.store import User
from basis.api.deps import (
    get_chunk_search,
    get_explorer_registry,
    get_kb_for_editor,
    get_kb_for_viewer,
    get_knowledge_store,
    get_store,
    resolve_bearer,
)
from basis.mcp.protocol import handle_batch
from basis.core import KbCoreContext, TOOL_NAMES
from basis.mcp.tools import PROTOCOL_VERSION

router = APIRouter(tags=["mcp"])


@router.get("/{kb_id}/mcp")
async def mcp_integration_info(
    kb_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> dict[str, Any]:
    user, _auth_kind = resolve_bearer(request, authorization)
    store = get_store(request)
    kb, _role = get_kb_for_viewer(request, user, kb_id, store)
    base = str(request.base_url).rstrip("/")
    mcp_url = f"{base}/api/v1/kbs/{kb_id}/mcp"
    return {
        "kb_id": kb_id,
        "kb_name": kb.name,
        "mcp_url": mcp_url,
        "transport": "http",
        "protocol_version": PROTOCOL_VERSION,
        "auth": {"type": "bearer", "header": "Authorization", "prefix": "Bearer "},
        "tools": list(TOOL_NAMES),
        "cursor_example": {
            "mcpServers": {
                "basis-kb": {
                    "url": mcp_url,
                    "headers": {"Authorization": "Bearer <your-api-token>"},
                }
            }
        },
    }


@router.post("/{kb_id}/mcp")
async def mcp_jsonrpc(
    kb_id: str,
    request: Request,
    authorization: str | None = Header(default=None),
) -> Any:
    user, _auth_kind = resolve_bearer(request, authorization)
    store = get_store(request)
    kb, _role = get_kb_for_viewer(request, user, kb_id, store)
    body = await request.json()
    knowledge = get_knowledge_store(request)
    ctx = KbCoreContext(
        kb=kb,
        user=user,
        knowledge=knowledge,
        store=store,
        chunk_search=get_chunk_search(request),
        runtime_loader=lambda: get_explorer_registry(request).get(request, kb_id),
        assert_kb_editor=lambda: get_kb_for_editor(request, user, kb_id, store),
    )
    semaphore: asyncio.Semaphore = request.app.state.mcp_semaphore
    try:
        await asyncio.wait_for(semaphore.acquire(), timeout=1.0)
    except TimeoutError as exc:
        raise HTTPException(
            status_code=429,
            detail={"code": "mcp_busy", "message": "MCP 请求过多，请稍后重试"},
        ) from exc
    try:
        return await asyncio.wait_for(
            asyncio.to_thread(handle_batch, ctx, body),
            timeout=request.app.state.settings.mcp_timeout_seconds,
        )
    except TimeoutError as exc:
        raise HTTPException(
            status_code=504,
            detail={"code": "mcp_timeout", "message": "MCP 工具执行超时"},
        ) from exc
    finally:
        semaphore.release()
