#!/usr/bin/env python3
"""Rename delivery→interfaces; move application openapi/mcp→interfaces/contract."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.application.openapi.", "basis.interface.contract.openapi."),
    ("basis.application.mcp.", "basis.interface.contract.mcp."),
    ("basis.delivery.", "basis.interface."),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.ini", "**/*.toml", "**/*.yml", "**/*.mjs")

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
    skip_names = {"migrate_interfaces_v4.py", "migrate_package_layout_v3_layers.py"}
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
