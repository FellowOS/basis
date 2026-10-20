"""Per-KB in-memory ontology registry / alignment stores for Explorer ontology hub."""

from __future__ import annotations

import contextvars
from typing import Any

from basis.domain.explorer.ontology_route_bridge import ontology_module

_kb_alignment_store: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "kb_alignment_store",
    default=None,
)
_kb_registry_store: contextvars.ContextVar[dict[str, Any] | None] = contextvars.ContextVar(
    "kb_ontology_registry",
    default=None,
)

_patched = False


def ensure_semantica_ontology_patches() -> None:
    global _patched
    if _patched:
        return
    ont_mod = ontology_module()
    orig_align = ont_mod._get_alignment_store
    orig_reg = ont_mod._get_registry

    def patched_alignment_store(request):  # type: ignore[no-untyped-def]
        store = _kb_alignment_store.get()
        if store is not None:
            return store
        return orig_align(request)

    def patched_registry(request):  # type: ignore[no-untyped-def]
        store = _kb_registry_store.get()
        if store is not None:
            return store
        return orig_reg(request)

    ont_mod._get_alignment_store = patched_alignment_store
    ont_mod._get_registry = patched_registry
    _patched = True


class KbOntologyState:
    """Bind semantica ontology helpers to per-KB ephemeral stores for one request."""

    def __init__(self, request: Any, kb_id: str) -> None:
        self._request = request
        self._kb_id = kb_id
        self._align_token: contextvars.Token | None = None
        self._registry_token: contextvars.Token | None = None

    def __enter__(self) -> KbOntologyState:
        ensure_semantica_ontology_patches()
        app_state = self._request.app.state
        if not hasattr(app_state, "kb_ontology_alignments"):
            app_state.kb_ontology_alignments = {}
        if not hasattr(app_state, "kb_ontology_registries"):
            app_state.kb_ontology_registries = {}
        align = app_state.kb_ontology_alignments.setdefault(self._kb_id, {})
        registry = app_state.kb_ontology_registries.setdefault(self._kb_id, {})
        self._align_token = _kb_alignment_store.set(align)
        self._registry_token = _kb_registry_store.set(registry)
        return self

    def __exit__(self, *_args: object) -> None:
        if self._registry_token is not None:
            _kb_registry_store.reset(self._registry_token)
            self._registry_token = None
        if self._align_token is not None:
            _kb_alignment_store.reset(self._align_token)
            self._align_token = None
