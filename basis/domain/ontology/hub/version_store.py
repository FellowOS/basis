"""Ontology version list and compare (explicit per-KB store)."""

from __future__ import annotations

import logging
from typing import Any

from basis.domain.errors import AdminError

logger = logging.getLogger(__name__)


def _dump(value: Any) -> Any:
    if hasattr(value, "model_dump"):
        return value.model_dump()
    return value


def _version_field(record: Any, key: str, default: Any = None) -> Any:
    if isinstance(record, dict):
        return record.get(key, default)
    return getattr(record, key, default)


def _session_store(session: Any) -> Any:
    return session.graph.store if hasattr(session.graph, "store") else None


def list_versions(versions: dict[str, Any], ontology_uri: str) -> list[dict[str, Any]]:
    entries = versions.get(ontology_uri, [])
    return [_dump(entry) for entry in entries]


def compare_versions(
    session: Any,
    versions: dict[str, Any],
    ontology_uri: str,
    body: Any,
) -> dict[str, Any]:
    try:
        from semantica.change_management.ontology_version_manager import VersionManager

        version_manager = VersionManager(store=_session_store(session))
        ontology_versions = versions.get(ontology_uri, [])

        v1_record = next(
            (v for v in ontology_versions if _version_field(v, "version_id") == body.version1),
            None,
        )
        v2_record = next(
            (v for v in ontology_versions if _version_field(v, "version_id") == body.version2),
            None,
        )
        if not v1_record or not v2_record:
            raise AdminError(404, "not_found", "One or both versions not found.")

        v1_dict = {
            "uri": ontology_uri,
            "version": body.version1,
            "classes": [],
            "properties": [],
            "diff": _version_field(v1_record, "diff_summary", {}),
        }
        v2_dict = {
            "uri": ontology_uri,
            "version": body.version2,
            "classes": [],
            "properties": [],
            "diff": _version_field(v2_record, "diff_summary", {}),
        }

        diff_result = version_manager.diff_ontologies(v1_dict, v2_dict)

        metadata_changes = {
            "version_id": {"from": body.version1, "to": body.version2},
            "author": {
                "from": _version_field(v1_record, "author"),
                "to": _version_field(v2_record, "author"),
            },
            "date": {
                "from": _version_field(v1_record, "date"),
                "to": _version_field(v2_record, "date"),
            },
            "state": {
                "from": _version_field(v1_record, "state"),
                "to": _version_field(v2_record, "state"),
            },
        }

        return {
            "version1": body.version1,
            "version2": body.version2,
            "metadata_changes": metadata_changes,
            "class_changes": {
                "added": diff_result.get("added_classes", []),
                "removed": diff_result.get("removed_classes", []),
                "changed": diff_result.get("changed_classes", []),
            },
            "property_changes": {
                "added": diff_result.get("added_properties", []),
                "removed": diff_result.get("removed_properties", []),
                "changed": diff_result.get("changed_properties", []),
            },
            "restriction_changes": {
                "added": diff_result.get("added_axioms", []),
                "removed": diff_result.get("removed_axioms", []),
                "changed": diff_result.get("changed_axioms", []),
            },
            "axiom_changes": {
                "added": diff_result.get("added_axioms", []),
                "removed": diff_result.get("removed_axioms", []),
                "changed": diff_result.get("changed_axioms", []),
            },
        }
    except AdminError:
        raise
    except Exception as exc:
        logger.error("Version comparison failed: %s", exc)
        raise AdminError(500, "internal_error", f"Version comparison failed: {exc}") from exc
