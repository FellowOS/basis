"""Record Explorer graph decisions when governance gates trip (F-GOV-07)."""

from __future__ import annotations

import json
import logging
from collections.abc import Callable
from typing import Any

from basis.domain.errors import AdminError
from basis.domain.graph.workspace.session.registry import KbGraphWorkspaceRuntime
from basis.domain.graph.workspace.session.guard import require_graph_workspace_session
from basis.domain.knowledge.services.kb_alerts_emit import emit_governance_tripped_alert
from basis.domain.knowledge.store import KnowledgeStore

logger = logging.getLogger(__name__)

_GOVERNANCE_ALERT_CODE_TOKENS = ("governance", "impact", "tripped", "shacl")


def admin_error_triggers_governance_alert(code: str) -> bool:
    """True when an Explorer/AdminError code should emit `governance.tripped`."""
    normalized = code.lower()
    return any(token in normalized for token in _GOVERNANCE_ALERT_CODE_TOKENS)


_SKIP_GOVERNANCE_ALERT_ON_REVIEW_APPROVE = frozenset(
    {"review_closed", "not_found", "forbidden", "unsupported_review_kind"},
)


def should_emit_governance_tripped_on_review_approve(code: str) -> bool:
    """Emit only when approve failed due to governance/impact/SHACL gates (F-GOV-05)."""
    if code in _SKIP_GOVERNANCE_ALERT_ON_REVIEW_APPROVE:
        return False
    return admin_error_triggers_governance_alert(code)


def maybe_emit_governance_tripped_for_admin_error(
    kb_id: str,
    knowledge: KnowledgeStore,
    exc: AdminError,
    *,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
    runtime_loader: Callable[[], KbGraphWorkspaceRuntime] | None = None,
    persist_graph: Callable[[str], None] | None = None,
) -> None:
    """Emit `governance.tripped` when an AdminError reflects a governance gate (F-GOV-05)."""
    if not admin_error_triggers_governance_alert(exc.code):
        return
    payload = {"code": exc.code, **(detail or {})}
    emit_governance_tripped_for_kb(
        kb_id,
        knowledge,
        message=exc.message,
        detail=payload,
        actor_id=actor_id,
        runtime_loader=runtime_loader,
        persist_graph=persist_graph,
    )


def maybe_emit_governance_tripped_on_review_approve(
    kb_id: str,
    knowledge: KnowledgeStore,
    *,
    code: str,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
    runtime_loader: Callable[[], KbGraphWorkspaceRuntime] | None = None,
    persist_graph: Callable[[str], None] | None = None,
) -> None:
    """Review approve failure: emit only for governance/impact/SHACL gates (F-GOV-05)."""
    if not should_emit_governance_tripped_on_review_approve(code):
        return
    payload = {"code": code, **(detail or {})}
    emit_governance_tripped_for_kb(
        kb_id,
        knowledge,
        message=message,
        detail=payload,
        actor_id=actor_id,
        runtime_loader=runtime_loader,
        persist_graph=persist_graph,
    )


def _try_record_governance_decision(
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any],
    actor_id: str | None,
    outcome: str = "blocked",
    runtime_loader: Callable[[], KbGraphWorkspaceRuntime] | None = None,
    persist_graph: Callable[[str], None] | None = None,
) -> str | None:
    if runtime_loader is None or persist_graph is None:
        return None
    try:
        runtime = runtime_loader()
        session = require_graph_workspace_session(runtime)
        graph = session.graph
        if not hasattr(graph, "record_decision"):
            return None
        decision_id = graph.record_decision(
            category="governance",
            scenario=(message or "Governance gate blocked")[:500],
            reasoning=json.dumps(detail, default=str)[:4000],
            outcome=outcome,
            confidence=1.0,
            decision_maker=actor_id,
            metadata={"alert_kind": "governance.tripped", **detail},
        )
        persist_graph(kb_id)
        return str(decision_id)
    except Exception:
        logger.debug("governance decision record skipped", exc_info=True)
        return None


def record_governance_decision_for_kb(
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
    outcome: str = "approved",
    runtime_loader: Callable[[], KbGraphWorkspaceRuntime] | None = None,
    persist_graph: Callable[[str], None] | None = None,
) -> str | None:
    """Persist an Explorer graph decision (e.g. review approve). Returns id or None."""
    return _try_record_governance_decision(
        kb_id,
        message=message,
        detail=dict(detail or {}),
        actor_id=actor_id,
        outcome=outcome,
        runtime_loader=runtime_loader,
        persist_graph=persist_graph,
    )


def emit_governance_tripped_for_kb(
    kb_id: str,
    knowledge: KnowledgeStore,
    *,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
    runtime_loader: Callable[[], KbGraphWorkspaceRuntime] | None = None,
    persist_graph: Callable[[str], None] | None = None,
) -> str | None:
    payload = dict(detail or {})
    decision_id = _try_record_governance_decision(
        kb_id,
        message=message,
        detail=payload,
        actor_id=actor_id,
        runtime_loader=runtime_loader,
        persist_graph=persist_graph,
    )
    if decision_id:
        payload["decision_id"] = decision_id
    emit_governance_tripped_alert(knowledge, kb_id, message=message, detail=payload)
    return decision_id
