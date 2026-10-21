"""Import Nango ``providers.yaml`` auth blocks into BOCP ``AuthSpec`` (P1)."""

from __future__ import annotations

from typing import Any

import yaml

from basis.domain.integration.manifest_schema import (
    AuthSpec,
    CheckEndpointSpec,
    ConfigFieldSpec,
    OAuth2DialectSpec,
)
from basis.domain.integration.synthesis.paths import nango_providers_yaml


def load_nango_provider_raw(service: str) -> dict[str, Any] | None:
    path = nango_providers_yaml()
    if path is None:
        return None
    data = yaml.safe_load(path.read_text(encoding="utf-8"))
    if not isinstance(data, dict):
        return None
    candidates = [service, service.replace("_", "-"), service.replace("-", "_")]
    for key in candidates:
        block = data.get(key)
        if isinstance(block, dict):
            return block
    return None


def _nango_connection_config_fields(raw: dict[str, Any]) -> list[ConfigFieldSpec]:
    block = raw.get("connection_config")
    if not isinstance(block, dict):
        return []
    fields: list[ConfigFieldSpec] = []
    for key, spec in block.items():
        if not isinstance(spec, dict):
            continue
        title = spec.get("title") or key
        fields.append(
            ConfigFieldSpec(
                key=str(key),
                label=str(title),
                input_type="text",
                required=not bool(spec.get("optional")),
                secret=False,
                description=(
                    str(spec["description"])
                    if isinstance(spec.get("description"), str)
                    else None
                ),
                pattern=(
                    str(spec["pattern"])
                    if isinstance(spec.get("pattern"), str)
                    else None
                ),
            )
        )
    return fields


def _nango_base_url(raw: dict[str, Any]) -> str | None:
    base = raw.get("base_url")
    if isinstance(base, str) and base.strip():
        return base.rstrip("/")
    proxy = raw.get("proxy")
    if isinstance(proxy, dict):
        proxy_base = proxy.get("base_url")
        if isinstance(proxy_base, str) and proxy_base.strip():
            return proxy_base.rstrip("/")
    return None


def _github_pat_api_key_spec(base_url: str = "https://api.github.com") -> AuthSpec:
    return AuthSpec(
        auth_mode="api_key",
        base_url=base_url,
        headers={"Authorization": "Bearer ${credentials.personal_access_token}"},
        credentials=[
            ConfigFieldSpec(
                key="personal_access_token",
                label="Personal Access Token",
                input_type="password",
                required=True,
                secret=True,
            )
        ],
        check=CheckEndpointSpec(
            method="GET",
            path="/user",
            account_id_path="id",
            display_name_path="login",
        ),
    )


def _slack_nango_fallback() -> list[AuthSpec]:
    return [
        AuthSpec(
            auth_mode="oauth2",
            base_url="https://slack.com/api",
            headers={"Authorization": "Bearer ${credentials.access_token}"},
            oauth2=OAuth2DialectSpec(
                authorization_url="https://slack.com/oauth/v2/authorize",
                token_url="https://slack.com/api/oauth.v2.access",
                scopes=["channels:read", "chat:write", "reactions:write"],
            ),
            check=CheckEndpointSpec(
                method="POST",
                path="/auth.test",
                display_name_path="team",
            ),
        ),
        AuthSpec(
            auth_mode="api_key",
            base_url="https://slack.com/api",
            headers={"Authorization": "Bearer ${credentials.bot_token}"},
            credentials=[
                ConfigFieldSpec(
                    key="bot_token",
                    label="Bot User OAuth Token",
                    input_type="password",
                    required=True,
                    secret=True,
                )
            ],
            check=CheckEndpointSpec(
                method="POST",
                path="/auth.test",
                display_name_path="team",
            ),
        ),
    ]


def nango_auth_specs(service: str) -> list[AuthSpec] | None:
    """Best-effort Nango → BOCP auth (oauth2 / api_key)."""
    raw = load_nango_provider_raw(service)
    if raw is None:
        if service == "slack":
            return _slack_nango_fallback()
        return None

    base_url = _nango_base_url(raw)
    if not base_url:
        return None

    auth_mode = str(raw.get("auth_mode") or "").upper()
    authorization_url = raw.get("authorization_url")
    token_url = raw.get("token_url")

    if auth_mode == "OAUTH2" and isinstance(authorization_url, str) and isinstance(
        token_url, str
    ):
        scopes = raw.get("scope") or raw.get("scopes") or []
        if isinstance(scopes, str):
            scopes = [s.strip() for s in scopes.split(",") if s.strip()]
        auth_params = raw.get("authorization_params")
        oauth2 = OAuth2DialectSpec(
            authorization_url=authorization_url,
            token_url=token_url,
            scopes=list(scopes) if isinstance(scopes, list) else [],
            pkce_s256=not raw.get("disable_pkce", False),
            authorization_params={
                str(k): str(v) for k, v in (auth_params or {}).items()
            }
            if isinstance(auth_params, dict)
            else {},
        )
        headers: dict[str, str] = {}
        if service == "slack":
            headers["Authorization"] = "Bearer ${credentials.access_token}"
        elif service in ("gitlab", "jira", "github"):
            headers["Authorization"] = "Bearer ${credentials.access_token}"
        check = None
        if service == "slack":
            check = CheckEndpointSpec(
                method="POST",
                path="/auth.test",
                display_name_path="team",
            )
        elif service == "gitlab":
            check = CheckEndpointSpec(
                method="GET",
                path="/api/v4/user",
                display_name_path="username",
            )
        elif service == "hubspot":
            check = CheckEndpointSpec(
                method="GET",
                path="/account-info/v3/details",
                account_id_path="portalId",
                display_name_path="uiDomain",
            )
        conn_cfg = _nango_connection_config_fields(raw)
        specs = [
            AuthSpec(
                auth_mode="oauth2",
                base_url=base_url,
                headers=headers,
                oauth2=oauth2,
                check=check,
                connection_config=conn_cfg,
            )
        ]
        if service == "slack":
            specs.extend(_slack_nango_fallback()[1:])
        elif service == "github":
            specs.append(_github_pat_api_key_spec(base_url))
        return specs

    headers = raw.get("headers") or {}
    if isinstance(headers, dict) and headers:
        return [
            AuthSpec(
                auth_mode="api_key",
                base_url=base_url,
                headers={str(k): str(v) for k, v in headers.items()},
            )
        ]

    if service == "slack":
        return _slack_nango_fallback()
    return None
