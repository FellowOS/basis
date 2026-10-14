"""X-02 request correlation IDs."""

from fastapi.testclient import TestClient

from sema.api.app import create_app
from sema.config import Settings


def test_health_returns_request_id_header(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.get("/health")
    assert response.status_code == 200
    rid = response.headers.get("X-Request-ID") or response.headers.get("x-request-id")
    assert rid
    assert len(rid) >= 16


def test_client_may_supply_request_id(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.get("/health", headers={"X-Request-ID": "client-trace-abc"})
    assert response.status_code == 200
    rid = response.headers.get("X-Request-ID") or response.headers.get("x-request-id")
    assert rid == "client-trace-abc"


def test_unauthorized_includes_request_id_in_detail(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.get(
        "/api/kbs",
        headers={"X-Request-ID": "auth-fail-1"},
    )
    assert response.status_code == 401
    detail = response.json()["detail"]
    assert detail["request_id"] == "auth-fail-1"
    assert detail.get("code") == "unauthorized"
