"""Build ``BasisKbGraphSession`` for a canonical ``GraphSession``."""

from __future__ import annotations

from typing import Any

from basis.domain.graph.projection.session import GraphSession


def build_kb_graph_adapter(basis_session: GraphSession) -> Any:
    from basis.domain.graph.session.basis_kb_graph_session import BasisKbGraphSession

    return BasisKbGraphSession(basis_session)
