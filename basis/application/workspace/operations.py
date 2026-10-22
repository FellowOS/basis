"""Workspace meta application services."""

from __future__ import annotations

from typing import Any

from basis.application.kernel import WorkspaceCoreContext


def op_describe_workspace(ctx: WorkspaceCoreContext, _args: dict[str, Any]) -> dict[str, Any]:
    stats = ctx.knowledge.workspace_mcp_stats(ctx.workspace.id)
    return {
        "workspace_id": ctx.workspace.id,
        "name": ctx.workspace.name,
        "description": ctx.workspace.description,
        **stats,
    }


def op_get_capabilities(ctx: WorkspaceCoreContext, _args: dict[str, Any]) -> dict[str, Any]:
    from basis.application.mcp import TOOL_NAMES
    from basis.infra.runtime.capabilities import workspace_capabilities

    _, role = ctx.store.get_workspace_for(ctx.user, ctx.workspace.id, "viewer")
    payload: dict[str, Any] = {
        "workspace_id": ctx.workspace.id,
        "role": role,
        **workspace_capabilities(role),
        "mcp_tools": list(TOOL_NAMES),
    }
    limits = ctx.runtime_limits
    if limits is not None:
        payload.update(
            {
                "graph_page_max_nodes": limits.graph_page_max_nodes,
                "graph_page_max_edges": limits.graph_page_max_edges,
                "chunk_search_max_limit": limits.chunk_search_max_limit,
                "graph_node_search_max_limit": limits.graph_node_search_max_limit,
                "upload_max_bytes": limits.upload_max_bytes,
                "import_max_bytes": limits.import_max_bytes,
                "ingest_max_inflight": limits.ingest_max_inflight,
                "ingest_max_pending": limits.ingest_max_pending,
                "processing_job_timeout_seconds": limits.processing_job_timeout_seconds,
                "ingest_max_extract_chars": limits.ingest_max_extract_chars,
            }
        )
    return payload


def op_list_processing_jobs(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> dict[str, Any]:
    status = str(args.get("status") or "").strip() or None
    if status and status not in {"queued", "running", "succeeded", "failed", "cancelled"}:
        return {"error": "invalid status"}
    limit = min(max(1, int(args.get("limit", 100))), 200)
    jobs = ctx.knowledge.list_processing_jobs(ctx.workspace.id, status=status, limit=limit)
    return {"jobs": jobs}
