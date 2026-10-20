"""OAuth / OIDC / magic-link auth routes."""

from __future__ import annotations

import urllib.parse
from typing import Any

from fastapi import APIRouter, Depends, Form, HTTPException, Query, Request
from fastapi.responses import RedirectResponse, Response
from pydantic import BaseModel, EmailStr

from basis.core.errors import AdminError
from basis.control.admin.store import AdminStore
from basis.api.http.deps import get_store
from basis.control.identity.magic_link import deliver_magic_link
from basis.control.identity.oauth_client import (
    build_oidc_authorize_url,
    exchange_github_code,
    exchange_google_code,
    exchange_oidc_code,
    fetch_github_user,
    fetch_google_userinfo,
    fetch_oidc_metadata,
    fetch_oidc_userinfo,
)
from basis.control.identity.settings import AuthSettings, load_auth_settings_from_store
from basis.control.identity.org_login_policy import assert_local_login_allowed
from basis.control.identity.state import new_nonce, sign_oauth_state, verify_oauth_state
from basis.control.identity.http_paths import auth_v1_path
from basis.control.identity.saml_capabilities import saml_sp_available
from basis.control.identity.saml_client import (
    build_saml_settings,
    saml_login_redirect_url,
    saml_logout_redirect_url,
    saml_metadata_xml,
    saml_process_acs,
    saml_process_slo,
)

router = APIRouter(tags=["auth"])


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


@router.get("/org-sso-options")
async def org_sso_options(
    request: Request,
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Org Sso Options. List organizations with enabled OIDC for login-page SSO buttons (no email required).
    """
    settings = _auth_settings(request)
    public = settings.public_url.rstrip("/")
    options: list[dict[str, Any]] = []
    for org in store.list_enabled_org_sso_public():
        if store.get_org_oidc_config(org.id) is not None:
            login_path = auth_v1_path(f"oidc/{org.slug}/start")
            options.append(
                {
                    "organization_id": org.id,
                    "org_slug": org.slug,
                    "org_name": org.name,
                    "auth_policy": org.auth_policy,
                    "protocol": "oidc",
                    "login_path": login_path,
                    "login_url": f"{public}{login_path}",
                }
            )
        if store.get_org_saml_config(org.id) is not None:
            login_path = auth_v1_path(f"saml/{org.slug}/start")
            options.append(
                {
                    "organization_id": org.id,
                    "org_slug": org.slug,
                    "org_name": org.name,
                    "auth_policy": org.auth_policy,
                    "protocol": "saml",
                    "login_path": login_path,
                    "login_url": f"{public}{login_path}",
                }
            )
    return {"options": options}


@router.get("/org-sso-hint")
async def org_sso_hint(
    request: Request,
    email: str = Query(..., min_length=3),
    store: AdminStore = Depends(get_store),
) -> dict[str, Any]:
    """
Org Sso Hint. Resolve enabled org OIDC login by email domain (F-ACC-07).
    """
    match = store.resolve_org_sso_for_email(email.strip())
    if match is None:
        return {"available": False}
    org, protocol = match
    settings = _auth_settings(request)
    login_path = auth_v1_path(f"{protocol}/{org.slug}/start")
    public = settings.public_url.rstrip("/")
    policy = org.auth_policy
    return {
        "available": True,
        "organization_id": org.id,
        "org_slug": org.slug,
        "org_name": org.name,
        "auth_policy": policy,
        "protocol": protocol,
        "password_login_allowed": policy != "sso_required",
        "login_path": login_path,
        "login_url": f"{public}{login_path}",
    }


@router.get("/providers")
async def auth_providers(request: Request) -> dict[str, Any]:
    """
Auth Providers. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    settings = _auth_settings(request)
    return {
        "password": settings.password_login_enabled,
        "github": settings.github_enabled,
        "google": settings.google_enabled,
        "magic_link": settings.magic_link_available,
        "org_oidc": True,
        "org_saml": saml_sp_available(),
    }


@router.get("/oauth/github/start")
async def github_start(request: Request) -> RedirectResponse:
    """
Github Start. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
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
            "redirect_uri": settings.oauth_callback_url(auth_v1_path("oauth/github/callback")),
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
    """
Github Callback. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    settings = _auth_settings(request)
    if not settings.github_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "GitHub OAuth 未配置"})
    try:
        verify_oauth_state(settings.state_secret, state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 state"}) from exc
    redirect_uri = settings.oauth_callback_url(auth_v1_path("oauth/github/callback"))
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
    """
Google Start. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
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
            "redirect_uri": settings.oauth_callback_url(auth_v1_path("oauth/google/callback")),
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
    """
Google Callback. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    settings = _auth_settings(request)
    if not settings.google_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "Google OAuth 未配置"})
    try:
        verify_oauth_state(settings.state_secret, state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 state"}) from exc
    redirect_uri = settings.oauth_callback_url(auth_v1_path("oauth/google/callback"))
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
    """
Org Oidc Start. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
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
    redirect_uri = settings.oauth_callback_url(auth_v1_path("oidc/callback"))
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
    """
Org Oidc Callback. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
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
    redirect_uri = settings.oauth_callback_url(auth_v1_path("oidc/callback"))
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


def _saml_sp_entity_id(settings: AuthSettings, org_slug: str, cfg: dict[str, Any]) -> str:
    override = (cfg.get("sp_entity_id") or "").strip()
    if override:
        return override
    return f"{settings.public_url.rstrip('/')}{auth_v1_path(f'saml/{org_slug}/metadata')}"


def _saml_settings_for_org(
    settings: AuthSettings,
    org_slug: str,
    cfg: dict[str, Any],
) -> dict[str, Any]:
    acs_url = settings.oauth_callback_url(auth_v1_path("saml/acs"))
    sp_slo_url = settings.oauth_callback_url(auth_v1_path("saml/slo"))
    sp_entity_id = _saml_sp_entity_id(settings, org_slug, cfg)
    return build_saml_settings(
        sp_entity_id=sp_entity_id,
        acs_url=acs_url,
        idp_entity_id=cfg["idp_entity_id"],
        idp_sso_url=cfg["idp_sso_url"],
        idp_x509_cert=cfg["idp_x509_cert"],
        authn_requests_signed=bool(cfg.get("authn_requests_signed")),
        sp_x509_cert=cfg.get("sp_x509_cert"),
        sp_private_key=cfg.get("sp_private_key"),
        slo_enabled=bool(cfg.get("slo_enabled")),
        idp_slo_url=cfg.get("idp_slo_url"),
        sp_slo_url=sp_slo_url,
    )


@router.get("/saml/{org_slug}/metadata")
async def org_saml_metadata(
    org_slug: str,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> Response:
    """
Org Saml Metadata. SP metadata XML for IdP configuration (F-ACC-07 SAML).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    org = store.get_org_by_slug(org_slug)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_saml_config(org.id)
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SAML 未配置"})
    saml_settings = _saml_settings_for_org(settings, org.slug, cfg)
    xml = saml_metadata_xml(saml_settings)
    return Response(content=xml, media_type="application/samlmetadata+xml")


@router.get("/saml/{org_slug}/start")
async def org_saml_start(
    org_slug: str,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    """
Org Saml Start. SP-initiated SAML login (F-ACC-07).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    org = store.get_org_by_slug(org_slug)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_saml_config(org.id)
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SAML 未配置"})
    relay_state = sign_oauth_state(
        settings.state_secret,
        {"provider": "saml", "org_id": org.id, "nonce": new_nonce()},
    )
    saml_settings = _saml_settings_for_org(settings, org.slug, cfg)
    try:
        redirect_url = saml_login_redirect_url(request, saml_settings, relay_state=relay_state)
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": str(exc)},
        ) from exc
    return RedirectResponse(redirect_url)


@router.post("/saml/acs")
async def org_saml_acs(
    request: Request,
    SAMLResponse: str = Form(...),  # noqa: N803
    RelayState: str = Form(""),  # noqa: N803
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    """
Org Saml Acs. SAML assertion consumer (POST binding, F-ACC-07).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    try:
        payload = verify_oauth_state(settings.state_secret, RelayState)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 RelayState"}) from exc
    org_id = payload.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "缺少 org_id"})
    org = store.get_org_by_id(str(org_id))
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_saml_config(str(org_id))
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SAML 未配置"})
    saml_settings = _saml_settings_for_org(settings, org.slug, cfg)
    try:
        profile = saml_process_acs(
            request,
            saml_settings,
            saml_response=SAMLResponse,
            relay_state=RelayState,
        )
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "saml_failed", "message": str(exc)}) from exc
    subject = str(profile.get("subject") or "")
    if not subject:
        raise HTTPException(status_code=502, detail={"code": "upstream", "message": "IdP 未返回 NameID"})
    user, session = store.login_or_register_federated(
        provider="saml",
        subject=subject,
        email=profile.get("email"),
        display_name=profile.get("display_name"),
        organization_id=str(org_id),
        issuer=cfg["idp_entity_id"],
    )
    _ = user
    return _redirect_with_token(settings, session)


def _saml_slo_finish(
    request: Request,
    settings: AuthSettings,
    store: AdminStore,
    relay_state: str,
    *,
    post_data: dict[str, str] | None = None,
) -> RedirectResponse:
    if not relay_state:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "缺少 RelayState"})
    try:
        payload = verify_oauth_state(settings.state_secret, relay_state)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "无效 RelayState"}) from exc
    org_id = payload.get("org_id")
    if not org_id:
        raise HTTPException(status_code=400, detail={"code": "bad_state", "message": "缺少 org_id"})
    org = store.get_org_by_id(str(org_id))
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_saml_config(str(org_id))
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SAML 未配置"})
    if not cfg.get("slo_enabled"):
        raise HTTPException(status_code=400, detail={"code": "slo_disabled", "message": "组织未启用 SAML SLO"})
    saml_settings = _saml_settings_for_org(settings, org.slug, cfg)
    try:
        redirect = saml_process_slo(request, saml_settings, post_data=post_data)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail={"code": "saml_slo_failed", "message": str(exc)}) from exc
    target = redirect or f"{settings.web_origin}/login"
    return RedirectResponse(target, status_code=302)


@router.get("/saml/{org_slug}/logout")
async def org_saml_logout_start(
    org_slug: str,
    request: Request,
    name_id: str = Query(..., min_length=1),
    session_index: str = Query(""),
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    """
Org Saml Logout Start. SP-initiated SAML single logout (F-ACC-07).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    org = store.get_org_by_slug(org_slug)
    if org is None:
        raise HTTPException(status_code=404, detail={"code": "not_found", "message": "组织不存在"})
    cfg = store.get_org_saml_config(org.id)
    if cfg is None:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "组织 SAML 未配置"})
    if not cfg.get("slo_enabled"):
        raise HTTPException(status_code=400, detail={"code": "slo_disabled", "message": "组织未启用 SAML SLO"})
    relay_state = sign_oauth_state(
        settings.state_secret,
        {"provider": "saml", "org_id": org.id, "flow": "slo", "nonce": new_nonce()},
    )
    saml_settings = _saml_settings_for_org(settings, org.slug, cfg)
    try:
        redirect_url = saml_logout_redirect_url(
            request,
            saml_settings,
            name_id=name_id,
            session_index=session_index or None,
            relay_state=relay_state,
        )
    except RuntimeError as exc:
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": str(exc)},
        ) from exc
    if not redirect_url:
        raise HTTPException(status_code=502, detail={"code": "upstream", "message": "IdP 未返回 SLO URL"})
    return RedirectResponse(redirect_url, status_code=302)


@router.get("/saml/slo")
async def org_saml_slo_get(
    request: Request,
    RelayState: str = Query(""),  # noqa: N803
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    """
Org Saml Slo. SAML single logout response (HTTP-Redirect, F-ACC-07).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    return _saml_slo_finish(request, settings, store, RelayState)


@router.post("/saml/slo")
async def org_saml_slo_post(
    request: Request,
    RelayState: str = Form(""),  # noqa: N803
    SAMLResponse: str = Form(""),  # noqa: N803
    SAMLRequest: str = Form(""),  # noqa: N803
    store: AdminStore = Depends(get_store),
) -> RedirectResponse:
    """
Org Saml Slo. SAML single logout response (HTTP-POST, F-ACC-07).
    """
    if not saml_sp_available():
        raise HTTPException(
            status_code=503,
            detail={"code": "saml_unavailable", "message": "SAML 未安装（uv sync --extra saml）"},
        )
    settings = _auth_settings(request)
    post_data: dict[str, str] = {"RelayState": RelayState}
    if SAMLResponse:
        post_data["SAMLResponse"] = SAMLResponse
    if SAMLRequest:
        post_data["SAMLRequest"] = SAMLRequest
    return _saml_slo_finish(request, settings, store, RelayState, post_data=post_data)


class MagicLinkRequest(BaseModel):
    email: EmailStr


@router.post("/magic-link/request")
async def magic_link_request(
    body: MagicLinkRequest,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> dict[str, bool]:
    """
Magic Link Request. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    settings = _auth_settings(request)
    if not settings.magic_link_enabled:
        raise HTTPException(status_code=404, detail={"code": "not_configured", "message": "邮箱登录未启用"})
    if not settings.magic_link_available:
        raise HTTPException(status_code=503, detail={"code": "not_configured", "message": "Magic Link 邮件未配置"})
    try:
        assert_local_login_allowed(store, body.email)
    except AdminError as exc:
        raise HTTPException(
            status_code=exc.status,
            detail={"code": exc.code, "message": exc.message},
        ) from exc
    org = store.resolve_org_by_email_domain(body.email)
    org_id = org.id if org else None
    token = store.create_magic_link(body.email, organization_id=org_id)
    q = urllib.parse.urlencode({"token": token})
    link = f"{settings.oauth_callback_url(auth_v1_path('magic-link/verify'))}?{q}"
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
    """
Magic Link Verify. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    from basis.core.errors import AdminError

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
