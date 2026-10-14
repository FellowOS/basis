from fastapi import APIRouter, Depends
from pydantic import BaseModel

from sema.admin.store import AdminStore, User
from sema.api.deps import get_current_user, get_store, require_system_admin

router = APIRouter(prefix="/api/settings", tags=["settings"])


class SettingsRequest(BaseModel):
    open_registration: bool | None = None
    chat_provider: str | None = None
    chat_base_url: str | None = None
    chat_model: str | None = None
    chat_api_key: str | None = None
    embed_provider: str | None = None
    embed_base_url: str | None = None
    embed_model: str | None = None
    embed_api_key: str | None = None


@router.get("")
async def get_settings(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    return store.get_settings()


@router.put("")
async def put_settings(
    body: SettingsRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    require_system_admin(user)
    return store.update_settings(user, body.model_dump(exclude_unset=True))
