"""Graph diff staging manifest (F-DIFF-01 read path + governance hints)."""

from __future__ import annotations

from datetime import datetime, timezone
import hashlib
import json
from typing import Any

from basis.domain.explorer.graph_diff import diff_session_at


def _now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def staging_session_key(kb_id: str, from_time: str, to_time: str) -> str:
    """Stable id for a compare range (client draft persistence; F-DIFF-01)."""
    payload = f"{kb_id}\x1f{from_time.strip()}\x1f{to_time.strip()}".encode()
    return hashlib.sha256(payload).hexdigest()[:16]


def _change_total(summary: dict[str, Any]) -> int:
    return sum(int(summary.get(key) or 0) for key in (
        "nodes_added",
        "nodes_removed",
        "nodes_modified",
        "edges_added",
        "edges_removed",
    ))


def build_graph_staging_payload(
    kb_id: str,
    diff: dict[str, Any],
    *,
    draft: dict[str, Any] | None = None,
) -> dict[str, Any]:
    summary = dict(diff.get("summary") or {})
    focus_node_ids: list[str] = list(diff.get("added_nodes") or [])
    focus_node_ids.extend(row["id"] for row in diff.get("modified_nodes") or [] if row.get("id"))
    from_time = str(diff.get("from_time") or "")
    to_time = str(diff.get("to_time") or "")
    return {
        "kb_id": kb_id,
        "manifest": {
            "session_key": staging_session_key(kb_id, from_time, to_time),
            "from_time": from_time or diff.get("from_time"),
            "to_time": to_time or diff.get("to_time"),
            "change_total": _change_total(summary),
            "summary": summary,
            "focus_node_ids": focus_node_ids,
            "removed_node_ids": list(diff.get("removed_nodes") or []),
            "draft": draft or {"primary": "", "duplicate": ""},
            "governance": {
                "direct_merge_allowed": False,
                "review_queue_relpath": "review",
                "entity_merge_proposal_relpath": "graph/staging/entity-merge",
                "graph_import_relpath": "review/items/graph-import",
            },
        },
        "diff": diff,
    }


def _ensure_staging_table(conn: Any) -> None:
    if conn is None:
        return
    conn.execute(
        """
        CREATE TABLE IF NOT EXISTS kb_graph_staging_sessions (
            kb_id TEXT NOT NULL REFERENCES knowledge_bases(id) ON DELETE CASCADE,
            session_key TEXT NOT NULL,
            from_time TEXT NOT NULL,
            to_time TEXT NOT NULL,
            draft_json TEXT NOT NULL DEFAULT '{}',
            manifest_json TEXT NOT NULL DEFAULT '{}',
            updated_by TEXT REFERENCES users(id),
            updated_at TEXT NOT NULL,
            PRIMARY KEY (kb_id, session_key)
        )
        """
    )


def get_persisted_staging_draft(conn: Any, kb_id: str, session_key: str) -> dict[str, Any] | None:
    if conn is None:
        return None
    _ensure_staging_table(conn)
    row = conn.execute(
        """
        SELECT draft_json FROM kb_graph_staging_sessions
        WHERE kb_id = ? AND session_key = ?
        """,
        (kb_id, session_key),
    ).fetchone()
    if not row or not row[0]:
        return None
    try:
        parsed = json.loads(row[0])
        return parsed if isinstance(parsed, dict) else None
    except json.JSONDecodeError:
        return None


def upsert_persisted_staging_session(
    conn: Any,
    kb_id: str,
    *,
    session_key: str,
    from_time: str = "",
    to_time: str = "",
    draft: dict[str, Any] | None = None,
    manifest: dict[str, Any] | None = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    _ensure_staging_table(conn)
    now = _now_iso()
    existing = conn.execute(
        """
        SELECT from_time, to_time, draft_json, manifest_json
        FROM kb_graph_staging_sessions
        WHERE kb_id = ? AND session_key = ?
        """,
        (kb_id, session_key),
    ).fetchone()
    final_from = from_time or (existing[0] if existing else "")
    final_to = to_time or (existing[1] if existing else "")
    if draft is not None:
        final_draft = draft
    elif existing and existing[2]:
        try:
            final_draft = json.loads(existing[2])
        except json.JSONDecodeError:
            final_draft = {"primary": "", "duplicate": ""}
    else:
        final_draft = {"primary": "", "duplicate": ""}

    if manifest is not None:
        final_manifest = manifest
    elif existing and existing[3]:
        try:
            final_manifest = json.loads(existing[3])
        except json.JSONDecodeError:
            final_manifest = {}
    else:
        final_manifest = {}

    conn.execute(
        """
        INSERT INTO kb_graph_staging_sessions (
            kb_id, session_key, from_time, to_time, draft_json, manifest_json, updated_by, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kb_id, session_key) DO UPDATE SET
            from_time = excluded.from_time,
            to_time = excluded.to_time,
            draft_json = excluded.draft_json,
            manifest_json = excluded.manifest_json,
            updated_by = COALESCE(excluded.updated_by, kb_graph_staging_sessions.updated_by),
            updated_at = excluded.updated_at
        """,
        (
            kb_id,
            session_key,
            final_from,
            final_to,
            json.dumps(final_draft, ensure_ascii=False),
            json.dumps(final_manifest, ensure_ascii=False),
            updated_by,
            now,
        ),
    )
    conn.commit()
    return {
        "kb_id": kb_id,
        "session_key": session_key,
        "from_time": final_from,
        "to_time": final_to,
        "draft": final_draft,
        "updated_at": now,
    }


def graph_staging_at(
    session: Any,
    kb_id: str,
    from_time: str,
    to_time: str,
    *,
    conn: Any = None,
    updated_by: str | None = None,
) -> dict[str, Any]:
    diff = diff_session_at(session, from_time, to_time)
    skey = staging_session_key(
        kb_id, str(diff.get("from_time") or from_time), str(diff.get("to_time") or to_time)
    )
    persisted_draft = get_persisted_staging_draft(conn, kb_id, skey)
    payload = build_graph_staging_payload(kb_id, diff, draft=persisted_draft)
    if conn is not None:
        upsert_persisted_staging_session(
            conn,
            kb_id,
            session_key=skey,
            from_time=str(diff.get("from_time") or from_time),
            to_time=str(diff.get("to_time") or to_time),
            draft=persisted_draft,
            manifest=payload["manifest"],
            updated_by=updated_by,
        )
    return payload
