# Manual smoke test (M5 gate)

Run with API (`uv run sema`) and Web (`pnpm dev`) on a fresh data dir or dev DB.

## Auth and KB shell

1. Register or log in at `http://127.0.0.1:5173`.
2. Open default KB → **Sources** upload a short `.txt` or paste text → status **uploaded**.
3. **Processing** → start job (pattern NER) → job **succeeded**; knowledge list shows localized error if forced fail.

## Graph Explorer (when `explorer_runtime`)

1. Open **Graph** for the KB; canvas loads or shows empty state without console errors.
2. **Settings → Graph projection** → **Rebuild**; dock or status shows projection revision bump (WS `projection_updated` in devtools Network → WS).
3. Switch to another KB and back; prior KB nodes must not linger (`key={kbId}` remount).

## Viewer (optional second user)

1. Add a **viewer** member; log in as viewer.
2. Graph opens read-only; link prediction / write actions disabled.
3. `POST .../graph/rebuild` as viewer returns **403**.

## Automated substitutes

```bash
uv run pytest tests/test_release_gate.py tests/test_realtime_ws.py -q
pnpm --filter @sema/web test
```

### Playwright (optional)

Starts a disposable API (SQLite under `data-e2e/`, port **8091**, `SEMA_INGEST_INLINE=1`; `SEMA_DATABASE_URL` is cleared so `.env` Postgres is not used) and Vite (**5174**) unless servers are already up:

```bash
cd fellowos/sema
pnpm install
pnpm --filter @sema/web exec playwright install chromium
pnpm test:e2e
```

Reuse your own `uv run sema` + `pnpm dev` on the default ports:

```bash
SEMA_E2E_SKIP_SERVERS=1 SEMA_E2E_WEB_PORT=5173 pnpm --filter @sema/web test:e2e
```

(`SEMA_API_URL` for Vite must still point at the running API.)

Manual checklist above remains the release fallback when e2e is not run.
