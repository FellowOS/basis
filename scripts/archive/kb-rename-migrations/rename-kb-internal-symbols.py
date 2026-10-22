#!/usr/bin/env python3
"""Rename remaining internal kb_* symbols (deps, roles, OpenAPI export, search)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SKIP = {".git", ".venv", "venv", "node_modules", "docs", "__pycache__", "desktop"}

REPLACEMENTS: list[tuple[str, str]] = [
    ("knowledge-base", "workspaces"),
    ("export_openapi_v1_kb", "export_openapi_v1_workspaces"),
    ("cached_openapi_v1_kb", "cached_openapi_v1_workspaces"),
    ("openapi_v1_kb", "openapi_v1_workspaces"),
    ("_basis_openapi_v1_kb", "_basis_openapi_v1_workspaces"),
    ("get_kb_for_role", "get_workspace_for_role"),
    ("ensure_kb_viewer", "ensure_workspace_viewer"),
    ("_check_api_token_kb_access", "_check_api_token_workspace_access"),
    ("api_token_allows_kb", "api_token_allows_workspace"),
    ("KB_ROLES", "WORKSPACE_ROLES"),
    ("_tokens_for_kb", "_tokens_for_workspace"),
    ("reindex_kb", "reindex_workspace"),
    ("assert_row_in_kb", "assert_row_in_workspace"),
    ("wrong_kb", "wrong_workspace"),
    ('"kb_name"', '"workspace_name"'),
    ("kb_name", "workspace_name"),
    ("_DEFAULT_KB_GRAPH_DECISIONS_MAX_LIMIT", "_DEFAULT_GRAPH_DECISIONS_MAX_LIMIT"),
    ("KB_GRAPH_DECISIONS_MAX_LIMIT", "GRAPH_DECISIONS_MAX_LIMIT"),
    ('title"] = "Basis API — kb"', 'title"] = "Basis API — workspaces"'),
    ("Auth and knowledge-base access", "Auth and workspace access for request handlers"),
]

SUFFIXES = {".py", ".md", ".yml", ".mjs", ".ts", ".tsx", ".json"}


def _skip(p: Path) -> bool:
    return any(s in SKIP for s in p.parts)


def main() -> int:
    changed = 0
    pairs = sorted(REPLACEMENTS, key=lambda x: len(x[0]), reverse=True)
    for path in ROOT.rglob("*"):
        if not path.is_file() or _skip(path):
            continue
        if path.suffix not in SUFFIXES:
            continue
        if "rename-kb-internal" in path.name:
            continue
        text = path.read_text(encoding="utf-8")
        new = text
        for old, sub in pairs:
            new = new.replace(old, sub)
        if new != text:
            path.write_text(new, encoding="utf-8")
            changed += 1
    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
