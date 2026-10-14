from fastapi import APIRouter, Depends, Response
from pydantic import BaseModel, Field

from sema.admin.errors import AdminError
from sema.admin.store import User
from sema.api.deps import get_current_user

router = APIRouter(prefix="/api/reason", tags=["reasoning"])


class ReasonRequest(BaseModel):
    facts: list[str] = Field(min_length=1)
    rules: list[str] = Field(default_factory=list)


@router.post("")
async def reason(
    body: ReasonRequest,
    response: Response,
    user: User = Depends(get_current_user),
) -> dict:
    del user, body
    response.headers["Deprecation"] = "true"
    response.headers["Link"] = '</api/kbs/{kb_id}/reasoning/run>; rel="successor-version"'
    raise AdminError(
        410,
        "reason_endpoint_removed",
        "全局 /api/reason 已停用，请使用 POST /api/kbs/{kb_id}/reasoning/run（Explorer 推理工作台）",
    )
