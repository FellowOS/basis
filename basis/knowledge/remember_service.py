"""Chat/MCP remember → pending statement + review item (F-CHAT-04, ADR 0001)."""

from __future__ import annotations

from typing import Any

from basis.admin.errors import AdminError
from basis.knowledge.store import KnowledgeStore

AGENT_REMEMBER_DOC_ID = "__basis_agent_remember__"
AGENT_REMEMBER_SUBJECT_LABEL = "Agent memory"
STATEMENT_REVIEW_KIND = "statement_remember"
STATEMENT_REVIEW_SUBJECT_TYPE = "statement"


def _agent_chunk(knowledge: KnowledgeStore, kb_id: str, actor_id: str) -> str:
    doc = next(
        (d for d in knowledge.list_documents(kb_id) if d.get("doc_id") == AGENT_REMEMBER_DOC_ID),
        None,
    )
    if doc is None:
        outcome = knowledge.store_document_bytes(
            kb_id,
            title="Agent remembered facts",
            mime_type="text/plain",
            data=b"(synthetic anchor for chat/MCP remember proposals)\n",
            created_by=actor_id,
            external_key=AGENT_REMEMBER_DOC_ID,
        )
        version_id = outcome.version_id
        return knowledge.create_chunk(
            kb_id,
            version_id,
            ordinal=0,
            text="Agent-proposed facts awaiting review are anchored here.",
        )
    version_id = doc.get("version_id")
    if not version_id:
        raise AdminError(500, "remember_anchor_broken", "Agent remember 锚点文档无版本")
    chunks = knowledge.list_chunks_for_version(kb_id, version_id)
    if chunks:
        return chunks[0]["id"]
    return knowledge.create_chunk(
        kb_id,
        version_id,
        ordinal=0,
        text="Agent-proposed facts awaiting review are anchored here.",
    )


def propose_remember(
    knowledge: KnowledgeStore,
    kb_id: str,
    actor_id: str,
    content: str,
    *,
    source: str = "agent",
) -> dict[str, Any]:
    text = content.strip()
    if not text:
        raise AdminError(422, "validation_error", "remember 内容不能为空")
    if len(text) > 8000:
        raise AdminError(422, "validation_error", "remember 内容过长")

    chunk_id = _agent_chunk(knowledge, kb_id, actor_id)
    subject_id = knowledge.get_or_create_entity_by_label(kb_id, AGENT_REMEMBER_SUBJECT_LABEL)
    quote = text if len(text) <= 512 else text[:509] + "..."

    statement_id = knowledge.add_open_statement(
        kb_id,
        subject_id=subject_id,
        surface_phrase="remember",
        object_entity_id=None,
        object_value=text,
        status="pending",
        proposed_by=f"{source}:{actor_id}",
        chunk_id=chunk_id,
        quote=quote,
    )
    try:
        item = knowledge.create_review_item(
            kb_id,
            kind=STATEMENT_REVIEW_KIND,
            subject_type=STATEMENT_REVIEW_SUBJECT_TYPE,
            subject_id=statement_id,
            payload={
                "statement_id": statement_id,
                "content": text,
                "source": source,
                "proposed_by": actor_id,
            },
        )
    except AdminError as exc:
        if exc.code == "review_exists":
            knowledge.invalidate_statement(kb_id, statement_id)
        raise
    return {"statement_id": statement_id, "review_item_id": item["id"], "status": "pending"}
