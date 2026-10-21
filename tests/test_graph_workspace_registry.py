"""Explorer session registry cache behavior."""

import time

from basis.domain.graph.workspace.session.basis_kb_graph_session import BasisKbGraphSession
from basis.domain.graph.workspace.session.probe import build_kb_graph_adapter
from basis.domain.graph.workspace.session.registry import (
    GraphWorkspaceSessionRegistry,
    KbGraphWorkspaceRuntime,
    _adapter_wrapped_graph,
    _rebuild_workspace_adapter,
)
from basis.domain.graph.projection.session import GraphSession


def test_rebuild_workspace_adapter_tracks_basis_graph_swap() -> None:
    session = GraphSession()
    session.add_node("a", "entity", content="A")
    stale = type("E", (), {"graph": session.graph})()
    assert _adapter_wrapped_graph(stale) is session.graph

    session.graph = GraphSession().graph
    session.add_node("b", "entity", content="B")
    assert _adapter_wrapped_graph(stale) is not session.graph

    fresh = _rebuild_workspace_adapter(session)
    assert fresh is not None
    assert _adapter_wrapped_graph(fresh) is session.graph
    assert isinstance(fresh, BasisKbGraphSession)


def test_build_kb_graph_adapter_is_basis() -> None:
    session = GraphSession()
    adapter = build_kb_graph_adapter(session)
    assert isinstance(adapter, BasisKbGraphSession)


def test_evict_idle_drops_stale_runtimes() -> None:
    registry = GraphWorkspaceSessionRegistry(idle_seconds=1)
    session = GraphSession()
    registry._cache["kb-stale"] = KbGraphWorkspaceRuntime(
        kb_id="kb-stale",
        projection_revision=1,
        basis=session,
        adapter=None,
        last_access=time.monotonic() - 10,
    )
    removed = registry.evict_idle()
    assert removed == 1
    assert "kb-stale" not in registry._cache
