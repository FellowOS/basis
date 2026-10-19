"""Pydantic v2 contracts for the Basis Open Connector Protocol (BOCP)."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


AuthModeLiteral = Literal[
    "none",
    "api_key",
    "basic",
    "two_step",
    "oauth2",
    "oauth2_cc",
    "oauth1",
    "jwt",
    "aws_sigv4",
    "app",
    "database_dsn",
    "custom",
]

FieldInputTypeLiteral = Literal[
    "text",
    "password",
    "number",
    "boolean",
    "select",
    "textarea",
    "json",
]


class ConfigFieldSpec(BaseModel):
    """Declarative field definition for connection_config or credentials."""

    model_config = ConfigDict(extra="forbid")

    key: str = Field(min_length=1)
    label: str = Field(min_length=1)
    input_type: FieldInputTypeLiteral = "text"
    required: bool = True
    secret: bool = False
    default: str | int | bool | None = None
    placeholder: str | None = None
    description: str | None = None
    enum: list[str] | None = None
    pattern: str | None = None


class OAuthTokenResponseEnvelope(BaseModel):
    """Non-standard OAuth token response envelope extractor (e.g. Feishu/Notion dialects)."""

    model_config = ConfigDict(extra="forbid")

    data_field: str = Field(min_length=1)
    code_field: str | None = None
    success_code: int | str | None = None
    message_field: str | None = None


class OAuth2DialectSpec(BaseModel):
    """Declarative OAuth2 & OAuth2 Client Credentials parameters."""

    model_config = ConfigDict(extra="forbid")

    authorization_url: str | None = None
    token_url: str = Field(min_length=1)
    refresh_token_url: str | None = None
    scopes: list[str] = Field(default_factory=list)
    scope_separator: Literal[" ", ","] = " "
    token_endpoint_auth_method: Literal[
        "client_secret_basic", "client_secret_post", "none"
    ] = "client_secret_post"
    token_request_format: Literal["form", "json"] = "form"
    pkce_s256: bool = False
    authorization_params: dict[str, str] = Field(default_factory=dict)
    token_params: dict[str, str] = Field(default_factory=dict)
    token_response_envelope: OAuthTokenResponseEnvelope | None = None


class TwoStepAuthSpec(BaseModel):
    """Two-step username/password or key exchange for a session token."""

    model_config = ConfigDict(extra="forbid")

    token_url: str = Field(min_length=1)
    method: Literal["POST", "GET"] = "POST"
    body_format: Literal["form", "json"] = "json"
    token_params: dict[str, str] = Field(default_factory=dict)
    token_headers: dict[str, str] = Field(default_factory=dict)
    token_response_path: str = "access_token"
    token_expires_in_ms: int | None = None


class CheckEndpointSpec(BaseModel):
    """Declarative connection health check and account profile extractor (`CHECK` primitive)."""

    model_config = ConfigDict(extra="forbid")

    method: Literal["GET", "POST"] = "GET"
    path: str = Field(min_length=1)
    headers: dict[str, str] = Field(default_factory=dict)
    account_id_path: str | None = "id"
    display_name_path: str | None = "name"
    scopes_path: str | None = None


class RateLimitQuotaSpec(BaseModel):
    """Adaptive rate-limit header tracking (Airbyte TokenQuota style)."""

    model_config = ConfigDict(extra="forbid")

    name: str = "default"
    remaining_header: str | None = "X-RateLimit-Remaining"
    reset_header: str | None = "X-RateLimit-Reset"
    limit_header: str | None = "X-RateLimit-Limit"
    retry_after_header: str | None = "Retry-After"


class AuthSpec(BaseModel):
    """Primitive 1: Authentication mode, connection config fields, and proxy headers."""

    model_config = ConfigDict(extra="forbid")

    auth_mode: AuthModeLiteral
    base_url: str | None = None
    headers: dict[str, str] = Field(default_factory=dict)
    query_params: dict[str, str] = Field(default_factory=dict)
    connection_config: list[ConfigFieldSpec] = Field(default_factory=list)
    credentials: list[ConfigFieldSpec] = Field(default_factory=list)
    oauth2: OAuth2DialectSpec | None = None
    two_step: TwoStepAuthSpec | None = None
    check: CheckEndpointSpec | None = None
    quotas: list[RateLimitQuotaSpec] = Field(default_factory=list)


class PaginatorSpec(BaseModel):
    """Declarative pagination strategy (synthesizing Airbyte DefaultPaginator & Nango paginate)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["none", "cursor", "offset", "page", "link"] = "none"
    page_size: int | None = 100
    limit_param: str | None = None
    inject_into: Literal["query", "body", "header"] = "query"
    # cursor pagination
    cursor_request_param: str | None = None
    cursor_response_path: str | None = None
    stop_condition_jinja: str | None = None
    # offset / page pagination
    offset_request_param: str | None = None
    page_request_param: str | None = None
    # link pagination
    link_header_rel: str | None = "next"
    link_response_path: str | None = None


class SubstreamPartitionSpec(BaseModel):
    """Parent-child stream routing (Airbyte SubstreamPartitionRouter)."""

    model_config = ConfigDict(extra="forbid")

    parent_stream: str = Field(min_length=1)
    parent_key: str = Field(min_length=1)
    partition_field: str = Field(min_length=1)


class RetrieverSpec(BaseModel):
    """Primitive 3: Declarative record extraction, pagination, and incremental sync (`READ`)."""

    model_config = ConfigDict(extra="forbid")

    adapter: Literal["rest_declarative", "sql_alchemy"] = "rest_declarative"
    path: str = ""
    http_method: Literal["GET", "POST"] = "GET"
    request_params: dict[str, str] = Field(default_factory=dict)
    request_headers: dict[str, str] = Field(default_factory=dict)
    request_body_json: dict[str, Any] | None = None
    records_field_path: list[str] = Field(default_factory=list)
    record_fields_unwrap_path: str | None = None
    record_filter_jinja: str | None = None
    paginator: PaginatorSpec = Field(default_factory=PaginatorSpec)
    partition_router: SubstreamPartitionSpec | None = None
    incremental_cursor_param: str | None = None


class DynamicSchemaLoaderSpec(BaseModel):
    """Runtime schema discovery for custom tables/objects (`DISCOVER` primitive)."""

    model_config = ConfigDict(extra="forbid")

    type: Literal["sql_inspector", "rest_metadata"] = "rest_metadata"
    container_stream: str | None = None
    metadata_path: str | None = None
    fields_field_path: list[str] = Field(default_factory=lambda: ["fields"])
    field_name_key: str = "name"
    field_type_key: str = "type"
    types_map: dict[str, str] = Field(default_factory=dict)


class StreamFieldSpec(BaseModel):
    """Normalized column/field descriptor returned by static or dynamic discovery."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    data_type: Literal[
        "string", "integer", "number", "boolean", "date", "datetime", "json", "array"
    ] = "string"
    nullable: bool = True
    primary_key: bool = False
    fk_target_stream: str | None = None
    description: str | None = None


class StreamMutationSpec(BaseModel):
    """Primitive 4a: Declarative write-back template bound to a stream (`MUTATE`)."""

    model_config = ConfigDict(extra="forbid")

    operation: Literal["create", "update", "upsert", "delete"] = "update"
    adapter: Literal["rest_declarative", "sql_alchemy"] = "rest_declarative"
    http_method: Literal["POST", "PUT", "PATCH", "DELETE"] = "PATCH"
    path_template: str = ""
    body_template: dict[str, Any] = Field(default_factory=dict)


class StreamSpec(BaseModel):
    """Primitive 2: Business object / entity stream definition (`STREAM` & `DISCOVER`)."""

    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1)
    display_name: str = Field(min_length=1)
    description: str | None = None
    primary_key: list[str] = Field(default_factory=lambda: ["id"])
    cursor_field: str | None = None
    default_label_field: str | None = None
    fields: list[StreamFieldSpec] = Field(default_factory=list)
    dynamic_schema_loader: DynamicSchemaLoaderSpec | None = None
    retriever: RetrieverSpec = Field(default_factory=RetrieverSpec)
    mutations: dict[Literal["create", "update", "upsert", "delete"], StreamMutationSpec] = (
        Field(default_factory=dict)
    )


class ToolAnnotationsSpec(BaseModel):
    """MCP-aligned tool safety and governance annotations."""

    model_config = ConfigDict(extra="forbid")

    read_only_hint: bool = True
    destructive_hint: bool = False
    idempotent_hint: bool = False


class ToolSpec(BaseModel):
    """Primitive 4b: Standalone RPC tool exposed via OpenAPI & Basis Python MCP."""

    model_config = ConfigDict(extra="forbid")

    id: str = Field(min_length=1)
    name: str = Field(min_length=1)
    description: str = ""
    required_scopes: list[str] = Field(default_factory=list)
    annotations: ToolAnnotationsSpec = Field(default_factory=ToolAnnotationsSpec)
    input_schema: dict[str, Any] = Field(default_factory=dict)
    output_schema: dict[str, Any] = Field(default_factory=dict)
    http_method: Literal["GET", "POST", "PUT", "PATCH", "DELETE"] | None = None
    path_template: str | None = None


class ConnectorManifest(BaseModel):
    """Complete Basis Open Connector Protocol (BOCP v1) provider manifest."""

    model_config = ConfigDict(extra="forbid")

    version: Literal["1.0"] = "1.0"
    service: str = Field(min_length=1, pattern=r"^[a-z0-9][a-z0-9_-]*$")
    display_name: str = Field(min_length=1)
    description: str | None = None
    categories: list[str] = Field(default_factory=list)
    homepage_url: str | None = None
    docs_url: str | None = None
    icon_url: str | None = None
    auth: list[AuthSpec] = Field(min_length=1)
    streams: list[StreamSpec] = Field(default_factory=list)
    tools: list[ToolSpec] = Field(default_factory=list)
