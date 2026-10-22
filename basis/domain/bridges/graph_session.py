"""Knowledge → graph session/reads calls (lazy imports; lives outside ``domain.knowledge`` for import-linter)."""

from __future__ import annotations

from typing import Any, TYPE_CHECKING

if TYPE_CHECKING:
    from basis.domain.graph.session.registry import GraphRuntime


def diff_session_at(session: Any, from_time: str, to_time: str) -> dict[str, Any]:
    from basis.domain.graph.reads.diff import diff_session_at as _impl

    return _impl(session, from_time, to_time)


def build_graph_staging_payload(
    workspace_id: str, diff: dict[str, Any], *, draft: dict[str, Any] | None = None
) -> dict[str, Any]:
    from basis.domain.graph.reads.staging import build_graph_staging_payload as _impl

    return _impl(workspace_id, diff, draft=draft)


def staging_session_key(workspace_id: str, from_time: str, to_time: str) -> str:
    from basis.domain.graph.reads.staging import staging_session_key as _impl

    return _impl(workspace_id, from_time, to_time)


def require_graph_session(runtime: GraphRuntime) -> Any:
    from basis.domain.graph.session.guard import require_graph_session as _impl

    return _impl(runtime)


def record_governance_decision_for_workspace(*args: Any, **kwargs: Any) -> Any:
    from basis.domain.graph.governance.decision import (
        record_governance_decision_for_workspace as _impl,
    )

    return _impl(*args, **kwargs)


def merge_nodes(*args: Any, **kwargs: Any) -> Any:
    from basis.domain.graph.governance.enrich_write import merge_nodes as _impl

    return _impl(*args, **kwargs)


def import_graph_file(*args: Any, **kwargs: Any) -> Any:
    from basis.domain.graph.reads.import_write import import_graph_file as _impl

    return _impl(*args, **kwargs)


def parse_reasoning_fact(*args: Any, **kwargs: Any) -> Any:
    from basis.domain.graph.reasoning.forward import _parse_fact as _impl

    return _impl(*args, **kwargs)


def __getattr__(name: str) -> Any:
    if name == "GraphRuntime":
        from basis.domain.graph.session.registry import GraphRuntime

        return GraphRuntime
    raise AttributeError(name)


__all__ = [
    "GraphRuntime",
    "build_graph_staging_payload",
    "diff_session_at",
    "import_graph_file",
    "merge_nodes",
    "parse_reasoning_fact",
    "record_governance_decision_for_workspace",
    "require_graph_session",
    "staging_session_key",
]
