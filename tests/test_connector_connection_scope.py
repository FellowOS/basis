"""Dual-mode connector vault (workspace vs end_user subject_id)."""

from __future__ import annotations

import sqlite3
from pathlib import Path

import pytest

from basis.domain.connector import ConnectorAuthVault
from basis.domain.connector.connection_scope import SCOPE_END_USER, SCOPE_WORKSPACE
from basis.infra.tooling.db.sqlite_migrations import run_migrations


def _workspace_db(tmp_path: Path) -> sqlite3.Connection:
    db = tmp_path / "scope.db"
    conn = sqlite3.connect(str(db))
    run_migrations(conn)
    conn.execute("PRAGMA foreign_keys = ON")
    conn.execute(
        """
        INSERT INTO users (id, email, display_name, password_hash, is_admin, created_at)
        VALUES ('u1', 'u1@example.com', 'User 1', 'hash', 1, '2026-01-01T00:00:00Z')
        """
    )
    conn.execute(
        """
        INSERT INTO workspaces (id, name, description, visibility, created_by, created_at)
        VALUES ('kb1', 'KB 1', '', 'private', 'u1', '2026-01-01T00:00:00Z')
        """
    )
    conn.commit()
    return conn


def test_workspace_and_end_user_connections_isolated(tmp_path: Path) -> None:
    conn = _workspace_db(tmp_path)
    try:
        vault = ConnectorAuthVault(conn, vault_secret="test-secret")
        ws = vault.upsert_connection(
            "kb1",
            "github",
            connection_name="default",
            auth_type="oauth2",
            credentials={"access_token": "ws_token"},
        )
        assert ws.connection_scope == SCOPE_WORKSPACE
        assert ws.subject_id == ""

        end = vault.upsert_connection(
            "kb1",
            "github",
            connection_name="default",
            connection_scope=SCOPE_END_USER,
            subject_id="fellow-user-42",
            auth_type="oauth2",
            credentials={"access_token": "user_token"},
        )
        assert end.connection_scope == SCOPE_END_USER
        assert end.subject_id == "fellow-user-42"
        assert end.credentials["access_token"] == "user_token"

        listed = vault.list_connections("kb1", service="github")
        assert len(listed) == 2

        only_end = vault.list_connections(
            "kb1",
            service="github",
            connection_scope=SCOPE_END_USER,
            subject_id="fellow-user-42",
        )
        assert len(only_end) == 1
        assert only_end[0].credentials["access_token"] == "user_token"

        pub = only_end[0].to_public_dict()
        assert pub["connection_scope"] == SCOPE_END_USER
        assert pub["subject_id"] == "fellow-user-42"
        assert "credentials" not in pub

        assert vault.delete_connection(
            "kb1",
            "github",
            connection_scope=SCOPE_END_USER,
            subject_id="fellow-user-42",
        )
        assert vault.get_connection(
            "kb1",
            "github",
            connection_scope=SCOPE_END_USER,
            subject_id="fellow-user-42",
        ) is None
        assert vault.get_connection("kb1", "github") is not None
    finally:
        conn.close()


def test_end_user_requires_subject_id(tmp_path: Path) -> None:
    conn = _workspace_db(tmp_path)
    try:
        vault = ConnectorAuthVault(conn, vault_secret="test-secret")
        with pytest.raises(ValueError, match="subject_id"):
            vault.upsert_connection(
                "kb1",
                "github",
                connection_scope=SCOPE_END_USER,
                auth_type="api_key",
                credentials={"api_key": "x"},
            )
    finally:
        conn.close()
