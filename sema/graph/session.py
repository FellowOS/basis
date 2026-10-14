"""In-memory graph session backed by Semantica's ContextGraph."""

from __future__ import annotations

from typing import Any


class GraphSession:
    def __init__(self) -> None:
        from semantica.context import ContextGraph

        self.graph = ContextGraph()

    def stats(self) -> dict[str, int]:
        return {
            "node_count": len(self.graph.nodes),
            "edge_count": len(self.graph.edges),
        }

    def add_node(
        self,
        node_id: str,
        node_type: str,
        content: str | None = None,
        **properties: Any,
    ) -> bool:
        return self.graph.add_node(node_id, node_type, content=content, **properties)

    def add_edge(
        self,
        source_id: str,
        target_id: str,
        edge_type: str = "related_to",
        **properties: Any,
    ) -> bool:
        return self.graph.add_edge(source_id, target_id, edge_type, **properties)
