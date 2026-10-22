"""Map core operation payloads to HTTP exceptions."""

from __future__ import annotations

from typing import Any

from fastapi import HTTPException

from basis.domain.errors import AdminError
from basis.application.errors import CoreError

_ERROR_MAP: dict[str, tuple[int, str]] = {
    "query is required": (422, "validation_error"),
    "chunk_id is required": (422, "validation_error"),
    "chunk not found": (404, "chunk_not_found"),
    "node_id is required": (422, "validation_error"),
    "source and target are required": (422, "bad_path"),
    "entity_id is required": (422, "validation_error"),
    "content is required": (422, "validation_error"),
    "item_id is required": (422, "validation_error"),
    "review item not found": (404, "not_found"),
    "statement not found": (404, "statement_not_found"),
    "statement_id is required": (422, "validation_error"),
    "facts is required (non-empty array of fact strings)": (422, "validation_error"),
    "facts must be an array of strings when provided": (422, "validation_error"),
    "no ground facts: pass facts[] or materialize typed_facts in the workspace": (
        422,
        "validation_error",
    ),
    "rules is required (non-empty array of rule strings)": (422, "validation_error"),
    "rule_id is required": (422, "validation_error"),
    "rule not found": (404, "not_found"),
}


def http_response_from_payload(payload: dict[str, Any]) -> dict[str, Any]:
    """Return payload or raise HTTPException / AdminError for `{error: ...}` results."""
    err = payload.get("error")
    if not err or not isinstance(err, str):
        return payload
    if err.startswith("invalid "):
        code = "validation_error"
        if err.startswith("invalid source") or err.startswith("invalid target"):
            code = "bad_path"
        raise HTTPException(
            status_code=422,
            detail={"code": code, "message": err},
        )
    status, code = _ERROR_MAP.get(err, (400, "bad_request"))
    if status == 404:
        raise AdminError(status, code, err)
    raise HTTPException(status_code=status, detail={"code": code, "message": err})


def http_exception_from_core(exc: CoreError) -> HTTPException:
    detail = exc.detail if isinstance(exc.detail, dict) else {"message": str(exc.detail)}
    return HTTPException(status_code=exc.status_code, detail=detail)
