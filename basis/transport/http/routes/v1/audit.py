from fastapi import APIRouter, Depends, Query

from basis.platform.admin.store import AdminStore, User
from basis.transport.http.deps import get_current_user, get_store, require_system_admin

router = APIRouter(tags=["audit"])


@router.get("")
async def list_audit(
    user: User = Depends(get_current_user),
    store: AdminStore = Depends(get_store),
    kb_id: str | None = Query(None),
    action_prefix: str | None = Query(None),
    limit: int = Query(100, ge=1, le=200),
) -> dict:
    """
List Audit. Platform audit log (admin). Requires session JWT (`sessionAuth`).
    """
    require_system_admin(user)
    if kb_id:
        events = store.list_audit_for_kb(
            kb_id,
            action_prefix=action_prefix,
            limit=limit,
        )
    else:
        events = store.list_audit(limit=limit, action_prefix=action_prefix)
    return {"events": events}
