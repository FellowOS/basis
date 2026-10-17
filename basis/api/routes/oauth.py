"""OAuth / OIDC / magic-link auth routes."""

from __future__ import annotations

import urllib.parse
from typing import Any

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr

from basis.admin.store import AdminStore
from basis.api.deps import get_store
from basis.auth.magic_link import deliver_magic_link
from basis.auth.oauth_client import (
    build_oidc_authorize_url,
    exchange_github_code,
    exchange_google_code,
    exchange_oidc_code,
    fetch_github_user,
    fetch_google_userinfo,
    fetch_oidc_metadata,
    fetch_oidc_userinfo,
)
from basis.auth.settings import AuthSettings, load_auth_settings_from_store
from basis.auth.state import new_nonce, sign_oauth_state, verify_oauth_state

router = APIRouter(prefix="/api/auth", tags=["auth"])


def _default_public_url(request: Request) -> str:
    app_settings = request.app.state.settings
    return f"http://{app_settings.host}:{app_settings.port}".rstrip("/")


def _auth_settings(request: Request) -> AuthSettings:
    cached = getattr(request.app.state, "auth_settings", None)
    if cached is not None:
        return cached
    store = request.app.state.store
    settings = load_auth_settings_from_store(
        store,
        default_public_url=_default_public_url(request),
    )
    request.app.state.auth_settings = settings
    return settings


def _redirect_with_token(settings: AuthSettings, token: str) -> RedirectResponse:
    query = urllib.parse.urlencode({"basis_token": token})
    return RedirectResponse(url=f"{settings.web_origin}/?{query}", status_code=302)


@router.get("/providers")
async def auth_providers(request: Request) -> dict[str, Any]:
    settings = _auth_settings(request)
    return {
        "password": settings.password_login_enabled,
        "github": settings.github_enabled,
        "google": settings.google_enabled,
        "magic_link": settings.magic_link_available,
        "org_oidc": True,
    }


@router.get("/oauth/github/start")
async def github_start(request: Request) -> RedirectResponse:
    settings = _auth_settings(request)
    if not settings.github_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "GitHub OAuth 未配置"})
    state = sign_oauth_state(
        settings.state_secret,
        {"provider": "github", "nonce": new_nonce()},
    )
    params = urllib.parse.urlencode(
        {
            "client_id": settings.github_client_id,
            "redirect_uri": settings.oauth_callback_url("/api/auth/oauth/github/callback"),
            "scope": "read:user user:email",
            "state": state,
        }
    )
    return RedirectResponse(f"https://github.com/login/oauth/authorize?{params}")


@router.get("/oauth/github/callback")
async def github_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    settings = _auth_settings(request)
    if not settings.github_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "GitHub OAuth 未配置"})
    try:
        verify_oauth_state(settings.state_secret, state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 state"}) from exc
    redirect_uri = settings.oauth_callback_url("/api/auth/oauth/github/callback")
    token_data = await exchange_github_code(
        client_id=settings.github_client_id or "",
        client_secret=settings.github_client_secret or "",
        code=code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_github_user(token_data["access_token"])
    subject = str(profile.get("id") or "")
    if not subject:
        raise HTTPException(status_code=502, detail={"code": "upstream", "message": "GitHub 未返回用户 ID"})
    user, session = store.login_or_register_federated(
        provider="github",
        subject=subject,
        email=profile.get("email"),
        display_name=profile.get("name") or profile.get("login"),
        organization_id=None,
        issuer=None,
    )
    _ = user
    return _redirect_with_token(settings, session)


@router.get("/oauth/google/start")
async def google_start(request: Request) -> RedirectResponse:
    settings = _auth_settings(request)
    if not settings.google_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "Google OAuth 未配置"})
    state = sign_oauth_state(
        settings.state_secret,
        {"provider": "google", "nonce": new_nonce()},
    )
    params = urllib.parse.urlencode(
        {
            "client_id": settings.google_client_id,
            "redirect_uri": settings.oauth_callback_url("/api/auth/oauth/google/callback"),
            "response_type": "code",
            "scope": "openid email profile",
            "state": state,
            "access_type": "online",
            "prompt": "select_account",
        }
    )
    return RedirectResponse(f"https://accounts.google.com/o/oauth2/v2/auth?{params}")


@router.get("/oauth/google/callback")
async def google_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    settings = _auth_settings(request)
    if not settings.google_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "Google OAuth 未配置"})
    try:
        verify_oauth_state(settings.state_secret, state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 state"}) from exc
    redirect_uri = settings.oauth_callback_url("/api/auth/oauth/google/callback")
    token_data = await exchange_google_code(
        client_id=settings.google_client_id or "",
        client_secret=settings.google_client_secret or "",
        code=code,
        redirect_uri=redirect_uri,
    )
    profile = await fetch_google_userinfo(token_data["access_token"])
    subject = str(profile.get("sub") or "")
    if not subject:
        raise HTTPException(status_code=502, detail={"code": "upstream", "message": "Google 未返回 sub"})
    user, session = store.login_or_register_federated(
        provider="google",
        subject=subject,
        email=profile.get("email"),
        display_name=profile.get("name"),
        organization_id=None,
        issuer=None,
    )
    _ = user
    return _redirect_with_token(settings, session)


@router.get("/oidc/{org_slug}/start")
async def org_oidc_start(
    org_slug: str,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    settings = _auth_settings(request)
    org = store.get_org_by_slug(org_slug)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_oidc_config(org.id)
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SSO 未配置"})
    metadata = await fetch_oidc_metadata(cfg["issuer"])
    state = sign_oauth_state(
        settings.state_secret,
        {"provider": "oidc", "org_id": org.id, "nonce": new_nonce()},
    )
    redirect_uri = settings.oauth_callback_url("/api/auth/oidc/callback")
    url = build_oidc_authorize_url(
        metadata,
        client_id=cfg["client_id"],
        redirect_uri=redirect_uri,
        scope=cfg["scopes"],
        state=state,
    )
    return RedirectResponse(url)


@router.get("/oidc/callback")
async def org_oidc_callback(
    request: Request,
    code: str = Query(...),
    state: str = Query(...),
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    settings = _auth_settings(request)
    try:
        payload = verify_oauth_state(settings.state_secret, state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 state"}) from exc
    org_id = payload.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "缺少 org_id"})
    cfg = store.get_org_oidc_config(str(org_id))
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SSO 未配置"})
    metadata = await fetch_oidc_metadata(cfg["issuer"])
    redirect_uri = settings.oauth_callback_url("/api/auth/oidc/callback")
    token_data = await exchange_oidc_code(
        metadata,
        client_id=cfg["client_id"],
        client_secret=cfg["client_secret"],
        code=code,
        redirect_uri=redirect_uri,
    )
    userinfo = await fetch_oidc_userinfo(metadata, token_data["access_token"])
    subject = str(userinfo.get("sub") or "")
    if not subject:
        raise HTTPException(status_code=502, detail={"code": "upstream", "message": "IdP 未返回 sub"})
    user, session = store.login_or_register_federated(
        provider="oidc",
        subject=subject,
        email=userinfo.get("email"),
        display_name=userinfo.get("name") or userinfo.get("preferred_username"),
        organization_id=str(org_id),
        issuer=cfg["issuer"],
    )
    _ = user
    return _redirect_with_token(settings, session)


class MagicLinkRequest(BaseModel):
    email: EmailStr


@router.post("/magic-link/request")
async def magic_link_request(
    body: MagicLinkRequest,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> dict[str, bool]:
    settings = _auth_settings(request)
    if not settings.magic_link_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "邮箱登录未启用"})
    if not settings.magic_link_available:
        raise HTTPException(status_code=503, detail={"code": "not_configured", "message": "Magic Link 邮件未配置"})
    org = store.resolve_org_by_email_domain(body.email)
    org_id = org.id if org else None
    token = store.create_magic_link(body.email, organization_id=org_id)
    q = urllib.parse.urlencode({"token": token})
    link = f"{settings.public_url}/api/auth/magic-link/verify?{q}"
    deliver_magic_link(settings, email=body.email, link=link)
    return {"ok": True}


def _normalize_magic_link_token(raw: str) -> str:
    return raw.strip().strip(".").strip()


@router.get("/magic-link/verify")
async def magic_link_verify(
    request: Request,
    token: str = Query(...),
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    from basis.admin.errors import AdminError

    settings = _auth_settings(request)
    cleaned = _normalize_magic_link_token(token)
    try:
        _user, session = store.consume_magic_link(cleaned)
    except AdminError as exc:
        if exc.code in ("invalid_token", "registration_closed"):
            query = urllib.parse.urlencode({"magic_link_error": exc.code})
            return RedirectResponse(
                url=f"{settings.web_origin}/login?{query}",
                status_code=302,
            )
        raise
    return _redirect_with_token(settings, session)
