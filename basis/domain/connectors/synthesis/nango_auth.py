"""Import Nango ``providers.yaml`` auth blocks into BOCP ``AuthSpec`` (P1)."""

from __future__ import annotations

from typing import Any

import yaml

from basis.domain.connectors.manifest_schema import AuthSpec
from basis.domain.connectors.synthesis.paths import nango_providers_yaml


def load_nango_provider_raw(service: str) -> dict[str, Any] | None:
    path = nango_providers_yaml()
    if path is None:
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return None
    # Nango keys are often hyphenated; try service and common aliases.
    candidates = [service, service.replace("_", "-"), service.replace("-", "_")]
    for key in candidates:
        block = data.get(key)
        if isinstance(block, dict):
            return block
    return None


def nango_auth_specs(service: str) -> list[AuthSpec] | None:
    """Best-effort Nango → BOCP auth (oauth2 / api_key only for now)."""
    raw = load_nango_provider_raw(service)
    if raw is None:
        return None
    specs: list[AuthSpec] = []
    base_url = raw.get("base_url") or raw.get("proxy", {}).get("base_url")
    if not isinstance(base_url, str) or not base_url.strip():
        return None

    authorization_url = raw.get("authorization_url")
    token_url = raw.get("token_url")
    if isinstance(authorization_url, str) and isinstance(token_url, str):
        scopes = raw.get("scope") or raw.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [s.strip() for s in scopes.split(",") if s.strip()]
        from basis.domain.connectors.manifest_schema import OAuth2DialectSpec

        specs.append(
            AuthSpec(
                auth_mode="oauth2",
                base_url=base_url.rstrip("/"),
                oauth2=OAuth2DialectSpec(
                    authorization_url=authorization_url,
                    token_url=token_url,
                    scopes=list(scopes) if isinstance(scopes, list) else [],
                ),
            )
        )
        return specs

    # API key / bearer templates
    headers = raw.get("headers") or {}
    if isinstance(headers, dict) and headers:
        specs.append(
            AuthSpec(
                auth_mode="api_key",
                base_url=base_url.rstrip("/"),
                headers={str(k): str(v) for k, v in headers.items()},
            )
        )
        return specs
    return None
