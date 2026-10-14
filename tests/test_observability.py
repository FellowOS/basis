"""Observability helpers (X-02)."""

from sema.observability.log_context import correlation_log_extra
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
