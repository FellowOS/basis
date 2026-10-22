"""Entity writeback proposal use case."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import authz
from basis.application.connectors._helpers import connector_sync_service
from basis.application.context import WorkspaceCoreContext
from basis.domain.errors import AdminError


def propose_entity_writeback(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id") or "").strip()
    field_updates = args.get("field_updates")
    if not entity_id or not isinstance(field_updates, dict) or not field_updates:
        return {"error": "entity_id and non-empty field_updates are required"}
    authz.require_workspace_editor(ctx)
    svc = connector_sync_service(ctx)
    try:
        outbox = svc.propose_entity_writeback(
            ctx.workspace.id,
            entity_id=entity_id,
            field_updates=field_updates,
            created_by=ctx.user.id,
        )
        return {"outbox": outbox}
    except (LookupError, PermissionError, ValueError) as exc:
        return {"error": str(exc)}


def propose_entity_writeback_or_raise_http(
    ctx: WorkspaceCoreContext,
    *,
    entity_id: str,
    field_updates: dict[str, Any],
) -> dict[str, Any]:
    payload = propose_entity_writeback(
        ctx,
        {"entity_id": entity_id, "field_updates": field_updates},
    )
    err = payload.get("error")
    if not err or not isinstance(err, str):
        return payload
    if "not found" in err.lower():
        raise AdminError(404, "external_ref_not_found", err)
    if "permission" in err.lower():
        raise AdminError(403, "writeback_not_permitted", err)
    raise AdminError(422, "writeback_propose_failed", err)
