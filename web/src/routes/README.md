# App routing (`src/routes/`)

| File | Role |
| --- | --- |
| `index.tsx` | **`AppRoutes`** — full route table (marketing, docs, platform, workspaces) |
| `lazy-pages.ts` | `React.lazy` imports for route entries (code-split chunks) |
| `guards.tsx` | Auth / workspace legacy redirects, `AdminOnly`, `SettingsAccess` |
| `ui.tsx` | `Lazy`, `WorkspaceLazy` suspense wrappers |
| `admin-landing-redirect.tsx`, `workspaces-landing-redirect.tsx` | Platform entry redirects |

Feature UI lives under `modules/<segment>/` (`index.tsx` route entry, `pages/`, `components/`). Lazy imports in `lazy-pages.ts`; URL wiring in `index.tsx`.
