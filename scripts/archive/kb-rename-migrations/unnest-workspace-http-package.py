#!/usr/bin/env python3
"""Move basis/interface/http/workspace/*.py → interface/http/ (flat, no subpackage)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "interface" / "http"
PKG = HTTP / "workspace"

SKIP_PARTS = {".git", ".venv", "venv", "node_modules", "docs", "__pycache__"}
TEXT_SUFFIXES = {".py", ".md", ".mjs", ".sh", ".yml", ".yaml", ".ini", ".toml"}


def _skipped(path: Path) -> bool:
    return any(part in SKIP_PARTS for part in path.parts)


def git_mv(old: Path, new: Path) -> None:
    if new.exists():
        raise SystemExit(f"target exists: {new}")
    subprocess.run(["git", "mv", str(old), str(new)], cwd=ROOT, check=True)


def main() -> int:
    if not PKG.is_dir():
        print("no workspace/ package", file=sys.stderr)
        return 1

    modules = sorted(p for p in PKG.glob("*.py") if p.name != "__init__.py")
    mapping: dict[str, str] = {}
    for old in modules:
        new = HTTP / old.name
        mapping[old.stem] = old.stem
        print(f"git mv workspace/{old.name} → {old.name}")
        git_mv(old, new)

    init = PKG / "__init__.py"
    if init.is_file():
        init.unlink()

    pairs = sorted(
        [(f"basis.interface.http.workspace.{name}", f"basis.interface.http.{name}") for name in mapping],
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

    if PKG.is_dir() and not any(PKG.iterdir()):
        PKG.rmdir()

    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
