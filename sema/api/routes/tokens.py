"""API tokens for MCP and integrations."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends
from pydantic import BaseModel, Field

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_store

router = APIRouter(prefix="/api/tokens", tags=["tokens"])


class CreateApiTokenRequest(BaseModel):
    name: str = Field(min_length=1, max_length=64)
    scope: str = "read"
    kb_ids: list[str] = Field(min_length=1)
    expires_at: str | None = None


@router.get("")
async def list_tokens(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    tokens = store.list_api_tokens(user)
    return {"tokens": [t.public() for t in tokens]}


@router.post("")
async def create_token(
    body: CreateApiTokenRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    record, plaintext = store.create_api_token(
        user,
        name=body.name,
        scope=body.scope,
        kb_ids=body.kb_ids,
        expires_at=body.expires_at,
    )
    return {
        "token": record.public(),
        "secret": plaintext,
    }


@router.delete("/{token_id}")
async def revoke_token(
    token_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, str]:
    store.delete_api_token(user, token_id)
    return {"status": "deleted"}
