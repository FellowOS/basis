"""Pydantic models for BOCP connector routes."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import BaseModel, Field

from basis.core.ledger.structured_models import ColumnMappingSpec


class UpsertConnectorPolicyRequest(BaseModel):
    allowed_providers: list[str] | str = "*"
    action_policy: dict[str, Any] = Field(default_factory=dict)


class UpsertConnectorConnectionRequest(BaseModel):
    auth_type: str = Field(min_length=1)
    connection_config: dict[str, Any] = Field(default_factory=dict)
    credentials: dict[str, Any] = Field(default_factory=dict)


class UpdateTableMappingRequest(BaseModel):
    provider: str | None = None
    connection_name: str | None = None
    stream_name: str = Field(min_length=1)
    external_table: str = Field(min_length=1)
    stream_params: dict[str, Any] = Field(default_factory=dict)
    primary_key_column: str = Field(min_length=1)
    cursor_column: str | None = None
    label_column: str = Field(min_length=1)
    target_class_uri: str = Field(min_length=1)
    column_mappings: list[ColumnMappingSpec] = Field(default_factory=list)
    sync_mode: Literal["full_refresh", "incremental"] = "incremental"
    track_deletes: bool = False
    sync_direction: Literal["inbound", "bidirectional"] = "inbound"
    writeback_mode: Literal["disabled", "review", "auto"] = "review"
    max_rows: int = Field(default=10000, ge=1, le=100000)
    poll_interval_minutes: int = Field(
        default=0,
        ge=0,
        le=10080,
        description="Background inbound sync interval in minutes; 0 = manual only.",
    )


class CreateTableMappingRequest(BaseModel):
    source_id: str | None = None
    provider: str = Field(min_length=1)
    connection_name: str = Field(default="default", min_length=1)
    stream_name: str = Field(min_length=1)
    external_table: str = Field(min_length=1)
    stream_params: dict[str, Any] = Field(default_factory=dict)
    primary_key_column: str = Field(min_length=1)
    cursor_column: str | None = None
    label_column: str = Field(min_length=1)
    target_class_uri: str = Field(min_length=1)
    column_mappings: list[ColumnMappingSpec] = Field(default_factory=list)
    sync_mode: Literal["full_refresh", "incremental"] = "incremental"
    track_deletes: bool = False
    sync_direction: Literal["inbound", "bidirectional"] = "inbound"
    writeback_mode: Literal["disabled", "review", "auto"] = "review"
    max_rows: int = Field(default=10000, ge=1, le=100000)
    poll_interval_minutes: int = Field(
        default=0,
        ge=0,
        le=10080,
        description="Background inbound sync interval in minutes; 0 = manual only.",
    )


class ProposeEntityWritebackRequest(BaseModel):
    entity_id: str = Field(min_length=1)
    field_updates: dict[str, Any] = Field(min_length=1)


class UpsertOAuthConfigRequest(BaseModel):
    client_id: str = Field(min_length=1)
    client_secret: str = Field(min_length=1)
    redirect_uri: str | None = None
    extra: dict[str, Any] = Field(default_factory=dict)


class BuildOAuthAuthorizeUrlRequest(BaseModel):
    state: str | None = None
    redirect_uri: str | None = None
    connection_config: dict[str, Any] = Field(default_factory=dict)
    code_challenge: str | None = None


class ExchangeOAuthCodeRequest(BaseModel):
    code: str = Field(min_length=1)
    redirect_uri: str | None = None
    code_verifier: str | None = None
    connection_name: str = Field(default="default", min_length=1)
    connection_config: dict[str, Any] = Field(default_factory=dict)


class ExecuteConnectorToolRequest(BaseModel):
    service: str = Field(min_length=1)
    tool_id: str = Field(min_length=1)
    connection_name: str = Field(default="default", min_length=1)
    arguments: dict[str, Any] = Field(default_factory=dict)


class InvokeConnectorPrimitiveRequest(BaseModel):
    action_id: str = Field(min_length=1)
    primitive: Literal["discover", "list", "mutate", "invoke"]
    operation: Literal["create", "update", "upsert", "delete"] | None = None
    external_table: str | None = None
    external_id: Any | None = None
    changes: dict[str, Any] = Field(default_factory=dict)
    action_params: dict[str, Any] = Field(default_factory=dict)
    arguments: dict[str, Any] = Field(default_factory=dict)
    limit: int = Field(default=500, ge=1, le=5000)
    cursor_watermark: Any | None = None
    primary_key_column: str = Field(default="id", min_length=1)
    cursor_column: str | None = None

