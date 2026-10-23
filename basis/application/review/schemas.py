"""Pydantic models for named tool arguments and responses."""

from __future__ import annotations

from typing import Any, Literal

from pydantic import Field

from basis.application.schema_base import ExtraAllowedModel

class ApproveReviewItemResponse(ExtraAllowedModel):
    item: dict[str, Any]
    decision_id: str | None = None

class GetReviewItemInput(ExtraAllowedModel):
    item_id: str = Field(min_length=1)

class GetReviewItemResponse(ExtraAllowedModel):
    item: dict[str, Any]

class ListReviewItemsInput(ExtraAllowedModel):
    status: str | None = None
    kind: str | None = None
    limit: int = Field(default=50, ge=1, le=200)

class ListReviewItemsResponse(ExtraAllowedModel):
    items: list[Any] = Field(default_factory=list)

class ResolveReviewItemInput(ExtraAllowedModel):
    item_id: str = Field(min_length=1)
    rationale: str | None = None
    keeper_statement_id: str | None = None
    primary_id: str | None = None

class ResolveStatementRememberReviewInput(ExtraAllowedModel):
    item_id: str = Field(min_length=1)
    rationale: str | None = None

class ResolveStatementRememberReviewResponse(ExtraAllowedModel):
    item: dict[str, Any]
    decision_id: str | None = None

TOOL_INPUT_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "approve_review_item": ResolveReviewItemInput,
    "approve_statement_remember_review": ResolveStatementRememberReviewInput,
    "get_review_item": GetReviewItemInput,
    "list_review_items": ListReviewItemsInput,
    "reject_review_item": ResolveStatementRememberReviewInput,
    "reject_statement_remember_review": ResolveStatementRememberReviewInput,
}

TOOL_RESPONSE_MODELS: dict[str, type[ExtraAllowedModel]] = {
    "approve_review_item": ApproveReviewItemResponse,
    "approve_statement_remember_review": ResolveStatementRememberReviewResponse,
    "get_review_item": GetReviewItemResponse,
    "list_review_items": ListReviewItemsResponse,
    "reject_review_item": ResolveStatementRememberReviewResponse,
    "reject_statement_remember_review": ResolveStatementRememberReviewResponse,
}
