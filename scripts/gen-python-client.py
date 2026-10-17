#!/usr/bin/env python3
"""Generate Python client operation manifest from OpenAPI v1."""

from __future__ import annotations

import json
from pathlib import Path

import yaml

REPO = Path(__file__).resolve().parents[1]
SPEC = REPO / "openapi" / "basis-v1.yaml"
OUT = REPO / "packages" / "client-py" / "basis_client" / "_generated.py"


def main() -> None:
    spec = yaml.safe_load(SPEC.read_text(encoding="utf-8"))
    ops: list[dict[str, str]] = []
    for path, item in (spec.get("paths") or {}).items():
        if not isinstance(item, dict):
            continue
        for method, op in item.items():
            if method not in ("get", "post", "put", "patch", "delete") or not isinstance(op, dict):
                continue
            oid = op.get("operationId")
            if oid:
                ops.append({"operationId": oid, "method": method.upper(), "path": path})
    ops.sort(key=lambda x: x["operationId"])

    lines = [
        '"""Auto-generated from openapi/basis-v1.yaml — do not edit."""',
        "",
        "from __future__ import annotations",
        "",
        "OPERATIONS: list[dict[str, str]] = " + json.dumps(ops, indent=4),
        "",
    ]
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text("\n".join(lines) + "\n", encoding="utf-8")
    print(f"Wrote {OUT} ({len(ops)} operations)")


if __name__ == "__main__":
    main()
