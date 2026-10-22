"""Upstream providers registry auth_mode → BOCP mapping."""

from __future__ import annotations

import pytest

from basis.domain.integration.synthesis.auth_mode_reference import (
    ALL_AUTH_MODES,
    REGISTRY_CANONICAL_BY_AUTH_MODE,
    REGISTRY_MODES_WITHOUT_BOCP_ENUM,
)
from basis.domain.integration.synthesis.paths import providers_registry_yaml
from basis.domain.integration.synthesis.providers_registry_auth import (
    auth_specs_from_providers_registry,
    auth_specs_from_registry_block,
    load_provider_registry_block,
    registry_auth_mode_to_bocp,
)


def test_registry_auth_mode_to_bocp_mapping() -> None:
    assert registry_auth_mode_to_bocp("OAUTH2") == "oauth2"
    assert registry_auth_mode_to_bocp("MCP_OAUTH2") == "oauth2"
    assert registry_auth_mode_to_bocp("OAUTH2_CC") == "oauth2_cc"
    assert registry_auth_mode_to_bocp("BILL") == "custom"
    assert registry_auth_mode_to_bocp("UNKNOWN_X") == "custom"


@pytest.mark.parametrize("registry_extra", sorted(REGISTRY_MODES_WITHOUT_BOCP_ENUM))
def test_registry_extra_modes_map_to_bocp(registry_extra: str) -> None:
    bocp = registry_auth_mode_to_bocp(registry_extra)
    assert bocp in ("oauth2", "custom")


@pytest.mark.skipif(
    providers_registry_yaml() is None,
    reason="providers registry yaml not on disk (BASIS_SYNTHESIS_PROVIDERS_REGISTRY)",
)
def test_canonical_registry_services_emit_expected_bocp_modes() -> None:
    for mode, service in REGISTRY_CANONICAL_BY_AUTH_MODE.items():
        if mode in ("oauth2", "api_key") and service == "github":
            continue
        raw = load_provider_registry_block(service)
        assert raw is not None, f"missing registry block for {service} ({mode})"
        specs = auth_specs_from_registry_block(service, raw)
        assert specs, f"no specs for {service} ({mode})"
        modes = {s.auth_mode for s in specs}
        assert mode in modes, f"{service}: expected {mode}, got {modes}"
        for spec in specs:
            assert spec.display_name


@pytest.mark.skipif(
    providers_registry_yaml() is None,
    reason="providers registry yaml not on disk",
)
def test_all_bocp_modes_have_registry_canonical_or_shipped_exception() -> None:
    documented = set(REGISTRY_CANONICAL_BY_AUTH_MODE) | {"database_dsn"}
    assert documented == ALL_AUTH_MODES


def test_auth_specs_from_providers_registry_slack_fallback() -> None:
    if providers_registry_yaml() is not None:
        pytest.skip("slack uses live registry when available")
    specs = auth_specs_from_providers_registry("slack")
    assert specs
    assert {s.auth_mode for s in specs} >= {"oauth2", "api_key"}
