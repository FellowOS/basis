"""KB governance / governor scheduler config — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any

from basis.domain.kb.governance_config import (
    DEFAULT_GOVERNOR_CONFIDENCE_MIN,
    DEFAULT_GOVERNOR_INTERVAL_MINUTES,
    GovernanceConfig,
)


def fetch_governance_config_row(conn: Any, kb_id: str) -> Any:
    return conn.execute(
        "SELECT * FROM kb_governance_configs WHERE kb_id = ?", (kb_id,)
    ).fetchone()


def insert_default_governance_config(
    conn: Any, kb_id: str, *, created_at: str, updated_at: str
) -> None:
    conn.execute(
        """
        INSERT INTO kb_governance_configs (
            kb_id, schema_version, governor_enabled,
            governor_interval_minutes, governor_confidence_min,
            governor_last_run_at, created_at, updated_at
        ) VALUES (?, 1, 0, ?, ?, NULL, ?, ?)
        """,
        (
            kb_id,
            DEFAULT_GOVERNOR_INTERVAL_MINUTES,
            DEFAULT_GOVERNOR_CONFIDENCE_MIN,
            created_at,
            updated_at,
        ),
    )


def governance_config_from_row(row: Any) -> GovernanceConfig:
    return GovernanceConfig(
        kb_id=row["kb_id"],
        schema_version=int(row["schema_version"]),
        governor_enabled=bool(row["governor_enabled"]),
        governor_interval_minutes=int(row["governor_interval_minutes"]),
        governor_confidence_min=float(row["governor_confidence_min"]),
        governor_last_run_at=row["governor_last_run_at"],
    )


def upsert_governance_config(
    conn: Any,
    config: GovernanceConfig,
    *,
    created_at: str,
    updated_at: str,
) -> None:
    conn.execute(
        """
        INSERT INTO kb_governance_configs (
            kb_id, schema_version, governor_enabled,
            governor_interval_minutes, governor_confidence_min,
            governor_last_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(kb_id) DO UPDATE SET
            governor_enabled = excluded.governor_enabled,
            governor_interval_minutes = excluded.governor_interval_minutes,
            governor_confidence_min = excluded.governor_confidence_min,
            updated_at = excluded.updated_at
        """,
        (
            config.kb_id,
            config.schema_version,
            int(config.governor_enabled),
            config.governor_interval_minutes,
            config.governor_confidence_min,
            config.governor_last_run_at,
            created_at,
            updated_at,
        ),
    )


def touch_governor_last_run(conn: Any, kb_id: str, run_at: str, updated_at: str) -> None:
    conn.execute(
        """
        UPDATE kb_governance_configs
        SET governor_last_run_at = ?, updated_at = ?
        WHERE kb_id = ?
        """,
        (run_at, updated_at, kb_id),
    )


def list_governor_enabled_kb_ids(conn: Any) -> list[str]:
    rows = conn.execute(
        """
        SELECT kb_id FROM kb_governance_configs
        WHERE governor_enabled = 1
        ORDER BY kb_id ASC
        """
    ).fetchall()
    return [str(row["kb_id"]) for row in rows]
