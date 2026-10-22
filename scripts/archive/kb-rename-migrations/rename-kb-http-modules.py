#!/usr/bin/env python3
"""Rename basis/interface/http/kb_*.py → workspace/<name>.py (no filename prefix).

Prefer running this then scripts/flatten-workspace-http-modules.py if an old tree still has workspace_*.py at http root.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "interface" / "http"

SKIP_PARTS = {
    ".git",
    ".venv",
    "venv",
    "node_modules",
    "docs",
    "__pycache__",
    "desktop/release",
    "desktop/pack",
    ".api-stage",
}

TEXT_SUFFIXES = {".py", ".md", ".mjs", ".sh", ".yml", ".yaml", ".ini", ".toml"}


def _skipped(path: Path) -> bool:
    return any(part in SKIP_PARTS for part in path.parts)


def module_map() -> dict[str, str]:
    mapping: dict[str, str] = {}
    for path in sorted(HTTP.glob("kb_*.py")):
        stem = path.stem
        if stem == "kb_kbs":
            new_stem = "workspace_resources"
        else:
            new_stem = "workspace_" + stem.removeprefix("kb_")
        mapping[stem] = new_stem
    return mapping


def git_mv(old: Path, new: Path) -> None:
    if new.exists():
        raise SystemExit(f"target exists: {new}")
    subprocess.run(["git", "mv", str(old), str(new)], cwd=ROOT, check=True)


def apply_import_rewrites(mapping: dict[str, str]) -> int:
    pairs = sorted(
        [(f"basis.interface.http.{old}", f"basis.interface.http.{new}") for old, new in mapping.items()],
        key=lambda x: len(x[0]),
        reverse=True,
    )
    changed = 0
    for path in ROOT.rglob("*"):
        if not path.is_file() or _skipped(path):
            continue
        if path.suffix not in TEXT_SUFFIXES:
            continue
        text = path.read_text(encoding="utf-8")
        new_text = text
        for old, new in pairs:
            new_text = new_text.replace(old, new)
        if new_text != text:
            path.write_text(new_text, encoding="utf-8")
            changed += 1
    return changed


def main() -> int:
    mapping = module_map()
    if not mapping:
        print("no kb_*.py modules under interface/http", file=sys.stderr)
        return 1

    for old_stem, new_stem in sorted(mapping.items()):
        old = HTTP / f"{old_stem}.py"
        new = HTTP / f"{new_stem}.py"
        if not old.is_file():
            raise SystemExit(f"missing {old}")
        print(f"git mv {old.name} → {new.name}")
        git_mv(old, new)

    n = apply_import_rewrites(mapping)
    print(f"updated {n} files with import paths")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
