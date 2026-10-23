"""Pydantic models for workspace ledger routes."""

from __future__ import annotations

from pydantic import BaseModel, Field


class RememberProposalRequest(BaseModel):
    content: str = Field(min_length=1, max_length=8000)
