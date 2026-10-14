"""Explorer session registry cache behavior."""

import time

from sema.explorer.registry import ExplorerSessionRegistry, KbExplorerRuntime
from sema.graph.session import GraphSession


def test_rebuild_explorer_wrapper_tracks_sema_graph_swap() -> None:
    from sema.capabilities import explorer_available
    from sema.explorer.registry import _explorer_wrapped_graph, _rebuild_explorer_wrapper

    sema = GraphSession()
    sema.add_node("a", "entity", content="A")
    stale = type("E", (), {"graph": sema.graph})()
    assert _explorer_wrapped_graph(stale) is sema.graph

    sema.graph = GraphSession().graph
    sema.add_node("b", "entity", content="B")
    assert _explorer_wrapped_graph(stale) is not sema.graph

    if explorer_available():
        fresh = _rebuild_explorer_wrapper(sema)
        assert fresh is not None
        assert _explorer_wrapped_graph(fresh) is sema.graph


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
