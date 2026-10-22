#!/usr/bin/env python3
"""Remove kb_/ _kb segments from workspace HTTP handler names."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "interface" / "http"

_HANDLER_RE = re.compile(r"^(\s*async def )([a-zA-Z0-9_]+)(\()", re.MULTILINE)
_ONT_RE = re.compile(r"^(\s*async def )(_kb_ont_)", re.MULTILINE)


def _clean_name(name: str) -> str:
    if name in ("__call__",):
        return name
    if name.startswith("_kb_ont_"):
        name = "_ont_" + name[len("_kb_ont_") :]
    name = name.replace("_kb_", "_")
    if name.startswith("kb_"):
        name = name[3:]
    if name.endswith("_kb"):
        name = name[:-3]
    while "__" in name:
        name = name.replace("__", "_")
    return name


def _rewrite(text: str) -> str:
    def repl(m: re.Match[str]) -> str:
        lead, name, paren = m.group(1), m.group(2), m.group(3)
        new = _clean_name(name)
        return f"{lead}{new}{paren}" if new != name else m.group(0)

    return _HANDLER_RE.sub(repl, text)


def main() -> int:
    changed = 0
    for path in sorted(HTTP.rglob("*.py")):
        text = path.read_text(encoding="utf-8")
        new = _rewrite(text)
        if new != text:
            path.write_text(new, encoding="utf-8")
            print(path.relative_to(ROOT))
            changed += 1
    print(f"updated {changed} modules")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
