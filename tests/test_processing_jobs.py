"""Separated source upload and explicit processing jobs."""

from pathlib import Path

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def _auth(token: str) -> dict[str, str]:
    return {"Authorization": f"Bearer {token}"}


def test_upload_then_process_with_immutable_options(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)
    admin = client.post(
        "/api/auth/register",
        json={"email": "flow@example.com", "password": "password1", "display_name": "Flow"},
    ).json()
    headers = _auth(admin["token"])
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    uploaded = client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "source-only", "text": "Alice knows Bob."},
    )
    assert uploaded.status_code == 200
    source = uploaded.json()
    assert source["status"] == "uploaded"

    before = client.get(f"/api/kbs/{kb_id}/processing/jobs", headers=headers)
    assert before.status_code == 200
    assert before.json()["jobs"] == []

    processed = client.post(
        f"/api/kbs/{kb_id}/processing/jobs",
        headers=headers,
        json={
            "version_id": source["version_id"],
            "wait": True,
            "chunk": False,
            "extract": False,
            "ner_method": "pattern",
            "relation_method": "pattern",
        },
    )
    assert processed.status_code == 200
    assert processed.json()["ledger_status"] == "ready"

    jobs = client.get(f"/api/kbs/{kb_id}/processing/jobs", headers=headers).json()["jobs"]
    assert len(jobs) == 1
    assert jobs[0]["status"] == "succeeded"
    assert jobs[0]["options"]["chunk"] is False
    assert jobs[0]["options"]["extract"] is False
    assert jobs[0]["result"]["ledger_status"] == "ready"


def test_active_job_conflict_and_retry_attempt(tmp_path: Path) -> None:
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)
    admin = client.post(
        "/api/auth/register",
        json={"email": "retry@example.com", "password": "password1", "display_name": "Retry"},
    ).json()
    headers = _auth(admin["token"])
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    source = client.post(
        f"/api/kbs/{kb_id}/documents",
        headers=headers,
        json={"doc_id": "retry-doc", "text": "plain text"},
    ).json()

    options = {
        "chunk": False,
        "chunk_size": 1800,
        "chunk_overlap": 250,
        "extract": False,
        "ner_method": "pattern",
        "relation_method": "pattern",
        "extract_relations": True,
        "extract_triplets": False,
    }
    first = app.state.knowledge_store.create_processing_job(
        kb_id,
        version_id=source["version_id"],
        options=options,
    )
    conflict = client.post(
        f"/api/kbs/{kb_id}/processing/jobs",
        headers=headers,
        json={"version_id": source["version_id"]},
    )
    assert conflict.status_code == 409
    assert conflict.json()["detail"]["code"] == "processing_active"

    app.state.knowledge_store.fail_job(kb_id, first["id"], "forced", "forced")
    app.state.knowledge_store.fail_version(kb_id, source["version_id"], "forced", "forced")
    retried = client.post(
        f"/api/kbs/{kb_id}/processing/jobs/{first['id']}/retry",
        headers=headers,
        json={"wait": True},
    )
    assert retried.status_code == 200
    jobs = client.get(f"/api/kbs/{kb_id}/processing/jobs", headers=headers).json()["jobs"]
    assert jobs[0]["attempt"] == 2
    assert jobs[0]["status"] == "succeeded"
