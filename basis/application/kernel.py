"""Shared application primitives: context, errors, workspace gates."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from fastapi import HTTPException

from basis.domain.errors import AdminError
from basis.domain.graph.projection.projection_lifecycle import GraphProjectionBindings
from basis.domain.graph.session.registry import GraphRuntime
from basis.domain.knowledge.blob_store import BlobStore
from basis.domain.knowledge.search import ChunkSearchService
from basis.domain.knowledge.store import KnowledgeStore
from basis.domain.tenancy.admin.store import AdminStore, User, Workspace
from basis.infra.runtime.limits import RuntimeLimits


@dataclass(frozen=True)
class WorkspaceCoreContext:
    workspace: Workspace
    user: User
    knowledge: KnowledgeStore
    store: AdminStore
    chunk_search: ChunkSearchService | None = None
    runtime: GraphRuntime | None = None
    runtime_loader: Callable[[], GraphRuntime] | None = None
    assert_workspace_editor: Callable[[], None] | None = None
    rebuild_projection: Callable[[], Any] | None = None
    persist_graph: Callable[[str], None] | None = None
    blob_store: BlobStore | None = None
    projection_bindings: GraphProjectionBindings | None = None
    runtime_limits: RuntimeLimits | None = None

    def graph_runtime(self) -> GraphRuntime:
        if self.runtime is not None:
            return self.runtime
        if self.runtime_loader is None:
            raise RuntimeError("graph runtime is unavailable")
        return self.runtime_loader()


WorkspaceToolContext = WorkspaceCoreContext


class CoreError(Exception):
    def __init__(self, detail: dict[str, Any], *, status_code: int = 403) -> None:
        self.detail = detail
        self.status_code = status_code
        super().__init__(detail)


def chunk_search_limit_max(ctx: WorkspaceCoreContext, args: dict[str, Any]) -> int:
    if args.get("limit_max") is not None:
        return max(1, int(args["limit_max"]))
    if ctx.runtime_limits is not None:
        return ctx.runtime_limits.chunk_search_max_limit
    return 30


def graph_search_max_limit(ctx: WorkspaceCoreContext, args: dict[str, Any], limit: int) -> int:
    if args.get("max_limit") is not None:
        return max(limit, int(args["max_limit"]))
    if ctx.runtime_limits is not None:
        return max(limit, ctx.runtime_limits.graph_node_search_max_limit)
    return limit


def require_workspace_editor(ctx: WorkspaceCoreContext) -> None:
    try:
        if ctx.assert_workspace_editor is not None:
            ctx.assert_workspace_editor()
        else:
            ctx.store.get_workspace_for(ctx.user, ctx.workspace.id, "editor")
    except AdminError as exc:
        raise CoreError(
            {"code": exc.code, "message": exc.message},
            status_code=exc.status,
        ) from exc
    except HTTPException as exc:
        detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
        raise CoreError(detail, status_code=exc.status_code) from exc
