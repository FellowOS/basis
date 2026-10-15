"""Chat playground concurrency guard."""

from unittest.mock import patch

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_mcp_read_token_cannot_propose_remember(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "rd@example.com", "password": "password1", "display_name": "Rd"},
    ).json()
    session_headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=session_headers).json()["kbs"][0]["id"]
    created = client.post(
        f"/api/kbs/{kb_id}/tokens",
        headers=session_headers,
        json={"name": "read-agent", "scope": "read"},
    ).json()
    api_headers = {"Authorization": f"Bearer {created['secret']}"}

    denied = client.post(
        f"/api/kbs/{kb_id}/mcp",
        headers=api_headers,
        json={
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {"name": "propose_remember", "arguments": {"content": "nope"}},
        },
    )
    assert denied.status_code == 200
    result = denied.json()["result"]
    assert result.get("isError") is True


def test_chat_playground_rejects_concurrent_request(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/auth/register",
        json={"email": "cf@example.com", "password": "password1", "display_name": "Cf"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/kbs", headers=headers).json()["kbs"][0]["id"]

    store = client.app.state.store
    barrier = {"entered": False}

    def slow_body(*_args, **_kwargs):
        barrier["entered"] = True
        import time

        time.sleep(0.5)
        return {"message": {"role": "assistant", "content": "ok"}, "tool_traces": []}

    with (
        patch.object(
            store,
            "get_chat_llm_settings",
            return_value={"api_key": "sk-test", "model": "gpt-test", "base_url": None},
        ),
        patch("sema.chat.playground._run_kb_playground_body", side_effect=slow_body),
    ):
        import threading

        results: list[int] = []

        def first():
            r = client.post(
                f"/api/kbs/{kb_id}/chat/playground",
                headers=headers,
                json={"messages": [{"role": "user", "content": "hi"}]},
            )
            results.append(r.status_code)

        def second():
            import time

            time.sleep(0.05)
            r = client.post(
                f"/api/kbs/{kb_id}/chat/playground",
                headers=headers,
                json={"messages": [{"role": "user", "content": "again"}]},
            )
            results.append(r.status_code)

        t1 = threading.Thread(target=first)
        t2 = threading.Thread(target=second)
        t1.start()
        t2.start()
        t1.join()
        t2.join()

    assert barrier["entered"]
    assert 409 in results
    assert 200 in results


def test_trim_playground_messages_drops_oldest() -> None:
    from sema.chat.playground import _PLAYGROUND_MAX_MESSAGES, _trim_playground_messages

    messages = [{"role": "user", "content": f"msg-{i}"} for i in range(_PLAYGROUND_MAX_MESSAGES + 5)]
    trimmed = _trim_playground_messages(messages)
    assert len(trimmed) <= _PLAYGROUND_MAX_MESSAGES
    assert trimmed[0]["content"] == f"msg-{5}"
    assert trimmed[-1]["content"] == f"msg-{_PLAYGROUND_MAX_MESSAGES + 4}"
