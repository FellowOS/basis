"""Connection vault use cases (workspace + end_user / embed)."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import authz
from basis.application.connectors._helpers import mcp_connection_item
from basis.application.kernel import WorkspaceCoreContext
from basis.domain.connector import get_connector_catalog
from basis.domain.connector.connection_scope import (
    DEFAULT_END_USER_CONNECTION_NAME,
    SCOPE_END_USER,
)
from basis.domain.errors import AdminError


def _runtime(ctx: WorkspaceCoreContext):
    return ctx.knowledge.connector_runtime()


def _list_stored_connections(
    ctx: WorkspaceCoreContext,
    *,
    service: str | None = None,
    connection_scope: str | None = None,
    subject_id: str | None = None,
):
    authz.require_workspace_viewer(ctx)
    return _runtime(ctx).vault.list_connections(
        ctx.workspace.id,
        service=service,
        connection_scope=connection_scope,
        subject_id=subject_id,
    )


def list_connections(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    """MCP ``list_connector_connections`` (compact rows for agents)."""
    service = str(args.get("service") or "").strip() or None
    connection_scope = str(args.get("connection_scope") or "").strip() or None
    subject_id = str(args.get("subject_id") or "").strip() or None
    connections = _list_stored_connections(
        ctx,
        service=service,
        connection_scope=connection_scope,
        subject_id=subject_id,
    )
    return {"connections": [mcp_connection_item(c) for c in connections]}


def list_connections_public(
    ctx: WorkspaceCoreContext,
    *,
    service: str | None = None,
    connection_scope: str | None = None,
    subject_id: str | None = None,
) -> dict[str, Any]:
    """HTTP ``GET …/connectors/connections`` (console metadata incl. config + has_credentials)."""
    connections = _list_stored_connections(
        ctx,
        service=service,
        connection_scope=connection_scope,
        subject_id=subject_id,
    )
    return {"connections": [c.to_public_dict() for c in connections]}


def upsert_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    connection_name: str,
    connection_scope: str,
    subject_id: str | None,
    auth_type: str,
    connection_config: dict[str, Any],
    credentials: dict[str, Any],
) -> dict[str, Any]:
    authz.require_workspace_editor(ctx)
    if not get_connector_catalog().get(service):
        raise AdminError(404, "connector_not_found", f"未知的连接器服务: {service}")
    if connection_scope == SCOPE_END_USER and not (subject_id or "").strip():
        raise AdminError(422, "subject_id_required", "end_user 连接需要 subject_id")
    stored = _runtime(ctx).vault.upsert_connection(
        ctx.workspace.id,
        service,
        connection_name=connection_name,
        connection_scope=connection_scope,
        subject_id=subject_id,
        auth_type=auth_type,
        connection_config=connection_config,
        credentials=credentials,
    )
    return {"connection": stored.to_public_dict()}


def upsert_embed_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    subject_id: str,
    auth_type: str,
    connection_config: dict[str, Any],
    credentials: dict[str, Any],
) -> dict[str, Any]:
    return upsert_connection(
        ctx,
        service=service,
        connection_name=DEFAULT_END_USER_CONNECTION_NAME,
        connection_scope=SCOPE_END_USER,
        subject_id=subject_id.strip(),
        auth_type=auth_type,
        connection_config=connection_config,
        credentials=credentials,
    )


def delete_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    connection_name: str,
    connection_scope: str,
    subject_id: str | None,
) -> dict[str, Any]:
    authz.require_workspace_editor(ctx)
    deleted = _runtime(ctx).vault.delete_connection(
        ctx.workspace.id,
        service,
        connection_name=connection_name,
        connection_scope=connection_scope,
        subject_id=subject_id,
    )
    if not deleted:
        raise AdminError(404, "connection_not_found", "连接不存在")
    return {"deleted": True}


def delete_embed_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    subject_id: str,
) -> dict[str, Any]:
    return delete_connection(
        ctx,
        service=service,
        connection_name=DEFAULT_END_USER_CONNECTION_NAME,
        connection_scope=SCOPE_END_USER,
        subject_id=subject_id.strip(),
    )


def check_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    connection_name: str,
    connection_scope: str,
    subject_id: str | None,
) -> dict[str, Any]:
    authz.require_workspace_editor(ctx)
    try:
        profile = _runtime(ctx).check_connection(
            ctx.workspace.id,
            service,
            connection_name=connection_name,
            connection_scope=connection_scope,
            subject_id=subject_id,
        )
        return {"ok": True, "profile": profile}
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_check_failed", str(exc)) from exc


def check_embed_connection(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    subject_id: str,
) -> dict[str, Any]:
    return check_connection(
        ctx,
        service=service,
        connection_name=DEFAULT_END_USER_CONNECTION_NAME,
        connection_scope=SCOPE_END_USER,
        subject_id=subject_id.strip(),
    )


def discover_schema(
    ctx: WorkspaceCoreContext,
    *,
    service: str,
    connection_name: str,
    stream_name: str | None = None,
    external_table: str | None = None,
) -> dict[str, Any]:
    authz.require_workspace_viewer(ctx)
    try:
        info = _runtime(ctx).discover_schema(
            ctx.workspace.id,
            service,
            connection_name=connection_name,
            stream_name=stream_name,
            external_table=external_table,
        )
        return {
            "stream_name": info.stream_name,
            "display_name": info.display_name,
            "external_table": info.external_table,
            "primary_key": info.primary_key,
            "cursor_field": info.cursor_field,
            "fields": [f.model_dump(mode="json") for f in info.fields],
        }
    except LookupError as exc:
        raise AdminError(404, "connection_not_found", str(exc)) from exc
    except PermissionError as exc:
        raise AdminError(403, "connector_policy_blocked", str(exc)) from exc
    except Exception as exc:
        raise AdminError(422, "connector_discover_failed", str(exc)) from exc
