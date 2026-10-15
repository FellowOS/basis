import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings
from basis.graph.session import GraphSession
from basis.ontology.service import OntologyService


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_kb_graph_and_ontology_stay_inside_one_knowledge_base(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "admin@example.com", "password": "password1", "display_name": "管理员"},
    ).json()
    headers = _auth(admin["token"])
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    created = client.post(
        f"/api/kbs/{kb_id}/ontology",
        headers=headers,
        json={"namespace": "http://example.org/onto", "name": "Demo"},
    )
    assert created.status_code == 200
    assert created.json()["uri"] == "http://example.org/onto#ontology"

    ingested = client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "doc-1", "text": "a contract clause"},
    )
    assert ingested.status_code == 200
    source = ingested.json()
    processed = client.post(
        f"/api/kbs/{kb_id}/processing/jobs",
        headers=headers,
        json={"version_id": source["version_id"], "wait": True},
    )
    assert processed.status_code == 200
    body = processed.json()
    assert body["node_count"] >= 2
    assert body.get("extracted") is True

    other = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "另一库", "visibility": "restricted"},
    ).json()
    other_stats = client.get(f"/api/kbs/{other['id']}/graph/stats", headers=headers)
    assert other_stats.status_code == 200
    assert other_stats.json()["node_count"] == 0


def test_ontology_service_writes_an_ontology_node() -> None:
    session = GraphSession()
    result = OntologyService().create(
        session,
        namespace="http://example.org/onto",
        name="Demo",
        description="scratch",
    )
    assert result["uri"] in session.graph.nodes
    assert session.stats()["node_count"] == 1
