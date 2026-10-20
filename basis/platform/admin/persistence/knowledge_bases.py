"""Knowledge bases and membership."""

from __future__ import annotations

from typing import Any

from basis.platform.admin.admin_types import utc_now_iso
from basis.domain.kb.persistence.kb_delete import purge_kb_ledger_data


def list_kb_ids(conn: Any) -> list[str]:
    rows = conn.execute("SELECT id FROM knowledge_bases ORDER BY created_at").fetchall()
    return [row["id"] for row in rows]


def fetch_kb(conn: Any, kb_id: str) -> Any | None:
    return conn.execute("SELECT * FROM knowledge_bases WHERE id = ?", (kb_id,)).fetchone()


def list_all_kbs(conn: Any) -> list[Any]:
    return conn.execute("SELECT * FROM knowledge_bases ORDER BY created_at").fetchall()


def list_visible_kbs_for_user(conn: Any, user_id: str) -> list[Any]:
    return conn.execute(
        """
        SELECT kb.* FROM knowledge_bases kb
        LEFT JOIN kb_members m ON m.kb_id = kb.id AND m.user_id = ?
        WHERE kb.visibility = 'open' OR m.user_id IS NOT NULL
        ORDER BY kb.created_at
        """,
        (user_id,),
    ).fetchall()


def insert_kb(
    conn: Any,
    *,
    kb_id: str,
    name: str,
    description: str,
    visibility: str,
    created_by: str,
    organization_id: str,
) -> str:
    conn.execute(
        """
        INSERT INTO knowledge_bases(
            id, name, description, visibility, created_by, created_at, organization_id
        )
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (kb_id, name, description, visibility, created_by, utc_now_iso(), organization_id),
    )
    return kb_id


def update_kb(
    conn: Any,
    kb_id: str,
    *,
    name: str,
    description: str,
    visibility: str,
) -> None:
    conn.execute(
        """
        UPDATE knowledge_bases
        SET name = ?, description = ?, visibility = ?
        WHERE id = ?
        """,
        (name, description, visibility, kb_id),
    )


def delete_kb(conn: Any, kb_id: str) -> None:
    purge_kb_ledger_data(conn, kb_id)
    conn.execute("DELETE FROM kb_members WHERE kb_id = ?", (kb_id,))
    conn.execute("DELETE FROM knowledge_bases WHERE id = ?", (kb_id,))


def set_member(
    conn: Any,
    kb_id: str,
    user_id: str,
    role: str,
    added_by: str | None,
) -> None:
    conn.execute(
        """
        INSERT INTO kb_members(kb_id, user_id, role, added_by, joined_at)
        VALUES (?, ?, ?, ?, ?)
        ON CONFLICT(kb_id, user_id) DO UPDATE SET role = excluded.role
        """,
        (kb_id, user_id, role, added_by, utc_now_iso()),
    )


def member_role(conn: Any, kb_id: str, user_id: str) -> str | None:
    row = conn.execute(
        "SELECT role FROM kb_members WHERE kb_id = ? AND user_id = ?",
        (kb_id, user_id),
    ).fetchone()
    return row["role"] if row else None


def owner_count(conn: Any, kb_id: str) -> int:
    return conn.execute(
        "SELECT COUNT(*) AS n FROM kb_members WHERE kb_id = ? AND role = 'owner'",
        (kb_id,),
    ).fetchone()["n"]


def list_members(conn: Any, kb_id: str) -> list[Any]:
    return conn.execute(
        """
        SELECT m.role, m.joined_at, u.id, u.email, u.display_name
        FROM kb_members m
        JOIN users u ON u.id = m.user_id
        WHERE m.kb_id = ? AND u.deactivated_at IS NULL
        ORDER BY m.joined_at
        """,
        (kb_id,),
    ).fetchall()


def remove_member(conn: Any, kb_id: str, user_id: str) -> None:
    conn.execute(
        "DELETE FROM kb_members WHERE kb_id = ? AND user_id = ?",
        (kb_id, user_id),
    )


def kb_count(conn: Any) -> int:
    row = conn.execute("SELECT COUNT(*) AS n FROM knowledge_bases").fetchone()
    return int(row["n"]) if row else 0
