"""Derived facts ledger + reasoning persist (F-RUL-03)."""

from pathlib import Path

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.admin.store import AdminStore
from sema.config import Settings
from sema.knowledge.blob_store import BlobStore
from sema.knowledge.derived_facts_service import persist_reasoning_derived
from sema.knowledge.store import KnowledgeStore


def _kb_id(tmp_path: Path) -> str:
    admin = AdminStore(tmp_path / "sema.db")
    user, _ = admin.register("df@example.com", "password1", "DF")
    kb = admin.create_kb(user, "DF KB", None, "restricted")
    admin.close()
    return kb.id


def _knowledge(tmp_path: Path) -> KnowledgeStore:
    return KnowledgeStore(tmp_path / "sema.db", BlobStore(tmp_path))


def test_insert_and_list_derived_facts(tmp_path) -> None:
    kb_id = _kb_id(tmp_path)
    store = _knowledge(tmp_path)
    subj = store.get_or_create_entity_by_label(kb_id, "Alice")
    obj = store.get_or_create_entity_by_label(kb_id, "Bob")
    fact_id = store.insert_derived_fact(
        kb_id,
        subject_id=subj,
        predicate_uri="urn:sema:pred:knows",
        object_entity_id=obj,
        object_value=None,
        rule_id=None,
        derivations=[("ground_fact", "knows(Alice, Bob)")],
    )
    assert fact_id
    listed = store.list_derived_facts(kb_id)
    assert len(listed) == 1
    assert listed[0]["derivations"][0]["premise_id"] == "knows(Alice, Bob)"


def test_persist_reasoning_derived_from_proof_chains(tmp_path) -> None:
    kb_id = _kb_id(tmp_path)
    store = _knowledge(tmp_path)
    chains = [
        {
            "conclusion": "ancestor(Alice, Bob)",
            "rule": "IF parent(Alice, Bob) THEN ancestor(Alice, Bob)",
            "premises": ["parent(Alice, Bob)"],
        }
    ]
    out = persist_reasoning_derived(store, kb_id, chains)
    assert out["created"] == 1
    assert store.list_derived_facts(kb_id)


def test_ledger_derived_facts_route(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "df2@example.com", "password": "password1", "display_name": "DF2"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    store = _knowledge(tmp_path)
    subj = store.get_or_create_entity_by_label(kb_id, "X")
    obj = store.get_or_create_entity_by_label(kb_id, "Y")
    store.insert_derived_fact(
        kb_id,
        subject_id=subj,
        predicate_uri="urn:sema:pred:rel",
        object_entity_id=obj,
        object_value=None,
        rule_id=None,
        derivations=[],
    )
    res = client.get(f"/api/kbs/{kb_id}/ledger/derived-facts", headers=headers)
    assert res.status_code == 200
    assert len(res.json()["derived_facts"]) >= 1


def test_entity_facts_includes_derived_facts(tmp_path) -> None:
    kb_id = _kb_id(tmp_path)
    store = _knowledge(tmp_path)
    subj = store.get_or_create_entity_by_label(kb_id, "Subj")
    obj = store.get_or_create_entity_by_label(kb_id, "Obj")
    store.insert_derived_fact(
        kb_id,
        subject_id=subj,
        predicate_uri="urn:sema:pred:rel",
        object_entity_id=obj,
        object_value=None,
        rule_id=None,
        derivations=[("ground_fact", "rel(Subj, Obj)")],
    )
    listed = store.list_derived_facts_for_entity(kb_id, subj)
    assert len(listed) == 1


def test_list_ingest_jobs_alias(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "ij@example.com", "password": "password1", "display_name": "IJ"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    listed = client.get(f"/api/kbs/{kb_id}/ingest/jobs", headers=headers)
    assert listed.status_code == 200
    assert "jobs" in listed.json()
    assert "processing_jobs_path" in listed.json()
