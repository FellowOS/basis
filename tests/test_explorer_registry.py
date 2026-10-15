"""Explorer session registry cache behavior."""

import time

from basis.explorer.registry import ExplorerSessionRegistry, KbExplorerRuntime
from basis.graph.session import GraphSession


def test_rebuild_explorer_wrapper_tracks_basis_graph_swap() -> None:
    from basis.capabilities import explorer_available
    from basis.explorer.registry import _explorer_wrapped_graph, _rebuild_explorer_wrapper

    session = GraphSession()
    session.add_node("a", "entity", content="A")
    stale = type("E", (), {"graph": session.graph})()
    assert _explorer_wrapped_graph(stale) is session.graph

    session.graph = GraphSession().graph
    session.add_node("b", "entity", content="B")
    assert _explorer_wrapped_graph(stale) is not session.graph

    if explorer_available():
        fresh = _rebuild_explorer_wrapper(session)
        assert fresh is not None
        assert _explorer_wrapped_graph(fresh) is session.graph


def test_evict_idle_drops_stale_runtimes() -> None:
    registry = ExplorerSessionRegistry(idle_seconds=1)
    session = GraphSession()
    registry._cache["kb-stale"] = KbExplorerRuntime(
        kb_id="kb-stale",
        projection_revision=1,
        basis=session,
        explorer=None,
        last_access=time.monotonic() - 10,
    )
    removed = registry.evict_idle()
    assert removed == 1
    assert "kb-stale" not in registry._cache
