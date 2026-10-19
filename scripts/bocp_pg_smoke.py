#!/usr/bin/env python3
"""Minimal BOCP inbound sync smoke against the configured Basis API (Postgres dev).

Usage (from repo root, API running, `.env` loaded):

  uv run python scripts/bocp_pg_smoke.py \\
    --kb-id 108dd8a0-297b-4c37-862f-f47da99ae4f3 \\
    --mapping-id stm_4f4c87edb0b941ed

Optional: `--mcp` to call sync via MCP instead of HTTP.
"""

from __future__ import annotations

import argparse
import json
import sys

import httpx

from basis.infra.config import Settings
from basis.transport.http.app import create_app


def _issue_owner_token(kb_id: str) -> str:
    store = create_app(Settings.from_env()).state.store
    row = store._conn.execute(
        "SELECT user_id FROM kb_members WHERE kb_id = ? AND role = 'owner' LIMIT 1",
        (kb_id,),
    ).fetchone()
    if not row:
        raise SystemExit(f"No owner for KB {kb_id}")
    token = store._issue_token(row[0])
    store._conn.commit()
    return token


def main() -> int:
    parser = argparse.ArgumentParser(description="BOCP inbound sync smoke")
    parser.add_argument("--kb-id", required=True)
    parser.add_argument("--mapping-id", required=True)
    parser.add_argument("--mcp", action="store_true", help="Use MCP tools/call sync")
    args = parser.parse_args()

    settings = Settings.from_env()
    base = f"http://{settings.host}:{settings.port}"
    token = _issue_owner_token(args.kb_id)
    headers = {"Authorization": f"Bearer {token}"}

    health = httpx.get(f"{base}/health", timeout=30)
    health.raise_for_status()
    print("health:", health.json())

    if args.mcp:
        payload = {
            "jsonrpc": "2.0",
            "id": 1,
            "method": "tools/call",
            "params": {
                "name": "sync_connector_table_mapping",
                "arguments": {"mapping_id": args.mapping_id},
            },
        }
        r = httpx.post(
            f"{base}/api/v1/kbs/{args.kb_id}/mcp",
            headers=headers,
            json=payload,
            timeout=120,
        )
        r.raise_for_status()
        body = r.json()
        if "error" in body:
            print(json.dumps(body, indent=2))
            return 1
        stats = json.loads(body["result"]["content"][0]["text"])
    else:
        r = httpx.post(
            f"{base}/api/v1/kbs/{args.kb_id}/connectors/table-mappings/{args.mapping_id}/sync",
            headers=headers,
            timeout=120,
        )
        r.raise_for_status()
        stats = r.json()

    print("sync:", json.dumps(stats, indent=2, default=str))
    return 0


if __name__ == "__main__":
    sys.exit(main())
