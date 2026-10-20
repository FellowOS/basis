"""Per-KB Explorer GraphSession cache (read/index/analytics)."""

from __future__ import annotations

import threading
import time
from dataclasses import dataclass, field
from typing import Any

from basis.core.explorer.session.probe import build_kb_graph_adapter
from basis.core.projection.session import GraphSession
from basis.core.ledger.store import KnowledgeStore
from collections.abc import Callable


def _rebuild_explorer_wrapper(basis_session: GraphSession) -> Any:
    return build_kb_graph_adapter(basis_session)


def _explorer_wrapped_graph(explorer: Any | None) -> Any | None:
    if explorer is None:
        return None
    return getattr(explorer, "graph", None)


@dataclass
class KbExplorerRuntime:
    kb_id: str
    projection_revision: int
    basis: GraphSession
    explorer: Any | None
    last_access: float = field(default_factory=time.monotonic)

    def touch(self) -> None:
        self.last_access = time.monotonic()


class ExplorerSessionRegistry:
    """One Explorer session per KB projection revision; single-flight load per KB."""

    def __init__(self, *, idle_seconds: int = 1800) -> None:
        self._idle_seconds = idle_seconds
        self._cache: dict[str, KbExplorerRuntime] = {}
        self._guard = threading.Lock()
        self._load_locks: dict[str, threading.Lock] = {}

    def get(
        self,
        kb_id: str,
        *,
        knowledge: KnowledgeStore,
        basis_for_kb: Callable[[str], GraphSession],
    ) -> KbExplorerRuntime:
        revision = knowledge.get_projection_state(kb_id)["revision"]

        with self._guard:
            cached = self._cache.get(kb_id)
            if cached is not None and cached.projection_revision == revision:
                if _explorer_wrapped_graph(cached.explorer) is not cached.basis.graph:
                    cached.explorer = _rebuild_explorer_wrapper(cached.basis)
                cached.touch()
                return cached

        load_lock = self._load_locks.setdefault(kb_id, threading.Lock())
        with load_lock:
            with self._guard:
                cached = self._cache.get(kb_id)
                if cached is not None and cached.projection_revision == revision:
                    if _explorer_wrapped_graph(cached.explorer) is not cached.basis.graph:
                        cached.explorer = _rebuild_explorer_wrapper(cached.basis)
                    cached.touch()
                    return cached

            basis_session = basis_for_kb(kb_id)
            explorer_session = _rebuild_explorer_wrapper(basis_session)

            runtime = KbExplorerRuntime(
                kb_id=kb_id,
                projection_revision=revision,
                basis=basis_session,
                explorer=explorer_session,
            )
            with self._guard:
                self._cache[kb_id] = runtime
            return runtime

    def invalidate(self, kb_id: str) -> None:
        with self._guard:
            self._cache.pop(kb_id, None)

    def evict_idle(self) -> int:
        cutoff = time.monotonic() - self._idle_seconds
        removed = 0
        with self._guard:
            stale = [kb_id for kb_id, rt in self._cache.items() if rt.last_access < cutoff]
            for kb_id in stale:
                self._cache.pop(kb_id, None)
                removed += 1
        return removed
