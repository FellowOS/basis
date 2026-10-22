#!/usr/bin/env python3
"""Rename kb_* in persistence, SQL helpers, and small internal vars."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".venv", "venv", "node_modules", "docs", "__pycache__", "desktop", "rename-kb-"}

REPLACEMENTS: list[tuple[str, str]] = [
    ("fetch_statement_kb_status", "fetch_statement_workspace_status"),
    ("fetch_statement_kb", "fetch_statement_for_workspace"),
    ("kb_mcp_stats", "workspace_mcp_stats"),
    ("ensure_kb_organization_id_column", "ensure_workspace_organization_id_column"),
    ("_kb_organization_id_column_exists", "_workspace_organization_id_column_exists"),
    ("repair_kb_organization_id_column", "repair_workspace_organization_id_column"),
    ("_ensure_desktop_default_kb", "_ensure_desktop_default_workspace"),
    ("_KB_SESSION_ONLY_SUFFIXES", "_WORKSPACE_SESSION_ONLY_SUFFIXES"),
    ("_SAFE_KB_ID", "_SAFE_WORKSPACE_ID"),
    ('or "kb"', 'or "workspace"'),
    ('context: str = "kb_graph"', 'context: str = "graph"'),
    ("admin_error_from_kb_graph_http", "admin_error_from_graph_http"),
]

SUFFIXES = {".py"}


def main() -> int:
    pairs = sorted(REPLACEMENTS, key=lambda x: len(x[0]), reverse=True)
    changed = 0
    for path in ROOT.rglob("*.py"):
        if any(s in SKIP for s in path.parts) or "rename-kb-persistence" in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        new = text
        for old, sub in pairs:
            new = new.replace(old, sub)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
            print(path.relative_to(ROOT))
    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
