"""Workspace-scoped graph read helpers (Explorer or ContextGraph fallback)."""

from __future__ import annotations

from collections import deque
from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.session.registry import KbGraphRuntime
from basis.domain.graph.projection.export import _iter_edges
from basis.infra.runtime.limits import GRAPH_NODE_SEARCH_MAX_LIMIT, GRAPH_PAGE_MAX_EDGES


def _normalize_neighbor(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "id": str(raw.get("id", "")),
        "type": str(raw.get("type", "")),
        "content": str(raw.get("content", "")),
        "relationship": str(raw.get("relationship", raw.get("edge_type", ""))),
        "weight": float(raw.get("weight", 1.0) or 1.0),
        "hop": int(raw.get("hop", 1) or 1),
    }


def get_node(runtime: KbGraphRuntime, node_id: str) -> dict[str, Any] | None:
    if runtime.adapter is not None:
        return runtime.adapter.get_node(node_id)
    node = runtime.basis.graph.find_node(node_id)
    if node is None:
        return None
    content = node.content or ""
    return {
        "id": node.node_id,
        "type": node.node_type,
        "content": content,
        "properties": dict(node.properties) if isinstance(node.properties, dict) else {},
    }


def list_neighbors(
    runtime: KbGraphRuntime,
    node_id: str,
    *,
    depth: int = 1,
) -> list[dict[str, Any]]:
    depth = min(max(1, depth), 5)
    if runtime.adapter is not None:
        raw = runtime.adapter.get_neighbors(node_id, depth)
        return [_normalize_neighbor(item) for item in raw]
    raw = runtime.basis.graph.get_neighbors(node_id, hops=depth)
    return [_normalize_neighbor(item) for item in raw]


def _build_adjacency(session: Any, *, directed: bool) -> dict[str, list[str]]:
    adj: dict[str, list[str]] = {}
    for edge in _iter_edges(session):
        source = edge.source_id
        target = edge.target_id
        adj.setdefault(source, []).append(target)
        if not directed:
            adj.setdefault(target, []).append(source)
    return adj


def find_path(
    runtime: KbGraphRuntime,
    *,
    source: str,
    target: str,
    algorithm: str = "bfs",
    directed: bool = True,
) -> dict[str, Any]:
    if not source or not target:
        raise AdminError(422, "bad_path", "source 与 target 必填")
    if runtime.adapter is not None and runtime.adapter.path_finder is not None:
        path_finder = runtime.adapter.path_finder
        nx_graph = runtime.adapter.build_nx_graph()
        if algorithm == "dijkstra":
            path_fn = path_finder.dijkstra_shortest_path
        else:
            path_fn = path_finder.bfs_shortest_path
        path_nodes = path_fn(nx_graph, source, target, directed=directed)
        if not path_nodes:
            return {"found": False, "nodes": [], "algorithm": algorithm}
        return {
            "found": True,
            "nodes": list(path_nodes),
            "length": len(path_nodes),
            "algorithm": algorithm,
            "engine": "explorer",
        }

    adj = _build_adjacency(runtime.basis, directed=directed)
    if source not in runtime.basis.graph.nodes and source != target:
        return {"found": False, "nodes": [], "algorithm": algorithm, "engine": "bfs"}
    queue: deque[tuple[str, list[str]]] = deque([(source, [source])])
    seen = {source}
    while queue:
        node, path = queue.popleft()
        for nbr in adj.get(node, []):
            if nbr in seen:
                continue
            new_path = path + [nbr]
            if nbr == target:
                return {
                    "found": True,
                    "nodes": new_path,
                    "length": len(new_path),
                    "algorithm": "bfs",
                    "engine": "bfs",
                }
            seen.add(nbr)
            queue.append((nbr, new_path))
    return {"found": False, "nodes": [], "algorithm": "bfs", "engine": "bfs"}


def _active_node_ids_at(runtime: KbGraphRuntime, at_iso: str) -> set[str]:
    from basis.domain.graph.reads.diff import parse_query_dt

    at_dt = parse_query_dt(at_iso)
    graph = runtime.basis.graph
    active = graph.find_active_nodes(at_time=at_dt)
    return {str(n.get("id")) for n in active if n.get("id")}


def search_nodes(
    runtime: KbGraphRuntime,
    *,
    query: str,
    limit: int = 20,
    max_limit: int = GRAPH_NODE_SEARCH_MAX_LIMIT,
    at: str | None = None,
) -> list[dict[str, Any]]:
    query = query.strip()
    if not query:
        return []
    cap = max(1, max_limit)
    limit = min(max(1, limit), cap)
    active_ids: set[str] | None = None
    if at and at.strip():
        try:
            active_ids = _active_node_ids_at(runtime, at.strip())
        except ValueError:
            active_ids = None
    if runtime.adapter is not None:
        results = runtime.adapter.search(query, limit=limit * 3 if active_ids else limit)
    else:
        results = None
    if results is None:
        q = query.lower()
        results = []
        for node in runtime.basis.graph.nodes.values():
            if active_ids is not None and node.node_id not in active_ids:
                continue
            label = (node.content or "") + str(node.properties)
            if q in node.node_id.lower() or q in label.lower():
                results.append(
                    {
                        "node": {
                            "id": node.node_id,
                            "type": node.node_type,
                            "content": node.content or "",
                        },
                        "score": 1.0,
                    }
                )
            if len(results) >= limit:
                break
    if active_ids is not None:
        filtered = [r for r in results if r.get("node", {}).get("id") in active_ids]
        return filtered[:limit]
    return results[:limit]


def paginate_edges(
    runtime: KbGraphRuntime,
    *,
    edge_type: str | None = None,
    source: str | None = None,
    target: str | None = None,
    limit: int = 100,
    cursor: str | None = None,
    max_limit: int = GRAPH_PAGE_MAX_EDGES,
) -> dict[str, Any]:
    cap = max(1, max_limit)
    page_limit = min(max(1, limit), cap)
    if runtime.adapter is not None:
        edges, total, next_cursor = runtime.adapter.paginate_edges(
            edge_type=edge_type,
            source=source,
            target=target,
            limit=page_limit,
            cursor=cursor,
        )
        return {
            "edges": edges,
            "total": total,
            "next_cursor": next_cursor,
            "engine": "explorer",
        }
    filtered = []
    for edge in _iter_edges(runtime.basis):
        if edge_type and edge.edge_type != edge_type:
            continue
        if source and edge.source_id != source:
            continue
        if target and edge.target_id != target:
            continue
        filtered.append(
            {
                "source": edge.source_id,
                "target": edge.target_id,
                "type": edge.edge_type,
            }
        )
    filtered.sort(key=lambda e: (e["source"], e["target"], e["type"]))
    return {
        "edges": filtered[:page_limit],
        "total": len(filtered),
        "next_cursor": None,
        "engine": "snapshot",
    }
