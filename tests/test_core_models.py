"""Pydantic coercion for core operation arguments."""

import pytest
from pydantic import ValidationError

from basis.integration.models import coerce_operation_args
from basis.integration.registry import run


def test_coerce_search_chunks_requires_query() -> None:
    with pytest.raises(ValidationError):
        coerce_operation_args("search_chunks", {"limit": 5})


def test_run_rejects_empty_graph_search_query() -> None:
    class _Kb:
        id = "kb"

    class _Ctx:
        kb = _Kb()

    payload = run(_Ctx(), "graph_search", {"query": ""})  # type: ignore[arg-type]
    assert "error" in payload
