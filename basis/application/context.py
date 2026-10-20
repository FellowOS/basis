"""KB-scoped execution context for integration operations (HTTP, MCP, chat tools)."""

from __future__ import annotations

from dataclasses import dataclass
from typing import TYPE_CHECKING, Any, Callable

from basis.control.admin.store import AdminStore, KnowledgeBase, User

if TYPE_CHECKING:
    from starlette.requests import Request
from basis.core.explorer.session.registry import KbExplorerRuntime
from basis.core.ledger.search import ChunkSearchService
from basis.core.ledger.store import KnowledgeStore


@dataclass(frozen=True)
class KbCoreContext:
    kb: KnowledgeBase
    user: User
    knowledge: KnowledgeStore
    store: AdminStore
    chunk_search: ChunkSearchService | None = None
    runtime: KbExplorerRuntime | None = None
    runtime_loader: Callable[[], KbExplorerRuntime] | None = None
    assert_kb_editor: Callable[[], None] | None = None
    rebuild_projection: Callable[[], Any] | None = None
    persist_graph: Callable[[str], None] | None = None
    http_request: Request | None = None

    def graph_runtime(self) -> KbExplorerRuntime:
        if self.runtime is not None:
            return self.runtime
        if self.runtime_loader is None:
            raise RuntimeError("graph runtime is unavailable")
        return self.runtime_loader()


# Backward-compatible alias (MCP / chat).
KbToolContext = KbCoreContext
