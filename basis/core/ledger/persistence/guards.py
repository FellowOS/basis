"""KB scope guards — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any

from basis.core.errors import AdminError

_ROW_TABLES = frozenset({"entities", "chunks", "documents", "document_versions"})


def assert_kb_exists(conn: Any, kb_id: str) -> None:
    row = conn.execute(
        "SELECT id FROM knowledge_bases WHERE id = ?", (kb_id,)
    ).fetchone()
    if row is None:
        raise AdminError(404, "not_found", "知识库不存在")


def assert_row_in_kb(conn: Any, table: str, row_id: str, kb_id: str) -> None:
    if table not in _ROW_TABLES:
        raise ValueError(f"unsupported table guard: {table}")
    row = conn.execute(f"SELECT kb_id FROM {table} WHERE id = ?", (row_id,)).fetchone()
    if row is None:
        raise AdminError(404, "not_found", "记录不存在")
    if row["kb_id"] != kb_id:
        raise AdminError(403, "forbidden", "记录不属于该知识库")
