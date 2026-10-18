from typing import Literal

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_store, require_system_admin
from basis.platform.models.remote_models import fetch_remote_models
from basis.platform.models.setup_providers import ModelKind, get_provider, infer_provider_id, provider_payload, providers_for_kind

router = APIRouter(tags=["model-providers"])


class ProbeRequest(BaseModel):
    kind: Literal["llm", "embed"] = "llm"
    provider: str = ""
    api_key: str = ""
    api_base: str = ""


@router.get("")
async def list_model_providers(
    kind: ModelKind = "llm",
    user: User = Depends(get_current_user),
) -> dict:
    """List Model Providers. Requires session JWT (`sessionAuth`)."""
    require_system_admin(user)
    providers = providers_for_kind(kind)
    return {"kind": kind, "providers": [provider_payload(p) for p in providers]}


@router.post("/probe")
async def probe_remote_models(
    body: ProbeRequest,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Probe Remote Models. Requires session JWT (`sessionAuth`)."""
    require_system_admin(user)
    provider = get_provider(body.kind, body.provider or None)
    api_base = body.api_base.strip() or provider.default_api_base
    api_key = body.api_key.strip() or store.get_stored_model_api_key_for_probe(
        body.kind, body.provider, api_base
    )

    result = fetch_remote_models(api_key=api_key, api_base=api_base, kind=body.kind)
    if not result.get("ok"):
        err = result.get("error", "fetch_failed")
        messages = {
            "api_key_required": "请填写 API Key",
            "api_key_invalid": "API Key 包含异常字符",
            "api_base_required": "请填写 Base URL",
            "openai_missing": "未安装 openai 依赖",
            "models_empty": "没有获取到模型，请检查 API Key 与 Base URL",
        }
        return {"ok": False, "error": messages.get(str(err), str(err))}
    return result


@router.get("/resolve")
async def resolve_provider_from_settings(
    kind: ModelKind = "llm",
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """Resolve Provider From Settings. Requires session JWT (`sessionAuth`)."""
    require_system_admin(user)
    settings = store.get_settings()
    if kind == "llm":
        stored = settings.get("chat_provider") or ""
        base = settings.get("chat_base_url") or ""
    else:
        stored = settings.get("embed_provider") or ""
        base = settings.get("embed_base_url") or ""
    pid = infer_provider_id(kind, base, stored or None)
    return {"kind": kind, "provider": pid}
