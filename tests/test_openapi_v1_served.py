"""OpenAPI v1 served from live app export and /api/v1 route aliases."""

from fastapi.testclient import TestClient

from basis.interface.http.app import create_app
from basis.interface.contract.openapi.v1_export import (
    export_openapi_v1_document,
    export_openapi_v1_kb,
    export_openapi_v1_platform,
)
from basis.infra.runtime.config import Settings


def test_openapi_v1_json_endpoint_matches_app_export(tmp_path) -> None:
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)
    response = client.get("/openapi/v1.json")
    assert response.status_code == 200
    served = response.json()
    assert served["openapi"] == "3.1.0"
    assert "/api/v1/kbs/{kb_id}/mcp" in served["paths"]
    expected = export_openapi_v1_document(app)
    assert served == expected


def test_openapi_kb_and_platform_slices(tmp_path) -> None:
    app = create_app(Settings(data_dir=tmp_path))
    client = TestClient(app)
    kb = client.get("/openapi/v1/kb.json").json()
    platform = client.get("/openapi/v1/platform.json").json()
    full = export_openapi_v1_document(app)
    assert kb == export_openapi_v1_kb(app)
    assert platform == export_openapi_v1_platform(app)
    assert len(kb["paths"]) < len(full["paths"])
    assert "/api/v1/kbs/{kb_id}/mcp" in kb["paths"]
    assert "/api/v1/kbs" in platform["paths"]


def test_api_v1_mcp_info_and_legacy_path_gone(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    admin = client.post(
        "/api/v1/auth/register",
        json={"email": "v1@example.com", "password": "password1", "display_name": "V"},
    ).json()
    headers = {"Authorization": f"Bearer {admin['token']}"}
    kb_id = client.get("/api/v1/kbs", headers=headers).json()["kbs"][0]["id"]

    v1 = client.get(f"/api/v1/kbs/{kb_id}/mcp", headers=headers)
    assert v1.status_code == 200
    assert v1.headers.get("deprecation") is None
    assert v1.json()["mcp_url"].endswith(f"/api/v1/kbs/{kb_id}/mcp")

    legacy = client.get(f"/api/kbs/{kb_id}/mcp", headers=headers)
    assert legacy.status_code == 410
