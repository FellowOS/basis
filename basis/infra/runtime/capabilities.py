"""Optional runtime capability probes (Explorer, etc.)."""

from __future__ import annotations


def graph_workspace_available() -> bool:
    """KB graph workspace HTTP stack (``BasisKbGraphSession``) is always available."""
    return True


def platform_capabilities() -> dict[str, bool]:
    return {
        "graph_snapshot": True,
        "explorer_runtime": graph_workspace_available(),
    }


def _role_can_write(role: str) -> bool:
    from basis.domain.knowledge.roles import ROLE_RANK

    return ROLE_RANK.get(role, 0) >= ROLE_RANK["editor"]


def kb_capabilities(role: str) -> dict[str, bool | str | None]:
    """Per-KB Explorer feature flags for authorized callers (design §12)."""
    can_write = _role_can_write(role)
    return {
        "graph": True,
        "graph_write": can_write,
        "temporal": True,
        "decisions": True,
        "sparql": True,
        "reasoning": True,
        "enrichment": True,
        "review": True,
        "direct_graph_merge": False,
        "direct_graph_import": False,
        "import_export": can_write,
        "provenance": True,
        "vocabulary": True,
        "mappings": True,
        "agent_memory": False,
        "explorer_runtime": True,
        "diagnostic": None,
    }
