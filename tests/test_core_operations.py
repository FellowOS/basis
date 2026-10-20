"""Core operation dispatch (R1)."""

from basis.integration.registry import TOOL_NAMES, execute


def test_tool_names_match_registry() -> None:
    assert len(TOOL_NAMES) == 21
    assert "search_chunks" in TOOL_NAMES
    assert "list_connector_catalog" in TOOL_NAMES


def test_execute_unknown_operation() -> None:
    # Minimal ctx stub — only name dispatch is tested.
    class _Kb:
        id = "kb"

    class _Ctx:
        kb = _Kb()

    result = execute(_Ctx(), "not_a_tool", {})  # type: ignore[arg-type]
    assert result["isError"] is True
