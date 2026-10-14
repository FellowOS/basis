# Realtime graph WebSocket (M4)

Sema pushes **projection** events to the Web UI over a KB-scoped WebSocket. Canonical state still lives in the ledger; clients refetch graph data after `projection_updated`.

## Endpoints

| Piece | Path / note |
| --- | --- |
| Ticket | `POST /api/kbs/{kb_id}/realtime-ticket` (Bearer auth, ~60s TTL, one-time) |
| Socket | `WS /api/kbs/{kb_id}/ws/graph-updates?ticket=…` |
| Event | `{"type":"projection_updated","kb_id":"…","projection_revision":N}` |
| Revoke | `{"type":"access_revoked",…}` when membership or account is revoked |

Explorer in Sema Web uses `openGraphUpdatesSocket` from `ExplorerHostProvider` (ticketed URL + cookies).

## Single-process deployment (current)

- `GraphWsHub` and `RealtimeTicketStore` are **in-memory** on `app.state`.
- Broadcasts reach only sockets connected to **that** API process.
- Suitable for `uv run sema`, Docker single replica, or dev.

## Multi-replica gap

Running **multiple API workers** (e.g. several Uvicorn workers or horizontal pods) without sticky sessions means:

- Tickets issued on worker A are invalid on worker B.
- `projection_updated` emitted on worker A does not reach clients on worker B.

**Not implemented yet:** shared ticket store (Redis) + cross-instance pub/sub for WS fan-out. Until then, use **one** API process per deployment or terminate TLS at a sticky load balancer and accept per-node fan-out.

## Verification

```bash
uv run pytest tests/test_ws_hub.py tests/test_realtime_ws.py -q
```

Manual: `docs/ops/smoke-test.md` (graph rebuild → revision bump).
