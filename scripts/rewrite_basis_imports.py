#!/usr/bin/env python3
"""One-shot import path rewrites after basis/ package layout change."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Longest / most specific prefixes first.
REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.api.", "basis.transport.http."),
    ("basis.api:", "basis.transport.http:"),
    ("basis.knowledge.", "basis.domain.kb."),
    ("basis.pipeline.", "basis.domain.ingest."),
    ("basis.explorer.", "basis.domain.explorer."),
    ("basis.ontology.", "basis.domain.ontology."),
    ("basis.reasoning.", "basis.domain.reasoning."),
    ("basis.graph.", "basis.domain.graph."),
    ("basis.core.", "basis.integration."),
    ("basis.mcp.", "basis.transport.mcp."),
    ("basis.admin.", "basis.platform.admin."),
    ("basis.auth.", "basis.platform.auth."),
    ("basis.realtime.", "basis.platform.realtime."),
    ("basis.models.", "basis.platform.models."),
    ("basis.chat.", "basis.integration.chat."),
    ("basis.observability.", "basis.infra.observability."),
    ("basis.migration.", "basis.ops.migration."),
    ("basis.test_support.", "basis.ops.test_support."),
    ("basis.database.", "basis.infra.database."),
    ("basis.database", "basis.infra.database"),
    ("basis.config.", "basis.infra.config."),
    ("basis.config", "basis.infra.config"),
    ("basis.limits.", "basis.infra.limits."),
    ("basis.limits", "basis.infra.limits"),
    ("basis.capabilities.", "basis.infra.capabilities."),
    ("basis.capabilities", "basis.infra.capabilities"),
    ("basis.sqlite_connection.", "basis.infra.sqlite_connection."),
    ("basis.sqlite_connection", "basis.infra.sqlite_connection"),
    ("basis.db.", "basis.ops.db."),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.yml", "**/*.yaml", "**/*.toml", "**/*.mjs")

SKIP_DIRS = {".git", "node_modules", "dist", ".venv", "__pycache__", "web/node_modules"}


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def rewrite_file(path: Path) -> bool:
    text = path.read_text(encoding="utf-8")
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
