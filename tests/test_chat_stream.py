"""Chat playground SSE stream."""

from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_playground_stream_emits_delta_and_done(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "st@example.com", "password": "password1", "display_name": "St"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]
    store = client.app.state.store

    chunk = MagicMock()
    chunk.choices = [MagicMock()]
    chunk.choices[0].delta = MagicMock(content="Hello", tool_calls=None)

    stream = iter([chunk])

    mock_client = MagicMock()
    mock_client.chat.completions.create.return_value = stream

    with (
        patch.object(
            store,
            "get_chat_llm_settings",
            return_value={"api_key": "sk-test", "model": "gpt-test", "base_url": None},
        ),
        patch("openai.OpenAI", return_value=mock_client),
    ):
        response = client.post(
            f"/api/kbs/{kb_id}/chat/playground/stream",
            headers=headers,
            json={"messages": [{"role": "user", "content": "hi"}]},
        )

    assert response.status_code == 200
    assert "text/event-stream" in response.headers.get("content-type", "")
    body = response.text
    assert '"type": "delta"' in body or '"type":"delta"' in body
    assert '"type": "done"' in body or '"type":"done"' in body
    assert "Hello" in body
