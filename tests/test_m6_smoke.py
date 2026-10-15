"""M6 vertical-slice API smoke (alerts, rules, ingest sources)."""

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def _client(tmp_path) -> TestClient:
    return TestClient(create_app(Settings(data_dir=tmp_path, ingest_inline=True)))


def _headers(client: TestClient, email: str = "m6@example.com") -> dict[str, str]:
    body = client.post(
        "/api/auth/register",
        json={"email": email, "password": "password1", "display_name": "M6"},
    ).json()
    return {"Authorization": f"Bearer {body['token']}"}


def test_m6_kb_alerts_rules_sources_smoke(tmp_path) -> None:
    client = _client(tmp_path)
    headers = _headers(client)
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    alerts = client.get(f"/api/kbs/{kb_id}/alerts", headers=headers)
    assert alerts.status_code == 200
    assert "alerts" in alerts.json()

    created = client.post(
        f"/api/kbs/{kb_id}/rules",
        headers=headers,
        json={"name": "smoke", "body": "IF a(X) THEN b(X)", "enabled": True},
    )
    assert created.status_code == 200
    listed = client.get(f"/api/kbs/{kb_id}/rules", headers=headers)
    assert listed.status_code == 200
    assert any(r["name"] == "smoke" for r in listed.json()["rules"])

    sources = client.get(f"/api/kbs/{kb_id}/sources", headers=headers)
    assert sources.status_code == 200
    assert "sources" in sources.json()

    webhook = client.post(
        f"/api/kbs/{kb_id}/sources",
        headers=headers,
        json={"kind": "webhook", "name": "m6-hook"},
    )
    assert webhook.status_code == 200
    assert webhook.json().get("ingest_token")
