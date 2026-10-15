from pathlib import Path

from basis.admin.store import AdminStore
from basis.graph.projector import graph_projection_signature, rebuild_graph_from_ledger
from basis.graph.session import GraphSession
from basis.knowledge.blob_store import BlobStore
from basis.knowledge.store import KnowledgeStore
from basis.pipeline.ledger_extract import apply_kg_to_ledger
from basis.knowledge.derived_facts_service import persist_reasoning_derived


def _kb_store(tmp_path: Path) -> tuple[str, KnowledgeStore]:
    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("proj@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))
    return kb_id, store


def test_rebuild_is_idempotent_and_uses_entity_uuids(tmp_path: Path) -> None:
    kb_id, store = _kb_store(tmp_path)
    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="doc.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
        external_key="doc-a",
    )
    chunk_id = store.create_chunk(kb_id, version_id, ordinal=0, text="Alice knows Bob.")
    store.set_version_status(kb_id, version_id, "ready")
    e1 = store.create_entity(kb_id, canonical_label="Alice")
    e2 = store.create_entity(kb_id, canonical_label="Alice")
    assert e1 != e2
    kg = {
        "entities": [{"name": "Alice"}, {"name": "Bob"}],
        "relationships": [{"source": "Alice", "target": "Bob", "predicate": "knows"}],
    }
    apply_kg_to_ledger(
        store, kb_id, version_id, chunk_id, "Alice knows Bob.", kg, proposed_by="test"
    )

    first = rebuild_graph_from_ledger(store, kb_id)
    second = rebuild_graph_from_ledger(store, kb_id)
    assert graph_projection_signature(first) == graph_projection_signature(second)
    assert e1 in first.graph.nodes
    assert e2 in first.graph.nodes
    state = store.get_projection_state(kb_id)
    assert state["status"] == "clean"
    assert state["revision"] >= 2
    store.close()


def test_invalidated_statement_omitted_from_projection(tmp_path: Path) -> None:
    kb_id, store = _kb_store(tmp_path)
    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="t.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
        external_key="doc-b",
    )
    chunk_id = store.create_chunk(kb_id, version_id, ordinal=0, text="A relates B.")
    store.set_version_status(kb_id, version_id, "ready")
    a = store.create_entity(kb_id, canonical_label="A")
    b = store.create_entity(kb_id, canonical_label="B")
    sid = store.add_open_statement(
        kb_id,
        subject_id=a,
        surface_phrase="relates",
        object_entity_id=b,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="relates",
    )
    with_edge = rebuild_graph_from_ledger(store, kb_id)
    assert any(
        edge[2] == "relates" for edge in graph_projection_signature(with_edge)["edges"]
    )
    store.invalidate_statement(kb_id, sid)
    without = rebuild_graph_from_ledger(store, kb_id)
    assert not any(edge[2] == "relates" for edge in graph_projection_signature(without)["edges"])
    store.close()


def test_derived_facts_projected_as_edges(tmp_path: Path) -> None:
    kb_id, store = _kb_store(tmp_path)
    subj = store.get_or_create_entity_by_label(kb_id, "DerSubj")
    obj = store.get_or_create_entity_by_label(kb_id, "DerObj")
    persist_reasoning_derived(
        store,
        kb_id,
        [
            {
                "conclusion": "knows(DerSubj, DerObj)",
                "rule": "IF parent(DerSubj, DerObj) THEN knows(DerSubj, DerObj)",
                "premises": ["parent(DerSubj, DerObj)"],
            }
        ],
    )
    session = rebuild_graph_from_ledger(store, kb_id)
    sig = graph_projection_signature(session)
    assert any(
        src == subj and tgt == obj and label == "knows"
        for src, tgt, label in sig["edges"]
    )
    store.close()


def test_ontology_node_preserved_on_rebuild(tmp_path: Path) -> None:
    kb_id, store = _kb_store(tmp_path)
    existing = GraphSession()
    existing.add_node(
        "http://example.org/onto#ontology",
        "owl:Ontology",
        content="Demo",
        namespace="http://example.org/onto",
    )
    rebuilt = rebuild_graph_from_ledger(store, kb_id, preserve_from=existing)
    assert "http://example.org/onto#ontology" in rebuilt.graph.nodes
    store.close()
