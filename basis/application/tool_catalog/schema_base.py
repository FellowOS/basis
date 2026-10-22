"""Shared Pydantic base for tool argument/response models."""

from __future__ import annotations

from pydantic import BaseModel, ConfigDict


class ExtraAllowedModel(BaseModel):
    model_config = ConfigDict(extra="allow")
