"""KB review queue for entity merge proposals."""

from unittest.mock import patch

import pytest

pytest.importorskip("semantica")

from fastapi import HTTPException
from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.capabilities import explorer_available
from sema.config import Settings


def test_entity_merge_review_propose_list_reject(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "rev@example.com", "password": "password1", "display_name": "Rev"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    proposed = client.post(
        f"/api/kbs/{kb_id}/review/items/entity-merge",
        headers=headers,
        json={"primary_id": "node-a", "duplicate_ids": ["node-b"]},
    )
    assert proposed.status_code == 200
    item = proposed.json()["item"]
    assert item["kind"] == "entity_merge"
    assert item["status"] == "open"

    listed = client.get(f"/api/kbs/{kb_id}/review/items", headers=headers)
    assert listed.status_code == 200
    assert any(row["id"] == item["id"] for row in listed.json()["items"])

    rejected = client.post(
        f"/api/kbs/{kb_id}/review/items/{item['id']}/reject",
        headers=headers,
        json={"rationale": "not duplicates"},
    )
    assert rejected.status_code == 200
    assert rejected.json()["item"]["status"] == "rejected"

    audit = client.get(f"/api/kbs/{kb_id}/audit/graph-mutations", headers=headers)
    assert audit.status_code == 200
    actions = [e["action"] for e in audit.json()["events"]]
    assert "kb.graph.merge_proposed" in actions
    assert "kb.graph.merge_rejected" in actions


def test_direct_enrich_merge_blocked(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "blk@example.com", "password": "password1", "display_name": "Blk"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    blocked = client.post(
        f"/api/kbs/{kb_id}/enrich/merge",
        headers=headers,
        json={"primary_id": "a", "duplicate_ids": ["b"]},
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "merge_requires_review"


def test_review_approve_failure_emits_governance_alert(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "gov-rev@example.com", "password": "password1", "display_name": "GovRev"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    proposed = client.post(
        f"/api/kbs/{kb_id}/review/items/entity-merge",
        headers=headers,
        json={"primary_id": "node-a", "duplicate_ids": ["node-b"]},
    ).json()["item"]

    async def fail_merge(*_args, **_kwargs):
        raise HTTPException(status_code=422, detail={"code": "impact_gate", "message": "blocked"})

    with patch("semantica.explorer.routes.enrich.merge_nodes", side_effect=fail_merge):
        failed = client.post(
            f"/api/kbs/{kb_id}/review/items/{proposed['id']}/approve",
            headers=headers,
            json={"rationale": "try merge"},
        )
    assert failed.status_code == 422

    alerts = client.get(f"/api/kbs/{kb_id}/alerts", headers=headers).json()["alerts"]
    assert any(a["kind"] == "governance.tripped" for a in alerts)
