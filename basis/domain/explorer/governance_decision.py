"""Record Explorer graph decisions when governance gates trip (F-GOV-07)."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Request

from basis.platform.admin.errors import AdminError
from basis.transport.http.deps import get_explorer_registry, save_graph
from basis.domain.explorer.session_guard import require_explorer_graph_session
from basis.domain.kb.kb_alerts_emit import emit_governance_tripped_alert
from basis.domain.kb.store import KnowledgeStore

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
    request: Request,
    kb_id: str,
    knowledge: KnowledgeStore,
    exc: AdminError,
    *,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
) -> None:
    """Emit `governance.tripped` when an AdminError reflects a governance gate (F-GOV-05)."""
    if not admin_error_triggers_governance_alert(exc.code):
        return
    payload = {"code": exc.code, **(detail or {})}
    emit_governance_tripped_for_kb(
        request,
        kb_id,
        knowledge,
        message=exc.message,
        detail=payload,
        actor_id=actor_id,
    )


def maybe_emit_governance_tripped_on_review_approve(
    request: Request,
    kb_id: str,
    knowledge: KnowledgeStore,
    *,
    code: str,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
) -> None:
    """Review approve failure: emit only for governance/impact/SHACL gates (F-GOV-05)."""
    if not should_emit_governance_tripped_on_review_approve(code):
        return
    payload = {"code": code, **(detail or {})}
    emit_governance_tripped_for_kb(
        request,
        kb_id,
        knowledge,
        message=message,
        detail=payload,
        actor_id=actor_id,
    )


def _try_record_governance_decision(
    request: Request,
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any],
    actor_id: str | None,
    outcome: str = "blocked",
) -> str | None:
    try:
        runtime = get_explorer_registry(request).get(request, kb_id)
        session = require_explorer_graph_session(runtime)
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
        save_graph(request, kb_id)
        return str(decision_id)
    except Exception:
        logger.debug("governance decision record skipped", exc_info=True)
        return None


def record_governance_decision_for_kb(
    request: Request,
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
    outcome: str = "approved",
) -> str | None:
    """Persist an Explorer graph decision (e.g. review approve). Returns id or None."""
    return _try_record_governance_decision(
        request,
        kb_id,
        message=message,
        detail=dict(detail or {}),
        actor_id=actor_id,
        outcome=outcome,
    )


def emit_governance_tripped_for_kb(
    request: Request,
    kb_id: str,
    knowledge: KnowledgeStore,
    *,
    message: str,
    detail: dict[str, Any] | None = None,
    actor_id: str | None = None,
) -> str | None:
    payload = dict(detail or {})
    decision_id = _try_record_governance_decision(
        request,
        kb_id,
        message=message,
        detail=payload,
        actor_id=actor_id,
    )
    if decision_id:
        payload["decision_id"] = decision_id
    emit_governance_tripped_alert(knowledge, kb_id, message=message, detail=payload)
    return decision_id
