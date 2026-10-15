# Realtime graph WebSocket (M4)

Basis pushes **projection** events to the Web UI over a KB-scoped WebSocket. Canonical state still lives in the ledger; clients refetch graph data after `projection_updated`.

## Endpoints

| Piece | Path / note |
| --- | --- |
| Ticket | `POST /api/kbs/{kb_id}/realtime-ticket` (Bearer auth, ~60s TTL, one-time) |
| Socket | `WS /api/kbs/{kb_id}/ws/graph-updates?ticket=…` |
| Event | `{"type":"projection_updated","kb_id":"…","projection_revision":N}` |
| Revoke | `{"type":"access_revoked",…}` when membership or account is revoked |

Explorer in Basis Web uses `openGraphUpdatesSocket` from `ExplorerHostProvider` (ticketed URL + cookies).

## Single-process deployment (current)

- `GraphWsHub` and `RealtimeTicketStore` are **in-memory** on `app.state`.
- Broadcasts reach only sockets connected to **that** API process.
- Suitable for `uv run basis`, Docker single replica, or dev.

## Multi-replica (out of scope for now)

Running **multiple API workers** without sticky sessions (e.g. round-robin across Uvicorn workers or pods) is **not supported** for realtime graph updates:

- Tickets issued on worker A are invalid on worker B.
- `projection_updated` on worker A does not reach WebSockets on worker B.

**Product decision:** we are **not** building Redis (or other) cross-instance ticket store / WS pub/sub in the near term.

**Supported patterns:**

- **One API process** per environment (`uv run basis`, single container replica, `workers=1`).
- **Sticky sessions** at the load balancer so HTTP + WS stay on the same instance (each instance still has its own in-memory hub; scale only helps HTTP, not shared WS fan-out across nodes).

If realtime breaks after enabling multiple workers, reduce to a single process or enable stickiness—do not expect a shared Redis layer.

## Verification

```bash
uv run pytest tests/test_ws_hub.py tests/test_realtime_ws.py -q
```

Manual: `docs/ops/smoke-test.md` (graph rebuild → revision bump).
