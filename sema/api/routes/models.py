from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_store, require_system_admin

router = APIRouter(prefix="/api/models", tags=["models"])

ModelKind = Literal["llm", "embed"]


class CreateModelRequest(BaseModel):
    kind: ModelKind
    provider: str = ""
    api_base: str = ""
    model: str = ""
    api_key: str = ""
    display_name: str | None = None
    enabled: bool = True


class PatchModelRequest(BaseModel):
    enabled: bool | None = None
    api_key: str | None = None


@router.get("")
async def list_models(
    kind: ModelKind | None = None,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    models = store.list_configured_models(kind)
    return {"models": models}


@router.post("")
async def create_model(
    body: CreateModelRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    entry = store.add_configured_model(
        user,
        body.kind,
        provider=body.provider,
        api_base=body.api_base,
        model=body.model,
        api_key=body.api_key,
        display_name=body.display_name,
        enabled=body.enabled,
    )
    return {"model": entry}


@router.patch("/{model_id}")
async def patch_model(
    model_id: str,
    body: PatchModelRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    entry = store.patch_configured_model(
        user,
        model_id,
        enabled=body.enabled,
        api_key=body.api_key,
    )
    return {"model": entry}


@router.delete("/{model_id}")
async def delete_model(
    model_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    store.delete_configured_model(user, model_id)
    return {"ok": True}
