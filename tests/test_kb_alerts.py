"""KB alert episodes (F-ALT MVP)."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings


def _test_settings(tmp_path) -> Settings:
    return Settings(data_dir=tmp_path, ingest_inline=True)


def test_sync_failure_emits_alert(tmp_path) -> None:
    client = TestClient(create_app(_test_settings(tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "alt@example.com", "password": "password1", "display_name": "Alt"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    created = client.post(
        f"/api/v1/kbs/{kb_id}/sources",
        headers=headers,
        json={
            "kind": "http_poll",
            "name": "Feed",
            "config": {"url": "https://example.com/feed.txt"},
        },
    )
    source_id = created.json()["source"]["id"]

    mock_http = MagicMock()
    mock_http.get.side_effect = RuntimeError("connection reset")
    mock_http.__enter__ = MagicMock(return_value=mock_http)
    mock_http.__exit__ = MagicMock(return_value=False)

    with patch("basis.knowledge.ingest_source_service.httpx.Client", return_value=mock_http):
        failed = client.post(f"/api/v1/kbs/{kb_id}/sources/{source_id}/sync", headers=headers, json={})
    assert failed.status_code >= 400

    listed = client.get(f"/api/v1/kbs/{kb_id}/alerts", headers=headers)
    assert listed.status_code == 200
    body = listed.json()
    assert body["unread_count"] >= 1
    alerts = body["alerts"]
    assert any(a["kind"] == "sync_failed" for a in alerts)
    alert_id = next(a["id"] for a in alerts if a["kind"] == "sync_failed")

    dismissed = client.post(
        f"/api/v1/kbs/{kb_id}/alerts/{alert_id}/dismiss",
        headers=headers,
    )
    assert dismissed.status_code == 200
    assert dismissed.json()["alert"]["dismissed_at"]

    after = client.get(f"/api/v1/kbs/{kb_id}/alerts", headers=headers)
    assert all(a["id"] != alert_id for a in after.json()["alerts"])


def test_alerts_kb_isolation(tmp_path) -> None:
    client = TestClient(create_app(_test_settings(tmp_path)))
    a = client.post(
        "/api/v1/auth/register",
        json={"email": "iso-alt@example.com", "password": "password1", "display_name": "Iso"},
    ).json()
    headers = {"Authorization": f"Bearer {a['token']}"}
    kb_a = client.post(
        "/api/v1/kbs",
        headers=headers,
        json={"name": "Private alerts", "visibility": "restricted"},
    ).json()["id"]
    kb_b = client.post(
        "/api/v1/kbs",
        headers=headers,
        json={"name": "Other", "visibility": "restricted"},
    ).json()["id"]

    other = client.post(
        "/api/v1/auth/register",
        json={"email": "stranger@example.com", "password": "password1", "display_name": "Str"},
    ).json()
    headers_b = {"Authorization": f"Bearer {other['token']}"}

    denied = client.get(f"/api/v1/kbs/{kb_a}/alerts", headers=headers_b)
    assert denied.status_code == 403

    ok_b = client.get(f"/api/v1/kbs/{kb_b}/alerts", headers=headers)
    assert ok_b.status_code == 200


def test_list_kb_alerts_since_skips_at_or_before_cursor(tmp_path) -> None:
    client = TestClient(create_app(_test_settings(tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "since@example.com", "password": "password1", "display_name": "Since"},
    ).json()
    kb_id = client.get(
        "/api/v1/kbs",
        headers={"Authorization": f"Bearer {admin['token']}"},
    ).json()["kbs"][0]["id"]
    knowledge = client.app.state.knowledge_store
    first = knowledge.create_kb_alert(kb_id, kind="sync_failed", message="First")
    second = knowledge.create_kb_alert(kb_id, kind="sync_failed", message="Second")
    after_first = knowledge.list_kb_alerts_since(
        kb_id,
        since_created_at=first["created_at"],
    )
    ids = {a["id"] for a in after_first}
    assert first["id"] not in ids
    assert second["id"] in ids
