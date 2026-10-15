"""KB reasoning rule library routes."""

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings


def test_reasoning_rules_crud_and_isolation(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "rules@example.com", "password": "password1", "display_name": "Rules"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "Rules KB", "visibility": "restricted"},
    ).json()["id"]

    created = client.post(
        f"/api/kbs/{kb_id}/rules",
        headers=headers,
        json={
            "name": "Drug candidate",
            "body": "IF inhibits(A, B) AND causes(B, C) THEN candidate(A, C)",
            "enabled": True,
        },
    )
    assert created.status_code == 200
    rule_id = created.json()["rule"]["id"]

    listed = client.get(f"/api/kbs/{kb_id}/rules", headers=headers)
    assert listed.status_code == 200
    assert any(r["id"] == rule_id for r in listed.json()["rules"])

    updated = client.patch(
        f"/api/kbs/{kb_id}/rules/{rule_id}",
        headers=headers,
        json={"enabled": False},
    )
    assert updated.status_code == 200
    assert updated.json()["rule"]["enabled"] is False

    deleted = client.delete(f"/api/kbs/{kb_id}/rules/{rule_id}", headers=headers)
    assert deleted.status_code == 200
    assert client.get(f"/api/kbs/{kb_id}/rules", headers=headers).json()["rules"] == []

    other = client.post(
        "/api/auth/register",
        json={"email": "other@example.com", "password": "password1", "display_name": "Other"},
    ).json()
    headers_b = {"Authorization": f"Bearer {other['token']}"}

    denied = client.get(f"/api/kbs/{kb_id}/rules", headers=headers_b)
    assert denied.status_code == 403
