from fastapi import APIRouter, Depends, Request
from pydantic import BaseModel, Field

from basis.admin.store import AdminStore, User
from basis.api.deps import get_current_user, get_store

router = APIRouter(prefix="/api/auth", tags=["auth"])


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    display_name: str


class LoginRequest(BaseModel):
    email: str
    password: str


@router.post("/register")
async def register(body: RegisterRequest, store: AdminStore = Depends(get_store)) -> dict:
    user, token = store.register(body.email, body.password, body.display_name)
    return {"user": user.public(), "token": token}


@router.post("/login")
async def login(body: LoginRequest, store: AdminStore = Depends(get_store)) -> dict:
    user, token = store.login(body.email, body.password)
    return {"user": user.public(), "token": token}


@router.post("/logout")
async def logout(
    request: Request,
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
) -> dict:
    store.logout(request.state.token, user.id)
    return {"ok": True}


@router.get("/me")
async def me(user: User = Depends(get_current_user)) -> dict:
    return {"user": user.public()}
