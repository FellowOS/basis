#!/usr/bin/env python3
"""One-off: rename test function names that still contain `kb` (workspace migration)."""

from __future__ import annotations

from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TESTS = ROOT / "tests"

REPLACEMENTS: list[tuple[str, str]] = [
    ("def test_alignments_isolated_between_kbs", "def test_alignments_isolated_between_workspaces"),
    ("def test_drafts_isolated_between_kbs", "def test_drafts_isolated_between_workspaces"),
    ("def test_legacy_kbs_mount_when_enabled", "def test_legacy_workspaces_mount_when_enabled"),
    ("def test_mcp_tools_list_respects_kb_action_policy", "def test_mcp_tools_list_respects_workspace_action_policy"),
    ("def test_openapi_kb_slice_has_many_paths", "def test_openapi_workspaces_slice_has_many_paths"),
    ("def test_delete_kb_after_entities_exist", "def test_delete_workspace_after_entities_exist"),
    ("def test_kb_graph_audit_visible_to_viewer_not_platform_audit", "def test_workspace_graph_audit_visible_to_viewer_not_platform_audit"),
    ("def test_mapping_kb_isolation", "def test_mapping_workspace_isolation"),
    ("def test_graph_page_api_is_kb_scoped_not_global", "def test_graph_page_api_is_workspace_scoped_not_global"),
    ("def test_dual_kb_graph_snapshot_isolation", "def test_dual_workspace_graph_snapshot_isolation"),
    ("def test_kb_capabilities_unit_viewer_vs_editor", "def test_workspace_capabilities_unit_viewer_vs_editor"),
    ("def test_kb_capabilities_http", "def test_workspace_capabilities_http"),
    ("def test_kb_graph_and_ontology_stay_inside_one_knowledge_base", "def test_graph_and_ontology_stay_inside_one_workspace"),
    ("def test_desktop_allows_kbs_without_bearer", "def test_desktop_allows_workspaces_without_bearer"),
    ("def test_kb_backfill_creates_organization", "def test_workspace_backfill_creates_organization"),
    ("def test_alerts_kb_isolation", "def test_alerts_workspace_isolation"),
    ("def test_sources_kb_isolation", "def test_sources_workspace_isolation"),
    ("def test_kb_api_token_reads_scoped_kb_graph", "def test_workspace_api_token_reads_scoped_graph"),
    ("def test_kb_isolation_on_read", "def test_workspace_isolation_on_read"),
    ("def test_first_user_is_admin_and_owns_the_public_kb", "def test_first_user_is_admin_and_owns_the_public_workspace"),
    ("def test_restricted_kb_is_hidden_and_roles_are_enforced", "def test_restricted_workspace_is_hidden_and_roles_are_enforced"),
    ("def test_open_statement_validation_and_kb_guard", "def test_open_statement_validation_and_workspace_guard"),
    ("def test_postgres_kb_graph_audit_list", "def test_postgres_workspace_graph_audit_list"),
    ("def test_disconnect_user_from_kb_closes_matching_sockets", "def test_disconnect_user_from_workspace_closes_matching_sockets"),
    ("def test_disconnect_user_closes_all_kb_sockets", "def test_disconnect_user_closes_all_workspace_sockets"),
    ("def test_broadcast_only_reaches_target_kb_room", "def test_broadcast_only_reaches_target_workspace_room"),
]


def main() -> int:
    changed = 0
    for path in sorted(TESTS.glob("test_*.py")):
        text = path.read_text(encoding="utf-8")
        new = text
        for old, sub in REPLACEMENTS:
            new = new.replace(old, sub)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"updated {changed} test files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
