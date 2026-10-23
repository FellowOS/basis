"""Workspace governance / governor scheduler config — canonical DB SQL (caller holds lock)."""

from __future__ import annotations

from typing import Any

from basis.domain.knowledge.governance_config import (
    DEFAULT_GOVERNOR_CONFIDENCE_MIN,
    DEFAULT_GOVERNOR_INTERVAL_MINUTES,
    GovernanceConfig,
)


def fetch_governance_config_row(conn: Any, workspace_id: str) -> Any:
    return conn.execute(
        "SELECT * FROM governance_configs WHERE workspace_id = ?", (workspace_id,)
    ).fetchone()


def insert_default_governance_config(
    conn: Any, workspace_id: str, *, created_at: str, updated_at: str
) -> None:
    conn.execute(
        """
        INSERT INTO governance_configs (
            workspace_id, schema_version, governor_enabled,
            governor_interval_minutes, governor_confidence_min,
            governor_last_run_at, created_at, updated_at
        ) VALUES (?, 1, 0, ?, ?, NULL, ?, ?)
        """,
        (
            workspace_id,
            DEFAULT_GOVERNOR_INTERVAL_MINUTES,
            DEFAULT_GOVERNOR_CONFIDENCE_MIN,
            created_at,
            updated_at,
        ),
    )


def governance_config_from_row(row: Any) -> GovernanceConfig:
    return GovernanceConfig(
        workspace_id=row["workspace_id"],
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
        INSERT INTO governance_configs (
            workspace_id, schema_version, governor_enabled,
            governor_interval_minutes, governor_confidence_min,
            governor_last_run_at, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(workspace_id) DO UPDATE SET
            governor_enabled = excluded.governor_enabled,
            governor_interval_minutes = excluded.governor_interval_minutes,
            governor_confidence_min = excluded.governor_confidence_min,
            updated_at = excluded.updated_at
        """,
        (
            config.workspace_id,
            config.schema_version,
            int(config.governor_enabled),
            config.governor_interval_minutes,
            config.governor_confidence_min,
            config.governor_last_run_at,
            created_at,
            updated_at,
        ),
    )


def touch_governor_last_run(conn: Any, workspace_id: str, run_at: str, updated_at: str) -> None:
    conn.execute(
        """
        UPDATE governance_configs
        SET governor_last_run_at = ?, updated_at = ?
        WHERE workspace_id = ?
        """,
        (run_at, updated_at, workspace_id),
    )


def list_governor_enabled_workspace_ids(conn: Any) -> list[str]:
    rows = conn.execute(
        """
        SELECT workspace_id FROM governance_configs
        WHERE governor_enabled = 1
        ORDER BY workspace_id ASC
        """
    ).fetchall()
    return [str(row["workspace_id"]) for row in rows]
