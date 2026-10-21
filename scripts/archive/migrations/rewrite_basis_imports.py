#!/usr/bin/env python3
"""One-shot import path rewrites (historical migrations only — prefer migrate_package_layout_v2)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Longest / most specific prefixes first (pre–layout-target legacy names).
REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.knowledge.", "basis.core.ledger."),
    ("basis.pipeline.", "basis.core.pipeline."),
    ("basis.explorer.", "basis.core.explorer."),
    ("basis.ontology.", "basis.core.projection.legacy_ontology."),
    ("basis.reasoning.", "basis.core.explorer.reasoning."),
    ("basis.graph.", "basis.core.projection."),
    ("basis.admin.", "basis.control.admin."),
    ("basis.auth.", "basis.control.identity."),
    ("basis.realtime.", "basis.control.realtime."),
    ("basis.models.", "basis.control.catalog."),
    ("basis.mcp.", "basis.api.mcp."),
    ("basis.observability.", "basis.runtime.observability."),
    ("basis.migration.", "basis.tooling.migration."),
    ("basis.test_support.", "basis.tooling.test_support."),
    ("basis.database.", "basis.runtime.database."),
    ("basis.database", "basis.runtime.database"),
    ("basis.config.", "basis.runtime.config."),
    ("basis.config", "basis.runtime.config"),
    ("basis.limits.", "basis.runtime.limits."),
    ("basis.limits", "basis.runtime.limits"),
    ("basis.capabilities.", "basis.runtime.capabilities."),
    ("basis.capabilities", "basis.runtime.capabilities"),
    ("basis.sqlite_connection.", "basis.runtime.sqlite_connection."),
    ("basis.sqlite_connection", "basis.runtime.sqlite_connection"),
    ("basis.db.", "basis.tooling.db."),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.yml", "**/*.yaml", "**/*.toml", "**/*.mjs")

SKIP_DIRS = {".git", "node_modules", "dist", ".venv", "__pycache__", "web/node_modules"}


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def rewrite_file(path: Path) -> bool:
    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        return False
    original = text
    for old, new in REPLACEMENTS:
        text = text.replace(old, new)
    if text != original:
        path.write_text(text, encoding="utf-8")
        return True
    return False


def main() -> int:
    changed = 0
    for pattern in GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file() or should_skip(path):
                continue
            if path.name == "rewrite_basis_imports.py":
                continue
            if rewrite_file(path):
                changed += 1
    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
