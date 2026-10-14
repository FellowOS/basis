"""Observability helpers (X-02)."""

import json
import logging

from sema.observability.json_logging import JsonLogFormatter
from sema.observability.log_context import correlation_log_extra
from sema.observability.redaction import REDACTED, redact_for_log, redact_string
from sema.observability.request_context import (
    current_request_id,
    reset_request_id,
    set_request_id,
)


def test_correlation_log_extra_includes_bound_request_id() -> None:
    token = set_request_id("ctx-abc")
    try:
        extra = correlation_log_extra(job_id="job-1", kb_id="kb-1", projection_revision=3)
        assert extra["request_id"] == "ctx-abc"
        assert extra["job_id"] == "job-1"
        assert extra["kb_id"] == "kb-1"
        assert extra["projection_revision"] == 3
    finally:
        reset_request_id(token)
    assert current_request_id() is None


def test_redact_string_masks_bearer_and_sk_tokens() -> None:
    raw = "Authorization: Bearer eyJhbGciOiJIUzI1NiJ9 and key sk-abcdefghijklmnopqrstuvwxyz"
    out = redact_string(raw)
    assert "eyJhbGciOiJIUzI1NiJ9" not in out
    assert "sk-abcdefghijklmnopqrstuvwxyz" not in out
    assert REDACTED in out


def test_redact_for_log_masks_sensitive_keys_and_long_text() -> None:
    payload = {
        "api_key": "secret-value",
        "metadata": {"authorization": "Bearer abc"},
        "content": "x" * 400,
        "title": "short",
    }
    out = redact_for_log(payload)
    assert out["api_key"] == REDACTED
    assert out["metadata"]["authorization"] == REDACTED
    assert str(out["content"]).startswith(REDACTED)
    assert out["title"] == "short"


def test_json_log_formatter_emits_parseable_line_with_extras() -> None:
    record = logging.LogRecord(
        name="sema.test",
        level=logging.INFO,
        pathname=__file__,
        lineno=1,
        msg="ingest done kb_id=%s",
        args=("kb-1",),
        exc_info=None,
    )
    record.request_id = "trace-42"
    record.job_id = "job-9"
    record.password = "do-not-leak"
    line = JsonLogFormatter().format(record)
    data = json.loads(line)
    assert data["level"] == "INFO"
    assert data["request_id"] == "trace-42"
    assert data["job_id"] == "job-9"
    assert data["password"] == REDACTED
    assert "kb-1" in data["message"]
