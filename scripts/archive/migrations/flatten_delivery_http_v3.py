#!/usr/bin/env python3
"""Flatten basis/delivery/http/routes/** into basis/delivery/http/*.py (phase 2)."""

from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "delivery" / "http"
ROUTES = HTTP / "routes"
V1 = ROUTES / "v1"

SKIP_DIRS = {".git", "node_modules", "__pycache__"}


def _flat_name_from_v1(rel: Path) -> str:
    parts = list(rel.parts)
    if parts[-1] == "__init__.py":
        parts = parts[:-1]
        if not parts:
            return "routes_pkg"
        return "_".join(parts)
    stem = rel.stem
    if len(parts) == 1:
        if stem == "mount":
            return "mount_v1"
        return stem
    return "_".join(parts[:-1] + [stem])


def _old_module(v1_rel: Path) -> str:
    parts = list(v1_rel.parts)
    if parts[-1] == "__init__.py":
        parts = parts[:-1]
        if not parts:
            return "basis.interface.http.routes.v1"
        return "basis.interface.http.routes.v1." + ".".join(parts)
    stem = ".".join(parts).removesuffix(".py")
    return f"basis.interface.http.routes.v1.{stem}"


def _new_module(flat: str) -> str:
    return f"basis.interface.http.{flat.removesuffix('.py')}"


def _skip_init_marker(path: Path) -> bool:
    if path.name != "__init__.py":
        return False
    text = path.read_text(encoding="utf-8")
    return "APIRouter" not in text and "include_router" not in text


def _collect_moves() -> list[tuple[Path, Path, str, str]]:
    moves: list[tuple[Path, Path, str, str]] = []
    if V1.is_dir():
        for path in sorted(V1.rglob("*.py")):
            if _skip_init_marker(path):
                continue
            rel = path.relative_to(V1)
            flat = _flat_name_from_v1(rel)
            dst = HTTP / f"{flat}.py"
            moves.append((path, dst, _old_module(rel), _new_module(flat)))
    for name in ("health.py", "openapi_v1.py", "ingest_helpers.py"):
        src = ROUTES / name
        if src.is_file():
            flat = name.removesuffix(".py")
            old = f"basis.interface.http.routes.{flat}"
            moves.append((src, HTTP / name, old, _new_module(flat)))
    return moves


def _rewrite_repo(replacements: list[tuple[str, str]]) -> int:
    replacements = sorted(replacements, key=lambda x: len(x[0]), reverse=True)
    changed = 0
    for pattern in ("**/*.py", "**/*.md", "**/*.ini"):
        for path in ROOT.glob(pattern):
            if not path.is_file() or any(s in path.parts for s in SKIP_DIRS):
                continue
            if path.name == "flatten_delivery_http_v3.py":
                continue
            try:
                text = path.read_text(encoding="utf-8")
            except UnicodeDecodeError:
                continue
            original = text
            for old, new in replacements:
                text = text.replace(old, new)
            if text != original:
                path.write_text(text, encoding="utf-8")
                changed += 1
    return changed


def main() -> int:
    if not ROUTES.is_dir():
        print(f"missing {ROUTES}", file=sys.stderr)
        return 1
    moves = _collect_moves()
    replacements = [(old, new) for _, _, old, new in moves]
    for src, dst, _, _ in moves:
        if not src.is_file():
            print(f"skip missing {src}", file=sys.stderr)
            continue
        if dst.exists() and dst.resolve() != src.resolve():
            print(f"conflict {dst} already exists", file=sys.stderr)
            return 1
        dst.parent.mkdir(parents=True, exist_ok=True)
        src.rename(dst)
        print(f"  {src.relative_to(ROOT)} -> {dst.relative_to(ROOT)}")
    # Remove empty route package dirs
    for path in sorted(ROUTES.rglob("*"), reverse=True):
        if path.is_dir() and not any(path.iterdir()):
            path.rmdir()
    n = _rewrite_repo(replacements)
    print(f"flattened {len(moves)} modules; rewrote imports in {n} files")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
