#!/usr/bin/env python3
"""Line 1: block legacy Explorer session imports under basis/ and tests/."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCAN_DIRS = (ROOT / "basis", ROOT / "tests")
PATTERN = re.compile(
    r"^\s*(?:from|import)\s+semantica\.explorer\.session|"
    r'["\']semantica\.explorer\.session',
    re.MULTILINE,
)
ALLOWLIST_PATH = ROOT / "scripts" / "semantica-explorer-session.allowlist"


def _collect() -> list[str]:
    hits: list[str] = []
    for base in SCAN_DIRS:
        if not base.is_dir():
            continue
        for path in sorted(base.rglob("*.py")):
            text = path.read_text(encoding="utf-8")
            if PATTERN.search(text):
                hits.append(str(path.relative_to(ROOT)))
    return hits


def main() -> int:
    found = _collect()
    allow: set[str] = set()
    if ALLOWLIST_PATH.is_file():
        allow = {
            line.strip()
            for line in ALLOWLIST_PATH.read_text(encoding="utf-8").splitlines()
            if line.strip() and not line.strip().startswith("#")
        }
    extra = sorted(set(found) - allow)
    missing = sorted(allow - set(found))
    if extra:
        print("Unexpected legacy Explorer session imports (not in allowlist):", file=sys.stderr)
        for path in extra:
            print(f"  {path}", file=sys.stderr)
    if missing:
        print("Allowlist entries with no import (stale):", file=sys.stderr)
        for path in missing:
            print(f"  {path}", file=sys.stderr)
    if extra or missing:
        return 1
    print(f"OK: {len(found)} file(s) match session allowlist.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
