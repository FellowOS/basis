"""Chat/MCP remember → review queue (F-CHAT-04)."""

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_chat_remember_creates_pending_review(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "mem@example.com", "password": "password1", "display_name": "Mem"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.post(
        "/api/kbs",
        headers=headers,
        json={"name": "Remember KB", "visibility": "restricted"},
    ).json()["id"]

    proposed = client.post(
        f"/api/kbs/{kb_id}/chat/remember",
        headers=headers,
        json={"content": "Acme Corp was founded in 2010."},
    )
    assert proposed.status_code == 200
    review_id = proposed.json()["review_item_id"]

    items = client.get(f"/api/kbs/{kb_id}/review/items", headers=headers).json()["items"]
    assert any(i["id"] == review_id and i["kind"] == "statement_remember" for i in items)

    approved = client.post(
        f"/api/kbs/{kb_id}/review/items/{review_id}/approve",
        headers=headers,
        json={"rationale": "looks good"},
    )
    assert approved.status_code == 200
    statement_id = proposed.json()["statement_id"]
    assert approved.json()["merge"]["statement_id"] == statement_id
