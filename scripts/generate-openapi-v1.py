#!/usr/bin/env python3
"""Emit OpenAPI v1 YAML from the live FastAPI app (route + Pydantic models).

Outputs:
  - openapi/basis-v1.yaml          — full contract (/api/v1 paths)
  - openapi/basis-v1-platform.yaml — platform / admin surface (session auth)
  - openapi/basis-v1-kb.yaml       — knowledge-base surface (session or KB API token)

See docs/design/openapi-v1-spec.md §2 (two surfaces).
"""

from __future__ import annotations

import argparse
from copy import deepcopy
from pathlib import Path
from typing import Literal

import yaml

from basis.api.app import create_app
from basis.config import Settings

Surface = Literal["public", "platform", "knowledge-base"]

# KB paths that require a logged-in session (API tokens rejected in code).
_KB_SESSION_ONLY_SUFFIXES = (
    "/tokens",
    "/members",
)


def _v1_path(path: str) -> str | None:
    if path in ("/docs", "/docs/oauth2-redirect", "/redoc", "/openapi.json"):
        return None
    if path == "/health":
        return "/api/v1/health"
    if path.startswith("/api/v1/"):
        return path
    if path.startswith("/api/"):
        return "/api/v1/" + path[len("/api/") :]
    return path


def classify_surface(path: str) -> Surface:
    """Classify a v1 path for OpenAPI audience (platform vs knowledge-base)."""
    if path in ("/api/v1/health",) or path.startswith("/api/v1/auth/"):
        return "public"
    if path.startswith(
        (
            "/api/v1/admin/",
            "/api/v1/platform/",
            "/api/v1/settings/",
            "/api/v1/models",
            "/api/v1/model-providers",
            "/api/v1/orgs/",
            "/api/v1/users",
            "/api/v1/audit",
            "/api/v1/reason/",
        )
    ):
        return "platform"
    if path == "/api/v1/kbs":
        return "platform"
    if path.startswith("/api/v1/kbs/{kb_id}"):
        for suffix in _KB_SESSION_ONLY_SUFFIXES:
            if path.endswith(suffix) or f"{suffix}/" in path:
                return "platform"
        return "knowledge-base"
    return "platform"


def _annotate_surfaces(paths: dict) -> None:
    for path, path_item in paths.items():
        surface = classify_surface(path)
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            op["x-basis-surface"] = surface
            if surface == "platform":
                op.setdefault("x-basis-auth", "session")
            elif surface == "knowledge-base":
                op.setdefault("x-basis-auth", "session-or-kb-api-token")
            else:
                op.setdefault("x-basis-auth", "public-or-session")


def _security_components() -> dict:
    return {
        "sessionAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": "User session JWT from POST /api/v1/auth/login (console / platform admin).",
        },
        "kbApiTokenAuth": {
            "type": "http",
            "scheme": "bearer",
            "description": (
                "KB-scoped API token (read or write). Token must include this kb_id. "
                "Same tokens as MCP (Authorization: Bearer). Created under KB settings (session only)."
            ),
        },
    }


def build_openapi_v1(*, data_dir: Path) -> dict:
    app = create_app(Settings(data_dir=data_dir))
    schema = deepcopy(app.openapi())
    paths: dict = {}
    for path, item in schema.get("paths", {}).items():
        mapped = _v1_path(path)
        if mapped is None:
            continue
        paths[mapped] = item
    _annotate_surfaces(paths)
    schema["paths"] = dict(sorted(paths.items()))
    schema["openapi"] = "3.1.0"
    schema["info"] = {
        "title": "Basis API",
        "version": "1.0.0",
        "description": (
            "Normative HTTP contract for Basis. Paths use /api/v1 prefix.\n\n"
            "**Two surfaces** (see x-basis-surface on each operation):\n"
            "- `platform` — console & system/org admin; **session JWT** (`sessionAuth`).\n"
            "- `knowledge-base` — KB data & integration (MCP parity); **session or KB API token** "
            "(`kbApiTokenAuth`).\n\n"
            "Split specs: basis-v1-platform.yaml, basis-v1-kb.yaml. "
            "MCP: POST /api/v1/kbs/{kb_id}/mcp. "
            "Docs: docs/design/openapi-v1-spec.md."
        ),
    }
    schema["servers"] = [{"url": "/", "description": "Basis API host (paths include /api/v1)"}]
    schema.setdefault("components", {})
    schema["components"]["securitySchemes"] = {
        **schema["components"].get("securitySchemes", {}),
        **_security_components(),
    }
    schema["x-basis-surfaces"] = {
        "platform": {
            "description": "Platform & admin APIs for the web console and operators.",
            "auth": "sessionAuth",
            "openapi": "basis-v1-platform.yaml",
        },
        "knowledge-base": {
            "description": "KB-scoped APIs; same access model as MCP (KB API token or user session with KB role).",
            "auth": "sessionAuth or kbApiTokenAuth",
            "openapi": "basis-v1-kb.yaml",
        },
    }
    return schema


def _filter_paths(paths: dict, surfaces: set[Surface]) -> dict:
    out: dict = {}
    for path, path_item in paths.items():
        kept = {}
        for method, op in path_item.items():
            if method.startswith("x-") or not isinstance(op, dict):
                continue
            if op.get("x-basis-surface") in surfaces:
                kept[method] = op
        if kept:
            for k, v in path_item.items():
                if k.startswith("x-"):
                    kept[k] = v
            out[path] = kept
    return dict(sorted(out.items()))


def _write_yaml(path: Path, schema: dict) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as f:
        yaml.dump(
            schema,
            f,
            sort_keys=False,
            allow_unicode=True,
            default_flow_style=False,
            width=120,
        )


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "--data-dir",
        type=Path,
        default=Path("/tmp/basis-openapi-gen"),
        help="Temporary data dir for create_app (default: /tmp/basis-openapi-gen)",
    )
    parser.add_argument(
        "--out-dir",
        type=Path,
        default=Path("openapi"),
        help="Directory for basis-v1*.yaml (default: openapi/)",
    )
    args = parser.parse_args()
    args.data_dir.mkdir(parents=True, exist_ok=True)

    full = build_openapi_v1(data_dir=args.data_dir)
    out_dir = args.out_dir

    full_path = out_dir / "basis-v1.yaml"
    _write_yaml(full_path, full)
    print(f"Wrote {full_path} ({len(full['paths'])} paths)")

    for name, surfaces in (
        ("basis-v1-platform.yaml", {"public", "platform"}),
        ("basis-v1-kb.yaml", {"public", "knowledge-base"}),
    ):
        part = deepcopy(full)
        part["paths"] = _filter_paths(full["paths"], surfaces)
        part["info"] = deepcopy(full["info"])
        part["info"]["title"] = f"Basis API — {name.replace('basis-v1-', '').replace('.yaml', '')}"
        out = out_dir / name
        _write_yaml(out, part)
        print(f"Wrote {out} ({len(part['paths'])} paths)")


if __name__ == "__main__":
    main()
