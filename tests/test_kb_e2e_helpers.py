"""E2E-only API helpers are gated on data-e2e dir."""

from pathlib import Path

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.capabilities import explorer_available
from basis.config import Settings


def test_e2e_governance_trip_disabled_outside_data_e2e(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "e2e@example.com", "password": "password1", "display_name": "E2E"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    res = client.post(f"/api/kbs/{kb_id}/_e2e/governance-trip", headers=headers)
    assert res.status_code == 404


def test_e2e_governance_trip_records_alert_and_decision(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    e2e_dir = tmp_path / "data-e2e"
    e2e_dir.mkdir()
    client = TestClient(create_app(Settings(data_dir=e2e_dir)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "e2e2@example.com", "password": "password1", "display_name": "E2E2"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    trip = client.post(f"/api/kbs/{kb_id}/_e2e/governance-trip", headers=headers)
    assert trip.status_code == 200
    decision_id = trip.json().get("decision_id")
    assert isinstance(decision_id, str) and decision_id

    alerts = client.get(f"/api/kbs/{kb_id}/alerts", headers=headers).json()["alerts"]
    tripped = [a for a in alerts if a["kind"] == "governance.tripped"]
    assert tripped
    assert tripped[0]["detail"].get("decision_id") == decision_id
