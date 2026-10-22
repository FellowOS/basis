"""Workspace-scoped execution context for integration operations (HTTP, MCP, chat tools)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any, Callable

from basis.domain.tenancy.admin.store import AdminStore, User, Workspace

from basis.domain.graph.session.registry import GraphRuntime
from basis.domain.graph.projection.projection_lifecycle import GraphProjectionBindings
from basis.domain.knowledge.blob_store import BlobStore
from basis.domain.knowledge.search import ChunkSearchService
from basis.domain.knowledge.store import KnowledgeStore


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

    def graph_runtime(self) -> GraphRuntime:
        if self.runtime is not None:
            return self.runtime
        if self.runtime_loader is None:
            raise RuntimeError("graph runtime is unavailable")
        return self.runtime_loader()


# Backward-compatible alias (MCP / chat).
WorkspaceToolContext = WorkspaceCoreContext
