"""Per-workspace in-memory ontology registry, alignments, drafts, proposals, versions."""

from __future__ import annotations

from typing import Any

from basis.domain.ontology.hub.hub_persistence import ensure_kb_ontology_hub_loaded


class KbOntologyState:
    """Ensure per-workspace hub stores exist and load sidecar persistence once per process."""

    def __init__(self, request: Any, workspace_id: str) -> None:
        self._request = request
        self._kb_id = workspace_id

    def __enter__(self) -> KbOntologyState:
        app_state = self._request.app.state
        if not hasattr(app_state, "kb_ontology_alignments"):
            app_state.kb_ontology_alignments = {}
        if not hasattr(app_state, "kb_ontology_registries"):
            app_state.kb_ontology_registries = {}
        if not hasattr(app_state, "kb_ontology_drafts"):
            app_state.kb_ontology_drafts = {}
        if not hasattr(app_state, "kb_ontology_proposals"):
            app_state.kb_ontology_proposals = {}
        if not hasattr(app_state, "kb_ontology_versions"):
            app_state.kb_ontology_versions = {}
        app_state.kb_ontology_alignments.setdefault(self._kb_id, {})
        app_state.kb_ontology_registries.setdefault(self._kb_id, {})
        app_state.kb_ontology_drafts.setdefault(self._kb_id, {})
        app_state.kb_ontology_proposals.setdefault(self._kb_id, {})
        app_state.kb_ontology_versions.setdefault(self._kb_id, {})
        ensure_kb_ontology_hub_loaded(self._request, self._kb_id)
        return self

    def __exit__(self, *_args: object) -> None:
        return None
