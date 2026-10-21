"""Slack procedure invoke uses form-urlencoded POST bodies."""

from __future__ import annotations

from pathlib import Path

import httpx

from basis.domain.integration import ConnectorAuthVault, ConnectorRuntime
from basis.domain.integration.primitive_invoke import execute_connector_primitive
from basis.infra.tooling.db.sqlite_migrations import run_migrations


def _setup_kb_db(tmp_path: Path):
    import sqlite3

    conn = sqlite3.connect(str(tmp_path / "basis.db"))
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
        INSERT INTO knowledge_bases (id, name, description, visibility, created_by, created_at)
        VALUES ('kb1', 'KB 1', '', 'private', 'u1', '2026-01-01T00:00:00Z')
        """
    )
    conn.commit()
    return conn


def test_slack_post_message_invoke_uses_form_body(tmp_path: Path) -> None:
    captured: list[httpx.Request] = []

    def handler(request: httpx.Request) -> httpx.Response:
        captured.append(request)
        if request.url.path.endswith("/chat.postMessage"):
            assert b"application/x-www-form-urlencoded" in (
                request.headers.get("content-type", "").encode()
            )
            return httpx.Response(200, json={"ok": True, "ts": "1", "channel": "C1"})
        return httpx.Response(404)

    mock_client = httpx.Client(transport=httpx.MockTransport(handler))
    conn = _setup_kb_db(tmp_path)
    try:
        vault = ConnectorAuthVault(conn, vault_secret="test-secret")
        vault.upsert_connection(
            "kb1",
            "slack",
            connection_name="default",
            auth_type="api_key",
            credentials={"bot_token": "xoxb-test"},
        )
        runtime = ConnectorRuntime(conn, vault_secret="test-secret", http_client=mock_client)
        execute_connector_primitive(
            runtime,
            "kb1",
            "slack",
            action_id="slack.post_message",
            primitive="invoke",
            arguments={"channelId": "C1", "text": "hi"},
        )
        assert captured
        post = captured[-1]
        assert post.method == "POST"
        body = post.content.decode("utf-8")
        assert "channelId=C1" in body or "channelId=" in body
        assert "text=hi" in body
    finally:
        mock_client.close()
        conn.close()
