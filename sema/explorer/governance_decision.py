"""Record Explorer graph decisions when governance gates trip (F-GOV-07)."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import Request

from sema.api.deps import get_explorer_registry, save_graph
from sema.explorer.session_guard import require_explorer_graph_session
from sema.knowledge.kb_alerts_emit import emit_governance_tripped_alert
from sema.knowledge.store import KnowledgeStore

logger = logging.getLogger(__name__)


def _try_record_governance_decision(
    request: Request,
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any],
    actor_id: str | None,
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
            outcome="blocked",
            confidence=1.0,
            decision_maker=actor_id,
            metadata={"alert_kind": "governance.tripped", **detail},
        )
        save_graph(request, kb_id)
        return str(decision_id)
    except Exception:
        logger.debug("governance decision record skipped", exc_info=True)
        return None


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
