"""Hard-delete all ledger rows for one workspace (`workspace_id`) before removing the admin row."""

from __future__ import annotations

from typing import Any


def _delete_kb_rows(conn: Any, table: str, workspace_id: str) -> None:
    conn.execute(f"DELETE FROM {table} WHERE workspace_id = ?", (workspace_id,))


def _null_kb_supersedes(conn: Any, table: str, workspace_id: str) -> None:
    conn.execute(f"UPDATE {table} SET supersedes_id = NULL WHERE workspace_id = ?", (workspace_id,))


def purge_workspace_ledger_data(conn: Any, workspace_id: str) -> None:
    """Remove workspace-scoped ledger rows so ``workspaces`` can be deleted."""
    conn.execute(
        """
        DELETE FROM chat_citations
        WHERE message_id IN (SELECT id FROM chat_messages WHERE workspace_id = ?)
        """,
        (workspace_id,),
    )
    _delete_kb_rows(conn, "chat_messages", workspace_id)
    _delete_kb_rows(conn, "chat_sessions", workspace_id)

    _delete_kb_rows(conn, "entity_sync_outbox", workspace_id)
    _delete_kb_rows(conn, "entity_external_refs", workspace_id)

    conn.execute(
        """
        DELETE FROM fact_derivations
        WHERE derived_fact_id IN (SELECT id FROM derived_facts WHERE workspace_id = ?)
           OR (
                premise_kind = 'statement'
                AND premise_id IN (SELECT id FROM statements WHERE workspace_id = ?)
           )
        """,
        (workspace_id, workspace_id),
    )
    _delete_kb_rows(conn, "derived_facts", workspace_id)

    for table in ("agent_decisions", "statements", "mappings", "typed_facts"):
        _null_kb_supersedes(conn, table, workspace_id)

    _delete_kb_rows(conn, "review_items", workspace_id)
    _delete_kb_rows(conn, "agent_decisions", workspace_id)
    _delete_kb_rows(conn, "entity_merges", workspace_id)
    _delete_kb_rows(conn, "statement_evidence", workspace_id)
    _delete_kb_rows(conn, "statement_qualifiers", workspace_id)
    _delete_kb_rows(conn, "time_mentions", workspace_id)
    _delete_kb_rows(conn, "typed_facts", workspace_id)
    _delete_kb_rows(conn, "statements", workspace_id)
    _delete_kb_rows(conn, "mappings", workspace_id)
    _delete_kb_rows(conn, "entity_names", workspace_id)
    _delete_kb_rows(conn, "entities", workspace_id)

    _delete_kb_rows(conn, "embedding_records", workspace_id)
    _delete_kb_rows(conn, "extraction_drops", workspace_id)
    _delete_kb_rows(conn, "chunks", workspace_id)

    conn.execute(
        "UPDATE documents SET current_version_id = NULL WHERE workspace_id = ?",
        (workspace_id,),
    )
    _delete_kb_rows(conn, "document_versions", workspace_id)
    _delete_kb_rows(conn, "documents", workspace_id)

    _delete_kb_rows(conn, "source_table_mappings", workspace_id)
    _delete_kb_rows(conn, "connector_runs", workspace_id)
    _delete_kb_rows(conn, "ingest_sources", workspace_id)
    _delete_kb_rows(conn, "jobs", workspace_id)
    _delete_kb_rows(conn, "projection_state", workspace_id)
    _delete_kb_rows(conn, "alerts", workspace_id)
    _delete_kb_rows(conn, "reasoning_rules", workspace_id)
