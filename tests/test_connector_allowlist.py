"""Platform + KB dual-layer BOCP provider allowlists."""

from __future__ import annotations

import json
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from basis.infra.runtime.config import Settings
from basis.interface.http.app import create_app

from basis.domain.integration.allowlist import (
    PLATFORM_CONNECTOR_ALLOWLIST_KEY,
    assert_allowed_providers_in_catalog,
    assert_kb_allowlist_within_platform,
    effective_allowed_providers,
    is_provider_allowed,
    normalize_allowed_providers,
    provider_blocked_layer,
    unknown_catalog_providers,
)
from basis.domain.integration import get_connector_catalog
from basis.domain.integration.auth_vault import ConnectorAuthVault
from basis.domain.integration.platform_policy import (
    get_platform_allowed_providers,
    upsert_platform_allowed_providers,
)
from basis.domain.integration.runtime import ConnectorRuntime
from basis.infra.tooling.db.sqlite_migrations import run_migrations


def _fresh_db(tmp_path: Path):
    import sqlite3

    db_path = tmp_path / "allowlist.db"
    conn = sqlite3.connect(db_path)
    conn.row_factory = sqlite3.Row
    run_migrations(conn)
    return conn


def test_normalize_and_effective_allowlist() -> None:
    assert normalize_allowed_providers("postgres, github") == ["github", "postgres"]
    assert effective_allowed_providers("*", "*") == "*"
    assert effective_allowed_providers(["postgres", "github"], "*") == ["github", "postgres"]
    assert effective_allowed_providers(["postgres", "github"], ["postgres"]) == ["postgres"]
    assert effective_allowed_providers(["postgres"], ["postgres", "airtable"]) == ["postgres"]
    assert is_provider_allowed("github", ["postgres"], "*") is False
    assert is_provider_allowed("postgres", ["postgres"], "*") is True
    assert provider_blocked_layer("airtable", ["postgres"], "*") == "platform"


def test_assert_kb_subset() -> None:
    assert_kb_allowlist_within_platform("*", ["postgres"])
    assert_kb_allowlist_within_platform(["postgres"], ["postgres", "github"])
    with pytest.raises(ValueError, match="platform level"):
        assert_kb_allowlist_within_platform(["airtable"], ["postgres"])


def test_platform_settings_round_trip(tmp_path: Path) -> None:
    conn = _fresh_db(tmp_path)
    try:
        assert get_platform_allowed_providers(conn) == "*"
        upsert_platform_allowed_providers(conn, ["postgres", "github"])
        assert get_platform_allowed_providers(conn) == ["github", "postgres"]
        row = conn.execute(
            "SELECT value FROM settings WHERE key = ?",
            (PLATFORM_CONNECTOR_ALLOWLIST_KEY,),
        ).fetchone()
        assert json.loads(row[0]) == ["github", "postgres"]
    finally:
        conn.close()


def test_unknown_catalog_providers() -> None:
    catalog = get_connector_catalog()
    services = catalog.service_ids()
    assert unknown_catalog_providers("*", services) == []
    unknown = unknown_catalog_providers(["postgres", "not-a-real-connector"], services)
    assert "not-a-real-connector" in unknown
    with pytest.raises(ValueError, match="Unknown connector"):
        assert_allowed_providers_in_catalog(["not-a-real-connector"], services)


def test_category_breakdown_counts(tmp_path: Path) -> None:
    conn = _fresh_db(tmp_path)
    try:
        catalog = __import__(
            "basis.domain.integration.catalog",
            fromlist=["get_connector_catalog"],
        ).get_connector_catalog()
        rows = catalog.category_breakdown(platform_allowed=["postgres"])
        assert isinstance(rows, list)
        if rows:
            assert "category" in rows[0] and "total" in rows[0] and "enabled" in rows[0]
    finally:
        conn.close()


def test_platform_settings_connectors_http(tmp_path: Path) -> None:
    client = TestClient(create_app(Settings(data_dir=tmp_path / "http_data")))
    reg = client.post(
        "/api/v1/auth/register",
        json={
            "email": "admin@basis.local",
            "password": "password123",
            "display_name": "Admin",
        },
    )
    assert reg.status_code == 200
    headers = {"Authorization": f"Bearer {reg.json()['token']}"}

    summary = client.get("/api/v1/settings/connectors", headers=headers)
    assert summary.status_code == 200
    assert summary.json()["allowed_providers"] == "*"

    bad = client.put(
        "/api/v1/settings/connectors",
        headers=headers,
        json={"allowed_providers": ["not-a-real-connector"]},
    )
    assert bad.status_code == 400
    assert bad.json()["detail"]["code"] == "connector_unknown_providers"

    validate = client.post(
        "/api/v1/settings/connectors/validate",
        headers=headers,
        json={"allowed_providers": ["postgres", "ghost"]},
    )
    assert validate.status_code == 200
    body = validate.json()
    assert body["ok"] is False
    assert "ghost" in body["unknown_providers"]

    ok = client.put(
        "/api/v1/settings/connectors",
        headers=headers,
        json={"allowed_providers": ["postgres", "mysql"]},
    )
    assert ok.status_code == 200
    assert ok.json()["allowed_providers"] == ["mysql", "postgres"]

    stats = client.get("/api/v1/settings/connectors/catalog/stats", headers=headers)
    assert stats.status_code == 200
    assert isinstance(stats.json()["category_breakdown"], list)


def test_runtime_respects_platform_ceiling(tmp_path: Path) -> None:
    conn = _fresh_db(tmp_path)
    try:
        conn.execute(
            "INSERT INTO knowledge_bases (id, name, description, visibility, created_by, created_at) "
            "VALUES ('kb1', 'KB', '', 'private', 'u1', '2026-01-01T00:00:00Z')"
        )
        conn.commit()
        upsert_platform_allowed_providers(conn, ["postgres"])
        vault = ConnectorAuthVault(conn, vault_secret="secret")
        vault.upsert_policy("kb1", allowed_providers="*")
        runtime = ConnectorRuntime(conn, vault_secret="secret")
        with pytest.raises(PermissionError, match="platform connector policy"):
            runtime.vault.assert_service_allowed("kb1", "mysql")
        with pytest.raises(PermissionError, match="platform level"):
            vault.upsert_policy("kb1", allowed_providers=["mysql"])
    finally:
        conn.close()
