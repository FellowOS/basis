from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel, Field

from basis.platform.admin.errors import AdminError
from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_store
from basis.platform.auth.settings import load_auth_settings_from_store

router = APIRouter(tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


def _auth_settings(request: Request):
    app_settings = request.app.state.settings
    public = f"http://{app_settings.host}:{app_settings.port}".rstrip("/")
    return load_auth_settings_from_store(
        request.app.state.store,
        default_public_url=public,
    )


@router.post("/register")
async def register(
    body: RegisterRequest,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Create a local account when password registration is enabled in platform settings.
    """
    auth = _auth_settings(request)
    if not auth.password_login_enabled:
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "密码注册未启用"})
    try:
        user, token = store.register(body.email, body.password, body.display_name)
    except AdminError as exc:
        raise HTTPException(status_code=exc.status, detail={"code": exc.code, "message": exc.message}) from exc
    return {"user": user.public(), "token": token}


@router.post("/login")
async def login(
    body: LoginRequest,
    request: Request,
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Authenticate with email and password. Returns a session Bearer token for platform and KB routes.
    """
    auth = _auth_settings(request)
    if not auth.password_login_enabled:
        raise HTTPException(status_code=403, detail={"code": "forbidden", "message": "密码登录未启用"})
    try:
        user, token = store.login(body.email, body.password)
    except AdminError as exc:
        raise HTTPException(status_code=exc.status, detail={"code": exc.code, "message": exc.message}) from exc
    return {"user": user.public(), "token": token}


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    """
Logout. Authentication and session bootstrap. Public bootstrap; optional session for personalized responses.
    """
    store.logout(request.state.token, user.id)
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict:
    """Return the current session user profile (requires session token)."""
    return {"user": user.public()}
