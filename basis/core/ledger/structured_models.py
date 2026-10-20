"""Pydantic v2 models & canonical row_hash helper for structured entity sync (data-model.md §18.4–18.5)."""

from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
import hashlib
import json
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field


class ConnectorSourceConfig(BaseModel):
    """Normative config_json for ingest_sources with kind = 'connector'."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=1)
    connection_name: str = Field(default="default", min_length=1)
    poll_interval_minutes: int | None = Field(default=60, ge=1)
    last_sync_at: str | None = None


class ColumnMappingSpec(BaseModel):
    """Single element of source_table_mappings.column_mappings_json."""

    model_config = ConfigDict(extra="forbid")

    column: str = Field(min_length=1)
    kind: Literal["literal", "relation"] = "literal"
    surface_phrase: str = Field(min_length=1)
    predicate_uri: str | None = None
    datatype: str = "xsd:string"
    fk_target_table: str | None = None
    writable: bool = False


class StructuredImportProvenance(BaseModel):
    """Normative typed_facts.import_provenance_json for structured connector rows."""

    model_config = ConfigDict(extra="forbid")

    kind: Literal["structured_source"] = "structured_source"
    provider: str = Field(min_length=1)
    stream: str = Field(min_length=1)
    source_id: str = Field(min_length=1)
    mapping_id: str = Field(min_length=1)
    external_ref_id: str = Field(min_length=1)
    external_table: str = Field(min_length=1)
    external_pk: str = Field(min_length=1)
    column: str = Field(min_length=1)


class OutboxFieldChange(BaseModel):
    """Before/after diff for one mapped attribute in entity_sync_outbox."""

    model_config = ConfigDict(extra="forbid")

    old: Any = None
    new: Any = None
    predicate_uri: str | None = None
    statement_id: str | None = None


class OutboxPatchSpec(BaseModel):
    """Normative entity_sync_outbox.patch_json payload."""

    model_config = ConfigDict(extra="forbid")

    provider: str = Field(min_length=1)
    stream_name: str = Field(min_length=1)
    mutation_operation: Literal["create", "update", "upsert", "delete"] = "update"
    external_table: str = Field(min_length=1)
    primary_key_column: str = Field(min_length=1)
    external_pk: str = Field(min_length=1)
    stream_params: dict[str, Any] = Field(default_factory=dict)
    changes: dict[str, OutboxFieldChange] = Field(default_factory=dict)


def _normalize_hash_value(value: Any) -> Any:
    if value is None or isinstance(value, (str, int, float, bool)):
        return value
    if isinstance(value, (datetime, date)):
        return value.isoformat()
    if isinstance(value, Decimal):
        return str(value)
    if isinstance(value, dict):
        return {str(k): _normalize_hash_value(v) for k, v in sorted(value.items())}
    if isinstance(value, (list, tuple)):
        return [_normalize_hash_value(v) for v in value]
    return str(value)


def compute_canonical_row_hash(
    row: dict[str, Any],
    *,
    label_column: str,
    column_mappings: list[ColumnMappingSpec],
) -> str:
    """Compute deterministic SHA-256 hex digest over mapped columns (data-model.md §18.5)."""
    payload: dict[str, Any] = {
        label_column: _normalize_hash_value(row.get(label_column)),
    }
    for mapping in column_mappings:
        payload[mapping.column] = _normalize_hash_value(row.get(mapping.column))
    canonical = json.dumps(
        payload,
        sort_keys=True,
        ensure_ascii=False,
        separators=(",", ":"),
    )
    return hashlib.sha256(canonical.encode("utf-8")).hexdigest()
