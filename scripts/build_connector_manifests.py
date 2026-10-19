#!/usr/bin/env python3
"""Synthesize BOCP ConnectorManifest catalog from sibling repos (Nango, Airbyte, AnyConnect) and flagship curations."""

from __future__ import annotations

import json
from pathlib import Path
import re
import sys
from typing import Any

import yaml

REPO_ROOT = Path(__file__).resolve().parents[1]
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from basis.domain.connectors.manifest_schema import (
    AuthModeLiteral,
    AuthSpec,
    CheckEndpointSpec,
    ConfigFieldSpec,
    ConnectorManifest,
    DynamicSchemaLoaderSpec,
    OAuth2DialectSpec,
    PaginatorSpec,
    RetrieverSpec,
    StreamFieldSpec,
    StreamMutationSpec,
    StreamSpec,
    SubstreamPartitionSpec,
    ToolAnnotationsSpec,
    ToolSpec,
)

PROJECTS_ROOT = REPO_ROOT.parent.parent
NANGO_PROVIDERS_YAML = PROJECTS_ROOT / "nango" / "packages" / "providers" / "providers.yaml"
ANYCONNECT_CATALOG_DIR = PROJECTS_ROOT / "fellowos" / "connectors" / "catalog" / "apps"
MANIFESTS_OUT_DIR = REPO_ROOT / "basis" / "domain" / "connectors" / "manifests"

SERVICE_KEY_RE = re.compile(r"^[a-z0-9][a-z0-9_-]{0,62}[a-z0-9]$")


def _normalize_service_key(raw: str) -> str:
    s = raw.strip().lower().replace(".", "-").replace(" ", "-")
    s = re.sub(r"[^a-z0-9_-]", "-", s)
    s = re.sub(r"-+", "-", s).strip("-_")
    if len(s) < 2:
        s = f"{s}0"
    return s[:64]


def _map_nango_auth_mode(raw_mode: str) -> AuthModeLiteral:
    mode = (raw_mode or "").upper()
    mapping: dict[str, AuthModeLiteral] = {
        "OAUTH2": "oauth2",
        "OAUTH2_CC": "oauth2_cc",
        "API_KEY": "api_key",
        "BASIC": "basic",
        "TWO_STEP": "two_step",
        "CUSTOM": "custom",
        "APP_STORE": "jwt",
        "APP": "app",
        "JWT": "jwt",
        "TBA": "oauth1",
        "OAUTH1": "oauth1",
        "AWS_IAM": "aws_sigv4",
        "NONE": "none",
    }
    return mapping.get(mode, "custom")


def _extract_placeholder_fields(texts: list[str | None]) -> list[ConfigFieldSpec]:
    seen: set[str] = set()
    fields: list[ConfigFieldSpec] = []
    for text in texts:
        if not text:
            continue
        for match in re.findall(r"\$\{connectionConfig\.([a-zA-Z0-9_]+)\}", str(text)):
            if match not in seen:
                seen.add(match)
                fields.append(
                    ConfigFieldSpec(
                        key=match,
                        label=match.replace("_", " ").title(),
                        input_type="text",
                        required=True,
                    )
                )
    return fields


def _flagship_curated_manifests() -> dict[str, ConnectorManifest]:
    """Curated rich manifests for flagship connectors with full streams, dynamic schema, and mutations."""
    airtable = ConnectorManifest(
        service="airtable",
        display_name="Airtable",
        description="Airtable cloud relational bases, tables, and records with dynamic base/table schema discovery and bidirectional record sync.",
        categories=["Database", "Productivity"],
        homepage_url="https://airtable.com",
        docs_url="https://airtable.com/developers/web/api/introduction",
        auth=[
            AuthSpec(
                auth_mode="oauth2",
                base_url="https://api.airtable.com",
                oauth2=OAuth2DialectSpec(
                    authorization_url="https://airtable.com/oauth2/v1/authorize",
                    token_url="https://airtable.com/oauth2/v1/token",
                    scopes=[
                        "data.records:read",
                        "data.records:write",
                        "schema.bases:read",
                    ],
                    pkce_s256=True,
                    token_endpoint_auth_method="client_secret_basic",
                ),
                check=CheckEndpointSpec(
                    method="GET",
                    path="/v0/meta/whoami",
                    account_id_path="id",
                    display_name_path="email",
                ),
            ),
            AuthSpec(
                auth_mode="api_key",
                base_url="https://api.airtable.com",
                headers={"Authorization": "Bearer ${credentials.api_key}"},
                credentials=[
                    ConfigFieldSpec(
                        key="api_key",
                        label="Personal Access Token",
                        input_type="password",
                        required=True,
                        secret=True,
                    )
                ],
                check=CheckEndpointSpec(
                    method="GET",
                    path="/v0/meta/whoami",
                    account_id_path="id",
                    display_name_path="email",
                ),
            ),
        ],
        streams=[
            StreamSpec(
                name="bases",
                display_name="Bases",
                description="Accessible Airtable bases.",
                primary_key=["id"],
                fields=[
                    StreamFieldSpec(name="id", data_type="string", nullable=False, primary_key=True),
                    StreamFieldSpec(name="name", data_type="string", nullable=False),
                    StreamFieldSpec(name="permissionLevel", data_type="string"),
                ],
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/v0/meta/bases",
                    records_field_path=["bases"],
                    paginator=PaginatorSpec(
                        type="cursor",
                        cursor_response_path="offset",
                        cursor_request_param="offset",
                    ),
                ),
            ),
            StreamSpec(
                name="records",
                display_name="Table Records",
                description="Records inside an Airtable base and table with dynamic schema introspection.",
                primary_key=["id"],
                cursor_field="createdTime",
                dynamic_schema_loader=DynamicSchemaLoaderSpec(
                    type="rest_metadata",
                    container_stream="bases",
                    metadata_path="/v0/meta/bases/{{config.base_id}}/tables",
                    fields_field_path=["tables", "fields"],
                ),
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/v0/{{config.base_id}}/{{config.table_id}}",
                    records_field_path=["records"],
                    record_fields_unwrap_path="fields",
                    paginator=PaginatorSpec(
                        type="cursor",
                        cursor_response_path="offset",
                        cursor_request_param="offset",
                        page_size=100,
                        limit_param="pageSize",
                    ),
                    partition_router=SubstreamPartitionSpec(
                        parent_stream="bases",
                        parent_key="id",
                        partition_field="base_id",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PATCH",
                        path_template="/v0/{{config.base_id}}/{{config.table_id}}/{{external_id}}",
                        body_template={"fields": "{{patch}}"},
                    ),
                    "create": StreamMutationSpec(
                        operation="create",
                        adapter="rest_declarative",
                        http_method="POST",
                        path_template="/v0/{{config.base_id}}/{{config.table_id}}",
                        body_template={"fields": "{{patch}}"},
                    ),
                },
            ),
        ],
        tools=[
            ToolSpec(
                id="airtable.list_bases",
                name="list_bases",
                description="List all Airtable bases accessible by the connected account.",
                http_method="GET",
                path_template="/v0/meta/bases",
                annotations=ToolAnnotationsSpec(
                    read_only_hint=True,
                    destructive_hint=False,
                    idempotent_hint=True,
                ),
            ),
            ToolSpec(
                id="airtable.update_record",
                name="update_record",
                description="Patch fields on a single Airtable record.",
                http_method="PATCH",
                path_template="/v0/{{base_id}}/{{table_id}}/{{record_id}}",
                annotations=ToolAnnotationsSpec(
                    read_only_hint=False,
                    destructive_hint=False,
                    idempotent_hint=True,
                ),
            ),
        ],
    )

    github = ConnectorManifest(
        service="github",
        display_name="GitHub",
        description="GitHub repositories, issues, pull requests, and organization members.",
        categories=["Developer Tools", "Engineering"],
        homepage_url="https://github.com",
        docs_url="https://docs.github.com/en/rest",
        auth=[
            AuthSpec(
                auth_mode="oauth2",
                base_url="https://api.github.com",
                oauth2=OAuth2DialectSpec(
                    authorization_url="https://github.com/login/oauth/authorize",
                    token_url="https://github.com/login/oauth/access_token",
                    scopes=["repo", "read:org", "read:user"],
                ),
                check=CheckEndpointSpec(
                    method="GET",
                    path="/user",
                    account_id_path="id",
                    display_name_path="login",
                ),
            ),
            AuthSpec(
                auth_mode="api_key",
                base_url="https://api.github.com",
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
            ),
        ],
        streams=[
            StreamSpec(
                name="repositories",
                display_name="Repositories",
                primary_key=["id"],
                cursor_field="updated_at",
                default_label_field="full_name",
                fields=[
                    StreamFieldSpec(name="id", data_type="integer", nullable=False, primary_key=True),
                    StreamFieldSpec(name="full_name", data_type="string", nullable=False),
                    StreamFieldSpec(name="description", data_type="string"),
                    StreamFieldSpec(name="html_url", data_type="string"),
                    StreamFieldSpec(name="language", data_type="string"),
                    StreamFieldSpec(name="stargazers_count", data_type="integer"),
                    StreamFieldSpec(name="updated_at", data_type="datetime"),
                ],
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/user/repos",
                    records_field_path=[],
                    paginator=PaginatorSpec(
                        type="page",
                        page_request_param="page",
                        page_size=100,
                        limit_param="per_page",
                    ),
                ),
            ),
            StreamSpec(
                name="issues",
                display_name="Repository Issues",
                primary_key=["id"],
                cursor_field="updated_at",
                default_label_field="title",
                fields=[
                    StreamFieldSpec(name="id", data_type="integer", nullable=False, primary_key=True),
                    StreamFieldSpec(name="number", data_type="integer", nullable=False),
                    StreamFieldSpec(name="title", data_type="string", nullable=False),
                    StreamFieldSpec(name="state", data_type="string"),
                    StreamFieldSpec(name="body", data_type="string"),
                    StreamFieldSpec(name="html_url", data_type="string"),
                    StreamFieldSpec(name="updated_at", data_type="datetime"),
                ],
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/repos/{{config.owner}}/{{config.repo}}/issues",
                    records_field_path=[],
                    request_params={"state": "all"},
                    incremental_cursor_param="since",
                    paginator=PaginatorSpec(
                        type="page",
                        page_request_param="page",
                        page_size=100,
                        limit_param="per_page",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PATCH",
                        path_template="/repos/{{config.owner}}/{{config.repo}}/issues/{{external_id}}",
                        body_template={"patch": "{{patch}}"},
                    ),
                    "create": StreamMutationSpec(
                        operation="create",
                        adapter="rest_declarative",
                        http_method="POST",
                        path_template="/repos/{{config.owner}}/{{config.repo}}/issues",
                        body_template={"patch": "{{patch}}"},
                    ),
                },
            ),
        ],
        tools=[
            ToolSpec(
                id="github.create_issue",
                name="create_issue",
                description="Create a new GitHub issue in a repository.",
                http_method="POST",
                path_template="/repos/{{owner}}/{{repo}}/issues",
                annotations=ToolAnnotationsSpec(
                    read_only_hint=False,
                    destructive_hint=False,
                    idempotent_hint=False,
                ),
            ),
        ],
    )

    hubspot = ConnectorManifest(
        service="hubspot",
        display_name="HubSpot CRM",
        description="HubSpot CRM companies, contacts, and deals with incremental sync and property write-back.",
        categories=["CRM", "Sales", "Marketing"],
        homepage_url="https://www.hubspot.com",
        docs_url="https://developers.hubspot.com/docs/api/overview",
        auth=[
            AuthSpec(
                auth_mode="oauth2",
                base_url="https://api.hubapi.com",
                oauth2=OAuth2DialectSpec(
                    authorization_url="https://app.hubspot.com/oauth/authorize",
                    token_url="https://api.hubapi.com/oauth/v1/token",
                    scopes=[
                        "crm.objects.companies.read",
                        "crm.objects.companies.write",
                        "crm.objects.contacts.read",
                        "crm.objects.contacts.write",
                        "crm.objects.deals.read",
                    ],
                ),
                check=CheckEndpointSpec(
                    method="GET",
                    path="/account-info/v3/details",
                    account_id_path="portalId",
                    display_name_path="uiDomain",
                ),
            ),
        ],
        streams=[
            StreamSpec(
                name="companies",
                display_name="Companies",
                primary_key=["id"],
                cursor_field="updatedAt",
                default_label_field="properties.name",
                fields=[
                    StreamFieldSpec(name="id", data_type="string", nullable=False, primary_key=True),
                    StreamFieldSpec(name="properties.name", data_type="string"),
                    StreamFieldSpec(name="properties.domain", data_type="string"),
                    StreamFieldSpec(name="properties.industry", data_type="string"),
                    StreamFieldSpec(name="properties.annualrevenue", data_type="number"),
                    StreamFieldSpec(name="updatedAt", data_type="datetime"),
                ],
                dynamic_schema_loader=DynamicSchemaLoaderSpec(
                    type="rest_metadata",
                    metadata_path="/crm/v3/properties/companies",
                    fields_field_path=["results"],
                ),
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/crm/v3/objects/companies",
                    records_field_path=["results"],
                    paginator=PaginatorSpec(
                        type="cursor",
                        cursor_response_path="paging.next.after",
                        cursor_request_param="after",
                        page_size=100,
                        limit_param="limit",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PATCH",
                        path_template="/crm/v3/objects/companies/{{external_id}}",
                        body_template={"properties": "{{patch}}"},
                    ),
                    "create": StreamMutationSpec(
                        operation="create",
                        adapter="rest_declarative",
                        http_method="POST",
                        path_template="/crm/v3/objects/companies",
                        body_template={"properties": "{{patch}}"},
                    ),
                },
            ),
            StreamSpec(
                name="contacts",
                display_name="Contacts",
                primary_key=["id"],
                cursor_field="updatedAt",
                default_label_field="properties.email",
                fields=[
                    StreamFieldSpec(name="id", data_type="string", nullable=False, primary_key=True),
                    StreamFieldSpec(name="properties.email", data_type="string"),
                    StreamFieldSpec(name="properties.firstname", data_type="string"),
                    StreamFieldSpec(name="properties.lastname", data_type="string"),
                    StreamFieldSpec(name="properties.company", data_type="string"),
                    StreamFieldSpec(name="updatedAt", data_type="datetime"),
                ],
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/crm/v3/objects/contacts",
                    records_field_path=["results"],
                    paginator=PaginatorSpec(
                        type="cursor",
                        cursor_response_path="paging.next.after",
                        cursor_request_param="after",
                        page_size=100,
                        limit_param="limit",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PATCH",
                        path_template="/crm/v3/objects/contacts/{{external_id}}",
                        body_template={"properties": "{{patch}}"},
                    ),
                },
            ),
        ],
    )

    notion = ConnectorManifest(
        service="notion",
        display_name="Notion",
        description="Notion databases, pages, and structured database entries.",
        categories=["Productivity", "Knowledge Management"],
        homepage_url="https://www.notion.so",
        docs_url="https://developers.notion.com",
        auth=[
            AuthSpec(
                auth_mode="oauth2",
                base_url="https://api.notion.com",
                headers={"Notion-Version": "2022-06-28"},
                oauth2=OAuth2DialectSpec(
                    authorization_url="https://api.notion.com/v1/oauth/authorize",
                    token_url="https://api.notion.com/v1/oauth/token",
                    token_endpoint_auth_method="client_secret_basic",
                    token_request_format="json",
                ),
                check=CheckEndpointSpec(
                    method="GET",
                    path="/v1/users/me",
                    account_id_path="id",
                    display_name_path="name",
                ),
            ),
            AuthSpec(
                auth_mode="api_key",
                base_url="https://api.notion.com",
                headers={
                    "Authorization": "Bearer ${credentials.integration_token}",
                    "Notion-Version": "2022-06-28",
                },
                credentials=[
                    ConfigFieldSpec(
                        key="integration_token",
                        label="Internal Integration Secret",
                        input_type="password",
                        required=True,
                        secret=True,
                    )
                ],
                check=CheckEndpointSpec(
                    method="GET",
                    path="/v1/users/me",
                    account_id_path="id",
                    display_name_path="name",
                ),
            ),
        ],
        streams=[
            StreamSpec(
                name="database_pages",
                display_name="Database Pages",
                primary_key=["id"],
                cursor_field="last_edited_time",
                dynamic_schema_loader=DynamicSchemaLoaderSpec(
                    type="rest_metadata",
                    metadata_path="/v1/databases/{{config.database_id}}",
                    fields_field_path=["properties"],
                ),
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="POST",
                    path="/v1/databases/{{config.database_id}}/query",
                    records_field_path=["results"],
                    paginator=PaginatorSpec(
                        type="cursor",
                        inject_into="body",
                        cursor_response_path="next_cursor",
                        cursor_request_param="start_cursor",
                        page_size=100,
                        limit_param="page_size",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PATCH",
                        path_template="/v1/pages/{{external_id}}",
                        body_template={"properties": "{{patch}}"},
                    ),
                },
            ),
        ],
    )

    jira = ConnectorManifest(
        service="jira",
        display_name="Atlassian Jira",
        description="Jira projects, issues, and sprint tracking with basic API token or OAuth2 authentication.",
        categories=["Project Management", "Engineering"],
        homepage_url="https://www.atlassian.com/software/jira",
        auth=[
            AuthSpec(
                auth_mode="basic",
                base_url="https://${connectionConfig.domain}.atlassian.net",
                connection_config=[
                    ConfigFieldSpec(
                        key="domain",
                        label="Atlassian Subdomain",
                        input_type="text",
                        required=True,
                        placeholder="acme",
                    )
                ],
                credentials=[
                    ConfigFieldSpec(
                        key="username",
                        label="Email Address",
                        input_type="text",
                        required=True,
                    ),
                    ConfigFieldSpec(
                        key="password",
                        label="API Token",
                        input_type="password",
                        required=True,
                        secret=True,
                    ),
                ],
                check=CheckEndpointSpec(
                    method="GET",
                    path="/rest/api/3/myself",
                    account_id_path="accountId",
                    display_name_path="displayName",
                ),
            ),
        ],
        streams=[
            StreamSpec(
                name="issues",
                display_name="Jira Issues",
                primary_key=["id"],
                cursor_field="fields.updated",
                default_label_field="fields.summary",
                fields=[
                    StreamFieldSpec(name="id", data_type="string", nullable=False, primary_key=True),
                    StreamFieldSpec(name="key", data_type="string", nullable=False),
                    StreamFieldSpec(name="fields.summary", data_type="string"),
                    StreamFieldSpec(name="fields.status.name", data_type="string"),
                    StreamFieldSpec(name="fields.priority.name", data_type="string"),
                    StreamFieldSpec(name="fields.updated", data_type="datetime"),
                ],
                retriever=RetrieverSpec(
                    adapter="rest_declarative",
                    http_method="GET",
                    path="/rest/api/3/search",
                    records_field_path=["issues"],
                    paginator=PaginatorSpec(
                        type="offset",
                        offset_request_param="startAt",
                        page_size=50,
                        limit_param="maxResults",
                    ),
                ),
                mutations={
                    "update": StreamMutationSpec(
                        operation="update",
                        adapter="rest_declarative",
                        http_method="PUT",
                        path_template="/rest/api/3/issue/{{external_id}}",
                        body_template={"fields": "{{patch}}"},
                    ),
                },
            ),
        ],
    )

    return {m.service: m for m in [airtable, github, hubspot, notion, jira]}


def _load_anyconnect_tools() -> dict[str, dict[str, Any]]:
    result: dict[str, dict[str, Any]] = {}
    if not ANYCONNECT_CATALOG_DIR.is_dir():
        return result
    for p in sorted(ANYCONNECT_CATALOG_DIR.glob("*.json")):
        try:
            raw = json.loads(p.read_text(encoding="utf-8"))
            key = _normalize_service_key(raw.get("key") or p.stem)
            result[key] = raw
        except Exception:
            continue
    return result


def build_manifests() -> list[ConnectorManifest]:
    curated = _flagship_curated_manifests()
    anyconnect_by_key = _load_anyconnect_tools()
    by_service: dict[str, ConnectorManifest] = dict(curated)

    if NANGO_PROVIDERS_YAML.is_file():
        nango_raw = yaml.safe_load(NANGO_PROVIDERS_YAML.read_text(encoding="utf-8")) or {}
        for raw_key, cfg in sorted(nango_raw.items()):
            if not isinstance(cfg, dict):
                continue
            service = _normalize_service_key(raw_key)
            if not SERVICE_KEY_RE.match(service):
                continue
            if service in by_service:
                continue

            auth_mode = _map_nango_auth_mode(str(cfg.get("auth_mode") or "CUSTOM"))
            proxy_cfg = cfg.get("proxy") if isinstance(cfg.get("proxy"), dict) else {}
            base_url = cfg.get("base_url") or proxy_cfg.get("base_url")
            authorize_url = cfg.get("authorize_url")
            token_url = cfg.get("token_url")

            config_fields = _extract_placeholder_fields(
                [base_url, authorize_url, token_url]
            )
            credentials: list[ConfigFieldSpec] = []
            if auth_mode == "api_key":
                credentials.append(
                    ConfigFieldSpec(
                        key="api_key",
                        label="API Key",
                        input_type="password",
                        required=True,
                        secret=True,
                    )
                )
            elif auth_mode == "basic":
                credentials.extend(
                    [
                        ConfigFieldSpec(
                            key="username",
                            label="Username",
                            input_type="text",
                            required=True,
                        ),
                        ConfigFieldSpec(
                            key="password",
                            label="Password / Token",
                            input_type="password",
                            required=True,
                            secret=True,
                        ),
                    ]
                )

            oauth2_spec: OAuth2DialectSpec | None = None
            if auth_mode in ("oauth2", "oauth2_cc") and token_url:
                scopes_raw = cfg.get("default_scopes") or []
                if isinstance(scopes_raw, str):
                    scopes_raw = [s.strip() for s in scopes_raw.split(",") if s.strip()]
                sep_raw = str(cfg.get("scope_separator") or " ")
                sep = "," if sep_raw == "," else " "
                oauth2_spec = OAuth2DialectSpec(
                    authorization_url=str(authorize_url) if authorize_url else None,
                    token_url=str(token_url),
                    scopes=[str(s) for s in scopes_raw if s],
                    scope_separator=sep,
                )

            categories_raw = cfg.get("categories") or []
            categories = (
                [str(c).title() for c in categories_raw if c]
                if isinstance(categories_raw, list)
                else []
            )

            tools: list[ToolSpec] = []
            ac_entry = anyconnect_by_key.get(service)
            if ac_entry and isinstance(ac_entry.get("actions"), list):
                for act in ac_entry["actions"]:
                    if not isinstance(act, dict) or not act.get("key"):
                        continue
                    act_key = str(act["key"])
                    is_read = act_key.startswith(("get_", "list_", "search_", "find_"))
                    tools.append(
                        ToolSpec(
                            id=f"{service}.{act_key}",
                            name=str(act.get("name") or act_key),
                            description=str(act.get("description") or ""),
                            http_method="GET" if is_read else "POST",
                            path_template=f"/{act_key}",
                            annotations=ToolAnnotationsSpec(
                                read_only_hint=is_read,
                                destructive_hint=act_key.startswith(("delete_", "remove_")),
                                idempotent_hint=is_read or act_key.startswith("update_"),
                            ),
                        )
                    )

            display_name = str(
                cfg.get("display_name")
                or (ac_entry.get("name") if ac_entry else None)
                or raw_key.replace("-", " ").title()
            )
            docs_url = cfg.get("docs") or (ac_entry.get("docsUrl") if ac_entry else None)

            manifest = ConnectorManifest(
                service=service,
                display_name=display_name,
                description=(
                    str(ac_entry.get("description"))
                    if ac_entry and ac_entry.get("description")
                    else f"{display_name} connector via Basis Open Connector Protocol."
                ),
                categories=categories or ["Integration"],
                docs_url=str(docs_url) if docs_url else None,
                auth=[
                    AuthSpec(
                        auth_mode=auth_mode,
                        base_url=str(base_url) if base_url else None,
                        connection_config=config_fields,
                        credentials=credentials,
                        oauth2=oauth2_spec,
                    )
                ],
                streams=[],
                tools=tools,
            )
            by_service[service] = manifest

    return [by_service[k] for k in sorted(by_service.keys())]


def main() -> None:
    MANIFESTS_OUT_DIR.mkdir(parents=True, exist_ok=True)
    manifests = build_manifests()
    bundle_path = MANIFESTS_OUT_DIR / "catalog_bundle.json"
    payload = [m.model_dump(mode="json", exclude_none=True) for m in manifests]
    bundle_path.write_text(
        json.dumps(payload, ensure_ascii=False, indent=2) + "\n",
        encoding="utf-8",
    )
    print(f"Generated {len(manifests)} BOCP manifests into {bundle_path}")


if __name__ == "__main__":
    main()
