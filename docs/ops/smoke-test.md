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

`test_release_gate.py` includes viewer **403** on upload/rebuild/processing and read-only **graph/stats**, **graph/nodes**, **graph/search**.

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

`e2e/onboarding.spec.ts` covers register → paste text → pattern ingest → `graph/stats` and opening the Graph workspace shell (not canvas interaction).

`e2e/governance.spec.ts` covers review queue → Ontology Versions link, `reviewItem=` deep link for `statement_remember`, `?connectors=1` opening the ingest sources dialog, and Search → Graph temporal hint + link to the graph workspace.

`e2e/graph-diff.spec.ts` covers **Graph diff** after ingest (`GET .../graph/diff` via UI).

`e2e/search-graph-at.spec.ts` covers Search → Graph with `as_of` + search submit.

Manual checklist above remains the release fallback when e2e is not run.

## M6 deepening (post–Explorer migration)

Quick API smoke:

```bash
uv run pytest tests/test_m6_smoke.py tests/test_kb_alerts.py tests/test_kb_sources.py -q
```

### Governance & ontology

1. **Review** → queue header links to **Ontology → Versions**; empty queue shows the same hint.
2. Submit an ontology proposal (editor) → header **alerts** bell shows `governance.proposal_proposed`; link opens Versions + proposal modal.
3. Approve a merge that trips governance → bell links to review item when `item_id` is present.

### Connectors (no new kinds)

1. **Sources** → **Ingest sources** → create webhook; copy URL + Bearer from one-time panel.
2. Force `http_poll` / `git` sync failure (bad URL) → `sync_failed` alert → link opens sources with `?connectors=1&ingestSource=`.

### Search & time

1. **Search → Chunks** — set `as_of` / `created_after`; results respect ingest time.
2. **Search → Graph** — banner states graph uses current projection; link opens **Graph** timeline.

### Rules

1. **Ontology** tab → **Reasoning** — save a rule, toggle enabled, **Run**; results list inferred facts and rules-in-run.

Playground: SSE chat + stop + context-trim banner only (no token-budget testing required).
