"""Pydantic models for workspace graph and chunk search routes."""

from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field


class GraphSearchRequest(BaseModel):
    query: str = Field(min_length=1)
    limit: int = Field(default=20, ge=1, le=50)
    at: str | None = Field(
        default=None,
        description="Optional temporal instant (ISO). When set, results are limited to nodes active at that instant.",
    )


class SearchConfigRequest(BaseModel):
    chunk_backend: Literal["sqlite_ledger", "postgres_ledger"] = "sqlite_ledger"
    vector_backend: Literal["sqlite_vec", "pgvector"] = "sqlite_vec"
    embedding_model_id: str | None = None
    keyword_enabled: bool = True
    semantic_enabled: bool = True
    default_mode: Literal["keyword", "semantic", "hybrid"] = "hybrid"
    auto_index: bool = True


class ResolveNodeLabelsRequest(BaseModel):
    ids: list[str] = Field(default_factory=list, max_length=80)


class SearchReindexRequest(BaseModel):
    document_id: str | None = None
    version_id: str | None = None
