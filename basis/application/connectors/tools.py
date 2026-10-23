"""Connector manifest tool execution use case."""

from __future__ import annotations

from typing import Any

from basis.application.connectors import authz
from basis.application.kernel import WorkspaceCoreContext
from basis.domain.errors import AdminError


def execute_tool(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    service = str(args.get("service") or "").strip()
    tool_id = str(args.get("tool_id") or "").strip()
    connection_name = str(args.get("connection_name") or "default").strip() or "default"
    connection_scope = str(args.get("connection_scope") or "workspace").strip() or "workspace"
    subject_id_raw = args.get("subject_id")
    subject_id = (
        str(subject_id_raw).strip()
        if subject_id_raw is not None and str(subject_id_raw).strip()
        else None
    )
    arguments = args.get("arguments")
    if not service or not tool_id:
        return {"error": "service and tool_id are required"}
    if arguments is not None and not isinstance(arguments, dict):
        return {"error": "arguments must be an object"}
    authz.require_workspace_editor(ctx)
    runtime = ctx.knowledge.connector_runtime()
    try:
        return runtime.execute_tool(
            ctx.workspace.id,
            service,
            tool_id,
            connection_name=connection_name,
            connection_scope=connection_scope,
            subject_id=subject_id,
            arguments=arguments or {},
        )
    except PermissionError as exc:
        return {"error": str(exc)}
    except (LookupError, ValueError) as exc:
        return {"error": str(exc)}
    except Exception as exc:
        return {"error": str(exc)}


def execute_tool_or_raise_http(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    from basis.application.connectors.operations import op_execute_connector_tool

    payload = op_execute_connector_tool(ctx, args)
    err = payload.get("error")
    if not err or not isinstance(err, str):
        return payload
    lowered = err.lower()
    if "not found" in lowered:
        raise AdminError(404, "connection_not_found", err)
    if "permission" in lowered or "policy" in lowered or "blocked" in lowered:
        raise AdminError(403, "connector_policy_blocked", err)
    raise AdminError(422, "connector_tool_execution_failed", err)
