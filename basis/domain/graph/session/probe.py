"""Build ``BasisGraphSession`` for a canonical ``GraphSession``."""

from __future__ import annotations

from typing import Any

from basis.domain.graph.projection.session import GraphSession


def build_graph_adapter(basis_session: GraphSession) -> Any:
    from basis.domain.graph.session.basis_graph_session import BasisGraphSession

    return BasisGraphSession(basis_session)
