"""Registry mutations for Hub ontology management."""

from __future__ import annotations

from typing import Any

from basis.domain.errors import AdminError


def _entry_enabled(entry: Any) -> bool:
    if isinstance(entry, dict):
        return bool(entry.get("enabled", True))
    return bool(getattr(entry, "enabled", True))


def _set_entry_enabled(entry: Any, enabled: bool) -> None:
    if isinstance(entry, dict):
        entry["enabled"] = enabled
    else:
        entry.enabled = enabled


def remove_ontology(registry: dict[str, Any], ontology_uri: str) -> dict[str, str]:
    if ontology_uri not in registry:
        raise AdminError(404, "not_found", "Ontology not found in registry.")
    del registry[ontology_uri]
    return {"status": "removed", "uri": ontology_uri}


def toggle_ontology(registry: dict[str, Any], ontology_uri: str) -> dict[str, Any]:
    if ontology_uri not in registry:
        raise AdminError(404, "not_found", "Ontology not found in registry.")
    entry = registry[ontology_uri]
    new_enabled = not _entry_enabled(entry)
    _set_entry_enabled(entry, new_enabled)
    return {"uri": ontology_uri, "enabled": new_enabled}
