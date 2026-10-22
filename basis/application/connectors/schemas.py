"""Pydantic models for named tool arguments and responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from basis.application.tool_catalog.schema_base import ExtraAllowedModel

class ProposeEntityWritebackInput(ExtraAllowedModel):
    entity_id: str = Field(min_length=1)
    field_updates: dict[str, Any] = Field(min_length=1)

TOOL_INPUT_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "propose_entity_writeback": ProposeEntityWritebackInput,
}

TOOL_RESPONSE_MODELS: dict[str, type[ExtraAllowedModel]] = {
}
