from pathlib import Path

from basis.control.admin.store import AdminStore
from basis.core.projection.projector import graph_projection_signature, rebuild_graph_from_ledger
from basis.core.ledger.blob_store import BlobStore
from basis.core.ledger.store import KnowledgeStore


def test_typed_facts_add_predicate_edges(tmp_path: Path) -> None:
    admin = AdminStore(tmp_path / "basis.db")
    user, _ = admin.register("typed@example.com", "password1", "U")
    kb_id = admin.create_kb(user, "KB", None, "restricted").id
    actor_id = user.id
    admin.close()
    store = KnowledgeStore(tmp_path / "basis.db", BlobStore(tmp_path))

    _, version_id, _, _ = store.store_upload_bytes(
        kb_id,
        title="t.txt",
        mime_type="text/plain",
        data=b"x",
        created_by=None,
        external_key="doc-t",
    )
    chunk_id = store.create_chunk(kb_id, version_id, ordinal=0, text="Alice knows Bob.")
    store.set_version_status(kb_id, version_id, "ready")
    alice = store.create_entity(kb_id, canonical_label="Alice")
    bob = store.create_entity(kb_id, canonical_label="Bob")
    store.add_open_statement(
        kb_id,
        subject_id=alice,
        surface_phrase="knows",
        object_entity_id=bob,
        object_value=None,
        status="confirmed",
        proposed_by="test",
        chunk_id=chunk_id,
        quote="knows Bob",
    )

    mapping = store.create_mapping(
        kb_id,
        actor_id,
        signature="knows",
        target_uri="http://example.org/knows",
        target_kind="property",
        direction="forward",
        status="confirmed",
    )
    store.materialize_mapping_facts(kb_id, mapping["id"])

    session = rebuild_graph_from_ledger(store, kb_id)
    edges = graph_projection_signature(session)["edges"]
    knows_edges = [edge for edge in edges if edge[0] == alice and edge[1] == bob and edge[2] == "knows"]
    assert len(knows_edges) == 1
    store.close()
