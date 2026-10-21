"""Immutable row types returned from KnowledgeStore queries."""

from __future__ import annotations

from dataclasses import dataclass
from typing import Any

from basis.domain.knowledge.blob_store import BlobRef


@dataclass(frozen=True)
class JobRow:
    id: str
    workspace_id: str
    kind: str
    subject_type: str
    subject_id: str
    status: str
    attempt: int
    progress: float | None
    error_code: str | None
    error_detail: dict[str, Any] | None
    options: dict[str, Any]
    result: dict[str, Any] | None
    created_at: str
    started_at: str | None
    finished_at: str | None


@dataclass(frozen=True)
class DocumentVersionRow:
    id: str
    document_id: str
    workspace_id: str
    version_no: int
    sha256: str
    blob_key: str
    byte_size: int
    status: str


@dataclass(frozen=True)
class StoreDocumentOutcome:
    document_id: str
    version_id: str
    blob: BlobRef
    version_no: int
    new_document: bool
    new_version: bool
