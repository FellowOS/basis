"""Re-fetch ontology content from registry source_url."""

from __future__ import annotations

from collections.abc import Callable
from datetime import datetime, timezone
from typing import Any

from basis.domain.errors import AdminError


def _entry_field(entry: Any, key: str, default: Any = None) -> Any:
    if isinstance(entry, dict):
        return entry.get(key, default)
    return getattr(entry, key, default)


def _set_loaded_at(entry: Any, value: str) -> None:
    if isinstance(entry, dict):
        entry["loaded_at"] = value
    else:
        entry.loaded_at = value


def refresh_ontology(
    session: Any,
    registry: dict[str, Any],
    ontology_uri: str,
    *,
    fetch_url_bytes: Callable[[str], bytes],
    parse_rdf_sync: Callable[[bytes, str], tuple[Any, Any, dict[str, Any]]],
) -> dict[str, Any]:
    entry = registry.get(ontology_uri)
    if entry is None:
        raise AdminError(404, "not_found", "Ontology not found in registry.")

    source_url = _entry_field(entry, "source_url")
    if not source_url:
        raise AdminError(422, "validation_error", "No source URL to refresh from.")

    fmt = _entry_field(entry, "format", "turtle")
    raw = fetch_url_bytes(str(source_url))
    content_str = raw.decode("utf-8", errors="replace")

    try:
        nodes, edges, _metadata = parse_rdf_sync(content_str.encode("utf-8"), fmt)
    except AdminError:
        raise
    except Exception as exc:
        raise AdminError(422, "validation_error", f"Refresh parse error: {exc}") from exc

    try:
        nodes_added, edges_added = session.add_nodes_and_edges(nodes, edges)
    except ValueError as exc:
        raise AdminError(422, "validation_error", str(exc)) from exc

    _set_loaded_at(entry, datetime.now(timezone.utc).isoformat())

    return {
        "uri": ontology_uri,
        "nodes_added": nodes_added,
        "edges_added": edges_added,
    }
