"""Per-KB ontology hub sidecar (registry, alignments, drafts, proposals, versions)."""

from __future__ import annotations

import json
import os
import uuid
from pathlib import Path
from typing import Any

from basis.domain.graph.projection.snapshot_store import GraphPersistence, _atomic_replace, _kb_write_lock

_HUB_SCHEMA_VERSION = 1


def _hub_path(persistence: GraphPersistence, kb_id: str) -> Path:
    return persistence.graph_path(kb_id).with_suffix(".ontology-hub.json")


def _serialize_store(store: dict[str, Any]) -> dict[str, Any]:
    out: dict[str, Any] = {}
    for key, value in store.items():
        if hasattr(value, "model_dump"):
            out[key] = value.model_dump(mode="json")
        else:
            out[key] = value
    return out


def _serialize_versions(versions: dict[str, Any]) -> dict[str, list[Any]]:
    serialized: dict[str, list[Any]] = {}
    for ontology_uri, entries in versions.items():
        row: list[Any] = []
        for entry in entries or []:
            if hasattr(entry, "model_dump"):
                row.append(entry.model_dump(mode="json"))
            else:
                row.append(entry)
        serialized[ontology_uri] = row
    return serialized


def _rehydrate_drafts(model: Any, raw: dict[str, Any]) -> dict[str, Any]:
    return {key: model.model_validate(value) for key, value in raw.items()}


def _rehydrate_proposals(model: Any, raw: dict[str, Any]) -> dict[str, Any]:
    return {key: model.model_validate(value) for key, value in raw.items()}


def _rehydrate_versions(model: Any, raw: dict[str, Any]) -> dict[str, list[Any]]:
    hydrated: dict[str, list[Any]] = {}
    for ontology_uri, entries in raw.items():
        hydrated[ontology_uri] = [model.model_validate(entry) for entry in (entries or [])]
    return hydrated


def ensure_kb_ontology_hub_loaded(request: Any, kb_id: str) -> None:
    """Load sidecar into app.state once per process (if present on disk)."""
    app_state = request.app.state
    loaded: set[str] = getattr(app_state, "_kb_ontology_hub_loaded", set())
    if kb_id in loaded:
        return

    persistence: GraphPersistence = app_state.graph_persistence
    path = _hub_path(persistence, kb_id)
    if path.is_file():
        try:
            payload = json.loads(path.read_text(encoding="utf-8"))
        except (json.JSONDecodeError, OSError):
            payload = {}
        if int(payload.get("schema_version", 0)) == _HUB_SCHEMA_VERSION:
            from basis.domain.ontology.hub.hub_models import (
                DraftResponse,
                ProposalResponse,
                VersionEntry,
            )

            app_state.kb_ontology_registries[kb_id] = dict(payload.get("registry") or {})
            app_state.kb_ontology_alignments[kb_id] = dict(payload.get("alignments") or {})
            app_state.kb_ontology_drafts[kb_id] = _rehydrate_drafts(DraftResponse, payload.get("drafts") or {})
            app_state.kb_ontology_proposals[kb_id] = _rehydrate_proposals(
                ProposalResponse, payload.get("proposals") or {}
            )
            app_state.kb_ontology_versions[kb_id] = _rehydrate_versions(
                VersionEntry, payload.get("versions") or {}
            )

    loaded.add(kb_id)
    app_state._kb_ontology_hub_loaded = loaded


def persist_kb_ontology_hub(request: Any, kb_id: str) -> None:
    """Write in-memory hub stores to the sidecar (no-op if never initialized)."""
    app_state = request.app.state
    loaded: set[str] = getattr(app_state, "_kb_ontology_hub_loaded", set())
    if kb_id not in loaded:
        return

    persistence: GraphPersistence = app_state.graph_persistence
    path = _hub_path(persistence, kb_id)
    tmp = path.with_name(f"{path.name}.{uuid.uuid4().hex}.tmp")
    payload = {
        "schema_version": _HUB_SCHEMA_VERSION,
        "registry": dict(app_state.kb_ontology_registries.get(kb_id) or {}),
        "alignments": _serialize_store(app_state.kb_ontology_alignments.get(kb_id) or {}),
        "drafts": _serialize_store(app_state.kb_ontology_drafts.get(kb_id) or {}),
        "proposals": _serialize_store(app_state.kb_ontology_proposals.get(kb_id) or {}),
        "versions": _serialize_versions(app_state.kb_ontology_versions.get(kb_id) or {}),
    }
    with _kb_write_lock(kb_id):
        tmp.parent.mkdir(parents=True, exist_ok=True)
        tmp.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        _atomic_replace(tmp, path)


def delete_kb_ontology_hub(persistence: GraphPersistence, kb_id: str) -> None:
    path = _hub_path(persistence, kb_id)
    with _kb_write_lock(kb_id):
        if path.is_file():
            path.unlink()
