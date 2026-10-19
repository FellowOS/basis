"""Organization API (SSO config for org admins)."""

from __future__ import annotations

from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from basis.platform.admin.org_store import Organization
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_store
from basis.platform.auth.settings import load_auth_settings_from_store

router = APIRouter(tags=["organizations"])


class OrgOidcUpsert(BaseModel):
    issuer: str
    client_id: str
    client_secret: str = ""
    scopes: str = "openid email profile"
    email_domains: list[str] = Field(default_factory=list)
    enabled: bool = True
    auth_policy: str = "password_allowed"


def _auth_settings(request: Request):
    cached = getattr(request.app.state, "auth_settings", None)
    if cached is not None:
        return cached
    app_settings = request.app.state.settings
    public = f"http://{app_settings.host}:{app_settings.port}".rstrip("/")
    settings = load_auth_settings_from_store(
        request.app.state.store,
        default_public_url=public,
    )
    request.app.state.auth_settings = settings
    return settings


def _org_with_role(store: AdminStore, user: User, org: Organization) -> dict[str, Any]:
    role = store.org_role(org.id, user.id)
    payload = org.public()
    payload["my_org_role"] = role
    return payload


@router.get("")
async def list_orgs(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """List Orgs. Requires session JWT (`sessionAuth`)."""
    store.prepare_organization_sso_directory(actor=user)
    if user.is_admin:
        orgs = store.list_all_organizations()
    else:
        orgs = store.list_orgs_for_user(user.id)
    return {"organizations": [_org_with_role(store, user, o) for o in orgs]}


@router.get("/mine")
async def list_my_orgs(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
List My Orgs. Organizations and OIDC SSO. Requires session JWT (`sessionAuth`).
    """
    store.prepare_organization_sso_directory(actor=user)
    orgs = store.list_orgs_for_user(user.id)
    return {"organizations": [_org_with_role(store, user, o) for o in orgs]}


@router.get("/{org_id}")
async def get_org(
    org_id: str,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Get Org. Organizations and OIDC SSO. Requires session JWT (`sessionAuth`).
    """
    role = store.org_role(org_id, user.id)
    if role is None and not user.is_admin:
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "没有权限"})
    org = store.get_org_by_id(org_id)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    return {"organization": org.public(), "my_org_role": role}


@router.get("/{org_id}/oidc")
async def get_org_oidc(
    org_id: str,
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Get Org Oidc. Organizations and OIDC SSO. Requires session JWT (`sessionAuth`).
    """
    role = store.org_role(org_id, user.id)
    if role is None and not user.is_admin:
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "没有权限"})
    org = store.get_org_by_id(org_id)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    settings = _auth_settings(request)
    slug = org.slug
    login_path = f"/api/auth/oidc/{slug}/start"
    login_url = f"{settings.public_url}{login_path}"
    callback_url = settings.oauth_callback_url("/api/auth/oidc/callback")
    cfg = store.get_org_oidc_settings(org_id)
    can_edit = user.is_admin or (role is not None and role in ("owner", "admin"))
    if cfg is None:
        return {
            "configured": False,
            "can_edit": can_edit,
            "organization": org.public(),
            "login_path": login_path,
            "login_url": login_url,
            "callback_url": callback_url,
        }
    return {
        "configured": True,
        "can_edit": can_edit,
        "organization": org.public(),
        "issuer": cfg["issuer"],
        "client_id": cfg["client_id"],
        "scopes": cfg["scopes"],
        "email_domains": cfg["email_domains"],
        "enabled": cfg["enabled"],
        "auth_policy": org.auth_policy,
        "login_path": login_path,
        "login_url": login_url,
        "callback_url": callback_url,
    }


@router.put("/{org_id}/oidc")
async def put_org_oidc(
    org_id: str,
    body: OrgOidcUpsert,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Put Org Oidc. Organizations and OIDC SSO. Requires session JWT (`sessionAuth`).
    """
    cfg = store.upsert_org_oidc_config(
        user,
        org_id,
        issuer=body.issuer,
        client_id=body.client_id,
        client_secret=body.client_secret,
        scopes=body.scopes,
        email_domains=body.email_domains,
        enabled=body.enabled,
        auth_policy=body.auth_policy,
    )
    org = store.get_org_by_id(org_id)
    slug = org.slug if org else org_id
    return {"oidc": cfg, "login_path": f"/api/auth/oidc/{slug}/start"}
