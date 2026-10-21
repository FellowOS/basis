"""API tokens scoped to one knowledge base."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore, User
from basis.api.http.deps import get_current_user, get_kb_for_admin, get_store

router = APIRouter(tags=["knowledge-bases"])


class CreateKbApiTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    scope: str = "read"
    expires_at: str | None = None


def _tokens_for_kb(store: AdminStore, user: User, kb_id: str) -> list:
    return [t for t in store.list_api_tokens(user) if kb_id in t.kb_ids]


@router.get("/{kb_id}/tokens")
async def list_kb_tokens(
    kb_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
List Kb Tokens. Manage KB API tokens (session + KB admin only). Requires session JWT (`sessionAuth`).
    """
    get_kb_for_admin(request, user, kb_id, store)
    tokens = _tokens_for_kb(store, user, kb_id)
    return {"tokens": [t.public() for t in tokens]}


@router.post("/{kb_id}/tokens")
async def create_kb_token(
    kb_id: str,
    body: CreateKbApiTokenRequest,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Create Kb Token. Manage KB API tokens (session + KB admin only). Requires session JWT (`sessionAuth`).
    """
    get_kb_for_admin(request, user, kb_id, store)
    record, plaintext = store.create_api_token(
        user,
        name=body.name,
        scope=body.scope,
        kb_ids=[kb_id],
        expires_at=body.expires_at,
    )
    return {"token": record.public(), "secret": plaintext}


@router.delete("/{kb_id}/tokens/{token_id}")
async def delete_kb_token(
    kb_id: str,
    token_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, str]:
    """
Delete Kb Token. Manage KB API tokens (session + KB admin only). Requires session JWT (`sessionAuth`).
    """
    get_kb_for_admin(request, user, kb_id, store)
    matches = [t for t in _tokens_for_kb(store, user, kb_id) if t.id == token_id]
    if not matches:
        raise AdminError(404, "not_found", "令牌不存在或不属于此知识库")
    store.delete_api_token(user, token_id)
    return {"status": "deleted"}
