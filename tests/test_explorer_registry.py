"""Explorer session registry cache behavior."""

import time

from sema.explorer.registry import ExplorerSessionRegistry, KbExplorerRuntime
from sema.graph.session import GraphSession


def test_evict_idle_drops_stale_runtimes() -> None:
    registry = ExplorerSessionRegistry(idle_seconds=1)
    session = GraphSession()
    registry._cache["kb-stale"] = KbExplorerRuntime(
        kb_id="kb-stale",
        projection_revision=1,
        sema=session,
        explorer=None,
        last_access=time.monotonic() - 10,
    )
    removed = registry.evict_idle()
    assert removed == 1
    assert "kb-stale" not in registry._cache
