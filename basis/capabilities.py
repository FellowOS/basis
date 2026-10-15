"""Optional runtime capability probes (Explorer, etc.)."""

from __future__ import annotations

from functools import lru_cache


@lru_cache(maxsize=1)
def explorer_available() -> bool:
    try:
        import semantica.explorer.session  # noqa: F401
    except ImportError:
        return False
    return True


def platform_capabilities() -> dict[str, bool]:
    return {
        "graph_snapshot": True,
        "explorer_runtime": explorer_available(),
    }


def _role_can_write(role: str) -> bool:
    from basis.admin.store import ROLE_RANK

    return ROLE_RANK.get(role, 0) >= ROLE_RANK["editor"]


def kb_capabilities(role: str) -> dict[str, bool | str | None]:
    """Per-KB Explorer feature flags for authorized callers (design §12)."""
    runtime = explorer_available()
    can_write = _role_can_write(role)
    if not runtime:
        return {
            "graph": False,
            "graph_write": False,
            "temporal": False,
            "decisions": False,
            "sparql": False,
            "reasoning": False,
            "enrichment": False,
            "review": False,
            "direct_graph_merge": False,
            "direct_graph_import": False,
            "import_export": False,
            "provenance": False,
            "vocabulary": False,
            "mappings": True,
            "agent_memory": False,
            "explorer_runtime": False,
            "diagnostic": "explorer_unavailable",
        }
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
