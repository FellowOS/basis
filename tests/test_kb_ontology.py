"""KB-scoped vocabulary and ontology alignment routes."""

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.capabilities import explorer_available
from basis.config import Settings


def test_vocabulary_schemes_empty_graph(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "voc@example.com", "password": "password1", "display_name": "Voc"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    response = client.get(f"/api/kbs/{kb_id}/vocabulary/schemes", headers=headers)
    assert response.status_code == 200
    assert response.json() == []


def test_alignments_isolated_between_kbs(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "ali@example.com", "password": "password1", "display_name": "Ali"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_a = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    kb_b = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "Other", "visibility": "restricted"},
    ).json()["id"]

    payload = {
        "source_uri": "http://example.org/a#Class1",
        "target_uri": "http://example.org/b#Class2",
        "relation": "skos:exactMatch",
        "confidence": 0.9,
    }
    created = client.post(f"/api/kbs/{kb_a}/ontology/alignments", headers=headers, json=payload)
    assert created.status_code == 200
    alignment_id = created.json()["id"]

    list_a = client.get(f"/api/kbs/{kb_a}/ontology/alignments", headers=headers)
    assert list_a.status_code == 200
    assert len(list_a.json()) == 1
    assert list_a.json()[0]["id"] == alignment_id

    list_b = client.get(f"/api/kbs/{kb_b}/ontology/alignments", headers=headers)
    assert list_b.status_code == 200
    assert list_b.json() == []


def test_ontology_graph_requires_uri(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "ogr@example.com", "password": "password1", "display_name": "Ogr"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    missing = client.get(f"/api/kbs/{kb_id}/ontology/graph", headers=headers)
    assert missing.status_code == 422

    client.post(
        f"/api/kbs/{kb_id}/ontology",
        headers=headers,
        json={"name": "Demo", "namespace": "http://example.org/demo"},
    )
    graph = client.get(
        f"/api/kbs/{kb_id}/ontology/graph",
        headers=headers,
        params={"uri": "http://example.org/demo#ontology"},
    )
    assert graph.status_code == 200
    assert graph.json()["uri"] == "http://example.org/demo#ontology"

    audit = client.get(
        f"/api/kbs/{kb_id}/audit/graph-mutations",
        headers=headers,
        params={"action_prefix": "kb.graph.ontology"},
    )
    assert audit.status_code == 200
    actions = {e["action"] for e in audit.json()["events"]}
    assert "kb.graph.ontology_create" in actions
