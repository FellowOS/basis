#!/usr/bin/env python3
"""Rewrite imports/paths after package-layout-target Phase 1."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Most specific (long) prefixes first.
REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.transport.", "basis.api."),
    ("basis.integration.", "basis.application."),
    ("basis.domain.kb.", "basis.core.ledger."),
    ("basis.domain.ingest.", "basis.core.pipeline."),
    ("basis.domain.graph.", "basis.core.projection."),
    ("basis.domain.explorer.", "basis.core.explorer."),
    ("basis.domain.connectors.", "basis.core.connectors."),
    ("basis.domain.", "basis.core."),
    ("basis.platform.", "basis.control."),
    ("basis.infra.", "basis.runtime."),
    ("basis.ops.", "basis.tooling."),
    ("basis.core.kb.", "basis.core.ledger."),
    ("basis.core.ingest.", "basis.core.pipeline."),
    ("basis.core.graph.", "basis.core.projection."),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.yml", "**/*.yaml", "**/*.toml", "**/*.ini", "**/*.mjs")

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
    skip_names = {"migrate_package_layout_v2.py", "rewrite_basis_imports.py"}
    changed = 0
    for pattern in GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file() or should_skip(path):
                continue
            if path.name in skip_names:
                continue
            if rewrite_file(path):
                changed += 1
    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
