# @basis/web

Vite + React front end for the Basis platform and per–knowledge-base Explorer workspaces.

## Source layout

| Path | Role |
|------|------|
| `src/pages/` | **Routes** — thin pages: params, `ConsolePageLayout`, i18n. KB features live under `pages/kb/<segment>.tsx`. |
| `src/components/` | React UI — three roots: **`ui`**, **`admin`**, **`app`** (see below). |
| `src/explorer/` | **Explorer implementation** (vendored from semantica); see `src/explorer/README.md`. |
| `src/lib/` | `basis-openapi/` (generated types + `transport.ts`), `openapi-client.ts` (app helpers), session fetch, `kb-api-path.ts`. JSON: `openApi*` / `kbOpenApi*`. Regen types: `npm run gen:openapi-types`. |
| `src/styles/explorer/` | Explorer-specific CSS loaded from `styles.css`. |
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

Style helpers without React components: `@/lib/ui/*` (e.g. `card-surface`).

## Three-layer flow (KB Explorer features)

1. **`pages/kb/*.tsx`** — routing, breadcrumbs, page-level actions, capability gates.
2. **`components/app/kb/workspaces/kb-*-workspace.tsx`** — `KbExplorerConsoleShell`, lazy `import()` of Explorer, loading copy.
3. **`explorer/workspaces/*/`** — screens, stores, Sigma/graph/ontology UI.

Platform-only pages (e.g. `pages/kbs.tsx`, `pages/settings.tsx`) skip layer 2–3.

## `app/kb/` grouping {#appkb-grouping}

- `explorer-shell/` — KB Explorer console frame (zone tabs, switcher, unavailable). Not `app/shared/shell/` (global layout).
- `workspaces/` — one file per KB nav destination that embeds Explorer.
- `widgets/` — panels, stats, bells, merge diff, chat/MCP pieces used by pages.
- `dialogs/` — import/export and ingest modals shared across KB UI.
- `ledger/` — entity browser, evidence inspector, entity ref line.
- `graph/` — graph toolbar / overview chrome (full graph UI stays in `src/explorer/`).

## Styling conventions

- **Basis + Tailwind** — prefer tokens (`border-border`, `text-muted-foreground`) over Explorer navy hex.
- **`lib/explorer-ws-classes.ts`** — shared Tailwind strings for Ontology, SPARQL, Reasoning, Import/Export, etc.
- **`lib/graph/graph-ui-classes.ts`** — graph toolbar, legend, loading overlay, inspector metrics; dynamic swatch/width helpers.
- **Workspace-local** — e.g. `ontologyUiClasses.ts` when only one hub needs the bundle.
- **CSS** — `styles/explorer/sem-components.css` for complex markdown/inspector rules that are awkward in JSX.

## Scripts

- `npm run dev` — Vite dev server (port 5173).
- `npm run build` — `tsc` + production bundle to `../dist/web`.
- `npm test` / `npm run test:e2e` — Vitest and Playwright.

Run these from the `web/` directory (`cd web` after cloning the repo).
