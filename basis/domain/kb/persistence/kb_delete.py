"""Hard-delete all ledger rows for one knowledge base (before removing the KB row)."""

from __future__ import annotations

from typing import Any


def _delete_kb_rows(conn: Any, table: str, kb_id: str) -> None:
    conn.execute(f"DELETE FROM {table} WHERE kb_id = ?", (kb_id,))


def _null_kb_supersedes(conn: Any, table: str, kb_id: str) -> None:
    conn.execute(f"UPDATE {table} SET supersedes_id = NULL WHERE kb_id = ?", (kb_id,))


def purge_kb_ledger_data(conn: Any, kb_id: str) -> None:
    """Remove KB-scoped ledger rows so ``knowledge_bases`` can be deleted."""
    conn.execute(
        """
        DELETE FROM chat_citations
        WHERE message_id IN (SELECT id FROM chat_messages WHERE kb_id = ?)
        """,
        (kb_id,),
    )
    _delete_kb_rows(conn, "chat_messages", kb_id)
    _delete_kb_rows(conn, "chat_sessions", kb_id)

    _delete_kb_rows(conn, "entity_sync_outbox", kb_id)
    _delete_kb_rows(conn, "entity_external_refs", kb_id)

    conn.execute(
        """
        DELETE FROM fact_derivations
        WHERE derived_fact_id IN (SELECT id FROM derived_facts WHERE kb_id = ?)
           OR (
                premise_kind = 'statement'
                AND premise_id IN (SELECT id FROM statements WHERE kb_id = ?)
           )
        """,
        (kb_id, kb_id),
    )
    _delete_kb_rows(conn, "derived_facts", kb_id)

    for table in ("agent_decisions", "statements", "mappings", "typed_facts"):
        _null_kb_supersedes(conn, table, kb_id)

    _delete_kb_rows(conn, "review_items", kb_id)
    _delete_kb_rows(conn, "agent_decisions", kb_id)
    _delete_kb_rows(conn, "entity_merges", kb_id)
    _delete_kb_rows(conn, "statement_evidence", kb_id)
    _delete_kb_rows(conn, "statement_qualifiers", kb_id)
    _delete_kb_rows(conn, "time_mentions", kb_id)
    _delete_kb_rows(conn, "typed_facts", kb_id)
    _delete_kb_rows(conn, "statements", kb_id)
    _delete_kb_rows(conn, "mappings", kb_id)
    _delete_kb_rows(conn, "entity_names", kb_id)
    _delete_kb_rows(conn, "entities", kb_id)

    _delete_kb_rows(conn, "embedding_records", kb_id)
    _delete_kb_rows(conn, "extraction_drops", kb_id)
    _delete_kb_rows(conn, "chunks", kb_id)

    conn.execute(
        "UPDATE documents SET current_version_id = NULL WHERE kb_id = ?",
        (kb_id,),
    )
    _delete_kb_rows(conn, "document_versions", kb_id)
    _delete_kb_rows(conn, "documents", kb_id)

    _delete_kb_rows(conn, "source_table_mappings", kb_id)
    _delete_kb_rows(conn, "kb_connector_runs", kb_id)
    _delete_kb_rows(conn, "ingest_sources", kb_id)
    _delete_kb_rows(conn, "jobs", kb_id)
    _delete_kb_rows(conn, "projection_state", kb_id)
    _delete_kb_rows(conn, "kb_alerts", kb_id)
    _delete_kb_rows(conn, "kb_reasoning_rules", kb_id)
