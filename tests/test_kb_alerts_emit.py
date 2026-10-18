"""Alert emit helpers."""

from fastapi.testclient import TestClient

from basis.transport.http.app import create_app
from basis.infra.config import Settings
from basis.domain.kb.kb_alerts_emit import (
    emit_governance_proposal_proposed_alert,
    emit_governance_tripped_alert,
)


def test_emit_governance_tripped(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "gov@example.com", "password": "password1", "display_name": "Gov"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    knowledge = client.app.state.knowledge_store

    emit_governance_tripped_alert(
        knowledge,
        kb_id,
        message="Impact gate blocked publish",
        detail={"proposal_id": "p-1"},
    )
    alerts = client.get(f"/api/v1/kbs/{kb_id}/alerts", headers=headers).json()["alerts"]
    assert any(a["kind"] == "governance.tripped" for a in alerts)


def test_emit_governance_proposal_proposed(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "prop@example.com", "password": "password1", "display_name": "Prop"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    knowledge = client.app.state.knowledge_store

    emit_governance_proposal_proposed_alert(
        knowledge,
        kb_id,
        proposal_id="p-99",
        message="Add Drug class",
        detail={"ontology_uri": "http://example.org/ont"},
    )
    alerts = client.get(f"/api/v1/kbs/{kb_id}/alerts", headers=headers).json()["alerts"]
    match = next((a for a in alerts if a["kind"] == "governance.proposal_proposed"), None)
    assert match is not None
    assert match["detail"]["proposal_id"] == "p-99"
