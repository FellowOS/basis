#!/usr/bin/env python3
"""Rewrite imports after layered package layout (delivery / application / domain / infrastructure)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

# Most specific (long) prefixes first.
REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.api.", "basis.delivery."),
    ("basis.core.ledger.", "basis.domain.knowledge."),
    ("basis.core.pipeline.", "basis.domain.knowledge.pipeline."),
    ("basis.core.projection.", "basis.domain.graph.projection."),
    ("basis.core.explorer.", "basis.domain.graph.explorer."),
    ("basis.core.connectors.", "basis.domain.integration."),
    ("basis.core.connectors", "basis.domain.integration"),
    ("basis.core.pipeline", "basis.domain.knowledge.pipeline"),
    ("basis.core.errors", "basis.domain.errors"),
    ("basis.control.", "basis.domain.tenancy."),
    ("basis.runtime.", "basis.infra.runtime."),
    ("basis.tooling.", "basis.infra.tooling."),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.yml", "**/*.yaml", "**/*.toml", "**/*.ini", "**/*.mjs", "**/*.allowlist")

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
    skip_names = {
        "migrate_package_layout_v2.py",
        "migrate_package_layout_v3_layers.py",
        "rewrite_basis_imports.py",
    }
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
