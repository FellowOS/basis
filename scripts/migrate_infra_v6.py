#!/usr/bin/env python3
"""Rename basis.infrastructure → basis.infra."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

REPLACEMENTS: tuple[tuple[str, str], ...] = (
    ("basis.infrastructure.", "basis.infra."),
    ("basis/infrastructure/", "basis/infra/"),
)

GLOBS = ("**/*.py", "**/*.md", "**/*.ini", "**/*.toml", "**/*.yml", "**/*.mjs")

SKIP_DIRS = {".git", "node_modules", "dist", ".venv", "__pycache__", "web/node_modules"}


def should_skip(path: Path) -> bool:
    return any(part in SKIP_DIRS for part in path.parts)


def main() -> int:
    skip_names = {"migrate_infra_v6.py"}
    changed = 0
    for pattern in GLOBS:
        for path in ROOT.glob(pattern):
            if not path.is_file() or should_skip(path):
                continue
            if path.name in skip_names:
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            original = text
            for old, new in REPLACEMENTS:
                text = text.replace(old, new)
            if text != original:
                path.write_text(text, encoding="utf-8")
                changed += 1
    (ROOT / "basis" / "infra" / "__init__.py").write_text(
        '"""Infrastructure: runtime, tooling, migrations."""\n',
        encoding="utf-8",
    )
    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    sys.exit(main())
