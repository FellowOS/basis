"""Pydantic models for named tool arguments and responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from basis.application.tool_catalog.schema_base import ExtraAllowedModel

class DescribeWorkspaceInput(ExtraAllowedModel):
    pass

class DescribeWorkspaceResponse(ExtraAllowedModel):
    workspace_id: str
    name: str

class GetCapabilitiesInput(ExtraAllowedModel):
    pass

class ListProcessingJobsInput(ExtraAllowedModel):
    status: Literal["queued", "running", "succeeded", "failed", "cancelled"] | None = None
    limit: int = Field(default=100, ge=1, le=200)

class ListProcessingJobsResponse(ExtraAllowedModel):
    jobs: list[Any] = Field(default_factory=list)

TOOL_INPUT_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "describe_workspace": DescribeWorkspaceInput,
    "get_capabilities": GetCapabilitiesInput,
    "list_processing_jobs": ListProcessingJobsInput,
}

TOOL_RESPONSE_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "describe_workspace": DescribeWorkspaceResponse,
    "list_processing_jobs": ListProcessingJobsResponse,
}
