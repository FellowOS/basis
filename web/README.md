# @basis/web

Vite + React front end for the Basis platform and per–knowledge-base Explorer workspaces.

## Source layout

| Path | Role |
|------|------|
| `src/pages/` | **Routes** — thin pages: params, `ConsolePageLayout`, i18n. KB features live under `pages/kb/<segment>.tsx`. |
| `src/components/` | React UI — three roots: **`ui`**, **`admin`**, **`app`** (see below). |
| `src/explorer/` | **Explorer implementation** (vendored from semantica); see `src/explorer/README.md`. |
| `src/lib/` | `basis-openapi/` (generated types + `transport.ts`), `openapi-client.ts` (app helpers), session fetch, `kb-api-path.ts`. JSON: `openApi*` / `kbOpenApi*`. Regen types: `npm run gen:openapi-types`. |
| `server/` | **Hono web layer** — production static + `/api` reverse proxy (`server/prod.ts`); dev entry `server/dev.ts` (Hono + Vite middleware). Playground LLM config is browser-local. |
| `src/styles/` | Vendor overrides (e.g. Swagger UI); global chrome in root [`src/styles.css`](src/styles.css). |
| `e2e/` | Playwright specs. |

## `src/components/` — three roots

| Root | Role |
|------|------|
| **`ui/`** | shadcn registry only — update with `npx shadcn add -o`, no hand edits. |
| **`admin/`** | `/admin/*` UI — layout, section nav, org SSO, access settings; `admin/models/` for model catalog. |
| **`app/`** | Main product experience (KB, global shell, marketing, shared patterns, design extensions). |

**Dependency:** `admin/` and `app/` may import `ui/` and `app/*` shared layers; `ui/` must not import `admin/` or `app/`. No files at `components/` root except the three folders above.

### `app/` subfolders

| Path | Role |
|------|------|
| `app/shared/` | Cross-product UI (KB, marketing, admin pages, Explorer chrome). |
| `app/shared/primitives/` | Non-registry controls (icons, editors, date picker, …). |
| `app/shared/effects/` | Decorative motion. |
| `app/shared/console/` | List/data page patterns — used by `pages/*` and KB blocks. |
| `app/shared/shell/` | Global app chrome — `BasisLayout`, sidebar, account menu. |
| `app/kb/` | KB-only product UI — see [KB grouping](#appkb-grouping). |
| `app/marketing/` | Login and landing; `marketing/blocks/`. |

Tailwind class bundles: [`src/lib/ui-classes/`](src/lib/ui-classes/README.md).

## Three-layer flow (KB Explorer features)

1. **`pages/kb/*.tsx`** — routing, breadcrumbs, page-level actions, capability gates.
2. **`components/app/kb/workspaces/kb-*-workspace.tsx`** — `KbExplorerConsoleShell`, lazy `import()` of Explorer, loading copy.
3. **`explorer/workspaces/*/`** — screens, stores, Sigma/graph/ontology UI.

Platform-only pages (e.g. `pages/kbs.tsx`, `pages/settings.tsx`) skip layer 2–3.

## `app/kb/` grouping {#appkb-grouping}

- `explorer-shell/` — KB Explorer console frame (zone tabs, switcher, unavailable). Not `app/shared/shell/` (global layout).
- `workspaces/` — one file per KB nav destination that embeds Explorer.
- `widgets/` — panels, stats, bells, merge diff, KB integration (OpenAPI + MCP) pieces used by pages.
- `dialogs/` — import/export and ingest modals shared across KB UI.
- `ledger/` — entity browser, evidence inspector, entity ref line.
- `graph/` — graph toolbar / overview chrome (full graph UI stays in `src/explorer/`).

## Styling conventions

Product styling: **TS class bundles** in [`src/lib/ui-classes/`](src/lib/ui-classes/README.md); global control chrome (Button under `[data-basis-app]`, fields, badges) in [`src/styles.css`](src/styles.css).

- Prefer design tokens (`border-border`, `text-muted-foreground`) over one-off hex.
- Do not hand-edit `components/ui/*` for Basis; extend `styles.css` or `exWsGhost*` from `@/lib/ui-classes/explorer-ws.js`.

## Scripts

- `npm run dev` — Hono + Vite (port 5173): Hono proxies `/api`, `/openapi`, …; Vite handles SPA/HMR. `npm run dev:vite` — Vite only (no Hono; API calls need `VITE_BASIS_API_URL` or fail).
- `npm run build` — `tsc` + production bundle to `../dist/web`.
- `npm run start` — production Hono server (after `build`; serves `dist/web` + BFF).
- `npm test` / `npm run test:e2e` — Vitest and Playwright.

Run these from the `web/` directory (`cd web` after cloning the repo).

### E2E (Playwright)

`playwright.config.ts` starts **Basis API** with `BASIS_DATA_DIR=data-e2e` (enables `/_e2e/*` helpers) and the **Hono dev server**. Use `CI=1 npm run test:e2e` for a clean run with fixed ports. Specs live under `web/e2e/` (governance, MCP integration, search temporal URL, ontology proposal, graph diff cross-links, processing jobs, …).
