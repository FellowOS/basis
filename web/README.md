# @basis/web

Vite + React front end for the Basis platform and per–knowledge-base Explorer workspaces.

## Source layout

| Path | Role |
|------|------|
| `src/pages/` | **Routes** — thin pages: params, `ConsolePageLayout`, i18n. KB features live under `pages/kb/<segment>.tsx`. |
| `src/components/kb/` | **KB product shell** — wraps Explorer; no heavy graph/ontology logic here. |
| `src/explorer/` | **Explorer implementation** (vendored from semantica); see `src/explorer/README.md`. |
| `src/lib/` | Shared app logic: API, nav, URL state, session, graph theme sync, `use-*` hooks. |
| `src/components/ui/` | shadcn primitives. |
| `src/components/console-ui/` | Basis console patterns (tables, page header, empty states). |
| `src/styles/explorer/` | Explorer-specific CSS loaded from `styles.css`. |
| `e2e/` | Playwright specs. |

## Three-layer flow (KB Explorer features)

1. **`pages/kb/*.tsx`** — routing, breadcrumbs, page-level actions, capability gates.
2. **`components/kb/workspaces/kb-*-workspace.tsx`** — `KbExplorerConsoleShell`, lazy `import()` of Explorer, loading copy.
3. **`explorer/workspaces/*/`** — screens, stores, Sigma/graph/ontology UI.

Platform-only pages (e.g. `pages/kbs.tsx`, `pages/settings.tsx`) skip layer 2–3.

## `components/kb/` grouping

- `shell/` — console shell, zone tabs, switcher, unavailable state.
- `workspaces/` — one file per KB nav destination that embeds Explorer.
- `widgets/` — panels, stats, bells, merge diff, chat/MCP pieces used by pages.
- `dialogs/` — import/export and ingest modals shared across KB UI.

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
