"""Graph staging manifest (F-DIFF-01)."""

from pathlib import Path

import pytest

pytest.importorskip("semantica")

from fastapi.testclient import TestClient

from basis.domain.explorer.graph_staging import (
    build_graph_staging_payload,
    staging_session_key,
)
from basis.infra.capabilities import explorer_available
from basis.infra.config import Settings
from basis.transport.http.app import create_app


def test_build_graph_staging_payload_focus_nodes() -> None:
    diff = {
        "from_time": "2020-01-01T00:00:00",
        "to_time": "2021-01-01T00:00:00",
        "added_nodes": ["a"],
        "removed_nodes": ["b"],
        "modified_nodes": [{"id": "c", "change": "properties"}],
        "summary": {
            "nodes_added": 1,
            "nodes_removed": 1,
            "nodes_modified": 1,
            "edges_added": 0,
            "edges_removed": 0,
        },
    }
    payload = build_graph_staging_payload("kb-1", diff)
    assert payload["manifest"]["change_total"] == 3
    assert payload["manifest"]["focus_node_ids"] == ["a", "c"]
    assert payload["manifest"]["governance"]["direct_merge_allowed"] is False
    assert payload["manifest"]["session_key"] == staging_session_key(
        "kb-1", "2020-01-01T00:00:00", "2021-01-01T00:00:00"
    )


def test_staging_session_key_stable() -> None:
    a = staging_session_key("kb", "2020-01-01", "2021-01-01")
    b = staging_session_key("kb", "2020-01-01", "2021-01-01")
    c = staging_session_key("kb", "2020-01-02", "2021-01-01")
    assert a == b
    assert a != c
    assert len(a) == 16


def test_graph_staging_route_after_ingest(tmp_path: Path) -> None:
    if not explorer_available():
        pytest.skip("explorer extra not installed")

    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "stg@example.com", "password": "password1", "display_name": "Stg"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}

    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    client.post(
        f"/api/v1/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "s1", "text": "Ivy knows Jake.", "wait": True, "extract": True},
    )

    staging = client.get(
        f"/api/v1/kbs/{kb_id}/graph/staging",
        headers=headers,
        params={"from": "2020-01-01T00:00:00", "to": "2030-01-01T00:00:00"},
    )
    assert staging.status_code == 200
    body = staging.json()
    assert body.get("kb_id") == kb_id
    assert "manifest" in body and "diff" in body
    assert body["manifest"].get("session_key")
    assert body["manifest"]["governance"]["entity_merge_proposal_relpath"] == (
        "graph/staging/entity-merge"
    )
