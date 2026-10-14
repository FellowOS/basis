"""KB-scoped Explorer adapter routes (temporal, enrich, provenance)."""

import json

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.capabilities import explorer_available
from sema.config import Settings


def test_temporal_bounds_after_ingest(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "e@example.com", "password": "password1", "display_name": "E"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "t1", "text": "Alice knows Bob.", "wait": True, "extract": True},
    )

    bounds = client.get(f"/api/kbs/{kb_id}/temporal/bounds", headers=headers)
    assert bounds.status_code == 200
    body = bounds.json()
    assert "min" in body and "max" in body


def test_enrich_dedup_after_ingest(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "d@example.com", "password": "password1", "display_name": "D"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "d1", "text": "Alice knows Bob. Alice works with Bob.", "wait": True, "extract": True},
    )

    dedup = client.post(
        f"/api/kbs/{kb_id}/enrich/dedup",
        headers=headers,
        json={"threshold": 0.5},
    )
    assert dedup.status_code == 200
    payload = dedup.json()
    assert "duplicates" in payload
    assert "total_flagged" in payload


def test_sparql_select_after_ingest(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "s@example.com", "password": "password1", "display_name": "S"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "s1", "text": "Alice knows Bob.", "wait": True, "extract": True},
    )

    sparql = client.post(
        f"/api/kbs/{kb_id}/sparql",
        headers=headers,
        json={"query": "SELECT ?s ?p ?o WHERE { ?s ?p ?o } LIMIT 5"},
    )
    assert sparql.status_code == 200
    body = sparql.json()
    assert "columns" in body and "rows" in body
    assert body.get("error") in (None, "")


def test_decisions_list_empty_after_ingest(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "c@example.com", "password": "password1", "display_name": "C"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "c1", "text": "Alice knows Bob.", "wait": True, "extract": True},
    )

    decisions = client.get(f"/api/kbs/{kb_id}/decisions", headers=headers)
    assert decisions.status_code == 200
    assert isinstance(decisions.json(), list)


def test_reasoning_run_without_graph_write(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "r@example.com", "password": "password1", "display_name": "R"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    reasoning = client.post(
        f"/api/kbs/{kb_id}/reasoning/run",
        headers=headers,
        json={
            "facts": ["inhibits(Metformin, mTOR)", "causes(mTOR, Neurodegeneration)"],
            "rules": [
                "IF inhibits(Metformin, mTOR) AND causes(mTOR, Neurodegeneration) THEN candidate(Metformin, Alzheimer's)"
            ],
            "mode": "forward",
            "apply_to_graph": False,
        },
    )
    assert reasoning.status_code == 200
    body = reasoning.json()
    assert "inferred_facts" in body


def test_graph_import_export_roundtrip(tmp_path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "io@example.com", "password": "password1", "display_name": "IO"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    payload = {
        "nodes": [
            {"id": "import-node-1", "type": "entity", "properties": {"content": "Hello import"}},
        ],
        "edges": [],
    }
    files = {
        "file": ("graph.json", json.dumps(payload), "application/json"),
    }
    blocked = client.post(f"/api/kbs/{kb_id}/import", headers=headers, files=files)
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["code"] == "import_requires_review"

    proposed = client.post(
        f"/api/kbs/{kb_id}/review/items/graph-import",
        headers=headers,
        files=files,
    )
    assert proposed.status_code == 200
    item_id = proposed.json()["item"]["id"]
    approved = client.post(
        f"/api/kbs/{kb_id}/review/items/{item_id}/approve",
        headers=headers,
        json={},
    )
    assert approved.status_code == 200
    assert approved.json().get("import", {}).get("nodes_imported", 0) >= 1

    exported = client.post(
        f"/api/kbs/{kb_id}/export",
        headers=headers,
        json={"format": "json"},
    )
    assert exported.status_code == 200
    assert exported.headers.get("content-type", "").startswith("application/json")

    audit = client.get(f"/api/kbs/{kb_id}/audit/graph-mutations", headers=headers)
    assert audit.status_code == 200
    actions = [e["action"] for e in audit.json()["events"]]
    assert "kb.graph.import" in actions or "kb.graph.import_proposed" in actions
    assert "kb.graph.export" in actions
