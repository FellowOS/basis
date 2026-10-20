"""BOCP connector operations for MCP and integration callers."""

from __future__ import annotations

from datetime import date, datetime
from typing import Any

from basis.core.connectors import get_connector_catalog
from basis.core.connectors.primitive_invoke import execute_connector_primitive
from basis.core.ledger.schedulers.connector_mapping_poll_due import poll_interval_minutes_for_mapping
from basis.core.ledger.services.connector_sync import ConnectorLedgerSyncService
from fastapi import HTTPException

from basis.application.context import KbCoreContext
from basis.application.errors import CoreError


def _json_safe_cursor_watermark(value: Any) -> Any:
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    return value


def _require_kb_editor(ctx: KbCoreContext) -> None:
    try:
        if ctx.assert_kb_editor is not None:
            ctx.assert_kb_editor()
        else:
            ctx.store.get_kb_for(ctx.user, ctx.kb.id, "editor")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc


def _connector_service(ctx: KbCoreContext) -> ConnectorLedgerSyncService:
    return ctx.knowledge.connector_sync_service()


def _require_kb_viewer(ctx: KbCoreContext) -> None:
    try:
        ctx.store.get_kb_for(ctx.user, ctx.kb.id, "viewer")
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc


def _filter_manifests_for_kb(ctx: KbCoreContext, manifests: list[Any]) -> list[Any]:
    runtime = ctx.knowledge.connector_runtime()
    effective = runtime.vault.effective_allowed_providers(ctx.kb.id)
    if effective == "*":
        return manifests
    allowed = set(effective) if isinstance(effective, list) else set()
    return [m for m in manifests if m.service in allowed]


def _connector_summary(manifest: Any) -> dict[str, Any]:
    auth_modes = [a.auth_mode for a in (manifest.auth or [])]
    return {
        "service": manifest.service,
        "display_name": manifest.display_name,
        "description": manifest.description,
        "categories": list(manifest.categories or []),
        "auth_modes": auth_modes,
        "stream_count": len(manifest.streams or []),
        "tool_count": len(manifest.tools or []),
    }


def op_list_connector_catalog(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    _require_kb_viewer(ctx)
    query = str(args.get("query") or "").strip() or None
    limit = min(max(1, int(args.get("limit") or 25)), 100)
    has_streams_only = bool(args.get("has_streams_only"))
    catalog = get_connector_catalog()
    manifests = catalog.list_manifests(
        query=query,
        has_streams_only=has_streams_only,
    )
    manifests = _filter_manifests_for_kb(ctx, manifests)[:limit]
    return {
        "total_matched": len(manifests),
        "connectors": [_connector_summary(m) for m in manifests],
    }


def op_describe_connector_service(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    _require_kb_viewer(ctx)
    service = str(args.get("service") or "").strip()
    if not service:
        return {"error": "service is required"}
    catalog = get_connector_catalog()
    manifest = catalog.get(service)
    if not manifest:
        return {"error": f"unknown connector service: {service}"}
    filtered = _filter_manifests_for_kb(ctx, [manifest])
    if not filtered:
        return {"error": "connector not allowed by platform or KB policy"}
    m = filtered[0]
    return {
        "connector": {
            **_connector_summary(m),
            "streams": [
                {
                    "name": s.name,
                    "display_name": s.display_name,
                    "cursor_field": s.cursor_field,
                }
                for s in (m.streams or [])[:50]
            ],
            "tools": [
                {"id": t.id, "name": t.name, "description": t.description}
                for t in (m.tools or [])[:30]
            ],
        },
    }


def op_list_connector_connections(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    _require_kb_viewer(ctx)
    service = str(args.get("service") or "").strip() or None
    runtime = ctx.knowledge.connector_runtime()
    connections = runtime.vault.list_connections(ctx.kb.id, service=service)
    return {
        "connections": [
            {
                "service": c.service,
                "connection_name": c.connection_name,
                "auth_type": c.auth_type,
                "account_profile": c.account_profile,
                "updated_at": c.updated_at,
            }
            for c in connections
        ],
    }


def op_list_connector_table_mappings(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    _require_kb_viewer(ctx)
    svc = _connector_service(ctx)
    mapping_limit = min(max(1, int(args.get("limit") or 50)), 200)
    items: list[dict[str, Any]] = []
    for mapping_id in ctx.knowledge.list_source_table_mapping_ids(
        ctx.kb.id, limit=mapping_limit
    ):
        rec = svc.get_table_mapping(ctx.kb.id, mapping_id)
        if not rec:
            continue
        binding = svc.get_mapping_connection_binding(ctx.kb.id, rec.source_id)
        items.append(
            {
                "id": rec.id,
                "provider": binding.provider,
                "connection_name": binding.connection_name,
                "stream_name": rec.stream_name,
                "external_table": rec.external_table,
                "sync_direction": rec.sync_direction,
                "writeback_mode": rec.writeback_mode,
                "poll_interval_minutes": poll_interval_minutes_for_mapping(rec),
                "status": rec.status,
            },
        )
    return {"mappings": items}


def op_sync_connector_table_mapping(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    _require_kb_editor(ctx)
    mapping_id = str(args.get("mapping_id") or "").strip()
    if not mapping_id:
        return {"error": "mapping_id is required"}
    svc = _connector_service(ctx)
    try:
        stats = svc.sync_inbound_mapping(ctx.kb.id, mapping_id)
    except LookupError:
        return {"error": "mapping not found"}
    except Exception as exc:
        return {"error": str(exc)}
    if (
        ctx.rebuild_projection is not None
        and (stats.added > 0 or stats.updated > 0 or stats.deleted > 0)
    ):
        ctx.rebuild_projection()
    return {
        "mapping_id": stats.mapping_id,
        "external_table": stats.external_table,
        "fetched_rows": stats.fetched_rows,
        "added": stats.added,
        "updated": stats.updated,
        "unchanged": stats.unchanged,
        "deleted": stats.deleted,
        "new_cursor_watermark": _json_safe_cursor_watermark(stats.new_cursor_watermark),
    }


def op_invoke_connector_primitive(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    service = str(args.get("service") or "").strip()
    action_id = str(args.get("action_id") or "").strip()
    primitive = str(args.get("primitive") or "").strip().lower()
    connection_name = str(args.get("connection_name") or "default").strip() or "default"
    operation = str(args.get("operation") or "").strip() or None
    external_table = str(args.get("external_table") or "").strip() or None
    external_id = args.get("external_id")
    changes = args.get("changes")
    action_params = args.get("action_params")
    arguments = args.get("arguments")
    if not service or not action_id or not primitive:
        return {"error": "service, action_id, and primitive are required"}
    if action_params is not None and not isinstance(action_params, dict):
        return {"error": "action_params must be an object"}
    if changes is not None and not isinstance(changes, dict):
        return {"error": "changes must be an object"}
    if arguments is not None and not isinstance(arguments, dict):
        return {"error": "arguments must be an object"}
    limit = int(args.get("limit") or 500)
    cursor_watermark = args.get("cursor_watermark")
    primary_key_column = str(args.get("primary_key_column") or "id")
    cursor_column = args.get("cursor_column")
    cursor_column_str = str(cursor_column).strip() if cursor_column else None

    read_primitive = primitive in ("discover", "list")
    if read_primitive:
        _require_kb_viewer(ctx)
    else:
        _require_kb_editor(ctx)

    runtime = ctx.knowledge.connector_runtime()
    try:
        return execute_connector_primitive(
            runtime,
            ctx.kb.id,
            service,
            action_id=action_id,
            primitive=primitive,
            connection_name=connection_name,
            operation=operation,
            external_table=external_table,
            external_id=external_id,
            changes=changes,
            action_params=action_params,
            limit=limit,
            cursor_watermark=cursor_watermark,
            arguments=arguments,
            primary_key_column=primary_key_column,
            cursor_column=cursor_column_str,
        )
    except PermissionError as exc:
        return {"error": str(exc)}
    except (LookupError, ValueError) as exc:
        return {"error": str(exc)}
    except Exception as exc:
        return {"error": str(exc)}


def op_execute_connector_tool(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    service = str(args.get("service") or "").strip()
    tool_id = str(args.get("tool_id") or "").strip()
    connection_name = str(args.get("connection_name") or "default").strip() or "default"
    arguments = args.get("arguments")
    if not service or not tool_id:
        return {"error": "service and tool_id are required"}
    if arguments is not None and not isinstance(arguments, dict):
        return {"error": "arguments must be an object"}
    _require_kb_editor(ctx)
    runtime = ctx.knowledge.connector_runtime()
    try:
        return runtime.execute_tool(
            ctx.kb.id,
            service,
            tool_id,
            connection_name=connection_name,
            arguments=arguments or {},
        )
    except PermissionError as exc:
        return {"error": str(exc)}
    except (LookupError, ValueError) as exc:
        return {"error": str(exc)}
    except Exception as exc:
        return {"error": str(exc)}


def op_propose_entity_writeback(ctx: KbCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    entity_id = str(args.get("entity_id") or "").strip()
    field_updates = args.get("field_updates")
    if not entity_id or not isinstance(field_updates, dict) or not field_updates:
        return {"error": "entity_id and non-empty field_updates are required"}
    _require_kb_editor(ctx)
    svc = _connector_service(ctx)
    try:
        outbox = svc.propose_entity_writeback(
            ctx.kb.id,
            entity_id=entity_id,
            field_updates=field_updates,
            created_by=ctx.user.id,
        )
        return {"outbox": outbox}
    except (LookupError, PermissionError, ValueError) as exc:
        return {"error": str(exc)}
