"""Graph-only nodes and edges are written into the ledger before a snapshot save."""

from pathlib import Path

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.config import Settings
from basis.graph.projector import apply_rebuild_to_session
from basis.graph.session import GraphSession
from basis.knowledge.graph_sync import sync_graph_to_ledger
from basis.knowledge.store import KnowledgeStore


def test_sync_graph_to_ledger_keeps_imported_edge_across_rebuild(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "sync@example.com", "password": "password1", "display_name": "Sync"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]
    knowledge: KnowledgeStore = client.app.state.knowledge_store

    session = GraphSession()
    session.add_node("n-alice", "entity", content="Imported Alice")
    session.add_node("n-bob", "entity", content="Imported Bob")
    session.add_node("cls-person", "owl:Class", content="Person")
    session.add_node("doc-1", "document", content="A document")
    session.add_edge("n-alice", "n-bob", "knows")
    session.add_edge("n-alice", "doc-1", "mentioned_in")

    first = sync_graph_to_ledger(knowledge, kb_id, session)
    assert first["entities_created"] == 2
    assert first["statements_created"] == 1

    again = sync_graph_to_ledger(knowledge, kb_id, session)
    assert again["statements_created"] == 0

    labels = {
        row["canonical_label"]
        for row in client.get(f"/api/v1/kbs/{kb_id}/ledger/entities?limit=20", headers=headers).json()[
            "entities"
        ]
    }
    assert "Imported Alice" in labels
    assert "Imported Bob" in labels
    assert "Person" not in labels

    apply_rebuild_to_session(knowledge, kb_id, session)
    rebuilt_labels = {
        (node.content or "")
        for node in session.graph.nodes.values()
        if node.node_type == "entity"
    }
    assert "Imported Alice" in rebuilt_labels
    assert "Imported Bob" in rebuilt_labels
    edges = session.graph.edges
    edge_values = edges.values() if isinstance(edges, dict) else edges
    assert any(edge.edge_type == "knows" for edge in edge_values)

    third = sync_graph_to_ledger(knowledge, kb_id, session)
    assert third == {"entities_created": 0, "statements_created": 0}
