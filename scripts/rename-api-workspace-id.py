#!/usr/bin/env python3
"""One-shot rename: workspace_id / /workspaces API → workspace_id / /workspaces (code + tests + web)."""

from __future__ import annotations

import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Longest-first identifier renames (whole-word).
IDENT_REPL = [
    ("list_governor_enabled_workspace_ids", "list_governor_enabled_workspace_ids"),
    ("list_visible_workspaces_for_user", "list_visible_workspaces_for_user"),
    ("list_visible_workspaces", "list_visible_workspaces"),
    ("list_all_workspaces", "list_all_workspaces"),
    ("list_workspace_ids", "list_workspace_ids"),
    ("get_workspace_for_admin", "get_workspace_for_admin"),
    ("get_workspace_for_editor", "get_workspace_for_editor"),
    ("get_workspace_for_viewer", "get_workspace_for_viewer"),
    ("get_workspace_for", "get_workspace_for"),
    ("get_knowledge_store", "get_knowledge_store"),
    ("revoke_workspace_member_realtime", "revoke_workspace_member_realtime"),
    ("try_disconnect_user_from_workspace", "try_disconnect_user_from_workspace"),
    ("disconnect_user_from_workspace", "disconnect_user_from_workspace"),
    ("build_workspace_core_context", "build_workspace_core_context"),
    ("workspace_capabilities", "workspace_capabilities"),
    ("workspace_from_row", "workspace_from_row"),
    ("fetch_workspace", "fetch_workspace"),
    ("insert_workspace", "insert_workspace"),
    ("update_workspace", "update_workspace"),
    ("delete_workspace", "delete_workspace"),
    ("create_workspace", "create_workspace"),
    ("describe_workspace", "describe_workspace"),
    ("list_workspaces", "list_workspaces"),
    ("purge_workspace_ledger_data", "purge_workspace_ledger_data"),
    ("_assert_workspace_exists", "_assert_workspace_exists"),
    ("_assert_row_in_workspace", "_assert_row_in_workspace"),
    ("_insert_workspace", "_insert_workspace"),
    ("_workspace_access_delegate", "_workspace_access_delegate"),
    ("_workspace_lock", "_workspace_lock"),
    ("_workspace_locks", "_workspace_locks"),
    ("_workspace_dir", "_workspace_dir"),
    ("_workspace_root", "_workspace_root"),
    ("_safe_workspace_segment", "_safe_workspace_segment"),
    ("_rebuild_workspace_projection", "_rebuild_workspace_projection"),
    ("WorkspaceAlertsAccess", "WorkspaceAlertsAccess"),
    ("create_workspace_alert", "create_workspace_alert"),
    ("get_workspace_alert", "get_workspace_alert"),
    ("count_workspace_unread_alerts", "count_workspace_unread_alerts"),
    ("drop_graph", "drop_graph"),
]

PATH_REPL = [
    ("/api/v1/workspaces", "/api/v1/workspaces"),
    ("/api/workspaces/", "/api/workspaces/"),
    ("/api/workspaces/{workspace_id}", "/api/workspaces/{workspace_id}"),
    ("/api/workspaces/{workspace_id}", "/api/workspaces/{workspace_id}"),
    ('"/workspaces/', '"/workspaces/'),
    ("'/workspaces/", "'/workspaces/"),
    ("/workspaces/:id", "/workspaces/:id"),
    ("/kbs\"", "/workspaces\""),
    ("/workspaces'", "/workspaces'"),
    ("/workspaces`", "/workspaces`"),
    ("/workspaces,", "/workspaces,"),
    ("/workspaces)", "/workspaces)"),
    ("/kbs\n", "/workspaces\n"),
    ("/workspaces ", "/workspaces "),
    ("/admin/workspaces", "/admin/workspaces"),
    ("{workspace_id}", "{workspace_id}"),
    ("workspaceApiTokenAuth", "workspaceApiTokenAuth"),
    ("session-or-workspace-api-token", "session-or-workspace-api-token"),
]

SKIP_SUFFIX = {".png", ".jpg", ".woff", ".woff2", ".json"}


def transform(text: str) -> str:
    for old, new in PATH_REPL:
        text = text.replace(old, new)
    for old, new in IDENT_REPL:
        if old == new:
            continue
        text = re.sub(rf"\b{re.escape(old)}\b", new, text)
    # Remaining tenancy id parameter / variable (after compounds).
    text = re.sub(r"\bkb_id\b", "workspace_id", text)
    return text


def should_process(path: Path) -> bool:
    if path.suffix in SKIP_SUFFIX:
        return False
    if "node_modules" in path.parts or ".venv" in path.parts:
        return False
    if path.suffix in {".py", ".ts", ".tsx", ".mjs", ".md", ".mdx"}:
        return True
    if path.suffix == ".sql" and "migrations" not in str(path):
        return True
    return False


def main() -> None:
    roots = [
        ROOT / "basis",
        ROOT / "tests",
        ROOT / "scripts",
        ROOT / "web" / "src",
        ROOT / "web" / "e2e",
        ROOT / "web" / "content",
        ROOT / "docs",
        ROOT / "openapi",
    ]
    changed = 0
    for root in roots:
        if not root.is_dir():
            continue
        for path in root.rglob("*"):
            if not path.is_file() or not should_process(path):
                continue
            if "basis-openapi/schema" in str(path) and path.suffix == ".d.ts":
                continue  # regenerated
            try:
                raw = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            new = transform(raw)
            if new != raw:
                path.write_text(new, encoding="utf-8")
                changed += 1
    print(f"updated {changed} files")


if __name__ == "__main__":
    main()
