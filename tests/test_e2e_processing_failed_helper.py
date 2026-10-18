"""E2E-only processing.failed seed route."""

from pathlib import Path

from fastapi.testclient import TestClient

from basis.transport.http.app import create_app
from basis.infra.config import Settings


def test_e2e_processing_failed_helper(tmp_path: Path) -> None:
    data_dir = tmp_path / "data-e2e"
    data_dir.mkdir()
    client = TestClient(create_app(Settings(data_dir=data_dir, ingest_inline=True)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "epf@example.com", "password": "password1", "display_name": "EPF"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    seeded = client.post(f"/api/v1/kbs/{kb_id}/_e2e/processing-failed", headers=headers)
    assert seeded.status_code == 200
    body = seeded.json()
    job_id = body["job_id"]

    listed = client.get(f"/api/v1/kbs/{kb_id}/alerts", headers=headers).json()
    match = next(
        (a for a in listed["alerts"] if a["kind"] == "processing.failed"),
        None,
    )
    assert match is not None
    assert match["detail"]["job_id"] == job_id

    disabled = TestClient(create_app(Settings(data_dir=tmp_path / "other", ingest_inline=True)))
    admin2 = disabled.post(
        "/api/v1/auth/register",
        json={"email": "no@example.com", "password": "password1", "display_name": "No"},
    ).json()
    kb2 = disabled.get("/api/v1/kbs", headers={"Authorization": f"Bearer {admin2['token']}"}).json()[
        "kbs"
    ][0]["id"]
    denied = disabled.post(
        f"/api/v1/kbs/{kb2}/_e2e/processing-failed",
        headers={"Authorization": f"Bearer {admin2['token']}"},
    )
    assert denied.status_code == 404
