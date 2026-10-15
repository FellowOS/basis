"""Emit KB alert episodes for cross-cutting ops events (F-ALT)."""

from __future__ import annotations

from typing import Any

from basis.admin.errors import AdminError
from basis.knowledge.store import KnowledgeStore

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


def emit_statement_conflict_alert(
    knowledge: KnowledgeStore,
    kb_id: str,
    *,
    review_item_id: str,
    surface_phrase: str,
    statement_ids: list[str],
) -> None:
    surface = (surface_phrase or "predicate").strip()[:120]
    knowledge.create_kb_alert(
        kb_id,
        kind="governance.statement_conflict",
        message=f"Statement conflict on «{surface}» needs review",
        severity="info",
        detail={
            "item_id": review_item_id,
            "surface_phrase": surface,
            "statement_ids": statement_ids[:20],
        },
    )


def emit_processing_failed_alert(
    knowledge: KnowledgeStore,
    kb_id: str,
    job_id: str,
    error_code: str,
    message: str,
) -> None:
    doc_label = job_id[:8]
    try:
        job = knowledge.get_job(kb_id, job_id)
        if job.subject_type == "document_version" and job.subject_id:
            ctx = knowledge.get_processing_context(kb_id, job.subject_id)
            doc_label = str(ctx.get("filename") or ctx.get("doc_id") or doc_label)
    except AdminError:
        pass
    code = (error_code or "processing_failed").strip()[:80]
    knowledge.create_kb_alert(
        kb_id,
        kind="processing.failed",
        message=f"Processing failed for «{doc_label[:120]}»: {code}",
        severity="warning",
        detail={
            "job_id": job_id,
            "error_code": code,
            "message": (message or "")[:300],
        },
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
