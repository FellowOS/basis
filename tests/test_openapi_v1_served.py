"""OpenAPI v1 served from committed YAML and /api/v1 route aliases."""

import json

from fastapi.testclient import TestClient

from basis.api.app import create_app
from basis.api.openapi_spec import openapi_v1_full, openapi_v1_json
from basis.config import Settings


def test_openapi_v1_json_endpoint_matches_repo_yaml(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    response = client.get("/openapi/v1.json")
    assert response.status_code == 200
    served = response.json()
    assert served["openapi"] == "3.1.0"
    assert "/api/v1/kbs/{kb_id}/mcp" in served["paths"]
    expected = json.loads(openapi_v1_json("basis-v1.yaml"))
    assert served == expected


def test_openapi_kb_and_platform_slices(tmp_path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path)))
    kb = client.get("/openapi/v1/kb.json").json()
    platform = client.get("/openapi/v1/platform.json").json()
    full = openapi_v1_full()
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
