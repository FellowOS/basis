"""Core operation dispatch (R1)."""

from basis.application.tool_catalog import TOOL_NAMES
from basis.interface.mcp.dispatch import execute


def test_tool_names_match_registry() -> None:
    assert len(TOOL_NAMES) == 33
    assert "search_chunks" in TOOL_NAMES
    assert "list_connector_catalog" in TOOL_NAMES
    assert "list_typed_facts" in TOOL_NAMES
    assert "run_reasoning" in TOOL_NAMES
    assert "get_capabilities" in TOOL_NAMES
    assert "list_processing_jobs" in TOOL_NAMES


def test_execute_unknown_operation() -> None:
    # Minimal ctx stub — only name dispatch is tested.
    class _Workspace:
        id = "ws1"

    class _Ctx:
        workspace = _Workspace()

    result = execute(_Ctx(), "not_a_tool", {})  # type: ignore[arg-type]
    assert result["isError"] is True
