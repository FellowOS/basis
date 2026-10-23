#!/usr/bin/env python3
"""Root HTTP modules that re-export shared/ must stay thin stubs."""

from __future__ import annotations

import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
HTTP = ROOT / "basis" / "interface" / "http"

STUBS = (
    "deps.py",
    "core_context.py",
    "operation_http.py",
    "request_id.py",
    "rest_v1_concurrency.py",
    "upload_bounds.py",
    "http_path.py",
    "legacy_api_gate.py",
    "legacy_deprecation.py",
)

MAX_LINES = 10
ROUTE_RE = re.compile(r"@router\.")


def main() -> int:
    errors: list[str] = []
    for name in STUBS:
        path = HTTP / name
        if not path.is_file():
            errors.append(f"missing stub: {path.relative_to(ROOT)}")
            continue
        lines = path.read_text(encoding="utf-8").splitlines()
        if len(lines) > MAX_LINES:
            errors.append(f"{path.relative_to(ROOT)}: stub exceeds {MAX_LINES} lines")
        text = "\n".join(lines)
        if "interface.http.shared." not in text:
            errors.append(f"{path.relative_to(ROOT)}: expected re-export from shared/")
        if ROUTE_RE.search(text):
            errors.append(f"{path.relative_to(ROOT)}: stubs must not define routes")
    if errors:
        for line in errors:
            print(line, file=sys.stderr)
        return 1
    print(f"OK: {len(STUBS)} HTTP shared re-export stubs are thin.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
