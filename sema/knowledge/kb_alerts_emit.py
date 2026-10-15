"""Emit KB alert episodes for cross-cutting ops events (F-ALT)."""

from __future__ import annotations

from typing import Any

from sema.knowledge.store import KnowledgeStore

_SKIP_LLM_ALERT_CODES = frozenset({"chat_in_flight", "chat_not_configured"})


def emit_llm_playground_alert(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    code: str,
    message: str,
    detail: dict[str, Any] | None = None,
) -> None:
    if code in _SKIP_LLM_ALERT_CODES:
        return
    kind = f"llm.{code}" if not code.startswith("llm.") else code
    payload = {"code": code, **(detail or {})}
    knowledge.create_kb_alert(
        kb_id,
        kind=kind,
        message=message[:500] or f"Chat error ({code})",
        severity="warning",
        detail=payload,
    )


def emit_governance_proposal_proposed_alert(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    proposal_id: str,
    message: str,
    detail: dict[str, Any] | None = None,
) -> None:
    knowledge.create_kb_alert(
        kb_id,
        kind="governance.proposal_proposed",
        message=message[:500] or "Ontology proposal submitted for review",
        severity="info",
        detail={"proposal_id": proposal_id, **(detail or {})},
    )


def emit_governance_tripped_alert(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    message: str,
    detail: dict[str, Any] | None = None,
) -> None:
    knowledge.create_kb_alert(
        kb_id,
        kind="governance.tripped",
        message=message[:500] or "Governance gate blocked the operation",
        severity="warning",
        detail=detail or {},
    )
