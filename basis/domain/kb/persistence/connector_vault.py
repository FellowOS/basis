"""BOCP vault tables (policies, OAuth configs, connections, audit runs) — canonical DB SQL."""

from __future__ import annotations

import json
from typing import Any

from basis.domain.connectors.canonical_db import LockedCanonicalConn


class ConnectorVaultPersistence:
    """SQL access for connector vault tables; uses LockedCanonicalConn for locking."""

    def __init__(self, db: LockedCanonicalConn) -> None:
        self._db = db

    def fetch_policy_row(self, kb_id: str) -> Any:
        return self._db.execute(
            """
            SELECT allowed_providers_json, action_policy_json, updated_at
            FROM kb_connector_policies
            WHERE kb_id = ?
            """,
            (kb_id,),
        ).fetchone()

    def upsert_policy(
        self,
        kb_id: str,
        allowed_json: str,
        action_json: str,
        updated_at: str,
    ) -> None:
        self._db.execute(
            """
            INSERT INTO kb_connector_policies (kb_id, allowed_providers_json, action_policy_json, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(kb_id) DO UPDATE SET
                allowed_providers_json = excluded.allowed_providers_json,
                action_policy_json = excluded.action_policy_json,
                updated_at = excluded.updated_at
            """,
            (kb_id, allowed_json, action_json, updated_at),
        )
        self._db.commit()

    def fetch_oauth_config_row(self, kb_id: str, service: str) -> Any:
        return self._db.execute(
            "SELECT value_encrypted, updated_at FROM kb_oauth_configs WHERE kb_id = ? AND service = ?",
            (kb_id, service),
        ).fetchone()

    def upsert_oauth_config(
        self,
        kb_id: str,
        service: str,
        value_encrypted: str,
        updated_at: str,
    ) -> None:
        self._db.execute(
            """
            INSERT INTO kb_oauth_configs (kb_id, service, value_encrypted, updated_at)
            VALUES (?, ?, ?, ?)
            ON CONFLICT(kb_id, service) DO UPDATE SET
                value_encrypted = excluded.value_encrypted,
                updated_at = excluded.updated_at
            """,
            (kb_id, service, value_encrypted, updated_at),
        )
        self._db.commit()

    def fetch_connection_row(
        self,
        kb_id: str,
        service: str,
        connection_name: str,
    ) -> Any:
        return self._db.execute(
            """
            SELECT auth_type, connection_config_json, value_encrypted,
                   account_profile_json, revision, updated_at
            FROM kb_connections
            WHERE kb_id = ? AND service = ? AND connection_name = ?
            """,
            (kb_id, service, connection_name),
        ).fetchone()

    def list_connection_rows(self, kb_id: str, *, service: str | None = None) -> list[Any]:
        if service:
            return self._db.execute(
                """
                SELECT service, connection_name, auth_type, connection_config_json,
                       value_encrypted, account_profile_json, revision, updated_at
                FROM kb_connections
                WHERE kb_id = ? AND service = ?
                ORDER BY service, connection_name
                """,
                (kb_id, service),
            ).fetchall()
        return self._db.execute(
            """
            SELECT service, connection_name, auth_type, connection_config_json,
                   value_encrypted, account_profile_json, revision, updated_at
            FROM kb_connections
            WHERE kb_id = ?
            ORDER BY service, connection_name
            """,
            (kb_id,),
        ).fetchall()

    def upsert_connection(
        self,
        *,
        kb_id: str,
        service: str,
        connection_name: str,
        auth_type: str,
        connection_config_json: str,
        value_encrypted: str,
        account_profile_json: str,
        revision: int,
        updated_at: str,
    ) -> None:
        self._db.execute(
            """
            INSERT INTO kb_connections (
                kb_id, service, connection_name, auth_type,
                connection_config_json, value_encrypted, account_profile_json,
                revision, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(kb_id, service, connection_name) DO UPDATE SET
                auth_type = excluded.auth_type,
                connection_config_json = excluded.connection_config_json,
                value_encrypted = excluded.value_encrypted,
                account_profile_json = excluded.account_profile_json,
                revision = excluded.revision,
                updated_at = excluded.updated_at
            """,
            (
                kb_id,
                service,
                connection_name,
                auth_type,
                connection_config_json,
                value_encrypted,
                account_profile_json,
                revision,
                updated_at,
            ),
        )
        self._db.commit()

    def delete_connection(self, kb_id: str, service: str, connection_name: str) -> int:
        cur = self._db.execute(
            "DELETE FROM kb_connections WHERE kb_id = ? AND service = ? AND connection_name = ?",
            (kb_id, service, connection_name),
        )
        self._db.commit()
        return int(cur.rowcount if cur.rowcount is not None and cur.rowcount >= 0 else 0)

    def insert_connector_run(
        self,
        *,
        run_id: str,
        kb_id: str,
        service: str,
        operation_kind: str,
        target_id: str,
        connection_name: str,
        started_at: str,
        completed_at: str,
        ok: int,
        value_json: str,
    ) -> None:
        self._db.execute(
            """
            INSERT INTO kb_connector_runs (
                id, kb_id, service, operation_kind, target_id,
                connection_name, started_at, completed_at, ok, value_json
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                run_id,
                kb_id,
                service,
                operation_kind,
                target_id,
                connection_name,
                started_at,
                completed_at,
                ok,
                value_json,
            ),
        )
        self._db.commit()

    def list_connector_runs(
        self,
        kb_id: str,
        *,
        service: str | None = None,
        limit: int = 50,
    ) -> list[dict[str, Any]]:
        if service:
            rows = self._db.execute(
                """
                SELECT id, service, operation_kind, target_id, connection_name,
                       started_at, completed_at, ok, value_json
                FROM kb_connector_runs
                WHERE kb_id = ? AND service = ?
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (kb_id, service, limit),
            ).fetchall()
        else:
            rows = self._db.execute(
                """
                SELECT id, service, operation_kind, target_id, connection_name,
                       started_at, completed_at, ok, value_json
                FROM kb_connector_runs
                WHERE kb_id = ?
                ORDER BY started_at DESC
                LIMIT ?
                """,
                (kb_id, limit),
            ).fetchall()
        runs: list[dict[str, Any]] = []
        for row in rows:
            runs.append(
                {
                    "id": row[0],
                    "service": row[1],
                    "operation_kind": row[2],
                    "target_id": row[3],
                    "connection_name": row[4],
                    "started_at": row[5],
                    "completed_at": row[6],
                    "ok": bool(row[7]),
                    "value": json.loads(row[8]) if row[8] else {},
                }
            )
        return runs
