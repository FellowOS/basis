#!/usr/bin/env python3
"""Move basis/interface/http/workspace_*.py → workspace/<name>.py (no workspace_ prefix)."""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "interface" / "http"
PKG = HTTP / "workspace"

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


def git_mv(old: Path, new: Path) -> None:
    if new.exists():
        raise SystemExit(f"target exists: {new}")
    subprocess.run(["git", "mv", str(old), str(new)], cwd=ROOT, check=True)


def main() -> int:
    sources = sorted(HTTP.glob("workspace_*.py"))
    if not sources:
        print("no workspace_*.py at interface/http root", file=sys.stderr)
        return 1

    PKG.mkdir(exist_ok=True)
    init = PKG / "__init__.py"
    if not init.is_file():
        init.write_text('"""Workspace-scoped HTTP handlers (`/api/v1/workspaces`)."""\n', encoding="utf-8")

    mapping: dict[str, str] = {}
    for old in sources:
        short = old.stem.removeprefix("workspace_")
        new = PKG / f"{short}.py"
        mapping[old.stem] = short
        print(f"git mv {old.name} → workspace/{new.name}")
        git_mv(old, new)

    pairs = sorted(
        [(f"basis.interface.http.{old}", f"basis.interface.http.workspace.{new}") for old, new in mapping.items()],
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

    print(f"updated {changed} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
